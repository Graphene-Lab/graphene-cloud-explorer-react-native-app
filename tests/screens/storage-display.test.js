import React from 'react';
import { act, cleanup, render, screen } from '@testing-library/react-native';
import { configureStore } from '@reduxjs/toolkit';
import { Provider } from 'react-redux';
import { DetailsScreen } from '../../src/screens/details';
import { UploadProgress } from '../../src/components/upload-progress';
import profileReducer, { setCloudMemory } from '../../src/reducers/profileActionsReducer';
import userSecretReducer, { setUserSecretDataToRedux } from '../../src/reducers/userSecretDataReducer';
import filesInfoReducer from '../../src/reducers/filesInfoReducer';
import transferReducer from '../../src/reducers/filesTransferNewReducer';
import { store as appStore } from '../../src/store';
import { GetStorageInfo } from '../../src/utils/data-transmission-utils';
import { storageInfo } from '../../src/utils/essential-functions';
import english from '../../src/i18n/locales/en.json';

// Keep the actual size formatters, constants, screens, and Redux reducers.
// Only native graphics, cryptography, navigation, and backend access are mocked.
jest.mock('react-native-pie-chart', () => function PieChartMock () { return null; });
jest.mock('react-native-quick-crypto', () => ({}));
jest.mock('react-native-reanimated', () => ({}));
jest.mock('../../src/utils/proxy-cryptography-utils', () => ({}));
jest.mock('../../src/utils/encryption-utils', () => ({}));
jest.mock('../../src/utils/mmkv', () => ({}));
jest.mock('../../src/utils/data-transmission-utils', () => ({ GetStorageInfo: jest.fn() }));
jest.mock('../../src/store', () => ({ store: { dispatch: jest.fn(), getState: jest.fn() } }));
jest.mock('@react-navigation/native', () => ({ useNavigation: () => ({ navigate: jest.fn() }) }));
jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key, values = {}) => {
      const translations = require('../../src/i18n/locales/en.json');
      const message = key.split('.').reduce((entry, part) => entry?.[part], translations);
      if (typeof message !== 'string') throw new Error(`Missing test translation: ${key}`);
      return message.replace(/\{\{(\w+)\}\}/g, (_, name) => values[name]);
    },
  }),
}));

const GB = 1_000_000_000;
const categories = { images: 0, video: 0, documents: 0, music: 0, other: 0 };
const upload = {
  'video.mp4': { file: 'video.mp4', current: GB, size: 2 * GB, remaining: 30, progress: 50 },
};

const makeStore = ({ available = 80 * GB, used = 20 * GB, encrypted = false, files = categories, queue = {} } = {}) => {
  const store = configureStore({
    reducer: {
      profile: profileReducer,
      userSecret: userSecretReducer,
      fileOccupiedInfo: filesInfoReducer,
      newFileTransfer: transferReducer,
    },
    preloadedState: {
      fileOccupiedInfo: files,
      newFileTransfer: { uploadQueue: queue },
    },
  });
  // Exercise the real conversion of backend byte counts to Redux numbers.
  store.dispatch(setCloudMemory({ totalMemory: String(available), usedMemory: String(used) }));
  store.dispatch(setUserSecretDataToRedux({ zeroKnowledgeEnabled: encrypted }));
  appStore.dispatch.mockImplementation(store.dispatch);
  appStore.getState.mockImplementation(store.getState);
  return store;
};
const show = (component, options) => {
  const store = makeStore(options);
  render(<Provider store={store}>{component}</Provider>);
  return store;
};
const expectNoBinaryUnits = () => {
  expect(screen.queryByText(/\b(?:KiB|MiB|GiB|TiB)\b/)).toBeNull();
  expect(screen.queryByText(/^93[.,]13 GB$/)).toBeNull();
};

afterEach(cleanup);

test.each([false, true])('100 GB plan renders 80 GB available and 100 GB total (encrypted: %s)', encrypted => {
  show(<DetailsScreen />, { encrypted });
  expect(screen.getByText('80 GB')).toBeOnTheScreen();
  expect(screen.getByText('100 GB')).toBeOnTheScreen();
  expectNoBinaryUnits();
});

