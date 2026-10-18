import React from 'react';
import { AppState } from 'react-native';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react-native';
import { configureStore } from '@reduxjs/toolkit';
import { Provider } from 'react-redux';
import { useIsFocused, useNavigation } from '@react-navigation/native';
import * as AuthSession from 'expo-auth-session';
import * as Linking from 'expo-linking';
import * as SecureStore from 'expo-secure-store';
import axios from 'axios';
import SignInUp from '../../src/components/SignInUp';
import userSecretReducer from '../../src/reducers/userSecretDataReducer';
import { paymentApiClient } from '../../src/utils/apiClient';
import { finalizeAuthentication } from '../../src/utils/essential-functions';
import { reportCrash } from '../../src/utils/crashlytics-utils';
import english from '../../src/i18n/locales/en.json';

jest.mock('axios', () => ({ get: jest.fn(), post: jest.fn() }));
jest.mock('../../src/utils/apiClient', () => ({
  paymentApiClient: { get: jest.fn(), post: jest.fn() },
}));
jest.mock('../../src/utils/essential-functions', () => ({ finalizeAuthentication: jest.fn() }));
jest.mock('../../src/utils/crashlytics-utils', () => ({ reportCrash: jest.fn() }));
jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(), setItemAsync: jest.fn(), deleteItemAsync: jest.fn(),
}));
jest.mock('expo-web-browser', () => ({ maybeCompleteAuthSession: jest.fn() }));
jest.mock('expo-auth-session', () => ({
  makeRedirectUri: jest.fn(() => 'com.graphenelab.cloudexplorer://'),
  useAuthRequest: jest.fn(),
}));
jest.mock('expo-linking', () => ({
  openURL: jest.fn(), getInitialURL: jest.fn(),
  parse: jest.fn(url => ({ queryParams: Object.fromEntries(new URL(url).searchParams) })),
}));
jest.mock('@react-navigation/native', () => ({ useNavigation: jest.fn(), useIsFocused: jest.fn() }));
jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key, values = {}) => {
      const translations = require('../../src/i18n/locales/en.json');
      const message = key.split('.').reduce((entry, part) => entry?.[part], translations);
      if (typeof message !== 'string') throw new Error(`Missing test translation: ${key}`);
      return message.replace(/\{\{(\w+)\}\}/g, (_, name) => values[name]);
    },
  }),
}));

const NOW = Date.parse('2026-10-18T12:00:00Z');
const originalAppState = AppState.currentState;
const STATUS = 'me/cloud-space/status';
const CREDENTIALS = 'me/cloud-space/credentials';
const RETRY = 'me/cloud-space/retry';
const credentials = { pin: 'test-pin', qrEncrypted: 'test-encrypted-qr' };
const ready = { status: 'READY', attempts: 1, retryable: false };
const pending = { status: 'PENDING', attempts: 0, retryable: true };
const inProgress = { ...pending, status: 'IN_PROGRESS', attempts: 1 };
const scheduled = {
  status: 'RETRY_SCHEDULED', attempts: 1, retryable: true,
  errorCode: 'CLOUD_SPACE_REQUEST_FAILED', nextRetryAt: new Date(NOW + 60000).toISOString(),
};
const exhausted = {
  status: 'FAILED', attempts: 5, retryable: false,
  errorCode: 'CLOUD_SPACE_RETRY_LIMIT_REACHED', nextRetryAt: null,
};
const permanent = { ...exhausted, attempts: 1, errorCode: 'CLOUD_SPACE_REQUEST_REJECTED' };
const response = (data, headers = {}) => ({ data, headers });
const failure = (status, data = {}) => Object.assign(new Error('Request failed'), {
  response: { status, data, headers: {} },
});
const deferred = () => {
  let resolve;
  let reject;
  const promise = new Promise((done, fail) => { resolve = done; reject = fail; });
  return { promise, resolve, reject };
};

let session;
let navigation;
let appListeners;
let promptAsync;

