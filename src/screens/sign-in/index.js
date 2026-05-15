import { Text, View, TouchableOpacity } from 'react-native';
import * as Linking from 'expo-linking';
import { useTranslation } from 'react-i18next';
import { useDispatch, useSelector } from 'react-redux';
import Ionicons from 'react-native-vector-icons/Ionicons';
// import QRIcon from '../../assets/icons/qr.svg';
import { Button } from '../../components/button';
import { CustomText } from '../../components/text';
import { Layout } from '../../layout';
import { styles } from './styles';
import { generateKeyRSA, onQrCodeAcquires } from '../../utils/essential-functions';
import { useEffect, useState } from 'react';
import { permissionCheck } from '../../utils/permissions';
import { openModal } from '../../reducers/modalReducer';
import { setUserSecretDataToRedux } from '../../reducers/userSecretDataReducer';
import { devices } from '../../constants/boxes';
import { reportCrash } from '../../utils/crashlytics-utils';



export const SignInScreen = ({ navigation: { navigate }, route }) => {
  const { t } = useTranslation();


  const { connection } = useSelector((state) => state.network);
  const dispatch = useDispatch();

  const showPrivacyInfo = () => {
    dispatch(
      openModal({
        head: t('signin.privacy_title'),
        content: t('signin.privacy_body'),
        type: 'info',
        icon: 'checkmark',
      })
    );
  };

  const singInCredentials = () => {
    if (connection === false) {
      dispatch(
        openModal({
          content: t('signin.network_failed_desc'),
          type: 'info',
          head: t('signin.network_failed_head'),
          icon: 'ex',
        })
      );
    } else if (connection === true) {
      dispatch(setUserSecretDataToRedux({ devicePin: devices.andrea2['pin'] }));
      generateKeyRSA()
        .then(() => onQrCodeAcquires(devices.andrea['qr']))
        .catch((error) => {
          reportCrash(error, {
            screen: 'SignInScreen',
            flow: 'signInCredentials',
            connection,
          });
        });
    } else return null;
  };

  useEffect(() => {
    permissionCheck();

    const handleDeepLink = (event) => {
      let url = typeof event === 'string' ? event : event?.url;
      if (url && (url.includes('code=') || url.includes('error=')) && url.includes('cloudexplorer')) {
        navigate('SignInUp', { isRedirect: true });
      }
    };

    Linking.getInitialURL().then(handleDeepLink);
    const subscription = Linking.addEventListener('url', handleDeepLink);

    return () => {
      subscription?.remove();
    };
  }, []);



  return (
    <Layout name={route.name}>
      <View style={styles.container}>
          <CustomText size={30} color="#22215B" custom={{ textAlign: 'center' }}>
            {t('signin.welcome')}
          </CustomText>
          <View style={{ marginTop: 20, alignItems: 'center' }}>
            <CustomText custom={{ textAlign: 'center', color: '#B0C0D0' }}>
              {t('signin.description')}
            </CustomText>
            <TouchableOpacity onPress={showPrivacyInfo} style={{ marginTop: 10 }}>
              <Ionicons name="information-circle-outline" size={24} color="#415EB6" />
            </TouchableOpacity>
          </View>
        <View style={{ height: 40 }} />
        <View style={styles.buttonsGroup}>
          <View style={styles.buttonView}>
            <Button
              text={t('signin.credentials')}
              callback={() => navigate('SignInUp')}
            />
            <View style={{ height: 15 }} />
            <Button
              text={t('screens.scan_qr')}
              variant="outlined"
              callback={() => navigate('QRSelectionScreen')}
            />
          </View>
          <View style={styles.viewGuideContainer}>
            <CustomText color="#000" custom={{ textAlign: 'center' }}>{t('signin.new_to')}</CustomText>
            <TouchableOpacity style={styles.viewGuide} onPress={() => navigate('ViewGuideScreen')}>
              <Text style={styles.viewGuideText}>{t('signin.view_guide')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Layout>
  );
};

