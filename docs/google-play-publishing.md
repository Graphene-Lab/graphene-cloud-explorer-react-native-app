# Google Play publishing

The `Android Google Play` GitHub Actions workflow builds a signed Android App Bundle with Fastlane. A pushed `v*` tag uploads to **internal testing**. Production uses a separate manual promotion of an exact version already tested on the internal track.

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
2. Select branch `master` and action **build**. Tests run and a signed AAB is saved as a workflow artifact. This action does not authenticate to or upload to Google Play.
3. Run action **internal**, entering the successful build's **build_run_id** from its GitHub URL (`actions/runs/<build_run_id>`). This downloads and uploads that signed AAB without compiling again. The source run must have succeeded in this repository's Android Google Play workflow, and its artifact must still be available. The Android versionCode must be unused and greater than existing internal/production versions; an already-published version needs a new versionCode and build.
4. Install the internal build through Google Play and verify the app, including updates from the previous version.
5. Run action **promote**, providing the exact tested **version_code**. This promotes that existing AAB to a completed production release without rebuilding it. Google review and managed-publishing settings still control availability.

The workflow accepts manual release runs from `master` or `v*` tags in this repository. It serializes releases and never automatically promotes to production. Manual internal uploads use package/version information from the selected artifact's original source commit, so newer source edits do not change or relabel that AAB. To publish newer source changes, select a build that contains them.

## Subsequent releases

Before committing a release, increment the version:

```powershell
npm run version:bump
```

This updates `package.json`, `app.json`, and the Android version name/code together. Commit the reviewed changes, then create and push a matching version tag, for example `v1.2.8` for version `1.2.8`. Pushing that tag runs tests, builds the signed AAB, and uploads it to internal testing. Reusing a versionCode is rejected; a failed upload can be retried only if Google Play did not already accept that bundle.

Listing text, screenshots, and release notes remain managed in Play Console; the lanes skip those metadata uploads.

## Runtime and credentials

GitHub provides a fresh Ubuntu 24.04 runner. The workflow uses Node 22, Java 21, Ruby 3.3, Android SDK/build tools 36, and NDK 27.1.12297006, matching the checked-in React Native/Expo Android configuration. Yarn, Gradle, and Bundler dependencies are cached; committed `yarn.lock` and `Gemfile.lock` control dependency versions.

Fastlane requires Ruby 3.2 or later. Existing CocoaPods dependencies remain in the root Gemfile. Install Ruby dependencies with `bundle install`, and invoke lanes with `bundle exec fastlane android <lane>`.

The upload keystore is restored into the runner's temporary directory. Before Android SDK installation or native compilation, a Java preflight opens the keystore, checks that the alias refers to a private key, and unlocks it with the key password. Failures identify the relevant secret names without printing credentials. Passwords are then passed to Gradle through `ORG_GRADLE_PROJECT_APP_UPLOAD_*` environment variables, and Gradle enforces `REQUIRE_RELEASE_SIGNING=true` for the Fastlane release build. Existing local development build commands keep their behavior.

Manual internal uploads require only Ruby, Node, read access to the selected GitHub Actions artifact, and Google authentication. They skip JavaScript dependency installation, Android SDK/NDK setup, signing secrets, and compilation. The artifact download verifies its digest. Tag-triggered releases still build once and upload to internal testing in the same run.

Google authentication runs immediately before publishing. `google-github-actions/auth` exchanges the GitHub OIDC token and creates a short-lived credential configuration for the service account. Fastlane reads that file through `GOOGLE_APPLICATION_CREDENTIALS`; a downloaded service-account private key is not needed. Generated credential files are ignored by Git and excluded from the AAB artifact. The workflow removes the restored keystore and Firebase configuration on completion.

## Focused checks

```powershell
node --test tests/android-publishing.test.mjs tests/play-build-artifact.test.mjs
ruby tests/play_release_test.rb
bundle exec fastlane lanes
```

The focused tests require Java 21+ and keytool. They use temporary keystores and dummy credentials to check actual private-key access, credential restoration, artifact provenance, package/version/tag consistency, and exact-version promotion. Artifact API requests and Google Play actions are mocked; no tests contact Google Play.