test('300 GB plan renders 270 GB available and 300 GB total', () => {
  show(<DetailsScreen />, { available: 270 * GB, used: 30 * GB });
  expect(screen.getByText('270 GB')).toBeOnTheScreen();
  expect(screen.getByText('300 GB')).toBeOnTheScreen();
  expectNoBinaryUnits();
});

test.each([
  [1_000, '1 KB'],
  [1_000_000, '1 MB'],
  [1_000_000_000, '1 GB'],
  [1_000_000_000_000, '1 TB'],
])('decimal unit boundary %s bytes renders as %s', (available, label) => {
  show(<DetailsScreen />, { available, used: 0, encrypted: true });
  expect(screen.getAllByText(label)).toHaveLength(2);
  expectNoBinaryUnits();
});

test('an empty 100 GB account shows the full 100 GB as both available and total', () => {
  show(<DetailsScreen />, { available: 100 * GB, used: 0, encrypted: true });
  expect(screen.getAllByText('100 GB')).toHaveLength(2);
});

test('file-type usage renders decimal file sizes on the actual details screen', () => {
  show(<DetailsScreen />, {
    files: { images: 1.5 * GB, video: 2 * GB, documents: 3_000_000, music: 4_000, other: 5 },
  });
  expect(screen.getByText(/1[.,]5 GB/)).toBeOnTheScreen();
  for (const label of ['2 GB', '3 MB', '4 KB', '5 Bytes']) {
    expect(screen.getByText(label)).toBeOnTheScreen();
  }
  expectNoBinaryUnits();
});

test('unlimited storage keeps its existing label', () => {
  show(<DetailsScreen />, { available: -1, used: 20 * GB, encrypted: true });
  expect(screen.getAllByText(english.details.unlimited)).toHaveLength(2);
  expectNoBinaryUnits();
});

test('loading storage keeps its placeholders instead of inventing a capacity', () => {
  show(<DetailsScreen />, { available: 0, used: 0, encrypted: true });
  expect(screen.getAllByText('...')).toHaveLength(2);
  expect(screen.queryByText('100 GB')).toBeNull();
});

test('a storage response updates the rendered capacity through the real formatter and reducer', async () => {
  show(<DetailsScreen />, { available: 0, used: 0, encrypted: true });
  GetStorageInfo.mockResolvedValue({ totalMemory: '80000000000', usedMemory: '20000000000' });
  await act(async () => { await storageInfo(); });
  expect(screen.getByText('80 GB')).toBeOnTheScreen();
  expect(screen.getByText('100 GB')).toBeOnTheScreen();
  expect(screen.queryByText('...')).toBeNull();
  expectNoBinaryUnits();
});

test('a later storage update refreshes the displayed decimal capacity', () => {
  const store = show(<DetailsScreen />, { encrypted: true });
  act(() => {
    store.dispatch(setCloudMemory({ totalMemory: '240000000000', usedMemory: '60000000000' }));
  });
  expect(screen.getByText('240 GB')).toBeOnTheScreen();
  expect(screen.getByText('300 GB')).toBeOnTheScreen();
  expect(screen.queryByText('100 GB')).toBeNull();
});

test('upload progress uses decimal units for transferred bytes and remaining capacity', () => {
  show(<UploadProgress />, { queue: upload });
  expect(screen.getByText('video.mp4 (1 GB of 2 GB)')).toBeOnTheScreen();
  expect(screen.getByText('79 GB of 100 GB')).toBeOnTheScreen();
  expectNoBinaryUnits();
});

test('upload progress preserves Unlimited while file sizes stay decimal', () => {
  show(<UploadProgress />, { available: -1, queue: upload });
  expect(screen.getByText(english.details.unlimited)).toBeOnTheScreen();
  expect(screen.getByText('video.mp4 (1 GB of 2 GB)')).toBeOnTheScreen();
});
