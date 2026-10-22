import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

export function prepareAndroidCi({ env = process.env, root = process.cwd() } = {}) {
  const required = [
    'ANDROID_UPLOAD_KEYSTORE_BASE64',
    'APP_UPLOAD_STORE_PASSWORD',
    'APP_UPLOAD_KEY_ALIAS',
    'APP_UPLOAD_KEY_PASSWORD',
    'GOOGLE_SERVICES_JSON',
    'RUNNER_TEMP',
    'GITHUB_ENV',
  ];
  const missing = required.filter(key => !env[key]?.trim());
  if (missing.length) throw new Error(`Missing CI configuration: ${missing.join(', ')}`);

  const encoded = env.ANDROID_UPLOAD_KEYSTORE_BASE64.replace(/\s/g, '');
  if (!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(encoded)) {
    throw new Error('ANDROID_UPLOAD_KEYSTORE_BASE64 is not valid Base64.');
  }
  const keystore = Buffer.from(encoded, 'base64');
  if (!keystore.length) throw new Error('The upload keystore is empty.');

  let firebase;
  try {
    firebase = JSON.parse(env.GOOGLE_SERVICES_JSON);
  } catch {
    throw new Error('GOOGLE_SERVICES_JSON must contain the complete JSON configuration.');
  }
  const packageName = JSON.parse(fs.readFileSync(path.join(root, 'app.json'), 'utf8')).expo.android.package;
  if (!firebase.client?.some(client => client.client_info?.android_client_info?.package_name === packageName)) {
    throw new Error('GOOGLE_SERVICES_JSON does not contain this Android package.');
  }

  const keystorePath = path.join(env.RUNNER_TEMP, 'graphenelab-upload.keystore');
  fs.writeFileSync(keystorePath, keystore, { mode: 0o600 });
  fs.writeFileSync(path.join(root, 'android/app/google-services.json'), env.GOOGLE_SERVICES_JSON, { mode: 0o600 });
  fs.appendFileSync(env.GITHUB_ENV, `ORG_GRADLE_PROJECT_APP_UPLOAD_STORE_FILE=${keystorePath}\n`);
  console.log('Upload keystore and Firebase configuration restored.');
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  try {
    prepareAndroidCi();
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
