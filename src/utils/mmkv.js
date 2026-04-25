import { MMKV } from 'react-native-mmkv';
import { renderScreen } from '../reducers/screenRerenderReducer';
import { store } from '../store';

const storage = new MMKV({ id: 'graphene-explorer' });

const getArray = (key) => {
  const raw = storage.getString(key);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
};

const setArray = (key, value) => {
  storage.set(key, JSON.stringify(value));
};

const getMap = (key) => {
  const raw = storage.getString(key);
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
};

const setMap = (key, value) => {
  storage.set(key, JSON.stringify(value || {}));
};

const getBool = (key) => {
  const value = storage.getBoolean(key);
  return typeof value === 'boolean' ? value : null;
};

const setBool = (key, value) => {
  storage.set(key, !!value);
};

const triggerHomeRefresh = () => store.dispatch(renderScreen(['HomeScreen']));

export const addToMMKV = async (obj) => {
  const arr = getArray('lasts') ?? [];
  const exists = arr.some(
    (item) =>
      item?.title === obj?.title &&
      item?.name === obj?.name &&
      item?.type === obj?.type &&
      item?.path === obj?.path
  );
  if (exists) return;

  const next = [obj, ...arr];
  if (next.length > 16) next.pop();
  setArray('lasts', next);
  triggerHomeRefresh();
};

const deleteFile = async (obj) => {
  const arr = getArray('lasts');
  if (!arr) return;
  const filtered = arr.filter((item) => item.path !== obj.path);
  setArray('lasts', filtered);
  triggerHomeRefresh();
};

const deleteFolder = async (folder) => {
  const arr = getArray('lasts');
  if (!arr) return;
  const filtered = arr.filter((item) => !item.path.startsWith(folder));
  setArray('lasts', filtered);
  triggerHomeRefresh();
};

export const getLastsMMKV = async () => getArray('lasts') ?? [];

export const deleteRouterMMKV = (obj) => (obj.type === 'folder' ? deleteFolder(obj.path) : deleteFile(obj));

export const dropMMKV = async () => {
  setBool('auth', false);
  setMap('userSecretData', {});
  setArray('lasts', []);
};

export const updateMultiplyMoveMMKV = async (location, names, target) => {
  const arr = getArray('lasts') ?? [];
  const transformed = arr.map((element) => {
    if (names.includes(element.name) && element.location === location) {
      const nextPath = element.path.replace(element.location, target);
      const nextTitle = element.title.replace(element.location, target);
      return { ...element, path: nextPath, title: nextTitle, location: target };
    }
    return element;
  });

  setArray('lasts', transformed);
  triggerHomeRefresh();
};

export const renameMMKVFile = async ({ path, name, newArr }) => {
  const arr = getArray('lasts') ?? [];
  const indexMMKV = arr.findIndex((object) => object.path === path);

  if (indexMMKV !== -1) {
    const newIndex = newArr.findIndex((obj) => obj.name === name);
    if (newIndex !== -1) {
      arr[indexMMKV] = newArr[newIndex];
      setArray('lasts', arr);
      triggerHomeRefresh();
    }
  }
};

export const renameMMKVFolder = async (_location, name) => {
  let arr = getArray('lasts') ?? [];
  arr = arr.filter((item) => item.location !== `${name}/`);
  setArray('lasts', arr);
  triggerHomeRefresh();
};

export const multiRemoveMMKV = async (pathGroup, filesGroups) => {
  let arr = getArray('lasts') ?? [];
  const injected = filesGroups.map((element) => (pathGroup !== '' ? `${pathGroup}/${element}` : element));
  arr = arr.filter((element) => !injected.includes(element.path));
  setArray('lasts', arr);
  triggerHomeRefresh();
};

export const setGuideMMKV = async () => {
  setBool('guide', true);
};

export const getGuideMMKV = async () => getBool('guide');

export const getUserSecretDataMMKV = async () => {
  const auth = getBool('auth');
  const guide = getBool('guide');
  const object = getMap('userSecretData');
  return { ...object, auth, guide };
};

export const setUserSecretDataMMKV = async (clientId, publicKeyB64) => {
  const object = getMap('userSecretData');
  setMap('userSecretData', { ...object, clientId, publicKeyB64 });
};

export const mergeUserSecretDataMMKV = async (patch) => {
  const object = getMap('userSecretData');
  setMap('userSecretData', { ...object, ...patch });
};

export const setUserServerIdMMKV = async (serverId) => {
  const object = getMap('userSecretData');
  setMap('userSecretData', { ...object, serverId });
};

export const userAuthMMKV = async () => {
  setBool('auth', true);
};

export const setUserEncryptionTypeMMKV = async (encryptionType) => {
  const object = getMap('userSecretData');
  setMap('userSecretData', { ...object, encryptionType });
};

export const setUserDeviceKeyMMKV = async (deviceKey) => {
  const object = getMap('userSecretData');
  setMap('userSecretData', { ...object, deviceKey });
};

export const removeUserEncryptionTypeMMKV = async () => {
  const object = getMap('userSecretData');
  setMap('userSecretData', { ...object, encryptionType: undefined });
};

export const setUserPublicAndPrivetKeyMMKV = async (publicKey, privetKey) => {
  const object = getMap('userSecretData');
  setMap('userSecretData', { ...object, publicKey, privetKey });
};

export const getUserPublicKeyMMKV = async () => {
  try {
    const userData = getMap('userSecretData');
    return userData.qr;
  } catch {
    return null;
  }
};

export const setUserQrMMKV = async (qr) => {
  const object = getMap('userSecretData');
  setMap('userSecretData', { ...object, qr });
};

export const setDeviceUpdateInfoMMKV = async (order) => {
  setBool('deviceUpdateStatus', order);
};

export const getDeviceUpdateFinishInfoMMKV = async () => getBool('deviceUpdateStatus');

export const uploadQueueMMKV = async (file) => {
  const data = getArray('uploadQueue') ?? [];
  setArray('uploadQueue', [...data, file]);
};

export const removeUploadQueueMMKV = async () => {
  const data = getArray('uploadQueue') ?? [];
  data.shift();
  setArray('uploadQueue', data);
};

export const getUploadQueueMMKV = async () => getArray('uploadQueue') ?? [];

export const setProxyMMKV = async (proxy) => {
  const object = getMap('userSecretData');
  setMap('userSecretData', { ...object, proxy });
};

export const moveSingleMMKV = async () => {
  // no-op
};

export const setCellularAccessMMKV = async (value) => {
  setBool('cellular', value);
};

export const getCellularInfoMMKV = async () => getBool('cellular') ?? false;
