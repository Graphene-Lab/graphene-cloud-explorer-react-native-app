import QuickCrypto from 'react-native-quick-crypto';
const crypto = QuickCrypto;

const getSubtle = () => global.crypto?.subtle || global.crypto?.webcrypto?.subtle || crypto?.subtle || crypto?.webcrypto?.subtle;

export function hash256(buffer) {
    return getSubtle().digest('SHA-256', buffer);
}

export function encryptData(key, data) {
    return new Promise((resolve) => {
        hash256(key).then((sharedKey) => {
            let iv = sharedKey.slice(0, 16);
            let encryptionKey = sharedKey.slice(16, 32);
            getSubtle()
                .importKey("raw", encryptionKey, "AES-CBC", false, [
                    "encrypt",
                    "decrypt",
                ])
                .then((key_encoded) => {
                    getSubtle()
                        .encrypt(
                            {
                                name: "AES-CBC",
                                iv,
                            },
                            key_encoded,
                            data
                        )
                        .then((cipherData) => {
                            resolve(cipherData);
                        });
                });
        });
    });
}

export function decryptXorAB(key, data) {
    return encryptXorAB(key, data);
}

export function encryptXorAB(key, data) {
    let tmpKey = new Uint8Array(key).slice().buffer;
    let dl = data.byteLength;
    let newsize = Math.ceil(dl / 4) * 4;
    let dt = new Uint32Array(resizeBuffers(data, newsize));
    return new Promise((resolve, reject) => {
        let k3 = key;
        let target = new Uint32Array(dt.length);
        if (tmpKey.byteLength < 4) {
            tmpKey = resizeBuffers(tmpKey, 4);
        }
        let k = new Uint32Array(tmpKey);
        k[0] = k[0] ^ dl;
        tmpKey = k.buffer;
        for (let i = 0; i < dt.length; i++) {
            var p = i % k.length;
            if (p == 0) {
                //  tmpKey = await hash512(tmpKey);
                tmpKey = fastHash256(tmpKey);
                k = new Uint32Array(tmpKey);
            }
            target[i] = dt[i] ^ k[p];
        }
        let result = target.buffer.slice(0, dl);
        resolve(result);
    });

    // var dt = new Uint8Array(data);
    // return new Promise(async (resolve, reject) => {
    //   key = joinBuffers(key, int32ToBuffer(data.byteLength));
    //   let target = new Uint8Array(data.byteLength);
    //   let k;
    //   for (let i = 0; i < dt.byteLength; i++) {
    //     var p = i % key.byteLength;
    //     if (p == 0) {
    //       key = await hash512(key);
    //       k = new Uint8Array(key);
    //     }
    //     target[i] = dt[i] ^ k[p];
    //   }
    //   let result = target.buffer;
    //   resolve(result);
    // });
}

function resizeBuffers(buffer, newsize) {
    let tmp = new Uint8Array(newsize);
    tmp.set(new Uint8Array(buffer), 0);
    return tmp.buffer;
}


function fastHash256(arrayBuffer) {
    let bytes = new Uint8Array(arrayBuffer).buffer;
    let bl = bytes.byteLength;
    let newsize = Math.ceil(bl / 32) * 32;
    bytes = resizeBuffers(bytes, newsize);
    let data = new Int32Array(bytes);
    let p0 = 0b01010101_01010101_01010101_01010101;
    let p1 = 0b00110011_00110011_00110011_00110011;
    let p2 = 0b00100100_10010010_00100100_10010010;
    let p3 = 0b00011100_01110001_11000111_00011100;
    let p4 = p0 ^ -1;
    let p5 = p1 ^ -1;
    let p6 = p2 ^ -1;
    let p7 = p3 ^ -1;
    //x = (bl * 1103515245 + 12345) & 0x7fffffff;
    let x = bl ^ 0x55555555;
    x ^= x << (1 + (bl % 30));
    x ^= 0x55555555;
    x ^= x >> (1 + (bl % 29));
    for (let i = 0; i < data.length; i += 8) {
        let v0 = data[i];
        let v1 = data[i + 1];
        let v2 = data[i + 2];
        let v3 = data[i + 3];
        let v4 = data[i + 4];
        let v5 = data[i + 5];
        let v6 = data[i + 6];
        let v7 = data[i + 7];
        x ^= v0 ^ v1 ^ v2 ^ v3 ^ v4 ^ v5 ^ v6 ^ v7;
        x ^= 0x55555555;
        x ^= x << (1 + (x % 28));
        x ^= 0x55555555;
        x ^= x >> (1 + (x % 29));
        x ^= 0x55555555;
        x ^= x << (1 + (x % 30));
        p0 ^= v0 ^ x;
        p1 ^= v1 ^ x;
        p2 ^= v2 ^ x;
        p3 ^= v3 ^ x;
        p4 ^= v4 ^ x;
        p5 ^= v5 ^ x;
        p6 ^= v6 ^ x;
        p7 ^= v7 ^ x;
    }
    let result = new Int32Array(8);
    result[0] = p0;
    result[1] = p1;
    result[2] = p2;
    result[3] = p3;
    result[4] = p4;
    result[5] = p5;
    result[6] = p6;
    result[7] = p7;
    return result.buffer;
}