// Empty async act drains session restoration, controller requests, and React effects
// without advancing polling timers or depending on real wall-clock delays.
const settle = async () => { await act(async () => {}); };
const advance = async (ms) => { await act(async () => { await jest.advanceTimersByTimeAsync(ms); }); };
const press = async (text) => { await act(async () => { fireEvent.press(screen.getByText(text)); }); };
const appState = async (state) => {
  await act(async () => { for (const listener of appListeners) listener(state); });
};
const show = async (route) => {
  const store = configureStore({
    reducer: { userSecret: userSecretReducer },
    preloadedState: { userSecret: { loginError: true, wait: true, zeroKnowledgePrompted: true } },
  });
  const tree = () => <Provider store={store}><SignInUp route={route} /></Provider>;
  const view = render(tree());
  await settle();
  return { ...view, store, refresh: async () => { view.rerender(tree()); await settle(); } };
};
const statusSequence = (...states) => {
  paymentApiClient.get.mockImplementation(async (path) => {
    if (path === CREDENTIALS) return response(credentials);
    if (path !== STATUS || states.length === 0) throw new Error(`Unexpected GET: ${path}`);
    return response(states.shift());
  });
};
const expectExistingSession = () => {
  expect(session.get('accessToken')).toBe('existing-access');
  expect(session.get('refreshToken')).toBe('existing-refresh');
  expect(SecureStore.setItemAsync).not.toHaveBeenCalled();
  expect(SecureStore.deleteItemAsync).not.toHaveBeenCalled();
  expect(axios.post).not.toHaveBeenCalled();
  expect(promptAsync).not.toHaveBeenCalled();
};

beforeEach(() => {
  jest.useFakeTimers({ now: NOW });
  session = new Map([
    ['isAuth', 'true'], ['accessToken', 'existing-access'], ['refreshToken', 'existing-refresh'],
  ]);
  SecureStore.getItemAsync.mockImplementation(async key => session.get(key) ?? null);
  SecureStore.setItemAsync.mockImplementation(async (key, value) => { session.set(key, value); });
  SecureStore.deleteItemAsync.mockImplementation(async key => { session.delete(key); });
  navigation = { goBack: jest.fn(), replace: jest.fn() };
  useNavigation.mockReturnValue(navigation);
  useIsFocused.mockReturnValue(true);
  // Expo's preset supplies a function here; the device API supplies a string.
  AppState.currentState = 'active';
  appListeners = new Set();
  jest.spyOn(AppState, 'addEventListener').mockImplementation((event, listener) => {
    expect(event).toBe('change');
    appListeners.add(listener);
    return { remove: jest.fn(() => appListeners.delete(listener)) };
  });
  promptAsync = jest.fn().mockResolvedValue({ type: 'opened' });
  AuthSession.useAuthRequest.mockReturnValue([null, null, promptAsync]);
  Linking.openURL.mockResolvedValue(undefined);
  Linking.getInitialURL.mockResolvedValue(null);
  finalizeAuthentication.mockResolvedValue(true);
  for (const client of [paymentApiClient, axios]) {
    for (const method of ['get', 'post']) {
      client[method].mockReset().mockImplementation((path) => {
        throw new Error(`Unconfigured ${method.toUpperCase()} request: ${path}`);
      });
    }
  }
});

afterEach(() => {
  cleanup();
  AppState.currentState = originalAppState;
  expect(appListeners.size).toBe(0);
  jest.clearAllTimers();
  jest.useRealTimers();
});

test('READY fetches credentials and starts existing pairing exactly once across resume', async () => {
  statusSequence(ready);
  await show();
  expect(screen.getByText(english.signin.initializing_key)).toBeOnTheScreen();
  expect(paymentApiClient.get.mock.calls.map(([path]) => path)).toEqual([STATUS, CREDENTIALS]);
  expect(finalizeAuthentication).toHaveBeenCalledTimes(1);
  expect(finalizeAuthentication).toHaveBeenCalledWith(credentials.pin, credentials.qrEncrypted);
  await appState('background');
  await appState('active');
  await advance(60000);
  expect(paymentApiClient.get).toHaveBeenCalledTimes(2);
  expect(finalizeAuthentication).toHaveBeenCalledTimes(1);
  expect(paymentApiClient.post).not.toHaveBeenCalled();
  expectExistingSession();
});

