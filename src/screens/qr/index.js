import { ActivityIndicator, SafeAreaView, StatusBar, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Layout } from '../../layout';
import { PasswordModal } from '../../components/modal/password';
import { CameraView, useCameraPermissions } from 'expo-camera';
import BarcodeMask from 'react-native-barcode-mask';
import { useEffect, useRef, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { openSettings } from 'react-native-permissions';
import { openModal } from '../../reducers/modalReducer';

const QRScreen = ({ route }) => {
    const { t } = useTranslation();
    const [cameraPermission, requestCameraPermission] = useCameraPermissions();
    const [scanned, setScanned] = useState(false);
    const [transitioning, setTransitioning] = useState(false);
    const [barcode, setBarcode] = useState(null);
    const scanLockedRef = useRef(false);
    const { QrScreen } = useSelector(state => state.rerender)
    const dispatch = useDispatch();

    const getBarCodeScannerPermissions = async () => {
        const permissionResponse = await requestCameraPermission();
        if (permissionResponse?.status !== 'granted') {
            openPermissionsSettings();
        }
    };

    const openPermissionsSettings = () => {
        dispatch(openModal({
            content: t('qr.camera_usage_desc'),
            type: 'info',
            head: t('qr.camera_access_head'),
            icon: 'ex',
            buttonText: t('qr.open_settings'),
            callback: () => openSettings()
        }))
    }

    useEffect(() => {
        scanLockedRef.current = false;
        setTransitioning(false);
        getBarCodeScannerPermissions();
    }, [QrScreen]);

    const handleBarcodeScanned = ({ data }) => {
        if (scanLockedRef.current) {
            return;
        }
        scanLockedRef.current = true;
        setBarcode(data);
        setTransitioning(true);
        setTimeout(() => {
            setScanned(true);
        }, 0);
    };

    const cancelBarcodeScanning = () => {
        scanLockedRef.current = false;
        setTransitioning(false);
        setScanned(false);
        setBarcode(null)
    }

    if (!cameraPermission) {
        return <Layout name={route.name}>
            <Text style={{ alignSelf: 'center' }}>
                {t('qr.requesting_permission')}
            </Text>
        </Layout>;
    }
    if (cameraPermission.granted === false) {
        return <Layout name={route.name}>
            <Text style={{ alignSelf: 'center' }}>{t('qr.no_access')}</Text>
        </Layout>;
    }

    if (transitioning || scanned) {
        return (
            <View style={styles.authRoot}>
                <StatusBar barStyle='dark-content' />
                <SafeAreaView style={styles.authSafe}>
                    <View style={styles.authStep}>
                        {
                            scanned ?
                                <PasswordModal setScanned={setScanned} barcode={barcode} cancel={cancelBarcodeScanning} /> :
                                <ActivityIndicator color="#415EB6" size='large' />
                        }
                    </View>
                </SafeAreaView>
            </View>
        );
    }

    return (
        <Layout name={route.name}>
            <CameraView
                onBarcodeScanned={handleBarcodeScanned}
                barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
                style={StyleSheet.absoluteFillObject}
            />
            {
                barcode ?
                    <View style={styles.statusSuccess}>
                        <Text style={styles.statusSuccessText}>{t('qr.scanned')}</Text>
                    </View>
                    : <View style={styles.statusIdle}>
                        <Text style={styles.statusIdleText}>{t('qr.not_scanned')}</Text>
                        <ActivityIndicator size={10} style={{ marginLeft: 5 }} color='#fff' />
                    </View>

            }
            <BarcodeMask
                edgeColor={'rgba(255, 255, 255, 0.8)'}
                showAnimatedLine={false}
                edgeWidth={48}
                edgeHeight={48}
                edgeBorderWidth={5}
                edgeRadius={15}
                backgroundColor={'rgba(0, 0, 0, 0.5)'}
                outerMaskOpacity={0.1}
                width={180} height={180}
            />
        </Layout >
    )
}

const styles = StyleSheet.create({
    authRoot: {
        flex: 1,
        backgroundColor: '#F5F7FB',
    },
    authSafe: {
        flex: 1,
    },
    authStep: {
        flex: 1,
        paddingHorizontal: 20,
        justifyContent: 'center',
        backgroundColor: '#F5F7FB',
    },
    statusSuccess: {
        backgroundColor: 'green',
        height: 30,
        borderRadius: 10,
        width: 150,
        alignSelf: 'center',
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'row',
        marginTop: 10,
    },
    statusSuccessText: {
        color: '#fff',
    },
    statusIdle: {
        backgroundColor: 'gray',
        height: 30,
        borderRadius: 10,
        width: 150,
        alignSelf: 'center',
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'row',
        marginTop: 10,
    },
    statusIdleText: {
        marginRight: 5,
    },
});

export default QRScreen

