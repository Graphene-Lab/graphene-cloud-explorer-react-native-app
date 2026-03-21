import {
  base64ToBuffer,
  bufferToBase64,
  bufferToHex,
  bufferToInt,
  bufferToInt64,
  bufferToString,
  decryptDataFromTheDevice,
  decryptRsaOaep,
  encryptDataForTheDevice,
  encryptRsaOaep,
  enumToString,
  importRsaPublicKey,
  importSecretKey,
  int16ToBuffer,
  int32ToBuffer,
  joinBuffers,
  splitData,
  stringToBuffer,
} from './proxy-cryptography-utils';
import { store } from '../store';
import { decryptXorAB, hash256 } from './encryption-utils';
import { command, chunkSize, thumbnailSize } from '../constants';
import axios from 'axios';
import { setFavoritesList } from '../reducers/fileReducer';
import { closeModal, openModal, setWait } from '../reducers/modalReducer';
import { setOccupiedSpace } from '../reducers/filesInfoReducer';
import {
  addToMMKV,
  getUserSecretDataMMKV,
  mergeUserSecretDataMMKV,
  removeUserEncryptionTypeMMKV,
  setUserDeviceKeyMMKV,
  setUserEncryptionTypeMMKV,
  userAuthMMKV,
} from './mmkv';
import { setAuthWait, setUserSecretDataToRedux } from '../reducers/userSecretDataReducer';
import { MinHeap } from './MinHeap';
import { DeviceEventEmitter, Platform, NativeModules } from 'react-native';
import {
  finishUploadProgress,
  registerUploadProgress,
  updateUploadProgress,
} from './files-trasnfer';
import RNFetchBlob from 'rn-fetch-blob';
import { downloadSetProgress } from '../reducers/filesTransferNewReducer';
import {
  downloadNotificationRegister,
  cancelNotification,
  notificationUpdate,
} from './notification-utils';
import { enqueue, forceEnqueue } from '../reducers/refreshQueueReducer';
import { useErrorAlert } from '../hooks/useErrorAlert';
import { parseSingle } from './parser';
import { reportCrash } from './crashlytics-utils';
import {
  createFileCipherState,
  decryptVirtualFullPath,
  deriveFileKey,
  deriveZeroKnowledgeMasterKeyFromPassphrase,
  encryptVirtualFullPath,
  getZeroKnowledgeChecksumBytes,
  getZeroKnowledgeContext,
  isEncryptedVirtualPath,
  shouldBypassZeroKnowledgeForPath,
  transformChunkWithCipherState,
  transformChunkWithCipherStateYielding,
  unixTimestampFromDate,
} from './zero-knowledge-utils';

var download = [];
var upload = [];
const uploadZeroKnowledge = {};
const downloadZeroKnowledge = {};
const downloadRequestMeta = {};
const fileMetadataByClearPath = {};
const uploadMetadataByClearPath = {};
const downloadChunks = {};
const downloadChunkSizes = {};

const DEBUG_DOWNLOAD_TIMING = true;

const DOWNLOAD_DECRYPT_CHUNK_BYTES = 64 * 1024;
const yieldToJs = () => new Promise((resolve) => setTimeout(resolve, 0));
const DOWNLOAD_BASE64_CHUNK_BYTES = 192 * 1024; // multiple of 3 for safe base64 concatenation
const DOWNLOAD_JOIN_CHUNK_BYTES = 1024 * 1024;
const UPLOAD_ENCRYPT_CHUNK_BYTES = 64 * 1024;
const nativeZkCipher = NativeModules?.ZkCipher;
const DEBUG_ZK_UPLOAD = true;
const DEBUG_ZK_DOWNLOAD = true;
const DEBUG_ZK_KEY_DERIVATION = true;
const DEBUG_PROTOCOL_UNHANDLED = true;
let lastProtocolDebug = null;

function uint8ToHexPreview(view, max = 16) {
  if (!view) return '';
  const bytes = view instanceof Uint8Array ? view : new Uint8Array(view);
  const end = Math.min(bytes.length, max);
  let out = '';
  for (let i = 0; i < end; i++) {
    out += bytes[i].toString(16).padStart(2, '0');
  }
  if (bytes.length > max) out += '…';
  return out;
}

function uint8ToBase64(view) {
  if (!view) return '';
  const bytes = view instanceof Uint8Array ? view : new Uint8Array(view);
  const slice = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
  return bufferToBase64(slice);
}

function estimateBase64ByteLength(base64) {
  if (!base64) return 0;
  let padding = 0;
  if (base64.endsWith('==')) padding = 2;
  else if (base64.endsWith('=')) padding = 1;
  return Math.max(0, Math.floor((base64.length * 3) / 4) - padding);
}

async function decryptChunksWithYield(chunks, state) {
  const output = [];
  for (const chunk of chunks) {
    output.push(
      await transformChunkWithCipherStateYielding(chunk, state, DOWNLOAD_DECRYPT_CHUNK_BYTES)
    );
  }
  return output;
}

async function decryptChunksNative(chunksBase64, derivedKey) {
  if (!nativeZkCipher?.cryptZkChunksBase64) {
    return null;
  }
  const derivedBytes = derivedKey instanceof Uint8Array ? derivedKey : new Uint8Array(derivedKey);
  const derivedB64 = uint8ToBase64(derivedBytes);
  if (DEBUG_ZK_DOWNLOAD) {
    console.log('[ZK:DL] native decrypt', {
      derivedLen: derivedBytes.length,
      derivedHead: uint8ToHexPreview(derivedBytes),
      chunks: chunksBase64?.length || 0,
    });
  }
  return nativeZkCipher.cryptZkChunksBase64(chunksBase64, derivedB64);
}

async function encryptChunkNativeWithState(chunkB64, state) {
  if (!nativeZkCipher?.cryptZkChunkBase64WithState || !state) {
    return null;
  }
  if (!state.nativeSealB64) {
    state.nativeSealB64 = uint8ToBase64(state.seal);
  }
  const currentB64 = uint8ToBase64(state.current);
  if (DEBUG_ZK_UPLOAD) {
    console.log('[ZK:UL] native chunk', {
      sealLen: state.seal?.length,
      sealHead: uint8ToHexPreview(state.seal),
      currentLen: state.current?.length,
      currentHead: uint8ToHexPreview(state.current),
      cycleCounter: state.cycleCounter,
      chunkB64Len: chunkB64?.length,
    });
  }
  const result = await nativeZkCipher.cryptZkChunkBase64WithState(
    chunkB64,
    state.nativeSealB64,
    currentB64,
    state.cycleCounter || 0
  );
  if (!result || !result.chunkB64) {
    return null;
  }
  if (result.currentB64) {
    state.current = new Uint8Array(base64ToBuffer(result.currentB64));
  }
  state.cycleCounter = typeof result.cycleCounter === 'number' ? result.cycleCounter : 0;
  if (DEBUG_ZK_UPLOAD) {
    console.log('[ZK:UL] native chunk done', {
      cycleCounter: state.cycleCounter,
      currentHead: uint8ToHexPreview(state.current),
      outB64Len: result.chunkB64?.length,
    });
  }
  return result.chunkB64;
}

function concatUint8(a, b) {
  if (!a?.length) return b;
  if (!b?.length) return a;
  const out = new Uint8Array(a.length + b.length);
  out.set(a, 0);
  out.set(b, a.length);
  return out;
}

async function concatChunksWithYield(chunks, totalLength) {
  if (!chunks?.length) return new ArrayBuffer(0);
  const out = new Uint8Array(totalLength);
  let offset = 0;
  let copiedSinceYield = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.length;
    copiedSinceYield += chunk.length;
    if (copiedSinceYield >= DOWNLOAD_JOIN_CHUNK_BYTES) {
      copiedSinceYield = 0;
      await yieldToJs();
    }
  }
  return out.buffer;
}

