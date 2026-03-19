import { lazy, Suspense, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { ActivityIndicator } from 'react-native-paper';
import { useDispatch } from 'react-redux';
import OnBoarding from '../../components/on-boarding';
import { useContextApi } from '../../context/ContextApi';
import { cleanUserSecretsData, setUserSecretDataToRedux } from '../../reducers/userSecretDataReducer';
import { getFavoritesNames } from '../../utils/data-transmission-utils';
import {
    base64ToBuffer,
    bufferToBase64,
    importRsaPrivateKeyJwk,
    importRsaPublicKeyJwk,
    importSecretKey,
} from '../../utils/proxy-cryptography-utils';
import { dropMMKV, getUserSecretDataMMKV, mergeUserSecretDataMMKV, removeUserEncryptionTypeMMKV } from '../../utils/mmkv';
const SignInScreenNavigator = lazy(() => import('../../navigation/SignInScreenNavigator'));
const TabNavigator = lazy(() => import('../../navigation/TabNavigator'));
import { checkAvailableDeviceUpdate } from '../../utils/device-updates';
import { DeviceEventEmitter } from 'react-native';
import { onQrCodeAcquires, navigateToFolder, parseFile } from '../../utils/essential-functions';
import { setData } from '../../reducers/testReducer';
import { setFavoritesContent } from '../../reducers/fileReducer';
import { setProxy } from '../../reducers/proxyReducer';


const looksLikeCryptoKey = (value) =>
    !!value && typeof value === 'object' && typeof value.type === 'string' && typeof value.algorithm === 'object';
const looksLikeJwk = (value) => !!value && typeof value === 'object' && typeof value.kty === 'string';

const WelcomeScreen = () => {
    const dispatch = useDispatch()
    const [userAuth, setUserAuth] = useState(false);
    const { wsScreen } = useContextApi();
    const [guideVisible, setGuideVisible] = useState(false);
    const showGuide = false;
    const setContent = (content) => dispatch(setData(content))
    const authCheckRunning = useRef(false);

    useEffect(() => {
        const logoutSub = DeviceEventEmitter.addListener('logOut', async () => {
            dispatch(cleanUserSecretsData());
            await dropMMKV()
            setUserAuth(false);
        });

        const loginSub = DeviceEventEmitter.addListener('logIn', () => {
            setUserAuth(true);
        });

        return () => {
            logoutSub.remove();
            loginSub.remove();
        };
    }, [dispatch]);


    const authCheck = async () => {
        if (authCheckRunning.current) {
            return;
        }
        authCheckRunning.current = true;
        let {
            auth,
            clientId,
            guide,
            privetKey,
            publicKey,
            publicKeyB64,
            serverId,
            encryptionType,
            qr,
            deviceKey,
            proxy,
            zeroKnowledgeMasterKeyB64,
            zeroKnowledgeEnabled,
            zeroKnowledgePrompted,
        } = await getUserSecretDataMMKV();
        let privateKey = privetKey;
        let resolvedPublicKey = publicKey;
        if (privateKey && !looksLikeCryptoKey(privateKey) && looksLikeJwk(privateKey)) {
            try {
                privateKey = await importRsaPrivateKeyJwk(privateKey);
            } catch (err) {
                privateKey = null;
            }
        }
        if (resolvedPublicKey && !looksLikeCryptoKey(resolvedPublicKey) && looksLikeJwk(resolvedPublicKey)) {
            try {
                resolvedPublicKey = await importRsaPublicKeyJwk(resolvedPublicKey);
            } catch (err) {
                resolvedPublicKey = null;
            }
        }
        if (encryptionType === 'aes') {
            let looksLikeCryptoKey =
                !!deviceKey?.key &&
                typeof deviceKey.key === 'object' &&
                typeof deviceKey.key.type === 'string' &&
                typeof deviceKey.key.algorithm === 'object';
            if (!looksLikeCryptoKey) {
                let keyBytes = null;
                let ivBytes = null;
                if (deviceKey?.keyB64) {
                    keyBytes = base64ToBuffer(deviceKey.keyB64);
                } else if (deviceKey?.key) {
                    keyBytes = typeof deviceKey.key === 'string' ? base64ToBuffer(deviceKey.key) : deviceKey.key;
                }
                if (deviceKey?.ivB64) {
                    ivBytes = base64ToBuffer(deviceKey.ivB64);
                } else if (deviceKey?.IV) {
                    ivBytes = typeof deviceKey.IV === 'string' ? base64ToBuffer(deviceKey.IV) : deviceKey.IV;
                }
                if (keyBytes && ivBytes) {
                    const imported = await importSecretKey(keyBytes);
                    deviceKey = { key: imported, IV: ivBytes };
                    await mergeUserSecretDataMMKV({
                        deviceKey: {
                            keyB64: bufferToBase64(keyBytes),
                            ivB64: bufferToBase64(ivBytes),
                        },
                    });
                    looksLikeCryptoKey = true;
                }
            }
            if (!looksLikeCryptoKey) {
                await dropMMKV();
                dispatch(cleanUserSecretsData());
                setUserAuth(false);
                authCheckRunning.current = false;
                return;
            }
        }
        if (auth && !looksLikeCryptoKey(privateKey)) {
            await dropMMKV();
            dispatch(cleanUserSecretsData());
            setUserAuth(false);
            authCheckRunning.current = false;
            return;
        }
        if (!guide && showGuide) {
            setGuideVisible(true);
            authCheckRunning.current = false;
            return;
        }
        setGuideVisible(false);
        const hasSessionKeys = !!clientId && !!serverId && !!publicKeyB64;
        if (auth && !hasSessionKeys) {
            await dropMMKV();
            dispatch(cleanUserSecretsData());
            setUserAuth(false);
            authCheckRunning.current = false;
            return;
        }
        if (auth === true) {
            if (userAuth) {
                authCheckRunning.current = false;
                return;
            }
            setUserAuth(true);
            dispatch(
                setUserSecretDataToRedux({
                    clientId,
                    privateKey,
                    publicKey: resolvedPublicKey,
                    publicKeyB64,
                    serverId,
                    encryptionType,
                    auth,
                    guide,
                    qr,
                    deviceKey,
                    zeroKnowledgeMasterKeyB64,
                    zeroKnowledgeEnabled,
                    zeroKnowledgePrompted,
                })
            );
            dispatch(setProxy(proxy));
            getFavoritesNames().then(favs => {
                const parsed = parseFile(favs);
                dispatch(setFavoritesContent(parsed));
            }).catch(() => null)
            navigateToFolder("", "CloudScreen")
                .then((content) => content && setContent(content))
                .catch(() => null);
            authCheckRunning.current = false;
            return setTimeout(() => {
                checkAvailableDeviceUpdate(qr);
            }, 1500);

        }

        setUserAuth(false)
        setGuideVisible(false)
        dispatch(cleanUserSecretsData());
        await removeUserEncryptionTypeMMKV();
        authCheckRunning.current = false;
        return;
    }

    useLayoutEffect(() => {
        authCheck();
        return
    }, [wsScreen])




    return (

        <Suspense
            fallback={<ActivityIndicator
                size="large"
                color="#415EB6"
                style={{
                    position: "absolute",
                    backgroundColor: "#fff",
                    height: "100%",
                    width: "100%",
                }}
            />
            }
        >
            {(showGuide && guideVisible ? <OnBoarding /> : (userAuth ? <TabNavigator /> : <SignInScreenNavigator />))}
        </Suspense>
    )
}

export default WelcomeScreen
