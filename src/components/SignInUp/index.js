import React, { useEffect, useMemo, useRef, useState } from 'react';
import * as WebBrowser from 'expo-web-browser';
import { makeRedirectUri, useAuthRequest } from 'expo-auth-session';
import { AppState, ScrollView, StyleSheet, View } from 'react-native';
import * as Linking from 'expo-linking';
import axios from 'axios';
import * as SecureStore from 'expo-secure-store';
import { useIsFocused, useNavigation } from '@react-navigation/native';
import { reportCrash } from '../../utils/crashlytics-utils';
import { Button } from '../button';
import { CustomText } from '../text';
import { useTranslation } from 'react-i18next';
import { paymentApiClient } from '../../utils/apiClient';
import { createCloudSpaceInitialization } from '../../utils/cloud-space-initialization';
import { finalizeAuthentication } from '../../utils/essential-functions';
import { ActivityIndicator } from 'react-native-paper';
import { useDispatch, useSelector } from 'react-redux';
import { setAuthWait, setUserLoginError, setUserSecretDataToRedux } from '../../reducers/userSecretDataReducer';
import MarkIcon from '../../assets/icons/modal/exmark.svg';

WebBrowser.maybeCompleteAuthSession();

const ISSUER = 'https://id.graphenelab.cloud/realms/cloud';
const AUTH_TIMEOUT_MS = 15000;
const PROGRESS_NOTICE_MS = 45000;
const SUPPORT_EMAIL = 'contact@graphenelab.cloud';
const redirectUri = makeRedirectUri({ scheme: 'com.graphenelab.cloudexplorer' }) + 'redirect';