async function bufferToBase64Yielding(buffer) {
  const bytes = new Uint8Array(buffer);
  let out = '';
  let carry = new Uint8Array(0);
  for (let offset = 0; offset < bytes.length; offset += DOWNLOAD_BASE64_CHUNK_BYTES) {
    const end = Math.min(offset + DOWNLOAD_BASE64_CHUNK_BYTES, bytes.length);
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
      out += bufferToBase64(safeChunk.buffer);
    }
    if (offset + DOWNLOAD_BASE64_CHUNK_BYTES < bytes.length) {
      await yieldToJs();
    }
  }
  if (carry.length) {
    out += bufferToBase64(carry.buffer);
  }
  return out;
}

function normalizeRelativeUnixPath(path) {
  if (!path) return '';
  let normalized = path.replace(/\\/g, '/');
  while (normalized.startsWith('/')) normalized = normalized.slice(1);
  while (normalized.endsWith('/')) normalized = normalized.slice(0, -1);
  return normalized;
}

function getVirtualName(name) {
  if (!name) return name;
  const parts = normalizeRelativeUnixPath(name).split('/');
  return parts[parts.length - 1];
}

function getZeroKnowledgeState() {
  const { zeroKnowledgeMasterKeyB64, zeroKnowledgeEnabled } = store.getState().userSecret;
  if (!zeroKnowledgeEnabled) {
    return null;
  }
  return getZeroKnowledgeContext(zeroKnowledgeMasterKeyB64);
}

function getZeroKnowledgeChecksum() {
  const zk = getZeroKnowledgeState();
  return getZeroKnowledgeChecksumBytes(zk);
}

function encryptPathForTransport(path) {
  const normalized = normalizeRelativeUnixPath(path);
  if (!normalized || normalized.startsWith(':')) {
    return normalized;
  }
  const zk = getZeroKnowledgeState();
  if (!zk || isEncryptedVirtualPath(normalized)) {
    return normalized;
  }
  return encryptVirtualFullPath(normalized, zk.filenameObfuscationKey);
}

function decryptPathForUi(path) {
  const normalized = normalizeRelativeUnixPath(path);
  if (!normalized || normalized.startsWith(':')) {
    return normalized;
  }
  const zk = getZeroKnowledgeState();
  if (!zk || !isEncryptedVirtualPath(normalized)) {
    return normalized;
  }
  return decryptVirtualFullPath(normalized, zk.filenameObfuscationKey);
}

function getUnixLastWriteTimestamp(source) {
  if (!source) return 0;
  if (typeof source.UnixLastWriteTimestamp === 'number') {
    return source.UnixLastWriteTimestamp >>> 0;
  }
  if (typeof source.UnixLastWriteTimestamp === 'string') {
    const parsed = Number(source.UnixLastWriteTimestamp);
    if (Number.isFinite(parsed) && parsed > 0) {
      const normalized = parsed > 1e12 ? Math.floor(parsed / 1000) : Math.floor(parsed);
      return normalized >>> 0;
    }
  }
  if (typeof source.unixLastWriteTimestamp === 'number') {
    return source.unixLastWriteTimestamp >>> 0;
  }
  if (typeof source.unixLastWriteTimestamp === 'string') {
    const parsed = Number(source.unixLastWriteTimestamp);
    if (Number.isFinite(parsed) && parsed > 0) {
      const normalized = parsed > 1e12 ? Math.floor(parsed / 1000) : Math.floor(parsed);
      return normalized >>> 0;
    }
  }
  if (source.rawDate || source.Date) {
    return unixTimestampFromDate(source.rawDate || source.Date) >>> 0;
  }
  return 0;
}

function cacheFileMetadata(clearPath, item) {
  if (!clearPath) return;
  fileMetadataByClearPath[clearPath] = {
    unixLastWriteTimestamp: getUnixLastWriteTimestamp(item),
    length: item?.Length,
  };
}

async function readFileUnixLastWrite(file) {
  if (typeof file?.lastModified === 'number' && file.lastModified > 0) {
    return Math.floor(file.lastModified / 1000);
  }
  if (typeof file?.lastModifiedTime === 'number' && file.lastModifiedTime > 0) {
    return Math.floor(file.lastModifiedTime / 1000);
  }
  const uri = file?.uri || file?.fileCopyUri;
  if (!uri) return 0;
  try {
    const normalized = decodeURIComponent(uri.replace(/^file:/, ''));
    const stat = await RNFetchBlob.fs.stat(normalized);
    const candidate = stat?.lastModified || stat?.mtime || stat?.timestamp;
    const numeric = Number(candidate);
    return Number.isFinite(numeric) && numeric > 0 ? Math.floor(numeric / 1000) : 0;
  } catch (error) {
    return 0;
  }
}

function getZeroKnowledgeUploadContext(fullName, unixLastWriteTimestamp) {
  const zk = getZeroKnowledgeState();
  if (!zk) {
    return null;
  }
  const virtualFullName = encryptVirtualFullPath(fullName, zk.filenameObfuscationKey);
  const derived = deriveFileKey(virtualFullName, unixLastWriteTimestamp, zk.contentMaster);
  if (DEBUG_ZK_KEY_DERIVATION) {
    console.log('[ZK:UL] derive', {
      clearFullName: fullName,
      virtualFullName,
      unixLastWriteTimestamp,
      derivedHead: uint8ToHexPreview(derived),
    });
  }
  return {
    virtualFullName,
    displayFullName: fullName,
    state: createFileCipherState(derived),
  };
}

function getZeroKnowledgeDownloadContext(virtualFullName, unixLastWriteTimestamp) {
  const zk = getZeroKnowledgeState();
  if (
    !zk ||
    !isEncryptedVirtualPath(virtualFullName)
  ) {
    if (DEBUG_ZK_KEY_DERIVATION) {
      console.log('[ZK:DL] skip derive (no zk or not encrypted)', {
        virtualFullName,
        unixLastWriteTimestamp,
        hasZk: !!zk,
        isEncrypted: isEncryptedVirtualPath(virtualFullName),
      });
    }
    return null;
  }
  if (!unixLastWriteTimestamp) {
    if (DEBUG_ZK_KEY_DERIVATION) {
      console.log('[ZK:DL] skip derive (missing timestamp)', {
        virtualFullName,
        unixLastWriteTimestamp,
      });
    }
    return null;
  }
  const displayFullName = decryptVirtualFullPath(virtualFullName, zk.filenameObfuscationKey);
  const virtualForKey = encryptVirtualFullPath(displayFullName, zk.filenameObfuscationKey);
  const derived = deriveFileKey(virtualForKey, unixLastWriteTimestamp, zk.contentMaster);
  if (DEBUG_ZK_KEY_DERIVATION) {
    console.log('[ZK:DL] derive', {
      virtualFullName,
      displayFullName,
      unixLastWriteTimestamp,
      derivedHead: uint8ToHexPreview(derived),
    });
  }
  return {
    displayFullName,
    derivedKey: derived,
    state: createFileCipherState(derived),
  };
}

async function saveZeroKnowledgePhrase(passphrase) {
  const masterKey = await deriveZeroKnowledgeMasterKeyFromPassphrase(passphrase);
  const masterB64 = bufferToBase64(masterKey.buffer);
  await mergeUserSecretDataMMKV({
    zeroKnowledgeMasterKeyB64: masterB64,
    zeroKnowledgeEnabled: true,
    zeroKnowledgePrompted: true,
  });
  store.dispatch(
    setUserSecretDataToRedux({
      zeroKnowledgeMasterKeyB64: masterB64,
      zeroKnowledgeEnabled: true,
      zeroKnowledgePrompted: true,
    })
  );
}

async function skipZeroKnowledgeSetup() {
  await mergeUserSecretDataMMKV({
    zeroKnowledgeMasterKeyB64: null,
    zeroKnowledgeEnabled: false,
    zeroKnowledgePrompted: true,
  });
  store.dispatch(
    setUserSecretDataToRedux({
      zeroKnowledgeMasterKeyB64: null,
      zeroKnowledgeEnabled: false,
      zeroKnowledgePrompted: true,
    })
  );
}

function showAuthenticationSuccess() {
  store.dispatch(
    openModal({
      content: 'You successfully authenticated your account',
      head: 'Successful',
      type: 'info',
      icon: 'qr',
    })
  );
}

