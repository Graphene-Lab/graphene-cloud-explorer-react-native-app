import { NativeModules, Platform } from 'react-native';
import RNFetchBlob from 'react-native-blob-util';
import Share from 'react-native-share';
import { reportCrash } from './crashlytics-utils';

export const openFileNatively = async (uri, mime, source) => {
    const path = typeof uri === 'string' ? uri.replace(/^file:\/\//, '') : '';
    const safeMime = mime || 'application/octet-stream';
    const open = (type) => {
        if (Platform.OS === 'ios') return RNFetchBlob.ios.openDocument(source || `file://${path}`);
        if (path.startsWith('content://')) return NativeModules.PublicDownloads.openFile(path, type);
        return RNFetchBlob.android.actionViewIntent(path, type);
    };
    try {
        await open(safeMime);
        return true;
    } catch (error) {
        reportCrash(error, {
            screen: 'ViewItems', flow: 'openFileNativelyPrimary', platform: Platform.OS,
            androidVersion: Platform.OS === 'android' ? String(Platform.Version) : 'n/a',
            uri: path, mime: safeMime,
        });
        if (Platform.OS === 'android' && path) {
            try {
                await open('*/*');
                return true;
            } catch (fallbackError) {
                reportCrash(fallbackError, {
                    screen: 'ViewItems', flow: 'openFileNativelyFallback', platform: Platform.OS,
                    androidVersion: String(Platform.Version), uri: path, mime: '*/*',
                });
            }
        }
        return false;
    }
};

export const shareLocalFile = async ({ source, mime, title }) => {
    if (Platform.OS === 'android' && source.startsWith('content://')) {
        return NativeModules.PublicDownloads.shareFile(source, mime, title);
    }
    return Share.open({ url: source, type: mime, title });
};
