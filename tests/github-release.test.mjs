import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { prepareGithubRelease } from '../scripts/prepare-github-release.mjs';

function fixture(t, options = {}) {
  const tempRoot = fs.realpathSync(os.tmpdir());
  const directory = fs.mkdtempSync(path.join(tempRoot, 'explorer-github-release-'));
  t.after(() => {
    assert.equal(path.dirname(fs.realpathSync(directory)), tempRoot);
    fs.rmSync(directory, { recursive: true, force: true });
  });
  const sha = 'a'.repeat(40);
  const tagSha = 'b'.repeat(40);
  const tag = 'v1.2.8';
  const versionFile = path.join(directory, 'version.json');
  const githubNotes = '## Changes\n\nDetailed GitHub fixes and links.';
  fs.writeFileSync(versionFile, JSON.stringify({ name: '1.2.8', code: 32, github_notes: githubNotes }));
  const env = {
    GITHUB_REPOSITORY: 'Graphene-Lab/graphene-cloud-explorer-react-native-app',
    GITHUB_REPOSITORY_ID: '1016678903', GITHUB_REF: 'refs/heads/master', GITHUB_EVENT_NAME: 'workflow_dispatch',
    GITHUB_SHA: sha, GITHUB_TOKEN: 'dummy-token', RELEASE_VERSION_FILE: versionFile, RELEASE_DESTINATION: 'both',
  };
  const state = {
    ref: options.ref || null, target: options.target || sha, release: options.release || null,
    failure: options.failure || null, race: options.race || null, responseDraft: options.responseDraft || false,
  };
  const calls = [];
  const response = (status, data = {}) => ({ status, ok: status >= 200 && status < 300, json: async () => data });
  const fetchImpl = async (url, request) => {
    assert.equal(request.headers.Authorization, `Bearer ${env.GITHUB_TOKEN}`);
    const prefix = `https://api.github.com/repos/${env.GITHUB_REPOSITORY}`;
    assert.ok(url.startsWith(prefix));
    const endpoint = url.slice(prefix.length);
    const body = request.body ? JSON.parse(request.body) : undefined;
    const key = `${request.method} ${endpoint}`;
    calls.push({ method: request.method, endpoint, body });
    if (state.failure === key) { state.failure = null; return response(403, { message: env.GITHUB_TOKEN }); }
    if (key === `GET /git/ref/tags/${tag}`) return state.ref ? response(200, { object: state.ref }) : response(404);
    if (key === `GET /git/tags/${tagSha}`) return response(200, { object: { type: 'commit', sha: state.target } });
    if (key === 'POST /git/tags') {
      assert.equal(body.object, sha);
      assert.equal(body.type, 'commit');
      assert.equal(body.tag, tag);
      assert.match(body.message, /versionCode 32/);
      return response(201, { sha: tagSha });
    }
    if (key === 'POST /git/refs') {
      assert.deepEqual(body, { ref: `refs/tags/${tag}`, sha: tagSha });
      state.ref = state.race || { type: 'tag', sha: tagSha };
      return response(state.race ? 422 : 201, { object: state.ref });
    }
    if (key === `GET /releases/tags/${tag}`) return state.release ? response(200, state.release) : response(404);
    if (key === 'POST /releases') {
      assert.equal(body.target_commitish, sha);
      assert.equal(body.generate_release_notes, true);
      assert.equal(body.body, githubNotes);
      assert.equal(body.draft, false);
      state.release = { id: 42, tag_name: tag, draft: state.responseDraft, body: body.body, html_url: `https://github.com/${env.GITHUB_REPOSITORY}/releases/tag/${tag}` };
      return response(201, state.release);
    }
    if (key === 'PATCH /releases/42') {
      state.release = { ...state.release, ...body };
      return response(200, state.release);
    }
    assert.fail(`Unexpected GitHub API request: ${key}`);
  };
  return { env, fetchImpl, calls, state, sha, tagSha, tag, githubNotes };
}

test('GitHub and Both publish the prepared Markdown notes with the generated changelog', async t => {
  for (const destination of ['github', 'both']) {
    const f = fixture(t);
    f.env.RELEASE_DESTINATION = destination;
    const result = await prepareGithubRelease(f);
    assert.equal(result.tag, f.tag);
    assert.equal(result.sourceSha, f.sha);
    assert.ok(result.releaseUrl.endsWith('/v1.2.8'));
    assert.deepEqual(f.calls.filter(c => c.method === 'POST').map(c => c.endpoint), ['/git/tags', '/git/refs', '/releases']);
  }
});

test('Play-only records the same version tag without creating or editing a GitHub Release', async t => {
  const f = fixture(t);
  f.env.RELEASE_DESTINATION = 'play';
  fs.writeFileSync(f.env.RELEASE_VERSION_FILE, JSON.stringify({ name: '1.2.8', code: 32 }));
  const result = await prepareGithubRelease(f);
  assert.equal(result.releaseUrl, null);
  assert.ok(f.calls.every(c => !c.endpoint.startsWith('/releases')));
});

