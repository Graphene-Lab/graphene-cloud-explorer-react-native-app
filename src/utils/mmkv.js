import { MMKVLoader } from "react-native-mmkv-storage";
import { renderScreen } from "../reducers/screenRerenderReducer";
import { store } from "../store";
const MMKV = new MMKVLoader().initialize(); // Returns an MMKV Instance 

export const addToMMKV = async (obj) => {
    let arr = await MMKV.getArrayAsync("lasts");
    if (arr !== null && arr.length > 0) {
        arr?.some(async (sql) => {
            if (sql.title == obj.title && sql.name === obj.name && sql.type === obj.type && obj.path == sql.path) {
                return true;
            } else {
                if (arr.length > 15) arr.pop();
                await MMKV.setArrayAsync("lasts", [obj, ...arr]);
                store.dispatch(renderScreen(['HomeScreen']))
            }

        });
    }
    else if (arr?.length == 0) {
        await MMKV.setArrayAsync("lasts", [obj]);
        store.dispatch(renderScreen(['HomeScreen']))
    }
    else {
        await MMKV.setArrayAsync("lasts", [obj]);
        store.dispatch(renderScreen(['HomeScreen']))
    }

}


const deleteFile = async (obj) => {
    let arr = await MMKV.getArrayAsync("lasts");
    if (arr !== null) {
        const filtered = arr.filter(i => i.path !== obj.path)
        await MMKV.setArrayAsync("lasts", filtered);
        store.dispatch(renderScreen(['HomeScreen']))
    }

}

const deleteFolder = async (folder) => {
    let arr = await MMKV.getArrayAsync("lasts");
    if (arr !== null) {
        const filtered = arr.filter(item => !item.path.startsWith(folder));
        await MMKV.setArrayAsync("lasts", filtered);
        store.dispatch(renderScreen(['HomeScreen']))
    }
}

export const getLastsMMKV = async () => {
    let arr = await MMKV.getArrayAsync('lasts') ?? [];
    return arr
}

export const deleteRouterMMKV = (obj) => obj.type == 'folder' ? deleteFolder(obj.path) : deleteFile(obj);

export const dropMMKV = async () => {
    await MMKV.setBoolAsync("auth", false);
    await MMKV.setMapAsync("userSecretData", {});
    await MMKV.setArrayAsync("lasts", []);
};

export const updateMultiplyMoveMMKV = async (location, names, target) => {
    let arr = await MMKV.getArrayAsync('lasts') ?? [];
    let transformed = arr.map(element => {
        if (names.includes(element.name) && element.location === location) {
            element.path = element.path.replace(element.location, target);
            element.title = element.title.replace(element.location, target);
            element.location = target;
        }

        return element;
    })

    await MMKV.setArrayAsync("lasts", transformed);
    store.dispatch(renderScreen(['HomeScreen']));
}


// export const updateMMKV = async (path, updated) => {
//     let arr = await MMKV.getArrayAsync('lasts') ?? [];
//     let filter = arr.map(item => item.path === path ? updated : item);
//     await MMKV.setArrayAsync('lasts', filter);
//     // if (arr !== null) {
//     //     const filtered = arr.filter(i => {
//     //         if (i.path === oldFile.path) {
//     //             i = newFile
//     //         }
//     //         return i
//     //     })
//     //     await MMKV.setArrayAsync("lasts", filtered);
//     //     store.dispatch(renderScreen(['HomeScreen']))
//     // }
// }

export const renameMMKVFile = async ({ path, location, name, newArr }) => {

    let arr = await MMKV.getArrayAsync('lasts') ?? [];
    let indexMMKV = arr.findIndex(object => {
        return object.path === path;
    })

    if (indexMMKV !== -1) {
        let newIndex = newArr.findIndex(obj => {
            return obj.name === name
        })
        arr[indexMMKV] = newArr[newIndex];
        await MMKV.setArrayAsync('lasts', arr);
        store.dispatch(renderScreen(['HomeScreen']))
    }
}


export const renameMMKVFolder = async (location, name) => {
    let arr = await MMKV.getArrayAsync('lasts') ?? [];
    arr = arr.filter(item => {
        return item.location !== name + '/'
    })
    await MMKV.setArrayAsync('lasts', arr);
    store.dispatch(renderScreen(['HomeScreen']))
}

