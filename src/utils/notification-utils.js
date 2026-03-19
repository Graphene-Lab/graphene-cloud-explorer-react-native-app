import notifee, { AndroidImportance, AndroidStyle } from '@notifee/react-native';
import { PermissionsAndroid, Platform } from 'react-native';


let lists = {};

const enqueueNotification = (id, task) => {
    const entry = lists[id];
    if (!entry || entry.disabled) return Promise.resolve(false);
    entry.queue = (entry.queue || Promise.resolve())
        .then(() => task())
        .catch((err) => {
            console.log('[notification] error', err);
        });
    return entry.queue;
};

export const ensureNotificationPermission = async () => {
    if (Platform.OS !== 'android' || Platform.Version < 33) return true;

    const permission = PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS;
    const hasPermission = await PermissionsAndroid.check(permission);
    if (hasPermission) return true;

    const result = await PermissionsAndroid.request(permission);
    return result === PermissionsAndroid.RESULTS.GRANTED;
};

export const displayUploadNotification = async (title, path) => {
    if (!(await ensureNotificationPermission())) {
        lists[id].disabled = true;
        return;
    }
    await notifee.requestPermission()
    const channelId = await notifee.createChannel({
        id: 'com.cloudStorage.upload',
        name: 'Default Channel',
        playSound: true
    });
    await notifee.displayNotification({
        title: title,
        body: `File uploading to ${path !== "" ? path : 'Cloud Services'}`,
        android: {
            channelId,
            smallIcon: 'ic_small_icon',
            pressAction: {
                id: 'channel-upload',
            },
        },
    });
}

export const clearUploadNotification = async (title, path) => {
    await notifee.displayNotification({
        title: title,
        body: `File uploaded successfully to ${path !== "" ? path : 'Cloud Services'}`,
        android: {
            channelId: 'com.cloudStorage.upload',
            smallIcon: 'ic_small_icon',
            // smallIcon: 'name-of-a-small-icon', // optional, defaults to 'ic_launcher'.
            // pressAction is needed if you want the notification to open the app when pressed
            pressAction: {
                id: 'com.cloudStorage.upload',
            },
            // progress: {
            //     max: 10,
            //     current: 5,
            // },
        },
    });
    // await notifee.deleteChannel('com.cloudStorage.upload');
}


export const errorMessageNotification = async () => {
    await notifee.displayNotification({
        title: 'Upload cancelled',
        body: 'Something went wrong, please try again',
        android: {
            channelId: 'com.cloudStorage.upload',
            smallIcon: 'ic_small_icon',
            pressAction: {
                id: 'com.cloudStorage.upload',
            },
        }
    })
    await notifee.deleteChannel('com.cloudStorage.upload');
}


// ---------- new arc ---------

export const downloadNotificationRegister = async ({ id, title, size, max }) => {
    lists[id] = {
        id,
        size,
        max,
        queue: Promise.resolve(),
        lastCurrent: 0,
        completionQueued: false,
        disabled: false,
    };
    if (!(await ensureNotificationPermission())) return;
    await notifee.requestPermission()
    const channelId = await notifee.createChannel({
        id: 'com.cloudStorage.download',
        name: 'Default Channel',
        playSound: true,
        importance: AndroidImportance.HIGH,
    });
    await enqueueNotification(id, () => notifee.displayNotification({
        id,
        title,
        body: `File downloading | ${size}`,
        android: {
            channelId,
            smallIcon: 'ic_small_icon',
            progress: {
                max: 0,
                current: 0,
                indeterminate: true,
                importance: AndroidImportance.HIGH,
            }
        }
    }));
}

export const notificationUpdate = async ({ id, current, title }) => {
    const entry = lists[id];
    if (!entry || entry.disabled || entry.completionQueued) return;
    const safeCurrent = Math.max(entry.lastCurrent || 0, current || 0);
    entry.lastCurrent = safeCurrent;
    const percent = entry.max ? Math.floor((safeCurrent * 100) / entry.max) : 0;
    await enqueueNotification(id, () => notifee.displayNotification({
        id,
        title,
        body: `File downloading: ${percent}%`,
        android: {
            channelId: 'com.cloudStorage.download',
            smallIcon: 'ic_small_icon',
            style: { type: AndroidStyle.BIGTEXT, text: `Size | ${entry.size}` },
            progress: {
                max: entry.max,
                current: safeCurrent,
                indeterminate: false,
            }
        }
    }));
}

export const cancelNotification = async ({ id, title }) => {
    const entry = lists[id];
    if (!entry) return;
    entry.completionQueued = true;
    const completion = enqueueNotification(id, () => notifee.displayNotification({
        id,
        title,
        body: "File downloaded successfully | 100%",
        android: {
            channelId: 'com.cloudStorage.download',
            smallIcon: 'ic_small_icon',
            importance: AndroidImportance.HIGH,
            progress: {
                max: 0,
                current: 0,
                indeterminate: false,
            },
        }
    }));
    if (entry.queue) {
        entry.queue.finally(() => {
            delete lists[id];
        });
    } else {
        delete lists[id];
    }
    return completion;
}
