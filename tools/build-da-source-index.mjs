#!/usr/bin/env node

import {
  mkdir,
  readFile,
  rename,
  unlink,
  writeFile,
} from 'node:fs/promises';
import { createHash } from 'node:crypto';
import {
  dirname,
  isAbsolute,
  relative,
  resolve,
} from 'node:path';
// This build-only dependency is not shipped to the browser.
// eslint-disable-next-line import/no-extraneous-dependencies, import/extensions
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';

const DEFAULT_CONFIG_PATH = 'asset-index.config.json';
const DEFAULT_API_ORIGIN = 'https://admin.da.live';
const INDEX_FORMAT_VERSION = 1;
const RETRYABLE_STATUSES = new Set([429, 500, 502, 503, 504]);
const IMAGE_EXTENSIONS = new Set(['avif', 'gif', 'jpeg', 'jpg', 'png', 'svg', 'webp']);
const VIDEO_EXTENSIONS = new Set(['m4v', 'mov', 'mp4', 'webm']);
const AUDIO_EXTENSIONS = new Set(['m4a', 'mp3', 'ogg', 'wav']);

function option(args, name) {
  const index = args.indexOf(`--${name}`);
  return index >= 0 && args[index + 1] ? args[index + 1] : undefined;
}

function hasFlag(args, name) {
  return args.includes(`--${name}`);
}

function showHelp() {
  process.stdout.write(`Generate asset-index.json from one or more DA directories.

Usage:
  DA_IMS_TOKEN=... npm run search:index:da

Options:
  --config <file>         Configuration file (default: asset-index.config.json)
  --roots <paths>         Comma-separated directory override
  --output <file>         Output override
  --max-files <count>     Safety-limit override
  --pdf-max-pages <count> PDF page limit; 0 extracts every page
  --skip-pdf-text         Include PDFs without extracting their text
  --allow-partial         Write an index even when individual assets fail
  --help                  Show this help

Environment:
  DA_IMS_TOKEN            Required IMS bearer token for the DA APIs
  DA_ORG                  Optional organization override
  DA_SITE                 Optional site override
  ASSET_INDEX_ROOTS       Optional comma-separated directory override
`);
}

function positiveInteger(value, name, { allowZero = false } = {}) {
  const parsed = Number.parseInt(value, 10);
  const minimum = allowZero ? 0 : 1;
  if (!Number.isSafeInteger(parsed) || parsed < minimum) {
    throw new Error(`${name} must be an integer greater than or equal to ${minimum}.`);
  }
  return parsed;
}

function normalizeRoot(value) {
  const root = String(value || '').trim();
  if (!root) throw new Error('Asset index roots cannot be empty.');
  if (root.split('/').includes('..')) throw new Error(`Asset index root cannot contain "..": ${root}`);
  const normalized = `/${root.replace(/^\/+|\/+$/g, '')}`;
  if (normalized === '/') throw new Error('Refusing to crawl the entire DA site; configure a narrower root.');
  return normalized;
}

function parseRoots(value) {
  const candidates = Array.isArray(value) ? value : String(value || '').split(',');
  return [...new Set(candidates.map(normalizeRoot))];
}

function safeOutputPath(value) {
  const output = String(value || '').trim();
  if (!output) throw new Error('Asset index output cannot be empty.');
  const absolute = resolve(process.cwd(), output);
  const fromWorkingDirectory = relative(process.cwd(), absolute);
  if (isAbsolute(fromWorkingDirectory) || fromWorkingDirectory.startsWith('..')) {
    throw new Error('Asset index output must stay inside the working directory.');
  }
  return absolute;
}

function normalizeExtensions(values) {
  if (!Array.isArray(values) || !values.length) {
    throw new Error('Asset index extensions must be a non-empty array.');
  }
  return new Set(values.map((value) => String(value).toLowerCase().replace(/^\./, '')));
}

