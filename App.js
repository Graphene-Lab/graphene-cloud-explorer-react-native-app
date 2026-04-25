import { useCallback, useEffect, useState } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { MenuProvider } from 'react-native-popup-menu';
import PolyfillCrypto from 'react-native-webview-crypto';
import { Provider } from 'react-redux';
import { BottomSheetNative } from './src/components/bottom-sheet';
import { ContextApiProvider } from './src/context/ContextApi';
import Router from './src/navigation/Router';
import { store } from './src/store';
import * as SplashScreen from 'expo-splash-screen';
import { StripeProvider } from '@stripe/stripe-react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

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
      urlScheme="com.cloudapp" // Required for 3D Secure and bank redirects
      // merchantIdentifier="merchant.com.yourapp" // Required for Apple Pay
    >
      <SafeAreaProvider>
        <GestureHandlerRootView style={{ flex: 1 }} onLayout={onLayoutRootView}>
          <PolyfillCrypto />
          <Provider store={store}>
            <ContextApiProvider>
              <MenuProvider>
                {/* <SignInUp /> */}
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
