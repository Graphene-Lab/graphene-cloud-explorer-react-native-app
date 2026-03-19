import { blake2b } from '@noble/hashes/blake2.js';
import { hmac } from '@noble/hashes/hmac.js';
import { pbkdf2Async } from '@noble/hashes/pbkdf2.js';
import { sha256, sha512 } from '@noble/hashes/sha2.js';
import { Buffer } from 'buffer';
import { base64ToBuffer } from './proxy-cryptography-utils';
import 'text-encoding';

let nativeCreateHash = null;
try {
  // Prefer native JSI crypto when available for speed.
  const quickCrypto = require('react-native-quick-crypto');
  nativeCreateHash = quickCrypto?.createHash ?? null;
} catch (error) {
  nativeCreateHash = null;
}

const SPECIAL_DIRECTORIES = ['.cloud_cache'];
export const ENCRYPT_FILE_NAME_END_CHAR = '\u2047';

// Must match desktop/web Set256Chars constant byte-for-byte.
const SET_256_CHARS =
  '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz' +
  '\u00C0\u00C1\u00C2\u00C3\u00C4\u00C5\u00C6\u00C7\u00C8\u00C9\u00CA\u00CB\u00CC\u00CD\u00CE\u00CF' +
  '\u00D0\u00D1\u00D2\u00D3\u00D4\u00D5\u00D6\u00D8\u00D9\u00DA\u00DB\u00DC\u00DD\u00DE\u00DF' +
  '\u00E0\u00E1\u00E2\u00E3\u00E4\u00E5\u00E6\u00E7\u00E8\u00E9\u00EA\u00EB\u00EC\u00ED\u00EE\u00EF' +
  '\u00F0\u00F1\u00F2\u00F3\u00F4\u00F5\u00F6\u00F8\u00F9\u00FA\u00FB\u00FC\u00FD\u00FE\u00FF' +
  '\u0100\u0101\u0102\u0103\u0104\u0105\u0106\u0107\u0108\u0109\u010A\u010B\u010C\u010D\u010E\u010F' +
  '\u0110\u0111\u0112\u0113\u0114\u0115\u0116\u0117\u0118\u0119\u011A\u011B\u011C\u011D\u011E\u011F' +
  '\u0120\u0121\u0122\u0123\u0124\u0125\u0126\u0127\u0128\u0129\u012A\u012B\u012C\u012D\u012E\u012F' +
  '\u0130\u0131\u0132\u0133\u0134\u0135\u0136\u0137\u0139\u013A\u013B\u013C\u013D\u013E\u0141\u0142' +
  '\u0143\u0144\u0145\u0146\u0147\u0148\u014C\u014D\u014E\u014F\u0150\u0151\u0152\u0153\u0154\u0155' +
  '\u0156\u0157\u0158\u0159\u015A\u015B\u015C\u015D\u015E\u015F\u0160\u0161\u0162\u0163\u0164\u0165' +
  '\u0166\u0167\u0168\u0169\u016A\u016B\u016C\u016D\u016E\u016F\u0170\u0171\u0172\u0173\u0174\u0175' +
  '\u0176\u0177\u0178\u0179\u017A\u017B\u017C\u017D\u017E\u01CD\u01CE\u01CF\u01D0\u01D1\u01D2\u01D3' +
  '\u01D4\u01D5\u01D6\u01D7';

const CHAR_TO_BYTE = (() => {
  const map = {};
  for (let i = 0; i < SET_256_CHARS.length; i++) {
    map[SET_256_CHARS[i]] = i;
  }
  return map;
})();

let cachedContext = {
  keyB64: null,
  context: null,
};

function toUint8Array(input) {
  if (input instanceof Uint8Array) return input;
  if (input instanceof ArrayBuffer) return new Uint8Array(input);
  return new Uint8Array(input.buffer, input.byteOffset, input.byteLength);
}

const utf8Encoder = new TextEncoder();
const utf8Decoder = new TextDecoder('utf-8');

function utf8Encode(text) {
  return utf8Encoder.encode(text);
}

function utf8Decode(bytes) {
  return utf8Decoder.decode(toUint8Array(bytes));
}

