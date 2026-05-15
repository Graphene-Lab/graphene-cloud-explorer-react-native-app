import React, { useEffect, useState, useRef } from 'react';
import * as WebBrowser from 'expo-web-browser';
import { makeRedirectUri, useAuthRequest, useAutoDiscovery } from 'expo-auth-session';
import { StyleSheet, Text, View, Image, TouchableOpacity } from 'react-native';
import * as Linking from 'expo-linking';
import axios from 'axios';
import * as SecureStore from 'expo-secure-store';
import { useNavigation } from '@react-navigation/native';
import { reportCrash } from '../../utils/crashlytics-utils';
import { ROUTES } from '../../navigation/types';
import { Button } from '../button';
import { CustomText } from '../text';
import { useTranslation } from 'react-i18next';
import { paymentApiClient } from '../../utils/apiClient';
import { finalizeAuthentication } from '../../utils/essential-functions';
import { ActivityIndicator } from 'react-native-paper';
import { useDispatch, useSelector } from 'react-redux';
import { setUserLoginError, setUserSecretDataToRedux } from '../../reducers/userSecretDataReducer';
import MarkIcon from '../../assets/icons/modal/exmark.svg';

WebBrowser.maybeCompleteAuthSession();



export default function SignInUp ({ route }) {
  const { t } = useTranslation();
  const navigation = useNavigation();
  const isRedirect = route?.params?.isRedirect || false;
  const dispatch = useDispatch();
  const { loginError, wait } = useSelector(state => state.userSecret);
  const [loading, setLoading] = useState(false);
  const exchangeAttempted = useRef(false);
  const [hasPrompted, setHasPrompted] = useState(false);
  const discovery = useAutoDiscovery('https://cloudkeycloak.duckdns.org/realms/cloud');
  const [request, response, promptAsync] = useAuthRequest(
    {
      clientId: 'cloud-mobile-app',
      redirectUri: makeRedirectUri({
        scheme: 'com.graphenelab.cloudexplorer',
      }) + 'redirect',
      scopes: ['openid', 'profile'],
      usePKCE: true,
      extraParams: {
        prompt: 'login',
      },
    },
    discovery
  );

  console.log('SignInUp render -> loginError:', loginError, 'wait:', wait, 'loading:', loading, 'isRedirect:', isRedirect, 'response:', response?.type);

  const exchangeCodeForToken = async (code, codeVerifier) => {
    if (exchangeAttempted.current) {
      console.log('SignInUp: Token exchange already attempted, skipping duplicate call.');
      return;
    }
    exchangeAttempted.current = true;
    setLoading(true);
    dispatch(setUserLoginError(false));
    dispatch(setUserSecretDataToRedux({ zeroKnowledgePrompted: false }));
    try {
      const response = await axios.post(
        'https://cloudkeycloak.duckdns.org/realms/cloud/protocol/openid-connect/token',
        new URLSearchParams({
          client_id: 'cloud-mobile-app',
          code: code,
          redirect_uri: makeRedirectUri({ scheme: 'com.graphenelab.cloudexplorer' }) + 'redirect',
          grant_type: 'authorization_code',
          code_verifier: codeVerifier
        }).toString(),
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        }
      );
      console.log('Token Response:', response.data);
      const { access_token, refresh_token } = response.data;
      await SecureStore.setItemAsync('accessToken', access_token);
      await SecureStore.setItemAsync('refreshToken', refresh_token);
      await SecureStore.setItemAsync('isAuth', 'true');

      console.log('SignInUp: Fetching credentials from cloud...');
      // Fetch QR and PIN from the cloud management service
      const credsResponse = await paymentApiClient.get('me/cloud-space/credentials');
      const { qrEncrypted, pin } = credsResponse.data;
      console.log('SignInUp: Credentials received', { pin, qrEncrypted: qrEncrypted?.substring(0, 20) + '...' });

      // Finalize pairing and security setup
      console.log('SignInUp: Starting finalizeAuthentication...');
      const success = await finalizeAuthentication(pin, qrEncrypted);
      console.log('SignInUp: finalizeAuthentication result:', success);

      if (success) {
        console.log('SignInUp: finalizeAuthentication result: true (Navigation handled by WelcomeScreen)');
      } else {
        setLoading(false);
      }

    } catch (error) {
      setLoading(false);
      console.error('Token exchange failed:', error);
      reportCrash(error, {
        screen: 'SignInUp',
        flow: 'exchangeCodeForToken',
        hasCode: !!code,
        hasCodeVerifier: !!codeVerifier,
      });
    }
  };

  useEffect(() => {
    if (response?.type === 'success') {
      const { code } = response.params;
      SecureStore.getItemAsync('oauth_code_verifier').then((savedVerifier) => {
        const codeVerifier = savedVerifier || request?.codeVerifier;
        exchangeCodeForToken(code, codeVerifier);
      });
    } else if (response?.type === 'cancel' || response?.type === 'error') {
      navigation.goBack();
    }
  }, [response]);

  useEffect(() => {
    const handleManualRedirect = async () => {
      if (isRedirect && !loading && !exchangeAttempted.current) {
        const url = await Linking.getInitialURL();
        if (url && url.includes('code=')) {
          console.log('SignInUp: Manually parsing code from deep link on cold start');
          const codeMatch = url.match(/code=([^&]+)/);
          if (codeMatch && codeMatch[1]) {
            const code = codeMatch[1];
            SecureStore.getItemAsync('oauth_code_verifier').then((savedVerifier) => {
              if (savedVerifier) {
                console.log('SignInUp: Found saved verifier, manually exchanging code');
                exchangeCodeForToken(code, savedVerifier);
              } else {
                console.error('SignInUp: No saved verifier found on cold start redirect');
              }
            });
          }
        }
      }
    };
    handleManualRedirect();
  }, [isRedirect, loading]);

  useEffect(() => {
    dispatch(setUserLoginError(false));
    dispatch(setUserSecretDataToRedux({ zeroKnowledgePrompted: false }));
    const checkAndPrompt = async () => {
      if (request && !loading && !hasPrompted && !isRedirect) {
        setHasPrompted(true);
        if (request.codeVerifier) {
          await SecureStore.setItemAsync('oauth_code_verifier', request.codeVerifier);
        }
        promptAsync();
      }
    };
    checkAndPrompt();
  }, [request, loading, hasPrompted, isRedirect]);

  if (loginError) {
    return (
      <View style={[styles.container, { justifyContent: 'center' }]}>
        <View style={{ alignItems: 'center', width: '100%' }}>
          <MarkIcon />
          <CustomText custom={{ fontSize: 18, textAlign: 'center', marginTop: 20 }}>
            {t('signin.incorrect_credentials')}
          </CustomText>
          <View style={{ width: '100%', marginTop: 50 }}>
            <Button 
              text={t('signin.try_again')} 
              callback={() => {
                dispatch(setUserLoginError(false));
                dispatch(setUserSecretDataToRedux({ zeroKnowledgePrompted: false }));
                navigation.goBack();
              }} 
            />
          </View>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { justifyContent: 'center' }]}>
      <ActivityIndicator color="#415EB6" size='large' />
      <CustomText custom={{ marginTop: 20 }}>{t('signin.connecting_keycloak')}</CustomText>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#fff',
    paddingVertical: 50,
    paddingHorizontal: 20
  },
  headerContainer: {
    alignItems: 'center',
    marginTop: 50
  },
  subtitle: {
    marginTop: 20,
    color: '#87949E',
    textAlign: 'center',
    fontSize: 16
  },
  buttonContainer: {
    width: '100%',
    paddingHorizontal: 20
  },
  button: {
    width: '100%',
    minHeight: 60,
    borderRadius: 8,
    backgroundColor: '#415EB6',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 15,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.2,
    shadowRadius: 1.41,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600'
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 20,
    borderTopWidth: 1,
    borderTopColor: '#EEF2FE',
    width: '100%',
    justifyContent: 'center'
  },
  guideText: {
    color: '#415EB6',
    marginLeft: 5,
    fontSize: 14,
    fontWeight: '500'
  }
});