export const multiRemoveMMKV = async (pathGroup, filesGroups) => {
    let arr = await MMKV.getArrayAsync('lasts') ?? [];
    let injected = filesGroups.map(element => {
        if (pathGroup !== "") {
            return `${pathGroup}/${element}`
        }

        else return element
    })
    arr = arr.filter(element => !injected.includes(element.path))
    await MMKV.setArrayAsync('lasts', arr);
    store.dispatch(renderScreen(['HomeScreen']))
}

export const setGuideMMKV = async () => {
    await MMKV.setBoolAsync("guide", true);
}

export const getGuideMMKV = async () => {
    const guide = await MMKV.getBoolAsync("guide");
    return guide;
}

export const getUserSecretDataMMKV = async () => {
    const auth = await MMKV.getBoolAsync('auth');
    const guide = await MMKV.getBoolAsync("guide");
    let object = await MMKV.getMapAsync("userSecretData");
    return { ...object, auth, guide };
}

export const setUserSecretDataMMKV = async (clientId, publicKeyB64) => {
    let object = await MMKV.getMapAsync("userSecretData");
    let data = { ...object, clientId, publicKeyB64 };
    await MMKV.setMapAsync("userSecretData", data);
}

export const mergeUserSecretDataMMKV = async (patch) => {
    let object = await MMKV.getMapAsync("userSecretData");
    await MMKV.setMapAsync("userSecretData", { ...object, ...patch });
}

export const setUserServerIdMMKV = async (serverId) => {
    let object = await MMKV.getMapAsync("userSecretData");
    await MMKV.setMapAsync("userSecretData", { ...object, serverId });
}

export const userAuthMMKV = async () => {
    await MMKV.setBoolAsync("auth", true);
}

export const setUserEncryptionTypeMMKV = async (encryptionType) => {
    let object = await MMKV.getMapAsync("userSecretData");
    await MMKV.setMapAsync("userSecretData", { ...object, encryptionType });
}

export const setUserDeviceKeyMMKV = async (deviceKey) => {
    let object = await MMKV.getMapAsync("userSecretData");
    await MMKV.setMapAsync("userSecretData", { ...object, deviceKey })
}

export const removeUserEncryptionTypeMMKV = async () => {
    let object = await MMKV.getMapAsync("userSecretData");
    await MMKV.setMapAsync("userSecretData", { ...object, encryptionType: undefined });
}

export const setUserPublicAndPrivetKeyMMKV = async (publicKey, privetKey) => {
    let object = await MMKV.getMapAsync('userSecretData');
    await MMKV.setMapAsync('userSecretData', { ...object, publicKey, privetKey });
}

export const getUserPublicKeyMMKV = async () => {
    try {
        let userData = await MMKV.getMapAsync('userSecretData')
        return userData.qr;
    }
    catch (err) {
        return null;
    }
}

export const setUserQrMMKV = async (qr) => {
    let object = await MMKV.getMapAsync('userSecretData');
    await MMKV.setMapAsync('userSecretData', { ...object, qr });
}

export const setDeviceUpdateInfoMMKV = async (order) => {
    await MMKV.setBoolAsync('deviceUpdateStatus', order);
}

export const getDeviceUpdateFinishInfoMMKV = async () => {
    const info = await MMKV.getBoolAsync('deviceUpdateStatus');
    return info
}

export const uploadQueueMMKV = async (file) => {
    const data = await MMKV.getArrayAsync('uploadQueue') ?? [];
    await MMKV.setArrayAsync('uploadQueue', [...data, file]);
}

export const removeUploadQueueMMKV = async () => {
    const data = await MMKV.getArrayAsync('uploadQueue');
    data.shift();
    await MMKV.setArrayAsync('uploadQueue', data);
}

export const getUploadQueueMMKV = async () => await MMKV.getArrayAsync('uploadQueue') ?? [];

export const setProxyMMKV = async (proxy) => {
    let object = await MMKV.getMapAsync("userSecretData");
    await MMKV.setMapAsync("userSecretData", { ...object, proxy });
}


export const moveSingleMMKV = async () => {
    // let arr = await MMKV.getArrayAsync('lasts') ?? [];

}

export const setCellularAccessMMKV = async (boolean) => {
    MMKV.setBoolAsync('cellular', boolean)
};
export const getCellularInfoMMKV = async () => await MMKV.getBoolAsync('cellular') ?? false;
