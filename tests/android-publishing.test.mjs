import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { prepareAndroidCi as prepareWithJava } from '../scripts/prepare-android-ci.mjs';

const prepareAndroidCi = options => prepareWithJava({ run: () => ({ status: 0 }), ...options });

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

test('does not export signing configuration when the alias preflight fails', t => {
  const { root, env } = fixture(t);
  const run = (command, args, options) => {
    assert.equal(command, 'java');
    assert.ok(!args.includes(env.APP_UPLOAD_STORE_PASSWORD));
    assert.equal(options.env.APP_UPLOAD_KEY_ALIAS, env.APP_UPLOAD_KEY_ALIAS);
    return { status: 3, stderr: 'sensitive output must not be echoed' };
  };
  assert.throws(() => prepareAndroidCi({ root, env, run }), /APP_UPLOAD_KEY_ALIAS does not exist/);
  assert.ok(!fs.existsSync(env.GITHUB_ENV));
  assert.ok(!fs.existsSync(path.join(root, 'android/app/google-services.json')));
});

test('real Java preflight checks the keystore, alias, and private-key password', t => {
  const { root, env } = fixture(t);
  const keystore = path.join(root, 'preflight-test.keystore');
  const signingEnv = {
    ...process.env,
    APP_UPLOAD_STORE_PASSWORD: 'ci-test-store-password',
    APP_UPLOAD_KEY_ALIAS: 'ci-test-key',
    APP_UPLOAD_KEY_PASSWORD: 'ci-test-key-password',
  };
  const generated = spawnSync('keytool', [
    '-genkeypair', '-storetype', 'JKS', '-keystore', keystore, '-alias', signingEnv.APP_UPLOAD_KEY_ALIAS,
    '-storepass:env', 'APP_UPLOAD_STORE_PASSWORD', '-keypass:env', 'APP_UPLOAD_KEY_PASSWORD',
    '-keyalg', 'RSA', '-keysize', '2048', '-validity', '1', '-dname', 'CN=CI signing test', '-noprompt',
  ], { env: signingEnv, encoding: 'utf8', timeout: 30000 });
  assert.equal(generated.status, 0, 'Could not generate the temporary test keystore; Java/keytool must be installed.');
  const source = fileURLToPath(new URL('../scripts/VerifyUploadKey.java', import.meta.url));
  const verify = overrides => spawnSync('java', ['--source', '21', source, keystore], {
    env: { ...signingEnv, ...overrides }, encoding: 'utf8', timeout: 30000,
  });
  assert.equal(verify({}).status, 0);
  assert.equal(verify({ APP_UPLOAD_KEY_ALIAS: 'missing-key' }).status, 3);
  assert.equal(verify({ APP_UPLOAD_STORE_PASSWORD: 'wrong-password' }).status, 2);
  assert.equal(verify({ APP_UPLOAD_KEY_PASSWORD: 'wrong-password' }).status, 5);
  // The end-to-end restore must use the same Java check, not just the adapter above.
  env.ANDROID_UPLOAD_KEYSTORE_BASE64 = fs.readFileSync(keystore).toString('base64');
  Object.assign(env, {
    APP_UPLOAD_STORE_PASSWORD: signingEnv.APP_UPLOAD_STORE_PASSWORD,
    APP_UPLOAD_KEY_ALIAS: signingEnv.APP_UPLOAD_KEY_ALIAS,
    APP_UPLOAD_KEY_PASSWORD: signingEnv.APP_UPLOAD_KEY_PASSWORD,
  });
  prepareWithJava({ root, env });
  assert.ok(fs.existsSync(env.GITHUB_ENV));
});