async function loadConfiguration(args) {
  const configPath = resolve(process.cwd(), option(args, 'config') || DEFAULT_CONFIG_PATH);
  const config = JSON.parse(await readFile(configPath, 'utf8'));
  const rootsOverride = option(args, 'roots') || process.env.ASSET_INDEX_ROOTS;

  return {
    org: process.env.DA_ORG || config.org,
    site: process.env.DA_SITE || config.site,
    roots: parseRoots(rootsOverride || config.roots),
    outputPath: safeOutputPath(option(args, 'output') || config.output),
    extensions: normalizeExtensions(config.extensions),
    minimumFiles: positiveInteger(config.minimumFiles ?? 1, 'minimumFiles', { allowZero: true }),
    maxFiles: positiveInteger(option(args, 'max-files') || config.maxFiles, 'maxFiles'),
    pdfMaxPages: positiveInteger(
      option(args, 'pdf-max-pages') ?? config.pdfMaxPages ?? 0,
      'pdfMaxPages',
      { allowZero: true },
    ),
    contentMaxCharacters: positiveInteger(
      config.contentMaxCharacters || 250000,
      'contentMaxCharacters',
    ),
    concurrency: positiveInteger(config.concurrency || 2, 'concurrency'),
    skipPdfText: hasFlag(args, 'skip-pdf-text'),
    allowPartial: hasFlag(args, 'allow-partial') || config.allowPartial === true,
    apiOrigin: process.env.DA_API_ORIGIN || DEFAULT_API_ORIGIN,
  };
}

function validateConfiguration(config) {
  if (!config.org || !config.site) throw new Error('Both org and site must be configured.');
  if (!process.env.DA_IMS_TOKEN) {
    throw new Error('DA_IMS_TOKEN is required. Store it as a GitHub Actions secret for scheduled runs.');
  }
}

function wait(milliseconds) {
  return new Promise((resolveWait) => {
    setTimeout(resolveWait, milliseconds);
  });
}

function apiUrl(config, kind, path) {
  const normalized = path.replace(/^\/+/, '')
    .split('/')
    .map((segment) => encodeURIComponent(segment))
    .join('/');
  return `${config.apiOrigin}/${kind}/${encodeURIComponent(config.org)}`
    + `/${encodeURIComponent(config.site)}/${normalized}`;
}

async function daFetch(config, kind, path, accept) {
  const url = apiUrl(config, kind, path);

  for (let attempt = 0; attempt < 4; attempt += 1) {
    let response;
    try {
      // eslint-disable-next-line no-await-in-loop
      response = await fetch(url, {
        headers: {
          Accept: accept,
          Authorization: `Bearer ${process.env.DA_IMS_TOKEN}`,
          'User-Agent': 'elevance-da-asset-index/1.0',
        },
        signal: AbortSignal.timeout(30000),
      });
    } catch (error) {
      if (attempt === 3) throw error;
      // eslint-disable-next-line no-await-in-loop
      await wait(2 ** attempt * 500);
    }

    if (response) {
      if ([401, 403].includes(response.status)) {
        throw new Error(
          `DA authorization failed with HTTP ${response.status}. Refresh DA_IMS_TOKEN `
          + `and verify access to ${config.org}/${config.site}.`,
        );
      }
      if (response.ok) return response;
      if (!RETRYABLE_STATUSES.has(response.status) || attempt === 3) {
        throw new Error(`${kind} ${path} failed with HTTP ${response.status}.`);
      }
      // eslint-disable-next-line no-await-in-loop
      await wait(2 ** attempt * 500);
    }
  }

  throw new Error(`${kind} ${path} failed after all retries.`);
}

function relativeDaPath(config, path) {
  const prefix = `/${config.org}/${config.site}`;
  const relativePath = path.startsWith(prefix) ? path.slice(prefix.length) : path;
  return relativePath.startsWith('/') ? relativePath : `/${relativePath}`;
}

