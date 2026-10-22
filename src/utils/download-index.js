import { MMKV } from 'react-native-mmkv';
import { store } from '../store';

const storage = new MMKV({ id: 'graphene-downloads' });

export const getDownloadScope = () => {
    const { proxy, serverId, clientId } = store.getState().userSecret;
    return JSON.stringify([proxy, serverId, clientId]);
};

const keyFor = (path, scope) => JSON.stringify([scope, path]);

export const getSavedDownload = (path, scope = getDownloadScope()) => {
    try {
        const raw = storage.getString(keyFor(path, scope));
        return raw ? JSON.parse(raw) : null;
    } catch {
        return null;
    }
};

export const rememberDownload = (path, value, scope = getDownloadScope()) => {
    storage.set(keyFor(path, scope), JSON.stringify(value));
};

export const forgetDownload = (path, scope = getDownloadScope()) => {
    storage.delete(keyFor(path, scope));
};