test('PENDING and IN_PROGRESS show preparation, poll, then pair when READY', async () => {
  statusSequence(pending, inProgress, ready);
  await show();
  expect(screen.getByText(english.signin.storage_initializing)).toBeOnTheScreen();
  expect(screen.getByRole('progressbar')).toBeOnTheScreen();
  await advance(4999);
  expect(paymentApiClient.get).toHaveBeenCalledTimes(1);
  await advance(1);
  expect(screen.getByText(english.signin.storage_initializing)).toBeOnTheScreen();
  expect(finalizeAuthentication).not.toHaveBeenCalled();
  await advance(5000);
  expect(screen.getByText(english.signin.initializing_key)).toBeOnTheScreen();
  expect(finalizeAuthentication).toHaveBeenCalledTimes(1);
  expect(paymentApiClient.get.mock.calls.map(([path]) => path)).toEqual([STATUS, STATUS, STATUS, CREDENTIALS]);
  expect(paymentApiClient.post).not.toHaveBeenCalled();
});

test('long preparation replaces the continuous spinner with the longer-wait message', async () => {
  paymentApiClient.get.mockResolvedValue(response(inProgress));
  await show();
  await advance(45000);
  expect(screen.getByText(english.signin.storage_taking_longer)).toBeOnTheScreen();
  expect(screen.queryByRole('progressbar')).toBeNull();
  expect(screen.getByText(english.signin.back)).toBeOnTheScreen();
  expect(paymentApiClient.post).not.toHaveBeenCalled();
});

test('RETRY_SCHEDULED shows the failure and next retry time without a spinner or retry POST', async () => {
  statusSequence(scheduled, ready);
  await show();
  const time = new Date(scheduled.nextRetryAt).toLocaleTimeString();
  expect(screen.getByText(english.signin.storage_retry_scheduled)).toBeOnTheScreen();
  expect(screen.getByText(english.signin.storage_retry_at.replace('{{time}}', time))).toBeOnTheScreen();
  expect(screen.queryByRole('progressbar')).toBeNull();
  expect(screen.queryByText(english.signin.try_again)).toBeNull();
  await advance(29999);
  expect(paymentApiClient.get).toHaveBeenCalledTimes(1);
  await advance(1);
  expect(finalizeAuthentication).toHaveBeenCalledTimes(1);
  expect(paymentApiClient.post).not.toHaveBeenCalled();
});

test('exhaustion stops polling; pressing Try again sends one retry POST and displays its result', async () => {
  statusSequence(exhausted);
  const retry = deferred();
  paymentApiClient.post.mockReturnValue(retry.promise);
  await show();
  expect(screen.getByText(english.signin.storage_retry_limit)).toBeOnTheScreen();
  expect(screen.queryByRole('progressbar')).toBeNull();
  await advance(3600000);
  expect(paymentApiClient.get).toHaveBeenCalledTimes(1);
  const retryButton = screen.getByText(english.signin.try_again);
  await act(async () => { fireEvent.press(retryButton); fireEvent.press(retryButton); });
  expect(paymentApiClient.post).toHaveBeenCalledTimes(1);
  expect(paymentApiClient.post).toHaveBeenCalledWith(RETRY, null, {
    timeout: 15000, signal: expect.any(AbortSignal),
  });
  expect(screen.getByText(english.signin.storage_checking)).toBeOnTheScreen();
  expect(screen.queryByText(english.signin.try_again)).toBeNull();
  await act(async () => { retry.resolve(response(pending)); });
  expect(screen.getByText(english.signin.storage_initializing)).toBeOnTheScreen();
  expect(screen.getByRole('progressbar')).toBeOnTheScreen();
  expectExistingSession();
});

test('permanent failure offers Contact support and opens the expected email draft', async () => {
  statusSequence(permanent);
  await show();
  expect(screen.getByText(english.signin.storage_support_required)).toBeOnTheScreen();
  expect(screen.getByText('contact@graphenelab.cloud')).toBeOnTheScreen();
  expect(screen.queryByText(english.signin.try_again)).toBeNull();
  expect(screen.queryByRole('progressbar')).toBeNull();
  await press(english.signin.contact_support);
  expect(Linking.openURL).toHaveBeenCalledTimes(1);
  expect(Linking.openURL).toHaveBeenCalledWith(
    'mailto:contact@graphenelab.cloud?subject=Graphene%20Cloud%20Explorer%20storage%20setup' +
    '&body=Cloud%20storage%20setup%20failed.%20Reference%3A%20CLOUD_SPACE_REQUEST_REJECTED',
  );
  await advance(3600000);
  expect(paymentApiClient.get).toHaveBeenCalledTimes(1);
  expect(paymentApiClient.post).not.toHaveBeenCalled();
});

