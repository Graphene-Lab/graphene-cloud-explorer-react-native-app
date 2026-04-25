import { StyleSheet, Text, View } from 'react-native'
import { useState, useEffect } from 'react'
import { Button } from '../../button'
import { styles } from './styles'
import { useDispatch, useSelector } from 'react-redux'
import { generateKeyRSA, onQrCodeAcquires } from '../../../utils/essential-functions'
import { openModal } from '../../../reducers/modalReducer'
import { setAuthWait, setUserSecretDataToRedux } from '../../../reducers/userSecretDataReducer'
import { ensureZeroKnowledgeReadyForAuthentication } from '../../../utils/data-transmission-utils'
import {
    CodeField,
    Cursor,
    useBlurOnFulfill,
    useClearByFocusCell,
} from 'react-native-confirmation-code-field';
import { ActivityIndicator } from "react-native-paper"
import MarkIcon from '../../../assets/icons/modal/exmark.svg'
import { reportCrash } from '../../../utils/crashlytics-utils';

const CELL_COUNT = 6;



export const PasswordModal = ({ barcode, setScanned, cancel }) => {

    const [value, setValue] = useState('');
    // const [wait, setWait] = useState(false);
    const [error, setError] = useState(false);
    const ref = useBlurOnFulfill({ value, cellCount: CELL_COUNT });
    const [props, getCellOnLayoutHandler] = useClearByFocusCell({ value, setValue });

    const { connection } = useSelector(state => state.network);
    const { proxy } = useSelector(state => state.proxyManager);
    const { loginError, wait } = useSelector(state => state.userSecret);
    const dispatch = useDispatch()

    useEffect(() => {
        setTimeout(() => {
            ref?.current?.focus();
        }, 200)
    }, [])




    const handleLogIn = async () => {
        if (connection === false) {
            dispatch(setAuthWait(false));
            return dispatch(openModal({
                content: 'Make sure your phone has an active internet connection and checking the network.',
                type: 'info',
                head: 'Network connection failed',
                icon: 'ex',
            }))
        }


        dispatch(setUserSecretDataToRedux({ devicePin: value }));
        try {
            const zkReady = await ensureZeroKnowledgeReadyForAuthentication();
            if (!zkReady) {
                return;
            }
            dispatch(setAuthWait(true));
            await generateKeyRSA();
            await onQrCodeAcquires(barcode.trim());
            setError(false)
            // setWait(false);
        } catch (error) {
            reportCrash(error, {
                screen: 'PasswordModal',
                flow: 'handleLogIn',
                pinLength: value?.length,
                hasBarcode: !!barcode,
            });
            dispatch(setAuthWait(false));
            if (isNetworkReachabilityError(error)) {
                setError(false);
                return dispatch(openModal({
                    content: buildReachabilityMessage(proxy),
                    type: 'info',
                    head: 'Server unreachable',
                    icon: 'ex',
                }))
            }
            setError(true)
        }
    }

    const onChangeText = (text) => {
        setValue(text);
    }

    const errorHandler = () => {
        setError(false);
        setValue("");
        dispatch(setAuthWait(false));
        // setWait(false);
    }

    if (wait) {
        return (
            <View style={styles.loadingRoot}>
                <ActivityIndicator color="#415EB6" size='large' />
                <Text style={styles.loadingText}>
                    Please wait. We are initializing your key and connecting to the cloud.
                </Text>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            {
                error ? <View style={styles.errorContainer}>
                    <MarkIcon />
                    <Text style={styles.errorText}>The password or QR is incorrect, please try again</Text>
                    <View style={{ width: '100%', height: 50 }}>
                        <Button text="Try again" callback={errorHandler} wait={wait} />
                    </View>

                </View> :
                    <View style={styles.view}>
                        <Text style={styles.text}>Enter pin</Text>
                        <CodeField
                            ref={ref}
                            value={value}
                            onChangeText={onChangeText}
                            rootStyle={{ width: '100%' }}
                            cellCount={CELL_COUNT}
                            keyboardType="number-pad"
                            textContentType="oneTimeCode"
                            renderCell={({ index, symbol, isFocused }) => (
                                <Text
                                    key={index}
                                    style={[styles.cell, isFocused && styles.focusCell]}
                                    onLayout={getCellOnLayoutHandler(index)}>
                                    {symbol || (isFocused ? <Cursor /> : null)}
                                </Text>
                            )}
                        />
                        <View style={styles.buttonsGroup}>
                            <Button text="Cancel" variant='outlined' callback={cancel} />
                            <View style={styles.gap}></View>
                            <Button text="Ok" disabled={wait || error || value.length != CELL_COUNT} callback={() => handleLogIn()} wait={wait} />
                        </View>
                    </View>
            }
        </View>
    )
}


    const isNetworkReachabilityError = (error) => {
        const message = String(error?.message || '');
        return (
            error?.isAxiosError === true ||
            message.includes('Network Error') ||
            message.includes('timeout') ||
            message.includes('Failed to connect')
        );
    }

    const buildReachabilityMessage = (targetProxy) => {
        if (!targetProxy) {
            return 'Unable to reach the server. Make sure the proxy server is running and reachable from the phone.';
        }
        if (targetProxy.includes('127.0.0.1') || targetProxy.includes('localhost')) {
            return `Unable to reach ${targetProxy}. On a physical device, 127.0.0.1 or localhost points to the phone itself, not your PC or Cloud Box.`;
        }
        return `Unable to reach ${targetProxy}. Make sure the proxy server is running and reachable from the phone.`;
    }