function concatBytes(...items) {
  const arrays = items.map(toUint8Array);
  const total = arrays.reduce((acc, arr) => acc + arr.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const arr of arrays) {
    out.set(arr, offset);
    offset += arr.length;
  }
  return out;
}

function uint32ToLeBytes(value) {
  const out = new Uint8Array(4);
  let n = value >>> 0;
  for (let i = 0; i < 4; i++) {
    out[i] = n & 0xff;
    n >>>= 8;
  }
  return out;
}

function uint64ToLeBytes(value) {
  const out = new Uint8Array(8);
  let low = value >>> 0;
  let high = Math.floor(value / 0x100000000) >>> 0;
  out[0] = low & 0xff;
  out[1] = (low >>> 8) & 0xff;
  out[2] = (low >>> 16) & 0xff;
  out[3] = (low >>> 24) & 0xff;
  out[4] = high & 0xff;
  out[5] = (high >>> 8) & 0xff;
  out[6] = (high >>> 16) & 0xff;
  out[7] = (high >>> 24) & 0xff;
  return out;
}

function utf16LeBytes(text) {
  const out = new Uint8Array(text.length * 2);
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);
    out[i * 2] = code & 0xff;
    out[i * 2 + 1] = (code >>> 8) & 0xff;
  }
  return out;
}

function readUint32Le(bytes, start) {
  return (
    (bytes[start] || 0) |
    ((bytes[start + 1] || 0) << 8) |
    ((bytes[start + 2] || 0) << 16) |
    ((bytes[start + 3] || 0) << 24)
  ) >>> 0;
}

function writeUint32Le(bytes, start, value) {
  const v = value >>> 0;
  bytes[start] = v & 0xff;
  bytes[start + 1] = (v >>> 8) & 0xff;
  bytes[start + 2] = (v >>> 16) & 0xff;
  bytes[start + 3] = (v >>> 24) & 0xff;
}

function normalizePassphrase(passphrase) {
  return (passphrase || '')
    .replace(/\n/g, ' ')
    .replace(/\r/g, ' ')
    .replace(/,/g, '')
    .replace(/!/g, '')
    .replace(/\./g, '')
    .trim()
    .replace(/\s+/g, ' ');
}

function normalizeUnixPath(path) {
  if (!path) return '';
  let normalized = path.replace(/\\/g, '/');
  while (normalized.startsWith('/')) normalized = normalized.slice(1);
  while (normalized.endsWith('/')) normalized = normalized.slice(0, -1);
  return normalized;
}

function blake2b512(input, key) {
  if (nativeCreateHash) {
    const data = Buffer.from(toUint8Array(input));
    const options = key ? { key: Buffer.from(toUint8Array(key)) } : undefined;
    const digest = nativeCreateHash('blake2b512', options).update(data).digest();
    return new Uint8Array(digest.buffer, digest.byteOffset, digest.byteLength);
  }
  return blake2b(input, {
    dkLen: 64,
    ...(key ? { key } : {}),
  });
}

function shouldKeepPathClear(parts) {
  return parts.some((part) => SPECIAL_DIRECTORIES.includes(part));
}

function performEncryptText(text, key) {
  const bytes = utf8Encode(text);
  let masterKey = concatBytes(key, Uint8Array.from([bytes.length & 0xff]));
  let mask = new Uint8Array(0);
  while (mask.length < bytes.length) {
    masterKey = blake2b512(masterKey);
    mask = concatBytes(mask, masterKey);
  }
  let out = '';
  for (let i = 0; i < bytes.length; i++) {
    out += SET_256_CHARS[bytes[i] ^ mask[i]];
  }
  return out;
}

function performDecryptText(text, key) {
  const bytes = new Uint8Array(text.length);
  let masterKey = concatBytes(key, Uint8Array.from([bytes.length & 0xff]));
  let mask = new Uint8Array(0);
  while (mask.length < bytes.length) {
    masterKey = blake2b512(masterKey);
    mask = concatBytes(mask, masterKey);
  }
  for (let i = 0; i < text.length; i++) {
    const charByte = CHAR_TO_BYTE[text[i]];
    if (charByte === undefined) {
      throw new Error('Invalid encrypted filename');
    }
    bytes[i] = (charByte ^ mask[i]) & 0xff;
  }
  return utf8Decode(bytes);
}

