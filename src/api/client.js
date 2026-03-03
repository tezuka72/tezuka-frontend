import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

// ローカル開発環境
const API_BASE_URL = __DEV__
  ? 'http://localhost:3000/api/v1'       // Webブラウザテスト（Mac）
  : 'https://tezuka-backend.onrender.com/api/v1'; // 本番

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 15000,
});

// トークンをリクエストに自動付与するインターセプター
api.interceptors.request.use(
  async (config) => {
    const token = await AsyncStorage.getItem('authToken');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    // FormData の場合は Content-Type を削除（ブラウザが自動設定）
    if (config.data instanceof FormData) {
      delete config.headers['Content-Type'];
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// レスポンスインターセプター（認証エラー処理）
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      await AsyncStorage.removeItem('authToken');
      await AsyncStorage.removeItem('user');
    }
    return Promise.reject(error);
  }
);

export const authAPI = {
  login: async (email, password) => {
    const response = await api.post('/auth/login', { email, password });
    return response.data;
  },
  register: async (username, email, password, displayName) => {
    const response = await api.post('/auth/register', { 
      username, 
      email, 
      password, 
      display_name: displayName 
    });
    return response.data;
  },
  verify: async () => {
    const response = await api.get('/auth/verify');
    return response.data;
  },
};

export const userAPI = {
  getProfile: async (userId) => {
    const response = await api.get(`/users/${userId}`);
    return response.data;
  },
};

