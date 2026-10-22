# Google Play publishing

The `Android Google Play` GitHub Actions workflow is started explicitly from the Actions UI or an npm shortcut. Select **GitHub**, **Play**, or **Both** as the destination. Ordinary commits, version bumps, and tag pushes do not start publishing. Production uses a separate manual promotion of the latest internal version by default, or an explicitly selected internal version.

## Repository configuration

Configure these under GitHub **Settings → Secrets and variables → Actions**.

Repository variables:

| Name | Value |
| --- | --- |
| `GCP_WORKLOAD_IDENTITY_PROVIDER` | `projects/117253714562/locations/global/workloadIdentityPools/github-actions/providers/github` |
| `GCP_SERVICE_ACCOUNT` | `publish-explorer@graphene-play-publishing.iam.gserviceaccount.com` |

Repository secrets:

| Name | Contents |
| --- | --- |
| `ANDROID_UPLOAD_KEYSTORE_BASE64` | Base64 of the existing registered Android upload keystore |
| `APP_UPLOAD_STORE_PASSWORD` | Keystore password |
| `APP_UPLOAD_KEY_ALIAS` | Upload key alias |
| `APP_UPLOAD_KEY_PASSWORD` | Upload key password |
| `GOOGLE_SERVICES_JSON` | Complete `android/app/google-services.json` for `com.graphenelab.cloudexplorer` |

Google project: `graphene-play-publishing`. Enable Google Play Android Developer API, IAM API, Security Token Service API, and IAM Service Account Credentials API in this project.

The `github` OIDC provider maps `google.subject`, `attribute.repository_id`, and `attribute.repository_owner_id` to their corresponding `assertion.*` claims. Its condition is `assertion.repository_owner_id == '264203613'` (Graphene-Lab). Only repository ID `1016678903` has `roles/iam.workloadIdentityUser` on `publish-explorer`. The account has app-specific read, testing-release, and production-release permissions in Google Play Console.

Each additional app should have its own service account, repository filter, Play Console permissions, and upload signing credentials.

## First run

After the workflow files are committed and pushed to `master`:

1. Open **Actions → Android Google Play → Run workflow**.
   Run action **verify** on `master` first to check the signing secrets, Firebase configuration, OIDC authentication, and Google Play track access. It does not compile or publish the app. This verifies read access; release permissions are exercised by an actual upload or promotion.
2. Prepare and push the app changes and version bump to `master` (see **Subsequent releases**). An already-published Android versionCode cannot be uploaded again.
3. Select branch `master`, action **release**, and destination **both**. Tests run first. The workflow validates the app version, creates its version tag, publishes the GitHub Release page, then builds a signed AAB and uploads it to Play internal testing.
4. Install the internal build through Google Play and verify the app, including updates from the previous version.
5. Run action **promote**. Leave **version_code** blank to promote the highest versionCode currently on Google Play's internal track, or enter the exact tested code to select a particular version. This promotes that existing AAB to a completed production release without rebuilding it. Google review and managed-publishing settings still control availability.

The workflow accepts manual release runs from this repository's `master` branch. It serializes releases and never automatically promotes to production.

## Release destinations and shortcuts

The same workflow can be started from the terminal using an authenticated GitHub CLI (`gh`):

| Command | Action |
| --- | --- |
| `npm run release:github` | Create/reuse the version tag and publish the GitHub Release page. No Android build or Play authentication. |
| `npm run release:play` | Create/reuse the version tag, build the AAB, and upload to Play internal testing. No GitHub Release page. |
| `npm run release:both` | Publish GitHub Release first, then build the AAB and upload to Play internal testing. |
| `npm run release:promote` | Promote the latest version currently on Play's internal track to production, without rebuilding. |

In the Actions UI, select **action=release** with **destination=github/play/both**, or **action=promote** for production. The destination input is ignored for the other actions. The npm shortcuts send these inputs to GitHub; they do not build, tag, commit, or publish locally. They use the already-pushed `master` commit on GitHub, not uncommitted or unpushed local changes.

The tag is derived from the validated app version (for example, `v1.2.8`) and records the exact workflow source commit. It does not add a commit or trigger another workflow. An existing lightweight or annotated tag is reused only if it points to that same commit. If the version tag points to different code, the workflow stops; bump the app version before releasing new changes. Existing tags are never moved.

