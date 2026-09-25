#!/usr/bin/env node

import { writeFile } from 'node:fs/promises';

const args = process.argv.slice(2);

function option(name, fallback) {
  const index = args.indexOf(`--${name}`);
  return index >= 0 && args[index + 1] ? args[index + 1] : fallback;
}

const baseUrl = new URL(option('base', 'http://localhost:3000'));
const scope = option('scope', '/north-carolina-provider/');
const seed = option('seed', '/');
const output = option('output', 'query-index.local.json');
const maxPages = Number.parseInt(option('max-pages', '100'), 10);

function decodeEntities(value = '') {
  return value
    .replace(/&nbsp;|&#160;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([\da-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)));
}

function textContent(value = '') {
  return decodeEntities(value)
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<noscript\b[^>]*>[\s\S]*?<\/noscript>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function elementContent(html, selector) {
  const expression = new RegExp(`<${selector}\\b[^>]*>([\\s\\S]*?)<\\/${selector}>`, 'i');
  return html.match(expression)?.[1] || '';
}

function attribute(tag, name) {
  const expression = new RegExp(`\\s${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, 'i');
  const match = tag.match(expression);
  return match ? decodeEntities(match[1] ?? match[2] ?? match[3] ?? '') : '';
}

function metaContent(html, name) {
  const tags = html.match(/<meta\b[^>]*>/gi) || [];
  const tag = tags.find((candidate) => {
    const key = attribute(candidate, 'name') || attribute(candidate, 'property');
    return key.toLowerCase() === name.toLowerCase();
  });
  return tag ? attribute(tag, 'content') : '';
}

function links(html, pageUrl) {
  const matches = html.matchAll(/<a\b[^>]*href\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/gi);
  return [...matches].flatMap((match) => {
    const href = decodeEntities(match[1] ?? match[2] ?? match[3] ?? '').trim();
    if (!href || href.startsWith('#') || /^(?:mailto|tel|javascript):/i.test(href)) return [];
    try {
      const url = new URL(href, pageUrl);
      url.hash = '';
      url.search = '';
      return [url];
    } catch {
      return [];
    }
  });
}

function isIndexablePage(url) {
  if (url.origin !== baseUrl.origin || !url.pathname.startsWith(scope)) return false;
  if (url.pathname === `${scope}search`) return false;
  const finalSegment = url.pathname.split('/').pop();
  return !finalSegment?.includes('.') || finalSegment.endsWith('.html');
}

function pageRecord(html, url, headers) {
  const main = elementContent(html, 'main');
  const title = textContent(elementContent(html, 'title'));
  const header = textContent(elementContent(main, 'h1'));
  return {
    path: url.pathname.replace(/\.html$/, ''),
    title: metaContent(html, 'og:title') || title || header || url.pathname.split('/').pop(),
    header,
    description: metaContent(html, 'description'),
    content: textContent(main).slice(0, 50000),
    topic: metaContent(html, 'search-topic'),
    type: metaContent(html, 'search-type') || 'page',
    robots: metaContent(html, 'robots'),
    lastModified: headers.get('last-modified') || '',
  };
}

async function fetchPage(path) {
  const url = new URL(path, baseUrl);
  const response = await fetch(url, {
    headers: { 'user-agent': 'elevance-local-search-index/1.0' },
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) {
    process.stderr.write(`Skipping ${url.pathname}: HTTP ${response.status}\n`);
    return null;
  }
  const html = await response.text();
  return {
    html,
    record: pageRecord(html, url, response.headers),
    url,
  };
}

const queue = [new URL(seed, baseUrl).pathname];
const queued = new Set(queue);
const visited = new Set();
const records = [];

while (queue.length && records.length < maxPages) {
  const path = queue.shift();
  if (!visited.has(path)) {
    visited.add(path);

    try {
      // The local crawler is intentionally serial to avoid overwhelming the dev proxy.
      // eslint-disable-next-line no-await-in-loop
      const page = await fetchPage(path);
      if (page) {
        records.push(page.record);
        links(page.html, page.url)
          .filter(isIndexablePage)
          .map((url) => url.pathname.replace(/\.html$/, ''))
          .filter((nextPath) => !visited.has(nextPath) && !queued.has(nextPath))
          .forEach((nextPath) => {
            queued.add(nextPath);
            queue.push(nextPath);
          });
      }
    } catch (error) {
      process.stderr.write(`Skipping ${path}: ${error.message}\n`);
    }
  }
}

if (!records.length) {
  throw new Error(`No pages were indexed from ${new URL(seed, baseUrl).href}. Is the local AEM server running?`);
}

records.sort((left, right) => left.path.localeCompare(right.path));
const index = {
  total: records.length,
  offset: 0,
  limit: records.length,
  data: records,
};

await writeFile(output, `${JSON.stringify(index, null, 2)}\n`, 'utf8');
process.stdout.write(`Indexed ${records.length} page${records.length === 1 ? '' : 's'} into ${output}.\n`);
