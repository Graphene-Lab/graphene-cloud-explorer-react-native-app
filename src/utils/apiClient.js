import axios from 'axios';
import * as SecureStore from 'expo-secure-store';
import { jwtDecode } from 'jwt-decode';
import { reportCrash } from './crashlytics-utils';
import { API_SERVICES, SERVICE_CONFIG } from './apiClientConfig';

const AUTH_TIMEOUT_MS = 15000;
let tokenRefresh = null;

const isTokenExpired = (token) => {
  try {
    const decoded = jwtDecode(token);
    return !Number.isFinite(decoded.exp) || decoded.exp * 1000 <= Date.now();
  } catch {
    return true;
  }
};

const refreshAccessToken = async () => {
  const refreshToken = await SecureStore.getItemAsync('refreshToken');
  if (tokenRefresh?.source === refreshToken) return tokenRefresh.promise;
  const sessionChanged = async () => (await SecureStore.getItemAsync('refreshToken')) !== refreshToken;
  const cancelled = () => Object.assign(new Error('Sign-in session changed'), { code: 'ERR_CANCELED' });
  const pending = (async () => {
    try {
      if (!refreshToken) {
        const error = new Error('Sign-in is required');
        error.authenticationExpired = true;
        throw error;
      }
      const response = await axios.post(
        'https://id.graphenelab.cloud/realms/cloud/protocol/openid-connect/token',
        new URLSearchParams({
          client_id: 'cloud-mobile-app',
          grant_type: 'refresh_token',
          refresh_token: refreshToken,
        }).toString(),
        {
          timeout: AUTH_TIMEOUT_MS,
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        }
      );
      const { access_token, refresh_token } = response.data;
      if (!access_token) throw new Error('Missing access token');
      // A late refresh from a previous account must not replace the new account's tokens.
      if (await sessionChanged()) throw cancelled();
      await SecureStore.setItemAsync('accessToken', access_token);
      if (await sessionChanged()) throw cancelled();
      if (refresh_token) await SecureStore.setItemAsync('refreshToken', refresh_token);
      return access_token;
    } catch (error) {
      if (error.code === 'ERR_CANCELED' || await sessionChanged()) throw cancelled();
      if (error.authenticationExpired || [400, 401, 403].includes(error.response?.status)) {
        error.authenticationExpired = true;
        await SecureStore.setItemAsync('isAuth', 'false');
      }
      // Do not pass Axios request data (tokens) to console or crash reporting.
      reportCrash(new Error('Access token refresh failed'), {
        screen: 'ApiClient', flow: 'refreshAccessToken', status: error.response?.status,
      });
      throw error;
    }
  })();
  tokenRefresh = { source: refreshToken, promise: pending };
  try {
    return await pending;
  } finally {
    if (tokenRefresh?.promise === pending) tokenRefresh = null;
  }
};

const createApiClient = (service) => {
  const apiClient = axios.create({ baseURL: SERVICE_CONFIG[service].baseURL });

  apiClient.interceptors.request.use(async (config) => {
    let accessToken = await SecureStore.getItemAsync('accessToken');
    if (accessToken) {
      if (isTokenExpired(accessToken)) accessToken = await refreshAccessToken();
      config.headers.Authorization = `Bearer ${accessToken}`;
    }
    return config;
  });

  apiClient.interceptors.response.use(
    (response) => response,
    async (error) => {
      const originalRequest = error.config;
      if (!error.authenticationExpired && error.response?.status === 401 && originalRequest && !originalRequest._retry) {
        originalRequest._retry = true;
        const accessToken = await refreshAccessToken();
        originalRequest.headers.Authorization = `Bearer ${accessToken}`;
        return apiClient(originalRequest);
      }
      return Promise.reject(error);
    }
  );
  return apiClient;
};

export const cloudApiClient = createApiClient(API_SERVICES.CLOUD);
export const paymentApiClient = createApiClient(API_SERVICES.PAYMENT);
export default cloudApiClient;
