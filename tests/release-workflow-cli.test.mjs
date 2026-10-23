import assert from 'node:assert/strict';
import { test } from 'node:test';
import { runReleaseWorkflow } from '../scripts/release-workflow.mjs';

test('promotion without a code delegates latest selection to the remote workflow', () => {
  const calls = [];
  const run = (command, args, options) => {
    calls.push({ command, args, options });
    return { status: 0 };
  };
  assert.deepEqual(runReleaseWorkflow(['promote'], { run, env: {} }), { versionCode: null });
  assert.equal(calls.length, 1);
  const call = calls[0];
  assert.equal(call.command, 'gh');
  assert.deepEqual(call.args.slice(0, 3), ['workflow', 'run', 'android-play.yml']);
  assert.equal(call.args[call.args.indexOf('--repo') + 1], 'Graphene-Lab/graphene-cloud-explorer-react-native-app');
  assert.equal(call.args[call.args.indexOf('--ref') + 1], 'master');
  assert.ok(call.args.includes('action=promote'));
  assert.ok(!call.args.some(arg => arg.startsWith('version_code=')));
  assert.equal(call.options.env.GH_PROMPT_DISABLED, '1');
});

test('an explicit version selects that exact internal build', () => {
  const calls = [];
  const run = (_command, args) => { calls.push(args); return { status: 0 }; };
  assert.deepEqual(runReleaseWorkflow(['promote', '32'], { run }), { versionCode: '32' });
  assert.ok(calls[0].includes('version_code=32'));
});

test('release shortcuts default to internal testing and dispatch only the selected destination', () => {
  for (const destination of ['github', 'play', 'both']) {
    let calls = 0;
    const run = (command, args) => {
      calls++;
      assert.equal(command, 'gh');
      assert.ok(args.includes('action=release'));
      assert.ok(args.includes(`destination=${destination}`));
      assert.ok(!args.includes('action=promote'));
      assert.ok(!args.some(arg => arg.startsWith('version_code=')));
      if (destination === 'github') {
        assert.ok(!args.some(arg => arg.startsWith('play_track=')));
      } else {
        assert.ok(args.includes('play_track=internal'));
      }
      return { status: 0 };
    };
    assert.deepEqual(runReleaseWorkflow([destination], { run }), {
      destination, ...(destination === 'github' ? {} : { track: 'internal' }),
    });
    assert.equal(calls, 1);
  }
});

test('Play and Both can explicitly upload a new bundle directly to production', () => {
  for (const destination of ['play', 'both']) {
    for (const track of ['internal', 'production']) {
      const calls = [];
      const run = (_command, args) => { calls.push(args); return { status: 0 }; };
      assert.deepEqual(runReleaseWorkflow([destination, '--play-track', track], { run }), { destination, track });
      assert.equal(calls.length, 1);
      assert.ok(calls[0].includes('action=release'));
      assert.ok(calls[0].includes(`destination=${destination}`));
      assert.ok(calls[0].includes(`play_track=${track}`));
      assert.ok(!calls[0].includes('action=promote'));
    }
  }
});

test('invalid track selections and flags fail before dispatch', () => {
  const run = () => assert.fail('Invalid track selection must never dispatch a workflow.');
  for (const track of ['', 'closed', 'Production', 'production; echo unsafe']) {
    assert.throws(() => runReleaseWorkflow(['play', '--play-track', track], { run }), /track must be/);
  }
  for (const args of [
    ['both', '--play-track'], ['play', '--production'], ['play', '--play-track', 'production', 'extra'],
    ['github', '--play-track', 'production'], ['promote', '--play-track', 'production'],
    ['play', '--track', 'production'],
  ]) assert.throws(() => runReleaseWorkflow(args, { run }), /Usage/);
});

test('invalid versions and extra arguments fail before starting any workflow', () => {
  const run = () => assert.fail('Invalid input must never dispatch a production workflow.');
  for (const value of ['', '0', '-1', '1.2.8', 'latest', '32; echo unsafe', '2100000001']) {
    assert.throws(() => runReleaseWorkflow(['promote', value], { run }), /positive integer/);
  }
  for (const args of [[], ['build'], ['promote', '32', '33'], ['both', '32'], ['github', 'v1.2.8'], ['attach', 'v1.2.8']]) {
    assert.throws(() => runReleaseWorkflow(args, { run }), /Usage/);
  }
});

test('a missing CLI or failed dispatch is reported without retrying promotion', () => {
  for (const result of [{ error: new Error('missing executable') }, { status: 1 }]) {
    let calls = 0;
    const run = () => { calls++; return result; };
    assert.throws(() => runReleaseWorkflow(['promote'], { run }));
    assert.equal(calls, 1);
  }
});
