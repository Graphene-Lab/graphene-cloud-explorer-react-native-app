import { Text, View, TouchableOpacity } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useDispatch, useSelector } from 'react-redux';
import QRIcon from '../../assets/icons/qr.svg';
import { Button } from '../../components/button';
import { CustomText } from '../../components/text';
import { Layout } from '../../layout';
import { styles } from './styles';
import { generateKeyRSA, onQrCodeAcquires } from '../../utils/essential-functions';
import { useEffect } from 'react';
import { permissionCheck } from '../../utils/permissions';
import { openModal } from '../../reducers/modalReducer';
import { setUserSecretDataToRedux } from '../../reducers/userSecretDataReducer';
import { devices } from '../../constants/boxes';
import { reportCrash } from '../../utils/crashlytics-utils';



export const SignInScreen = ({ navigation: { navigate }, route }) => {
  const { t } = useTranslation();


  const { connection } = useSelector((state) => state.network);
  const dispatch = useDispatch();

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
        .then(() => onQrCodeAcquires(devices.andrea['enc']))
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

    return () => null
  }, []);



  return (
    <Layout name={route.name}>
      <View style={styles.container}>
        <View>
          <CustomText size={30} color="#22215B">
            {t('signin.welcome')}
          </CustomText>
          <CustomText custom={{ marginTop: 20 }}>
            {t('signin.description')}


          </CustomText>
        </View>
        <QRIcon />
        <View style={styles.buttonsGroup}>
          <View style={styles.buttonView}>
            <Button text={t('signin.open_camera')} callback={() => navigate('QRScreen')} />
            <Text style={{ alignSelf: 'center' }}>{t('signin.or')}</Text>
            <Button text={t('signin.enter_qr_manually')} callback={() => navigate('SingInViaTextScreen')} />
            
            {/* <TouchableOpacity onPress={singInCredentials}>
              <Text style={{ alignSelf: 'center' }}>{t('signin.credentials')}</Text>
            </TouchableOpacity> */}
          </View>
          <View style={styles.buttonView}>
            <CustomText color="#000">{t('signin.new_to')}</CustomText>
            <TouchableOpacity style={styles.viewGuide} onPress={() => navigate('ViewGuideScreen')}>
              <Text style={styles.viewGuideText}>{t('signin.view_guide')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Layout>
  );
};

