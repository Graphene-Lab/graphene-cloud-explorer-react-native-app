import { useEffect } from 'react'
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { NavigationContainer } from '@react-navigation/native';
import MainScreen from "../screens/welcome";
import TabNavigator from './TabNavigator';
const Stack = createNativeStackNavigator();
import { createNavigationContainerRef } from '@react-navigation/native';
import NetInfo from "@react-native-community/netinfo";
import { setConnectionStatus } from '../reducers/networkConnectionReducer'
import { openModal } from '../reducers/modalReducer'
import { useDispatch } from 'react-redux';
import { useContextApi } from '../context/ContextApi';
import { getCellularInfoMMKV } from '../utils/mmkv';
import { setIntentFile } from '../reducers/filesTransferNewReducer';
export const navigationRef = createNavigationContainerRef()
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
                content: "Cellular data usage is off. Are you sure you want to use cellular data for this action?",
                head: "You use cellular connection",
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
        let type = ""
        const unsubscribe = NetInfo.addEventListener((state) => {
            dispatch(setConnectionStatus({ connection: state.isInternetReachable, type: state.type }))
            type = state.type;
            if (state.isInternetReachable === false) {
                dispatch(openModal({
                    content: 'Make sure your phone has an active internet connection and checking the network.',
                    type: 'info',
                    head: 'Network connection failed',
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
            unsubscribe;
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
