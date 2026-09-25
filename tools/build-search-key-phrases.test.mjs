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

const script = resolve('tools/build-search-key-phrases.mjs');

function runGenerator(workingDirectory, configPath, origin, environment = 'preview') {
  return new Promise((resolveRun, rejectRun) => {
    const child = spawn(process.execPath, [
      script,
      '--config',
      configPath,
      '--delivery-environment',
      environment,
    ], {
      cwd: workingDirectory,
      env: {
        ...process.env,
        AEM_PREVIEW_ORIGIN: `${origin}/preview`,
        AEM_LIVE_ORIGIN: `${origin}/live`,
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

test('builds a stable, deduplicated phrase catalog from matching indexes', async () => {
  const workspace = await mkdtemp(join(tmpdir(), 'search-key-phrases-test-'));
  const pageIndexes = {
    preview: {
      data: [
        { path: '/north-carolina-provider/home', title: 'Welcome!', header: 'Welcome' },
        { path: '/north-carolina-provider/medical', title: 'Medical Management Model' },
        { path: '/north-carolina-provider/private', title: 'Private page', robots: 'noindex' },
        { path: '/footer', title: 'Long legal footer text' },
      ],
    },
    live: {
      data: [
        { path: '/north-carolina-provider/home', title: 'Published Home' },
      ],
    },
  };
  const server = createServer((request, response) => {
    const environment = request.url.split('/')[1];
    if (!pageIndexes[environment] || !request.url.endsWith('/query-index.json')) {
      response.writeHead(404).end();
      return;
    }
    response.setHeader('content-type', 'application/json');
    response.end(JSON.stringify(pageIndexes[environment]));
  });

  try {
    server.listen(0, '127.0.0.1');
    await once(server, 'listening');
    const address = server.address();
    const origin = `http://127.0.0.1:${address.port}`;
    const configPath = join(workspace, 'asset-index.config.json');
    await writeFile(join(workspace, 'assets-preview.json'), JSON.stringify({
      data: [
        { path: '/docs/guide.pdf', title: 'Provider Guide', header: 'Provider Guide', type: 'pdf' },
        { path: '/docs/other.pdf', title: 'Welcome', type: 'pdf' },
      ],
    }));
    await writeFile(join(workspace, 'assets.json'), JSON.stringify({
      data: [{ path: '/docs/live.pdf', title: 'Published Guide', type: 'pdf' }],
    }));
    await writeFile(configPath, JSON.stringify({
      org: 'test-org',
      site: 'test-site',
      branch: 'main',
      outputs: {
        preview: 'assets-preview.json',
        live: 'assets.json',
      },
      keyPhrases: {
        outputs: {
          preview: 'phrases-preview.json',
          live: 'phrases.json',
        },
        pageIndexPath: '/query-index.json',
        excludePaths: ['/footer'],
        minimumLength: 3,
        maximumLength: 120,
        maximumPhrases: 100,
      },
    }));

    const previewResult = await runGenerator(workspace, configPath, origin);
    assert.equal(previewResult.code, 0, previewResult.stderr);
    const previewPath = join(workspace, 'phrases-preview.json');
    const preview = JSON.parse(await readFile(previewPath, 'utf8'));
    assert.equal(preview._meta.environment, 'preview');
    assert.deepEqual(preview.data, [
      {
        phrase: 'Medical Management Model',
        normalized: 'medical management model',
        sourceCount: 1,
        types: ['page'],
      },
      {
        phrase: 'Provider Guide',
        normalized: 'provider guide',
        sourceCount: 1,
        types: ['pdf'],
      },
      {
        phrase: 'Welcome!',
        normalized: 'welcome',
        sourceCount: 2,
        types: ['page', 'pdf'],
      },
    ]);

    const oldTimestamp = new Date('2000-01-01T00:00:00.000Z');
    await utimes(previewPath, oldTimestamp, oldTimestamp);
    const modifiedBeforeRepeat = (await stat(previewPath)).mtimeMs;
    const repeated = await runGenerator(workspace, configPath, origin);
    assert.equal(repeated.code, 0, repeated.stderr);
    assert.match(repeated.stdout, /phrases-preview\.json is unchanged/);
    assert.equal((await stat(previewPath)).mtimeMs, modifiedBeforeRepeat);

    const liveResult = await runGenerator(workspace, configPath, origin, 'live');
    assert.equal(liveResult.code, 0, liveResult.stderr);
    const live = JSON.parse(await readFile(join(workspace, 'phrases.json'), 'utf8'));
    assert.deepEqual(live.data.map(({ phrase }) => phrase), [
      'Published Guide',
      'Published Home',
    ]);
  } finally {
    server.close();
    await rm(workspace, { recursive: true, force: true });
  }
});
