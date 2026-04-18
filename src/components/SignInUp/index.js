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

WebBrowser.maybeCompleteAuthSession();



export default function SignInUp () {
  const navigation = useNavigation();
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
      navigation.navigate(ROUTES.TAB_NAVIGATOR);

      console.log('Token Response:', response.data);
      await SecureStore.setItemAsync('access_token', response.data.access_token);
      await SecureStore.setItemAsync('refresh_token', response.data.refresh_token);
      await SecureStore.setItemAsync('isAuth', 'true');
      
    } catch (error) {
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
        
    }
  }, [response]);

  return (
    <View style={styles.container}>
      <View style={styles.headerContainer}>
        <CustomText size={30} color="#22215B">
          Welcome to Uup Cloud
        </CustomText>
        <CustomText custom={styles.subtitle}>
          Sign in/up to continue using Graphene Cloud Explorer
        </CustomText>
      </View>

      <View style={styles.buttonContainer}>
        <TouchableOpacity 
          onPress={() => promptAsync()} 
          disabled={!request}
          style={styles.button}
        >
          <Text style={styles.buttonText}>Sign In/Up </Text>
        </TouchableOpacity>
      </View>

      <View style={styles.footer}>
        <CustomText color="#000">New to Graphene Cloud Explorer?</CustomText>
        <Text style={styles.guideText}>View Guide</Text>
      </View>
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

