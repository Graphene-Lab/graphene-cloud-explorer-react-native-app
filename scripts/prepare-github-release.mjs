import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

export async function prepareGithubRelease({ env = process.env, fetchImpl = fetch } = {}) {
  if (env.GITHUB_REPOSITORY_ID !== '1016678903' || env.GITHUB_REPOSITORY !== 'Graphene-Lab/graphene-cloud-explorer-react-native-app' ||
      env.GITHUB_REF !== 'refs/heads/master' || env.GITHUB_EVENT_NAME !== 'workflow_dispatch') {
    throw new Error('Release creation is restricted to this repository\'s manual master workflow.');
  }
  if (!env.GITHUB_TOKEN || !env.RELEASE_VERSION_FILE || !/^[a-f0-9]{40}$/i.test(env.GITHUB_SHA || '')) {
    throw new Error('Missing GitHub release credentials, validated version file, or source commit.');
  }
  if (!['github', 'play', 'both'].includes(env.RELEASE_DESTINATION)) throw new Error('Invalid release destination.');
  const version = JSON.parse(fs.readFileSync(env.RELEASE_VERSION_FILE, 'utf8'));
  if (!/^\d+\.\d+\.\d+$/.test(version.name) || !Number.isInteger(version.code) || version.code < 1 || version.code > 2_100_000_000) {
    throw new Error('The validated release version is invalid.');
  }
  if (env.RELEASE_DESTINATION !== 'play' && (typeof version.github_notes !== 'string' ||
      !version.github_notes.replace(/<!--[\s\S]*?-->/g, '').trim() || version.github_notes.includes('RELEASE_NOTES_TODO'))) {
    throw new Error('Fill in the GitHub release notes before publishing.');
  }
  const tag = `v${version.name}`;
  const base = `${env.GITHUB_API_URL || 'https://api.github.com'}/repos/${env.GITHUB_REPOSITORY}`;
  const request = async (method, endpoint, body, allowed = []) => {
    const response = await fetchImpl(`${base}${endpoint}`, {
      method,
      headers: { Authorization: `Bearer ${env.GITHUB_TOKEN}`, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2026-03-10', ...(body ? { 'Content-Type': 'application/json' } : {}) },
      ...(body ? { body: JSON.stringify(body) } : {}),
      signal: AbortSignal.timeout(30000), redirect: 'error',
    });
    if (allowed.includes(response.status)) return null;
    if (!response.ok) throw new Error(`GitHub release ${method} failed (HTTP ${response.status}).`);
    return response.json();
  };
  const tagCommit = async () => {
    const ref = await request('GET', `/git/ref/tags/${tag}`, undefined, [404]);
    if (!ref) return null;
    let object = ref.object;
    for (let depth = 0; depth < 5; depth++) {
      if (!/^[a-f0-9]{40}$/i.test(object?.sha || '')) break;
      if (object.type === 'commit') return object.sha;
      if (object.type !== 'tag') break;
      object = (await request('GET', `/git/tags/${object.sha}`)).object;
    }
    throw new Error(`Cannot resolve ${tag} to a source commit.`);
  };
  const checkCommit = commit => {
    if (commit !== env.GITHUB_SHA) throw new Error(`${tag} already points to another commit. Bump the app version for new source changes; existing tags are preserved.`);
  };
  const existing = await tagCommit();
  if (existing) {
    checkCommit(existing);
  } else {
    const object = await request('POST', '/git/tags', {
      tag, message: `Release ${tag} (Android versionCode ${version.code})`, object: env.GITHUB_SHA, type: 'commit',
    });
    if (!/^[a-f0-9]{40}$/i.test(object?.sha || '')) throw new Error('GitHub did not return an annotated tag object.');
    // A concurrent creator may win; reuse only if it selected the identical source commit.
    await request('POST', '/git/refs', { ref: `refs/tags/${tag}`, sha: object.sha }, [422]);
    const created = await tagCommit();
    if (!created) throw new Error(`GitHub did not create ${tag}; publishing has stopped.`);
    checkCommit(created);
  }
  console.log(`${tag} identifies source commit ${env.GITHUB_SHA}.`);
  let releaseUrl = null;
  if (env.RELEASE_DESTINATION !== 'play') {
    let release = await request('GET', `/releases/tags/${tag}`, undefined, [404]);
    if (!release) {
      release = await request('POST', '/releases', {
        tag_name: tag, target_commitish: env.GITHUB_SHA, name: tag,
        body: version.github_notes,
        draft: false, prerelease: false, generate_release_notes: true, make_latest: 'true',
      });
    } else if (release.draft || !release.body?.trim()) {
      if (!Number.isSafeInteger(release.id) || release.id < 1) throw new Error('GitHub returned an invalid release ID.');
      release = await request('PATCH', `/releases/${release.id}`, {
        ...(release.draft ? { draft: false } : {}),
        ...(!release.body?.trim() ? { body: version.github_notes } : {}),
      });
    }
    if (release.tag_name !== tag || release.draft !== false) throw new Error('GitHub Release was not published; the Android release has not started.');
    releaseUrl = release.html_url;
    console.log(`GitHub Release ${tag} is published. Android publishing may now proceed if selected.`);
  }
  return { tag, sourceSha: env.GITHUB_SHA, releaseUrl };
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  prepareGithubRelease().catch(error => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
