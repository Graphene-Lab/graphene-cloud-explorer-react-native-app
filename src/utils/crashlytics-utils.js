import firebase from '@react-native-firebase/app';

const getCrashlyticsInstance = () => {
  try {
    // Throws if no [DEFAULT] app exists in the current native runtime.
    firebase.app();
    // eslint-disable-next-line no-undef
    const crashlytics = require('@react-native-firebase/crashlytics').default;
    return crashlytics();
  } catch {
    return null;
  }
};

/**
 * Sanitize any thrown value into a plain Error object that Firebase
 * Crashlytics on Android can always serialize.
 *
 * Problem: Axios errors extend Error but carry circular-reference fields
 * (.config, .request, .response) that break Crashlytics' Android JSON
 * parser, producing the non-fatal:
 *   "io.invertase.firebase.crashlytics.UnhandledPromiseRejection:
 *    Cannot parse given Error object"
 *
 * Solution: detect Axios errors via the `isAxiosError` flag and flatten
 * all complex fields into a plain string message before handing off to
 * Crashlytics.
 */
export const sanitizeError = (error) => {
  if (!error) return new Error('Unknown error (null/undefined)');

  // Axios errors carry circular-reference fields (.config, .request,
  // .response) that break Crashlytics' Android JSON parser.
  if (error.isAxiosError) {
    const status = error.response?.status ?? 'no-response';
    const statusText = error.response?.statusText ?? '';
    const url = error.config?.url ?? 'unknown-url';
    const method = (error.config?.method ?? 'unknown').toUpperCase();
    const msg = `AxiosError [${method} ${url}] HTTP ${status} ${statusText}: ${error.message}`;
    const clean = new Error(msg);
    clean.name = 'AxiosError';
    clean.stack = error.stack ?? clean.stack;
    return clean;
  }

  // Non-Error thrown values (strings, numbers, plain objects, DOMException…)
  if (!(error instanceof Error)) {
    try {
      return new Error(JSON.stringify(error));
    } catch {
      return new Error(String(error));
    }
  }

  return error;
};

/**
 * Record a non-fatal error to Firebase Crashlytics with optional string
 * attributes. All attribute values are coerced to strings so the native
 * bridge never receives a non-serializable value.
 *
 * @param {unknown} error  - Any thrown value (Error, AxiosError, string…)
 * @param {object}  attrs  - Key/value pairs to attach as Crashlytics attributes
 */
export const reportCrash = (error, attrs = {}) => {
  const normalizedError = sanitizeError(error);
  const crashlyticsInstance = getCrashlyticsInstance();

  if (!crashlyticsInstance) {
    return;
  }

  const normalizedAttrs = Object.keys(attrs).reduce((acc, key) => {
    const value = attrs[key];
    if (value !== undefined && value !== null) acc[key] = String(value);
    return acc;
  }, {});

  try {
    crashlyticsInstance.setAttributes(normalizedAttrs);
    crashlyticsInstance.recordError(normalizedError);
  } catch {
    // Intentionally swallow crash-reporting failures to prevent secondary crashes
    // during app error handling.
  }
};
