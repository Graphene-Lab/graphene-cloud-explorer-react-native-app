import React from 'react';
import { Alert, NativeModules, PermissionsAndroid, Platform } from 'react-native';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { configureStore } from '@reduxjs/toolkit';
import { Provider } from 'react-redux';
import RNFetchBlob from 'react-native-blob-util';
import { __values as persistedValues } from 'react-native-mmkv';
import notifee from '@notifee/react-native';
import Share from 'react-native-share';
import ConfirmModal from '../../src/components/modal/confirm';
import { renderThumbnail } from '../../src/components/view-items/renderThumbnail';
import modalReducer from '../../src/reducers/modalReducer';
import transferReducer from '../../src/reducers/filesTransferNewReducer';
import { store as appStore } from '../../src/store';
import { downloadFile, shareFile } from '../../src/utils/settings-utils';
import { getFile } from '../../src/utils/data-transmission-utils';
import { fileExistsCheck } from '../../src/utils/local-files';
import { getSavedDownload } from '../../src/utils/download-index';
import { downloadNotificationRegister } from '../../src/utils/notification-utils';
import { openFileNatively } from '../../src/components/view-items/functions';

jest.mock('../../src/store', () => ({ store: { getState: jest.fn(), dispatch: jest.fn() } }));
jest.mock('../../src/utils/data-transmission-utils', () => ({ getFile: jest.fn() }));
jest.mock('../../src/utils/mmkv', () => ({ addToMMKV: jest.fn() }));
jest.mock('../../src/utils/essential-functions', () => ({}));
jest.mock('../../src/utils/file-reading', () => ({}));
jest.mock('../../src/utils/crashlytics-utils', () => ({ reportCrash: jest.fn() }));
jest.mock('../../src/components/modal/iconManager', () => ({ iconManager: () => null }));
jest.mock('../../src/utils/proxy-cryptography-utils', () => ({
  bufferToBase64: (buffer) => require('buffer').Buffer.from(buffer).toString('base64'),
}));
jest.mock('expo-document-picker', () => ({}));
jest.mock('react-native-share', () => ({ open: jest.fn() }));
jest.mock('@expo/vector-icons', () => ({
  Entypo: () => null, MaterialIcons: () => null, MaterialCommunityIcons: () => null,
  FontAwesome: () => null, SimpleLineIcons: () => null,
}));
jest.mock('react-native-mmkv', () => {
  const values = new Map();
  return {
    __values: values,
    MMKV: jest.fn().mockImplementation(() => ({
      getString: (key) => values.get(key),
      set: (key, value) => values.set(key, value),
      delete: (key) => values.delete(key),
    })),
  };
});
jest.mock('react-native-blob-util', () => {
  const files = new Map();
  const directories = new Set();
  const Buffer = require('buffer').Buffer;
  return {
    __files: files,
    __directories: directories,
    fs: {
      dirs: { CacheDir: '/cache', DocumentDir: '/documents', DownloadDir: '/app/Download' },
      exists: jest.fn(async (path) => files.has(path) || directories.has(path)),
      mkdir: jest.fn(async (path) => directories.add(path)),
      stat: jest.fn(async (path) => {
        if (!files.has(path)) throw new Error('File missing');
        return { size: files.get(path).length, lastModified: Date.now() };
      }),
      createFile: jest.fn(async (path, data) => files.set(path, Buffer.from(data, 'base64'))),
      unlink: jest.fn(async (path) => {
        directories.delete(path);
        for (const key of files.keys()) if (key === path || key.startsWith(path + '/')) files.delete(key);
      }),
      writeStream: jest.fn(async (path) => {
        files.set(path, Buffer.alloc(0));
        return {
          write: jest.fn(async (data) => files.set(path, Buffer.concat([files.get(path), Buffer.from(data, 'base64')]))),
          close: jest.fn(async () => {}),
        };
      }),
    },
    android: { actionViewIntent: jest.fn() },
    ios: { openDocument: jest.fn() },
  };
});
jest.mock('@notifee/react-native', () => ({
  __esModule: true,
  default: { requestPermission: jest.fn(), createChannel: jest.fn(async () => 'downloads'), displayNotification: jest.fn() },
  AndroidImportance: { HIGH: 4 }, AndroidStyle: { BIGTEXT: 1 },
}));
jest.mock('../../src/i18n', () => ({
  __esModule: true,
  default: { t: (key, values = {}) => {
    const translations = require('../../src/i18n/locales/en.json');
    const message = key.split('.').reduce((value, part) => value?.[part], translations);
    if (typeof message !== 'string') throw new Error(`Missing translation: ${key}`);
    return message.replace(/\{\{(\w+)\}\}/g, (_, name) => values[name]);
  } },
}));
jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: require('../../src/i18n').default.t }) }));

