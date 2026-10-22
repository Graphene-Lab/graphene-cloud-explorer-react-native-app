import React from 'react';
import { Alert } from 'react-native';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react-native';
import { configureStore } from '@reduxjs/toolkit';
import { Provider } from 'react-redux';
import axios from 'axios';
import Settings from '../../src/components/bottom-sheet/childs/settings';
import { CopyMoveComponent } from '../../src/components/bottom-sheet/childs/copymove';
import { MultipleSelection } from '../../src/components/multiple-selection';
import { useContextApi } from '../../src/context/ContextApi';
import filesReducer from '../../src/reducers/fileReducer';
import modalReducer from '../../src/reducers/modalReducer';
import userSecretReducer, { setUserSecretDataToRedux } from '../../src/reducers/userSecretDataReducer';
import { store as appStore } from '../../src/store';
import { command } from '../../src/constants';
import { MinHeap } from '../../src/utils/MinHeap';
import { copy, executeRequest, move, rename } from '../../src/utils/data-transmission-utils';
import { copySingle, moveSingle, multiplyCopy, multiplyMove, openCopyMoveSheet, renameFile } from '../../src/utils/settings-utils';
import english from '../../src/i18n/locales/en.json';

// Keep the real controls, handlers, reducers and request guard. Stop requests at the queue boundary.
jest.mock('../../src/store', () => ({ store: { getState: jest.fn(), dispatch: jest.fn() } }));
jest.mock('../../src/utils/MinHeap', () => ({ MinHeap: { push: jest.fn(), pop: jest.fn(heap => heap.shift()) } }));
jest.mock('axios', () => ({ get: jest.fn(), post: jest.fn() }));
jest.mock('../../src/context/ContextApi', () => ({ useContextApi: jest.fn() }));
jest.mock('../../src/utils/proxy-cryptography-utils', () => ({
  enumToString: (values, value) => Object.keys(values).find(key => values[key] === value),
}));
jest.mock('../../src/utils/zero-knowledge-utils', () => ({ getZeroKnowledgeContext: () => null }));
jest.mock('../../src/utils/encryption-utils', () => ({}));
jest.mock('../../src/utils/mmkv', () => ({}));
jest.mock('../../src/utils/files-trasnfer', () => ({}));
jest.mock('../../src/utils/local-files', () => ({}));
jest.mock('../../src/utils/file-opening', () => ({}));
jest.mock('../../src/utils/download-index', () => ({}));
jest.mock('../../src/utils/download-feedback', () => ({}));
jest.mock('../../src/utils/notification-utils', () => ({}));
jest.mock('../../src/utils/file-reading', () => ({}));
jest.mock('../../src/utils/parser', () => ({}));
jest.mock('../../src/utils/crashlytics-utils', () => ({ reportCrash: jest.fn() }));
jest.mock('../../src/utils/essential-functions', () => ({
  locationGenerator: path => path.split('/').slice(0, -1).join('/'),
  groupsByFolder: paths => [['source', paths.map(path => path.split('/').pop())]],
}));
jest.mock('../../src/components/view-items/functions', () => ({}));
jest.mock('../../src/components/bottom-sheet/childs/copymove/clumn', () => ({ Cloumn: () => null }));
jest.mock('../../src/components/bottom-sheet/childs/copymove/row', () => ({ Row: () => null }));
jest.mock('../../src/components/list-empty', () => ({ EmptyComponent: () => null }));
jest.mock('react-native-blob-util', () => ({}));
jest.mock('expo-document-picker', () => ({}));
jest.mock('@expo/vector-icons', () => ({ Feather: () => null, Ionicons: () => null }));
jest.mock('react-native-paper', () => ({ ActivityIndicator: () => null }));
jest.mock('@gorhom/bottom-sheet', () => ({ BottomSheetScrollView: require('react-native').ScrollView }));
jest.mock('react-native-gesture-handler', () => ({
  FlatList: require('react-native').FlatList,
  NativeViewGestureHandler: require('react-native').View,
}));
jest.mock('../../src/i18n', () => ({
  __esModule: true,
  default: { t: (key, values = {}) => {
    const translations = require('../../src/i18n/locales/en.json');
    const message = key.split('.').reduce((entry, part) => entry?.[part], translations);
    if (typeof message !== 'string') throw new Error(`Missing translation: ${key}`);
    return message.replace(/\{\{(\w+)\}\}/g, (_, name) => values[name]);
  } },
}));
jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: require('../../src/i18n').default.t }) }));

const message = english.zeroknowledge.file_operations_unavailable;
const jpg = { name: 'photo.JPG', path: 'source/photo.JPG', location: 'source', type: 'image' };
const mp3 = { name: 'song.MP3', path: 'source/song.MP3', location: 'source', type: 'audio' };
const folder = { name: 'album', path: 'source/album', location: 'source', type: 'folder' };
let reduxStore;
let context;

