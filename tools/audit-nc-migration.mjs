#!/usr/bin/env node

import { readFile, writeFile } from 'node:fs/promises';

const SOURCE_ORIGIN = 'https://provider.healthybluenc.com';
const PREVIEW_ORIGIN = 'https://main--elevance-nc--adobedrago.aem.page';
const DEFAULT_URL_LIST = '/private/tmp/elevance-adobedrago-review/tools/importer/urls-nc-provider-interior.txt';

const decodeEntities = (value = '') => value
  .replace(/&nbsp;|&#160;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&quot;/gi, '"')
  .replace(/&#39;|&apos;/gi, "'")
  .replace(/&lt;/gi, '<')
  .replace(/&gt;/gi, '>')
  .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
  .replace(/&#x([\da-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)));

const normalizeText = (value = '') => decodeEntities(value)
  .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
  .replace(/<noscript\b[^>]*>[\s\S]*?<\/noscript>/gi, ' ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/\s+/g, ' ')
  .trim();

const normalizeKey = (value = '') => normalizeText(value)
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, ' ')
  .replace(/\s+/g, ' ')
  .trim();

const extractMain = (html) => {
  const match = html.match(/<main\b[^>]*>([\s\S]*?)<\/main>/i);
  return match ? match[1] : html;
};

const extractTagText = (html, tag) => [...html.matchAll(new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'gi'))]
  .map((match) => normalizeText(match[1]))
  .filter(Boolean);

const extractAttribute = (tag, name) => {
  const match = tag.match(new RegExp(`\\s${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, 'i'));
  return match ? decodeEntities(match[1] ?? match[2] ?? match[3] ?? '') : null;
};

const extractLinks = (html, baseUrl) => [...html.matchAll(/<a\b[^>]*href\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))[^>]*>([\s\S]*?)<\/a>/gi)]
  .map((match) => {
    const href = decodeEntities(match[1] ?? match[2] ?? match[3] ?? '').trim();
    let absolute = href;
    try { absolute = new URL(href, baseUrl).href; } catch { /* keep authored href */ }
    return { href, absolute, text: normalizeText(match[4]) };
  })
  .filter(({ href }) => href && !href.startsWith('#') && !/^javascript:/i.test(href));

const extractMeta = (html, name) => {
  const tags = html.match(/<meta\b[^>]*>/gi) || [];
  const tag = tags.find((candidate) => {
    const metaName = extractAttribute(candidate, 'name') || extractAttribute(candidate, 'property');
    return metaName?.toLowerCase() === name.toLowerCase();
  });
  return tag ? extractAttribute(tag, 'content') || '' : '';
};

const extractCanonical = (html) => {
  const tags = html.match(/<link\b[^>]*>/gi) || [];
  const tag = tags.find((candidate) => extractAttribute(candidate, 'rel')?.toLowerCase().split(/\s+/).includes('canonical'));
  return tag ? extractAttribute(tag, 'href') || '' : '';
};

const tokenize = (text) => normalizeKey(text).split(' ').filter((word) => word.length > 2);

const cosineSimilarity = (left, right) => {
  const leftCounts = new Map();
  const rightCounts = new Map();
  tokenize(left).forEach((word) => leftCounts.set(word, (leftCounts.get(word) || 0) + 1));
  tokenize(right).forEach((word) => rightCounts.set(word, (rightCounts.get(word) || 0) + 1));
  const words = new Set([...leftCounts.keys(), ...rightCounts.keys()]);
  let dot = 0;
  let leftMagnitude = 0;
  let rightMagnitude = 0;
  words.forEach((word) => {
    const l = leftCounts.get(word) || 0;
    const r = rightCounts.get(word) || 0;
    dot += l * r;
    leftMagnitude += l * l;
    rightMagnitude += r * r;
  });
  return leftMagnitude && rightMagnitude ? dot / Math.sqrt(leftMagnitude * rightMagnitude) : 0;
};

const coverage = (sourceValues, previewValues) => {
  const source = new Set(sourceValues.map(normalizeKey).filter(Boolean));
  const preview = new Set(previewValues.map(normalizeKey).filter(Boolean));
  if (!source.size) return 1;
  let found = 0;
  source.forEach((value) => { if (preview.has(value)) found += 1; });
  return found / source.size;
};

const headingJumpCount = (html) => {
  const levels = [...html.matchAll(/<h([1-6])\b[^>]*>/gi)].map((match) => Number(match[1]));
  return levels.slice(1).filter((level, index) => level - levels[index] > 1).length;
};

const summarize = (html, url, status) => {
  const main = extractMain(html);
  const title = extractTagText(html, 'title')[0] || '';
  const headings = [1, 2, 3, 4, 5, 6].flatMap((level) => extractTagText(main, `h${level}`));
  const h1s = extractTagText(main, 'h1');
  const mainText = normalizeText(main);
  const links = extractLinks(main, url);
  const images = main.match(/<img\b[^>]*>/gi) || [];
  const controls = main.match(/<(?:input|select|textarea|button)\b[^>]*>/gi) || [];
  return {
    status,
    title,
    description: extractMeta(html, 'description'),
    canonical: extractCanonical(html),
    lang: extractAttribute(html.match(/<html\b[^>]*>/i)?.[0] || '', 'lang') || '',
    h1s,
    headings,
    headingJumps: headingJumpCount(main),
    mainText,
    wordCount: tokenize(mainText).length,
    links,
    imageCount: images.length,
    missingAltCount: images.filter((tag) => extractAttribute(tag, 'alt') === null).length,
    emptyAltCount: images.filter((tag) => extractAttribute(tag, 'alt') === '').length,
    controlCount: controls.length,
    tableCount: (main.match(/<table\b/gi) || []).length,
  };
};

async function fetchPage(url) {
  try {
    const response = await fetch(url, {
      redirect: 'follow',
      headers: { 'user-agent': 'Mozilla/5.0 (compatible; migration-gap-audit/1.0)' },
      signal: AbortSignal.timeout(30000),
    });
    return {
      status: response.status,
      url: response.url,
      html: await response.text(),
    };
  } catch (error) {
    return {
      status: 0,
      url,
      html: '',
      error: error.message,
    };
  }
}

async function mapLimit(items, limit, callback) {
  const results = new Array(items.length);
  let index = 0;
  async function worker() {
    while (index < items.length) {
      const current = index;
      index += 1;
      // Each worker intentionally processes its assigned queue serially.
      // eslint-disable-next-line no-await-in-loop
      results[current] = await callback(items[current], current);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

const urlListPath = process.argv[2] || DEFAULT_URL_LIST;
const urlFile = await readFile(urlListPath, 'utf8');
const sourceUrls = urlFile.split(/\r?\n/).map((url) => url.trim()).filter(Boolean);
if (!sourceUrls.some((url) => url.endsWith('/home'))) {
  sourceUrls.push(`${SOURCE_ORIGIN}/north-carolina-provider/home`);
}

const pageResults = await mapLimit(sourceUrls, 6, async (sourceUrl) => {
  const path = new URL(sourceUrl).pathname;
  const previewUrl = `${PREVIEW_ORIGIN}${path}`;
  const [sourceResponse, previewResponse] = await Promise.all([
    fetchPage(sourceUrl),
    fetchPage(previewUrl),
  ]);
  const source = summarize(sourceResponse.html, sourceResponse.url, sourceResponse.status);
  const preview = summarize(previewResponse.html, previewResponse.url, previewResponse.status);
  const sourceLinkTexts = source.links.map(({ text }) => text).filter(Boolean);
  const previewLinkTexts = preview.links.map(({ text }) => text).filter(Boolean);
  const previewDocLinks = preview.links.filter(({ absolute }) => {
    try {
      const parsed = new URL(absolute);
      return parsed.origin === PREVIEW_ORIGIN && parsed.pathname.startsWith('/docs/');
    } catch { return false; }
  });
  return {
    slug: path.replace('/north-carolina-provider/', '') || 'index',
    path,
    sourceUrl,
    previewUrl,
    source,
    preview,
    metrics: {
      textSimilarity: cosineSimilarity(source.mainText, preview.mainText),
      wordCountRatio: source.wordCount ? preview.wordCount / source.wordCount : 0,
      headingCoverage: coverage(source.headings, preview.headings),
      linkTextCoverage: coverage(sourceLinkTexts, previewLinkTexts),
    },
    previewDocLinks,
  };
});

const uniquePreviewLinks = [...new Set(pageResults.flatMap(({ preview }) => preview.links
  .map(({ absolute }) => absolute)
  .filter((href) => {
    try {
      const parsed = new URL(href);
      return parsed.origin === PREVIEW_ORIGIN
        && (parsed.pathname.startsWith('/docs/') || parsed.pathname.startsWith('/north-carolina-provider/'));
    } catch { return false; }
  })))]
  .sort();

const linkChecks = await mapLimit(uniquePreviewLinks, 8, async (url) => {
  const response = await fetchPage(url);
  return { url, status: response.status, finalUrl: response.url };
});
const linkStatus = new Map(linkChecks.map((entry) => [entry.url, entry.status]));

pageResults.forEach((result) => {
  result.brokenInternalLinks = [...new Set(result.preview.links
    .map(({ absolute }) => absolute)
    .filter((href) => linkStatus.has(href) && linkStatus.get(href) >= 400))];
});

const output = {
  generatedAt: new Date().toISOString(),
  sourceOrigin: SOURCE_ORIGIN,
  previewOrigin: PREVIEW_ORIGIN,
  pages: pageResults,
  linkChecks,
};

let serialized;
if (process.argv.includes('--summary')) {
  const summary = {
    generatedAt: output.generatedAt,
    sourceOrigin: SOURCE_ORIGIN,
    previewOrigin: PREVIEW_ORIGIN,
    uniqueInternalLinksChecked: linkChecks.length,
    brokenInternalLinks: linkChecks.filter(({ status }) => status >= 400 || status === 0),
    pages: pageResults.map(({
      slug,
      path,
      source,
      preview,
      metrics,
      brokenInternalLinks,
    }) => ({
      slug,
      path,
      sourceStatus: source.status,
      previewStatus: preview.status,
      sourceTitle: source.title,
      previewTitle: preview.title,
      sourceDescription: Boolean(source.description),
      previewDescription: Boolean(preview.description),
      sourceCanonical: source.canonical,
      previewCanonical: preview.canonical,
      sourceLang: source.lang,
      previewLang: preview.lang,
      sourceH1s: source.h1s,
      previewH1s: preview.h1s,
      previewHeadingJumps: preview.headingJumps,
      sourceWords: source.wordCount,
      previewWords: preview.wordCount,
      sourceImages: source.imageCount,
      previewImages: preview.imageCount,
      previewMissingAlt: preview.missingAltCount,
      previewEmptyAlt: preview.emptyAltCount,
      sourceControls: source.controlCount,
      previewControls: preview.controlCount,
      sourceTables: source.tableCount,
      previewTables: preview.tableCount,
      textSimilarity: Number(metrics.textSimilarity.toFixed(3)),
      wordCountRatio: Number(metrics.wordCountRatio.toFixed(3)),
      headingCoverage: Number(metrics.headingCoverage.toFixed(3)),
      linkTextCoverage: Number(metrics.linkTextCoverage.toFixed(3)),
      brokenInternalLinks,
    })),
  };
  serialized = `${JSON.stringify(summary, null, 2)}\n`;
} else {
  serialized = `${JSON.stringify(output, null, 2)}\n`;
}

const outputFlag = process.argv.indexOf('--output');
if (outputFlag >= 0 && process.argv[outputFlag + 1]) {
  await writeFile(process.argv[outputFlag + 1], serialized, 'utf8');
  process.stdout.write(`Wrote ${process.argv[outputFlag + 1]}\n`);
} else {
  process.stdout.write(serialized);
}