test('network failure gives an actionable error; Try again checks status with the existing session', async () => {
  paymentApiClient.get.mockRejectedValueOnce(new Error('Offline'))
    .mockResolvedValueOnce(response(pending));
  const { store } = await show();
  expect(screen.getByText(english.signin.storage_check_failed)).toBeOnTheScreen();
  expect(screen.queryByRole('progressbar')).toBeNull();
  expect(reportCrash).toHaveBeenCalledWith(expect.any(Error), {
    screen: 'SignInUp', flow: 'status', code: undefined, status: undefined,
  });
  await advance(60000);
  expect(paymentApiClient.get).toHaveBeenCalledTimes(1);
  await press(english.signin.try_again);
  expect(screen.getByText(english.signin.storage_initializing)).toBeOnTheScreen();
  expect(paymentApiClient.get.mock.calls.map(([path]) => path)).toEqual([STATUS, STATUS]);
  expect(store.getState().userSecret).toMatchObject({ loginError: false, zeroKnowledgePrompted: false });
  expect(paymentApiClient.post).not.toHaveBeenCalled();
  expectExistingSession();
});

test('an ambiguous retry POST timeout is recovered by a status GET, without repeating the POST', async () => {
  statusSequence(exhausted, scheduled);
  paymentApiClient.post.mockRejectedValue(Object.assign(new Error('Timed out'), { code: 'ECONNABORTED' }));
  await show();
  await press(english.signin.try_again);
  expect(screen.getByText(english.signin.storage_check_failed)).toBeOnTheScreen();
  await advance(60000);
  expect(paymentApiClient.post).toHaveBeenCalledTimes(1);
  expect(paymentApiClient.get).toHaveBeenCalledTimes(1);
  await press(english.signin.try_again);
  expect(screen.getByText(english.signin.storage_retry_scheduled)).toBeOnTheScreen();
  expect(screen.queryByRole('progressbar')).toBeNull();
  expect(paymentApiClient.get.mock.calls.map(([path]) => path)).toEqual([STATUS, STATUS]);
  expect(paymentApiClient.post).toHaveBeenCalledTimes(1);
  expectExistingSession();
});

test.each([
  ['HTTP 401', failure(401)],
  ['rejected refresh token', Object.assign(failure(400), { authenticationExpired: true })],
])('%s shows Sign in again; pressing it cleans the session and replaces the screen', async (_, error) => {
  session.set('oauth_code_verifier', 'saved-verifier');
  session.set('oauth_state', 'saved-state');
  paymentApiClient.get.mockRejectedValue(error);
  const { store } = await show();
  expect(screen.getByText(english.signin.session_expired)).toBeOnTheScreen();
  expect(screen.queryByText(english.signin.try_again)).toBeNull();
  expect(screen.queryByText(english.signin.switch_account)).toBeNull();
  await press(english.signin.sign_in_again);
  expect(SecureStore.deleteItemAsync.mock.calls.map(([key]) => key).sort()).toEqual([
    'accessToken', 'isAuth', 'oauth_code_verifier', 'oauth_state', 'refreshToken',
  ]);
  expect(session.size).toBe(0);
  expect(store.getState().userSecret).toMatchObject({ loginError: false, wait: false });
  expect(navigation.replace).toHaveBeenCalledWith('SignInUp');
  await advance(60000);
  expect(paymentApiClient.get).toHaveBeenCalledTimes(1);
  expect(finalizeAuthentication).not.toHaveBeenCalled();
});

