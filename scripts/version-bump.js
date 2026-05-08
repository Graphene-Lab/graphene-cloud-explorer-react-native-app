#!/usr/bin/env node
const fs = require("fs");
const path = require("path");

const rootDir = path.resolve(__dirname, "..");
const packageJsonPath = path.join(rootDir, "package.json");
const appJsonPath = path.join(rootDir, "app.json");
const gradlePath = path.join(rootDir, "android", "app", "build.gradle");

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

function main() {
  const arg = process.argv[2];

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

  packageJson.version = newVersion;
  writeJson(packageJsonPath, packageJson);

  if (!appJson.expo || typeof appJson.expo !== "object") {
    throw new Error("app.json is missing expo config");
  }
  appJson.expo.version = newVersion;
  writeJson(appJsonPath, appJson);

  let updatedGradle = gradleContent.replace(
    /versionName\s+"[^"]+"/,
    `versionName "${newVersion}"`
  );
  updatedGradle = updatedGradle.replace(
    /versionCode\s+\d+/,
    `versionCode ${newVersionCode}`
  );
  fs.writeFileSync(gradlePath, updatedGradle, "utf8");

  console.log(`Version updated: ${currentVersion} -> ${newVersion}`);
  console.log(`Android versionCode: ${currentVersionCode} -> ${newVersionCode}`);
}

main();
