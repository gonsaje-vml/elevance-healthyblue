import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import {
  mkdtemp,
  readFile,
  rm,
  stat,
  utimes,
  writeFile,
} from 'node:fs/promises';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import test from 'node:test';

const script = resolve('tools/build-da-source-index.mjs');

function createPdf(text) {
  const escapedText = text.replace(/([\\()])/g, '\\$1');
  const stream = `BT\n/F1 12 Tf\n72 720 Td\n(${escapedText}) Tj\nET`;
  const objects = [
    '',
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] '
      + '/Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>',
    `<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
  ];
  const offsets = [0];
  let pdf = '%PDF-1.4\n';

  objects.slice(1).forEach((object, index) => {
    offsets.push(Buffer.byteLength(pdf));
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });

  const xrefOffset = Buffer.byteLength(pdf);
  pdf += `xref\n0 ${objects.length}\n0000000000 65535 f \n`;
  offsets.slice(1).forEach((offset) => {
    pdf += `${String(offset).padStart(10, '0')} 00000 n \n`;
  });
  pdf += `trailer\n<< /Size ${objects.length} /Root 1 0 R >>\n`;
  pdf += `startxref\n${xrefOffset}\n%%EOF\n`;
  return Buffer.from(pdf);
}

function runIndexer(workingDirectory, configPath, apiOrigin, { skipPdfText = false } = {}) {
  return new Promise((resolveRun, rejectRun) => {
    const argumentsList = [script, '--config', configPath];
    if (skipPdfText) argumentsList.push('--skip-pdf-text');
    const child = spawn(process.execPath, argumentsList, {
      cwd: workingDirectory,
      env: {
        ...process.env,
        DA_API_ORIGIN: apiOrigin,
        DA_IMS_TOKEN: 'test-token',
        AEM_PREVIEW_ORIGIN: `${apiOrigin}/preview`,
        AEM_LIVE_ORIGIN: `${apiOrigin}/live`,
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => { stdout += chunk; });
    child.stderr.on('data', (chunk) => { stderr += chunk; });
    child.once('error', rejectRun);
    child.once('close', (code) => resolveRun({ code, stderr, stdout }));
  });
}

test('recursively crawls and deduplicates multiple DA roots', async () => {
  const workspace = await mkdtemp(join(tmpdir(), 'asset-index-test-'));
  let pdfRequests = 0;
  const previewed = new Set(['/docs/forms/logo.png']);
  const published = new Set(['/docs/guide.pdf']);
  const responses = new Map([
    ['/list/test-org/test-site/docs', [
      { path: '/test-org/test-site/docs/forms', name: 'forms' },
      {
        path: '/test-org/test-site/docs/guide.pdf',
        name: 'guide',
        ext: 'pdf',
        lastModified: 1700000000000,
      },
      { path: '/test-org/test-site/docs/ignore.html', name: 'ignore', ext: 'html' },
    ]],
    ['/list/test-org/test-site/docs/forms', [
      {
        path: '/test-org/test-site/docs/forms/logo.png',
        name: 'logo',
        ext: 'png',
        lastModified: 1700000001000,
      },
    ]],
    ['/list/test-org/test-site/media', [
      {
        path: '/test-org/test-site/media/demo.mp4',
        name: 'demo',
        ext: 'mp4',
        lastModified: 1700000002000,
      },
    ]],
    ['/list/test-org/test-site/empty', []],
  ]);
  const server = createServer((request, response) => {
    if (request.method === 'HEAD' && request.url.startsWith('/preview/')) {
      const assetPath = request.url.slice('/preview'.length);
      response.writeHead(previewed.has(assetPath) ? 200 : 404).end();
      return;
    }
    if (request.method === 'HEAD' && request.url.startsWith('/live/')) {
      const assetPath = request.url.slice('/live'.length);
      response.writeHead(published.has(assetPath) ? 200 : 404).end();
      return;
    }
    if (request.url === '/source/test-org/test-site/docs/guide.pdf') {
      pdfRequests += 1;
      response.setHeader('content-type', 'application/pdf');
      response.end(createPdf('Automated PDF content'));
      return;
    }
    const body = responses.get(request.url);
    if (!body) {
      response.writeHead(404).end();
      return;
    }
    response.setHeader('content-type', 'application/json');
    response.end(JSON.stringify(body));
  });

  try {
    server.listen(0, '127.0.0.1');
    await once(server, 'listening');
    const address = server.address();
    const apiOrigin = `http://127.0.0.1:${address.port}`;
    const configPath = join(workspace, 'asset-index.config.json');
    await writeFile(configPath, JSON.stringify({
      org: 'test-org',
      site: 'test-site',
      branch: 'main',
      deliveryEnvironments: ['preview', 'live'],
      roots: ['/docs', '/docs/forms', '/media'],
      output: 'assets.json',
      extensions: ['pdf', 'png', 'mp4'],
      minimumFiles: 1,
      maxFiles: 10,
      pdfMaxPages: 0,
      contentMaxCharacters: 1000,
      concurrency: 2,
      allowPartial: false,
    }));

    const result = await runIndexer(workspace, configPath, apiOrigin);
    assert.equal(result.code, 0, result.stderr);
    const index = JSON.parse(await readFile(join(workspace, 'assets.json'), 'utf8'));
    assert.equal(index.total, 2);
    assert.deepEqual(index.data.map(({ path }) => path), [
      '/docs/forms/logo.png',
      '/docs/guide.pdf',
    ]);
    assert.equal(index.data[0].topic, 'media');
    assert.equal(index.data[1].topic, 'documents');
    assert.equal(index.data[1].lastModified, '2023-11-14T22:13:20.000Z');
    assert.match(index.data[1].content, /Automated PDF content/);

    const indexPath = join(workspace, 'assets.json');
    const oldTimestamp = new Date('2000-01-01T00:00:00.000Z');
    await utimes(indexPath, oldTimestamp, oldTimestamp);
    const modifiedBeforeRepeat = (await stat(indexPath)).mtimeMs;
    const repeated = await runIndexer(workspace, configPath, apiOrigin);
    assert.equal(repeated.code, 0, repeated.stderr);
    assert.match(repeated.stdout, /Reused PDF \/docs\/guide\.pdf/);
    assert.match(repeated.stdout, /assets\.json is unchanged; skipped writing it\./);
    assert.equal(pdfRequests, 1);
    assert.equal((await stat(indexPath)).mtimeMs, modifiedBeforeRepeat);

    published.delete('/docs/guide.pdf');
    const afterUnpublish = await runIndexer(workspace, configPath, apiOrigin);
    assert.equal(afterUnpublish.code, 0, afterUnpublish.stderr);
    assert.match(
      afterUnpublish.stdout,
      /Skipped unpreviewed and unpublished \/docs\/guide\.pdf/,
    );
    const filteredIndex = JSON.parse(await readFile(indexPath, 'utf8'));
    assert.deepEqual(filteredIndex.data.map(({ path }) => path), ['/docs/forms/logo.png']);
    assert.equal(pdfRequests, 1);

    const completeIndex = await readFile(join(workspace, 'assets.json'), 'utf8');
    const emptyConfiguration = JSON.parse(await readFile(configPath, 'utf8'));
    emptyConfiguration.roots = ['/empty'];
    await writeFile(configPath, JSON.stringify(emptyConfiguration));
    const emptyRun = await runIndexer(workspace, configPath, apiOrigin);
    assert.equal(emptyRun.code, 1);
    assert.match(emptyRun.stderr, /fewer than minimumFiles/);
    assert.equal(await readFile(join(workspace, 'assets.json'), 'utf8'), completeIndex);
  } finally {
    server.close();
    await rm(workspace, { recursive: true, force: true });
  }
});
