import { closeModal, openModal } from "../reducers/modalReducer";
import { setData } from "../reducers/testReducer";
import { store } from "../store"
import { addToGroup, copy, createDir, delete_, getFavoritesNames, getFile, move, removeFromGroup, rename } from "./data-transmission-utils"
import { chunkSize } from "../constants";
import { fileExistsCheck, mkFolder, registerDownloadedPath, writeFileToLocal } from "./local-files";
import { groupsByFolder, locationGenerator, parseFile, storageInfo } from "./essential-functions";
import Share from 'react-native-share';
import * as DocumentPicker from 'expo-document-picker'
import { setPickedFiles } from "../reducers/filesTransferNewReducer";
import RNFetchBlob from "react-native-blob-util";
import { Platform } from "react-native";
import { setEmptySelectedFiles, setFavoritesContent, setFavoritesList, setOrder } from "../reducers/fileReducer";
import { addToMMKV, deleteRouterMMKV, multiRemoveMMKV, renameMMKVFile, renameMMKVFolder, updateMultiplyMoveMMKV } from "./mmkv";
import { downloadClearProgress, downloadRemoveQueue, downloadSetProgress, downloadSetQueue } from "../reducers/filesTransferNewReducer";
import { enqueue, forceEnqueue } from "../reducers/refreshQueueReducer";
import { setScreenBehavior } from "../reducers/screenControllerReducer";
import { useErrorAlert } from "../hooks/useErrorAlert";
import { streamReceiver } from "./file-reading";
import BackgroundService from 'react-native-background-actions';

global.Buffer = global.Buffer || require('buffer').Buffer


const delay = ms => new Promise(res => setTimeout(res, ms));


let currentScreenList = {
    'Cloud': 'CloudScreen',
    'Favorite': 'FavoriteScreen',
    "Media": 'MediaScreen',
}

export const downloadFile = async () => {
    const { files: { selectedFile, location }, bottomSheetManager: { fromScreen }, newFileTransfer: { downloadQueue } } = store.getState();
    const editedFile = { ...selectedFile, location: fromScreen === 'CloudScreen' ? location : selectedFile.location }

    if (downloadQueue.includes(editedFile.path)) return;

    store.dispatch(downloadSetQueue(editedFile.path));
    store.dispatch(downloadSetProgress({ path: editedFile.path, progress: 0 }));
    try {
        const timingStart = Date.now();
        console.log('[DL] start', editedFile.path);
        const file = await getFile(editedFile.path, 1, editedFile.rawDate)
        console.log('[DL] getFile done', { ms: Date.now() - timingStart });
        const folder = await mkFolder(file);
        console.log('[DL] mkFolder done', { ms: Date.now() - timingStart });
        const savedPath = await writeFileToLocal(file, editedFile.name, folder, editedFile);
        console.log('[DL] writeFileToLocal done', { ms: Date.now() - timingStart, savedPath });
        registerDownloadedPath(editedFile.path, savedPath);
        console.log('[DL] registerDownloadedPath done', { ms: Date.now() - timingStart });
        await addToMMKV(editedFile);
        console.log('[DL] addToMMKV done', { ms: Date.now() - timingStart });
    } finally {
        store.dispatch(downloadClearProgress(editedFile.path));
        store.dispatch(downloadRemoveQueue(editedFile.path));
    }
}

const pathSplitter = (path) => {
    const split = path.split('/');
    const name = split.pop();

    return { path: split.join('/'), name }
}

export const remove = async () => {
    let forceRefresh = null;
    let enqueueList = ['CloudScreen', 'ProfileScreen', 'FavoriteScreen', 'MediaScreen'];
    const { selectedFile } = store.getState()?.files
    let file = pathSplitter(selectedFile.path);


    if (selectedFile.type === 'folder') {
        file = pathSplitter(selectedFile.path);
    }


    let callback = () => {
        delete_(file.path, file.name)
            .then(res => {
                let cloudLocation = store.getState().files.location;
                let current = store.getState().bottomSheetManager.current;

                if (cloudLocation === file.path) {
                    let parsed = parseFile(res, true, cloudLocation);
                    store.dispatch(setData(parsed));
                    delete enqueueList[0];
                }

                if (current !== 'Cloud') {
                    forceRefresh = currentScreenList[current];
                }

                deleteRouterMMKV(selectedFile);
                store.dispatch(enqueue(enqueueList));
                store.dispatch(forceEnqueue(forceRefresh))
            })
            .catch(err => useErrorAlert('delete err', err));
    }

    store.dispatch(openModal({
        content: 'Are you sure you want to remove this file?',
        head: selectedFile.name,
        type: 'confirm',
        icon: 'question',
        callback: callback
    }))
}