GitHub Releases receive automatically generated notes and source archives. A matching published release is reused without changing its notes; an existing matching draft is published with its notes preserved. In **Both**, failure to publish the GitHub page stops the Android release. If the later build or Play upload fails, the GitHub page remains published; a retry from the same commit reuses it. Signed AABs are saved under the run's Actions artifacts for 14 days; they are not attached to the GitHub Release page.

An explicit internal code can still be selected when promoting:

```powershell
# Promote the latest version currently on Google Play's internal track.
npm run release:promote

# Select a particular internal version instead.
npm run release:promote -- 32
```

The workflow resolves the latest code when it runs, independently of the local app version or GitHub release tags. It logs the selected versionCode and stops if internal is empty or production already contains that code or a newer one. Only run promotion after testing the internal version you intend to publish.

## Build-only and artifact reuse

Run **action=build** to test compilation and save a signed AAB without creating a tag or publishing to GitHub or Google Play.

To upload that exact artifact later, run **action=internal**, entering the successful build's **build_run_id** from its GitHub URL (`actions/runs/<build_run_id>`). This downloads and uploads the signed AAB without compiling again. The source run must have succeeded in this repository's Android Google Play workflow and its artifact must still be available. The versionCode must be unused and greater than existing internal/production versions.

Artifact uploads use package/version information from the selected build's original source commit, so newer source edits do not relabel that AAB. To publish newer changes, choose a build containing them. The build/internal path does not create version tags or GitHub Release pages.

## Subsequent releases

Before committing a release, increment the version:

```powershell
npm run version:bump
```

This updates `package.json`, `app.json`, and the Android version name/code together. Commit the reviewed changes and version bump, then push `master`. Nothing is published by that push. When ready, start the release workflow with the desired destination, for example `npm run release:both`. The workflow creates the tag automatically. Reusing a versionCode is rejected; a failed upload can be retried only if Google Play did not already accept that bundle.

Listing text, screenshots, and release notes remain managed in Play Console; the lanes skip those metadata uploads.

## Runtime and credentials

GitHub provides a fresh Ubuntu 24.04 runner. The workflow uses Node 22, Java 21, Ruby 3.3, Android SDK/build tools 36, and NDK 27.1.12297006, matching the checked-in React Native/Expo Android configuration. Yarn, Gradle, and Bundler dependencies are cached; committed `yarn.lock` and `Gemfile.lock` control dependency versions.

Fastlane requires Ruby 3.2 or later. Existing CocoaPods dependencies remain in the root Gemfile. Install Ruby dependencies with `bundle install`, and invoke lanes with `bundle exec fastlane android <lane>`.

The upload keystore is restored into the runner's temporary directory. Before Android SDK installation or native compilation, a Java preflight opens the keystore, checks that the alias refers to a private key, and unlocks it with the key password. Failures identify the relevant secret names without printing credentials. Passwords are then passed to Gradle through `ORG_GRADLE_PROJECT_APP_UPLOAD_*` environment variables, and Gradle enforces `REQUIRE_RELEASE_SIGNING=true` for the Fastlane release build. Existing local development build commands keep their behavior.

Artifact-based internal uploads require only Ruby, Node, read access to the selected GitHub Actions artifact, and Google authentication. They skip JavaScript dependency installation, Android SDK/NDK setup, signing secrets, and compilation. The artifact download verifies its digest. **Play** and **Both** build once and upload to internal testing in the same run. The release job has `contents: write` to create version tags and GitHub Releases using its built-in `GITHUB_TOKEN`; an additional GitHub secret is not required.

Google authentication runs immediately before publishing. `google-github-actions/auth` exchanges the GitHub OIDC token and creates a short-lived credential configuration for the service account. Fastlane reads that file through `GOOGLE_APPLICATION_CREDENTIALS`; a downloaded service-account private key is not needed. Generated credential files are ignored by Git and excluded from the AAB artifact. The workflow removes the restored keystore and Firebase configuration on completion.

## Focused checks

```powershell
node --test tests/android-publishing.test.mjs tests/play-build-artifact.test.mjs tests/release-workflow-cli.test.mjs tests/release-plan.test.mjs tests/github-release.test.mjs
ruby tests/play_release_test.rb
bundle exec fastlane lanes
```

The focused tests require Java 21+ and keytool. They use temporary keystores and dummy credentials to check actual private-key access, credential restoration, artifact provenance, package/version/tag consistency, latest and exact-version promotion, command dispatch, destination selection, GitHub release ordering, tag conflicts, and retries. GitHub API requests, CLI dispatch, and Google Play actions are mocked; no tests publish anything.
