import { Text, View } from 'react-native';
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


  const { connection } = useSelector((state) => state.network);
  const dispatch = useDispatch();

  const singInCredentials = () => {
    if (connection === false) {
      dispatch(
        openModal({
          content: 'Make sure your phone has an active internet connection and checking the network.',
          type: 'info',
          head: 'Network connection failed',
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
            Welcome!
          </CustomText>
          <CustomText custom={{ marginTop: 20 }}>
            To connect your app to the Cloud Services device, scan the QR code that you can find on
            the instruction paper in the box. Then enter a 6-digit verification code to log in to
            your account.
          </CustomText>
        </View>
        <QRIcon />
        <View style={styles.buttonsGroup}>
          <View style={styles.buttonView}>
            <Button text="Open camera" callback={() => navigate('QRScreen')} />
            <Text style={{ alignSelf: 'center' }}>or</Text>
            <Button text="Enter QR code manually" callback={() => navigate('SingInViaTextScreen')} />
            
            {/* <TouchableOpacity onPress={singInCredentials}>
              <Text style={{ alignSelf: 'center' }}>Sing in with Credentials</Text>
            </TouchableOpacity> */}
          </View>
          <View style={styles.buttonView}>
            {/* <CustomText color="#000">New to Cloud Services?</CustomText>
            <TouchableOpacity style={styles.viewGuide} onPress={() => navigate('ViewGuideScreen')}>
              <Text style={styles.viewGuideText}>View Guide</Text>
            </TouchableOpacity> */}
          </View>
        </View>
      </View>
    </Layout>
  );
};
