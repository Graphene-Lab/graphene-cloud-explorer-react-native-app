import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

const repository = 'Graphene-Lab/graphene-cloud-explorer-react-native-app';
const packageName = 'com.graphenelab.cloudexplorer';
const validSha = value => /^[a-f0-9]{40}$/i.test(value || '');
const contextFile = env => path.join(env.RUNNER_TEMP, 'play-apk-release.json');

function githubClient(env, fetchImpl) {
  if (env.GITHUB_REPOSITORY !== repository || env.GITHUB_REPOSITORY_ID !== '1016678903' ||
      env.GITHUB_REF !== 'refs/heads/master' || env.GITHUB_EVENT_NAME !== 'workflow_dispatch' ||
      !env.GITHUB_TOKEN || !env.RUNNER_TEMP ||
      env.RELEASE_ACTION !== 'release' || env.RELEASE_DESTINATION !== 'both') {
    throw new Error('APK attachment is restricted to this repository\'s manual master Both release.');
  }
  return async (endpoint, options = {}) => {
    const response = await fetchImpl(`https://api.github.com/repos/${repository}${endpoint}`, {
      headers: { Authorization: `Bearer ${env.GITHUB_TOKEN}`, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2026-03-10' },
      signal: AbortSignal.timeout(30000), redirect: 'error', ...options,
    });
    if (!response.ok) throw new Error(`GitHub APK lookup failed (HTTP ${response.status}).`);
    return response.json();
  };
}

export async function resolveApkRelease({ env = process.env, fetchImpl = fetch } = {}) {
  const get = githubClient(env, fetchImpl);
  const { name, code } = JSON.parse(fs.readFileSync(env.RELEASE_VERSION_FILE, 'utf8'));
  if (!/^\d+\.\d+\.\d+$/.test(name || '') || !Number.isInteger(code) || code < 1 || code > 2_100_000_000) {
    throw new Error('The validated release version is invalid.');
  }
  const tag = `v${name}`;
  let object = (await get(`/git/ref/tags/${tag}`)).object;
  for (let depth = 0; depth < 5 && object?.type === 'tag' && validSha(object.sha); depth++) {
    object = (await get(`/git/tags/${object.sha}`)).object;
  }
  if (object?.type !== 'commit' || !validSha(object.sha)) throw new Error('Cannot resolve the release tag to an immutable commit.');
  const sourceSha = object.sha;
  if (sourceSha !== env.GITHUB_SHA) throw new Error('The release tag points at different source. Existing tags are preserved.');
  const release = await get(`/releases/tags/${tag}`);
  if (release.tag_name !== tag || release.draft !== false || !Number.isSafeInteger(release.id) || release.id < 1) {
    throw new Error('Select an existing published GitHub Release.');
  }
  return { tag, name, code, sourceSha, releaseId: release.id };
}

export async function publishReleaseApk({ env = process.env, fetchImpl = fetch, run = spawnSync } = {}) {
  const get = githubClient(env, fetchImpl);
  const recorded = JSON.parse(fs.readFileSync(contextFile(env), 'utf8'));
  const version = await resolveApkRelease({ env, fetchImpl });
  if (JSON.stringify(recorded) !== JSON.stringify(version)) throw new Error('The release changed during APK download; nothing was attached.');
  const expected = (env.PLAY_APP_SIGNING_SHA256 || '').replaceAll(':', '').toLowerCase();
  if (!/^[a-f0-9]{64}$/.test(expected)) throw new Error('Configure the Play app signing SHA-256 fingerprint.');
  const filename = `Graphene-Cloud-Explorer-${version.name}.apk`;
  const apkPath = path.join(env.RUNNER_TEMP, 'play-release-apk', filename);
  const size = fs.statSync(apkPath).size;
  if (!size) throw new Error('The downloaded APK is empty.');
  const sdk = env.ANDROID_HOME || env.ANDROID_SDK_ROOT;
  if (!sdk) throw new Error('Android build tools are required to verify the downloaded APK.');
  const tools = path.join(sdk, 'build-tools', '36.0.0');
  const execute = (command, args) => {
    const result = run(command, args, { encoding: 'utf8', timeout: 60000, maxBuffer: 2 * 1024 * 1024 });
    if (result.error || result.status !== 0) throw new Error('Downloaded APK signature or manifest verification failed.');
    return result.stdout;
  };
  const certificate = execute('java', ['-jar', path.join(tools, 'lib', 'apksigner.jar'), 'verify', '--print-certs', apkPath]);
  const signers = [...certificate.matchAll(/^Signer #\d+ certificate SHA-256 digest:\s*([a-f0-9:]+)\s*$/gmi)].map(m => m[1].replaceAll(':', '').toLowerCase());
  if (signers.length !== 1 || signers[0] !== expected) throw new Error('APK signature does not match the configured Play app signing certificate; nothing was attached.');
  const manifest = execute(path.join(tools, process.platform === 'win32' ? 'aapt2.exe' : 'aapt2'), ['dump', 'badging', apkPath]);
  const attributes = Object.fromEntries([...(manifest.match(/^package: (.+)$/m)?.[1] || '').matchAll(/(\w+)='([^']*)'/g)].map(m => [m[1], m[2]]));
  if (attributes.name !== packageName || attributes.versionName !== version.name || attributes.versionCode !== String(version.code) ||
      attributes.split || /^application-debuggable\b/m.test(manifest)) throw new Error('APK package/version does not match the tagged release, or it is not a universal release APK.');
  const hash = createHash('sha256');
  for await (const chunk of fs.createReadStream(apkPath)) hash.update(chunk);
  const digest = `sha256:${hash.digest('hex')}`;
  let existing;
  for (let page = 1; page <= 10; page++) {
    const assets = await get(`/releases/${version.releaseId}/assets?per_page=100&page=${page}`);
    existing = assets.find(asset => asset.name === filename);
    if (existing || assets.length < 100) break;
    if (page === 10) throw new Error('Too many release assets to safely check for an existing APK.');
  }
  const checkAsset = asset => {
    if (asset.name !== filename || asset.state !== 'uploaded' || asset.size !== size || asset.digest !== digest) {
      throw new Error('A release asset has different content or an incomplete upload; existing assets are never overwritten.');
    }
  };
  if (existing) {
    checkAsset(existing);
    console.log(`The identical verified APK is already attached to ${version.tag}.`);
    return existing;
  }
  const response = await fetchImpl(`https://uploads.github.com/repos/${repository}/releases/${version.releaseId}/assets?name=${encodeURIComponent(filename)}`, {
    method: 'POST', headers: { Authorization: `Bearer ${env.GITHUB_TOKEN}`, Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2026-03-10', 'Content-Type': 'application/vnd.android.package-archive', 'Content-Length': String(size) },
    body: fs.createReadStream(apkPath), duplex: 'half', signal: AbortSignal.timeout(300000), redirect: 'error',
  });
  if (!response.ok) throw new Error(`GitHub APK upload failed (HTTP ${response.status}).`);
  const asset = await response.json();
  checkAsset(asset);
  console.log(`Verified Play-signed APK attached to ${version.tag}: ${filename}.`);
  if (env.GITHUB_STEP_SUMMARY) fs.appendFileSync(env.GITHUB_STEP_SUMMARY, `\nAttached **${filename}**, versionCode **${version.code}**, to [${version.tag}](https://github.com/${repository}/releases/tag/${version.tag}). Play signing certificate and APK package/version verified.\n`);
  return asset;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  (async () => {
    if (process.argv[2] === 'resolve') {
      const version = await resolveApkRelease();
      fs.writeFileSync(contextFile(process.env), JSON.stringify(version));
      console.log(`Selected ${version.tag}, versionCode ${version.code}, source ${version.sourceSha}.`);
    } else if (process.argv[2] === 'publish') await publishReleaseApk();
    else throw new Error('Usage: node scripts/github-release-apk.mjs resolve|publish');
  })().catch(error => { console.error(error.message); process.exitCode = 1; });
}
