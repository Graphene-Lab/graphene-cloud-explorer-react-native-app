import { useCallback, useEffect, useState } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { MenuProvider } from 'react-native-popup-menu';
import { Provider } from 'react-redux';
import QuickCrypto from 'react-native-quick-crypto';

// Polyfill global crypto safely
try {
  if (QuickCrypto) {
    global.crypto = QuickCrypto;
    console.log('App: Crypto polyfilled. subtle available:', !!(QuickCrypto.subtle || QuickCrypto.webcrypto?.subtle));
  }
} catch (e) {
  console.error('App: Failed to polyfill global.crypto', e);
}

import { BottomSheetNative } from './src/components/bottom-sheet';
import { ContextApiProvider } from './src/context/ContextApi';
import Router from './src/navigation/Router';
import { store } from './src/store';
import * as SplashScreen from 'expo-splash-screen';
import { StripeProvider } from '@stripe/stripe-react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import './src/i18n';

SplashScreen.preventAutoHideAsync();

const App = () => {
  const [appIsReady, setAppIsReady] = useState(false);

  useEffect(() => {
    async function prepare () {
      try {
        await new Promise(resolve => setTimeout(resolve, 300));
      } catch (e) {
        console.warn(e);
      } finally {
        setAppIsReady(true);
      }
    }

    prepare();
  }, []);

  const onLayoutRootView = useCallback(async () => {
    if (appIsReady) {
      await SplashScreen.hideAsync();
    }
  }, [appIsReady]);

  if (!appIsReady) {

    return null;
  }

  return (
    <StripeProvider
      publishableKey="pk_test_51QUPpVL5vnlesNTrpFG1yyTMgIEfZOw9CTheApJzrmbPIGLrJdPVny61F8abmkyxmEp0fUfVIUZo9CLV3hkB2J2a00Qv02R6hj" // Replace with your Stripe publishable key
      urlScheme="com.graphenelab.cloudexplorer" // Required for 3D Secure and bank redirects
    // merchantIdentifier="merchant.com.yourapp" // Required for Apple Pay
    >
      <SafeAreaProvider>
        <GestureHandlerRootView style={{ flex: 1 }} onLayout={onLayoutRootView}>
          <Provider store={store}>
            <ContextApiProvider>
              <MenuProvider>
                <Router />
                <BottomSheetNative />
              </MenuProvider>
            </ContextApiProvider>
          </Provider>
        </GestureHandlerRootView>
      </SafeAreaProvider>
    </StripeProvider>
  );
};

export default App;

// eas build -p android --profile preview
