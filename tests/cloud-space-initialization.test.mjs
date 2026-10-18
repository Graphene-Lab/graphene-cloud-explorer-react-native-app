import test from 'node:test';
import assert from 'node:assert/strict';
import { createCloudSpaceInitialization, getCloudSpacePollDelay } from '../src/utils/cloud-space-initialization.js';

const NOW = Date.parse('2026-10-18T12:00:00Z');
const ready = { status: 'READY', attempts: 1, retryable: false };
const pending = { status: 'PENDING', attempts: 0, retryable: true };
const scheduled = { status: 'RETRY_SCHEDULED', attempts: 1, retryable: true, nextRetryAt: new Date(NOW + 60000).toISOString() };
const exhausted = { status: 'FAILED', attempts: 5, retryable: false, errorCode: 'CLOUD_SPACE_RETRY_LIMIT_REACHED', nextRetryAt: null };
const permanent = { status: 'FAILED', attempts: 1, retryable: false, errorCode: 'CLOUD_SPACE_REQUEST_REJECTED' };
const credentials = { pin: 'test-pin', qrEncrypted: 'test-qr' };
const response = (data, headers = {}) => ({ data, headers });
const failure = (status, data, headers = {}) => Object.assign(new Error('Request failed'), { response: { status, data, headers } });
const settle = () => new Promise(resolve => setImmediate(resolve));
const deferred = () => {
  let resolve;
  const promise = new Promise(done => { resolve = done; });
  return { promise, resolve };
};

const harness = (t, { get = () => response(pending), post = () => response(pending), pair = () => true } = {}) => {
  t.mock.timers.enable({ apis: ['setTimeout', 'Date'], now: NOW });
  const calls = [];
  const states = [];
  const paired = [];
  const flow = createCloudSpaceInitialization({
    apiClient: {
      async get (path, options) { calls.push({ method: 'GET', path, options }); return get(path, calls.length); },
      async post (path, body, options) { calls.push({ method: 'POST', path, options }); return post(path, body); },
    },
    onChange: state => states.push(state),
    onReady: async data => { paired.push(data); return pair(data); },
  });
  t.after(() => flow.dispose());
  return { flow, calls, states, paired, phase: () => states.at(-1)?.phase };
};

test('ready storage fetches credentials and pairs once, including after foreground resume', async t => {
  const h = harness(t, { get: path => response(path.endsWith('/credentials') ? credentials : ready) });
  await h.flow.start();
  h.flow.stop();
  await h.flow.start();
  assert.equal(h.phase(), 'complete');
  assert.deepEqual(h.paired, [credentials]);
  assert.equal(h.calls.length, 2);
  assert(h.calls.every(call => call.options.timeout === 15000 && call.options.signal));
});

test('pending status polls until ready without posting an initialization request', async t => {
  let count = 0;
  const h = harness(t, { get: path => response(path.endsWith('/credentials') ? credentials : ++count === 1 ? pending : ready) });
  await h.flow.start();
  assert.equal(h.phase(), 'initializing');
  t.mock.timers.tick(5000);
  await settle();
  assert.equal(h.phase(), 'complete');
  assert(h.calls.every(call => call.method === 'GET'));
});

test('scheduled retries display a waiting state and check status without bypassing the backend delay', async t => {
  const h = harness(t, { get: () => response(scheduled) });
  await h.flow.start();
  assert.equal(h.phase(), 'scheduled');
  t.mock.timers.tick(29999);
  await settle();
  assert.equal(h.calls.length, 1);
  t.mock.timers.tick(1);
  await settle();
  assert.equal(h.calls.length, 2);
  assert(h.calls.every(call => call.method === 'GET'));
});

test('automatic retry exhaustion stops polling but permits one explicit new round', async t => {
  const h = harness(t, { get: () => response(exhausted) });
  await h.flow.start();
  assert.equal(h.phase(), 'retry_limit');
  t.mock.timers.tick(3600000);
  await settle();
  assert.equal(h.calls.length, 1);
  await h.flow.retry();
  assert.equal(h.phase(), 'initializing');
  assert.equal(h.calls.filter(call => call.method === 'POST').length, 1);
  assert.equal(h.calls.at(-1).path, 'me/cloud-space/retry');
});

