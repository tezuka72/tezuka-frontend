import { Share } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { shareAPI } from '../api/client';

const DEVICE_ID_KEY = 'tezuka_device_id';
const DEFERRED_SHARE_KEY = 'tezuka_pending_share_code';
const WEB_BASE = 'https://tezuka.app';

// デバイスIDを取得または新規生成（deferred deep link用）
export async function getOrCreateDeviceId() {
  let id = await AsyncStorage.getItem(DEVICE_ID_KEY);
  if (!id) {
    id = 'dev_' + Math.random().toString(36).slice(2, 18) + Date.now().toString(36);
    await AsyncStorage.setItem(DEVICE_ID_KEY, id);
  }
  return id;
}

// シリーズ共有リンクを生成してネイティブ共有シートを開く
// seriesTitle: 共有テキストに使う作品名
// footprintCallback: 共有後に足跡を記録するコールバック(任意)
export async function shareSeries(seriesId, episodeId = null, seriesTitle = '', footprintCallback = null) {
  try {
    const { share_code } = await shareAPI.create(seriesId, episodeId);
    const url = `${WEB_BASE}/s/${share_code}`;
    const message = seriesTitle ? `${seriesTitle} - LORE MANGA\n${url}` : url;

    const result = await Share.share({ message, url, title: seriesTitle || 'LORE MANGA' });

    if (result.action === Share.sharedAction && footprintCallback) {
      footprintCallback();
    }
    return share_code;
  } catch (e) {
    console.error('Share error:', e);
    throw e;
  }
}

// インストール後 deferred deep link でshare_codeを復元するために保存
export async function saveDeferredShareCode(shareCode) {
  await AsyncStorage.setItem(DEFERRED_SHARE_KEY, shareCode);
}

// 起動時に deferred share_code を復元して消費
export async function consumeDeferredShareCode() {
  const code = await AsyncStorage.getItem(DEFERRED_SHARE_KEY);
  if (code) await AsyncStorage.removeItem(DEFERRED_SHARE_KEY);
  return code; // null or string
}