export const addToFavorite = () => {
    store.dispatch(setScreenBehavior({ routeName: 'FavoriteScreen', loader: true, blocker: false }))
    let path = store.getState()?.files.selectedFile.path

    addToGroup("favorites", path)
        .then(favorites => {
            const favoriteNames = favorites.map(items => items.Name.replace('loudBoxNuget/Cloud0/', ''));
            store.dispatch(setFavoritesList(favoriteNames));
            const data = parseFile(favorites, true, '');
            store.dispatch(setFavoritesContent(data));
        })
        .finally(() => {
            store.dispatch(setScreenBehavior({ routeName: 'FavoriteScreen', loader: false }))
        })
}

export const removeFromFavorite = () => {
    store.dispatch(setScreenBehavior({ routeName: 'FavoriteScreen', loader: true, blocker: false }))
    const path = store.getState()?.files.selectedFile.path;

    removeFromGroup("favorites", path)
        .then((favorites) => {
            const favoriteNames = favorites.map(items => items.Name.replace('loudBoxNuget/Cloud0/', ''));
            store.dispatch(setFavoritesList(favoriteNames));
            const data = parseFile(favorites, true, '');
            store.dispatch(setFavoritesContent(data));
        })
        .finally(() => {
            store.dispatch(setScreenBehavior({ routeName: 'FavoriteScreen', loader: false }))
        })
}



const renameFileCallback = (file) => {

    let forceRefresh = null;
    let enqueueList = [];
    const { text } = store.getState()?.modalController;
    let name = file.path.split('/').reverse()[0];
    let current = store.getState().bottomSheetManager.current;
    let location = file.location;


    if (current == 'Cloud') {
        location = store.getState().files.location;
    }



    rename(location, name, text)
        .then((response) => {
            let parse = parseFile(response, true, location);

            if (file.path.startsWith(store.getState().files.location)) {
                store.dispatch(setData(parse))
                let i = enqueueList.indexOf('CloudScreen');
                delete enqueueList[i];
            }

            if (file.isFavorite) {
                getFavoritesNames().then(favs => {
                    const parsed = parseFile(favs);
                    store.dispatch(setFavoritesContent(parsed));
                })
            }

            if (file.type == 'image' && current !== 'Media') {
                enqueueList.push('MediaScreen')
            }

            if (current !== 'Cloud') {
                forceRefresh = currentScreenList[current];
            }

            renameMMKVFile({ path: file.path, location: file.location, name: text, newArr: parse })
            store.dispatch(enqueue(enqueueList));
            store.dispatch(forceEnqueue(forceRefresh))
        })
        .catch((err) => useErrorAlert('rename error', err))
        .finally(() => store.dispatch(closeModal()))


}

const renameFolderCallback = (folder) => {
    let enqueueList = ['FavoriteScreen', 'CloudScreen', 'MediaScreen'];
    const { text } = store.getState()?.modalController;

    rename(folder.location, folder.name, text)
        .then(response => {
            if (folder.screen === 'CloudScreen') {
                let parse = parseFile(response, true, folder.location);
                store.dispatch(setData(parse))
                let i = enqueueList.indexOf('CloudScreen');
                delete enqueueList[i];
            }

            if (folder.screen === 'FavoriteScreen') {
                let i = enqueueList.indexOf('FavoriteScreen');
                delete enqueueList[i];
                store.dispatch(forceEnqueue('FavoriteScreen'))
            }
            renameMMKVFolder(folder.location, folder.name)
            store.dispatch(enqueue(enqueueList));
        })
        .catch((err) => err)
        .finally(() => store.dispatch(closeModal()))

}

export const renameFile = async () => {
    const { selectedFile } = store.getState()?.files

    if (selectedFile.type === 'folder') {
        store.dispatch(openModal({
            content: selectedFile.name,
            head: 'Attention',
            content: 'If you change the folder name, all files added to favorites inside the folder will be removed from favorites and if the file was already in the home screen, then that file will be deleted',
            icon: 'ex',
            type: 'info',
            callback: () => {
                store.dispatch(openModal({
                    content: selectedFile.name,
                    head: 'Rename',
                    type: 'input',
                    callback: () => renameFolderCallback(selectedFile)
                }))
            }
        }))
        return;
    }

    store.dispatch(openModal({
        content: selectedFile.name,
        head: 'Rename',
        type: 'input',
        callback: () => renameFileCallback(selectedFile)
    }))
}

