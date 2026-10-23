import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { test } from 'node:test';

const { bumpVersion } = createRequire(import.meta.url)('../scripts/version-bump.js');

function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'explorer-version-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  fs.mkdirSync(path.join(root, 'android/app'), { recursive: true });
  fs.writeFileSync(path.join(root, 'package.json'), JSON.stringify({ name: 'test-app', version: '1.2.8', scripts: { keep: 'unchanged' } }));
  fs.writeFileSync(path.join(root, 'app.json'), JSON.stringify({ expo: { version: '1.2.8', android: { package: 'com.graphenelab.cloudexplorer' } } }));
  fs.writeFileSync(path.join(root, 'android/app/build.gradle'), 'versionName "1.2.8"\nversionCode 32\n// Keep unrelated Gradle configuration.\n');
  return root;
}

test('a version bump updates all app versions and creates separate notes for that version and code', t => {
  const root = fixture(t);
  assert.deepEqual(bumpVersion({ root }), { name: '1.2.9', code: 33 });
  const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
  assert.equal(pkg.version, '1.2.9');
  assert.deepEqual(pkg.scripts, { keep: 'unchanged' });
  assert.equal(JSON.parse(fs.readFileSync(path.join(root, 'app.json'), 'utf8')).expo.version, '1.2.9');
  assert.equal(fs.readFileSync(path.join(root, 'android/app/build.gradle'), 'utf8'), 'versionName "1.2.9"\nversionCode 33\n// Keep unrelated Gradle configuration.\n');
  assert.match(fs.readFileSync(path.join(root, 'release-notes/1.2.9.md'), 'utf8'), /RELEASE_NOTES_TODO/);
  assert.match(fs.readFileSync(path.join(root, 'fastlane/metadata/android/en-US/changelogs/33.txt'), 'utf8'), /RELEASE_NOTES_TODO/);
});

test('prepared notes and earlier release history are never overwritten by a bump', t => {
  const root = fixture(t);
  const files = {
    'release-notes/1.3.0.md': 'Detailed reviewed GitHub notes.\n',
    'release-notes/1.2.8.md': 'Previous release.\n',
    'fastlane/metadata/android/en-US/changelogs/33.txt': 'Short reviewed Play notes.\n',
    'fastlane/metadata/android/en-US/changelogs/32.txt': 'Previous Play notes.\n',
  };
  for (const [filename, text] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(root, filename)), { recursive: true });
    fs.writeFileSync(path.join(root, filename), text);
  }
  assert.deepEqual(bumpVersion({ root, arg: 'minor' }), { name: '1.3.0', code: 33 });
  for (const [filename, text] of Object.entries(files)) assert.equal(fs.readFileSync(path.join(root, filename), 'utf8'), text);
});

test('major and exact version bumps name their note files consistently', t => {
  for (const [arg, name] of [['major', '2.0.0'], ['4.5.6', '4.5.6']]) {
    const root = fixture(t);
    assert.deepEqual(bumpVersion({ root, arg }), { name, code: 33 });
    assert.ok(fs.existsSync(path.join(root, 'release-notes', `${name}.md`)));
  }
});

test('invalid versions or app configuration do not partly bump files or create notes', t => {
  for (const invalid of ['argument', 'expo', 'gradle', 'code']) {
    const root = fixture(t);
    if (invalid === 'expo') fs.writeFileSync(path.join(root, 'app.json'), '{}');
    if (invalid === 'gradle') fs.writeFileSync(path.join(root, 'android/app/build.gradle'), 'versionCode 32');
    if (invalid === 'code') fs.writeFileSync(path.join(root, 'android/app/build.gradle'), 'versionName "1.2.8"\nversionCode 2100000000');
    const files = ['package.json', 'app.json', 'android/app/build.gradle'];
    const before = files.map(filename => fs.readFileSync(path.join(root, filename), 'utf8'));
    assert.throws(() => bumpVersion({ root, arg: invalid === 'argument' ? '../invalid' : undefined }));
    assert.deepEqual(files.map(filename => fs.readFileSync(path.join(root, filename), 'utf8')), before);
    assert.ok(!fs.existsSync(path.join(root, 'release-notes')));
  }
});
