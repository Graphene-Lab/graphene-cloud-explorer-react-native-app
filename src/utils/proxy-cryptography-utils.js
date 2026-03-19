import { btoa, toByteArray } from 'react-native-quick-base64';
import { store } from '../store';
import { decryptXorAB, encryptXorAB } from './encryption-utils';
import 'text-encoding';
import { getUserSecretDataMMKV } from './mmkv';
import { setUserSecretDataToRedux } from '../reducers/userSecretDataReducer';
import { useErrorAlert } from '../hooks/useErrorAlert';

const getSubtleCrypto = () =>
    globalThis?.crypto?.subtle || globalThis?.window?.crypto?.subtle || null;
const isCryptoKey = (key) =>
    !!key && typeof key === 'object' && typeof key.type === 'string' && typeof key.algorithm === 'object';
const coerceBytes = (value) => {
    if (!value) return null;
    if (typeof value === 'string') return base64ToBuffer(value);
    if (value instanceof ArrayBuffer) return value;
    if (value?.buffer && typeof value.byteLength === 'number') {
        const start = value.byteOffset || 0;
        const end = start + value.byteLength;
        return value.buffer.slice(start, end);
    }
    return null;
};
const looksLikeJwk = (value) =>
    !!value && typeof value === 'object' && typeof value.kty === 'string';
const waitForCryptoKey = async (timeoutMs = 5000) => {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
        const current = store.getState().userSecret.deviceKey;
        if (current?.IV && isCryptoKey(current.key)) {
            return current;
        }
        await new Promise((resolve) => setTimeout(resolve, 50));
    }
    return null;
};
const ensureAesDeviceKey = async (deviceKey, storedKey) => {
    if (deviceKey?.IV && isCryptoKey(deviceKey.key)) {
        return deviceKey;
    }
    const rawKey = storedKey?.keyB64 || storedKey?.key;
    const rawIv = storedKey?.ivB64 || storedKey?.IV;
    const keyBytes = coerceBytes(rawKey);
    const ivBytes = coerceBytes(rawIv);
    if (keyBytes && ivBytes) {
        const imported = await importSecretKey(keyBytes);
        const hydrated = { key: imported, IV: ivBytes };
        store.dispatch(setUserSecretDataToRedux({ deviceKey: hydrated }));
        return hydrated;
    }
    const waited = await waitForCryptoKey(3000);
    if (waited) {
        return waited;
    }
    return null;
};

let hasLoggedCryptoEnv = false;
const logCryptoEnvOnce = (context, encryptionType, deviceKey) => {
    if (hasLoggedCryptoEnv) return;
    hasLoggedCryptoEnv = true;
    const subtle = getSubtleCrypto();
    console.log('[crypto-env]', {
        context,
        encryptionType,
        hasGlobalCrypto: !!globalThis?.crypto,
        hasWindowCrypto: !!globalThis?.window?.crypto,
        hasSubtle: !!subtle,
        subtleEncrypt: typeof subtle?.encrypt,
        subtleDecrypt: typeof subtle?.decrypt,
        subtleImportKey: typeof subtle?.importKey,
        hasDeviceKey: !!deviceKey,
        hasIV: !!deviceKey?.IV,
        hasKey: !!deviceKey?.key,
    });
};

export function decodeBase64Url(input) {
    // Replace non-url compatible chars with base64 standard chars
    input = input.replace(/\-/g, '+').replace(/_/g, '/');

    // Pad out with standard base64 required padding characters
    let pad = input.length % 4;
    if (pad) {
        if (pad === 1) {
            throw new Error('Invalid base64url string');
        }
        input += new Array(5 - pad).join('=');
    }
    return input;
}

export function base64ToBuffer(base64) {
    var bytes = toByteArray(base64);
    return bytes.buffer;
    // var binary_string = atob(base64);
    // var len = binary_string.length;
    // var bytes = new Uint8Array(len);
    // for (var i = 0; i < len; i++) {
    //     bytes[i] = binary_string.charCodeAt(i);
    // }
}

export function bufferToHex(buffer) {
    return [...new Uint8Array(buffer)].map((x) => x.toString(16).padStart(2, '0')).join('');
}

export function bufferToString(buf) {
    var decoder = new TextDecoder('utf-8');
    return decoder.decode(buf);
}