const makeStore = ({ encrypted = true, file = jpg, bulk = false, order = 1 } = {}) => {
  reduxStore = configureStore({
    reducer: {
      files: filesReducer, userSecret: userSecretReducer, modalController: modalReducer,
      bottomSheetManager: () => ({ current: 'Cloud' }),
      newFileTransfer: () => ({ downloadQueue: [] }),
      network: () => ({}),
    },
    preloadedState: {
      files: { selectedFile: file, selectedFiles: bulk ? [jpg, mp3, folder] : [], favorites: [], location: 'source', order, mode: false },
    },
    middleware: getDefault => getDefault({ serializableCheck: false }),
  });
  reduxStore.dispatch(setUserSecretDataToRedux({ zeroKnowledgeEnabled: encrypted }));
  appStore.getState.mockImplementation(reduxStore.getState);
  appStore.dispatch.mockImplementation(reduxStore.dispatch);
  return reduxStore;
};
const show = (component, options) => {
  const store = makeStore(options);
  render(<Provider store={store}>{component}</Provider>);
  return store;
};
const expectNoPathRequest = () => {
  expect(MinHeap.push).not.toHaveBeenCalled();
  expect(axios.get).not.toHaveBeenCalled();
  expect(axios.post).not.toHaveBeenCalled();
};

beforeEach(() => {
  context = { closeBottomSheet: jest.fn(), bottomSheetController: jest.fn() };
  useContextApi.mockReturnValue(context);
  jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  jest.spyOn(global.console, 'log').mockImplementation(() => {});
  const unexpectedNetwork = () => { throw new Error('Unexpected transport request'); };
  axios.get.mockImplementation(unexpectedNetwork);
  axios.post.mockImplementation(unexpectedNetwork);
  MinHeap.push.mockImplementation(() => {});
});
afterEach(() => {
  cleanup();
  expect(axios.get).not.toHaveBeenCalled();
  expect(axios.post).not.toHaveBeenCalled();
});

test.each([jpg, mp3, folder])('encrypted item menu disables path changes for $name', file => {
  show(<Settings />, { file });
  expect(screen.getByText(message)).toBeOnTheScreen();
  for (const label of ['Rename', 'Move', 'Copy']) {
    expect(screen.getByText(label)).toBeDisabled();
    fireEvent.press(screen.getByText(label));
  }
  expect(screen.getByText(english.options.delete)).toBeEnabled();
  if (file.type !== 'folder') {
    expect(screen.getByText(english.options.download)).toBeEnabled();
    expect(screen.getByText(english.options.share_with)).toBeEnabled();
  }
  expect(context.closeBottomSheet).not.toHaveBeenCalled();
  expect(reduxStore.getState().modalController.visible).toBe(false);
  expectNoPathRequest();
});

test('unencrypted item menu keeps path changes enabled and opens rename', () => {
  show(<Settings />, { encrypted: false });
  expect(screen.queryByText(message)).toBeNull();
  for (const label of ['Rename', 'Move', 'Copy']) expect(screen.getByText(label)).toBeEnabled();
  fireEvent.press(screen.getByText('Rename'));
  expect(reduxStore.getState().modalController.type).toBe('input');
});

test('item menu responds to encryption becoming enabled while open', () => {
  show(<Settings />, { encrypted: false });
  act(() => reduxStore.dispatch(setUserSecretDataToRedux({ zeroKnowledgeEnabled: true })));
  for (const label of ['Rename', 'Move', 'Copy']) expect(screen.getByText(label)).toBeDisabled();
});

test.each([false, true])('bulk toolbar disables only path changes when encrypted: %s', encrypted => {
  show(<MultipleSelection />, { encrypted, bulk: true });
  for (const label of ['Move', 'Copy']) {
    const button = screen.getByRole('button', { name: label });
    if (encrypted) {
      expect(button).toBeDisabled();
      fireEvent.press(button);
    } else expect(button).toBeEnabled();
  }
  expect(screen.getByRole('button', { name: english.options.delete })).toBeEnabled();
  expect(context.closeBottomSheet).not.toHaveBeenCalled();
  expect(reduxStore.getState().files.selectedFiles).toHaveLength(3);
  expectNoPathRequest();
});

test.each([jpg, folder])('rename handler blocks encrypted $name before opening a dialog', async file => {
  makeStore({ file });
  await renameFile();
  expect(Alert.alert).toHaveBeenCalledWith(english.popups.attention, message);
  expect(reduxStore.getState().modalController.visible).toBe(false);
  expectNoPathRequest();
});

