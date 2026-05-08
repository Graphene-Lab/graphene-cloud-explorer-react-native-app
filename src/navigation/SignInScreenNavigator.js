import { SignInScreen } from "../screens/sign-in"
import QRScreen from "../screens/qr";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import OnBoarding from "../components/on-boarding";
import SingInViaText from "../screens/sign-in-text";
import SignInUp from "../components/SignInUp";
import QRSelectionScreen from "../screens/qr-selection";

const Stack = createNativeStackNavigator();

const SignInScreenNavigator = () => {
  return (
    <Stack.Navigator>
      <Stack.Screen
        name="SignInScreen"
        component={SignInScreen}
        options={{
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="QRScreen"
        component={QRScreen}
        options={{
          headerShown: false,
        }}
      />
      <Stack.Screen
        name='SingInViaTextScreen'
        component={SingInViaText}
        options={{
          headerShown: false
        }}
      />
      <Stack.Screen
        name="SignInUp"
        component={SignInUp}
        options={{
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="QRSelectionScreen"
        component={QRSelectionScreen}
        options={{
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="ViewGuideScreen"
        component={OnBoarding}
        options={{
          headerShown: false,
        }}
      />
    </Stack.Navigator>
  );
};

export default SignInScreenNavigator;