export function bufferToStringBinary(buf) {
    const buffer = new Uint8Array(buf);
    let result = '';
    let offset = 0;

    while (offset < buffer.length) {
        let size = Math.min(8192, buffer.length - offset);
        result += String.fromCharCode.apply(null, buffer.slice(offset, offset + size));
        offset += size;
    }
    return result;
}

export function joinBuffers(buffer1, buffer2) {
    let tmp = new Uint8Array(buffer1.byteLength + buffer2.byteLength);
    tmp.set(new Uint8Array(buffer1), 0);
    tmp.set(new Uint8Array(buffer2), buffer1.byteLength);
    return tmp.buffer;
}

export function int32ToBuffer(int) {
    return numberToBuffer(int, 4);
}

export function int16ToBuffer(short) {
    return numberToBuffer(short, 2);
}

function numberToBuffer(number, returnBytes) {
    var byteBuffer = new Uint8Array(returnBytes);
    for (var index = 0; index < byteBuffer.length; index++) {
        var byte = number & 0xff;
        byteBuffer[index] = byte;
        number = (number - byte) / 256;
    }
    return byteBuffer;
}

//Convert a string into an Buffer (UTF8 encoding)
export function stringToBuffer(str) {
    let encoder = new TextEncoder(); // always utf-8
    return encoder.encode(str).buffer;
}

export function enumToString(enumerator, value) {
    for (var k in enumerator) if (enumerator[k] == value) return k;
    return null;
}

export function bufferToInt(data, offset) {
    offset = offset != undefined ? offset : 0;
    let bytes = data.slice(offset, offset + 4);
    return new Int32Array(bytes)[0];
}

export function splitData(data) {
    let offset = 0;
    let datas = [];
    while (offset < data.byteLength) {
        let len = bufferToInt(data, offset);
        offset += 4;
        let part = data.slice(offset, offset + len);
        datas.push(part);
        offset += len;
    }
    return datas;
}

export function bufferToBase64(buffer) {
    const exportedAsString = bufferToStringBinary(buffer);
    return btoa(exportedAsString);
}

export function bufferToJwkBase64(buffer) {
    var binary = '';
    var bytes = new Uint8Array(buffer);
    var len = bytes.byteLength;
    for (var i = 0; i < len; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    var base64 = btoa(binary);
    var jwk_base64 = base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/\=+$/, '');
    return jwk_base64;
}

export function importRsaPublicKey(modulus, exponent) {
    let n = bufferToJwkBase64(modulus);
    let e = bufferToJwkBase64(exponent);
    let jwk = {
        kty: 'RSA',
        n: n,
        e: e,
        alg: 'RSA-OAEP-256',
        ext: true,
    };

    let algo = {
        name: 'RSA-OAEP',
        hash: { name: 'SHA-256' },
    };

    var importedKey = window.crypto.subtle
        .importKey('jwk', jwk, algo, true, ['encrypt'])
        .catch(function (err) {
            debugger;
        });

    return importedKey;
}

export function encryptRsaOaep(publicKey, data) {
    let blockSize = 190;
    let promises;
    let i = 0;
    while (i < data.byteLength) {
        let chunk = data.slice(i, i + blockSize);
        let promise = window.crypto.subtle
            .encrypt(
                {
                    name: 'RSA-OAEP',
                },
                publicKey,
                chunk
            )
            .catch(function (err) {
                useErrorAlert('encryptRsaOaep', err);
                // console.log(err);
                return err;
            });
        if (promises == undefined) {
            promises = [promise];
        } else {
            promises = promises.concat([promise]);
        }
        i += blockSize;
    }

    return Promise.all(promises).then(function (buffers) {
        let result;
        buffers.forEach(function (item) {
            if (result == undefined) {
                result = item;
            } else {
                result = joinBuffers(result, item);
            }
        });
        return result;
    });
}

export function importSecretKey(rawKey) {
    const subtle = getSubtleCrypto();
    if (!subtle?.importKey) throw new Error('WebCrypto subtle is unavailable');
    return subtle.importKey('raw', rawKey, 'aes-cbc', false, ['encrypt', 'decrypt']);
}

