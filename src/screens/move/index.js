import { useEffect } from 'react';
import { BackHandler } from "react-native";
import { View, Text } from 'react-native'
import { useTranslation } from 'react-i18next'


const MoveScreen = ({ navigation }) => {
    const { t } = useTranslation();
    function handleBackButtonClick() {
        navigation.pop();
        return true;
    }
    useEffect(() => {
        BackHandler.addEventListener("hardwareBackPress", handleBackButtonClick);
        return () => {
            BackHandler.removeEventListener("hardwareBackPress", handleBackButtonClick);
        };
    }, [])

    return (
        <View>
            <Text>{t('common.move')}</Text>
        </View>
    )
}

export default MoveScreen