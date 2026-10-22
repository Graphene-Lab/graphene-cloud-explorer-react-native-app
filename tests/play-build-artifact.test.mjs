import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { resolvePlayBuild } from '../scripts/resolve-play-build.mjs';

function fixture(t, { run: overrides = {}, artifacts } = {}) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'explorer-artifact-test-'));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const sha = 'a'.repeat(40);
  const env = {
    PLAY_BUILD_RUN_ID: '1234', GITHUB_TOKEN: 'dummy-token',
    GITHUB_REPOSITORY: 'Graphene-Lab/explorer', GITHUB_REPOSITORY_ID: '1016678903',
    RUNNER_TEMP: directory, GITHUB_ENV: path.join(directory, 'github-env'),
  };
  const source = {
    'package.json': JSON.stringify({ version: '1.2.7' }),
    'app.json': JSON.stringify({ expo: { version: '1.2.7', android: { package: 'com.graphenelab.cloudexplorer' } } }),
    'android/app/build.gradle': 'versionCode 31',
  };
  const calls = [];
  const fetchImpl = async (url, options) => {
    calls.push(url);
    assert.equal(options.headers.Authorization, `Bearer ${env.GITHUB_TOKEN}`);
    let data;
    if (url.endsWith('/actions/runs/1234')) {
      data = {
        status: 'completed', conclusion: 'success', event: 'workflow_dispatch',
        path: '.github/workflows/android-play.yml', head_sha: sha,
        repository: { id: 1016678903 }, ...overrides,
      };
    } else if (url.endsWith('/artifacts?per_page=100')) {
      data = { artifacts: artifacts || [{ id: 5678, name: `graphene-explorer-${sha}`, expired: false }] };
    } else {
      const filename = new URL(url).pathname.split('/contents/')[1];
      assert.equal(new URL(url).searchParams.get('ref'), sha, 'Source metadata must use the immutable build commit.');
      assert.ok(filename in source, `Unexpected source file: ${filename}`);
      data = { encoding: 'base64', content: Buffer.from(source[filename]).toString('base64') };
    }
    return { ok: true, json: async () => data };
  };
  return { env, fetchImpl, calls, source };
}

test('selects the signed artifact and source versions from the successful build commit', async t => {
  const { env, fetchImpl, source } = fixture(t);
  const result = await resolvePlayBuild({ env, fetchImpl });
  assert.equal(result.artifactId, 5678);
  for (const [filename, content] of Object.entries(source)) {
    assert.equal(fs.readFileSync(path.join(result.source, filename), 'utf8'), content);
  }
  const exported = fs.readFileSync(env.GITHUB_ENV, 'utf8');
  assert.ok(exported.includes('PLAY_AAB_ARTIFACT_ID=5678'));
  assert.ok(!exported.includes(env.GITHUB_TOKEN));
});

test('rejects failed or unfinished builds before looking for artifacts', async t => {
  for (const run of [{ status: 'in_progress', conclusion: null }, { conclusion: 'failure' }]) {
    const { env, fetchImpl, calls } = fixture(t, { run });
    await assert.rejects(resolvePlayBuild({ env, fetchImpl }), /must finish successfully/);
    assert.equal(calls.length, 1);
    assert.ok(!fs.existsSync(env.GITHUB_ENV));
  }
});

test('rejects another repository, workflow, or pull-request event', async t => {
  for (const run of [{ repository: { id: 999 } }, { path: '.github/workflows/other.yml' }, { event: 'pull_request' }]) {
    const { env, fetchImpl } = fixture(t, { run });
    await assert.rejects(resolvePlayBuild({ env, fetchImpl }));
    assert.ok(!fs.existsSync(env.GITHUB_ENV));
  }
});

test('rejects missing, expired, or ambiguous signed artifacts', async t => {
  const name = `graphene-explorer-${'a'.repeat(40)}`;
  for (const artifacts of [[], [{ id: 1, name, expired: true }], [{ id: 1, name }, { id: 2, name }]]) {
    const { env, fetchImpl } = fixture(t, { artifacts });
    await assert.rejects(resolvePlayBuild({ env, fetchImpl }), /exactly one available/);
    assert.ok(!fs.existsSync(env.GITHUB_ENV));
  }
});

test('rejects missing or unsafe run IDs before any network request', async t => {
  for (const runId of ['', '../secrets', '1234; echo unsafe']) {
    const { env, fetchImpl, calls } = fixture(t);
    env.PLAY_BUILD_RUN_ID = runId;
    await assert.rejects(resolvePlayBuild({ env, fetchImpl }));
    assert.equal(calls.length, 0);
  }
});

test('reports API failures without echoing token-bearing response content', async t => {
  const { env } = fixture(t);
  const fetchImpl = async () => ({ ok: false, status: 403 });
  await assert.rejects(resolvePlayBuild({ env, fetchImpl }), error =>
    error.message.includes('HTTP 403') && !error.message.includes(env.GITHUB_TOKEN));
});
