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
        var i = 0;
        const delay = (ms) => new Promise(res => setTimeout(res, ms));
        let done = false;
        try {
            while (!done) {
                // Wait for the next chunk to be available in the array
                while (f.length <= i) {
                    await delay(100);
                }
                const BINARY = f[i];

                if (BINARY === 'EOF') {
                    done = true;
                    // Process the final verification step
                    let retryCount = 0;
                    const maxRetries = 3;
                    let success = false;
                    while (!success && retryCount < maxRetries) {
                        try {
                            await setFileStream('for additional index', currentFile, i + 1, currentFile.path);
                            success = true;
                        } catch (err) {
                            retryCount++;
                            console.warn(`[Upload] Finalization failed (attempt ${retryCount}/${maxRetries}):`, err);
                            if (retryCount >= maxRetries) throw err;
                            await delay(3000);
                        }
                    }
                    break; // Exit chunk processing loop
                }

                let retryCount = 0;
                const maxRetries = 3;
                let success = false;

                while (!success && retryCount < maxRetries) {
                    try {
                        await setFileStream(BINARY, currentFile, i + 1, currentFile.path);
                        success = true;
                    } catch (err) {
                        retryCount++;
                        console.warn(`[Upload] Chunk ${i + 1} failed (attempt ${retryCount}/${maxRetries}):`, err);
                        if (retryCount >= maxRetries) throw err;
                        await delay(3000); // wait 3 seconds before retry
                    }
                }
                i++;
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
            object = [];
            index = 0;
            return;
        }
        clearUploadNotification(currentFile.name, currentFile.path)
        delete object[index];
        wm.delete(currentFile);
        index = index + 1;
        if (object[index] !== undefined) {
            processStart();
            return
        }

        // Only refresh UI after all files are finished
        let cloudLocation = store.getState().files.location !== "" ? store.getState().files.location + '/' : store.getState().files.location;
        let current = store.getState().bottomSheetManager.current;
        if (cloudLocation === currentFile.path) {
            forceRefresh = "CloudScreen"
            delete enqueueList[0];
        }
        if (current !== 'Cloud') {
            forceRefresh = currentScreenList[current];
        }
        store.dispatch(enqueue(enqueueList));
        store.dispatch(forceEnqueue(forceRefresh))

        await BackgroundService.stop();
        isStart = false;
        object = [];
        index = 0;
        return;
    }
    isStart = false;
}