async function discoverAssets(config) {
  const queue = [...config.roots];
  const queued = new Set(queue);
  const visited = new Set();
  const assets = new Map();

  while (queue.length) {
    const path = queue.shift();
    queued.delete(path);
    if (!visited.has(path)) {
      visited.add(path);

      // Directory requests remain serial so the crawler is gentle on the DA List API.
      // eslint-disable-next-line no-await-in-loop
      const response = await daFetch(config, 'list', path, 'application/json');
      // eslint-disable-next-line no-await-in-loop
      const items = await response.json();
      if (!Array.isArray(items)) {
        throw new Error(`List response for ${path} was not an array.`);
      }

      items.forEach((item) => {
        const itemPath = relativeDaPath(config, item.path);
        if (!item.ext) {
          if (!visited.has(itemPath) && !queued.has(itemPath)) {
            queue.push(itemPath);
            queued.add(itemPath);
          }
          return;
        }

        const extension = item.ext.toLowerCase();
        if (config.extensions.has(extension)) {
          assets.set(itemPath, { ...item, path: itemPath, ext: extension });
          if (assets.size > config.maxFiles) {
            throw new Error(
              `Discovered more than maxFiles (${config.maxFiles}). `
              + 'Increase the limit rather than publishing a truncated index.',
            );
          }
        }
      });
    }
  }

  return [...assets.values()].sort((left, right) => left.path.localeCompare(right.path));
}

function configurationFingerprint(config) {
  const relevantConfiguration = {
    version: INDEX_FORMAT_VERSION,
    org: config.org,
    site: config.site,
    roots: [...config.roots].sort(),
    extensions: [...config.extensions].sort(),
    pdfMaxPages: config.pdfMaxPages,
    contentMaxCharacters: config.contentMaxCharacters,
    skipPdfText: config.skipPdfText,
  };
  return createHash('sha256')
    .update(JSON.stringify(relevantConfiguration))
    .digest('hex');
}

async function loadReusableRecords(outputPath, fingerprint) {
  try {
    const existing = JSON.parse(await readFile(outputPath, 'utf8'));
    // The underscore distinguishes generator metadata from searchable record fields.
    // eslint-disable-next-line no-underscore-dangle
    if (existing?._meta?.fingerprint !== fingerprint || !Array.isArray(existing.data)) {
      return new Map();
    }
    return new Map(existing.data
      .filter((record) => record?.path)
      .map((record) => [record.path, record]));
  } catch (error) {
    if (error.code !== 'ENOENT') {
      process.stderr.write(`Existing index cannot be reused: ${error.message}\n`);
    }
    return new Map();
  }
}

function cleanText(value = '') {
  return String(value).replace(/\s+/g, ' ').trim();
}

