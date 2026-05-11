import { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, Switch, Linking } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Layout } from '../../layout';
import TermsIco from '../../assets/icons/setting/terms.svg';
import AboutIcon from '../../assets/icons/setting/about.svg';
import LogoutIcon from '../../assets/icons/setting/logout.svg';
import { styles } from './styles';
import { getCellularInfoMMKV, setCellularAccessMMKV } from '../../utils/mmkv';
import { DeviceEventEmitter } from 'react-native';
import { useDispatch } from 'react-redux';
import { enqueue } from '../../reducers/refreshQueueReducer';

export const SettingsScreen = ({ route, navigation }) => {
    const { t } = useTranslation();
    const dispatch = useDispatch();
    const [isEnabled, setIsEnabled] = useState(false);

    const redirectToLandingPage = (link = "https://graphenelab.it/cloud/") => {
        Linking.canOpenURL(link).then((supported) => {
            if (supported) {
                Linking.openURL(link);
                return;
            }
        });
    };

    const logOutHandler = () => {
        console.log('SettingsScreen: Emitting logOut event...');
        DeviceEventEmitter.emit('logOut');
        DeviceEventEmitter.emit('spoolerCleaner');
        return dispatch(enqueue(['CloudScreen', 'FavoriteScreen', 'MediaScreen', 'ProfileScreen']));
    };

    const toggleSwitch = (value) => {
        setIsEnabled(value);
        setCellularAccessMMKV(value);
    };

    const cellularCheck = async () => {
        const info = await getCellularInfoMMKV();
        setIsEnabled(info);
    };

    useEffect(() => {
        cellularCheck();
    }, []);

    return (
        <Layout name={route.name} >
            <View style={styles.switchContainer}>
                <View style={styles.switchView}>
                    <Text style={styles.switchText}>{t('settings.use_cellular')}</Text>
                    <Switch
                        trackColor={{ false: "rgba(13, 88, 163, 0.2)", true: "#5D82F5" }}
                        thumbColor={isEnabled ? "#FAFAFA" : "#B0C0D0"}
                        ios_backgroundColor="rgba(176, 192, 208, 0.2)"
                        onValueChange={() => toggleSwitch(!isEnabled)}
                        value={isEnabled}
                        style={{ transform: [{ scaleX: 0.82 }, { scaleY: 0.82 }] }}
                    />
                </View>
            </View>
            <View style={styles.listContainer}>
                
                <TouchableOpacity style={styles.touchable} onPress={() => redirectToLandingPage()}>
                    <AboutIcon />
                    <Text style={styles.touchText}>{t('settings.visit_website')}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.touchable} onPress={() => redirectToLandingPage("https://graphenelab.it/cloud/privacy.html")}>
                    <TermsIco />
                    <Text style={styles.touchText}>{t('settings.privacy_policy')}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.touchable} onPress={() => navigation.navigate('TermsAndCondition')}>
                    <TermsIco />
                    <Text style={styles.touchText}>{t('settings.terms_conditions')}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.touchable} onPress={logOutHandler}>
                    <LogoutIcon />
                    <Text style={styles.touchText}>{t('options.logout')}</Text>
                </TouchableOpacity>
            </View>
        </Layout>
    );
};
