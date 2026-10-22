import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

export function runReleaseWorkflow(argv, { run = spawnSync, env = process.env } = {}) {
  const [action, versionCode, ...extra] = argv;
  const publishing = ['github', 'play', 'both'].includes(action);
  if ((!publishing && action !== 'promote') || extra.length || (publishing && versionCode !== undefined)) {
    throw new Error('Usage: npm run release:github|release:play|release:both, or npm run release:promote [-- <versionCode>]');
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
  if (versionCode !== undefined) args.push('-f', `version_code=${versionCode}`);

  console.log(publishing ? `Requesting a ${action} release from GitHub's master commit.` : `Requesting production promotion for ${versionCode ? `versionCode ${versionCode}` : 'the latest internal version'}.`);
  const result = run('gh', args, { stdio: 'inherit', env: { ...env, GH_PROMPT_DISABLED: '1' } });
  if (result.error) throw new Error('GitHub CLI (gh) must be installed and authenticated to start the release workflow.');
  if (result.status !== 0) throw new Error('GitHub rejected the workflow request. Check the GitHub CLI output above.');
  console.log('Release workflow requested. Check GitHub Actions for the result.');
  return publishing ? { destination: action } : { versionCode: versionCode || null };
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  try {
    runReleaseWorkflow(process.argv.slice(2));
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
