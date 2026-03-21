import { store } from '../store';
import {
    base64ToBuffer,
    bufferToHex,
    bufferToString,
    decodeBase64Url,
    importRsaPublicKey,
} from './proxy-cryptography-utils';
import {
    executeRequest,
    getDir,
    getGroup,
    GetStorageInfo,
    search,
    setClient,
} from './data-transmission-utils';
import { hash256 } from './encryption-utils';
import { setCloudMemory } from '../reducers/profileActionsReducer';
import { command, fileTypes, defaultProxyPort } from '../constants';
import { setScreenBehavior } from '../reducers/screenControllerReducer';
import { setFavoritesList, setLocation } from '../reducers/fileReducer';
import {
    setProxyMMKV,
    setUserPublicAndPrivetKeyMMKV,
    setUserQrMMKV,
    setUserSecretDataMMKV,
    setUserServerIdMMKV,
} from './mmkv';
import { setAuthWait, setUserSecretDataToRedux } from '../reducers/userSecretDataReducer';
import { URL } from 'react-native-url-polyfill';
import { setProxy } from '../reducers/proxyReducer';
import { log } from 'react-native-reanimated';

export function formatBytes(a, b = 2) {
    if (!+a) return '0 Bytes';
    const c = 0 > b ? 0 : b,
        d = Math.floor(Math.log(a) / Math.log(1024));
    return `${parseFloat((a / Math.pow(1024, d)).toFixed(c))} ${['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'][d]
        }`;
}

export async function generateKeyRSA() {
    const keyPair = await window.crypto.subtle.generateKey(
        {
            name: 'RSA-OAEP',
            modulusLength: 2048,
            publicExponent: new Uint8Array([1, 0, 1]),
            hash: 'SHA-256',
        },
        true,
        ['encrypt', 'decrypt']
    );
    const privateKey = keyPair.privateKey;
    const publicKey = keyPair.publicKey;
    const publicJwk = await window.crypto.subtle.exportKey('jwk', publicKey);
    const privateJwk = await window.crypto.subtle.exportKey('jwk', privateKey);
    await setUserPublicAndPrivetKeyMMKV(publicJwk, privateJwk);
    store.dispatch(setUserSecretDataToRedux({ publicKey, privateKey }));
    return exportCryptoKey(publicKey);
}

async function exportCryptoKey(key) {
    const k = await window.crypto.subtle.exportKey('jwk', key);
    let publicKeyB64 = decodeBase64Url(k.n);
    let keyBin = base64ToBuffer(publicKeyB64);
    return hash256(keyBin).then(async (digestHex) => {
        let clientId = bufferToHex(digestHex.slice(0, 8));
        // store.dispatch(setClientId(clientId));
        // store.dispatch(setPublicKeyB64(publicKeyB64))
        store.dispatch(setUserSecretDataToRedux({ publicKeyB64, clientId }));
        await setUserSecretDataMMKV(clientId, publicKeyB64);
    });
}

export async function onQrCodeAcquires(qrCode) {
    const reg = /^([0-9a-zA-Z+/]{4})*(([0-9a-zA-Z+/]{2}==)|([0-9a-zA-Z+/]{3}=))?$/; // base64 regex;
    if (reg.test(qrCode) === false) {
        store.dispatch(setAuthWait(false));
        throw new Error('Qr format not valid');
    }

    let qr = base64ToBuffer(qrCode);
    await setUserQrMMKV(qrCode);
    let offset = 0;
    let type = new Uint8Array(qr.slice(offset, 1))[0];
    offset += 1;
    if (type == 1) {
        let mSize = 2048 / 8; //NOTE: modules with sizes different of 2048 give an error during encryption in JavaScript
        let modulus = qr.slice(offset, offset + mSize);
        offset += mSize;
        let exponent = qr.slice(offset, offset + 3);
        offset += 3;
        let serverPublicKey = qr.slice(offset, offset + 33);
        offset += 33;
        let entryPoint = bufferToString(qr.slice(offset)); //proxy ;
        await entryPointToProxy(entryPoint);
        return hash256(serverPublicKey).then(async (hash) => {
            let serverId = bufferToHex(hash.slice(0, 8));
            store.dispatch(setUserSecretDataToRedux({ serverId }));
            await setUserServerIdMMKV(serverId);
            return importRsaPublicKey(modulus, exponent).then((rsaPubKey) => {
                return setClient(rsaPubKey);
            });
        });
    } else if (type == 2) {
        let QrKey = qr.slice(offset, offset + 24);
        store.dispatch(setUserSecretDataToRedux({ qr: QrKey }));
        offset += 24;
        let serverId = bufferToHex(qr.slice(offset, offset + 8));
        store.dispatch(setUserSecretDataToRedux({ serverId }));
        await setUserServerIdMMKV(serverId);
        offset += 8;
        let entryPoint = bufferToString(qr.slice(offset)); //proxy ;
        await entryPointToProxy(entryPoint);
        return executeRequest(command.GetEncryptedQR);
    } else {
        throw new Error('QR code format not supported!');
    }
}

async function entryPointToProxy(ep) {
    if (ep == null || ep == "") {
        ep = "proxy.tc0.it";
    } else if (ep.indexOf(".") == -1) {
        ep = ep + ".tc0.it";
    }
    if (!ep.startsWith('http://') && !ep.startsWith('https://')) {
        ep = 'http://' + ep;
    }

    let proxy = ep;
    if (proxy.replace('://', '').indexOf(':') == -1) {
        proxy = proxy + ':' + defaultProxyPort;
    }

    console.log('Proxy set to: ' + proxy);

    store.dispatch(setProxy(proxy));
    await setProxyMMKV(proxy);
}