export const shareFile = async () => {

    const { files: { selectedFile, location }, bottomSheetManager: { fromScreen } } = store.getState();
    const editedFile = {
        ...selectedFile,
        location: fromScreen === 'CloudScreen' ? location : selectedFile.location
    }

    const { source } = await fileExistsCheck(editedFile);
    if (!source) return store.dispatch(openModal({
        content: 'File not downloaded. Dou you want to download it?',
        head: editedFile.name,
        type: 'confirm',
        icon: 'check',
        callback: () => downloadFile()
    }))
    else {
        try {
            await Share.open({
                url: source,
                title: `Shareing ${editedFile.name} from Graphene Cloud Explorer`
            });
        }
        catch {
            useErrorAlert('share error', `Share failed within`);
        }
    }

};
export const createDirectory = () => {
    const { location } = store.getState().files;
    const callback = () => {
        const { text } = store.getState()?.modalController;
        createDir(location, text)
            .then((data) => {
                let parse = parseFile(data);
                store.dispatch(setData(parse))
            })
            .finally(() => store.dispatch(closeModal()))
    }

    store.dispatch(openModal({
        content: '',
        head: 'Create directory',
        type: 'input',
        callback: callback
    }))
}

export const onlyPick = async (closeBottomSheet) => {
    store.dispatch(openModal({ type: 'prepare' }));
    const checkStorage = await storageInfo();

    if (!checkStorage) {
        return store.dispatch(openModal({
            content: 'Make sure your phone has an active internet connection and checking the network.',
            type: 'info',
            head: 'Network connection failed',
            icon: 'ex',
        }))
    }

    try {
        const { location } = store.getState()?.files
        const result = await DocumentPicker.getDocumentAsync({
            multiple: false,
            copyToCacheDirectory: true,
        });
        if (result.canceled || !result.assets?.length) return;

        const [asset] = result.assets;
        const pickedFile = {
            name: asset.name,
            size: asset.size || 0,
            type: asset.mimeType || 'application/octet-stream',
            uri: asset.uri,
        };

        const availableStorage = store.getState().profile.totalMemory;
        if (availableStorage != -1 && pickedFile.size > availableStorage) {
            return store.dispatch(openModal({
                content: 'Graphene Cloud Explorer memory is already full. Delete unnecessary data to upload a new file.',
                type: 'info',
                head: "Graphene Cloud Explorer is full",
                icon: 'ex',
            }))
        }

        store.dispatch(setPickedFiles([pickedFile]));
        startMultiUpload(location, closeBottomSheet)

    } catch (error) {
        return error;
    }
    finally {
        store.dispatch(closeModal());
    }



}

export const pickMultiply = async (bottomSheetController, fromScreen) => {
    store.dispatch(openModal({ type: 'prepare' }));
    const checkStorage = await storageInfo();


    if (!checkStorage) {
        return store.dispatch(openModal({
            content: 'Make sure your phone has an active internet connection and checking the network.',
            type: 'info',
            head: 'Network connection failed',
            icon: 'ex',
        }))
    }


    try {
        const result = await DocumentPicker.getDocumentAsync({
            multiple: true,
            copyToCacheDirectory: true,
        });

        if (result.canceled || !result.assets?.length) return;

        const pickedFiles = result.assets.map((asset) => ({
            name: asset.name,
            size: asset.size || 0,
            type: asset.mimeType || 'application/octet-stream',
            uri: asset.uri,
        }));


        const sumOfFileSize = pickedFiles.reduce((accumulator, object) => {
            return accumulator + object.size;
        }, 0);

        if (pickedFiles.length > 15) {
            return store.dispatch(openModal({
                content: 'The files you select must not be more than 15',
                type: 'info',
                head: 'Failed to picked file',
                icon: 'ex',
            }))
        }

        const availableStorage = store.getState().profile.totalMemory;
        if (availableStorage != -1 && sumOfFileSize > availableStorage) {
            return store.dispatch(openModal({
                content: 'Graphene Cloud Explorer memory is already full. Delete unnecessary data to upload a new file.',
                type: 'info',
                head: "Graphene Cloud Explorer is full",
                icon: 'ex',
            }))
        }

        store.dispatch(setPickedFiles(pickedFiles));
        bottomSheetController(3, fromScreen);
    }
    catch (err) {
        return err;
    }
    finally {
        store.dispatch(closeModal());
    }
}


export const openCopyMoveSheet = async (bottomSheetController, closeBottomSheet, order) => {
    const controlling = new Promise((resolve, reject) => {
        setTimeout(() => {
            resolve(closeBottomSheet());
        }, 335)

    });
    controlling.then(() => bottomSheetController(4));
    return store.dispatch(setOrder(order))
}

