#!/usr/bin/env node

import {
  mkdir,
  readFile,
  rename,
  unlink,
  writeFile,
} from 'node:fs/promises';
import {
  dirname,
  isAbsolute,
  relative,
  resolve,
} from 'node:path';

const DEFAULT_CONFIG_PATH = 'asset-index.config.json';
const DELIVERY_ENVIRONMENTS = new Set(['preview', 'live']);
const RETRYABLE_STATUSES = new Set([429, 500, 502, 503, 504]);
const FORMAT_VERSION = 1;

function option(args, name) {
  const index = args.indexOf(`--${name}`);
  return index >= 0 && args[index + 1] ? args[index + 1] : undefined;
}

function hasFlag(args, name) {
  return args.includes(`--${name}`);
}

function showHelp() {
  process.stdout.write(`Generate an autocomplete phrase catalog from page and asset indexes.

Usage:
  npm run search:phrases:preview
  npm run search:phrases:live

Options:
  --config <file>         Configuration file (default: asset-index.config.json)
  --delivery-environment  Delivery tier: preview or live
  --output <file>         Phrase output override
  --help                  Show this help

Environment:
  AEM_BRANCH              Optional delivery branch override
  AEM_PREVIEW_ORIGIN      Optional preview origin override
  AEM_LIVE_ORIGIN         Optional live origin override
`);
}

function positiveInteger(value, name) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isSafeInteger(parsed) || parsed < 1) {
    throw new Error(`${name} must be a positive integer.`);
  }
  return parsed;
}

function normalizeEnvironment(value) {
  const environment = String(value || '').toLowerCase();
  if (!DELIVERY_ENVIRONMENTS.has(environment)) {
    throw new Error('deliveryEnvironment must be either preview or live.');
  }
  return environment;
}

function safePath(value, label) {
  const path = String(value || '').trim();
  if (!path) throw new Error(`${label} cannot be empty.`);
  const absolute = resolve(process.cwd(), path);
  const fromWorkingDirectory = relative(process.cwd(), absolute);
  if (isAbsolute(fromWorkingDirectory) || fromWorkingDirectory.startsWith('..')) {
    throw new Error(`${label} must stay inside the working directory.`);
  }
  return absolute;
}

function normalizeIndexPath(value) {
  const path = String(value || '/query-index.json').trim();
  if (!path.startsWith('/') || path.includes('..')) {
    throw new Error('keyPhrases.pageIndexPath must be a root-relative path.');
  }
  return path;
}

function deliveryOrigin(config, environment) {
  const environmentVariable = environment === 'preview'
    ? process.env.AEM_PREVIEW_ORIGIN
    : process.env.AEM_LIVE_ORIGIN;
  return environmentVariable
    || `https://${config.branch}--${config.site}--${config.org}.aem.${environment === 'preview' ? 'page' : 'live'}`;
}

async function loadConfiguration(args) {
  const configPath = resolve(process.cwd(), option(args, 'config') || DEFAULT_CONFIG_PATH);
  const config = JSON.parse(await readFile(configPath, 'utf8'));
  const environment = normalizeEnvironment(
    option(args, 'delivery-environment') || config.deliveryEnvironment || 'live',
  );
  const phraseConfig = config.keyPhrases || {};

  return {
    org: config.org,
    site: config.site,
    branch: process.env.AEM_BRANCH || config.branch || 'main',
    environment,
    assetIndexPath: safePath(
      config.outputs?.[environment] || config.output,
      'Asset index path',
    ),
    outputPath: safePath(
      option(args, 'output') || phraseConfig.outputs?.[environment],
      'Key phrase output',
    ),
    pageIndexPath: normalizeIndexPath(phraseConfig.pageIndexPath),
    excludePaths: new Set((phraseConfig.excludePaths || []).map(String)),
    minimumLength: positiveInteger(phraseConfig.minimumLength || 3, 'keyPhrases.minimumLength'),
    maximumLength: positiveInteger(phraseConfig.maximumLength || 120, 'keyPhrases.maximumLength'),
    maximumPhrases: positiveInteger(phraseConfig.maximumPhrases || 5000, 'keyPhrases.maximumPhrases'),
  };
}

function validateConfiguration(config) {
  if (!config.org || !config.site) throw new Error('Both org and site must be configured.');
  [config.org, config.site, config.branch].forEach((value) => {
    if (!/^[a-z0-9][a-z0-9-]*$/i.test(value)) {
      throw new Error(`Invalid AEM URL identifier: ${value}`);
    }
  });
  if (config.maximumLength < config.minimumLength) {
    throw new Error('keyPhrases.maximumLength cannot be less than minimumLength.');
  }
}

function wait(milliseconds) {
  return new Promise((resolveWait) => {
    setTimeout(resolveWait, milliseconds);
  });
}