test.each([jpg, folder])('already-open rename dialog rechecks encryption for $name', async file => {
  makeStore({ encrypted: false, file });
  await renameFile();
  if (file.type === 'folder') reduxStore.getState().modalController.callback();
  const confirmRename = reduxStore.getState().modalController.callback;
  reduxStore.dispatch(setUserSecretDataToRedux({ zeroKnowledgeEnabled: true }));
  confirmRename();
  expect(Alert.alert).toHaveBeenCalledWith(english.popups.attention, message);
  expectNoPathRequest();
});

test.each([1, 2])('destination picker cannot be opened for encrypted operation %s', async order => {
  makeStore();
  await openCopyMoveSheet(context.bottomSheetController, context.closeBottomSheet, order);
  expect(Alert.alert).toHaveBeenCalledWith(english.popups.attention, message);
  expect(context.bottomSheetController).not.toHaveBeenCalled();
  expect(context.closeBottomSheet).not.toHaveBeenCalled();
});

test.each([[1, false], [2, false], [1, true], [2, true]])('open destination picker blocks operation %s, bulk: %s, when encryption becomes enabled', (order, bulk) => {
  show(<CopyMoveComponent />, { encrypted: false, order, bulk });
  const label = order === 1 ? english.common.copy : english.common.move;
  expect(screen.getByText(label)).toBeEnabled();
  act(() => reduxStore.dispatch(setUserSecretDataToRedux({ zeroKnowledgeEnabled: true })));
  expect(screen.getByText(label)).toBeDisabled();
  expect(screen.getByText(message)).toBeOnTheScreen();
  fireEvent.press(screen.getByText(label));
  // Browsing the destination is allowed; no mutating operation may reach the queue.
  expect(MinHeap.push.mock.calls.map(call => call[1][1][0])).toEqual([command.GetDir]);
  expect(screen.getByText(english.common.cancel)).toBeEnabled();
  expect(context.closeBottomSheet).not.toHaveBeenCalled();
});

test.each([copySingle, moveSingle, multiplyCopy, multiplyMove])('direct %p handler preserves selection and UI state when blocked', async handler => {
  makeStore({ bulk: true });
  const setDisabled = jest.fn();
  const locationEditor = jest.fn();
  await handler('target', setDisabled, context.closeBottomSheet, locationEditor);
  expect(Alert.alert).toHaveBeenCalledWith(english.popups.attention, message);
  expect(setDisabled).not.toHaveBeenCalled();
  expect(locationEditor).not.toHaveBeenCalled();
  expect(context.closeBottomSheet).not.toHaveBeenCalled();
  expect(reduxStore.getState().files.selectedFiles).toHaveLength(3);
  expectNoPathRequest();
});

test.each([rename, move, copy])('transport wrapper %p rejects encrypted operations without a master key', async operation => {
  makeStore();
  await expect(operation('source', ['photo.JPG', 'song.MP3', 'album'], 'target')).rejects.toThrow(message);
  expectNoPathRequest();
});

test.each([command.Rename, command.Move, command.Copy])('raw command %s cannot bypass the restriction', async commandId => {
  makeStore();
  await expect(executeRequest(commandId, 'source\tphoto.JPG\ttarget')).rejects.toThrow(message);
  expectNoPathRequest();
});

test('queued path operation rechecks encryption before dispatch', async () => {
  makeStore({ encrypted: false });
  MinHeap.push.mockImplementationOnce((heap, node) => {
    heap.push(node);
    reduxStore.dispatch(setUserSecretDataToRedux({ zeroKnowledgeEnabled: true }));
  });
  await expect(executeRequest(command.Move, 'source\tphoto.JPG\ttarget')).rejects.toThrow(message);
  expect(MinHeap.pop).toHaveBeenCalledTimes(1);
});

test.each([[rename, command.Rename], [move, command.Move], [copy, command.Copy]])('unencrypted %p retains its original request', (operation, commandId) => {
  makeStore({ encrypted: false });
  operation('source', ['photo.JPG', 'song.MP3'], 'target');
  expect(MinHeap.push).toHaveBeenCalledTimes(1);
  expect(MinHeap.push.mock.calls[0][1][1].slice(0, 2)).toEqual([commandId, 'source\tphoto.JPG\tsong.MP3\ttarget']);
});

test.each([command.GetFile, command.SetFile, command.Delete, command.CreateDir, command.GetDir])('encrypted accounts still allow unrelated command %s', commandId => {
  makeStore();
  executeRequest(commandId, 'unchanged');
  expect(MinHeap.push).toHaveBeenCalledTimes(1);
  expect(MinHeap.push.mock.calls[0][1][1][0]).toBe(commandId);
});
