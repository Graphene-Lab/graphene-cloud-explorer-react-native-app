import { Platform } from 'react-native';
import RNFetchBlob from 'rn-fetch-blob';
import { existsTypes } from '../constants';
import { bufferToBase64 } from './proxy-cryptography-utils';
const { dirs, exists, mkdir, createFile, stat, unlink } = RNFetchBlob.fs;
const documentDir = dirs.DocumentDir;
import { mime_types_json } from '../constants/mime_types';

const downloadedPathIndex = {};
const WRITE_CHUNK_BYTES = 192 * 1024;
const yieldToJs = () => new Promise((resolve) => setTimeout(resolve, 0));
const TIMESTAMP_TOLERANCE_SECONDS = 2;

const concatUint8 = (a, b) => {
    if (!a?.length) return b;
    if (!b?.length) return a;
    const out = new Uint8Array(a.length + b.length);
    out.set(a, 0);
    out.set(b, a.length);
    return out;
};

const toUint8 = (input) => {
    if (!input) return null;
    if (input instanceof Uint8Array) return input;
    if (input instanceof ArrayBuffer) return new Uint8Array(input);
    if (input?.bytes) return toUint8(input.bytes);
    return null;
};

const toChunks = (input) => {
    if (Array.isArray(input)) return input;
    if (Array.isArray(input?.chunks)) return input.chunks;
    return null;
};

const writeChunksStream = async (target, chunks) => {
    const stream = await RNFetchBlob.fs.writeStream(target, 'base64', false);
    let carry = new Uint8Array(0);
    let writtenSinceYield = 0;
    for (const part of chunks) {
        let chunk = part;
        if (carry.length) {
            chunk = concatUint8(carry, chunk);
            carry = new Uint8Array(0);
        }
        const remainder = chunk.length % 3;
        if (remainder) {
            carry = chunk.slice(chunk.length - remainder);
            chunk = chunk.slice(0, chunk.length - remainder);
        }
        if (chunk.length) {
            const safeChunk = chunk.byteOffset === 0 && chunk.byteLength === chunk.buffer.byteLength
                ? chunk
                : chunk.slice();
            stream.write(bufferToBase64(safeChunk.buffer));
        }
        writtenSinceYield += chunk.length;
        if (writtenSinceYield >= WRITE_CHUNK_BYTES) {
            writtenSinceYield = 0;
            await yieldToJs();
        }
    }
    if (carry.length) {
        stream.write(bufferToBase64(carry.buffer));
    }
    await stream.close();
};

const writeBytesStream = async (target, bytes) => {
    const stream = await RNFetchBlob.fs.writeStream(target, 'base64', false);
    let carry = new Uint8Array(0);
    for (let offset = 0; offset < bytes.length; offset += WRITE_CHUNK_BYTES) {
        const end = Math.min(offset + WRITE_CHUNK_BYTES, bytes.length);
        let chunk = bytes.subarray(offset, end);
        if (carry.length) {
            chunk = concatUint8(carry, chunk);
            carry = new Uint8Array(0);
        }
        const remainder = chunk.length % 3;
        if (remainder) {
            carry = chunk.slice(chunk.length - remainder);
            chunk = chunk.slice(0, chunk.length - remainder);
        }
        if (chunk.length) {
            const safeChunk = chunk.byteOffset === 0 && chunk.byteLength === chunk.buffer.byteLength
                ? chunk
                : chunk.slice();
            stream.write(bufferToBase64(safeChunk.buffer));
        }
        if (offset + WRITE_CHUNK_BYTES < bytes.length) {
            await yieldToJs();
        }
    }
    if (carry.length) {
        stream.write(bufferToBase64(carry.buffer));
    }
    await stream.close();
};

const typeConverter = (type) => {
    if (!type || typeof type !== 'string') return 'application';
    return type.split('/')[0];
};

const resolveMime = (fileName) => {
    const extension = fileName?.split('.').pop()?.toLowerCase();
    return mime_types_json[extension] || 'application/octet-stream';
};

const buildFoundFile = (path, mime) => ({
    source: `file://${path}`,
    uri: path,
    mime,
});

const normalizeExpectedSize = (file) => {
    const raw = file?.Length ?? file?.length ?? file?.size;
    const parsed = Number(raw);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
};

const normalizeUnixTimestamp = (value) => {
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed <= 0) return 0;
    return parsed > 1e12 ? Math.floor(parsed / 1000) : Math.floor(parsed);
};

const extractExpectedUnixTimestamp = (file) => {
    if (!file) return 0;
    let ts = normalizeUnixTimestamp(file.UnixLastWriteTimestamp);
    if (ts) return ts;
    ts = normalizeUnixTimestamp(file.unixLastWriteTimestamp);
    if (ts) return ts;
    if (file.rawDate) {
        const parsed = Date.parse(file.rawDate);
        ts = normalizeUnixTimestamp(Number.isFinite(parsed) ? parsed : 0);
        if (ts) return ts;
    }
    if (file.Date) {
        const parsed = Date.parse(file.Date);
        ts = normalizeUnixTimestamp(Number.isFinite(parsed) ? parsed : 0);
        if (ts) return ts;
    }
    ts = normalizeUnixTimestamp(file.lastModified);
    if (ts) return ts;
    return normalizeUnixTimestamp(file.lastModifiedTime);
};