// ---- copy ----
export const copySingle = async (target, setDisabled, closeBottomSheet, locationEditor) => {
    setDisabled(true)
    const { selectedFile } = store.getState().files;
    const location = locationGenerator(selectedFile.path);
    let current = store.getState().bottomSheetManager.current;
    let enqueueList = ['CloudScreen', 'MediaScreen', 'FavoriteScreen', 'ProfileScreen'];

    copy(location, selectedFile.name, target).then((res) => {
        closeBottomSheet();
        locationEditor('');
        setDisabled(false);
        store.dispatch(forceEnqueue(currentScreenList[current]))
        let i = enqueueList.indexOf(currentScreenList[current]);
        delete enqueueList[i];
        store.dispatch(enqueue(enqueueList));
    })
}
export const multiplyCopy = (target, setDisabled, closeBottomSheet, locationEditor) => {
    setDisabled(true)
    let enqueueList = ['CloudScreen', 'MediaScreen', 'FavoriteScreen', 'ProfileScreen'];
    let current = store.getState().bottomSheetManager.current;
    const { selectedFiles } = store.getState().files;

    const send = () => new Promise((resolve, reject) => {
        groupsByFolder(selectedFiles.map(files => files.path))
            .map(groups => {
                return copy(groups[0], groups[1], target)
            })
        return resolve();
    })

    send()
        .then(() => {
            store.dispatch(setEmptySelectedFiles())
            setDisabled(false);
            closeBottomSheet();
            locationEditor('');
        }).finally(() => {
            store.dispatch(forceEnqueue(currentScreenList[current]))
            let i = enqueueList.indexOf(currentScreenList[current]);
            delete enqueueList[i];
            store.dispatch(enqueue(enqueueList));
        })
}
// ---- copy ----

// ---- move ----

export const moveSingle = (target, setDisabled, closeBottomSheet, locationEditor) => {

    let enqueueList = ['CloudScreen', 'MediaScreen', 'FavoriteScreen'];


    setDisabled(true)
    const { selectedFile } = store.getState().files;
    const location = locationGenerator(selectedFile.path);
    move(location, selectedFile.name, target).then((res) => {
        let current = store.getState().bottomSheetManager.current;
        setDisabled(false);
        closeBottomSheet();
        locationEditor('');
        store.dispatch(forceEnqueue(currentScreenList[current]))
        let i = enqueueList.indexOf(currentScreenList[current]);
        delete enqueueList[i];
        store.dispatch(enqueue(enqueueList));
    })
}

const changeFileCredentials = (selectedFile, target) => {
    groupsByFolder(selectedFile.map(file => file.path))
        .map(async groups => {
            await updateMultiplyMoveMMKV(groups[0], groups[1], target)
        })

}

export const multiplyMove = (target, setDisabled, closeBottomSheet, locationEditor) => {
    let enqueueList = ['CloudScreen', 'MediaScreen', 'FavoriteScreen'];
    setDisabled(true)
    const { selectedFiles } = store.getState().files;

    const send = () => new Promise((resolve, reject) => {
        groupsByFolder(selectedFiles.map(files => files.path))
            .map(groups => {
                move(groups[0], groups[1], target);
                return
            })
        return resolve();
    })
    send()
        .then(() => {
            changeFileCredentials(selectedFiles, target);
            store.dispatch(setEmptySelectedFiles())
            setDisabled(false);
            closeBottomSheet();
            locationEditor('');
        }).finally(() => {
            let current = store.getState().bottomSheetManager.current;
            store.dispatch(forceEnqueue(currentScreenList[current]))
            let i = enqueueList.indexOf(currentScreenList[current]);
            delete enqueueList[i];
            store.dispatch(enqueue(enqueueList));
            // store.dispatch(renderScreen(['CloudScreen', 'MediaScreen', 'FavoriteScreen']));

        })
}

// ---- move ----

export const removeMultiple = async () => {
    let enqueueList = ['CloudScreen', 'MediaScreen', 'FavoriteScreen', 'ProfileScreen'];
    let current = store.getState().bottomSheetManager.current;

    const { selectedFiles } = store.getState()?.files;
    const send = () => new Promise((resolve, reject) => {
        groupsByFolder(selectedFiles.map(files => files.path))
            .map(groups => delete_(groups[0], groups[1]).then(() => multiRemoveMMKV(groups[0], groups[1])))
        return resolve();
    })

    await send();
    store.dispatch(setEmptySelectedFiles());
    let i = enqueueList.indexOf(currentScreenList[current]);
    delete enqueueList[i];
    store.dispatch(forceEnqueue(currentScreenList[current]))
    store.dispatch(enqueue(enqueueList));
}

