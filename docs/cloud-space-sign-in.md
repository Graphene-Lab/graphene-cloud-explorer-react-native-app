# Cloud storage readiness during sign-in

The account-management backend creates storage asynchronously. A successful OAuth login
identifies the account; it does not guarantee that storage is ready for pairing.

## Reading order

1. `src/screens/sign-in/index.js` forwards the actual OAuth callback URL, including warm starts.
2. `src/components/SignInUp/index.js` exchanges the authorization code once, stores the session,
   and resumes an unfinished setup with the existing session. Discovery and token requests
   have 15-second timeouts. The screen preserves the existing zero-knowledge and pairing flow.
3. `src/utils/cloud-space-initialization.js` checks `me/cloud-space/status`. Active setup is
   checked every 5 seconds; scheduled retries are checked within 30 seconds, using
   `nextRetryAt` and `Retry-After` to choose the next check. These are status reads, not
   requests to create storage. Request timeouts are 15 seconds, with a separately bounded
   token refresh when needed.
4. Once READY, the flow fetches the unchanged `{ qrEncrypted, pin }` response and calls
   `finalizeAuthentication`. Credentials must be nonempty. Tokens and credentials are not
   logged by this sign-in flow.
5. `src/utils/apiClient.js` shares a refresh request within the same login session. Refresh
   timeouts preserve the session; rejected refresh tokens require sign-in again. A refresh
   from another account cannot overwrite the currently stored session after its response.

## What the screen shows

| Backend result | Explorer behavior |
| --- | --- |
| PENDING / IN_PROGRESS | Preparation message; polls while the screen is visible. After 45 seconds, replaces the spinner with a longer-wait message. |
| RETRY_SCHEDULED | Explains the failure and shows the next scheduled time; no continuous spinner. |
| FAILED + CLOUD_SPACE_RETRY_LIMIT_REACHED | Try again starts one new bounded round through POST `me/cloud-space/init`. |
| Other FAILED, including missing assigned credentials | Contact support; no initialization retry button. |
| READY | Fetch credentials and continue the existing pairing and encryption setup. |
| Request error / timeout | Show an actionable error. Try again checks status; it does not start another backend round. |
| Expired login session | Sign in again. |

Backend error responses carry their setup status in `response.data.setup`. HTTP 503 and 409
are interpreted using that payload. The backend remains authoritative about retry permission.
Repeated retry clicks cannot start competing requests. If a retry POST times out, the next
user action checks status to discover whether it was accepted; the app does not repeat it
silently. Terminal states stop automatic status polling.

When the screen loses focus or the app backgrounds, pending checks are cancelled and timers
stop. Returning to the foreground checks status immediately. Late cancelled responses cannot
start pairing. Pairing already in progress is not duplicated when the app resumes.

All messages are translated in English, Russian, Spanish, French, and Italian. The support
button opens an email draft to the same address used in Settings; it never sends automatically.

If an older management deployment returns 404 for the status endpoint, Explorer tries the
legacy credentials endpoint. Ready accounts can still pair; missing storage shows an error.

## Verification

Install dependencies with `yarn install --frozen-lockfile`, then run both suites with Node 22
or later from the project root:

```sh
npm run test:auth
npm run test:screens
```

`test:auth` preserves the existing 32 Node tests. It covers state transitions, automatic
versus manual retries, server refusal, timeouts, malformed credentials, foreground recovery,
request cancellation, pairing duplication, token refresh, and legacy endpoint compatibility.

`test:screens` runs Jest in Node with the Expo native mocks. No emulator, testing APK, server,
or customer account is needed. Tests in `tests/screens/sign-in-up.test.js` render the actual
`SignInUp`, its existing buttons and progress indicator, and the real initialization controller.
They use a fresh Redux store with the real user-secret reducer and deterministic English
translations. Management requests, OAuth requests/browser services, SecureStore, navigation,
linking, crash reporting, and `finalizeAuthentication` are mocked. All request mocks are local;
unexpected fetch/HTTP/HTTPS requests are blocked and fail the suite even if the screen catches
their error. The existing API-client suite separately tests real token-refresh behavior.

Screen assertions cover ready/pending/in-progress/scheduled storage, the longer-wait notice,
retry exhaustion and double presses, support email drafts, network recovery with the existing
session, an ambiguous retry POST timeout, expired-session cleanup, background/focus/unmount
cancellation, stale responses, duplicate pairing, Back, legacy-backend fallback, fresh OAuth
sign-in, and redirect verification. Fake timers and controlled promises keep polling and late
responses deterministic; no large snapshots or copies of screen/controller logic are used.

The development dependencies are pinned to Jest 29.7.0, `jest-expo` 55.0.16, React Native
Testing Library 13.3.3, and `react-test-renderer` 19.2.0. Expo 55's preset itself uses that
renderer version, matching this app's React 19.2.0. Keep this SDK-specific combination together;
newer major test-library/Expo versions may require a different renderer. See the
[Expo 55 preset](https://github.com/expo/expo/blob/sdk-55/packages/jest-expo/package.json).
The Jest cache lives under ignored `node_modules/.cache/jest` to work in restricted Windows
environments. Jest only discovers `tests/screens/**/*.test.js`, keeping the Node suites separate.

Before publishing, also run focused ESLint checks and an Android APK build. A successful
bundle or test run does not replace a device sign-in check.

Device checks before publishing:

- A ready account signs in and completes pairing / zero-knowledge prompts normally.
- A pending account shows preparation, then advances when storage becomes READY.
- A scheduled retry shows the backend retry time without keeping a spinner on screen.
- Exhausted attempts show Try again; permanent errors show Contact support.
- Background / foreground and a cold OAuth redirect do not repeat code exchange or pairing.
- Airplane mode produces an error; restoring connectivity and trying again reuses the session.

Do not change production customer records merely to simulate failures. Use mocked responses
or a test backend for the failure-state device checks. Building an APK does not publish it.