function encryptFileName(fileName, key) {
  if (!fileName) return fileName;
  const hasLeadingDot = fileName.startsWith('.');
  const namePart = hasLeadingDot ? fileName.slice(1) : fileName;
  const encrypted = performEncryptText(namePart, key);
  return `${hasLeadingDot ? '.' : ''}${encrypted}${ENCRYPT_FILE_NAME_END_CHAR}`;
}

function decryptFileName(fileName, key) {
  if (!fileName || !fileName.endsWith(ENCRYPT_FILE_NAME_END_CHAR)) {
    return fileName;
  }
  const trimmed = fileName.slice(0, -1);
  if (!trimmed) return trimmed;
  const hasLeadingDot = trimmed.startsWith('.');
  const encoded = hasLeadingDot ? trimmed.slice(1) : trimmed;
  const clear = performDecryptText(encoded, key);
  return `${hasLeadingDot ? '.' : ''}${clear}`;
}

export function encryptVirtualFullPath(clearRelativePath, filenameKey) {
  const normalized = normalizeUnixPath(clearRelativePath);
  if (!normalized) return normalized;
  const parts = normalized.split('/');
  const result = [];
  let clearFolder = false;
  for (const part of parts) {
    if (SPECIAL_DIRECTORIES.includes(part)) {
      clearFolder = true;
    }
    result.push(clearFolder ? part : encryptFileName(part, filenameKey));
  }
  return result.join('/');
}

export function decryptVirtualFullPath(virtualRelativePath, filenameKey) {
  const normalized = normalizeUnixPath(virtualRelativePath);
  if (!normalized) return normalized;
  const parts = normalized.split('/');
  const result = [];
  let clearFolder = false;
  for (const part of parts) {
    if (SPECIAL_DIRECTORIES.includes(part)) {
      clearFolder = true;
    }
    result.push(clearFolder ? part : decryptFileName(part, filenameKey));
  }
  return result.join('/');
}

export function isEncryptedVirtualPath(path) {
  const normalized = normalizeUnixPath(path);
  if (!normalized) return false;
  const parts = normalized.split('/');
  if (parts.length === 0) return false;
  return parts[parts.length - 1].endsWith(ENCRYPT_FILE_NAME_END_CHAR);
}

export function createZeroKnowledgeContext(masterKey) {
  const master = toUint8Array(masterKey);
  if (master.length !== 32) {
    throw new Error('Master key must be 32 bytes');
  }
  const filenameObfuscationKey = sha256(master);
  const contentMaster = blake2b512(concatBytes(master, filenameObfuscationKey));
  return {
    masterKey: master,
    filenameObfuscationKey,
    contentMaster,
  };
}

export function getZeroKnowledgeContext(masterKeyB64) {
  if (!masterKeyB64) return null;
  if (cachedContext.keyB64 === masterKeyB64 && cachedContext.context) {
    return cachedContext.context;
  }
  const masterKey = toUint8Array(base64ToBuffer(masterKeyB64));
  const context = createZeroKnowledgeContext(masterKey);
  cachedContext = { keyB64: masterKeyB64, context };
  return context;
}

export async function deriveZeroKnowledgeMasterKeyFromPassphrase(passphrase) {
  const cleaned = normalizePassphrase(passphrase);
  if (!cleaned) {
    throw new Error('Passphrase is required');
  }
  const mnemonic = cleaned.normalize('NFKD');
  const salt = 'mnemonic'.normalize('NFKD');
  const seed = await pbkdf2Async(sha512, utf8Encode(mnemonic), utf8Encode(salt), {
    c: 2048,
    dkLen: 64,
  });
  const hmacOut = hmac(sha512, utf8Encode('Bitcoin seed'), seed);
  return hmacOut.slice(0, 32);
}

export function getZeroKnowledgeChecksumBytes(context) {
  if (!context) return null;
  return sha256(context.filenameObfuscationKey).slice(0, 4);
}

