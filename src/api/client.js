import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

// ネイティブ開発時のみlocalhost、それ以外（Web含む）は本番URLを使用
const PROD_API_URL = 'https://api.loremanga.com/api/v1';
const API_BASE_URL = (__DEV__ && Platform.OS !== 'web')
  ? 'http://localhost:3000/api/v1'
  : PROD_API_URL;

// トークンをメモリにキャッシュ（AsyncStorage読み込みを毎回省略）
let _cachedToken = null;
export const setCachedToken = (token) => { _cachedToken = token; };
export const clearCachedToken = () => { _cachedToken = null; };

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
    const token = _cachedToken ?? await AsyncStorage.getItem('authToken');
    if (token) {
      if (!_cachedToken) _cachedToken = token;
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
  verifyEmail: async (email, code) => {
    const response = await api.post('/auth/verify-email', { email, code });
    return response.data;
  },
  resendVerification: async (email) => {
    const response = await api.post('/auth/resend-verification', { email });
    return response.data;
  },
};

export const userAPI = {
  getProfile: async (userId) => {
    const response = await api.get(`/users/${userId}`);
    return response.data;
  },
  getUserPosts: async (username) => {
    const response = await api.get(`/users/${username}/posts`);
    return response.data; // { posts: [...] }
  },
  updateProfile: async (data) => {
    const response = await api.put('/users/profile', data);
    return response.data; // { message, user }
  },
  uploadAvatar: async (imageUri, imageFile = null) => {
    const token = await AsyncStorage.getItem('authToken');
    const formData = new FormData();
    if (Platform.OS === 'web') {
      if (imageFile) {
        // expo-image-picker が返す File オブジェクト（Web専用）
        formData.append('avatar', imageFile);
      } else {
        // blob: または data: URL からBlobを取得
        const blobRes = await fetch(imageUri);
        const blob = await blobRes.blob();
        formData.append('avatar', blob, 'avatar.jpg');
      }
    } else {
      // React Native専用: URIオブジェクト形式
      const filename = imageUri.split('/').pop();
      const ext = filename.split('.').pop()?.toLowerCase() || 'jpg';
      const mimeType = ext === 'png' ? 'image/png' : ext === 'gif' ? 'image/gif' : 'image/jpeg';
      formData.append('avatar', { uri: imageUri, name: filename, type: mimeType });
    }
    const res = await fetch(`${API_BASE_URL}/users/profile/avatar`, {
      method: 'PUT',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: formData,
    });
    if (!res.ok) throw new Error('Failed to upload avatar');
    return res.json(); // { avatar_url }
  },
  getFollowing: async () => {
    const response = await api.get('/users/me/following');
    return response.data;
  },
  follow: async (userId) => {
    const response = await api.post(`/users/${userId}/follow`);
    return response.data;
  },
  unfollow: async (userId) => {
    const response = await api.delete(`/users/${userId}/follow`);
    return response.data;
  },
  blockUser: async (userId) => {
    const response = await api.post(`/users/${userId}/block`);
    return response.data;
  },
  unblockUser: async (userId) => {
    const response = await api.delete(`/users/${userId}/block`);
    return response.data;
  },
  getBlockedUsers: async () => {
    const response = await api.get('/users/me/blocked');
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
  addComment: async (postId, content, parentCommentId = null) => {
    const response = await api.post(`/posts/${postId}/comments`, {
      content,
      ...(parentCommentId ? { parent_comment_id: parentCommentId } : {}),
    });
    return response.data;
  },
  getReplies: async (postId, commentId) => {
    const response = await api.get(`/posts/${postId}/comments/${commentId}/replies`);
    return response.data; // { replies: [...] }
  },
  likeComment: async (postId, commentId) => {
    const response = await api.post(`/posts/${postId}/comments/${commentId}/like`);
    return response.data; // { liked: true, like_count: N }
  },
  unlikeComment: async (postId, commentId) => {
    const response = await api.delete(`/posts/${postId}/comments/${commentId}/like`);
    return response.data; // { liked: false, like_count: N }
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
  getFeed: async ({ limit = 10, offset = 0 } = {}) => {
    const response = await api.get('/feed', { params: { limit, offset } });
    return response.data;
  },
  getFollowingFeed: async () => {
    const response = await api.get('/feed/following');
    return response.data;
  },
  search: async (q, limit = 20) => {
    const response = await api.get('/feed/search', { params: { q, limit } });
    return response.data; // { posts, query }
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
  getMySeries: async (username) => {
    const response = await api.get(`/users/${username}/series`);
    return response.data; // { series: [...] }
  },
  getById: async (seriesId) => {
    const response = await api.get(`/series/${seriesId}`);
    return response.data;
  },
  getPosts: async (seriesId) => {
    const response = await api.get(`/series/${seriesId}`);
    return { posts: response.data.episodes || [] };
  },
  create: async (formData) => {
    const token = await AsyncStorage.getItem('authToken');
    const res = await fetch(`${API_BASE_URL}/series`, {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: formData,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to create series');
    }
    return res.json();
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
  sendGift: async (paymentIntentId, receiverId, postId, amount) => {
    const response = await api.post('/gifts', {
      payment_intent_id: paymentIntentId,
      receiver_id: receiverId,
      post_id: postId,
      amount,
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

// サーバーのコールドスタート対策: バックグラウンドでサーバーを起こす（awaitしない）
// 起動時に1回 + 5分ごとに定期実行してVercelサーバーレスのコールドスタートを防ぐ
export const wakeupServer = () => {
  const ping = () => axios.get(API_BASE_URL.replace('/api/v1', '') + '/health', { timeout: 10000 }).catch(() => {});
  ping();
  setInterval(ping, 5 * 60 * 1000);
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

  // 本棚: リポスト一覧
  getReposts: async (cursor = null) => {
    const params = cursor ? { cursor } : {};
    const response = await api.get('/me/library/reposts', { params });
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
  sendMessageWithImage: async (convId, imageUri, imageFile = null, content = null, replyToId = null) => {
    const token = await AsyncStorage.getItem('authToken');
    const formData = new FormData();
    if (content) formData.append('content', content);
    if (replyToId) formData.append('reply_to_id', String(replyToId));
    if (Platform.OS === 'web') {
      if (imageFile) {
        formData.append('image', imageFile);
      } else {
        const blobRes = await fetch(imageUri);
        const blob = await blobRes.blob();
        formData.append('image', blob, 'image.jpg');
      }
    } else {
      const filename = imageUri.split('/').pop();
      const ext = filename.split('.').pop()?.toLowerCase() || 'jpg';
      const mimeType = ext === 'png' ? 'image/png' : 'image/jpeg';
      formData.append('image', { uri: imageUri, name: filename, type: mimeType });
    }
    const res = await fetch(`${API_BASE_URL}/messages/conversations/${convId}/messages`, {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: formData,
    });
    if (!res.ok) throw new Error('Failed to send image message');
    return res.json();
  },
  getReaders: async (convId) => {
    const response = await api.get(`/messages/conversations/${convId}/readers`);
    return response.data; // { readers: [{user_id, last_read_at, username, display_name, avatar_url}] }
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
  getConversationDetails: async (convId) => {
    const response = await api.get(`/messages/conversations/${convId}`);
    return response.data; // { id, name, type, icon_url, members: [{user_id, username, display_name, avatar_url, role}] }
  },
  updateGroup: async (convId, data) => {
    const response = await api.put(`/messages/conversations/${convId}`, data);
    return response.data;
  },
  updateGroupIcon: async (convId, formData) => {
    const token = await AsyncStorage.getItem('authToken');
    const res = await fetch(`${API_BASE_URL}/messages/conversations/${convId}/icon`, {
      method: 'PUT',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: formData,
    });
    if (!res.ok) throw new Error('Failed to update icon');
    return res.json();
  },
  addMember: async (convId, userId) => {
    const response = await api.post(`/messages/conversations/${convId}/members`, { user_id: userId });
    return response.data;
  },
  removeMember: async (convId, userId) => {
    const response = await api.delete(`/messages/conversations/${convId}/members/${userId}`);
    return response.data;
  },
  updateMemberRole: async (convId, userId, role) => {
    const response = await api.put(`/messages/conversations/${convId}/members/${userId}/role`, { role });
    return response.data;
  },
  leaveGroup: async (convId) => {
    const response = await api.delete(`/messages/conversations/${convId}/members/me`);
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

// 読者分析
export const analyticsAPI = {
  getSeries: async (seriesId) => {
    const response = await api.get(`/analytics/series/${seriesId}`);
    return response.data;
    // { series, episodes_stats, footprint_summary, view_trend, fan_trend, gift_earnings }
  },
  getOverview: async () => {
    const response = await api.get('/analytics/overview');
    return response.data; // { series: [...] }
  },
};

// プッシュ通知
export const notificationAPI = {
  saveToken: async (token) => {
    const response = await api.post('/notifications/token', { token });
    return response.data;
  },
  notifyFollowers: async (seriesId, title, body) => {
    const response = await api.post(`/notifications/series/${seriesId}/update`, { title, body });
    return response.data;
  },
};

// コミュニティ掲示板
export const boardAPI = {
  getPosts: async (seriesId, limit = 30, offset = 0) => {
    const response = await api.get(`/board/${seriesId}`, { params: { limit, offset } });
    return response.data; // { posts: [...] }
  },
  getReplies: async (seriesId, postId) => {
    const response = await api.get(`/board/${seriesId}/replies/${postId}`);
    return response.data; // { replies: [...] }
  },
  post: async (seriesId, content, parentId = null) => {
    const response = await api.post(`/board/${seriesId}`, {
      content,
      ...(parentId ? { parent_id: parentId } : {}),
    });
    return response.data; // { post: {...} }
  },
  delete: async (seriesId, postId) => {
    const response = await api.delete(`/board/${seriesId}/${postId}`);
    return response.data;
  },
};

export const repostAPI = {
  create: async (data) => {
    const response = await api.post('/reposts', data);
    return response.data;
  },
  remove: async (id) => {
    const response = await api.delete(`/reposts/${id}`);
    return response.data;
  },
  list: async ({ cursor, limit = 20 } = {}) => {
    const response = await api.get('/reposts', { params: { cursor, limit } });
    return response.data;
  },
  getTimeline: async ({ cursor, limit = 20, filter = 'all' } = {}) => {
    const response = await api.get('/timeline/reposts', { params: { cursor, limit, filter } });
    return response.data;
  },
};