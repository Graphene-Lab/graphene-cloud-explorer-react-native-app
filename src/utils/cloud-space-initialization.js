const REQUEST_TIMEOUT_MS = 15000;
const STATUS_POLL_MS = 5000;
const SCHEDULED_POLL_MS = 30000;
const RETRY_LIMIT_REACHED = 'CLOUD_SPACE_RETRY_LIMIT_REACHED';
const STATUSES = ['PENDING', 'IN_PROGRESS', 'RETRY_SCHEDULED', 'FAILED', 'READY'];

export const getCloudSpacePollDelay = (setup, retryAfter, now = Date.now()) => {
  let delay = setup.status === 'RETRY_SCHEDULED' ? SCHEDULED_POLL_MS : STATUS_POLL_MS;
  const nextRetry = Date.parse(setup.nextRetryAt);
  if (Number.isFinite(nextRetry) && nextRetry > now) delay = Math.min(delay, nextRetry - now);
  if (retryAfter != null) {
    const seconds = Number(retryAfter);
    const headerDelay = Number.isFinite(seconds) ? seconds * 1000 : Date.parse(retryAfter) - now;
    if (Number.isFinite(headerDelay) && headerDelay > 0) delay = headerDelay;
  }
  return Math.max(1000, Math.min(SCHEDULED_POLL_MS, delay));
};

const isSetup = (setup) => setup && STATUSES.includes(setup.status);
const hasText = (value) => typeof value === 'string' && value.trim().length > 0;

// Owns status checks only. A new initialization round requires an explicit retry() call.
export const createCloudSpaceInitialization = ({ apiClient, onChange, onReady, onError = () => {} }) => {
  let state = { phase: 'checking', setup: null, since: Date.now() };
  let active = false;
  let disposed = false;
  let busy = false;
  let pairing = false;
  let completed = false;
  let timer = null;
  let controller = null;
  let generation = 0;

  const publish = (phase, setup = state.setup) => {
    if (disposed) return;
    const since = phase === state.phase ? state.since : Date.now();
    state = { phase, setup, since };
    onChange(state);
  };

  const clearTimer = () => {
    clearTimeout(timer);
    timer = null;
  };

  const schedule = (setup, headers) => {
    if (!active || disposed) return;
    const delay = getCloudSpacePollDelay(setup, headers?.['retry-after']);
    timer = setTimeout(() => { void run(); }, delay);
  };

  const showSetup = (setup, headers) => {
    if (!isSetup(setup)) throw new Error('Invalid cloud setup response');
    if (setup.status === 'READY') return;
    if (setup.status === 'FAILED') {
      publish(setup.errorCode === RETRY_LIMIT_REACHED ? 'retry_limit' : 'support', setup);
    } else {
      publish(setup.status === 'RETRY_SCHEDULED' ? 'scheduled' : 'initializing', setup);
      schedule(setup, headers);
    }
  };

  const pair = async (credentials) => {
    pairing = true;
    publish('pairing');
    try {
      completed = (await onReady(credentials)) !== false;
      publish(completed ? 'complete' : 'pairing_error');
    } catch (error) {
      publish('pairing_error');
      onError({ flow: 'pairing', code: error?.code, status: error?.response?.status });
    } finally {
      pairing = false;
    }
  };

  const fetchCredentials = async (setup, options, isCurrent) => {
    const credentials = await apiClient.get('me/cloud-space/credentials', options);
    if (!isCurrent()) return;
    if (!hasText(credentials.data?.pin) || !hasText(credentials.data?.qrEncrypted)) {
      throw new Error('Invalid cloud credentials response');
    }
    state = { ...state, setup };
    await pair(credentials.data);
  };

  async function run (manualRetry = false) {
    if (!active || disposed || busy || pairing || completed) return;
    busy = true;
    clearTimer();
    const current = ++generation;
    controller = new AbortController();
    const options = { timeout: REQUEST_TIMEOUT_MS, signal: controller.signal };
    const isCurrent = () => active && !disposed && current === generation;
    if (manualRetry) publish('requesting_retry');
    try {
      let result;
      try {
        result = manualRetry
          ? await apiClient.post('me/cloud-space/retry', null, options)
          : await apiClient.get('me/cloud-space/status', options);
      } catch (error) {
        if (!isCurrent()) return;
        // Keep ready accounts usable if management is rolled back before the status API.
        if (!manualRetry && error?.response?.status === 404) {
          await fetchCredentials({ status: 'READY' }, options, isCurrent);
          return;
        }
        throw error;
      }
      if (!isCurrent()) return;
      const setup = result.data;
      if (!isSetup(setup)) throw new Error('Invalid cloud setup response');
      if (setup.status !== 'READY') {
        showSetup(setup, result.headers);
        return;
      }
      await fetchCredentials(setup, options, isCurrent);
    } catch (error) {
      if (!isCurrent() || error?.code === 'ERR_CANCELED') return;
      const setup = error?.response?.data?.setup;
      if ([409, 503].includes(error?.response?.status) && isSetup(setup) && setup.status !== 'READY') {
        showSetup(setup, error.response.headers);
      } else if (error?.response?.status === 409) {
        publish('support', { status: 'FAILED', errorCode: error.response.data?.errorCode });
      } else if (error?.authenticationExpired || [401, 403].includes(error?.response?.status)) {
        publish('session_expired');
      } else {
        publish('request_error');
        onError({ flow: manualRetry ? 'retry' : 'status', code: error?.code, status: error?.response?.status });
      }
    } finally {
      if (current === generation) {
        busy = false;
        controller = null;
      }
    }
  }

  const stop = () => {
    active = false;
    ++generation;
    clearTimer();
    controller?.abort();
    controller = null;
    busy = false;
  };

  return {
    start () {
      if (disposed) return;
      active = true;
      return run();
    },
    check () {
      if (!active || disposed || busy || pairing) return;
      completed = false;
      publish('checking');
      return run();
    },
    retry () {
      if (state.phase !== 'retry_limit') return;
      return run(true);
    },
    stop,
    dispose () {
      stop();
      disposed = true;
    },
  };
};
