import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

export async function resolvePlayBuild({ env = process.env, fetchImpl = fetch } = {}) {
  const required = ['PLAY_BUILD_RUN_ID', 'GITHUB_TOKEN', 'GITHUB_REPOSITORY', 'GITHUB_REPOSITORY_ID', 'RUNNER_TEMP', 'GITHUB_ENV'];
  const missing = required.filter(key => !env[key]?.trim());
  if (missing.length) throw new Error(`Missing artifact upload configuration: ${missing.join(', ')}`);
  if (!/^[1-9]\d*$/.test(env.PLAY_BUILD_RUN_ID)) throw new Error('build_run_id must be a positive GitHub Actions run ID.');
  if (!/^[\w.-]+\/[\w.-]+$/.test(env.GITHUB_REPOSITORY)) throw new Error('Invalid GitHub repository.');

  const api = env.GITHUB_API_URL || 'https://api.github.com';
  const repo = `${api}/repos/${env.GITHUB_REPOSITORY}`;
  const get = async (url, optional = false) => {
    const response = await fetchImpl(url, {
      headers: { Authorization: `Bearer ${env.GITHUB_TOKEN}`, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' },
      signal: AbortSignal.timeout(30000),
    });
    if (optional && response.status === 404) return null;
    if (!response.ok) throw new Error(`GitHub artifact lookup failed (HTTP ${response.status}).`);
    return response.json();
  };
  const runUrl = `${repo}/actions/runs/${env.PLAY_BUILD_RUN_ID}`;
  const run = await get(runUrl);
  if (String(run.repository?.id) !== env.GITHUB_REPOSITORY_ID || run.path !== '.github/workflows/android-play.yml') {
    throw new Error('Select a build from this repository\'s Android Google Play workflow.');
  }
  if (run.event !== 'workflow_dispatch' && run.event !== 'push') {
    throw new Error('Artifacts from pull requests or other workflow events cannot be published.');
  }
  if (run.status !== 'completed' || run.conclusion !== 'success') {
    throw new Error('The selected build must finish successfully before its AAB can be uploaded.');
  }
  if (!/^[a-f0-9]{40}$/i.test(run.head_sha)) throw new Error('The selected build has an invalid source commit.');

  const name = `graphene-explorer-${run.head_sha}`;
  const artifacts = await get(`${runUrl}/artifacts?per_page=100`);
  const matching = artifacts.artifacts?.filter(artifact => artifact.name === name && !artifact.expired) || [];
  if (matching.length !== 1 || !/^[1-9]\d*$/.test(String(matching[0].id))) {
    throw new Error('The selected build must contain exactly one available signed AAB artifact.');
  }

  // Read version information from the artifact's immutable source commit, not today's master.
  const readFile = async (filename, optional = false) => {
    const file = await get(`${repo}/contents/${filename}?ref=${run.head_sha}`, optional);
    if (!file) return null;
    if (file.encoding !== 'base64' || typeof file.content !== 'string') {
      throw new Error(`Cannot read ${filename} from the selected build's source commit.`);
    }
    return Buffer.from(file.content, 'base64');
  };
  const files = ['package.json', 'app.json', 'android/app/build.gradle'];
  const contents = await Promise.all(files.map(filename => readFile(filename)));
  const code = Number(contents[2].toString('utf8').match(/\bversionCode\s+(\d+)/)?.[1]);
  if (!Number.isInteger(code) || code < 1 || code > 2_100_000_000) throw new Error('The selected build has an invalid Android versionCode.');
  const metadata = 'fastlane/metadata/android';
  const locales = await get(`${repo}/contents/${metadata}?ref=${run.head_sha}`, true);
  if (!Array.isArray(locales) || !locales.some(locale => locale.type === 'dir' && locale.name === 'en-US')) {
    throw new Error('The selected build source must include Play release notes in fastlane/metadata/android/en-US/changelogs.');
  }
  const notes = await Promise.all(locales.filter(locale => locale.type === 'dir').map(async locale => {
    if (!/^[a-z]{2,3}(?:-[A-Za-z0-9]{2,8})*$/.test(locale.name)) throw new Error('Invalid Play release-notes language in the selected build.');
    const filename = `${metadata}/${locale.name}/changelogs/${code}.txt`;
    const content = await readFile(filename, locale.name !== 'en-US');
    return content ? { filename, content } : null;
  }));
  const source = fs.mkdtempSync(path.join(env.RUNNER_TEMP, 'play-build-source-'));
  fs.mkdirSync(path.join(source, 'android/app'), { recursive: true });
  files.forEach((filename, index) => fs.writeFileSync(path.join(source, filename), contents[index]));
  for (const note of notes.filter(Boolean)) {
    const filename = path.join(source, note.filename);
    fs.mkdirSync(path.dirname(filename), { recursive: true });
    fs.writeFileSync(filename, note.content);
  }
  fs.appendFileSync(env.GITHUB_ENV, `PLAY_RELEASE_SOURCE=${source}\nPLAY_AAB_ARTIFACT_ID=${matching[0].id}\n`);
  console.log(`Using signed AAB from run ${env.PLAY_BUILD_RUN_ID}, commit ${run.head_sha}.`);
  return { source, artifactId: matching[0].id };
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  resolvePlayBuild().catch(error => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