export function deriveFileKey(virtualFullPath, unixLastWriteTimestamp, contentMaster) {
  const normalized = normalizeUnixPath(virtualFullPath);
  const pathBytes = utf16LeBytes(normalized);
  const pathLengthLe = uint64ToLeBytes(pathBytes.length);
  const unixTimeLe = uint32ToLeBytes(unixLastWriteTimestamp >>> 0);
  const preImage = concatBytes(pathBytes, pathLengthLe, unixTimeLe, contentMaster);
  return blake2b512(preImage);
}

export function createFileCipherState(derivedKey) {
  const key = toUint8Array(derivedKey);
  if (key.length !== 64) throw new Error('Derived key must be 64 bytes');
  const seal = blake2b512(key);
  const current = blake2b512(seal);
  return {
    seal,
    current,
    cycleCounter: 0,
  };
}

export function transformChunkWithCipherState(data, state) {
  const input = toUint8Array(data);
  const output = new Uint8Array(input.length);
  let offset = 0;
  let current = state.current;
  let cycleCounter = state.cycleCounter;
  const seal = state.seal;

  while (offset < input.length) {
    const remaining = input.length - offset;
    const bytesRead = remaining >= 8 ? 8 : remaining;
    const keyOffset = cycleCounter * 8;
    const inputLow = readUint32Le(input, offset);
    const inputHigh = readUint32Le(input, offset + 4);
    const keyLow = readUint32Le(current, keyOffset);
    const keyHigh = readUint32Le(current, keyOffset + 4);
    const outputLow = (inputLow ^ keyLow) >>> 0;
    const outputHigh = (inputHigh ^ keyHigh) >>> 0;
    writeUint32Le(output, offset, outputLow);
    writeUint32Le(output, offset + 4, outputHigh);
    offset += bytesRead;
    cycleCounter++;

    if (cycleCounter >= 8) {
      current = blake2b512(current, seal);
      cycleCounter = 0;
    }
  }

  state.current = current;
  state.cycleCounter = cycleCounter;
  return output;
}

const yieldToEventLoop = () => new Promise((resolve) => setTimeout(resolve, 0));

export async function transformChunkWithCipherStateYielding(
  data,
  state,
  yieldEveryBytes = 64 * 1024
) {
  const input = toUint8Array(data);
  const output = new Uint8Array(input.length);
  let offset = 0;
  let processedSinceYield = 0;
  let current = state.current;
  let cycleCounter = state.cycleCounter;
  const seal = state.seal;

  while (offset < input.length) {
    const remaining = input.length - offset;
    const bytesRead = remaining >= 8 ? 8 : remaining;
    const keyOffset = cycleCounter * 8;
    const inputLow = readUint32Le(input, offset);
    const inputHigh = readUint32Le(input, offset + 4);
    const keyLow = readUint32Le(current, keyOffset);
    const keyHigh = readUint32Le(current, keyOffset + 4);
    const outputLow = (inputLow ^ keyLow) >>> 0;
    const outputHigh = (inputHigh ^ keyHigh) >>> 0;
    writeUint32Le(output, offset, outputLow);
    writeUint32Le(output, offset + 4, outputHigh);
    offset += bytesRead;
    processedSinceYield += bytesRead;
    cycleCounter++;

    if (cycleCounter >= 8) {
      current = blake2b512(current, seal);
      cycleCounter = 0;
    }

    if (processedSinceYield >= yieldEveryBytes) {
      processedSinceYield = 0;
      await yieldToEventLoop();
    }
  }

  state.current = current;
  state.cycleCounter = cycleCounter;
  return output;
}

export function unixTimestampFromDate(dateLike) {
  if (!dateLike) return 0;
  const value = typeof dateLike === 'number' ? dateLike : new Date(dateLike).getTime();
  if (!Number.isFinite(value) || value <= 0) return 0;
  return Math.floor(value / 1000);
}

export function shouldBypassZeroKnowledgeForPath(path) {
  const normalized = normalizeUnixPath(path);
  if (!normalized) return false;
  const parts = normalized.split('/');
  return shouldKeepPathClear(parts);
}