async function resolveDNS(url) {
    if (url.indexOf('://') == -1) {
        url = 'http://' + url;
    }
    let builder = new URL(url);
    var host = builder.host;
    let provider = 'https://dns.google/resolve?name=' + host;
    let response = await fetch(provider);
    let json = await response.json();
    return json;
}

export const getFileType = (file) => {
    file = file?.split('.').reverse()[0].toLowerCase();
    return fileTypes[file] ? fileTypes[file] : 'other';
};

export const parseDateTime = (dateTime) => {
    let date = new Date(dateTime);
    // return date.toLocaleDateString() + " " + date.toLocaleTimeString();
    return date.toLocaleDateString();
};

const normalizeRelativePath = (value) => {
    if (!value) return '';
    return value.replace(/\\/g, '/').replace(/^\/+|\/+$/g, '');
};

const buildFullPath = (name, loc) => {
    const cleanName = normalizeRelativePath(name);
    const cleanLoc = normalizeRelativePath(loc ?? store.getState().files.location);
    if (!cleanLoc) return cleanName;
    if (cleanName === cleanLoc || cleanName.startsWith(cleanLoc + '/')) return cleanName;
    if (!cleanName) return cleanLoc;
    return `${cleanLoc}/${cleanName}`;
};

export const lastNameGenerator = (name) => name?.split('/').reverse()[0];

export const locationGenerator = (full) => {
    let generated = full?.split('/');
    generated.pop();
    return generated.join('/');
};

export const parseFile = (fileContent, not, loc) => {
    const files = [];
    fileContent?.forEach((e) => {
        const name = e.Name.replace('loudBoxNuget/Cloud0/', '');
        const fullPath = buildFullPath(name, loc);
        const location = loc ? normalizeRelativePath(loc) : locationGenerator(name);
        e.Name !== '..' &&
            files.push({
                title: name,
                type: e.IsDirectory ? 'folder' : getFileType(name),
                name: lastNameGenerator(name),
                source: 'data:image/png;base64,' + e.Thumbnail,
                Thumbnail: e.Thumbnail,
                description: parseDateTime(e.Date),
                rawDate: e.Date,
                path: fullPath,
                location,
                Length: e.Length,
                // favorite: store.getState().files.favorites?.includes(path),
            });
    });

    return files.sort((a) => (a.type === 'folder' ? -1 : 1));
};

export const navigateToFolder = async (path, routeName) => {
    store.dispatch(setScreenBehavior({ routeName, loader: true, blocker: false }));
    let blocker = true;
    const targetPath = path || '';
    try {
        const data = await getDir(targetPath);
        store.dispatch(setLocation(targetPath));
        blocker = data ? true : false;
        return parseFile(data, true, targetPath);
    } finally {
        store.dispatch(setScreenBehavior({ routeName, loader: false, blocker }));
    }
};

export const navigateToBack = async (routeName) => {
    store.dispatch(setScreenBehavior({ routeName, loader: true, blocker: false }));
    let blocker = true;
    const currentLocation = store.getState().files.location || '';
    const targetPath = currentLocation.split('/').slice(0, -1).join('/');
    try {
        const data = await getDir(targetPath);
        store.dispatch(setLocation(targetPath));
        blocker = data ? true : false;
        return parseFile(data, true, targetPath);
    } finally {
        store.dispatch(setScreenBehavior({ routeName, loader: false, blocker }));
    }
};

export const getAllImages = async () => {
    store.dispatch(setScreenBehavior({ routeName: 'MediaScreen', loader: true, blocker: false }));
    let blocker = true;
    try {
        const data = await search('', '[^s]+(.*?).(jpg|jpeg|png|gif|ico|JPG|JPEG|PNG|GIF)$', 0, -1);
        blocker = data ? true : false;
        return parseFile(data);
    } finally {
        store.dispatch(
            setScreenBehavior({ routeName: 'MediaScreen', loader: false, blocker })
        );
    }
};

export const getFavorites = async () => {
    store.dispatch(setScreenBehavior({ routeName: 'FavoriteScreen', loader: true, blocker: false }));
    let blocker = true;
    try {
        const data = await getGroup('favorites');
        blocker = data ? true : false;
        const names = data?.map((items) => items.Name.replace('loudBoxNuget/Cloud0/', ''));
        store.dispatch(setFavoritesList(names));
        return parseFile(Array.isArray(data) ? data : [], undefined, '');
    } finally {
        store.dispatch(
            setScreenBehavior({ routeName: 'FavoriteScreen', loader: false, blocker })
        );
    }
};

export const storageInfo = async () => {
    const info = await GetStorageInfo();
    store.dispatch(setCloudMemory(info));
    return parseInt(info?.totalMemory);
};


export function bytesToSize(bytes) {
    var sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    if (bytes == 0) return '0 Byte';
    var i = parseInt(Math.floor(Math.log(bytes) / Math.log(1024)));
    return Math.round(bytes / Math.pow(1024, i), 2) + ' ' + sizes[i];
}

export function timeConvert(time) {
    if (time < 60 && time > 0) return `${time} seconds`;
    else if (time > 60 && time < 3600) return `${Math.floor(time / 60)} minutes`;
    else if (time > 3600) return `${Math.floor(time / 3600)} hour`;
    else return '..calculating';
}

export const groupsByFolder = (arr) => {
    let groups = {};
    if (!Array.isArray(arr)) {
        arr = arr.split();
    }

    const filtered = arr.map((x) => {
        const spl = x.split('/');
        return { path: spl.slice(0, -1).join('/'), name: spl.pop() };
    });

    for (let el of filtered) {
        if (groups[el.path]) {
            groups[el.path].push(el.name);
        } else {
            groups[el.path] = [];
            groups[el.path].push(el.name);
        }
    }

    return Object.entries(groups);
};
