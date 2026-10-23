import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { test } from 'node:test';
import { releasePlan } from '../scripts/release-plan.mjs';

const context = {
  GITHUB_REPOSITORY_ID: '1016678903', GITHUB_REF: 'refs/heads/master', GITHUB_EVENT_NAME: 'workflow_dispatch',
};
const plan = (action, extra = {}) => releasePlan({ ...context, RELEASE_ACTION: action, ...extra });

test('GitHub-only release creates a tag/page without Android build, signing, or Play access', () => {
  assert.deepEqual(plan('release', { RELEASE_DESTINATION: 'github' }), {
    prepare_release: true, build_android: false, prepare_signing: false,
    authenticate_play: false, publish_bundle: false, play_track: 'internal', download_aab: false,
    attach_apk: false,
  });
});

test('Play and Both build once and default to internal testing', () => {
  for (const destination of ['play', 'both']) {
    assert.deepEqual(plan('release', { RELEASE_DESTINATION: destination }), {
      prepare_release: true, build_android: true, prepare_signing: true,
      authenticate_play: true, publish_bundle: true, play_track: 'internal', download_aab: false,
      attach_apk: destination === 'both',
    });
  }
});

test('explicit production uploads use the same release path, including APK attachment for Both', () => {
  for (const destination of ['play', 'both']) {
    const internal = plan('release', { RELEASE_DESTINATION: destination });
    assert.deepEqual(plan('release', { RELEASE_DESTINATION: destination, PLAY_TRACK: 'production' }), {
      ...internal, play_track: 'production',
    });
    assert.throws(() => plan('release', { RELEASE_DESTINATION: destination, PLAY_TRACK: 'closed' }), /track must be/);
  }
});

test('verification and build-only modes never create a release or upload a bundle', () => {
  const verification = plan('verify');
  assert.equal(verification.prepare_release, false);
  assert.equal(verification.build_android, false);
  assert.equal(verification.publish_bundle, false);
  assert.equal(verification.authenticate_play, true);
  assert.equal(verification.prepare_signing, true);
  const build = plan('build');
  assert.equal(build.build_android, true);
  assert.equal(build.prepare_release, false);
  assert.equal(build.authenticate_play, false);
  assert.equal(build.publish_bundle, false);
});

test('artifact upload requires an explicit build run and never compiles or creates a tag', () => {
  assert.throws(() => plan('internal'), /build_run_id/);
  assert.throws(() => plan('internal', { PLAY_BUILD_RUN_ID: '../unsafe' }), /build_run_id/);
  const result = plan('internal', { PLAY_BUILD_RUN_ID: '1234' });
  assert.equal(result.download_aab, true);
  assert.equal(result.publish_bundle, true);
  assert.equal(result.build_android, false);
  assert.equal(result.prepare_release, false);
  assert.equal(result.prepare_signing, false);
});

test('the release track input cannot change artifact uploads or other actions', () => {
  for (const action of ['verify', 'build', 'internal', 'promote']) {
    const extra = action === 'internal' ? { PLAY_BUILD_RUN_ID: '1234' } : {};
    assert.deepEqual(plan(action, { ...extra, PLAY_TRACK: 'production' }), plan(action, extra));
  }
  assert.equal(plan('release', { RELEASE_DESTINATION: 'github', PLAY_TRACK: 'production' }).authenticate_play, false);
});

test('promotion accepts latest or a valid code but never builds, tags, or uploads a new AAB', () => {
  for (const code of ['', '32']) {
    const result = plan('promote', { PLAY_VERSION_CODE: code });
    assert.equal(result.authenticate_play, true);
    for (const key of ['prepare_release', 'build_android', 'publish_bundle', 'download_aab', 'prepare_signing', 'attach_apk']) assert.equal(result[key], false);
  }
  assert.throws(() => plan('promote', { PLAY_VERSION_CODE: '1.2.8' }), /positive version_code/);
});

test('automatic tag events, other repositories, branches, and invalid destinations cannot release', () => {
  for (const extra of [
    { GITHUB_REPOSITORY_ID: '999' }, { GITHUB_REF: 'refs/tags/v1.2.8' },
    { GITHUB_REF: 'refs/heads/feature' }, { GITHUB_EVENT_NAME: 'push' },
  ]) assert.throws(() => plan('release', { RELEASE_DESTINATION: 'both', ...extra }));
  assert.throws(() => plan('release', { RELEASE_DESTINATION: 'production' }), /destination/);
  assert.throws(() => plan('release'), /destination/);
  assert.throws(() => plan('unknown'), /Unknown/);
  assert.throws(() => plan('attach'), /Unknown/);
});

test('workflow runs only manually and orders GitHub publication before build and Play upload', () => {
  const require = createRequire(import.meta.url);
  const workflow = require('js-yaml').load(fs.readFileSync(new URL('../.github/workflows/android-play.yml', import.meta.url), 'utf8'));
  assert.deepEqual(Object.keys(workflow.on), ['workflow_dispatch']);
  assert.ok(!workflow.on.workflow_dispatch.inputs.action.options.includes('attach'));
  assert.ok(!Object.hasOwn(workflow.on.workflow_dispatch.inputs, 'release_tag'));
  assert.equal(workflow.on.workflow_dispatch.inputs.play_track.default, 'internal');
  assert.deepEqual(workflow.on.workflow_dispatch.inputs.play_track.options, ['internal', 'production']);
  const job = workflow.jobs.release;
  assert.equal(job.needs, 'tests');
  const position = name => job.steps.findIndex(step => step.name === name);
  const github = position('Record version tag and publish GitHub Release first');
  const build = position('Build signed release bundle');
  const play = position('Publish to Google Play');
  const download = position('Download the Play-signed universal APK');
  const attach = position('Verify APK and attach it to the GitHub Release');
  assert.ok(github >= 0 && github < build && build < play);
  assert.ok(play < download && download < attach);
  assert.equal(job.steps[github].if, "steps.plan.outputs.prepare_release == 'true'");
  assert.equal(job.steps[build].if, "steps.plan.outputs.build_android == 'true'");
  assert.equal(job.steps[position('Select release steps')].env.PLAY_TRACK, '${{ inputs.play_track }}');
  assert.equal(job.steps[play].if, "steps.plan.outputs.publish_bundle == 'true'");
  assert.equal(job.steps[play].env.PLAY_TARGET_TRACK, '${{ steps.plan.outputs.play_track }}');
  assert.equal(job.steps[play].run, 'bundle exec fastlane android publish track:"$PLAY_TARGET_TRACK"');
  assert.equal(job.steps[download].if, "steps.plan.outputs.attach_apk == 'true'");
  assert.equal(job.steps[attach].if, "steps.plan.outputs.attach_apk == 'true'");
  assert.equal(job.steps[position('Promote tested version to production')].if, "inputs.action == 'promote'");
});