test('permanent failures stop polling and cannot be manually retried', async t => {
  const h = harness(t, { get: () => response(permanent) });
  await h.flow.start();
  assert.equal(h.phase(), 'support');
  await h.flow.retry();
  t.mock.timers.tick(3600000);
  await settle();
  assert.equal(h.calls.length, 1);
});

test('missing credentials on an assigned space requires support when reported by the backend', async t => {
  const h = harness(t, { get: () => response({ ...permanent, errorCode: 'CLOUD_SPACE_CREDENTIALS_MISSING' }) });
  await h.flow.start();
  await h.flow.retry();
  assert.equal(h.phase(), 'support');
  assert.equal(h.calls.length, 1);
});

test('repeated retry clicks cannot submit competing requests', async t => {
  const wait = deferred();
  const h = harness(t, { get: () => response(exhausted), post: () => wait.promise });
  await h.flow.start();
  const retry = h.flow.retry();
  await h.flow.retry();
  assert.equal(h.phase(), 'requesting_retry');
  assert.equal(h.calls.filter(call => call.method === 'POST').length, 1);
  wait.resolve(response(pending));
  await retry;
  assert.equal(h.phase(), 'initializing');
});

test('a manual retry refused by the server switches to support and disables further retry', async t => {
  const h = harness(t, { get: () => response(exhausted), post: () => { throw failure(409, { setup: permanent }); } });
  await h.flow.start();
  await h.flow.retry();
  assert.equal(h.phase(), 'support');
  await h.flow.retry();
  assert.equal(h.calls.length, 2);
});

test('a timed-out retry is not repeated automatically; checking again reconciles server state', async t => {
  let count = 0;
  const h = harness(t, {
    get: () => response(++count === 1 ? exhausted : pending),
    post: () => { throw Object.assign(new Error('Timeout'), { code: 'ECONNABORTED' }); },
  });
  await h.flow.start();
  await h.flow.retry();
  assert.equal(h.phase(), 'request_error');
  t.mock.timers.tick(3600000);
  await settle();
  assert.equal(h.calls.length, 2);
  await h.flow.check();
  assert.equal(h.phase(), 'initializing');
  assert.equal(h.calls.filter(call => call.method === 'POST').length, 1);
});

test('a network failure gives an actionable error and no endless polling', async t => {
  const h = harness(t, { get: () => { throw new Error('Network unavailable'); } });
  await h.flow.start();
  assert.equal(h.phase(), 'request_error');
  t.mock.timers.tick(3600000);
  await settle();
  assert.equal(h.calls.length, 1);
});

test('expired login sessions request sign-in, including a rejected refresh token', async t => {
  for (const error of [failure(401, {}), Object.assign(failure(400, {}), { authenticationExpired: true })]) {
    const h = harnessForError(error);
    await h.flow.start();
    assert.equal(h.phase(), 'session_expired');
    h.flow.dispose();
  }
  function harnessForError (error) {
    const states = [];
    const flow = createCloudSpaceInitialization({ apiClient: { get: async () => { throw error; } }, onChange: state => states.push(state), onReady: () => assert.fail('Must not pair') });
    return { flow, phase: () => states.at(-1)?.phase };
  }
});

test('a credentials readiness race honors structured 503 and Retry-After', async t => {
  const h = harness(t, { get: path => {
    if (path.endsWith('/credentials')) throw failure(503, { setup: pending }, { 'retry-after': '12' });
    return response(ready);
  } });
  await h.flow.start();
  assert.equal(h.phase(), 'initializing');
  assert.equal(h.paired.length, 0);
  t.mock.timers.tick(11999);
  await settle();
  assert.equal(h.calls.length, 2);
  t.mock.timers.tick(1);
  await settle();
  assert.equal(h.calls.length, 4);
});

test('malformed success responses never pass empty credentials to pairing', async t => {
  const h = harness(t, { get: path => response(path.endsWith('/credentials') ? { pin: '', qrEncrypted: 'qr' } : ready) });
  await h.flow.start();
  assert.equal(h.phase(), 'request_error');
  assert.equal(h.paired.length, 0);
});