async function fetchJson(url) {
  for (let attempt = 0; attempt < 4; attempt += 1) {
    let response;
    try {
      // eslint-disable-next-line no-await-in-loop
      response = await fetch(url, {
        headers: {
          Accept: 'application/json',
          'User-Agent': 'elevance-search-key-phrases/1.0',
        },
        signal: AbortSignal.timeout(30000),
      });
    } catch (error) {
      if (attempt === 3) throw error;
      // eslint-disable-next-line no-await-in-loop
      await wait(2 ** attempt * 500);
    }

    if (response) {
      if (response.ok) return response.json();
      if (!RETRYABLE_STATUSES.has(response.status) || attempt === 3) {
        throw new Error(`Page index request failed with HTTP ${response.status}: ${url}`);
      }
      // eslint-disable-next-line no-await-in-loop
      await wait(2 ** attempt * 500);
    }
  }

  throw new Error(`Page index request failed after all retries: ${url}`);
}

function recordsFromIndex(index, label) {
  const records = Array.isArray(index) ? index : index?.data;
  if (!Array.isArray(records)) throw new Error(`${label} did not contain a data array.`);
  return records;
}

function displayPhrase(value = '') {
  return String(value).normalize('NFC').replace(/\s+/g, ' ').trim();
}

function normalizePhrase(value = '') {
  return displayPhrase(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

function recordType(record) {
  if (record.type) return String(record.type).toLowerCase();
  return String(record.path || '').toLowerCase().endsWith('.pdf') ? 'pdf' : 'page';
}

function phraseCatalog(config, pageRecords, assetRecords) {
  const phrases = new Map();

  [...pageRecords, ...assetRecords].forEach((record) => {
    if (!record?.path
      || config.excludePaths.has(record.path)
      || normalizePhrase(record.robots).includes('noindex')) return;

    const candidates = new Map();
    [record.title, record.header].forEach((value) => {
      const phrase = displayPhrase(value);
      const normalized = normalizePhrase(phrase);
      if (normalized && !candidates.has(normalized)) candidates.set(normalized, phrase);
    });

    candidates.forEach((phrase, normalized) => {
      if (phrase.length < config.minimumLength || phrase.length > config.maximumLength) return;
      const existing = phrases.get(normalized) || {
        phrase,
        normalized,
        sourceCount: 0,
        types: new Set(),
      };
      existing.sourceCount += 1;
      existing.types.add(recordType(record));
      phrases.set(normalized, existing);
    });
  });

  if (phrases.size > config.maximumPhrases) {
    throw new Error(
      `Generated ${phrases.size} phrases, above maximumPhrases (${config.maximumPhrases}).`,
    );
  }

  return [...phrases.values()]
    .sort((left, right) => left.normalized.localeCompare(right.normalized))
    .map((phrase) => ({
      phrase: phrase.phrase,
      normalized: phrase.normalized,
      sourceCount: phrase.sourceCount,
      types: [...phrase.types].sort(),
    }));
}

async function readExisting(path) {
  try {
    return await readFile(path, 'utf8');
  } catch (error) {
    if (error.code === 'ENOENT') return '';
    throw error;
  }
}

async function writeCatalog(config, phrases, existingContent) {
  const output = {
    _meta: {
      version: FORMAT_VERSION,
      environment: config.environment,
      sources: [
        config.pageIndexPath,
        `/${relative(process.cwd(), config.assetIndexPath)}`,
      ],
    },
    total: phrases.length,
    data: phrases,
  };
  const content = `${JSON.stringify(output, null, 2)}\n`;
  if (content === existingContent) return false;

  const temporaryPath = `${config.outputPath}.tmp-${process.pid}`;
  await mkdir(dirname(config.outputPath), { recursive: true });
  await writeFile(temporaryPath, content, 'utf8');
  try {
    await rename(temporaryPath, config.outputPath);
  } catch (error) {
    await unlink(temporaryPath).catch(() => {});
    throw error;
  }
  return true;
}

async function main() {
  const args = process.argv.slice(2);
  if (hasFlag(args, 'help')) {
    showHelp();
    return;
  }

  const config = await loadConfiguration(args);
  validateConfiguration(config);
  const pageIndexUrl = `${deliveryOrigin(config, config.environment).replace(/\/$/, '')}`
    + config.pageIndexPath;
  const [pageIndex, assetIndex, existingContent] = await Promise.all([
    fetchJson(pageIndexUrl),
    readFile(config.assetIndexPath, 'utf8').then((content) => JSON.parse(content)),
    readExisting(config.outputPath),
  ]);
  const pageRecords = recordsFromIndex(pageIndex, 'Page index');
  const assetRecords = recordsFromIndex(assetIndex, 'Asset index');
  const phrases = phraseCatalog(config, pageRecords, assetRecords);
  const wroteCatalog = await writeCatalog(config, phrases, existingContent);
  const output = relative(process.cwd(), config.outputPath);

  if (wroteCatalog) {
    process.stdout.write(
      `Generated ${output} with ${phrases.length} ${config.environment} search phrases.\n`,
    );
  } else {
    process.stdout.write(`${output} is unchanged; skipped writing it.\n`);
  }
}

main().catch((error) => {
  process.stderr.write(`${error.stack || error.message}\n`);
  process.exitCode = 1;
});
