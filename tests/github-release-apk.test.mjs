import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { test } from 'node:test';
import { resolveApkRelease, publishReleaseApk } from '../scripts/github-release-apk.mjs';

function fixture(t) {
  const parent = fs.realpathSync(os.tmpdir());
  const directory = fs.mkdtempSync(path.join(parent, 'explorer-release-apk-'));
  t.after(() => {
    assert.equal(path.dirname(fs.realpathSync(directory)), parent);
    fs.rmSync(directory, { recursive: true, force: true });
  });
  const sourceSha = 'a'.repeat(40);
  const certificate = '99b61e211df16690313c089d3f9c3dc2d7a9b92040d79f64b0bf63fbad2dda98';
  const env = {
    GITHUB_REPOSITORY: 'Graphene-Lab/graphene-cloud-explorer-react-native-app', GITHUB_REPOSITORY_ID: '1016678903',
    GITHUB_REF: 'refs/heads/master', GITHUB_EVENT_NAME: 'workflow_dispatch', GITHUB_TOKEN: 'dummy-token',
    GITHUB_SHA: sourceSha, RUNNER_TEMP: directory, ANDROID_HOME: path.join(directory, 'sdk'),
    RELEASE_ACTION: 'release', RELEASE_DESTINATION: 'both', PLAY_APP_SIGNING_SHA256: certificate,
    RELEASE_VERSION_FILE: path.join(directory, 'version.json'),
  };
  fs.writeFileSync(env.RELEASE_VERSION_FILE, JSON.stringify({ name: '1.2.8', code: 32 }));
  const state = { sourceSha, name: '1.2.8', draft: false, assets: [], signature: certificate, package: 'com.graphenelab.cloudexplorer', code: '32', toolStatus: 0, apiFailure: 0 };
  const filename = 'Graphene-Cloud-Explorer-1.2.8.apk';
  const bytes = Buffer.from('test APK bytes');
  fs.mkdirSync(path.join(directory, 'play-release-apk'));
  fs.writeFileSync(path.join(directory, 'play-release-apk', filename), bytes);
  const asset = { id: 56, name: filename, size: bytes.length, state: 'uploaded', digest: `sha256:${createHash('sha256').update(bytes).digest('hex')}` };
  const calls = [];
  const fetchImpl = async (url, options) => {
    assert.equal(options.headers.Authorization, `Bearer ${env.GITHUB_TOKEN}`);
    assert.equal(options.redirect, 'error');
    calls.push({ url, method: options.method || 'GET' });
    const endpoint = url.replace(/^https:\/\/(?:api|uploads)\.github\.com\/repos\/Graphene-Lab\/graphene-cloud-explorer-react-native-app/, '');
    let data;
    if (state.apiFailure) return { ok: false, status: state.apiFailure };
    if (endpoint === '/git/ref/tags/v1.2.8') data = { object: { type: 'tag', sha: 'c'.repeat(40) } };
    else if (endpoint === `/git/tags/${'c'.repeat(40)}`) data = { object: { type: 'commit', sha: state.sourceSha } };
    else if (endpoint === '/releases/tags/v1.2.8') data = { id: 42, tag_name: 'v1.2.8', draft: state.draft };
    else if (endpoint === '/releases/42/assets?per_page=100&page=1') data = state.assets;
    else if (options.method === 'POST' && endpoint === `/releases/42/assets?name=${filename}`) {
      assert.ok(url.startsWith('https://uploads.github.com/'));
      const chunks = [];
      for await (const chunk of options.body) chunks.push(chunk);
      assert.deepEqual(Buffer.concat(chunks), bytes);
      assert.equal(options.headers['Content-Type'], 'application/vnd.android.package-archive');
      data = asset;
      state.assets = [asset];
    } else assert.fail(`Unexpected GitHub request: ${url}`);
    return { ok: true, status: 200, json: async () => data };
  };
  const runs = [];
  const run = (command, args) => {
    runs.push({ command, args });
    const stdout = command === 'java' ? `Signer #1 certificate SHA-256 digest: ${state.signature}\n` :
      `package: name='${state.package}' versionCode='${state.code}' versionName='${state.name}'\n`;
    return { status: state.toolStatus, stdout };
  };
  const record = async () => fs.writeFileSync(path.join(directory, 'play-apk-release.json'), JSON.stringify(await resolveApkRelease({ env, fetchImpl })));
  const f = { env, state, asset, calls, run, runs, fetchImpl, sourceSha, record };
  return f;
}

