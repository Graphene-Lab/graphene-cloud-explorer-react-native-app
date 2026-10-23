import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

export function runReleaseWorkflow(argv, { run = spawnSync, env = process.env } = {}) {
  const [action, ...options] = argv;
  const publishing = ['github', 'play', 'both'].includes(action);
  const usage = 'Usage: npm run release:github, npm run release:play|release:both [-- --play-track internal|production], or npm run release:promote [-- <versionCode>]';
  let track;
  let versionCode;
  if (action === 'promote') {
    if (options.length > 1) throw new Error(usage);
    [versionCode] = options;
  } else if (publishing) {
    if (action === 'github') {
      if (options.length) throw new Error(usage);
    } else {
      if (options.length && (options.length !== 2 || options[0] !== '--play-track')) throw new Error(usage);
      track = options.length ? options[1] : 'internal';
      if (!['internal', 'production'].includes(track)) throw new Error('Play track must be internal or production.');
    }
  } else {
    throw new Error(usage);
  }
  if (versionCode !== undefined && (!/^[1-9]\d*$/.test(versionCode) || Number(versionCode) > 2_100_000_000)) {
    throw new Error('versionCode must be a positive integer; omit it to promote the latest internal version.');
  }
  const args = [
    'workflow', 'run', 'android-play.yml',
    '--repo', 'Graphene-Lab/graphene-cloud-explorer-react-native-app',
    '--ref', 'master', '-f', `action=${publishing ? 'release' : 'promote'}`,
  ];
  if (publishing) args.push('-f', `destination=${action}`);
  if (track) args.push('-f', `play_track=${track}`);
  if (versionCode !== undefined) args.push('-f', `version_code=${versionCode}`);

  console.log(publishing ? `Requesting a ${action} release${track ? ` to Play ${track}` : ''} from GitHub's master commit.` : `Requesting production promotion for ${versionCode ? `versionCode ${versionCode}` : 'the latest internal version'}.`);
  const result = run('gh', args, { stdio: 'inherit', env: { ...env, GH_PROMPT_DISABLED: '1' } });
  if (result.error) throw new Error('GitHub CLI (gh) must be installed and authenticated to start the release workflow.');
  if (result.status !== 0) throw new Error('GitHub rejected the workflow request. Check the GitHub CLI output above.');
  console.log('Release workflow requested. Check GitHub Actions for the result.');
  return publishing ? { destination: action, ...(track ? { track } : {}) } : { versionCode: versionCode || null };
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  try {
    runReleaseWorkflow(process.argv.slice(2));
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