export function importRsaPrivateKeyJwk(jwk) {
    const subtle = getSubtleCrypto();
    if (!subtle?.importKey) throw new Error('WebCrypto subtle is unavailable');
    if (!looksLikeJwk(jwk)) throw new Error('Invalid RSA private key JWK');
    return subtle.importKey('jwk', jwk, { name: 'RSA-OAEP', hash: 'SHA-256' }, true, ['decrypt']);
}

export function importRsaPublicKeyJwk(jwk) {
    const subtle = getSubtleCrypto();
    if (!subtle?.importKey) throw new Error('WebCrypto subtle is unavailable');
    if (!looksLikeJwk(jwk)) throw new Error('Invalid RSA public key JWK');
    return subtle.importKey('jwk', jwk, { name: 'RSA-OAEP', hash: 'SHA-256' }, true, ['encrypt']);
}

export function decryptRsaOaep(ciphertext, privateKey) {
    //https://developer.mozilla.org/en-US/docs/Web/API/SubtleCrypto/decrypt
    let blockSize = 256;
    let promises;
    let i = 0;
    while (i < ciphertext.byteLength) {
        let chunk = ciphertext.slice(i, i + blockSize);
        let decryptedPromise = window.crypto.subtle.decrypt(
            {
                name: 'RSA-OAEP',
            },
            privateKey,
            chunk
        );
        if (promises == undefined) {
            promises = [decryptedPromise];
        } else {
            promises = promises.concat([decryptedPromise]);
        }
        i += blockSize;
    }

    return Promise.all(promises).then(function (buffers) {
        let result;
        buffers.forEach(function (item) {
            if (result == undefined) {
                result = item;
            } else {
                result = joinBuffers(result, item);
            }
        });
        return result;
    });
}

export async function encryptDataForTheDevice(data, commandId) {
    let deviceKey = store.getState().userSecret.deviceKey;
    const { encryptionType, deviceKey: storedKey } = await getUserSecretDataMMKV();
    logCryptoEnvOnce(`encryptDataForTheDevice:${commandId}`, encryptionType, deviceKey);
    // Data greater than about 12k gives an error in decryption. To send larger data it is recommended to break packets with encryptBigDataForTheDevice()
    if (encryptionType == 'xorAB') {
        const publicKeyB64 = store.getState().userSecret.publicKeyB64;
        console.log('[xorAB] encrypt start', {
            commandId,
            hasPublicKey: !!publicKeyB64,
            publicKeyLen: publicKeyB64?.length,
            dataByteLength: data?.byteLength,
            dataType: Object.prototype.toString.call(data),
            encryptXorABType: typeof encryptXorAB,
            base64ToBufferType: typeof base64ToBuffer,
        });
        if (!publicKeyB64) {
            throw new Error('Missing publicKeyB64 for xorAB encryption');
        }
        try {
            return encryptXorAB(base64ToBuffer(publicKeyB64), data);
        } catch (error) {
            console.log('[xorAB] encrypt failed', {
                message: error?.message,
                name: error?.name,
                stack: error?.stack,
            });
            throw error;
        }
    } else {
        deviceKey = await ensureAesDeviceKey(deviceKey, storedKey);
        if (!deviceKey || !isCryptoKey(deviceKey.key)) {
            throw new Error('AES device key is missing or invalid');
        }
        const subtle = getSubtleCrypto();
        if (!subtle?.encrypt) throw new Error('WebCrypto subtle is unavailable');
        return subtle.encrypt({ name: 'aes-cbc', iv: deviceKey.IV }, deviceKey.key, data);
    }
}

export async function decryptDataFromTheDevice(data) {
    let deviceKey = store.getState().userSecret.deviceKey;
    const { encryptionType, deviceKey: storedKey } = await getUserSecretDataMMKV();

    if (encryptionType == 'xorAB') {
        return decryptXorAB(base64ToBuffer(store.getState().userSecret.publicKeyB64), data);
    }
    deviceKey = await ensureAesDeviceKey(deviceKey, storedKey);
    if (!deviceKey || !isCryptoKey(deviceKey.key)) {
        throw new Error('AES device key is missing or invalid');
    }
    const subtle = getSubtleCrypto();
    if (!subtle?.decrypt) throw new Error('WebCrypto subtle is unavailable');
    return subtle.decrypt({ name: 'aes-cbc', iv: deviceKey.IV }, deviceKey.key, data);
}