async function modifier(arr, path) {
    return new Promise(async resolve => {
        let newArr = [];
        let sum = 0;
        const fixedPath = path !== "" ? path + '/' : path;
        for await (const elements of arr) {
            const { size, path } = await RNFetchBlob.fs.stat(elements.filePath.replace('file:', ''))
            let name = elements.fileName;
            sum = parseInt(sum) + parseInt(size);

            newArr.push({
                path: fixedPath,
                name: name.replace(/-|'|’|"|~|`|\^/gm, ""),
                uri: path,
                size: size
            })
        }

        resolve({ data: newArr, allSize: sum });
    })

}


export const startIntentUpload = async (path, closeBottomSheet) => {
    closeBottomSheet();

    var modifiedFiles = [...store.getState().newFileTransfer.intentFile];
    store.dispatch(openModal({ type: 'prepare' }));
    const storageSize = await storageInfo();


    if (!storageSize) {
        store.dispatch(closeModal());
        return store.dispatch(openModal({
            content: 'Make sure your phone has an active internet connection and checking the network.',
            type: 'info',
            head: 'Network connection failed',
            icon: 'ex',
        }))
    }

    let { data, allSize } = await modifier(modifiedFiles, path);


    if (Platform.OS === 'ios') {
        data = data.map(elements => {
            let uri = elements.uri;
            uri = decodeURIComponent(uri.replace('file:', ''));
            return { ...elements, uri }
        });
    }



    if (storageSize != -1 && allSize > storageSize) {
        return store.dispatch(openModal({
            content: 'Graphene Cloud Explorer memory is already full. Delete unnecessary data to upload a new file.',
            type: 'info',
            head: "Graphene Cloud Explorer is full",
            icon: 'ex',
        }))
    }

    const options = {
        taskName: 'Files Upload',
        taskTitle: 'Files upload to cloud',
        taskDesc: "Don't kill app while upload",
        taskIcon: {
            name: 'ic_launcher',
            type: 'mipmap',
        },
        color: '#fefefe',
        linkingURI: 'yourSchemeHere://chat/jane', // See Deep Linking for more info
        parameters: {
            elements: data,
        },
    };


    await delay(500);
    store.dispatch(closeModal());
    await BackgroundService.start(readFileStream, options);
}



export const startMultiUpload = async (path, closeBottomSheet) => {
    let fixedPath = path?.length ? path + '/' : path;
    let allFileSize = 0;
    var modifiedFiles = [...store.getState().newFileTransfer.pickedFiles];

    modifiedFiles = modifiedFiles.map(elements => {
        let name = elements.name;
        name = name.replace(/-|'|’|"|~|`|\^/gm, "");
        allFileSize += parseInt(elements.size);
        return { ...elements, path: fixedPath, name };
    })


    if (Platform.OS === 'ios') {
        modifiedFiles = modifiedFiles.map(elements => {
            let uri = elements.uri;
            uri = decodeURIComponent(uri.replace('file:', ''));
            return { ...elements, uri }
        });
    }


    const options = {
        taskName: 'Files Upload',
        taskTitle: 'Files upload to cloud',
        taskDesc: "Don't kill app while upload",
        taskIcon: {
            name: 'ic_launcher',
            type: 'mipmap',
        },
        color: '#fefefe',
        linkingURI: 'yourSchemeHere://chat/jane', // See Deep Linking for more info
        parameters: {
            elements: modifiedFiles,
        },
    };


    storageInfo();
    closeBottomSheet();
    await delay(200);
    store.dispatch(openModal({ type: 'prepare' }))
    await delay(500);
    await BackgroundService.start(readFileStream, options);

}

let isStartReading = false;
let fss = [];



const readFileStream = async (args) => {
    let { elements } = args;
    if (Array.isArray(elements)) {
        fss = [...fss, ...elements];
    }
    else fss.push(elements);

    if (isStartReading) {
        return;
    }
    isStartReading = true;
    for (const iterator of fss) {
        await new Promise((res, rej) => {
            return RNFetchBlob.fs.readStream(
                iterator.uri,
                'base64',
                chunkSize
            )
                .then((ifstream) => {
                    store.dispatch(closeModal());
                    ifstream.open();

                    ifstream.onData(data => {
                        streamReceiver(iterator, data);
                    })
                    ifstream.onError((err) => err);
                    ifstream.onEnd(() => {
                        fss = fss.filter(elements => elements.uri !== iterator.uri);
                        if (fss.length == 0) {
                            isStartReading = false;
                        }
                        return res();
                    })
                })
        })
    }

}





