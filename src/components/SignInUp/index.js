import React, { useEffect, useState } from 'react';
import * as WebBrowser from 'expo-web-browser';
import { makeRedirectUri, useAuthRequest, useAutoDiscovery } from 'expo-auth-session';
import { StyleSheet, Text, View, Image, TouchableOpacity } from 'react-native';
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

WebBrowser.maybeCompleteAuthSession();



export default function SignInUp () {
  const { t } = useTranslation();
  const navigation = useNavigation();
  const [loading, setLoading] = useState(false);
  const discovery = useAutoDiscovery('https://cloudkeycloak.duckdns.org/realms/cloud');
  const [request, response, promptAsync] = useAuthRequest(
    {
      clientId: 'cloud-mobile-app',
      redirectUri: makeRedirectUri({
        scheme: 'com.cloudapp',
      }) + 'redirect',
      scopes: ['openid', 'profile'],
      usePKCE: true,
    },
    discovery
  );

  const exchangeCodeForToken = async (code, codeVerifier) => {
    setLoading(true);
    try {
      const response = await axios.post(
        'https://cloudkeycloak.duckdns.org/realms/cloud/protocol/openid-connect/token',
        new URLSearchParams({
          client_id: 'cloud-mobile-app',
          code: code,
          redirect_uri: makeRedirectUri({ scheme: 'com.cloudapp' }) + 'redirect',
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
      const codeVerifier = request?.codeVerifier;
      exchangeCodeForToken(code, codeVerifier);
    } else if (response?.type === 'cancel' || response?.type === 'error') {
      navigation.goBack();
    }
  }, [response]);

  useEffect(() => {
    if (request && !loading) {
      promptAsync();
    }
  }, [request]);

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