const Buffer = require('buffer').Buffer;
const payload = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3, 4, 5, 6, 0xff, 0xd9]);
const publicFiles = new Map();
const makeFile = (name = 'photo.JPG', path = name) => ({
  name, path, location: '', type: 'image', Length: payload.length, rawDate: '2026-10-20T10:00:00Z',
});
let reduxStore;
const selectFile = (file = makeFile(), clientId = 'client-a') => {
  reduxStore = configureStore({
    reducer: {
      modalController: modalReducer, newFileTransfer: transferReducer,
      files: () => ({ selectedFile: file, location: '' }),
      bottomSheetManager: () => ({ fromScreen: 'CloudScreen' }),
      userSecret: () => ({ proxy: 'https://example.invalid', serverId: 'server', clientId }),
    },
    middleware: (getDefault) => getDefault({ serializableCheck: false }),
  });
  appStore.getState.mockImplementation(reduxStore.getState);
  appStore.dispatch.mockImplementation(reduxStore.dispatch);
  return reduxStore;
};
const bridge = {
  exportFile: jest.fn(), statFile: jest.fn(), openFile: jest.fn(), shareFile: jest.fn(),
};
const savedAs = (name = 'photo.JPG', index = 1, mime = 'image/jpeg') => ({
  uri: `content://media/external/downloads/${index}`, name, mime,
  size: payload.length, displayPath: `Downloads/Graphene Cloud Explorer/${name}`,
});
const successBodies = () => notifee.displayNotification.mock.calls
  .map(([notification]) => notification.body).filter((body) => body.startsWith('Saved to'));

beforeEach(() => {
  Object.defineProperty(Platform, 'OS', { configurable: true, value: 'android' });
  Object.defineProperty(Platform, 'Version', { configurable: true, value: 35 });
  NativeModules.PublicDownloads = bridge;
  jest.spyOn(PermissionsAndroid, 'check').mockResolvedValue(true);
  jest.spyOn(PermissionsAndroid, 'request').mockResolvedValue(PermissionsAndroid.RESULTS.GRANTED);
  jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  jest.spyOn(global.console, 'log').mockImplementation(() => {});
  persistedValues.clear(); publicFiles.clear(); RNFetchBlob.__files.clear(); RNFetchBlob.__directories.clear();
  bridge.exportFile.mockReset().mockImplementation(async (source, name, mime) => {
    const saved = savedAs(name, publicFiles.size + 1, mime);
    publicFiles.set(saved.uri, Buffer.from(RNFetchBlob.__files.get(source)));
    return saved;
  });
  bridge.statFile.mockReset().mockImplementation(async (uri) => publicFiles.has(uri) ? { size: publicFiles.get(uri).length } : null);
  bridge.openFile.mockReset().mockResolvedValue(true);
  bridge.shareFile.mockReset().mockResolvedValue(true);
  getFile.mockReset().mockImplementation(async (path) => {
    await downloadNotificationRegister({ id: path, title: path, size: '12 B', max: 1 });
    return { type: 'image/jpeg', chunks: [new Uint8Array(payload.subarray(0, 4)), new Uint8Array(payload.subarray(4))] };
  });
  selectFile();
});

afterEach(cleanup);

