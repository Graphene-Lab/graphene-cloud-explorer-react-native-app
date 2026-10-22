import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { prepareAndroidCi } from '../scripts/prepare-android-ci.mjs';

function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'explorer-ci-test-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  fs.mkdirSync(path.join(root, 'android/app'), { recursive: true });
  fs.writeFileSync(path.join(root, 'app.json'), JSON.stringify({ expo: { android: { package: 'com.graphenelab.cloudexplorer' } } }));
  const firebase = { client: [{ client_info: { android_client_info: { package_name: 'com.graphenelab.cloudexplorer' } } }] };
  const env = {
    ANDROID_UPLOAD_KEYSTORE_BASE64: Buffer.from('test-keystore-bytes').toString('base64'),
    APP_UPLOAD_STORE_PASSWORD: 'test-store-password',
    APP_UPLOAD_KEY_ALIAS: 'test-upload-alias',
    APP_UPLOAD_KEY_PASSWORD: 'test-key-password',
    GOOGLE_SERVICES_JSON: JSON.stringify(firebase),
    RUNNER_TEMP: root,
    GITHUB_ENV: path.join(root, 'github-env'),
  };
  return { root, env };
}

test('restores exact keystore bytes and Firebase configuration without exporting passwords', t => {
  const { root, env } = fixture(t);
  prepareAndroidCi({ root, env });
  assert.equal(fs.readFileSync(path.join(root, 'graphenelab-upload.keystore'), 'utf8'), 'test-keystore-bytes');
  assert.equal(fs.readFileSync(path.join(root, 'android/app/google-services.json'), 'utf8'), env.GOOGLE_SERVICES_JSON);
  const exported = fs.readFileSync(env.GITHUB_ENV, 'utf8');
  assert.equal(exported, `ORG_GRADLE_PROJECT_APP_UPLOAD_STORE_FILE=${path.join(root, 'graphenelab-upload.keystore')}\n`);
  assert.ok(!exported.includes(env.APP_UPLOAD_STORE_PASSWORD));
  assert.ok(!exported.includes(env.APP_UPLOAD_KEY_PASSWORD));
});

test('rejects missing signing credentials before writing files', t => {
  const { root, env } = fixture(t);
  delete env.APP_UPLOAD_KEY_PASSWORD;
  assert.throws(() => prepareAndroidCi({ root, env }), /APP_UPLOAD_KEY_PASSWORD/);
  assert.ok(!fs.existsSync(path.join(root, 'graphenelab-upload.keystore')));
});

test('rejects corrupt or empty encoded keystores', t => {
  const { root, env } = fixture(t);
  for (const value of ['not@base64', '   ']) {
    env.ANDROID_UPLOAD_KEYSTORE_BASE64 = value;
    assert.throws(() => prepareAndroidCi({ root, env }));
    assert.ok(!fs.existsSync(path.join(root, 'graphenelab-upload.keystore')));
  }
});

test('rejects malformed Firebase JSON without including its contents in the error', t => {
  const { root, env } = fixture(t);
  env.GOOGLE_SERVICES_JSON = 'private-malformed-content';
  assert.throws(() => prepareAndroidCi({ root, env }), error =>
    /complete JSON/.test(error.message) && !error.message.includes(env.GOOGLE_SERVICES_JSON));
});

test('rejects Firebase configuration belonging to another Android package', t => {
  const { root, env } = fixture(t);
  env.GOOGLE_SERVICES_JSON = JSON.stringify({ client: [{ client_info: { android_client_info: { package_name: 'other.app' } } }] });
  assert.throws(() => prepareAndroidCi({ root, env }), /does not contain this Android package/);
  assert.ok(!fs.existsSync(path.join(root, 'graphenelab-upload.keystore')));
});