test('backgrounding cancels an in-flight poll; resume ignores its stale READY result', async () => {
  const stale = deferred();
  paymentApiClient.get.mockResolvedValueOnce(response(pending))
    .mockReturnValueOnce(stale.promise).mockResolvedValueOnce(response(permanent));
  await show();
  await advance(5000);
  const options = paymentApiClient.get.mock.calls[1][1];
  await appState('background');
  expect(options.signal.aborted).toBe(true);
  await advance(60000);
  expect(paymentApiClient.get).toHaveBeenCalledTimes(2);
  await appState('active');
  expect(screen.getByText(english.signin.storage_support_required)).toBeOnTheScreen();
  await act(async () => { stale.resolve(response(ready)); });
  expect(screen.getByText(english.signin.storage_support_required)).toBeOnTheScreen();
  expect(paymentApiClient.get).toHaveBeenCalledTimes(3);
  expect(finalizeAuthentication).not.toHaveBeenCalled();
});

test('losing focus stops pending timers; refocusing checks immediately', async () => {
  statusSequence(pending, ready);
  const view = await show();
  useIsFocused.mockReturnValue(false);
  await view.refresh();
  await advance(60000);
  expect(paymentApiClient.get).toHaveBeenCalledTimes(1);
  useIsFocused.mockReturnValue(true);
  await view.refresh();
  expect(finalizeAuthentication).toHaveBeenCalledTimes(1);
  expect(paymentApiClient.get.mock.calls.map(([path]) => path)).toEqual([STATUS, STATUS, CREDENTIALS]);
});

test('resuming while pairing is unresolved never starts a second pairing', async () => {
  const pairing = deferred();
  statusSequence(ready);
  finalizeAuthentication.mockReturnValue(pairing.promise);
  await show();
  expect(finalizeAuthentication).toHaveBeenCalledTimes(1);
  await appState('background');
  await appState('active');
  await advance(10000);
  expect(paymentApiClient.get).toHaveBeenCalledTimes(2);
  expect(finalizeAuthentication).toHaveBeenCalledTimes(1);
  await act(async () => { pairing.resolve(true); });
  await appState('background');
  await appState('active');
  expect(finalizeAuthentication).toHaveBeenCalledTimes(1);
});

test('unmount aborts credential loading and ignores its late response', async () => {
  const late = deferred();
  paymentApiClient.get.mockResolvedValueOnce(response(ready)).mockReturnValueOnce(late.promise);
  const view = await show();
  const options = paymentApiClient.get.mock.calls[1][1];
  view.unmount();
  expect(options.signal.aborted).toBe(true);
  await act(async () => { late.resolve(response(credentials)); });
  await advance(60000);
  expect(finalizeAuthentication).not.toHaveBeenCalled();
  expect(paymentApiClient.get).toHaveBeenCalledTimes(2);
  expect(appListeners.size).toBe(0);
});

test('unmounting during preparation cancels future status polls', async () => {
  statusSequence(pending);
  const view = await show();
  expect(screen.getByText(english.signin.storage_initializing)).toBeOnTheScreen();
  view.unmount();
  await advance(60000);
  expect(paymentApiClient.get).toHaveBeenCalledTimes(1);
  expect(paymentApiClient.post).not.toHaveBeenCalled();
  expect(finalizeAuthentication).not.toHaveBeenCalled();
});

test('Back stops automatic polling and navigates away', async () => {
  statusSequence(pending);
  await show();
  await press(english.signin.back);
  expect(navigation.goBack).toHaveBeenCalledTimes(1);
  await advance(60000);
  expect(paymentApiClient.get).toHaveBeenCalledTimes(1);
  expect(finalizeAuthentication).not.toHaveBeenCalled();
});

test('a ready account on an older backend pairs via the credentials fallback', async () => {
  paymentApiClient.get.mockRejectedValueOnce(failure(404)).mockResolvedValueOnce(response(credentials));
  await show();
  expect(screen.getByText(english.signin.initializing_key)).toBeOnTheScreen();
  expect(paymentApiClient.get.mock.calls.map(([path]) => path)).toEqual([STATUS, CREDENTIALS]);
  expect(finalizeAuthentication).toHaveBeenCalledTimes(1);
});