function promptZeroKnowledgeSetupIfNeeded() {
  const { zeroKnowledgePrompted } = store.getState().userSecret;
  if (zeroKnowledgePrompted) {
    showAuthenticationSuccess();
    return;
  }

  store.dispatch(
    openModal({
      head: 'Zero-knowledge encryption',
      content:
        'Enter your desktop 12-word passphrase to enable encrypted file names and contents. Tap Skip if desktop zero-knowledge was never enabled.',
      type: 'confirm',
      icon: 'question',
      buttonText: 'Enter phrase',
      callback: () => {
        store.dispatch(
          openModal({
            head: 'Enter passphrase',
            content: '',
            type: 'input',
            callback: async () => {
              const phrase = (store.getState().modalController.text || '').trim();
              try {
                await saveZeroKnowledgePhrase(phrase);
                store.dispatch(closeModal());
                store.dispatch(
                  openModal({
                    head: 'Zero-knowledge enabled',
                    content: 'Passphrase accepted. File names and file bytes will now use zero-knowledge mode.',
                    type: 'info',
                    icon: 'check',
                  })
                );
              } catch (error) {
                store.dispatch(setWait(false));
                store.dispatch(
                  openModal({
                    head: 'Passphrase error',
                    content:
                      'The passphrase could not be processed. Enter the same desktop passphrase or tap Skip in the previous step.',
                    type: 'info',
                    icon: 'ex',
                  })
                );
              }
            },
          })
        );
      },
      cancelCallback: async () => {
        await skipZeroKnowledgeSetup();
        showAuthenticationSuccess();
      },
    })
  );
}

export function ensureZeroKnowledgeReadyForAuthentication() {
  const { zeroKnowledgePrompted } = store.getState().userSecret;
  if (zeroKnowledgePrompted) {
    return Promise.resolve(true);
  }

  return new Promise((resolve) => {
    store.dispatch(
      openModal({
        head: 'Zero-knowledge encryption',
        content:
          'Enter your desktop 12-word passphrase before authentication if this cloud uses zero-knowledge encryption. Tap Skip if this cloud was not created with zero-knowledge encryption.',
        type: 'confirm',
        icon: 'question',
        buttonText: 'Enter phrase',
        cancelButtonText: 'Skip',
        overlayColor: '#F5F7FB',
        callback: () => {
          store.dispatch(
            openModal({
              head: 'Enter passphrase',
              content: '',
              type: 'input',
              cancelButtonText: 'Skip',
              overlayColor: '#F5F7FB',
              cancelCallback: async () => {
                await skipZeroKnowledgeSetup();
                resolve(true);
              },
              callback: async () => {
                const phrase = (store.getState().modalController.text || '').trim();
                try {
                  store.dispatch(closeModal());
                  store.dispatch(setAuthWait(true));
                  await yieldToJs();
                  await saveZeroKnowledgePhrase(phrase);
                  resolve(true);
                } catch (error) {
                  store.dispatch(setAuthWait(false));
                  store.dispatch(setWait(false));
                  store.dispatch(
                    openModal({
                      head: 'Passphrase error',
                      content:
                        'The passphrase could not be processed. Retry sign-in and enter the same desktop passphrase, or use Skip if this cloud does not use zero-knowledge encryption.',
                      type: 'info',
                      icon: 'ex',
                      callback: async () => {
                        store.dispatch(setAuthWait(false));
                        resolve(false);
                      },
                    })
                  );
                }
              },
            })
          );
        },
        cancelCallback: async () => {
          await skipZeroKnowledgeSetup();
          resolve(true);
        },
      })
    );
  });
}



const makeUtilMarker = (flow) => `UTIL_FLOW_${flow}_${Date.now()}`;

