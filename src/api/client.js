import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

// 開発時はlocalhost、本番はRenderを使用
const API_BASE_URL = __DEV__
  ? 'http://localhost:3000/api/v1'
  : 'https://tezuka-backend-1.onrender.com/api/v1';

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
  forgotPassword: async (email) => {
    const response = await api.post('/auth/forgot-password', { email });
    return response.data;
  },
  resetPassword: async (email, code, newPassword) => {
    const response = await api.post('/auth/reset-password', { email, code, newPassword });
    return response.data;
  },
};

export const userAPI = {
  getProfile: async (userId) => {
    const response = await api.get(`/users/${userId}`);
    return response.data;
  },
  getFollowing: async () => {
    const response = await api.get('/users/me/following');
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
  delete: async (postId) => {
    const response = await api.delete(`/posts/${postId}`);
    return response.data;
  },
  create: async (postData) => {
    // axiosはwebでFormDataのContent-Typeを正しく扱えない場合があるためfetchを使用
    const token = await AsyncStorage.getItem('authToken');
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60000);
    let res;
    try {
      res = await fetch(`${API_BASE_URL}/posts`, {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: postData,
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeoutId);
    }
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      const e = new Error(err.error || err.errors?.[0]?.msg || 'Failed to create post');
      e.response = { status: res.status, data: err };
      throw e;
    }
    return res.json();
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

// Render無料プランのスリープ対策: バックグラウンドでサーバーを起こす（awaitしない）
export const wakeupServer = () => {
  axios.get(API_BASE_URL.replace('/api/v1', '') + '/health', { timeout: 60000 }).catch(() => {});
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

// アフィリエイト
export const affiliateAPI = {
  searchProducts: async (query, limit = 10) => {
    const response = await api.get('/affiliate/products/search', { params: { q: query, limit } });
    return response.data;
  },
  tagProduct: async (productData) => {
    const response = await api.post('/affiliate/products/tag', productData);
    return response.data;
  },
  getPostProducts: async (postId) => {
    const response = await api.get(`/affiliate/products/post/${postId}`);
    return response.data;
  },
  recordClick: async (productId, platform) => {
    const response = await api.post('/affiliate/click', { product_id: productId, platform });
    return response.data;
  },
};

// メッセージ（DM / グループDM）
export const messageAPI = {
  getConversations: async () => {
    const response = await api.get('/messages/conversations');
    return response.data;
  },
  createConversation: async (participantIds, type, name = null) => {
    const response = await api.post('/messages/conversations', {
      participant_ids: participantIds,
      type,
      name,
    });
    return response.data;
  },
  getMessages: async (convId, before = null) => {
    const params = { limit: 30 };
    if (before) params.before = before;
    const response = await api.get(`/messages/conversations/${convId}/messages`, { params });
    return response.data;
  },
  sendMessage: async (convId, content, replyToId = null) => {
    const response = await api.post(`/messages/conversations/${convId}/messages`, {
      content,
      reply_to_id: replyToId,
    });
    return response.data;
  },
  deleteMessage: async (msgId) => {
    const response = await api.delete(`/messages/${msgId}`);
    return response.data;
  },
  addReaction: async (msgId, emoji) => {
    const response = await api.post(`/messages/${msgId}/reactions`, { emoji });
    return response.data;
  },
  removeReaction: async (msgId, emoji) => {
    const response = await api.delete(`/messages/${msgId}/reactions/${encodeURIComponent(emoji)}`);
    return response.data;
  },
  markRead: async (convId) => {
    const response = await api.put(`/messages/conversations/${convId}/read`);
    return response.data;
  },
};

// 出金（銀行口座登録・出金申請）
export const payoutAPI = {
  getBankAccount: async () => {
    const response = await api.get('/payout/bank-account');
    return response.data;
  },
  saveBankAccount: async (data) => {
    const response = await api.post('/payout/bank-account', data);
    return response.data;
  },
  getBalance: async () => {
    const response = await api.get('/payout/balance');
    return response.data;
  },
  requestWithdrawal: async (amount) => {
    const response = await api.post('/payout/withdraw', { amount });
    return response.data;
  },
  getHistory: async () => {
    const response = await api.get('/payout/history');
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