export default function SignInUp ({ route }) {
  const { t } = useTranslation();
  const navigation = useNavigation();
  const focused = useIsFocused();
  const dispatch = useDispatch();
  const loginError = useSelector(state => state.userSecret.loginError);
  const isRedirect = route?.params?.isRedirect || false;
  const redirectUrl = route?.params?.redirectUrl;
  const mounted = useRef(false);
  const exchangeAttempted = useRef(false);
  const hasPrompted = useRef(false);
  const tokenRequest = useRef(null);
  const [sessionChecked, setSessionChecked] = useState(false);
  const [signedIn, setSignedIn] = useState(false);
  const [authError, setAuthError] = useState(false);
  const [discovery, setDiscovery] = useState(null);
  const [appState, setAppState] = useState(AppState.currentState || 'active');
  const [cloudState, setCloudState] = useState({ phase: 'checking', setup: null, since: Date.now() });
  const [now, setNow] = useState(Date.now());
  const [request, response, promptAsync] = useAuthRequest({
    clientId: 'cloud-mobile-app', redirectUri,
    scopes: ['openid', 'profile'], usePKCE: true,
    extraParams: { prompt: 'login' },
  }, discovery);

  const cloudFlow = useMemo(() => createCloudSpaceInitialization({
    apiClient: paymentApiClient,
    onChange: (state) => { if (mounted.current) setCloudState(state); },
    onReady: ({ pin, qrEncrypted }) => finalizeAuthentication(pin, qrEncrypted),
    onError: ({ flow, code, status }) => reportCrash(new Error('Cloud sign-in step failed'), {
      screen: 'SignInUp', flow, code, status,
    }),
  }), []);

  const failAuthentication = () => {
    if (!mounted.current) return;
    setAuthError(true);
    reportCrash(new Error('Account sign-in failed'), { screen: 'SignInUp', flow: 'authentication' });
  };

  const exchangeCodeForToken = async (code, verifier) => {
    if (exchangeAttempted.current || !mounted.current) return;
    exchangeAttempted.current = true;
    setAuthError(false);
    if (!code || !verifier) { failAuthentication(); return; }
    tokenRequest.current = new AbortController();
    try {
      const result = await axios.post(`${ISSUER}/protocol/openid-connect/token`,
        new URLSearchParams({
          client_id: 'cloud-mobile-app', code, redirect_uri: redirectUri,
          grant_type: 'authorization_code', code_verifier: verifier,
        }).toString(), {
          timeout: AUTH_TIMEOUT_MS, signal: tokenRequest.current.signal,
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        });
      const { access_token, refresh_token } = result.data;
      if (!access_token || !refresh_token) throw new Error('Missing sign-in tokens');
      await SecureStore.setItemAsync('accessToken', access_token);
      await SecureStore.setItemAsync('refreshToken', refresh_token);
      await SecureStore.setItemAsync('isAuth', 'true');
      await SecureStore.deleteItemAsync('oauth_code_verifier');
      await SecureStore.deleteItemAsync('oauth_state');
      if (mounted.current) { setAuthError(false); setSignedIn(true); }
    } catch (error) {
      if (error?.code !== 'ERR_CANCELED') failAuthentication();
    }
  };

  useEffect(() => {
    mounted.current = true;
    dispatch(setUserLoginError(false));
    dispatch(setUserSecretDataToRedux({ zeroKnowledgePrompted: false }));
    const subscription = AppState.addEventListener('change', setAppState);
    return () => {
      mounted.current = false;
      tokenRequest.current?.abort();
      cloudFlow.stop();
      subscription.remove();
    };
  }, [cloudFlow, dispatch]);

  useEffect(() => {
    let cancelled = false;
    const restoreSession = async () => {
      try {
        // An unfinished storage setup can resume without opening the browser again.
        const [isAuth, accessToken, refreshToken] = await Promise.all([
          SecureStore.getItemAsync('isAuth'), SecureStore.getItemAsync('accessToken'),
          SecureStore.getItemAsync('refreshToken'),
        ]);
        if (cancelled) return;
        if (!isRedirect && isAuth === 'true' && (accessToken || refreshToken)) setSignedIn(true);
        setSessionChecked(true);
      } catch { if (!cancelled) failAuthentication(); }
    };
    void restoreSession();
    return () => { cancelled = true; };
  }, [isRedirect]);

  useEffect(() => {
    if (!sessionChecked || signedIn || isRedirect || authError) return;
    const controller = new AbortController();
    axios.get(`${ISSUER}/.well-known/openid-configuration`, {
      timeout: AUTH_TIMEOUT_MS, signal: controller.signal,
    }).then(({ data }) => {
      if (!data.authorization_endpoint) throw new Error('Missing authorization endpoint');
      setDiscovery({ authorizationEndpoint: data.authorization_endpoint, tokenEndpoint: data.token_endpoint });
    }).catch((error) => {
      if (!controller.signal.aborted && error?.code !== 'ERR_CANCELED') failAuthentication();
    });
    return () => controller.abort();
  }, [sessionChecked, signedIn, isRedirect, authError]);

  useEffect(() => {
    if (!discovery || request || signedIn || authError || isRedirect) return;
    const timer = setTimeout(failAuthentication, AUTH_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [discovery, request, signedIn, authError, isRedirect]);

  useEffect(() => {
    if (!request || !sessionChecked || signedIn || isRedirect || authError || hasPrompted.current) return;
    hasPrompted.current = true;
    const prompt = async () => {
      try {
        await SecureStore.setItemAsync('oauth_code_verifier', request.codeVerifier);
        await SecureStore.setItemAsync('oauth_state', request.state);
        if (mounted.current) await promptAsync();
      } catch { failAuthentication(); }
    };
    void prompt();
  }, [request, sessionChecked, signedIn, isRedirect, authError, promptAsync]);

  useEffect(() => {
    if (response?.type === 'success') {
      SecureStore.getItemAsync('oauth_code_verifier')
        .then(verifier => exchangeCodeForToken(response.params.code, verifier || request?.codeVerifier))
        .catch(failAuthentication);
    } else if (response?.type === 'cancel' || response?.type === 'dismiss') {
      navigation.goBack();
    } else if (response?.type === 'error') {
      failAuthentication();
    }
  }, [response]);

  useEffect(() => {
    if (!isRedirect || exchangeAttempted.current || signedIn) return;
    let cancelled = false;
    const handleRedirect = async () => {
      try {
        const url = redirectUrl || await Linking.getInitialURL();
        if (cancelled || exchangeAttempted.current) return;
        const params = url ? Linking.parse(url).queryParams : null;
        const [verifier, state] = await Promise.all([
          SecureStore.getItemAsync('oauth_code_verifier'), SecureStore.getItemAsync('oauth_state'),
        ]);
        if (cancelled || exchangeAttempted.current) return;
        if (typeof params?.code !== 'string' || params.error || (state && params.state !== state)) {
          failAuthentication(); return;
        }
        await exchangeCodeForToken(params.code, verifier);
      } catch { if (!cancelled) failAuthentication(); }
    };
    void handleRedirect();
    return () => { cancelled = true; };
  }, [isRedirect, redirectUrl, signedIn]);

  useEffect(() => {
    if (signedIn && focused && appState === 'active') void cloudFlow.start();
    else cloudFlow.stop();
    return () => cloudFlow.stop();
  }, [signedIn, focused, appState, cloudFlow]);

  useEffect(() => {
    if (cloudState.phase === 'pairing_error') dispatch(setAuthWait(false));
    setNow(Date.now());
    if (!focused || appState !== 'active') return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [cloudState.phase, dispatch, focused, appState]);

  const signInAgain = async () => {
    cloudFlow.stop();
    try {
      await Promise.all(['accessToken', 'refreshToken', 'isAuth', 'oauth_code_verifier', 'oauth_state']
        .map(key => SecureStore.deleteItemAsync(key)));
      dispatch(setUserLoginError(false));
      dispatch(setAuthWait(false));
      navigation.replace('SignInUp');
    } catch { failAuthentication(); }
  };

  const checkStorage = () => {
    dispatch(setUserLoginError(false));
    dispatch(setUserSecretDataToRedux({ zeroKnowledgePrompted: false }));
    void cloudFlow.check();
  };

  const contactSupport = () => {
    const subject = encodeURIComponent('Graphene Cloud Explorer storage setup');
    const body = encodeURIComponent(`Cloud storage setup failed. Reference: ${cloudState.setup?.errorCode || 'UNKNOWN'}`);
    Linking.openURL(`mailto:${SUPPORT_EMAIL}?subject=${subject}&body=${body}`).catch(() => undefined);
  };

  const phase = cloudState.phase;
  const slow = now - cloudState.since >= PROGRESS_NOTICE_MS;
  const expired = signedIn && phase === 'session_expired';
  const error = loginError || authError || ['request_error', 'retry_limit', 'support', 'pairing_error', 'session_expired'].includes(phase);
  let message = t('signin.connecting_keycloak');
  if (loginError) message = t('signin.incorrect_credentials');
  else if (authError) message = t('signin.login_service_failed');
  else if (signedIn) {
    const messages = {
      checking: 'storage_checking', initializing: slow ? 'storage_taking_longer' : 'storage_initializing',
      scheduled: 'storage_retry_scheduled', retry_limit: 'storage_retry_limit', support: 'storage_support_required',
      request_error: 'storage_check_failed', session_expired: 'session_expired', requesting_retry: 'storage_checking',
      pairing: slow ? 'storage_taking_longer' : 'initializing_key', complete: 'initializing_key',
      pairing_error: 'pairing_failed',
    };
    message = t(`signin.${messages[phase] || 'storage_check_failed'}`);
  }
  const busy = !error && phase !== 'scheduled' && (!signedIn || !slow || phase === 'requesting_retry');
  const nextRetry = Date.parse(cloudState.setup?.nextRetryAt);

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.content} accessibilityLiveRegion="polite">
        {error ? <MarkIcon /> : busy ? <ActivityIndicator color="#415EB6" size="large" /> : null}
        <CustomText custom={styles.message}>{message}</CustomText>
        {signedIn && phase === 'scheduled' && (
          <CustomText custom={styles.detail}>
            {Number.isFinite(nextRetry) && nextRetry > now
              ? t('signin.storage_retry_at', { time: new Date(nextRetry).toLocaleTimeString() })
              : t('signin.storage_retry_waiting')}
          </CustomText>
        )}
        {signedIn && phase === 'support' && <CustomText custom={styles.detail}>{SUPPORT_EMAIL}</CustomText>}
      </View>
      <View style={styles.actions}>
        {authError || expired ? (
          <Button text={t('signin.sign_in_again')} callback={signInAgain} />
        ) : signedIn && (loginError || ['request_error', 'pairing_error'].includes(phase)) ? (
          <Button text={t('signin.try_again')} callback={checkStorage} />
        ) : signedIn && phase === 'retry_limit' ? (
          <Button text={t('signin.try_again')} callback={() => { void cloudFlow.retry(); }} />
        ) : signedIn && phase === 'support' ? (
          <Button text={t('signin.contact_support')} callback={contactSupport} />
        ) : null}
        {signedIn && !expired && phase !== 'pairing' && phase !== 'complete' && (
          <Button text={t('signin.switch_account')} variant="outlined" callback={signInAgain} />
        )}
        <Button text={t('signin.back')} variant="outlined" callback={() => {
          cloudFlow.stop();
          navigation.goBack();
        }} />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff', paddingVertical: 50, paddingHorizontal: 20 },
  content: { alignItems: 'center', width: '100%' },
  message: { fontSize: 18, textAlign: 'center', marginTop: 20, color: '#22215B' },
  detail: { textAlign: 'center', marginTop: 16, color: '#637588' },
  actions: { width: '100%', marginTop: 36, gap: 12 },
});