function bytesToSize(bytes) {
  var sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  if (bytes == -1) return 'Unlimited';
  if (bytes == 0) return '0 Byte';
  const i = Math.min(sizes.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
  const value = bytes / Math.pow(1024, i);
  const formatted = i === 0
    ? Math.round(value).toString()
    : value.toLocaleString(undefined, { minimumFractionDigits: 3, maximumFractionDigits: 3 });
  return `${formatted} ${sizes[i]}`;
}

export async function setClient(rsaPubKey) {
  // deviceKey = null; // the server will send a new encryption ke
  let clientPublicKey = base64ToBuffer(store.getState().userSecret.publicKeyB64);
  let clientSetting = joinBuffers(int32ToBuffer(chunkSize), int16ToBuffer(thumbnailSize));
  clientSetting = joinBuffers(clientSetting, clientPublicKey);
  return encryptRsaOaep(rsaPubKey, clientSetting).then((clientSettingEncrypted) => {
    return executeRequest(command.SetClient, clientSettingEncrypted);
  });
}

export function getCommandName(commandId) {
  return enumToString(command, commandId);
}

const maxConcurrentRequest = 2;
const REQUEST_TIMEOUT_MS = 30000;
const SLOW_INTERNET_THRESHOLD_MS = 15000;
const DEBUG_REQUEST_MARKERS = true;
var concurrentRequest = 0;
let spooler = [];
const shouldShowSlowInternetModal = (commandId) => commandId !== command.GetFile;

function logRequestMarker(event, commandId, extra = '') {
  if (!DEBUG_REQUEST_MARKERS) return;
  const commandName = getCommandName(commandId) || commandId;
  console.log(`[REQ:${event}] ${commandName}${extra ? ` | ${extra}` : ''}`);
}

DeviceEventEmitter.addListener('spoolerCleaner', () => {
  spooler = [];
  concurrentRequest = 0;
});

export function executeRequest(commandId, data, options = {}) {
  return new Promise((resolve, reject) => {
    if (commandId === 8) MinHeap.push(spooler, [10, [commandId, data, resolve, reject, options]]);
    else if (commandId === 19) MinHeap.push(spooler, [8, [commandId, data, resolve, reject, options]]);
    else MinHeap.push(spooler, [5, [commandId, data, resolve, reject, options]]);
    spoolingRequest();
  });
}

function isAbortLikeError(error) {
  return (
    error?.name === 'CanceledError' ||
    error?.name === 'AbortError' ||
    error?.message === 'canceled'
  );
}

function requestDone() {
  concurrentRequest--;
  if (spooler.length > 0) {
    return spoolingRequest();
  }
}

async function spoolingRequest() {
  console.log('Concurrent requests:', concurrentRequest);

  if (concurrentRequest < maxConcurrentRequest && spooler.length > 0) {
    concurrentRequest++;
    let commandId = null;
    // -try
    try {
      let [priority, toProcessing] = MinHeap.pop(spooler);
      // spooler.pop();

      console.log('Priority: ', priority, ', CommandId:', getCommandName(toProcessing[0]));
      commandId = toProcessing[0];
      let data = toProcessing[1];
      const originalData = toProcessing[1];
      let resolve = toProcessing[2];
      let reject = toProcessing[3];
      const options = toProcessing[4] || {};
      const suppressSlowModal = !!options.suppressSlowModal;
      logRequestMarker('start', commandId, `queue=${spooler.length},concurrent=${concurrentRequest}`);

      if (commandId == null) {
        console.log('Command does not exist');
      }
      if (!data) {
        data = '';
      }
      if (typeof data === 'string') {
        data = stringToBuffer(data);
      }
      let get = commandId == command.GetPushNotifications;
      let url =
        store.getState().proxyManager.proxy +
        '/data?cid=' +
        encodeURIComponent(store.getState().userSecret.clientId);
      console.log('url set to: ' + url);

      let purpose;

      if (commandId == command.SetClient || commandId == command.GetEncryptedQR) {
        url += '&sid=' + encodeURIComponent(store.getState().userSecret.serverId);
        purpose = getCommandName(commandId);
        url += '&purpose=' + getCommandName(commandId); // SetClient Parameter is used only in debug that indicates whether a public encryption key is sent to the device. In releise the key is never sent it must be scanned by QR code
      }

      const workPromise = (async () => {
        if (purpose === getCommandName(command.GetEncryptedQR)) {
          const controller = new AbortController();
          const signal = controller.signal;
          let retryRequested = false;
          let abortReason = null;
          const abortRequest = (reason) => {
            if (!abortReason) abortReason = reason;
            controller.abort();
          };
          let reqTimeout = setTimeout(() => abortRequest('timeout'), REQUEST_TIMEOUT_MS);
          let lowInternet = suppressSlowModal
            ? null
            : setTimeout(() => {
              store.dispatch(
                openModal({
                  head: 'Pay attention',
                  content: 'Your internet connection is slow. Would you like to retry?',
                  type: 'confirm',
                  buttonText: 'Retry',
                  icon: 'ex',
                  callback: () => {
                    logRequestMarker('retry', commandId, 'slow-internet modal');
                    retryRequested = true;
                    abortRequest('retry');
                    store.dispatch(setAuthWait(false));
                  },
                  cancelCallback: () => {
                    logRequestMarker('cancel', commandId, 'slow-internet modal');
                    abortRequest('cancel');
                    store.dispatch(setAuthWait(false));
                  }
                })
              );
            }, SLOW_INTERNET_THRESHOLD_MS);
          try {
            const response = await axios.post(url, data, { timeout: REQUEST_TIMEOUT_MS, signal });
            return onCommandResponse.GetEncryptedQR(response.data);
          } catch (error) {
            if (retryRequested) {
              logRequestMarker('retry-dispatch', commandId);
              return executeRequest(commandId, originalData, { suppressSlowModal: true });
            }
            if (isAbortLikeError(error) && abortReason === 'cancel') {
              return null;
            }
            const shouldHandleAsFailure = !isAbortLikeError(error) || abortReason === 'timeout';
            console.log('Error fetching encrypted QR data:', error);
            if (shouldHandleAsFailure) {
              reportCrash(error, {
                screen: 'DataTransmission',
                flow: 'getEncryptedQrRequest',
                commandId,
                proxy: store.getState().proxyManager.proxy,
              });
            }
            if (shouldHandleAsFailure) {
              throw error;
            }
            return null;
          } finally {
            clearTimeout(reqTimeout);
            clearTimeout(lowInternet);
          }
        } else if (commandId == command.SetClient) {
          const controller = new AbortController();
          const signal = controller.signal;
          let retryRequested = false;
          let abortReason = null;
          const abortRequest = (reason) => {
            if (!abortReason) abortReason = reason;
            controller.abort();
          };
          let reqTimeout = setTimeout(() => abortRequest('timeout'), REQUEST_TIMEOUT_MS);
          let lowInternet = suppressSlowModal
            ? null
            : setTimeout(() => {
              store.dispatch(openModal({
                head: 'Pay attention',
                content: 'Your internet connection is slow. Would you like to retry?',
                type: 'confirm',
                buttonText: 'Retry',
                icon: 'ex',
                callback: () => {
                  logRequestMarker('retry', commandId, 'slow-internet modal');
                  retryRequested = true;
                  abortRequest('retry');
                  store.dispatch(setAuthWait(false));
                },
                cancelCallback: () => {
                  logRequestMarker('cancel', commandId, 'slow-internet modal');
                  abortRequest('cancel');
                  store.dispatch(setAuthWait(false));
                }
              }))
            }, SLOW_INTERNET_THRESHOLD_MS)
          try {
            const response = await axios.post(url, data, { timeout: REQUEST_TIMEOUT_MS, signal });
            clearTimeout(reqTimeout);
            clearTimeout(lowInternet);
            return handleResponse(response, { commandId, commandName: getCommandName(commandId) });
          } catch (error) {
            if (retryRequested) {
              logRequestMarker('retry-dispatch', commandId);
              return executeRequest(commandId, originalData, { suppressSlowModal: true });
            }
            if (isAbortLikeError(error) && abortReason === 'cancel') {
              return null;
            }
            const shouldHandleAsFailure = !isAbortLikeError(error) || abortReason === 'timeout';
            if (shouldHandleAsFailure) {
              reportCrash(error, {
                screen: 'DataTransmission',
                flow: 'setClientRequest',
                commandId,
                proxy: store.getState().proxyManager.proxy,
              });
            }
            clearTimeout(reqTimeout);
            clearTimeout(lowInternet);
            store.dispatch(setAuthWait(false));

            if (shouldHandleAsFailure) {
              store.dispatch(
                openModal({
                  head: 'Pay attention',
                  content:
                    'There was a problem connect to Uup-Cloud. Please try again and make sure the Cloud Box or mobile phone is connected to the Internet.',
                  type: 'info',
                  icon: 'ex',
                })
              );
            }
            if (shouldHandleAsFailure) {
              throw error;
            }
            return null;
          }
        } else if (get) {
          const controller = new AbortController();
          const signal = controller.signal;
          let retryRequested = false;
          let abortReason = null;
          const abortRequest = (reason) => {
            if (!abortReason) abortReason = reason;
            controller.abort();
          };
          let reqTimeout = setTimeout(() => abortRequest('timeout'), REQUEST_TIMEOUT_MS);
          let lowInternet = suppressSlowModal
            ? null
            : setTimeout(() => {
              store.dispatch(openModal({
                head: 'Pay attention',
                content: 'Your internet connection is slow. Would you like to retry?',
                type: 'confirm',
                buttonText: 'Retry',
                icon: 'ex',
                callback: () => {
                  logRequestMarker('retry', commandId, 'slow-internet modal');
                  retryRequested = true;
                  abortRequest('retry');
                },
                cancelCallback: () => {
                  logRequestMarker('cancel', commandId, 'slow-internet modal');
                  abortRequest('cancel');
                }
              }))
            }, SLOW_INTERNET_THRESHOLD_MS)
          try {
            const response = await axios.get(url, { timeout: REQUEST_TIMEOUT_MS, signal });
            clearTimeout(reqTimeout);
            clearTimeout(lowInternet);
            return handleResponse(response, { commandId, commandName: getCommandName(commandId) });
          } catch (error) {
            if (retryRequested) {
              logRequestMarker('retry-dispatch', commandId);
              return executeRequest(commandId, originalData, { suppressSlowModal: true });
            }
            if (isAbortLikeError(error) && abortReason === 'cancel') {
              return null;
            }
            const shouldHandleAsFailure = !isAbortLikeError(error) || abortReason === 'timeout';
            if (shouldHandleAsFailure) {
              reportCrash(error, {
                screen: 'DataTransmission',
                flow: 'getRequest',
                commandId,
                proxy: store.getState().proxyManager.proxy,
              });
            }
            if (shouldHandleAsFailure) {
              throw error;
            }
            return null;
          } finally {
            clearTimeout(reqTimeout);
            clearTimeout(lowInternet);
          }
        } else {
          if (data == null) {
            data = int32ToBuffer(commandId);
          } else {
            let cmd = int32ToBuffer(commandId);
            data = joinBuffers(cmd, data);
          }
          return await encryptDataForTheDevice(data, commandId)
            .then(async (encrypted) => {
              const controller = new AbortController();
              const signal = controller.signal;
              let retryRequested = false;
              let abortReason = null;
              const abortRequest = (reason) => {
                if (!abortReason) abortReason = reason;
                controller.abort();
              };
              let reqTimeout = setTimeout(() => abortRequest('timeout'), REQUEST_TIMEOUT_MS);
              let lowInternet = !suppressSlowModal && shouldShowSlowInternetModal(commandId)
                ? setTimeout(() => {
                  store.dispatch(openModal({
                    head: 'Pay attention',
                    content: 'Your internet connection is slow. Would you like to retry?',
                    type: 'confirm',
                    buttonText: 'Retry',
                    icon: 'ex',
                    callback: () => {
                      logRequestMarker('retry', commandId, 'slow-internet modal');
                      retryRequested = true;
                      abortRequest('retry');
                    },
                    cancelCallback: () => {
                      logRequestMarker('cancel', commandId, 'slow-internet modal');
                      abortRequest('cancel');
                    }
                  }))
                }, SLOW_INTERNET_THRESHOLD_MS)
                : null;
              try {
                const response = await axios.post(url, encrypted, { timeout: REQUEST_TIMEOUT_MS, signal });
                const result = await handleResponse(response, { commandId, commandName: getCommandName(commandId) });
                clearTimeout(reqTimeout);
                clearTimeout(lowInternet);
                return result;
              } catch (error) {
                if (retryRequested) {
                  logRequestMarker('retry-dispatch', commandId);
                  return executeRequest(commandId, originalData, { suppressSlowModal: true });
                }
                if (isAbortLikeError(error) && abortReason === 'cancel') {
                  return null;
                }
                const shouldHandleAsFailure = !isAbortLikeError(error) || abortReason === 'timeout';
                if (shouldHandleAsFailure) {
                  reportCrash(error, {
                    screen: 'DataTransmission',
                    flow: 'encryptedPostRequest',
                    commandId,
                    proxy: store.getState().proxyManager.proxy,
                  });
                }
                clearTimeout(reqTimeout);
                clearTimeout(lowInternet);
                if (shouldHandleAsFailure) {
                  if (commandId === command.Authentication) {
                    store.dispatch(setAuthWait(false));
                  }
                  store.dispatch(
                    openModal({
                      head: 'Failed to connect',
                      content:
                        commandId === command.Authentication
                          ? 'Authentication did not complete. The PIN proof or zero-knowledge checksum may not match what the server expects.'
                          : 'Please try again and make sure the Cloud Box or device is connected to the Internet and Cloud Box working correctly.',
                      type: 'confirm',
                      callback: () => {
                        DeviceEventEmitter.emit('spoolerCleaner');
                        store.dispatch(enqueue(['CloudScreen', 'MediaScreen', 'FavoriteScreen']));
                      },
                    })
                  );
                }
                if (shouldHandleAsFailure) {
                  throw error;
                }
                return null;
              }
            })
            .catch((error) => {
              if (!isAbortLikeError(error)) {
                reportCrash(error, {
                  screen: 'DataTransmission',
                  flow: 'encryptDataForTheDevice',
                  commandId,
                  proxy: store.getState().proxyManager.proxy,
                });
              }
              throw error;
            });
        }
      })();

      workPromise
        .then((result) => resolve?.(result))
        .catch((error) => reject?.(error));
    } catch (error) {
      reportCrash(error, {
        screen: 'DataTransmission',
        flow: 'spoolingRequest',
        proxy: store.getState().proxyManager.proxy,
      });
    } finally {
      logRequestMarker('finally', commandId, `queue=${spooler.length},concurrent=${concurrentRequest - 1}`);
      requestDone();
    }
  }
}

async function handleResponse(response, debugContext = null) {
  // console.log('Handling response');  log for
  const readyStateDone =
    response?.readyState === undefined ||
    response?.DONE === undefined ||
    response.readyState == response.DONE;
  const hasBody = response?.data !== undefined && response?.data !== null && response.data !== '';
  if (readyStateDone && response?.status == 200 && hasBody) {
    const { encryptionType } = await getUserSecretDataMMKV();
    const protocolDebug = DEBUG_PROTOCOL_UNHANDLED
      ? {
        encryptionType,
        status: response?.status,
        requestCommandId: debugContext?.commandId ?? null,
        requestCommand: debugContext?.commandName ?? null,
      }
      : null;
    lastProtocolDebug = protocolDebug;
    const deviceKey = store.getState().userSecret.deviceKey;
    if (debugContext?.commandId === command.SetClient && !deviceKey) {
      return asymmetricalDecrypt(response.data).then((decrypted) => {
        if (protocolDebug) {
          protocolDebug.decryptedLen = decrypted?.byteLength ?? decrypted?.length ?? 0;
          protocolDebug.decryptedHead = uint8ToHexPreview(decrypted);
        }
        return onResponse(decrypted);
      });
    }
    if (encryptionType === 'xorAB') {
      // Use the generated key sent by the server
      return decryptResponse(response.data, protocolDebug).then((decrypted) => {
        return onResponse(decrypted);
      });
    } else {
      // Use encryption with keys generated on the client
      return asymmetricalDecrypt(response.data).then((decrypted) => {
        if (protocolDebug) {
          protocolDebug.decryptedLen = decrypted?.byteLength ?? decrypted?.length ?? 0;
          protocolDebug.decryptedHead = uint8ToHexPreview(decrypted);
        }
        return onResponse(decrypted);
      });
    }
  }
  console.log('Unexpected response shape:', {
    status: response?.status,
    hasData: hasBody,
    readyState: response?.readyState,
    done: response?.DONE,
  });
  return undefined;
}

export function onResponse(binary) {
  let commandId = bufferToInt(binary.slice(0, 4));
  let command = getCommandName(commandId);
  let data = binary.slice(4);
  let params = splitData(data);
  const handler = onCommandResponse[command];
  if (typeof handler !== 'function') {
    console.log('Unhandled response command:', {
      commandId,
      command,
      dataLength: data?.byteLength,
      debug: lastProtocolDebug || undefined,
    });
    lastProtocolDebug = null;
    return undefined;
  }
  lastProtocolDebug = null;
  return handler(params);
}

export function decryptResponse(encryptedResponseB64, debug = null) {
  let encryptedData = base64ToBuffer(encryptedResponseB64);
  if (debug) {
    debug.encryptedLen = encryptedData?.byteLength ?? 0;
    debug.encryptedHead = uint8ToHexPreview(encryptedData);
  }
  let data = decryptDataFromTheDevice(encryptedData);
  return Promise.resolve(data).then((decrypted) => {
    if (debug) {
      debug.decryptedLen = decrypted?.byteLength ?? decrypted?.length ?? 0;
      debug.decryptedHead = uint8ToHexPreview(decrypted);
    }
    return decrypted;
  });
}

export async function authentication(auth, clientId) {
  const zkReady = await ensureZeroKnowledgeReadyForAuthentication();
  if (!zkReady) {
    return undefined;
  }
  let pin = store.getState().userSecret.devicePin;
  let pin4 = int32ToBuffer(pin);
  let authentication = joinBuffers(auth, pin4);
  const hash = await hash256(authentication);
  let verify = hash.slice(0, 4);
  const zeroKnowledgeChecksum = getZeroKnowledgeChecksum();
  const payload = zeroKnowledgeChecksum ? joinBuffers(verify, zeroKnowledgeChecksum) : verify;
  return await executeRequest(command.Authentication, payload, clientId);
}

export async function downloadArrayBuffer(fileName, bytes, isShare) {
  let extension = fileName.substring(fileName.lastIndexOf('.') + 1);
  extension = extension.toLowerCase();
  let type;
  switch (extension) {
    case 'mp4':
    case 'mpg':
    case 'mpeg':
    case 'mpe':
      type = 'video/mpeg';
      break;
    case 'mov':
    case 'qt':
    case 'movie':
      type = 'video/quicktime';
      break;
    case 'avi':
      type = 'video/x-msvideo';
      break;
    case 'mp3':
      type = 'audio/mpeg';
      break;
    case 'jpg':
    case 'jpeg':
      type = 'image/jpeg';
      break;
    case 'png':
      type = 'image/png';
      break;
    case 'tif':
      type = 'image/tiff';
      break;
    case 'ico':
      type = 'image/ico';
      break;
    case 'doc':
    case 'docx':
      type = 'application/msword';
      break;
    default:
      type = 'application/' + extension;
  }
  const chunks = Array.isArray(bytes) ? bytes : bytes?.chunks;
  if (isShare) {
    var isShare = confirm('Share ' + fileName + ' ?');
  }
  if (isShare) {
    let payload = bytes;
    if (chunks) {
      const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
      payload = await concatChunksWithYield(chunks, totalLength);
    }
    // NOTE: In the tested browser the share function does not work, it returns an error on permissions in performing the operation. So in fact you need to download and then share the file
    let file = new File([payload], fileName, { type: type });
    let filesArray = [];
    filesArray.push(file);
    navigator
      .share({
        files: filesArray,
        title: 'Share file',
        text: fileName,
      })
      .then(() => console.log('Share was successful.'))
      .catch((error) => {
        // alertBox(error);
        console.log('Sharing failed', error);
      });
  } else {
    return {
      type,
      chunks: chunks || undefined,
      bytes: chunks ? null : bytes,
      data: null,
      thumbnail: null,
    };
  }
}

export const onCommandResponse = {
  SetClient: function (params) {
    console.log('The device received the public key in debug mode!');
  },
  Authentication: async function (params) {
    await userAuthMMKV();
    DeviceEventEmitter.emit('logIn');
    store.dispatch(forceEnqueue("CloudScreen"))
    store.dispatch(setAuthWait(false));
    showAuthenticationSuccess();
    // return getDir("");
    // getDir("");
  },
  // Successful pairing with the device: When the device has scanned the QR code with the public key we receive the encryption key that we must use to send and receive commands to the server!
  Pair: async function (params) {
    let clientIdHex = bufferToHex(params[0]);
    let deviceIV = params[2];
    let auth = params[3];
    if (clientIdHex != store.getState().userSecret.clientId) {
      // console.log('Wrong connection, key verification failed!');  log for
    } else if (store.getState().userSecret.deviceKey != undefined) {
      // console.log('Attempt to change the encryption key!');  log for
    } else {
      let deviceKey;
      if (params[1].byteLength > 0) {
        await setUserEncryptionTypeMMKV('aes');
        store.dispatch(setUserSecretDataToRedux({ encryptionType: 'aes' }));
        deviceKey = params[1];
        const key = await importSecretKey(deviceKey);
        deviceKey.key = key;
        deviceKey.IV = deviceIV;
        const fin = { key: key, IV: deviceIV };
        const keyB64 = bufferToBase64(deviceKey);
        const ivB64 = bufferToBase64(deviceIV);

        await setUserDeviceKeyMMKV({ keyB64, ivB64 });
        store.dispatch(setUserSecretDataToRedux({ deviceKey: fin }));
      } else {
        await setUserEncryptionTypeMMKV('xorAB');
        store.dispatch(setUserSecretDataToRedux({ encryptionType: 'xorAB' }));
      }
    }
    // Authentication
    return authentication(auth, store.getState().userSecret.clientId);
  },

  // Error: async function (params) {
  //   let error = bufferToString(params[0]);
  //   // useErrorAlert('error -> ', error);
  //   if (error && error === 'error: wrong pin') {
  //     await removeUserEncryptionTypeMMKV();
  //     store.dispatch(setAuthWait(false));
  //     store.dispatch(setUserSecretDataToRedux(null));
  //     store.dispatch(
  //       openModal({
  //         content: 'Qr or pin is incorrect',
  //         head: 'Error',
  //         type: 'info',
  //         icon: 'qr',
  //         callback: async () => {
  //           // await AsyncStorage.multiRemove(["clientId", "encryptionType", "publicKeyB64", "serverId", "auth"])
  //           // store.dispatch(renderScreen(['WelcomeScreen']))
  //         },
  //       })
  //     );
  //   }
  // },
  GetDir: async function (params) {
    const clearPath = decryptPathForUi(bufferToString(params[0]));
    let jsonObject = JSON.parse(bufferToString(params[1]));
    for (let i = 0; i < jsonObject.length; i++) {
      const item = jsonObject[i];
      item.Name = decryptPathForUi(item.Name);
      const clearFullName = clearPath ? `${clearPath}/${item.Name}` : item.Name;
      cacheFileMetadata(clearFullName, item);
    }
    return jsonObject;
  },

  Error: async function (params) {
    let error = bufferToString(params[0]);
    // useErrorAlert('error -> 2', error);
    if (error && error === 'error: wrong pin') {
      store.dispatch(setAuthWait(false));
      await removeUserEncryptionTypeMMKV();
      // store.dispatch(setUserSecretDataToRedux(null));
      // store.dispatch(setUserSecretDataToRedux())
      // console.log(error);
      store.dispatch(
        openModal({
          content: 'Wrong pin',
          head: 'Error',
          type: 'info',
          icon: 'qr',
          callback: async () => { },
        })
      );
      return false;
    }
  },

  GetFile: async function (params, isShare) {
    if (isShare === undefined) {
      isShare = false;
    }

    let jsonObject = JSON.parse(bufferToString(params[0]));
    // let crc = jsonObject.Crc; // uint
    let fullName = normalizeRelativeUnixPath(jsonObject.FullName); // transport full path string
    let filename = fullName.replace(/^.*[\\\/]/, '');
    let dataBase64 = jsonObject.Data; // base64
    let chunkPart = jsonObject.ChunkPart;
    let totalChunk = jsonObject.TotalChunk;
    const requestMeta = downloadRequestMeta[fullName];
    const trackedPath = requestMeta?.requestPath || decryptPathForUi(fullName) || fullName;
    const notifyTitle = requestMeta?.clearFullName || trackedPath || fullName;
    const downloadQueue = store.getState().newFileTransfer.downloadQueue;
    const updateProgress = (progress) => {
      const candidates = [
        trackedPath,
        requestMeta?.requestPath,
        requestMeta?.clearFullName,
        decryptPathForUi(fullName),
      ];
      const seen = new Set();
      for (const candidate of candidates) {
        if (!candidate || seen.has(candidate)) continue;
        seen.add(candidate);
        if (downloadQueue.includes(candidate)) {
          store.dispatch(downloadSetProgress({ path: candidate, progress }));
        }
      }
    };
    const unixFromChunk = getUnixLastWriteTimestamp(jsonObject);

    if (chunkPart == 1) {
      let unixLastWrite =
        requestMeta?.unixLastWriteTimestamp ||
        unixFromChunk ||
        getUnixLastWriteTimestamp(requestMeta);
      if (!unixLastWrite) {
        const cachedMeta = fileMetadataByClearPath[trackedPath];
        if (cachedMeta?.unixLastWriteTimestamp) {
          unixLastWrite = cachedMeta.unixLastWriteTimestamp >>> 0;
        }
      }
      downloadRequestMeta[fullName] = {
        ...(requestMeta || {}),
        requestPath: trackedPath,
        clearFullName: decryptPathForUi(fullName),
        unixLastWriteTimestamp: unixLastWrite >>> 0,
      };
      if (DEBUG_ZK_DOWNLOAD) {
        console.log('[ZK:DL] start', {
          fullName,
          trackedPath,
          unixFromChunk,
          unixLastWrite: unixLastWrite >>> 0,
        });
      }
      const chunkB64 = dataBase64;
      downloadChunks[fullName] = [chunkB64];
      downloadChunkSizes[fullName] = estimateBase64ByteLength(chunkB64);
      updateProgress(0);
      let selectedFile = store.getState().files.selectedFile;
      let mb = bytesToSize(selectedFile['Length']);
      const firstChunkNotifyTitle = requestMeta?.clearFullName || trackedPath || fullName;
      downloadNotificationRegister({
        id: trackedPath,
        title: firstChunkNotifyTitle,
        size: mb,
        max: totalChunk,
      });
    } else {
      const progress = Math.floor((chunkPart * 100) / totalChunk);
      updateProgress(progress);
      Platform.OS === 'android' &&
        notificationUpdate({ id: trackedPath, current: chunkPart, title: notifyTitle });
      const chunkB64 = dataBase64;
      const existing = downloadChunks[fullName] || [];
      existing.push(chunkB64);
      downloadChunks[fullName] = existing;
      downloadChunkSizes[fullName] =
        (downloadChunkSizes[fullName] || 0) + estimateBase64ByteLength(chunkB64);
    }
    //   downloadProgressBar(filename, download[fullName].byteLength)

    if (chunkPart == totalChunk) {
      updateProgress(100);
      cancelNotification({ id: trackedPath, title: notifyTitle });
      await yieldToJs();
      const timingStart = DEBUG_DOWNLOAD_TIMING ? Date.now() : 0;
      const context = downloadRequestMeta[fullName] || {};
      const chunksBase64 = downloadChunks[fullName] || [];
      downloadChunks[fullName] = null;
      downloadChunkSizes[fullName] = 0;
      if (unixFromChunk) {
        context.unixLastWriteTimestamp = unixFromChunk >>> 0;
      }
      let finalChunks = [];
      let usedNativeDecrypt = false;
      if (isEncryptedVirtualPath(fullName)) {
        const unixLastWrite =
          context.unixLastWriteTimestamp ||
          fileMetadataByClearPath[trackedPath]?.unixLastWriteTimestamp ||
          0;
        if (unixLastWrite) {
          const resolved = getZeroKnowledgeDownloadContext(fullName, unixLastWrite);
          if (resolved) {
            const decryptStart = DEBUG_DOWNLOAD_TIMING ? Date.now() : 0;
            const nativeDecrypted = await decryptChunksNative(
              chunksBase64,
              resolved.derivedKey
            );
            if (nativeDecrypted) {
              usedNativeDecrypt = true;
              finalChunks = nativeDecrypted.map((b64) => new Uint8Array(base64ToBuffer(b64)));
            } else {
              const chunkBytes = chunksBase64.map(
                (b64) => new Uint8Array(base64ToBuffer(b64))
              );
              finalChunks = await decryptChunksWithYield(chunkBytes, resolved.state);
            }
            if (DEBUG_DOWNLOAD_TIMING) {
              console.log('[DL] decrypt done', {
                fullName,
                ms: Date.now() - decryptStart,
                chunks: finalChunks.length,
                native: usedNativeDecrypt,
              });
            }
            context.clearFullName = resolved.displayFullName;
          }
        }
      }
      if (!finalChunks.length) {
        finalChunks = chunksBase64.map((b64) => new Uint8Array(base64ToBuffer(b64)));
      }
      if (context.clearFullName) {
        filename = context.clearFullName.replace(/^.*[\\\/]/, '');
      }
      if (DEBUG_DOWNLOAD_TIMING) {
        console.log('[DL] assemble done', {
          fullName,
          ms: Date.now() - timingStart,
          chunks: finalChunks.length,
        });
      }
      const buffer = await downloadArrayBuffer(filename, finalChunks, isShare);
      if (DEBUG_DOWNLOAD_TIMING) {
        console.log('[DL] downloadArrayBuffer done', {
          fullName,
          ms: Date.now() - timingStart,
        });
      }
      downloadRequestMeta[fullName] = null;
      return buffer;
    } else {
      return getFile(fullName, chunkPart + 1);
    }
  },
  Share: function (params) {
    return this.GetFile(params, true);
  },
  SetFile: function (params) {
    // let nameFileAndChunk = bufferToString(params[0]);
    // let nameFileAndChunkParts = nameFileAndChunk.split('\t');
    // let fullNameFile = nameFileAndChunkParts[0];
    // let chunkNumber = parseInt(nameFileAndChunkParts[1]);
    // return setFile(fullNameFile, chunkNumber + 1, upload[fullNameFile]);
    return true;
  },
  Delete: function (params) {
    return onCommandResponse.GetDir(params);
  },
  Rename: function (params) {
    return onCommandResponse.GetDir(params);
  },
  Move: function (params) {
    return onCommandResponse.GetDir(params);
  },
  Copy: function (params) {
    return onCommandResponse.GetDir(params);
  },
  CreateDir: function (params) {
    return onCommandResponse.GetDir(params);
  },
  Search: function (params) {
    return onCommandResponse.GetDir(params);
  },
  GetGroup: function (params) {
    return onCommandResponse.GetDir(params);
  },
  AddToGroup: function (params) {
    return onCommandResponse.GetDir(params);
  },
  RemoveFromGroup: function (params) {
    return onCommandResponse.GetDir(params);
  },
  GetStorageInfo: function (params) {
    let freeSpace = bufferToString(params[0]);
    let usedSpace = bufferToString(params[1]);
    return { usedMemory: usedSpace, totalMemory: freeSpace };
  },
  GetFreeSpace: function (params) {
    return bufferToInt64(params[0]);
  },
  GetUsedSpace: function (params) {
    return bufferToInt64(params[0]);
  },
  GetOccupiedSpace: function (params) {
    let path = bufferToString(params[0]);
    if (path == '') {
      path = 'cloud';
    }
    let regEx = bufferToString(params[1]);
    let spaceOccupied = bufferToString(params[2]);
    store.dispatch(
      setOccupiedSpace({
        type: regEx,
        size: Math.floor(parseInt(spaceOccupied)),
        total: store.getState().profile.usedMemory,
      })
    );
    return spaceOccupied;
  },
  GetEncryptedQR: function (encryptedDataB64) {
    let encryptedData = base64ToBuffer(encryptedDataB64);
    decryptXorAB(store.getState().userSecret.qr, encryptedData).then((data) => {
      store.dispatch(setUserSecretDataToRedux({ qr: null }));
      let offset = 0;
      let type = new Uint8Array(data.slice(offset, 1))[0];
      if (type == 2) {
        offset += 1;
        let mSize = 2048 / 8; //NOTE: modules with sizes different of 2048 give an error during encryption in JavaScript
        let modulus = data.slice(offset, offset + mSize);
        offset += mSize;
        let exponent = data.slice(offset, offset + 3);
        importRsaPublicKey(modulus, exponent).then((rsaPubKey) => {
          setClient(rsaPubKey);
        });
      } else {
        // console.log("QR code format not supported!")  log for s
      }
    });
  },
};

export function getDir(path) {
  const normalized = normalizeRelativeUnixPath(path);
  return executeRequest(command.GetDir, encryptPathForTransport(normalized));
}

export const setFileStream = async (b64, file, index, path) => {
  // chunkSize -> chunk size
  const clearFullName = normalizeRelativeUnixPath(path + file.name);
  let totalChunk = Math.ceil(file.size / chunkSize);
  let position = (index - 1) * chunkSize;

  if (index === 1) {
    let unixLastWriteTimestamp = await readFileUnixLastWrite(file);
    if (!unixLastWriteTimestamp) {
      unixLastWriteTimestamp = Math.floor(Date.now() / 1000);
    }
    uploadMetadataByClearPath[clearFullName] = {
      unixLastWriteTimestamp,
    };
    uploadZeroKnowledge[clearFullName] = getZeroKnowledgeUploadContext(
      clearFullName,
      unixLastWriteTimestamp
    );
    registerUploadProgress({
      name: file.name,
      size: file.size,
      chunkNumber: index,
      parts: totalChunk,
    });
  }

  if (index < totalChunk) {
    updateUploadProgress({
      name: file.name,
      size: position,
      chunkNumber: index,
      parts: totalChunk,
    });
  }

  if (index > totalChunk) {
    const uploadContext = uploadZeroKnowledge[clearFullName];
    const uploadedVirtualName = uploadContext ? getVirtualName(uploadContext.virtualFullName) : file.name;
    const uploadMeta = uploadMetadataByClearPath[clearFullName];
    if (uploadMeta?.unixLastWriteTimestamp) {
      fileMetadataByClearPath[clearFullName] = {
        unixLastWriteTimestamp: uploadMeta.unixLastWriteTimestamp >>> 0,
        length: file?.size,
      };
    }
    uploadZeroKnowledge[clearFullName] = null;
    uploadMetadataByClearPath[clearFullName] = null;
    finishUploadProgress({
      name: file.name,
      size: position,
      chunkNumber: index,
      parts: totalChunk,
    });
    const res = await getDir(path);
    let find = res.find((item) => item.Name == uploadedVirtualName || item.Name == file.name);
    let currentFile = parseSingle(find, path);
    return addToMMKV(currentFile);
  }

  const uploadContext = uploadZeroKnowledge[clearFullName];
  let fullNameToSend = clearFullName;
  let dataToSend = b64;
  if (uploadContext) {
    const nativeEncrypted = await encryptChunkNativeWithState(b64, uploadContext.state);
    if (nativeEncrypted) {
      dataToSend = nativeEncrypted;
    } else {
      const encryptedChunk = await transformChunkWithCipherStateYielding(
        new Uint8Array(base64ToBuffer(b64)),
        uploadContext.state,
        UPLOAD_ENCRYPT_CHUNK_BYTES
      );
      dataToSend = bufferToBase64(encryptedChunk.buffer);
    }
    fullNameToSend = uploadContext.virtualFullName;
  }

  const unixLastWriteTimestamp =
    uploadMetadataByClearPath[clearFullName]?.unixLastWriteTimestamp || 0;
  let File = {
    FullName: fullNameToSend,
    Data: dataToSend,
    ChunkPart: index,
    TotalChunk: totalChunk,
    UnixLastWriteTimestamp: unixLastWriteTimestamp,
  };
  if (DEBUG_ZK_UPLOAD) {
    console.log('[ZK:UL] send chunk', {
      clearFullName,
      fullNameToSend,
      unixLastWriteTimestamp,
      chunkPart: index,
      totalChunk,
      dataB64Len: dataToSend?.length,
    });
  }
  return executeRequest(command.SetFile, JSON.stringify(File));
};

// export async function setFile(fullFileName, chunkNumber, data) {
//   // chunkNumber is base 1 (the first chunk is number 1)
//   var chunkSize = 1024 * 256;
//   let fileLength = new Uint8Array(data).length;
//   let parts = Math.ceil(fileLength / chunkSize);
//   parts = parts == 0 ? 1 : parts;
//   let position = (chunkNumber - 1) * chunkSize;

//   if (chunkNumber == 1) {
//     registerUploadProgress({ name: fullFileName, size: fileLength, chunkNumber, parts })
//     upload[fullFileName] = data;
//   }
//   if (chunkNumber > parts) {
//     upload[fullFileName] = null;
//     let path = fullFileName.split('/').slice(0, -1).join('/');
//     const uploadedFileName = fullFileName.split('/').pop();
//     finishUploadProgress({ name: fullFileName, size: position, chunkNumber, parts });

//     return getDir(path).then(res => {
//       let find = res.find(item => item.Name == uploadedFileName)
//       return {
//         file: find,
//         response: res
//       }
//     })
//     // return getDir(path).then((alldata) => {
//     //   const found = alldata.find(function (post, index) {
//     //     if (post.Name == upladedFileName) return true;
//     //   });
//     //   return found;
//     // });
//     // return getDir(path);
//   } else {
//     updateUploadProgress({ name: fullFileName, size: position, chunkNumber, parts });
//   }

//   let toTake = fileLength - position;
//   if (toTake > chunkSize) toTake = chunkSize;
//   let chunkData = data.slice(position, position + toTake);
//   let File = {
//     FullName: fullFileName,
//     Data: bufferToBase64(chunkData),
//     ChunkPart: chunkNumber,
//     TotalChunk: parts,
//   };
//   // onComplete;
//   console.log({
//     FullName: fullFileName,
//     Data: bufferToBase64(chunkData).slice(0, 7),
//     ChunkPart: chunkNumber,
//     TotalChunk: parts,
//   });
//   return executeRequest(command.SetFile, JSON.stringify(File));
// }

export function asymmetricalDecrypt(encryptedResponseB64) {
  let encryptedData = base64ToBuffer(encryptedResponseB64);
  return decryptRsaOaep(encryptedData, store.getState().userSecret.privateKey);
}

export function getFile(fullFileName, chunkNumber, rawDate = null) {
  // chunkNumber is base 1 (the first chunk is number 1)
  const normalized = normalizeRelativeUnixPath(fullFileName);
  const transportPath = encryptPathForTransport(normalized);
  if (chunkNumber === 1) {
    const cachedMeta = fileMetadataByClearPath[normalized];
    downloadRequestMeta[transportPath] = {
      rawDate,
      requestPath: normalized,
      unixLastWriteTimestamp:
        unixTimestampFromDate(rawDate) || cachedMeta?.unixLastWriteTimestamp || 0,
      length: cachedMeta?.length || 0,
    };
  }
  return executeRequest(command.GetFile, transportPath + '\t' + chunkNumber);
}

export function search(path, wildcards, page, elementForPage) {
  // for pagination page is the page number (zero base), and elementsForPage indicates how many results are visible for each single page (-1 = do not limit the results)
  if (wildcards) {
    path = encryptPathForTransport(path);
    return executeRequest(
      command.Search,
      path + '\t' + wildcards + '\t' + page + '\t' + elementForPage
    );
  }
}

export async function GetStorageInfo() {
  const [freeSpace, usedSpace] = await Promise.all([
    executeRequest(command.GetFreeSpace),
    executeRequest(command.GetUsedSpace),
  ]);
  return { usedMemory: usedSpace, totalMemory: freeSpace };
}

export function getGroup(groupName) {
  return executeRequest(command.GetGroup, groupName);
}

function startsWithNumber(str) {
  return /^\d/.test(str);
}

function getNumberAtEnd(str) {
  if (startsWithNumber(str)) {
    let current = Number(str.match(/^\d+/)[0]);
    return str.replace(/^\d+/, current + 1);
  }

  return '0_copy_' + str;
}

export const getFavoritesNames = async () => {
  const data = await getGroup('favorites');
  const names = data?.map((items) => items.Name.replace('loudBoxNuget/Cloud0/', ''));
  store.dispatch(setFavoritesList(names));
  return data;
};

export const delete_ = (path, files) => {
  if (files) {
    path = encryptPathForTransport(path);
    if (Array.isArray(files)) {
      files = files.map((file) => encryptPathForTransport(file)).join('\t');
    } else {
      files = encryptPathForTransport(files);
    }
    return executeRequest(command.Delete, path + '\t' + files);
  }
};

export const createDir = (path, files) => {
  if (files) {
    path = encryptPathForTransport(path);
    if (Array.isArray(files)) {
      files = files.map((file) => encryptPathForTransport(file)).join('\t');
    } else {
      files = encryptPathForTransport(files);
    }
  }
  return executeRequest(command.CreateDir, path + '\t' + files);
};

export function addToGroup(groupname, files, clientId) {
  if (Array.isArray(files)) {
    files = files.map((file) => encryptPathForTransport(file)).join('\t');
  } else if (files) {
    files = encryptPathForTransport(files);
  }
  return executeRequest(command.AddToGroup, groupname + '\t' + (files || ''), clientId);
}

export function removeFromGroup(groupname, files) {
  if (Array.isArray(files)) {
    files = files.map((file) => encryptPathForTransport(file)).join('\t');
  } else if (files) {
    files = encryptPathForTransport(files);
  }
  return executeRequest(command.RemoveFromGroup, groupname + '\t' + (files || ''));
}

export function rename(path, files, target) {
  if (files) {
    path = encryptPathForTransport(path);
    if (Array.isArray(files)) {
      files = files.map((file) => encryptPathForTransport(file)).join('\t');
    } else {
      files = encryptPathForTransport(files);
    }
    target = encryptPathForTransport(target);
  }
  return executeRequest(command.Rename, path + '\t' + files + '\t' + target);
}

export function copy(path, files, target) {
  if (files) {
    path = encryptPathForTransport(path);
    if (Array.isArray(files)) {
      files = files.map((file) => encryptPathForTransport(file)).join('\t');
    } else {
      files = encryptPathForTransport(files);
    }
    target = encryptPathForTransport(target);
  }
  return executeRequest(command.Copy, path + '\t' + files + '\t' + target);
}

export function move(path, files, target) {
  if (files) {
    path = encryptPathForTransport(path);
    if (Array.isArray(files)) {
      files = files.map((file) => encryptPathForTransport(file)).join('\t');
    } else {
      files = encryptPathForTransport(files);
    }
    target = encryptPathForTransport(target);
  }
  return executeRequest(command.Move, path + '\t' + files + '\t' + target);
}
export function GetOccupiedSpace(path, wilscards) {
  // The wildcard can be replaced by regular expressions to perform advanced searches
  if (wilscards) {
    return executeRequest(command.GetOccupiedSpace, path + '\t' + wilscards);
  }
}