test('Both uses its validated release version and verifies the matching source tag', async t => {
  const f = fixture(t);
  const result = await resolveApkRelease(f);
  assert.equal(result.sourceSha, f.sourceSha);
  assert.equal(result.sourceSha, f.env.GITHUB_SHA);
  assert.deepEqual(result, { tag: 'v1.2.8', name: '1.2.8', code: 32, sourceSha: f.sourceSha, releaseId: 42 });
  assert.ok(f.calls.every(c => c.method === 'GET'));
});

test('Both requires its version tag to identify the actual workflow commit', async t => {
  const f = fixture(t);
  f.env.GITHUB_SHA = 'b'.repeat(40);
  await assert.rejects(resolveApkRelease(f), /different source/);
  f.env.GITHUB_SHA = f.sourceSha;
  assert.equal((await resolveApkRelease(f)).code, 32);
});

test('a verified APK is streamed to the matching GitHub Release after checking manifest and certificate', async t => {
  const f = fixture(t);
  await f.record();
  assert.deepEqual(await publishReleaseApk(f), f.asset);
  assert.equal(f.runs.length, 2);
  assert.ok(f.runs[0].args.includes('--print-certs'));
  assert.deepEqual(f.runs[1].args.slice(0, 2), ['dump', 'badging']);
  assert.equal(f.calls.filter(c => c.method === 'POST').length, 1);
});

test('wrong APK signatures, package names, versions and invalid APKs never reach an asset upload', async t => {
  for (const values of [{ signature: 'f'.repeat(64) }, { package: 'wrong.app' }, { code: '33' }, { toolStatus: 1 }]) {
    const f = fixture(t);
    await f.record();
    Object.assign(f.state, values);
    await assert.rejects(publishReleaseApk(f), /signature|package\/version|verification/);
    assert.ok(f.calls.every(c => c.method === 'GET'));
  }
});

test('the identical existing APK is safely reused without overwriting it', async t => {
  const f = fixture(t);
  await f.record();
  f.state.assets = [f.asset];
  assert.deepEqual(await publishReleaseApk(f), f.asset);
  assert.ok(f.calls.every(c => c.method === 'GET'));
});

test('different or incomplete existing assets stop instead of replacing public downloads', async t => {
  for (const changes of [{ digest: `sha256:${'0'.repeat(64)}` }, { state: 'starter' }, { size: 0 }]) {
    const f = fixture(t);
    await f.record();
    f.state.assets = [{ ...f.asset, ...changes }];
    await assert.rejects(publishReleaseApk(f), /never overwritten/);
    assert.ok(f.calls.every(c => c.method === 'GET'));
  }
});

test('tag changes during download fail before any APK attachment', async t => {
  const f = fixture(t);
  await f.record();
  f.state.sourceSha = 'd'.repeat(40);
  await assert.rejects(publishReleaseApk(f), /different source/);
  assert.equal(f.runs.length, 0);
  assert.ok(f.calls.every(c => c.method === 'GET'));
});

test('unpublished releases and invalid validated versions are rejected', async t => {
  const unpublished = fixture(t);
  unpublished.state.draft = true;
  await assert.rejects(resolveApkRelease(unpublished), /published GitHub Release/);
  for (const values of [{ name: '../bad', code: 32 }, { name: '1.2.8', code: 0 }, { name: '1.2.8', code: '32' }]) {
    const f = fixture(t);
    fs.writeFileSync(f.env.RELEASE_VERSION_FILE, JSON.stringify(values));
    await assert.rejects(resolveApkRelease(f), /version is invalid/);
    assert.equal(f.calls.length, 0);
  }
});

test('GitHub lookup failures stop without printing credentials', async t => {
  const f = fixture(t);
  f.state.apiFailure = 403;
  await assert.rejects(resolveApkRelease(f), error => /HTTP 403/.test(error.message) && !error.message.includes(f.env.GITHUB_TOKEN));
  assert.equal(f.calls.length, 1);
});

test('other repositories, automatic events, branches, and release destinations cannot attach an APK', async t => {
  for (const values of [
    { GITHUB_REPOSITORY_ID: '999' }, { GITHUB_REPOSITORY: 'someone/else' }, { GITHUB_EVENT_NAME: 'push' },
    { GITHUB_REF: 'refs/tags/v1.2.8' }, { RELEASE_ACTION: 'release', RELEASE_DESTINATION: 'play' },
    { RELEASE_ACTION: 'attach' },
  ]) {
    const f = fixture(t);
    Object.assign(f.env, values);
    await assert.rejects(resolveApkRelease(f), /restricted/);
    assert.equal(f.calls.length, 0);
  }
});
