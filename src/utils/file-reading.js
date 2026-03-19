import { enqueue, forceEnqueue } from "../reducers/refreshQueueReducer";
import { store } from "../store";
import { setFileStream } from "./data-transmission-utils";
import { clearUploadNotification, displayUploadNotification, errorMessageNotification } from "./notification-utils";
import { finishUploadProgress } from "./files-trasnfer";
import BackgroundService from 'react-native-background-actions';

let currentScreenList = {
    'Cloud': 'CloudScreen',
    'Favorite': 'FavoriteScreen',
    "Media": 'MediaScreen',
}

let isStart = false;
let object = [];
const wm = new WeakMap();

export const streamReceiver = async (file, bin) => {
    if (!isStart) {
        setTimeout(() => processStart(), 1000)
        isStart = true;
    }

    if (wm.has(file) === false) {
        wm.set(file, [bin]);
        object.push(file);
        return;
    }

    let f = wm.get(file);
    f.push(bin);
    wm.set(file, f);
}

let index = 0;

export const processStart = async () => {
    let forceRefresh = null;
    let enqueueList = ['CloudScreen', 'ProfileScreen', 'FavoriteScreen', 'MediaScreen'];
    if (object[index] !== undefined) {
        const currentFile = object[index];
        displayUploadNotification(currentFile.name, currentFile.path);
        let f = wm.get(currentFile);
        f.push('for additional index')
        var i = 0;
        try {
            for (const BINARY of f) {
                await setFileStream(BINARY, currentFile, i + 1, currentFile.path);
                i++
            }
        } catch (error) {
            finishUploadProgress({ name: currentFile.name, size: 0, chunkNumber: i, parts: f.length });
            await errorMessageNotification();
            delete object[index];
            wm.delete(currentFile);
            index = index + 1;
            if (object[index] !== undefined) {
                processStart();
                return
            }
            await BackgroundService.stop();
            isStart = false;
            return;
        }
        let cloudLocation = store.getState().files.location !== "" ? store.getState().files.location + '/' : store.getState().files.location;
        let current = store.getState().bottomSheetManager.current;
        clearUploadNotification(currentFile.name, currentFile.path)
        if (cloudLocation === currentFile.path) {
            forceRefresh = "CloudScreen"
            delete enqueueList[0];
        }

        if (current !== 'Cloud') {
            forceRefresh = currentScreenList[current];
        }

        store.dispatch(enqueue(enqueueList));
        store.dispatch(forceEnqueue(forceRefresh))

        delete object[index];
        wm.delete(currentFile);
        index = index + 1;
        if (object[index] !== undefined) {
            processStart();
            return
        }
        await BackgroundService.stop();
        isStart = false;
        return;
    }
    isStart = false;
}