export const postAPI = {
  getPost: async (postId) => {
    const response = await api.get(`/posts/${postId}`);
    return response.data;
  },
  getComments: async (postId) => {
    const response = await api.get(`/posts/${postId}/comments`);
    return response.data;
  },
  like: async (postId) => {
    const response = await api.post(`/posts/${postId}/like`);
    return response.data;
  },
  unlike: async (postId) => {
    const response = await api.delete(`/posts/${postId}/like`);
    return response.data;
  },
  addComment: async (postId, content) => {
    const response = await api.post(`/posts/${postId}/comments`, { content });
    return response.data;
  },
  create: async (postData) => {
    const response = await api.post('/posts', postData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  },
};

export const feedAPI = {
  getFeed: async () => {
    const response = await api.get('/feed');
    return response.data;
  },
  getFollowingFeed: async () => {
    const response = await api.get('/feed/following');
    return response.data;
  },
};

export const bookmarkAPI = {
  add: async (postId) => {
    const response = await api.post(`/posts/${postId}/bookmark`);
    return response.data;
  },
  remove: async (postId) => {
    const response = await api.delete(`/posts/${postId}/bookmark`);
    return response.data;
  },
  getMyBookmarks: async () => {
    const response = await api.get('/posts/me/bookmarks');
    return response.data;
  },
};

export const seriesAPI = {
  getAll: async () => {
    const response = await api.get('/series');
    return response.data;
  },
  getById: async (seriesId) => {
    const response = await api.get(`/series/${seriesId}`);
    return response.data;
  },
  getPosts: async (seriesId) => {
    const response = await api.get(`/series/${seriesId}`);
    return { posts: response.data.episodes || [] };
  },
};

export const earningsAPI = {
  getDashboard: async () => {
    const response = await api.get('/earnings');
    return response.data;
  },
};

export const tipsAPI = {
  getTopTippers: async (postId) => {
    const response = await api.get(`/tips/posts/${postId}/top-tippers`);
    return response.data;
  },
  sendTip: async (receiverId, postId, amount, message) => {
    const response = await api.post('/tips', { 
      receiverId, 
      postId, 
      amount, 
      message 
    });
    return response.data;
  },
};

export const giftAPI = {
  getPackages: async () => {
    const response = await api.get('/gifts/packages');
    return response.data;
  },
  sendGift: async (receiverId, postId, packageId) => {
    const response = await api.post('/gifts', { 
      receiverId, 
      postId, 
      packageId 
    });
    return response.data;
  },
  createPaymentIntent: async (amount, receiverId, postId) => {
    const response = await api.post('/gifts/payment-intent', {
      amount,
      receiver_id: receiverId,
      post_id: postId
    });
    return response.data;
  },
};

export const adAPI = {
  getRandom: async () => {
    const response = await api.get('/ads/random');
    return response.data;
  },
};

// EN（応援エネルギー）残高・応援送信
export const energyAPI = {
  getBalance: async () => {
    const response = await api.get('/energy/balance');
    return response.data; // { balance: number }
  },
  sendSupport: async (seriesId, episodeId, supportType, enAmount, messageText = null) => {
    const response = await api.post('/energy/support', {
      series_id: seriesId,
      episode_id: episodeId || null,
      support_type: supportType,
      en_amount: enAmount,
      message_text: messageText,
    });
    return response.data;
  },
};

// IGS ランキング
export const igsAPI = {
  getRanking: async (type = 'popular', limit = 50) => {
    const response = await api.get('/igs/ranking', { params: { type, limit } });
    return response.data; // { series: [...] }
  },
};

// 足跡
export const footprintAPI = {
  get: async (seriesId) => {
    const response = await api.get(`/series/${seriesId}/footprint`);
    return response.data;
    // { liked, read_completed, shared, supported, is_early_supporter, followers_delta }
  },
  record: async (seriesId, footprintType) => {
    const response = await api.post(`/series/${seriesId}/footprint`, {
      type: footprintType, // 'liked' | 'read_completed' | 'shared' | 'supported'
    });
    return response.data;
  },
};

// 共有リンク
export const shareAPI = {
  create: async (seriesId, episodeId = null) => {
    const response = await api.post('/share', {
      series_id: seriesId,
      episode_id: episodeId || null,
    });
    return response.data; // { share_code }
  },
  getByCode: async (shareCode) => {
    const response = await api.get(`/share/${shareCode}`);
    return response.data; // { series, episode }
  },
};

// My Library — シリーズフォロー / シリーズいいね / 進捗
export const libraryAPI = {
  // フォロー
  follow: async (seriesId) => {
    const response = await api.post(`/series/${seriesId}/follow`);
    return response.data; // { message: 'Successfully followed series' }
  },
  unfollow: async (seriesId) => {
    const response = await api.delete(`/series/${seriesId}/follow`);
    return response.data; // { message: 'Successfully unfollowed series' }
  },

  // シリーズいいね（エピソードいいねとは別）
  likeSeries: async (seriesId) => {
    const response = await api.post(`/series/${seriesId}/like`);
    return response.data; // { is_series_liked: true }
  },
  unlikeSeries: async (seriesId) => {
    const response = await api.delete(`/series/${seriesId}/like`);
    return response.data; // { is_series_liked: false }
  },

  // 本棚: フォロー中一覧（カーソルページネーション）
  getFollows: async (cursor = null) => {
    const params = cursor ? { cursor } : {};
    const response = await api.get('/me/library/follows', { params });
    return response.data;
    // { items: [...], next_cursor: string|null, has_more: bool }
  },

  // 本棚: いいね一覧
  getLikes: async (cursor = null) => {
    const params = cursor ? { cursor } : {};
    const response = await api.get('/me/library/likes', { params });
    return response.data;
  },

  // 本棚: 続きから読む一覧
  getContinue: async (cursor = null) => {
    const params = cursor ? { cursor } : {};
    const response = await api.get('/me/library/continue', { params });
    return response.data;
  },

  // 読書進捗を更新
  updateProgress: async (seriesId, lastEpisodeId) => {
    const response = await api.post(`/series/${seriesId}/progress`, {
      last_episode_id: lastEpisodeId,
    });
    return response.data;
  },
};

// クリエイターダッシュボード
export const creatorAPI = {
  // 初期ファン一覧（シリーズオーナーのみ）
  getEarlyFans: async (seriesId, cursor = null, limit = 20) => {
    const params = { limit };
    if (cursor) params.cursor = cursor;
    const response = await api.get(`/creator/series/${seriesId}/early-fans`, { params });
    return response.data; // { fans, next_cursor, has_more, series_first_published_at }
  },
};