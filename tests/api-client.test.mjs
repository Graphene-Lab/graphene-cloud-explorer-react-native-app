import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
const require = createRequire(import.meta.url);
const axios = require('axios');
const { transformFileSync } = require('@babel/core');
const { code } = transformFileSync(fileURLToPath(new URL('../src/utils/apiClient.js', import.meta.url)), {
  babelrc: false, configFile: false, plugins: ['@babel/plugin-transform-modules-commonjs'],
});
const deferred = () => {
  let resolve;
  const promise = new Promise(done => { resolve = done; });
  return { promise, resolve };
};
const settle = () => new Promise(resolve => setImmediate(resolve));
const tokenResponse = { data: { access_token: 'fresh', refresh_token: 'rotated' } };

const harness = ({ access = 'expired', refresh = 'refresh', token = async () => tokenResponse, request } = {}) => {
  const items = new Map([['accessToken', access], ['refreshToken', refresh], ['isAuth', 'true']]);
  const requests = [];
  const refreshes = [];
  const reports = [];
  const adapter = async config => {
    requests.push(config);
    if (request) return request(config, requests.length);
    return { status: 200, statusText: 'OK', data: {}, headers: {}, config };
  };
  const mocks = {
    axios: {
      create: options => axios.create({ ...options, adapter }),
      post: async (...args) => { refreshes.push(args); return token(...args); },
    },
    'expo-secure-store': {
      getItemAsync: async key => items.get(key) ?? null,
      setItemAsync: async (key, value) => { items.set(key, value); },
    },
    'jwt-decode': { jwtDecode: value => {
      if (value === 'malformed') throw new Error('Invalid token');
      return { exp: value === 'expired' ? 0 : Date.now() / 1000 + 300 };
    } },
    './crashlytics-utils': { reportCrash: (...args) => reports.push(args) },
    './apiClientConfig': { API_SERVICES: { CLOUD: 'cloud', PAYMENT: 'payment' }, SERVICE_CONFIG: { cloud: { baseURL: 'https://cloud.invalid' }, payment: { baseURL: 'https://management.invalid/api' } } },
  };
  const module = { exports: {} };
  vm.runInNewContext(code, { module, exports: module.exports, require: name => {
    assert(name in mocks, `Unexpected import: ${name}`);
    return mocks[name];
  }, URLSearchParams });
  return { client: module.exports.paymentApiClient, cloudClient: module.exports.cloudApiClient, items, requests, refreshes, reports };
};

test('parallel status and cloud requests share one bounded token refresh', async () => {
  const wait = deferred();
  const h = harness({ token: () => wait.promise });
  const requests = [h.client.get('me/cloud-space/status'), h.cloudClient.get('/info')];
  await settle();
  assert.equal(h.refreshes.length, 1);
  assert.equal(h.refreshes[0][2].timeout, 15000);
  wait.resolve(tokenResponse);
  await Promise.all(requests);
  assert(h.requests.every(config => config.headers.Authorization === 'Bearer fresh'));
  assert.equal(h.items.get('refreshToken'), 'rotated');
});

test('a temporary refresh outage preserves the login session and is recoverable', async () => {
  const h = harness({ token: async () => { throw Object.assign(new Error('Timeout'), { code: 'ECONNABORTED' }); } });
  await assert.rejects(h.client.get('me/cloud-space/status'), { code: 'ECONNABORTED' });
  assert.equal(h.items.get('isAuth'), 'true');
  assert.equal(h.requests.length, 0);
  assert.equal(h.reports[0][0].message, 'Access token refresh failed');
  assert.equal(h.reports[0][0].config, undefined);
});

test('a rejected refresh token signals reauthentication without recursively refreshing', async () => {
  const h = harness({ token: async () => { throw Object.assign(new Error('Rejected'), { response: { status: 401 }, config: { data: 'sensitive-token-data' } }); } });
  await assert.rejects(h.client.get('me/cloud-space/status'), error => error.authenticationExpired === true);
  assert.equal(h.refreshes.length, 1);
  assert.equal(h.requests.length, 0);
  assert.equal(h.items.get('isAuth'), 'false');
  assert(!JSON.stringify(h.reports).includes('sensitive-token-data'));
});

test('a missing refresh token requests sign-in without sending an invalid grant', async () => {
  const h = harness({ refresh: null });
  await assert.rejects(h.client.get('me/cloud-space/status'), error => error.authenticationExpired === true);
  assert.equal(h.refreshes.length, 0);
  assert.equal(h.items.get('isAuth'), 'false');
});

test('a malformed stored access token can be recovered by refreshing', async () => {
  const h = harness({ access: 'malformed' });
  await h.client.get('me/cloud-space/status');
  assert.equal(h.requests[0].headers.Authorization, 'Bearer fresh');
});

test('an API 401 refreshes and retries only once while preserving timeout and cancellation', async () => {
  const h = harness({ access: 'initial', request: async config => {
    throw Object.assign(new Error('Unauthorized'), { response: { status: 401 }, config });
  } });
  const controller = new AbortController();
  await assert.rejects(h.client.get('me/cloud-space/status', { timeout: 15000, signal: controller.signal }));
  assert.equal(h.refreshes.length, 1);
  assert.equal(h.requests.length, 2);
  assert(h.requests.every(config => config.timeout === 15000 && config.signal === controller.signal));
});

test('an aborted status check is not sent after token refresh completes', async () => {
  const wait = deferred();
  const h = harness({ token: () => wait.promise });
  const controller = new AbortController();
  const request = h.client.get('me/cloud-space/status', { signal: controller.signal });
  await settle();
  controller.abort();
  wait.resolve(tokenResponse);
  await assert.rejects(request, { code: 'ERR_CANCELED' });
  assert.equal(h.requests.length, 0);
});


test('a late refresh cannot replace tokens after switching accounts', async () => {
  const wait = deferred();
  const h = harness({ token: () => wait.promise });
  const oldRequest = h.client.get('me/cloud-space/status');
  await settle();
  h.items.set('accessToken', 'other-account-access');
  h.items.set('refreshToken', 'other-account-refresh');
  wait.resolve(tokenResponse);
  await assert.rejects(oldRequest, { code: 'ERR_CANCELED' });
  assert.equal(h.items.get('accessToken'), 'other-account-access');
  assert.equal(h.items.get('refreshToken'), 'other-account-refresh');
  assert.equal(h.items.get('isAuth'), 'true');
});

test("a new account does not share the previous account's pending refresh", async () => {
  const old = deferred();
  const next = deferred();
  let count = 0;
  const h = harness({ token: () => ++count === 1 ? old.promise : next.promise });
  const oldRequest = h.client.get('me/cloud-space/status');
  await settle();
  h.items.set('refreshToken', 'new-account-refresh');
  const newRequest = h.client.get('me/cloud-space/status');
  await settle();
  assert.equal(h.refreshes.length, 2);
  next.resolve({ data: { access_token: 'new-account-access', refresh_token: 'new-account-rotated' } });
  await newRequest;
  old.resolve(tokenResponse);
  await assert.rejects(oldRequest, { code: 'ERR_CANCELED' });
  assert.equal(h.items.get('accessToken'), 'new-account-access');
  assert.equal(h.items.get('refreshToken'), 'new-account-rotated');
});