function humanizeFilename(path) {
  return decodeURIComponent(path.split('/').pop() || '')
    .replace(/\.[^.]+$/, '')
    .replace(/[-_]+/g, ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function assetTopic(extension) {
  const isMedia = IMAGE_EXTENSIONS.has(extension)
    || VIDEO_EXTENSIONS.has(extension)
    || AUDIO_EXTENSIONS.has(extension);
  if (isMedia) {
    return 'media';
  }
  return 'documents';
}

function lastModified(value) {
  if (!value) return '';
  const date = new Date(value);
  return Number.isNaN(date.valueOf()) ? String(value) : date.toISOString();
}

async function extractPdf(config, file) {
  if (config.skipPdfText) return { content: '', title: '' };
  const response = await daFetch(config, 'source', file.path, 'application/pdf');
  const bytes = new Uint8Array(await response.arrayBuffer());
  const pdf = await getDocument({ data: bytes, useSystemFonts: true }).promise;

  try {
    const metadata = await pdf.getMetadata().catch(() => ({ info: {} }));
    const pageLimit = config.pdfMaxPages > 0
      ? Math.min(config.pdfMaxPages, pdf.numPages)
      : pdf.numPages;
    const pages = [];

    for (let number = 1; number <= pageLimit; number += 1) {
      // PDF.js page processing remains serial to keep memory usage predictable.
      // eslint-disable-next-line no-await-in-loop
      const page = await pdf.getPage(number);
      // eslint-disable-next-line no-await-in-loop
      const text = await page.getTextContent();
      pages.push(text.items.map((item) => item.str || '').join(' '));
      page.cleanup();
    }

    return {
      content: cleanText(pages.join(' ')).slice(0, config.contentMaxCharacters),
      title: cleanText(metadata.info?.Title || ''),
    };
  } finally {
    await pdf.destroy();
  }
}

async function assetRecord(config, file) {
  const extracted = file.ext === 'pdf'
    ? await extractPdf(config, file)
    : { content: '', title: '' };
  const title = extracted.title || humanizeFilename(file.path);

  return {
    path: file.path,
    title,
    header: title,
    description: extracted.content.slice(0, 240),
    content: extracted.content,
    topic: assetTopic(file.ext),
    type: file.ext,
    lastModified: lastModified(file.lastModified),
  };
}

async function mapConcurrent(items, concurrency, mapper) {
  const results = new Array(items.length);
  let nextIndex = 0;

  async function worker() {
    while (nextIndex < items.length) {
      const index = nextIndex;
      nextIndex += 1;
      // eslint-disable-next-line no-await-in-loop
      results[index] = await mapper(items[index], index);
    }
  }

  const workerCount = Math.min(concurrency, Math.max(items.length, 1));
  await Promise.all(Array.from({ length: workerCount }, () => worker()));
  return results;
}

async function writeIndex(outputPath, records, fingerprint) {
  const index = {
    _meta: {
      fingerprint,
    },
    total: records.length,
    offset: 0,
    limit: records.length,
    data: records,
  };
  const temporaryPath = `${outputPath}.tmp-${process.pid}`;
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(temporaryPath, `${JSON.stringify(index, null, 2)}\n`, 'utf8');
  try {
    await rename(temporaryPath, outputPath);
  } catch (error) {
    await unlink(temporaryPath).catch(() => {});
    throw error;
  }
}

async function main() {
  const args = process.argv.slice(2);
  if (hasFlag(args, 'help')) {
    showHelp();
    return;
  }

  const config = await loadConfiguration(args);
  validateConfiguration(config);
  const assets = await discoverAssets(config);
  if (assets.length < config.minimumFiles) {
    throw new Error(
      `Discovered ${assets.length} assets, fewer than minimumFiles (${config.minimumFiles}). `
      + 'Refusing to replace the existing index.',
    );
  }
  const fingerprint = configurationFingerprint(config);
  const reusableRecords = await loadReusableRecords(config.outputPath, fingerprint);
  const failures = [];

  const candidates = await mapConcurrent(assets, config.concurrency, async (asset) => {
    const assetLastModified = lastModified(asset.lastModified);
    const reusable = reusableRecords.get(asset.path);
    if (assetLastModified
      && reusable?.lastModified === assetLastModified
      && reusable?.type === asset.ext) {
      process.stdout.write(`Reused ${asset.ext.toUpperCase()} ${asset.path}\n`);
      return reusable;
    }

    try {
      const record = await assetRecord(config, asset);
      process.stdout.write(`Indexed ${asset.ext.toUpperCase()} ${asset.path}\n`);
      return record;
    } catch (error) {
      failures.push({ path: asset.path, message: error.message });
      process.stderr.write(`Failed ${asset.path}: ${error.message}\n`);
      if (!config.allowPartial) return null;

      const title = humanizeFilename(asset.path);
      return {
        path: asset.path,
        title,
        header: title,
        description: '',
        content: '',
        topic: assetTopic(asset.ext),
        type: asset.ext,
        lastModified: lastModified(asset.lastModified),
      };
    }
  });

  if (failures.length && !config.allowPartial) {
    const noun = failures.length === 1 ? 'asset' : 'assets';
    throw new Error(`Refusing to replace the index because ${failures.length} ${noun} failed.`);
  }

  const records = candidates
    .filter(Boolean)
    .sort((left, right) => left.path.localeCompare(right.path));
  await writeIndex(config.outputPath, records, fingerprint);
  const output = relative(process.cwd(), config.outputPath);
  process.stdout.write(
    `Generated ${output} with ${records.length} assets from ${config.roots.join(', ')}.\n`,
  );
}

main().catch((error) => {
  process.stderr.write(`${error.stack || error.message}\n`);
  process.exitCode = 1;
});
