import { useEffect } from 'react'
import i18n from '../i18n'
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { NavigationContainer } from '@react-navigation/native';
import MainScreen from "../screens/welcome";
import TabNavigator from './TabNavigator';
const Stack = createNativeStackNavigator();
import NetInfo from "@react-native-community/netinfo";
import { setConnectionStatus } from '../reducers/networkConnectionReducer'
import { openModal } from '../reducers/modalReducer'
import { useDispatch } from 'react-redux';
import { useContextApi } from '../context/ContextApi';
import { DeviceEventEmitter } from 'react-native';
import { cleanUserSecretsData } from '../reducers/userSecretDataReducer';
import { dropMMKV, getCellularInfoMMKV } from '../utils/mmkv';
import { setIntentFile } from '../reducers/filesTransferNewReducer';
import * as SecureStore from 'expo-secure-store';
import { navigationRef } from './NavigationService';
import { SettingsScreen } from '../screens/settings/index.android'; 

let ReceiveSharingIntent = {
    getReceivedFiles: () => { },
    clearReceivedFiles: () => { },
};

try {
    const sharingIntentModule = require('react-native-receive-sharing-intent');
    ReceiveSharingIntent = sharingIntentModule?.default || sharingIntentModule || ReceiveSharingIntent;
} catch (_) {
    // Optional dependency in newer RN builds; no-op when package is unavailable.
}

const Router = () => {

    const dispatch = useDispatch();
    const { bottomSheetController } = useContextApi();
    // const [net, setNet] = useState(null);


    const handleIntent = async (data, type) => {
        const isToggled = await getCellularInfoMMKV();
        if (type === "wifi" || isToggled) {
            setTimeout(() => {
                dispatch(setIntentFile(data));
                bottomSheetController(5);
            }, 800);

            return;
        }

        dispatch(
            openModal({
                content: i18n.t('cellular.off_desc'),
                head: i18n.t('cellular.head'),
                type: "confirm",
                icon: "ex",
                callback: () => {
                    dispatch(setIntentFile(data));
                    bottomSheetController(5);
                }
            })
        );
    }

    useEffect(() => {
        const logoutSub = DeviceEventEmitter.addListener('logOut', async () => {
            console.log('Router: logOut event received! Starting thorough cleanup...');
            try {
                // 1. Clear Redux
                dispatch(cleanUserSecretsData());
                
                // 2. Clear MMKV
                await dropMMKV();
                
                // 3. Clear SecureStore
                await Promise.all([
                    SecureStore.deleteItemAsync('accessToken'),
                    SecureStore.deleteItemAsync('refreshToken'),
                    SecureStore.deleteItemAsync('isAuth')
                ]);
                
                console.log('Router: Cleanup finished. Resetting navigation to MainScreen...');
                
                if (navigationRef.isReady()) {
                    navigationRef.reset({
                        index: 0,
                        routes: [{ name: 'MainScreen' }],
                    });
                } else {
                    console.warn('Router: Navigation ref not ready during logout!');
                    // Fallback to direct navigate if reset is not available
                    navigationRef.navigate('MainScreen');
                }
            } catch (error) {
                console.error('Router: Error during logout cleanup:', error);
                // Try to navigate anyway
                navigationRef.navigate('MainScreen');
            }
        });
        let type = ""
        const unsubscribe = NetInfo.addEventListener((state) => {
            dispatch(setConnectionStatus({ connection: state.isInternetReachable, type: state.type }))
            type = state.type;
            if (state.isInternetReachable === false) {
                dispatch(openModal({
                    content: i18n.t('signin.network_failed_desc'),
                    type: 'info',
                    head: i18n.t('signin.network_failed_head'),
                    icon: 'ex',
                }))
            }
        });

        ReceiveSharingIntent.getReceivedFiles((data) => {
            // console.log('------>>> ', data);
            handleIntent(data, type);
        },
            (err) => {
                // console.log(err); log for 
            }, 'uupcloud');

        return () => {
            ReceiveSharingIntent.clearReceivedFiles();
            unsubscribe();
            logoutSub.remove();
        }



    }, []);

    return (
        <NavigationContainer ref={navigationRef}>
            {
                <Stack.Navigator>
                    <Stack.Screen
                        name="MainScreen"
                        component={MainScreen}
                        options={{ headerShown: false }}
                    />
                    <Stack.Screen
                        name="TabNavigator"
                        component={TabNavigator}
                        options={{ headerShown: false }}
                    />
                     <Stack.Screen
                        name="SettingsScreen"
                        component={SettingsScreen}
                        options={{ headerShown: false }}
                    />

                </Stack.Navigator>
            }
        </NavigationContainer>
    )
}

export default Router
