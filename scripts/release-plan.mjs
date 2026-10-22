import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

export function releasePlan(env = process.env) {
  if (env.GITHUB_REPOSITORY_ID !== '1016678903' || env.GITHUB_REF !== 'refs/heads/master' || env.GITHUB_EVENT_NAME !== 'workflow_dispatch') {
    throw new Error('Start releases manually from this repository\'s master branch.');
  }
  const action = env.RELEASE_ACTION;
  if (!['verify', 'build', 'release', 'internal', 'promote'].includes(action)) throw new Error('Unknown release action.');
  const releasing = action === 'release';
  const destination = env.RELEASE_DESTINATION;
  if (releasing && !['github', 'play', 'both'].includes(destination)) throw new Error('Select github, play, or both as the release destination.');
  if (action === 'internal' && !/^[1-9]\d*$/.test(env.PLAY_BUILD_RUN_ID || '')) {
    throw new Error('Internal upload requires a successful build_run_id.');
  }
  const code = (env.PLAY_VERSION_CODE || '').trim();
  if (action === 'promote' && code && (!/^[1-9]\d*$/.test(code) || Number(code) > 2_100_000_000)) {
    throw new Error('Provide a positive version_code, or leave it blank for the latest internal version.');
  }
  const releaseToPlay = releasing && destination !== 'github';
  const build = action === 'build' || releaseToPlay;
  return {
    prepare_release: releasing,
    build_android: build,
    prepare_signing: build || action === 'verify',
    authenticate_play: releaseToPlay || ['verify', 'internal', 'promote'].includes(action),
    publish_internal: releaseToPlay || action === 'internal',
    download_aab: action === 'internal',
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  try {
    const plan = releasePlan();
    if (!process.env.GITHUB_OUTPUT) throw new Error('This script runs inside GitHub Actions.');
    fs.appendFileSync(process.env.GITHUB_OUTPUT, Object.entries(plan).map(([key, value]) => `${key}=${value}\n`).join(''));
    console.log(`Release action: ${process.env.RELEASE_ACTION}${process.env.RELEASE_ACTION === 'release' ? ` (${process.env.RELEASE_DESTINATION})` : ''}.`);
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
