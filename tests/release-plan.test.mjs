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
    authenticate_play: false, publish_internal: false, download_aab: false,
    attach_apk: false, android_tools: false,
  });
});

test('Play and Both build once and upload only to internal testing', () => {
  for (const destination of ['play', 'both']) {
    assert.deepEqual(plan('release', { RELEASE_DESTINATION: destination }), {
      prepare_release: true, build_android: true, prepare_signing: true,
      authenticate_play: true, publish_internal: true, download_aab: false,
      attach_apk: destination === 'both', android_tools: true,
    });
  }
});

test('verification and build-only modes never create a release or upload a bundle', () => {
  const verification = plan('verify');
  assert.equal(verification.prepare_release, false);
  assert.equal(verification.build_android, false);
  assert.equal(verification.publish_internal, false);
  assert.equal(verification.authenticate_play, true);
  assert.equal(verification.prepare_signing, true);
  const build = plan('build');
  assert.equal(build.build_android, true);
  assert.equal(build.prepare_release, false);
  assert.equal(build.authenticate_play, false);
  assert.equal(build.publish_internal, false);
});

test('artifact upload requires an explicit build run and never compiles or creates a tag', () => {
  assert.throws(() => plan('internal'), /build_run_id/);
  assert.throws(() => plan('internal', { PLAY_BUILD_RUN_ID: '../unsafe' }), /build_run_id/);
  const result = plan('internal', { PLAY_BUILD_RUN_ID: '1234' });
  assert.equal(result.download_aab, true);
  assert.equal(result.publish_internal, true);
  assert.equal(result.build_android, false);
  assert.equal(result.prepare_release, false);
  assert.equal(result.prepare_signing, false);
});

test('promotion accepts latest or a valid code but never builds, tags, or uploads a new AAB', () => {
  for (const code of ['', '32']) {
    const result = plan('promote', { PLAY_VERSION_CODE: code });
    assert.equal(result.authenticate_play, true);
    for (const key of ['prepare_release', 'build_android', 'publish_internal', 'download_aab', 'prepare_signing', 'attach_apk', 'android_tools']) assert.equal(result[key], false);
  }
  assert.throws(() => plan('promote', { PLAY_VERSION_CODE: '1.2.8' }), /positive version_code/);
});

test('attachment uses an existing tag and Play read access without rebuilding, signing, tagging, or uploading an AAB', () => {
  const result = plan('attach', { RELEASE_TAG: 'v1.2.8' });
  assert.equal(result.authenticate_play, true);
  assert.equal(result.attach_apk, true);
  assert.equal(result.android_tools, true);
  for (const key of ['prepare_release', 'build_android', 'prepare_signing', 'publish_internal', 'download_aab']) assert.equal(result[key], false);
  for (const tag of ['', '1.2.8', '../v1.2.8', 'v1.2.8; unsafe']) assert.throws(() => plan('attach', { RELEASE_TAG: tag }), /release_tag/);
});

test('automatic tag events, other repositories, branches, and invalid destinations cannot release', () => {
  for (const extra of [
    { GITHUB_REPOSITORY_ID: '999' }, { GITHUB_REF: 'refs/tags/v1.2.8' },
    { GITHUB_REF: 'refs/heads/feature' }, { GITHUB_EVENT_NAME: 'push' },
  ]) assert.throws(() => plan('release', { RELEASE_DESTINATION: 'both', ...extra }));
  assert.throws(() => plan('release', { RELEASE_DESTINATION: 'production' }), /destination/);
  assert.throws(() => plan('release'), /destination/);
  assert.throws(() => plan('unknown'), /Unknown/);
});

test('workflow runs only manually and orders GitHub publication before build and Play upload', () => {
  const require = createRequire(import.meta.url);
  const workflow = require('js-yaml').load(fs.readFileSync(new URL('../.github/workflows/android-play.yml', import.meta.url), 'utf8'));
  assert.deepEqual(Object.keys(workflow.on), ['workflow_dispatch']);
  const job = workflow.jobs.release;
  assert.equal(job.needs, 'tests');
  const position = name => job.steps.findIndex(step => step.name === name);
  const github = position('Record version tag and publish GitHub Release first');
  const build = position('Build signed release bundle');
  const play = position('Publish to internal testing');
  const download = position('Download the Play-signed universal APK');
  const attach = position('Verify APK and attach it to the GitHub Release');
  assert.ok(github >= 0 && github < build && build < play);
  assert.ok(play < download && download < attach);
  assert.equal(job.steps[github].if, "steps.plan.outputs.prepare_release == 'true'");
  assert.equal(job.steps[build].if, "steps.plan.outputs.build_android == 'true'");
  assert.equal(job.steps[play].if, "steps.plan.outputs.publish_internal == 'true'");
  assert.equal(job.steps[download].if, "steps.plan.outputs.attach_apk == 'true'");
  assert.equal(job.steps[attach].if, "steps.plan.outputs.attach_apk == 'true'");
  assert.equal(job.steps[position('Promote tested version to production')].if, "inputs.action == 'promote'");
});