test('reusing a matching lightweight tag and published release performs no writes', async t => {
  const f = fixture(t, { ref: { type: 'commit', sha: 'a'.repeat(40) }, release: { tag_name: 'v1.2.8', draft: false, body: 'Published notes' } });
  await prepareGithubRelease(f);
  assert.ok(f.calls.every(c => c.method === 'GET'));
});

test('reusing a matching annotated tag preserves the original reference', async t => {
  const f = fixture(t, { ref: { type: 'tag', sha: 'b'.repeat(40) }, release: { tag_name: 'v1.2.8', draft: false, body: 'Published notes' } });
  await prepareGithubRelease(f);
  assert.ok(f.calls.some(c => c.endpoint === `/git/tags/${f.tagSha}`));
  assert.ok(f.calls.every(c => c.method === 'GET'));
});

test('a version tag pointing at different source is never moved or published', async t => {
  const f = fixture(t, { ref: { type: 'commit', sha: 'c'.repeat(40) } });
  await assert.rejects(prepareGithubRelease(f), /another commit/);
  assert.ok(f.calls.every(c => c.method === 'GET'));
});

test('an existing matching draft is published without replacing its notes', async t => {
  const f = fixture(t, {
    ref: { type: 'commit', sha: 'a'.repeat(40) },
    release: { id: 42, tag_name: 'v1.2.8', draft: true, body: 'Hand-written notes', name: 'Custom title' },
  });
  await prepareGithubRelease(f);
  assert.equal(f.state.release.body, 'Hand-written notes');
  assert.equal(f.state.release.name, 'Custom title');
  assert.deepEqual(f.calls.find(c => c.method === 'PATCH').body, { draft: false });
  assert.deepEqual(f.calls.filter(c => c.method !== 'GET').map(c => c.method), ['PATCH']);
});

test('blank matching draft or published release notes are filled without changing the title', async t => {
  for (const draft of [true, false]) {
    const f = fixture(t, { ref: { type: 'commit', sha: 'a'.repeat(40) }, release: { id: 42, tag_name: 'v1.2.8', draft, body: ' ', name: 'Custom title' } });
    await prepareGithubRelease(f);
    assert.equal(f.state.release.body, f.githubNotes);
    assert.equal(f.state.release.name, 'Custom title');
    assert.equal(f.state.release.draft, false);
    assert.equal(f.calls.filter(c => c.method !== 'GET').length, 1);
  }
});

test('missing, empty, or unfinished GitHub notes fail before any tag or release API request', async t => {
  for (const notes of [undefined, '', '  ', '<!-- empty -->', '<!-- RELEASE_NOTES_TODO -->']) {
    const f = fixture(t);
    fs.writeFileSync(f.env.RELEASE_VERSION_FILE, JSON.stringify({ name: '1.2.8', code: 32, github_notes: notes }));
    await assert.rejects(prepareGithubRelease(f), /Fill in the GitHub release notes/);
    assert.equal(f.calls.length, 0);
  }
});

test('API access failure stops before writes and does not echo credentials', async t => {
  const f = fixture(t, { failure: 'GET /git/ref/tags/v1.2.8' });
  await assert.rejects(prepareGithubRelease(f), error => /HTTP 403/.test(error.message) && !error.message.includes(f.env.GITHUB_TOKEN));
  assert.equal(f.calls.length, 1);
});

test('failed release publication can be retried with the original tag and source', async t => {
  const f = fixture(t, { failure: 'POST /releases' });
  await assert.rejects(prepareGithubRelease(f), /HTTP 403/);
  assert.equal(f.state.release, null);
  await prepareGithubRelease(f);
  assert.equal(f.calls.filter(c => c.endpoint === '/git/tags' && c.method === 'POST').length, 1);
  assert.equal(f.state.release.draft, false);
});

test('a concurrent tag creator is accepted only when it selected the same commit', async t => {
  for (const sha of ['a'.repeat(40), 'c'.repeat(40)]) {
    const f = fixture(t, { race: { type: 'commit', sha } });
    if (sha === f.sha) await prepareGithubRelease(f);
    else {
      await assert.rejects(prepareGithubRelease(f), /another commit/);
      assert.equal(f.state.release, null);
    }
  }
});

test('invalid version, destination, repository, event, or source fails before any API request', async t => {
  for (const extra of [
    { RELEASE_DESTINATION: 'production' }, { GITHUB_REPOSITORY_ID: '999' }, { GITHUB_SHA: 'invalid' },
    { GITHUB_REF: 'refs/tags/v1.2.8' }, { GITHUB_EVENT_NAME: 'push' }, { GITHUB_TOKEN: '' },
  ]) {
    const f = fixture(t);
    Object.assign(f.env, extra);
    await assert.rejects(prepareGithubRelease(f));
    assert.equal(f.calls.length, 0);
  }
  const f = fixture(t);
  fs.writeFileSync(f.env.RELEASE_VERSION_FILE, JSON.stringify({ name: '1.2.8', code: 0 }));
  await assert.rejects(prepareGithubRelease(f), /version is invalid/);
  assert.equal(f.calls.length, 0);
});

test('GitHub must confirm publication before the workflow proceeds to Android', async t => {
  const f = fixture(t, { responseDraft: true });
  await assert.rejects(prepareGithubRelease(f), /was not published/);
});
