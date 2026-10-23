#!/usr/bin/env node
const fs = require("fs");
const path = require("path");

const rootDir = path.resolve(__dirname, "..");

function readJson(filePath) {
  let content = fs.readFileSync(filePath, "utf8");
  if (content.charCodeAt(0) === 0xFEFF) {
    content = content.slice(1);
  }
  return JSON.parse(content);
}

function writeJson(filePath, data) {
  fs.writeFileSync(filePath, `${JSON.stringify(data, null, 2)}\n`, "utf8");
}

function isSemver(value) {
  return /^\d+\.\d+\.\d+$/.test(value);
}

function bump(version, type) {
  const parts = version.split(".").map(Number);
  if (parts.length !== 3 || parts.some(Number.isNaN)) {
    throw new Error(`Invalid semver value: ${version}`);
  }

  if (type === "major") {
    return `${parts[0] + 1}.0.0`;
  }

  if (type === "minor") {
    return `${parts[0]}.${parts[1] + 1}.0`;
  }

  return `${parts[0]}.${parts[1]}.${parts[2] + 1}`;
}

function nextVersion(currentVersion, arg) {
  if (!arg || arg === "patch" || arg === "minor" || arg === "major") {
    return bump(currentVersion, arg || "patch");
  }

  if (isSemver(arg)) {
    return arg;
  }

  throw new Error(
    `Invalid argument "${arg}". Use patch|minor|major or an exact version like 1.2.3`
  );
}

function bumpVersion({ root = rootDir, arg } = {}) {
  const packageJsonPath = path.join(root, "package.json");
  const appJsonPath = path.join(root, "app.json");
  const gradlePath = path.join(root, "android", "app", "build.gradle");

  const packageJson = readJson(packageJsonPath);
  const appJson = readJson(appJsonPath);
  const gradleContent = fs.readFileSync(gradlePath, "utf8");

  const currentVersion = packageJson.version;
  if (!isSemver(currentVersion)) {
    throw new Error(`package.json version must be semver x.y.z, got "${currentVersion}"`);
  }

  const newVersion = nextVersion(currentVersion, arg);

  const versionCodeMatch = gradleContent.match(/versionCode\s+(\d+)/);
  if (!versionCodeMatch) {
    throw new Error("Could not find versionCode in android/app/build.gradle");
  }
  const currentVersionCode = Number(versionCodeMatch[1]);
  const newVersionCode = currentVersionCode + 1;
  if (!Number.isSafeInteger(newVersionCode) || newVersionCode > 2_100_000_000) {
    throw new Error("Android versionCode cannot exceed 2100000000.");
  }
  if (!appJson.expo || typeof appJson.expo !== "object") {
    throw new Error("app.json is missing expo config");
  }
  if (!/versionName\s+"[^"]+"/.test(gradleContent)) {
    throw new Error("Could not find versionName in android/app/build.gradle");
  }
  let updatedGradle = gradleContent.replace(
    /versionName\s+"[^"]+"/,
    `versionName "${newVersion}"`
  );
  updatedGradle = updatedGradle.replace(
    /versionCode\s+\d+/,
    `versionCode ${newVersionCode}`
  );
  const notes = [
    [path.join(root, "release-notes", `${newVersion}.md`), "<!-- RELEASE_NOTES_TODO: Replace this comment with GitHub release notes (changes, fixes, and links). -->\n"],
    [path.join(root, "fastlane/metadata/android/en-US/changelogs", `${newVersionCode}.txt`), "RELEASE_NOTES_TODO: Describe user-visible changes for Google Play (maximum 500 characters).\n"],
  ];
  for (const [filename, template] of notes) {
    fs.mkdirSync(path.dirname(filename), { recursive: true });
    if (!fs.existsSync(filename)) fs.writeFileSync(filename, template, { encoding: "utf8", flag: "wx" });
  }
  packageJson.version = newVersion;
  appJson.expo.version = newVersion;
  writeJson(packageJsonPath, packageJson);
  writeJson(appJsonPath, appJson);
  fs.writeFileSync(gradlePath, updatedGradle, "utf8");

  console.log(`Version updated: ${currentVersion} -> ${newVersion}`);
  console.log(`Android versionCode: ${currentVersionCode} -> ${newVersionCode}`);
  console.log(`GitHub notes: ${path.relative(root, notes[0][0])}`);
  console.log(`Play notes: ${path.relative(root, notes[1][0])}`);
  console.log("Fill in the release notes before committing and starting a release. Existing notes are preserved.");
  return { name: newVersion, code: newVersionCode };
}

module.exports = { bumpVersion };
if (require.main === module) {
  try {
    bumpVersion({ arg: process.argv[2] });
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
