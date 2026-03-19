import { Platform } from "react-native";
import RNFetchBlob from "rn-fetch-blob";
import { setFromScreen } from "../../reducers/bottomSheetReducer";
import { setSelectedFile } from "../../reducers/fileReducer";
import { openModal } from "../../reducers/modalReducer";
import { getCellularInfoMMKV } from "../../utils/mmkv";
import { downloadFile } from "../../utils/settings-utils";
import { ensureNotificationPermission } from "../../utils/notification-utils";
import { reportCrash } from "../../utils/crashlytics-utils";

const directlyDownloadable = ['image', 'document', 'pdf', 'txt', 'presentation', 'spreadsheet'];

export const downloadManager = async (dispatch, name, file, queue, network) => {
    dispatch(setFromScreen(name));
    dispatch(setSelectedFile(file));


    if (queue.includes(file.path)) {
        dispatch(openModal({
            content: 'File already in progress',
            head: file.name,
            type: 'info',
            icon: 'check',
        }))
        return
    }

    if (network.type === 'cellular') {
        networkCheck(file, dispatch);
        return
    }

    if (!(await ensureNotificationPermission())) {
        dispatch(openModal({
            content: 'Download started, but notifications are disabled for this app. Enable notifications in Android settings to see progress.',
            head: 'Notifications disabled',
            type: 'info',
            icon: 'ex',
        }))
    }

    if (directlyDownloadable.includes(file.type)) {
        return downloadFile();
    }

    dispatch(openModal({
        content: 'File not downloaded. Dou you want to download it?',
        head: file.name,
        type: 'confirm',
        icon: 'check',
        callback: () => downloadFile()
    }))
}

export const openFileNatively = async (uri, mime, source) => {
    const normalizedUri = typeof uri === 'string' ? uri.replace('file://', '') : '';
    const normalizedSource = typeof source === 'string'
        ? source
        : (normalizedUri ? `file://${normalizedUri}` : '');
    const safeMime = mime || 'application/octet-stream';

    const open = Platform.select({
        ios: () => RNFetchBlob.ios.openDocument(normalizedSource),
        android: () => RNFetchBlob.android.actionViewIntent(normalizedUri, safeMime)
    });

    try {
        await open?.();
    } catch (error) {
        reportCrash(error, {
            screen: 'ViewItems',
            flow: 'openFileNativelyPrimary',
            platform: Platform.OS,
            androidVersion: Platform.OS === 'android' ? String(Platform.Version) : 'n/a',
            uri: normalizedUri,
            mime: safeMime,
        });

        if (Platform.OS === 'android' && normalizedUri) {
            try {
                await RNFetchBlob.android.actionViewIntent(normalizedUri, '*/*');
                return true;
            } catch (fallbackError) {
                reportCrash(fallbackError, {
                    screen: 'ViewItems',
                    flow: 'openFileNativelyFallback',
                    platform: Platform.OS,
                    androidVersion: String(Platform.Version),
                    uri: normalizedUri,
                    mime: '*/*',
                });
            }
        }

        return false;
    }

    return true;
}

const hideExtension = (fileName) => {
    if (!fileName) return fileName;
    const dotIndex = fileName.lastIndexOf('.');
    if (dotIndex <= 0 || dotIndex === fileName.length - 1) return fileName;
    return fileName.slice(0, dotIndex);
}

export const titleShortener = (title, name, type) => {
    const [lastName, folder, other] = title.split('/').reverse();
    const normalizedLastName = type === 'folder' ? lastName : hideExtension(lastName);

    if (name === "CloudScreen") return normalizedLastName;
    else if (other) return `../${folder}/${normalizedLastName}`
    else if (folder) return `${folder}/${normalizedLastName}`
    return normalizedLastName
}


export const networkCheck = async (file, dispatch) => {
    const isToggled = await getCellularInfoMMKV();
    if (isToggled === false) {
        dispatch(openModal({
            content: 'Cellular data usage is off. Are you sure you want to use cellular data for this action?',
            head: "You use cellular connection",
            type: 'confirm',
            icon: 'ex',
            callback: () => downloadFile()
        }))

        return;
    }

    if (!(await ensureNotificationPermission())) {
        dispatch(openModal({
            content: 'Download started, but notifications are disabled for this app. Enable notifications in Android settings to see progress.',
            head: 'Notifications disabled',
            type: 'info',
            icon: 'ex',
        }))
    }

    if (directlyDownloadable.includes(file.type)) {
        return downloadFile();
    }

    dispatch(openModal({
        content: 'File not downloaded. Dou you want to download it?',
        head: file.name,
        type: 'confirm',
        icon: 'check',
        callback: () => downloadFile()
    }))

}