test('unknown status responses produce an error instead of an indefinite spinner', async t => {
  const h = harness(t, { get: () => response({ status: 'UNKNOWN' }) });
  await h.flow.start();
  assert.equal(h.phase(), 'request_error');
  assert.equal(h.calls.length, 1);
});

test('backgrounding aborts requests and late responses cannot trigger pairing', async t => {
  const wait = deferred();
  const h = harness(t, { get: () => wait.promise });
  const running = h.flow.start();
  h.flow.stop();
  assert.equal(h.calls[0].options.signal.aborted, true);
  wait.resolve(response(ready));
  await running;
  assert.equal(h.paired.length, 0);
  assert.equal(h.calls.length, 1);
});

test('foreground resume checks immediately and ignores a previous in-flight response', async t => {
  const wait = deferred();
  let count = 0;
  const h = harness(t, { get: () => ++count === 1 ? wait.promise : response(permanent) });
  const running = h.flow.start();
  h.flow.stop();
  await h.flow.start();
  assert.equal(h.phase(), 'support');
  wait.resolve(response(ready));
  await running;
  assert.equal(h.phase(), 'support');
  assert.equal(h.paired.length, 0);
});

test('disposing cancels future polls and prevents state updates from stale results', async t => {
  const h = harness(t);
  await h.flow.start();
  h.flow.dispose();
  const count = h.states.length;
  t.mock.timers.tick(3600000);
  await settle();
  await h.flow.start();
  assert.equal(h.calls.length, 1);
  assert.equal(h.states.length, count);
});

test('resuming during the pairing prompt does not pair a second time', async t => {
  const wait = deferred();
  const h = harness(t, { get: path => response(path.endsWith('/credentials') ? credentials : ready), pair: () => wait.promise });
  const running = h.flow.start();
  await settle();
  assert.equal(h.phase(), 'pairing');
  h.flow.stop();
  await h.flow.start();
  assert.equal(h.paired.length, 1);
  wait.resolve(true);
  await running;
  assert.equal(h.phase(), 'complete');
  await h.flow.start();
  assert.equal(h.paired.length, 1);
});

test('cancelled pairing can be explicitly retried with the existing login session', async t => {
  let count = 0;
  const h = harness(t, { get: path => response(path.endsWith('/credentials') ? credentials : ready), pair: () => ++count > 1 });
  await h.flow.start();
  assert.equal(h.phase(), 'pairing_error');
  await h.flow.check();
  assert.equal(h.phase(), 'complete');
  assert.equal(h.paired.length, 2);
  assert(h.calls.every(call => call.method === 'GET'));
});

test('Retry-After supports seconds and HTTP dates, with bounded foreground status checks', () => {
  assert.equal(getCloudSpacePollDelay(pending, '12', NOW), 12000);
  assert.equal(getCloudSpacePollDelay(pending, new Date(NOW + 20000).toUTCString(), NOW), 20000);
  assert.equal(getCloudSpacePollDelay(pending, '3600', NOW), 30000);
  assert.equal(getCloudSpacePollDelay(pending, '-1', NOW), 5000);
  assert.equal(getCloudSpacePollDelay(scheduled, undefined, NOW + 58000), 2000);
});


test('ready accounts remain usable with a legacy manager lacking the status endpoint', async t => {
  const h = harness(t, { get: path => {
    if (path.endsWith('/status')) throw failure(404, {});
    return response(credentials);
  } });
  await h.flow.start();
  assert.equal(h.phase(), 'complete');
  assert.deepEqual(h.paired, [credentials]);
  assert.equal(h.calls.length, 2);
});

test('legacy missing storage becomes an actionable error instead of pairing with empty values', async t => {
  const h = harness(t, { get: () => { throw failure(404, { errorCode: 'CLOUD_SPACE_NOT_FOUND' }); } });
  await h.flow.start();
  assert.equal(h.phase(), 'request_error');
  assert.equal(h.paired.length, 0);
  assert.equal(h.calls.length, 2);
});

test('an account conflict without a setup payload requires support', async t => {
  const h = harness(t, { get: () => { throw failure(409, { errorCode: 'USER_NOT_FOUND' }); } });
  await h.flow.start();
  assert.equal(h.phase(), 'support');
  assert.equal(h.states.at(-1).setup.errorCode, 'USER_NOT_FOUND');
});
