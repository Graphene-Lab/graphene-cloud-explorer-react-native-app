import axios from 'axios';
import * as SecureStore from 'expo-secure-store';
import { jwtDecode } from 'jwt-decode';
import { reportCrash } from './crashlytics-utils';
import { API_SERVICES, SERVICE_CONFIG } from './apiClientConfig';

const HARDCODED_TOKEN = 'eyJhbGciOiJSUzI1NiIsInR5cCIgOiAiSldUIiwia2lkIiA6ICJiZUN2VDR5SWZObnVvSjBlVjc2S1Vra0pRYkRIa2lzMUt0TkdvMFdqelg0In0.eyJleHAiOjE3Mzc2MTI5MTYsImlhdCI6MTczNjMxNjkxNiwiYXV0aF90aW1lIjoxNzM2MzE2ODkwLCJqdGkiOiI1NWE0NmYwYy1mOGFjLTQ3MjYtYjZlMi1jZDBhOWM2MmY2MmQiLCJpc3MiOiJodHRwczovL2Nsb3Vka2V5Y2xvYWsuZHVja2Rucy5vcmcvcmVhbG1zL2Nsb3VkIiwiYXVkIjoiYWNjb3VudCIsInN1YiI6IjkzMTk1NGFjLWUwNTMtNDFkZC1hYjY4LWZlMTg2OTM3MTRhOSIsInR5cCI6IkJlYXJlciIsImF6cCI6ImNsb3VkLW1vYmlsZS1hcHAiLCJzaWQiOiIzMDc2MjAwNy1lYzAzLTQyMTgtODBlZC1lMjdlMzA3NDBlOGMiLCJhY3IiOiIxIiwicmVhbG1fYWNjZXNzIjp7InJvbGVzIjpbIm9mZmxpbmVfYWNjZXNzIiwiZGVmYXVsdC1yb2xlcy1jbG91ZCIsInVtYV9hdXRob3JpemF0aW9uIl19LCJyZXNvdXJjZV9hY2Nlc3MiOnsiYWNjb3VudCI6eyJyb2xlcyI6WyJtYW5hZ2UtYWNjb3VudCIsIm1hbmFnZS1hY2NvdW50LWxpbmtzIiwidmlldy1wcm9maWxlIl19fSwic2NvcGUiOiJwcm9maWxlIGVtYWlsIiwiZW1haWxfdmVyaWZpZWQiOnRydWUsIm5hbWUiOiJyIHIiLCJwcmVmZXJyZWRfdXNlcm5hbWUiOiJ0ZXN0IiwiZ2l2ZW5fbmFtZSI6InIiLCJmYW1pbHlfbmFtZSI6InIiLCJlbWFpbCI6InRlc3RAbWFpbC5jb20ifQ.dDDHh41cw9xUBbUSEv3lyc74DRhJc1Jl9b66wTkYWQkeO47KMMN40wndxGwnp2xlVY-P6gVIBQrX1RgtMAJzlYaCJzXQ0GW61ESlLbmj0QmdnIL1vnATREq6mOWeMcB95wjs4a3w25ImeIhqrgZ4zZ89-QgT3cSr5t6bILzuC8HZp0SE2A4LAb0DQPu9qCvjGf9lzyaCQRZxVbi_sc497xDg2DHPj10rA3vUf4l3LFbHkfyjp7K8mSU0tjJpR4_OFmAKA4D0ffAHjdHc7wpsfqWwzw2ik406Pv1WEsh25WXhZ9Zc8ax71uBugV60zf6UUMUfisTUKhlUg9SSZKSSEA';

const toCrashAttrs = (attrs = {}) =>
    Object.keys(attrs).reduce((acc, key) => {
        const value = attrs[key];
        if (value !== undefined && value !== null) acc[key] = String(value);
        return acc;
    }, {});



const isTokenExpired = (token) => {
    const decoded = jwtDecode(token);
    return decoded.exp * 1000 < Date.now(); // `exp` is in seconds, so convert to milliseconds
};

// Function to refresh the access token
const refreshAccessToken = async () => {
    const refreshToken = await SecureStore.getItemAsync('refreshToken');

    try {
        const response = await axios.post(
            'https://cloudkeycloak.duckdns.org/realms/cloud/protocol/openid-connect/token',
            new URLSearchParams({
                client_id: 'cloud-mobile-app',
                grant_type: 'refresh_token',
                refresh_token: refreshToken,
            }).toString(),
            {
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
            }
        );

        const { access_token, refresh_token } = response.data;

        // Save the new tokens
        await SecureStore.setItemAsync('accessToken', access_token);
        await SecureStore.setItemAsync('refreshToken', refresh_token);
        
        return access_token;
    } catch (error) {
        console.error('Failed to refresh token:', error);
        reportCrash(error, {
            screen: 'ApiClient',
            flow: 'refreshAccessToken',
            hasRefreshToken: !!refreshToken,
        });
        await SecureStore.setItemAsync('isAuth', 'false');
        throw error;
    }
};

const createApiClient = (service) => {
    const config = SERVICE_CONFIG[service];
    
    const apiClient = axios.create({
        baseURL: config.baseURL
    });

    apiClient.interceptors.request.use(async (config) => {
        let accessToken = await SecureStore.getItemAsync('accessToken');

        if (accessToken) {
            if (isTokenExpired(accessToken)) {
                try {
                    accessToken = await refreshAccessToken();
                } catch (error) {
                    console.error('Failed to refresh token during request:', error);
                    throw error;
                }
            }
            config.headers.Authorization = `Bearer ${accessToken}`;
        }
        
        return config;
    }, (error) => {
        return Promise.reject(error);
    });

  // Response Interceptor: Handle 401 errors
  apiClient.interceptors.response.use(
    (response) => response,
    async (error) => {
      const originalRequest = error.config;

            if (error.response?.status === 401 && !originalRequest._retry) {
                originalRequest._retry = true;

                try {
                    const accessToken = await refreshAccessToken();
                    originalRequest.headers.Authorization = `Bearer ${accessToken}`;
                    return apiClient(originalRequest);
                } catch (refreshError) {
                    console.error('Failed to refresh token after 401:', refreshError);
                    reportCrash(refreshError, {
                        screen: 'ApiClient',
                        flow: 'responseInterceptor401',
                        service,
                    });
                    throw refreshError;
                }
            }

            return Promise.reject(error);
        }
    );

    return apiClient;
};

export const cloudApiClient = createApiClient(API_SERVICES.CLOUD);
export const paymentApiClient = createApiClient(API_SERVICES.PAYMENT);
export default cloudApiClient;