test.each([['photo.JPG', 'image/jpeg'], ['song.MP3', 'audio/mpeg'], ['report.pdf', 'application/pdf']])(
  'exports %s with its correct MIME type and complete bytes', async (name, mime) => {
    const file = makeFile(name); selectFile(file);
    const saved = await downloadFile();
    expect(bridge.exportFile).toHaveBeenCalledWith(expect.stringMatching(/^\/cache\/download-.*\//), name, mime);
    expect(publicFiles.get(saved.uri)).toEqual(payload);
    expect(RNFetchBlob.__files.size).toBe(0);
    expect(await fileExistsCheck(file)).toMatchObject({ uri: saved.uri, source: saved.uri, mime, publicDownload: true });
    expect(reduxStore.getState().newFileTransfer.downloadQueue).toEqual([]);
  }
);

test('waits for the public save before showing success, then the real Open button uses the URI', async () => {
  let completeExport;
  bridge.exportFile.mockImplementation(() => new Promise((resolve) => { completeExport = resolve; }));
  const pending = downloadFile();
  await waitFor(() => expect(bridge.exportFile).toHaveBeenCalled());
  expect(successBodies()).toEqual([]);
  expect(reduxStore.getState().modalController.visible).toBe(false);
  completeExport(savedAs());
  await pending;
  expect(successBodies()).toEqual(['Saved to Downloads/Graphene Cloud Explorer/photo.JPG']);
  render(<Provider store={reduxStore}><ConfirmModal /></Provider>);
  expect(await screen.findByText('Saved to Downloads/Graphene Cloud Explorer/photo.JPG')).toBeTruthy();
  await act(async () => fireEvent.press(screen.getByText('Open')));
  expect(bridge.openFile).toHaveBeenCalledWith(savedAs().uri, 'image/jpeg');
  expect(RNFetchBlob.android.actionViewIntent).not.toHaveBeenCalled();
});

test('failed export clears progress and staging without success or a saved index', async () => {
  bridge.exportFile.mockRejectedValue(new Error('Storage full'));
  expect(await downloadFile()).toBeNull();
  expect(successBodies()).toEqual([]);
  expect(Alert.alert).toHaveBeenCalledWith('Error', 'Could not save the file. Please try again.');
  expect(getSavedDownload('photo.JPG')).toBeNull();
  expect(reduxStore.getState().newFileTransfer.downloadQueue).toEqual([]);
  expect(RNFetchBlob.__files.size).toBe(0);
});

test('partial local writes never reach public storage', async () => {
  getFile.mockResolvedValue({ type: 'image/jpeg', bytes: new Uint8Array([1, 2]) });
  expect(await downloadFile()).toBeNull();
  expect(bridge.exportFile).not.toHaveBeenCalled();
  expect(successBodies()).toEqual([]);
});

test('a failed staging write closes the stream and never announces success', async () => {
  const close = jest.fn().mockResolvedValue();
  RNFetchBlob.fs.writeStream.mockResolvedValueOnce({ write: jest.fn().mockRejectedValue(new Error('Write failed')), close });
  expect(await downloadFile()).toBeNull();
  expect(close).toHaveBeenCalledTimes(1);
  expect(bridge.exportFile).not.toHaveBeenCalled();
  expect(successBodies()).toEqual([]);
  expect(RNFetchBlob.__files.size).toBe(0);
});

test('exports an existing private download without another network download', async () => {
  RNFetchBlob.__files.set('/app/Download/image/photo.JPG', payload);
  await downloadFile();
  expect(getFile).not.toHaveBeenCalled();
  expect(bridge.exportFile).toHaveBeenCalledWith('/app/Download/image/photo.JPG', 'photo.JPG', 'image/jpeg');
  expect(RNFetchBlob.__files.get('/app/Download/image/photo.JPG')).toEqual(payload);
});

test('persists URI records across module reload and keeps different accounts separate', async () => {
  const saved = await downloadFile();
  let reloadedIndex;
  jest.isolateModules(() => { reloadedIndex = require('../../src/utils/download-index'); });
  expect(reloadedIndex.getSavedDownload('photo.JPG').uri).toBe(saved.uri);
  selectFile(makeFile(), 'client-b');
  expect(await fileExistsCheck(makeFile())).toBe(false);
  selectFile();
  expect((await fileExistsCheck(makeFile())).uri).toBe(saved.uri);
});

test('a deleted or changed public download can be downloaded again', async () => {
  const saved = await downloadFile();
  publicFiles.delete(saved.uri);
  expect(await fileExistsCheck(makeFile())).toBe(false);
  await downloadFile();
  expect(getFile).toHaveBeenCalledTimes(2);
  expect(await fileExistsCheck({ ...makeFile(), rawDate: '2026-10-21T10:00:00Z' })).toBe(false);
});

test('keeps same filenames from different cloud folders separate and shows MediaStore actual name', async () => {
  const first = await downloadFile();
  selectFile(makeFile('photo.JPG', 'other/photo.JPG'));
  bridge.exportFile.mockImplementationOnce(async () => {
    const saved = savedAs('photo (1).JPG', 2);
    publicFiles.set(saved.uri, payload);
    return saved;
  });
  const second = await downloadFile();
  expect(first.uri).not.toBe(second.uri);
  expect(bridge.exportFile.mock.calls[0][0]).not.toBe(bridge.exportFile.mock.calls[1][0]);
  expect(getSavedDownload('photo.JPG').uri).toBe(first.uri);
  expect(getSavedDownload('other/photo.JPG').uri).toBe(second.uri);
  expect(reduxStore.getState().modalController.content).toContain('photo (1).JPG');
});

test('reusing a valid public download does not create a duplicate', async () => {
  await downloadFile(); await downloadFile();
  expect(getFile).toHaveBeenCalledTimes(1);
  expect(bridge.exportFile).toHaveBeenCalledTimes(1);
});

test('opens and shares content URIs without converting them into file paths', async () => {
  const saved = await downloadFile();
  await openFileNatively(saved.uri, saved.mime, saved.uri);
  await shareFile();
  expect(bridge.openFile).toHaveBeenCalledWith(saved.uri, 'image/jpeg');
  expect(bridge.shareFile).toHaveBeenCalledWith(saved.uri, 'image/jpeg', expect.any(String));
  expect(Share.open).not.toHaveBeenCalled();
  render(renderThumbnail({ type: 'image', local: true, source: saved.uri }, 8));
  expect(screen.UNSAFE_getByType(require('react-native').Image).props.source.uri).toBe(saved.uri);
});

test('requests legacy storage permission only on Android 9 and handles denial', async () => {
  Object.defineProperty(Platform, 'Version', { configurable: true, value: 28 });
  PermissionsAndroid.check.mockResolvedValue(false);
  PermissionsAndroid.request.mockResolvedValue(PermissionsAndroid.RESULTS.DENIED);
  expect(await downloadFile()).toBeNull();
  expect(PermissionsAndroid.request).toHaveBeenCalledWith(PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE);
  expect(bridge.exportFile).not.toHaveBeenCalled();
  expect(successBodies()).toEqual([]);
});

test('modern Android needs no broad storage permission and still saves when notifications are denied', async () => {
  PermissionsAndroid.check.mockResolvedValue(false);
  PermissionsAndroid.request.mockResolvedValue(PermissionsAndroid.RESULTS.DENIED);
  expect(await downloadFile()).toMatchObject({ publicDownload: true });
  expect(PermissionsAndroid.request).not.toHaveBeenCalledWith(PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE);
  expect(reduxStore.getState().modalController.content).toContain('Saved to Downloads');
});

test('a notification service failure does not abort saving the file', async () => {
  notifee.createChannel.mockRejectedValueOnce(new Error('Notification service unavailable'));
  expect(await downloadFile()).toMatchObject({ publicDownload: true });
  expect(reduxStore.getState().modalController.content).toContain('Saved to Downloads');
  expect(Alert.alert).not.toHaveBeenCalled();
});

test('iOS keeps its document-directory flow', async () => {
  Object.defineProperty(Platform, 'OS', { configurable: true, value: 'ios' });
  expect(await downloadFile()).toMatchObject({ uri: '/documents/image/photo.JPG' });
  expect(bridge.exportFile).not.toHaveBeenCalled();
  expect(RNFetchBlob.__files.get('/documents/image/photo.JPG')).toEqual(payload);
});