const readStatUnixTimestamp = (fileStats) => {
    const candidate = fileStats?.lastModified ?? fileStats?.mtime ?? fileStats?.timestamp;
    return normalizeUnixTimestamp(candidate);
};

const isUsableSize = async (path, expectedSize) => {
    if (!expectedSize) return true;
    try {
        const fileStats = await stat(path);
        return Number(fileStats?.size) === expectedSize;
    } catch {
        return false;
    }
};

const isUsableTimestamp = async (path, expectedTimestamp) => {
    if (!expectedTimestamp) return true;
    try {
        const fileStats = await stat(path);
        const localTimestamp = readStatUnixTimestamp(fileStats);
        if (!localTimestamp) return true;
        return localTimestamp + TIMESTAMP_TOLERANCE_SECONDS >= expectedTimestamp;
    } catch {
        return false;
    }
};

export const registerDownloadedPath = (remotePath, localPath) => {
    if (!remotePath || !localPath) return;
    downloadedPathIndex[remotePath] = localPath;
};

export const fileExistsCheck = async (file) => {
    const mime = resolveMime(file?.name);
    const fileType = typeConverter(file.type);
    const type = existsTypes.includes(fileType) ? fileType : 'application';
    const expectedSize = normalizeExpectedSize(file);
    const expectedTimestamp = extractExpectedUnixTimestamp(file);

    const indexedPath = downloadedPathIndex[file?.path];
    if (indexedPath) {
        const indexedExists = await exists(indexedPath);
        if (
            indexedExists &&
            await isUsableSize(indexedPath, expectedSize) &&
            await isUsableTimestamp(indexedPath, expectedTimestamp)
        ) {
            return buildFoundFile(indexedPath, mime);
        }
    }

    if (file?.source && typeof file.source === 'string') {
        const sourcePath = file.source.replace('file://', '');
        const sourceExists = await exists(sourcePath);
        if (
            sourceExists &&
            await isUsableSize(sourcePath, expectedSize) &&
            await isUsableTimestamp(sourcePath, expectedTimestamp)
        ) {
            return buildFoundFile(sourcePath, mime);
        }
    }

    const baseDirs = Platform.OS === 'android' && dirs.DownloadDir && dirs.DownloadDir !== documentDir
        ? [dirs.DownloadDir, documentDir]
        : [documentDir];

    const candidateFolders = [...new Set([type, 'image', 'application', 'audio', 'video'])];

    for (const baseDir of baseDirs) {
        for (const folder of candidateFolders) {
            const fullPath = `${baseDir}/${folder}/${file.name}`;
            const isExists = await exists(fullPath);
            if (
                isExists &&
                await isUsableSize(fullPath, expectedSize) &&
                await isUsableTimestamp(fullPath, expectedTimestamp)
            ) {
                return buildFoundFile(fullPath, mime);
            }
        }

        const rootPath = `${baseDir}/${file.name}`;
        const rootExists = await exists(rootPath);
        if (
            rootExists &&
            await isUsableSize(rootPath, expectedSize) &&
            await isUsableTimestamp(rootPath, expectedTimestamp)
        ) {
            return buildFoundFile(rootPath, mime);
        }
    }

    return false;
}

export const mkFolder = async (file) => {
    const type = typeConverter(file?.type);
    const baseDir = Platform.OS === 'android' && dirs.DownloadDir ? dirs.DownloadDir : documentDir;
    const targetFolder = `${baseDir}/${type}`;
    const isFolderAlreadyExists = await exists(targetFolder);
    if (!isFolderAlreadyExists) await mkdir(targetFolder);
    return targetFolder;
}

export const writeFileToLocal = async (file, name, folder, meta = null) => {
    const target = `${folder}/${name}`;
    const timingStart = Date.now();
    const alreadyExists = await exists(target);
    const expectedSize = normalizeExpectedSize(meta);
    const expectedTimestamp = extractExpectedUnixTimestamp(meta);
    if (alreadyExists) {
        try {
            const fileStats = await stat(target);
            const sizeOk = !expectedSize || Number(fileStats?.size) === expectedSize;
            const localTimestamp = readStatUnixTimestamp(fileStats);
            const timestampOk = !expectedTimestamp || !localTimestamp
                ? true
                : localTimestamp + TIMESTAMP_TOLERANCE_SECONDS >= expectedTimestamp;
            if (Number(fileStats?.size) > 0 && sizeOk && timestampOk) return target;
        } catch {
            // If stat fails, rewrite the file to avoid returning a bad path.
        }
        await unlink(target);
    }
    const chunks = toChunks(file);
    if (chunks) {
        await writeChunksStream(target, chunks);
        console.log('[DL] writeChunksStream done', { ms: Date.now() - timingStart, chunks: chunks.length });
        return target;
    }
    const bytes = toUint8(file);
    if (bytes) {
        await writeBytesStream(target, bytes);
        console.log('[DL] writeBytesStream done', { ms: Date.now() - timingStart, bytes: bytes.length });
        return target;
    }
    const base64 = typeof file === 'string' ? file : file?.data;
    await createFile(target, base64, 'base64');
    console.log('[DL] createFile done', { ms: Date.now() - timingStart });
    return target;
}