test('fresh email sign-in opens OAuth, exchanges its callback once, and checks storage', async () => {
  session.clear();
  const request = { codeVerifier: 'browser-verifier', state: 'browser-state' };
  const discovery = {
    authorization_endpoint: 'https://test.invalid/authorize', token_endpoint: 'https://test.invalid/token',
  };
  AuthSession.useAuthRequest.mockImplementation((config, endpoints) => [endpoints ? request : null, null, promptAsync]);
  axios.get.mockResolvedValue(response(discovery));
  axios.post.mockResolvedValue(response({ access_token: 'new-access', refresh_token: 'new-refresh' }));
  statusSequence(ready);
  const view = await show();
  expect(screen.getByText(english.signin.connecting_keycloak)).toBeOnTheScreen();
  expect(promptAsync).toHaveBeenCalledTimes(1);
  expect(session.get('oauth_code_verifier')).toBe(request.codeVerifier);
  expect(session.get('oauth_state')).toBe(request.state);
  expect(paymentApiClient.get).not.toHaveBeenCalled();
  const callback = { type: 'success', params: { code: 'browser-code' } };
  AuthSession.useAuthRequest.mockReturnValue([request, callback, promptAsync]);
  await view.refresh();
  expect(axios.post).toHaveBeenCalledTimes(1);
  const [tokenUrl, body, options] = axios.post.mock.calls[0];
  expect(tokenUrl).toBe('https://id.graphenelab.cloud/realms/cloud/protocol/openid-connect/token');
  expect(Object.fromEntries(new URLSearchParams(body))).toEqual({
    client_id: 'cloud-mobile-app', code: 'browser-code',
    redirect_uri: 'com.graphenelab.cloudexplorer://redirect',
    grant_type: 'authorization_code', code_verifier: request.codeVerifier,
  });
  expect(options).toMatchObject({ timeout: 15000, signal: expect.any(AbortSignal) });
  expect(session.get('accessToken')).toBe('new-access');
  expect(session.get('refreshToken')).toBe('new-refresh');
  expect(session.get('isAuth')).toBe('true');
  expect(session.has('oauth_code_verifier')).toBe(false);
  expect(session.has('oauth_state')).toBe(false);
  expect(screen.getByText(english.signin.initializing_key)).toBeOnTheScreen();
  expect(finalizeAuthentication).toHaveBeenCalledTimes(1);
  // A fresh response object carrying the same callback must not repeat exchange.
  AuthSession.useAuthRequest.mockReturnValue([request, { ...callback }, promptAsync]);
  await view.refresh();
  expect(axios.post).toHaveBeenCalledTimes(1);
  expect(promptAsync).toHaveBeenCalledTimes(1);
  expect(finalizeAuthentication).toHaveBeenCalledTimes(1);
});

test('an OAuth redirect uses its saved verifier and continues preparation without reopening the browser', async () => {
  session.clear();
  session.set('oauth_code_verifier', 'redirect-verifier');
  session.set('oauth_state', 'redirect-state');
  axios.post.mockResolvedValue(response({ access_token: 'redirect-access', refresh_token: 'redirect-refresh' }));
  statusSequence(pending);
  await show({ params: {
    isRedirect: true,
    redirectUrl: 'com.graphenelab.cloudexplorer://redirect?code=redirect-code&state=redirect-state',
  } });
  expect(axios.post).toHaveBeenCalledTimes(1);
  expect(new URLSearchParams(axios.post.mock.calls[0][1]).get('code_verifier')).toBe('redirect-verifier');
  expect(screen.getByText(english.signin.storage_initializing)).toBeOnTheScreen();
  expect(axios.get).not.toHaveBeenCalled();
  expect(promptAsync).not.toHaveBeenCalled();
  expect(paymentApiClient.get).toHaveBeenCalledTimes(1);
});

test('a redirect with a mismatched OAuth state offers Sign in again without exchanging the code', async () => {
  session.clear();
  session.set('oauth_code_verifier', 'redirect-verifier');
  session.set('oauth_state', 'expected-state');
  await show({ params: {
    isRedirect: true,
    redirectUrl: 'com.graphenelab.cloudexplorer://redirect?code=redirect-code&state=wrong-state',
  } });
  expect(screen.getByText(english.signin.login_service_failed)).toBeOnTheScreen();
  expect(screen.getByText(english.signin.sign_in_again)).toBeOnTheScreen();
  expect(axios.post).not.toHaveBeenCalled();
  expect(paymentApiClient.get).not.toHaveBeenCalled();
  await press(english.signin.sign_in_again);
  expect(session.size).toBe(0);
  expect(navigation.replace).toHaveBeenCalledWith('SignInUp');
});
