/* eslint-disable semi */
import { store } from '../store';
import i18n from '../i18n';
import axios from "axios"
import { closeModal, openModal } from '../reducers/modalReducer';
import { DeviceEventEmitter } from 'react-native';
import { getDeviceUpdateFinishInfoMMKV, setDeviceUpdateInfoMMKV } from './mmkv';
var QRCode
var url;
const dispatch = store.dispatch;
const baseUrl = 'http://162.55.209.61:8030';
const config = { headers: { 'Content-Type': 'application/json' } };

export const checkAvailableDeviceUpdate = async (qr) => {
    QRCode = qr;
    const finishStatus = await getDeviceUpdateFinishInfoMMKV()
    url = `${baseUrl}/api/versions/exists?uuid=${encodeURIComponent(QRCode)}`
    axios.get(url).then(res => {
        if (res.data == 'EXISTS') {
            setDeviceUpdateInfoMMKV(false);
            dispatch(openModal({
                type: 'update',
                head: i18n.t('updates.available_head'),
                icon: 'check',
                pending: false,
                content: i18n.t('updates.available_desc')
            }))
        }
        if (res.data == 'APPROVED' || res.data == 'UPDATING') {
            setDeviceUpdateInfoMMKV(false);
            updateListener()
            dispatch(openModal({
                type: 'update',
                head: i18n.t('updates.available_head'),
                icon: 'check',
                pending: true,
                content: i18n.t('updates.available_desc')
            }))
        }

        if (res.data == 'FINISHED' && finishStatus === false) {
            setDeviceUpdateInfoMMKV(true);
            dispatch(openModal({
                type: 'info',
                head: i18n.t('updates.success_head'),
                icon: 'check',
                content: i18n.t('updates.success_desc'),
            }))
            DeviceEventEmitter.emit('spoolerCleaner');
            return DeviceEventEmitter.emit('logOut');
        }

    })
}


export const updateDevice = async () => {
    url = `${baseUrl}/api/versions/change-status?uuid=${encodeURIComponent(QRCode)}`;
    await axios.post(url, JSON.stringify("APPROVED"), config)
    url = `${baseUrl}/api/versions/exists?uuid=${encodeURIComponent(QRCode)}`
    const resend = await axios.get(url);
    updateListener(resend.data);
}


export const updateListener = async (data) => {
    url = `${baseUrl}/api/versions/exists?uuid=${encodeURIComponent(QRCode)}`
    const res = await axios.get(url);
    if (data == 'FINISHED') {
        setDeviceUpdateInfoMMKV(true);
        dispatch(closeModal());
        QRCode = null;
        url = null;
        dispatch(openModal({
            type: 'info',
            head: i18n.t('updates.success_head'),
            icon: 'check',
            content: i18n.t('updates.success_desc'),
        }))
        DeviceEventEmitter.emit('spoolerCleaner');
        return DeviceEventEmitter.emit('logOut');
    } else if (data === 'EXISTS') {
        dispatch(closeModal());
        dispatch(openModal({
            type: 'update',
            head: i18n.t('updates.failed_head'),
            icon: 'ex',
            pending: false,
            content: i18n.t('updates.failed_desc'),
            buttonText: i18n.t('updates.try_again')
        }))
        return
    }
    else {
        // eslint-disable-next-line no-undef
        setTimeout(() => {
            updateListener(res.data);
        }, 3000)
    }
}


