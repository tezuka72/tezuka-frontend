import { useState, useCallback, useEffect } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  RefreshControl, ActivityIndicator, Modal, TextInput,
  KeyboardAvoidingView, Platform, Alert,
} from 'react-native';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { feedAPI, postAPI, messageAPI } from '../api/client';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import { Colors } from '../theme/colors';
import { Shadows } from '../theme/styles';

// ─── ユーティリティ ───────────────────────────────────────
function timeAgo(dateStr) {
  const diff = (Date.now() - new Date(dateStr)) / 1000;
  if (diff < 60) return '今';
  if (diff < 3600) return `${Math.floor(diff / 60)}分前`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}時間前`;
  return `${Math.floor(diff / 86400)}日前`;
}

const ROOM_COLORS = [Colors.primary, Colors.violet, Colors.cyan, Colors.emerald, Colors.orange, Colors.rose];
function roomColor(name = '') {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash += name.charCodeAt(i);
  return ROOM_COLORS[hash % ROOM_COLORS.length];
}

// ─── フォロー中フィード：投稿カード ──────────────────────
function PostCard({ post, onPress, onLike, onAuthorPress }) {
  const { t } = useLanguage();
  const firstImage = post.images?.[0]?.image_url || post.images?.[0];
  const imageCount = post.images?.length || 0;

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.9}>
      {firstImage && (
        <View style={styles.imageContainer}>
          <Image source={{ uri: firstImage }} style={styles.cardImage} contentFit="cover" cachePolicy="memory-disk" />
          {imageCount > 1 && (
            <View style={styles.imageCounter}>
              <Text style={styles.imageCounterText}>{imageCount}{t('home.imageCountSuffix')}</Text>
            </View>
          )}
        </View>
      )}
      <View style={styles.cardContent}>
        <TouchableOpacity style={styles.cardHeader} onPress={onAuthorPress} activeOpacity={0.7}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {post.display_name?.[0]?.toUpperCase() || '?'}
            </Text>
          </View>
          <View style={styles.headerText}>
            <Text style={styles.displayName}>{post.display_name}</Text>
            <Text style={styles.username}>@{post.username}</Text>
          </View>
        </TouchableOpacity>
        <Text style={styles.postTitle}>{post.title}</Text>
        <View style={styles.stats}>
          <TouchableOpacity style={styles.statItem} onPress={onLike}>
            <Text style={styles.statIcon}>{post.is_liked ? '❤️' : '🤍'}</Text>
            <Text style={styles.statText}>{post.like_count || 0}</Text>
          </TouchableOpacity>
          <View style={styles.statItem}>
            <Text style={styles.statIcon}>💬</Text>
            <Text style={styles.statText}>{post.comment_count || 0}</Text>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
}

// ─── メッセージ：アバター ─────────────────────────────────
function Avatar({ uri, name, size = 44 }) {
  if (uri) {
    return <Image source={{ uri }} style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: Colors.card }} contentFit="cover" cachePolicy="memory-disk" />;
  }
  const initial = (name || '?')[0].toUpperCase();
  return (
    <View style={[styles.avatarPlaceholder, { width: size, height: size, borderRadius: size / 2 }]}>
      <Text style={styles.avatarInitial}>{initial}</Text>
    </View>
  );
}

// ─── メッセージ：会話アイテム ─────────────────────────────
function ConversationItem({ item, currentUserId, onPress }) {
  const others = item.other_participants || [];
  const isGroup = item.type === 'group' || item.type === 'open';
  const displayName = isGroup
    ? (item.name || others.map(u => u.display_name || u.username).join(', '))
    : (others[0]?.display_name || others[0]?.username || '?');
  const avatarUri = isGroup ? (item.icon_url || null) : others[0]?.avatar_url;
  const lastContent = item.last_message_content || '';
  const isMine = item.last_message_sender_id === currentUserId;
  const senderLabel = isMine ? 'あなた: ' : '';
  const unread = parseInt(item.unread_count) || 0;

  return (
    <TouchableOpacity style={styles.convItem} onPress={onPress} activeOpacity={0.75}>
      <View style={styles.convAvatarWrap}>
        <Avatar uri={avatarUri} name={displayName} size={54} />
        {isGroup && (
          <View style={[styles.groupBadge, item.type === 'open' && { backgroundColor: Colors.cyan }]}>
            <Ionicons name={item.type === 'open' ? 'earth' : 'people'} size={11} color="#fff" />
          </View>
        )}
      </View>
      <View style={styles.convBody}>
        <View style={styles.convHeader}>
          <Text style={styles.convName} numberOfLines={1}>{displayName}</Text>
          <Text style={styles.convTime}>
            {item.last_message_created_at ? timeAgo(item.last_message_created_at) : ''}
          </Text>
        </View>
        <View style={styles.convFooter}>
          <Text style={[styles.convPreview, unread > 0 && styles.convPreviewBold]} numberOfLines={1}>
            {lastContent ? `${senderLabel}${lastContent}` : 'まだメッセージがありません'}
          </Text>
          {unread > 0 && (
            <View style={styles.unreadBadge}>
              <Text style={styles.unreadText}>{unread > 99 ? '99+' : unread}</Text>
            </View>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
}

// ─── オープンチャット：ルームアイテム ────────────────────
function RoomItem({ item, onJoin, onEnter, joining }) {
  const color = roomColor(item.name);
  const memberCount = parseInt(item.member_count) || 0;
  const isMember = item.is_member;

  return (
    <View style={styles.roomItem}>
      <View style={[styles.roomAvatar, { backgroundColor: color }]}>
        <Text style={styles.roomAvatarText}>{(item.name || '?')[0].toUpperCase()}</Text>
      </View>
      <View style={styles.roomBody}>
        <Text style={styles.roomName} numberOfLines={1}>{item.name}</Text>
        {item.description ? (
          <Text style={styles.roomDesc} numberOfLines={1}>{item.description}</Text>
        ) : null}
        <View style={styles.roomMeta}>
          <Ionicons name="people-outline" size={12} color={Colors.muted} />
          <Text style={styles.roomMetaText}>{memberCount}人参加中</Text>
          {item.last_message_created_at && (
            <Text style={styles.roomMetaTime}>· {timeAgo(item.last_message_created_at)}</Text>
          )}
        </View>
      </View>
      <TouchableOpacity
        style={[styles.roomBtn, isMember && styles.roomBtnEnter]}
        onPress={isMember ? onEnter : onJoin}
        disabled={joining}
        activeOpacity={0.8}
      >
        {joining ? (
          <ActivityIndicator size="small" color={isMember ? Colors.primary : '#fff'} />
        ) : (
          <Text style={[styles.roomBtnText, isMember && styles.roomBtnTextEnter]}>
            {isMember ? 'チャット' : '参加'}
          </Text>
        )}
      </TouchableOpacity>
    </View>
  );
}

// ─── ルーム作成モーダル ───────────────────────────────────
function CreateRoomModal({ visible, onClose, onCreate }) {
  const [name, setName] = useState('');
  const [desc, setDesc] = useState('');
  const [loading, setLoading] = useState(false);

  const handleCreate = async () => {
    if (!name.trim()) return;
    setLoading(true);
    try {
      await onCreate(name.trim(), desc.trim() || null);
      setName('');
      setDesc('');
      onClose();
    } catch (e) {
      const msg = e?.response?.data?.error || e?.message || 'ルームの作成に失敗しました';
      Alert.alert('エラー', msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.modalOverlay}>
        <TouchableOpacity style={StyleSheet.absoluteFill} onPress={onClose} activeOpacity={1} />
        <View style={styles.modalSheet}>
          <View style={styles.modalHandle} />
          <Text style={styles.modalTitle}>オープンチャットを作成</Text>
          <Text style={styles.modalLabel}>ルーム名 *</Text>
          <TextInput
            style={styles.modalInput}
            placeholder="例：漫画好き集まれ！"
            placeholderTextColor={Colors.muted}
            value={name}
            onChangeText={setName}
            maxLength={50}
          />
          <Text style={styles.modalLabel}>説明（任意）</Text>
          <TextInput
            style={[styles.modalInput, { height: 72, textAlignVertical: 'top' }]}
            placeholder="ルームの説明を入力..."
            placeholderTextColor={Colors.muted}
            value={desc}
            onChangeText={setDesc}
            maxLength={100}
            multiline
          />
          <TouchableOpacity
            style={[styles.modalCreateBtn, (!name.trim() || loading) && { opacity: 0.5 }]}
            onPress={handleCreate}
            disabled={!name.trim() || loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.modalCreateBtnText}>作成する</Text>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ─── メイン画面 ───────────────────────────────────────────
export default function SocialScreen() {
  const insets = useSafeAreaInsets();
  const { t } = useLanguage();
  const { user } = useAuth();
  const { unreadConvIds, registerMessageHandler, clearAllUnread } = useSocket() || {};
  const navigation = useNavigation();
  const [tab, setTab] = useState('friends'); // 'friends' | 'messages' | 'open'

  // フォロー中フィード
  const [posts, setPosts] = useState([]);
  const [postsRefreshing, setPostsRefreshing] = useState(false);
  const [postsError, setPostsError] = useState('');

  // メッセージ
  const [conversations, setConversations] = useState([]);
  const [convLoading, setConvLoading] = useState(true);
  const [convRefreshing, setConvRefreshing] = useState(false);
  const [convError, setConvError] = useState('');

  // オープンチャット
  const [rooms, setRooms] = useState([]);
  const [roomsLoading, setRoomsLoading] = useState(true);
  const [roomsRefreshing, setRoomsRefreshing] = useState(false);
  const [roomsError, setRoomsError] = useState('');
  const [joiningId, setJoiningId] = useState(null);
  const [createModalVisible, setCreateModalVisible] = useState(false);

  const loadPosts = useCallback(async () => {
    try {
      setPostsError('');
      const response = await feedAPI.getFollowingFeed();
      setPosts(response.posts || []);
    } catch {
      setPostsError('フィードの読み込みに失敗しました');
    }
  }, []);

  const loadConversations = useCallback(async () => {
    try {
      setConvError('');
      const data = await messageAPI.getConversations();
      setConversations(data.conversations || []);
    } catch {
      setConvError('メッセージの読み込みに失敗しました');
    } finally {
      setConvLoading(false);
      setConvRefreshing(false);
    }
  }, []);

  const loadRooms = useCallback(async () => {
    try {
      setRoomsError('');
      const data = await messageAPI.getPublicRooms();
      setRooms(data.rooms || []);
    } catch {
      setRoomsError('ルームの読み込みに失敗しました');
    } finally {
      setRoomsLoading(false);
      setRoomsRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => {
    loadPosts();
    if (conversations.length === 0) setConvLoading(true);
    loadConversations();
    if (rooms.length === 0) setRoomsLoading(true);
    loadRooms();
  }, [loadPosts, loadConversations, loadRooms]));

  // Socket: reload conversations when a new message arrives
  useEffect(() => {
    if (!registerMessageHandler) return;
    const unregister = registerMessageHandler(() => {
      loadConversations();
    });
    return unregister;
  }, [registerMessageHandler, loadConversations]);

  const handleTabChange = (newTab) => {
    setTab(newTab);
    if (newTab === 'messages') {
      clearAllUnread?.();
    }
  };

  const handleLike = async (postId) => {
    try {
      const post = posts.find(p => p.id === postId);
      if (post?.is_liked) {
        await postAPI.unlike(postId);
      } else {
        await postAPI.like(postId);
      }
      loadPosts();
    } catch {}
  };

  const handleJoinRoom = async (room) => {
    setJoiningId(room.id);
    try {
      await messageAPI.joinRoom(room.id);
      setRooms(prev => prev.map(r => r.id === room.id ? { ...r, is_member: true, member_count: parseInt(r.member_count) + 1 } : r));
      // 参加後すぐにチャット画面へ
      const convObj = { id: room.id, type: 'open', name: room.name, other_participants: [] };
      navigation.navigate('Chat', { conversation: convObj });
    } catch {
      Alert.alert('エラー', '参加に失敗しました');
    } finally {
      setJoiningId(null);
    }
  };

  const handleEnterRoom = (room) => {
    const convObj = { id: room.id, type: 'open', name: room.name, other_participants: [] };
    navigation.navigate('Chat', { conversation: convObj });
  };

  const handleCreateRoom = async (name, description) => {
    const data = await messageAPI.createPublicRoom(name, description);
    const newRoom = {
      id: data.conversation_id,
      name,
      description,
      type: 'open',
      is_member: true,
      member_count: 1,
      last_message_content: null,
      last_message_created_at: null,
    };
    setRooms(prev => [newRoom, ...prev]);
    // 作成後すぐにチャット画面へ
    const convObj = { id: data.conversation_id, type: 'open', name, other_participants: [] };
    navigation.navigate('Chat', { conversation: convObj });
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* ヘッダー */}
      <View style={styles.header}>
        <View style={styles.segmentRow}>
          <TouchableOpacity
            style={[styles.segmentBtn, tab === 'friends' && styles.segmentActive]}
            onPress={() => handleTabChange('friends')}
          >
            <Ionicons
              name={tab === 'friends' ? 'people' : 'people-outline'}
              size={15}
              color={tab === 'friends' ? Colors.primary : Colors.muted}
              style={{ marginRight: 4 }}
            />
            <Text style={[styles.segmentText, tab === 'friends' && styles.segmentTextActive]}>
              フォロー
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.segmentBtn, tab === 'messages' && styles.segmentActive]}
            onPress={() => handleTabChange('messages')}
          >
            <View style={{ position: 'relative', flexDirection: 'row', alignItems: 'center' }}>
              <Ionicons
                name={tab === 'messages' ? 'chatbubble-ellipses' : 'chatbubble-ellipses-outline'}
                size={15}
                color={tab === 'messages' ? Colors.primary : Colors.muted}
                style={{ marginRight: 4 }}
              />
              {unreadConvIds?.size > 0 && (
                <View style={styles.tabBadge} />
              )}
            </View>
            <Text style={[styles.segmentText, tab === 'messages' && styles.segmentTextActive]}>
              DM
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.segmentBtn, tab === 'open' && styles.segmentActive]}
            onPress={() => handleTabChange('open')}
          >
            <Ionicons
              name={tab === 'open' ? 'earth' : 'earth-outline'}
              size={15}
              color={tab === 'open' ? Colors.primary : Colors.muted}
              style={{ marginRight: 4 }}
            />
            <Text style={[styles.segmentText, tab === 'open' && styles.segmentTextActive]}>
              オープン
            </Text>
          </TouchableOpacity>
        </View>

        {tab === 'messages' && (
          <TouchableOpacity style={styles.newBtn} onPress={() => navigation.navigate('NewConversation')}>
            <Ionicons name="create-outline" size={24} color={Colors.primary} />
          </TouchableOpacity>
        )}
        {tab === 'open' && (
          <TouchableOpacity style={styles.newBtn} onPress={() => setCreateModalVisible(true)}>
            <Ionicons name="add-circle-outline" size={24} color={Colors.primary} />
          </TouchableOpacity>
        )}
      </View>

      {/* フォロー中タブ */}
      {tab === 'friends' && (
        postsError && posts.length === 0 ? (
          <View style={styles.center}>
            <Text style={styles.emptyIcon}>👥</Text>
            <Text style={styles.errorText}>{postsError}</Text>
            <TouchableOpacity style={styles.retryBtn} onPress={loadPosts}>
              <Text style={styles.retryText}>再試行</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <FlatList
            data={posts}
            keyExtractor={item => item.id.toString()}
            renderItem={({ item }) => (
              <PostCard
                post={item}
                onPress={() => navigation.navigate('PostDetail', { postId: item.id })}
                onLike={() => handleLike(item.id)}
                onAuthorPress={() => navigation.navigate('UserProfile', { username: item.username })}
              />
            )}
            ListEmptyComponent={
              <View style={styles.center}>
                <Text style={styles.emptyIcon}>👥</Text>
                <Text style={styles.emptyTitle}>{t('friends.empty')}</Text>
                <Text style={styles.emptySubtext}>{t('friends.emptyHint')}</Text>
              </View>
            }
            refreshControl={
              <RefreshControl
                refreshing={postsRefreshing}
                onRefresh={async () => { setPostsRefreshing(true); await loadPosts(); setPostsRefreshing(false); }}
                tintColor={Colors.primary}
              />
            }
            contentContainerStyle={posts.length === 0 ? { flex: 1 } : { padding: 16 }}
          />
        )
      )}

      {/* DMタブ */}
      {tab === 'messages' && (
        convLoading ? (
          <View style={styles.center}>
            <ActivityIndicator color={Colors.primary} />
          </View>
        ) : convError ? (
          <View style={styles.center}>
            <Text style={styles.errorText}>{convError}</Text>
            <TouchableOpacity style={styles.retryBtn} onPress={loadConversations}>
              <Text style={styles.retryText}>再試行</Text>
            </TouchableOpacity>
          </View>
        ) : conversations.length === 0 ? (
          <View style={styles.center}>
            <Text style={styles.emptyIcon}>📬</Text>
            <Text style={styles.emptyTitle}>{t('inbox.empty')}</Text>
            <Text style={styles.emptySubtext}>{t('inbox.emptyHint')}</Text>
            <TouchableOpacity style={styles.retryBtn} onPress={() => navigation.navigate('NewConversation')}>
              <Text style={styles.retryText}>メッセージを送る</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <FlatList
            data={conversations}
            keyExtractor={item => String(item.id)}
            renderItem={({ item }) => (
              <ConversationItem
                item={item}
                currentUserId={user?.id}
                onPress={() => navigation.navigate('Chat', { conversation: item })}
              />
            )}
            refreshControl={
              <RefreshControl
                refreshing={convRefreshing}
                onRefresh={() => { setConvRefreshing(true); loadConversations(); }}
                tintColor={Colors.primary}
              />
            }
            ItemSeparatorComponent={() => <View style={styles.separator} />}
          />
        )
      )}

      {/* オープンチャットタブ */}
      {tab === 'open' && (
        roomsLoading ? (
          <View style={styles.center}>
            <ActivityIndicator color={Colors.primary} />
          </View>
        ) : roomsError ? (
          <View style={styles.center}>
            <Text style={styles.errorText}>{roomsError}</Text>
            <TouchableOpacity style={styles.retryBtn} onPress={loadRooms}>
              <Text style={styles.retryText}>再試行</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <FlatList
            data={rooms}
            keyExtractor={item => String(item.id)}
            renderItem={({ item }) => (
              <RoomItem
                item={item}
                onJoin={() => handleJoinRoom(item)}
                onEnter={() => handleEnterRoom(item)}
                joining={joiningId === item.id}
              />
            )}
            ListEmptyComponent={
              <View style={styles.center}>
                <Text style={styles.emptyIcon}>🌐</Text>
                <Text style={styles.emptyTitle}>まだルームがありません</Text>
                <Text style={styles.emptySubtext}>最初のオープンチャットを作ってみましょう！</Text>
                <TouchableOpacity style={styles.retryBtn} onPress={() => setCreateModalVisible(true)}>
                  <Text style={styles.retryText}>ルームを作成</Text>
                </TouchableOpacity>
              </View>
            }
            refreshControl={
              <RefreshControl
                refreshing={roomsRefreshing}
                onRefresh={() => { setRoomsRefreshing(true); loadRooms(); }}
                tintColor={Colors.primary}
              />
            }
            contentContainerStyle={rooms.length === 0 ? { flex: 1 } : { paddingVertical: 8 }}
            ItemSeparatorComponent={() => <View style={styles.separator} />}
          />
        )
      )}

      <CreateRoomModal
        visible={createModalVisible}
        onClose={() => setCreateModalVisible(false)}
        onCreate={handleCreateRoom}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },

  // ヘッダー
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  segmentRow: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: Colors.card,
    borderRadius: 12,
    padding: 4,
    gap: 4,
  },
  segmentBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    borderRadius: 9,
  },
  segmentActive: {
    backgroundColor: Colors.background,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  segmentText: {
    fontSize: 12,
    fontWeight: '500',
    color: Colors.muted,
  },
  segmentTextActive: {
    color: Colors.primary,
    fontWeight: '700',
  },
  newBtn: { paddingLeft: 12, padding: 4 },
  tabBadge: {
    position: 'absolute',
    top: -2,
    right: 2,
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: '#FF3B30',
  },

  // 共通
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  emptyIcon: { fontSize: 48, marginBottom: 16 },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: Colors.foreground, marginBottom: 8, textAlign: 'center' },
  emptySubtext: { fontSize: 13, color: Colors.muted, textAlign: 'center', lineHeight: 20, marginBottom: 24 },
  errorText: { color: Colors.muted, fontSize: 14, textAlign: 'center', marginBottom: 16 },
  retryBtn: { backgroundColor: Colors.primary, paddingHorizontal: 28, paddingVertical: 10, borderRadius: 20 },
  retryText: { color: '#fff', fontSize: 14, fontWeight: '600' },

  // 投稿カード
  card: {
    backgroundColor: Colors.card,
    borderRadius: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
    ...Shadows.medium,
  },
  imageContainer: { width: '100%', height: 200, position: 'relative' },
  cardImage: { width: '100%', height: '100%' },
  imageCounter: {
    position: 'absolute', top: 12, right: 12,
    backgroundColor: 'rgba(10,10,15,0.8)',
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: 16,
  },
  imageCounterText: { color: '#fff', fontSize: 12, fontWeight: '600' },
  cardContent: { padding: 14 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  avatar: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: Colors.primary,
    alignItems: 'center', justifyContent: 'center', marginRight: 10,
  },
  avatarText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  headerText: { flex: 1 },
  displayName: { fontSize: 15, fontWeight: '600', color: Colors.foreground },
  username: { fontSize: 12, color: Colors.muted, marginTop: 1 },
  postTitle: { fontSize: 16, fontWeight: 'bold', color: Colors.foreground, marginBottom: 10 },
  stats: { flexDirection: 'row', borderTopWidth: 1, borderTopColor: Colors.border, paddingTop: 10 },
  statItem: { flexDirection: 'row', alignItems: 'center', marginRight: 18 },
  statIcon: { fontSize: 16, marginRight: 5 },
  statText: { fontSize: 13, color: Colors.muted, fontWeight: '600' },

  // 会話アイテム
  convItem: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10 },
  convAvatarWrap: { position: 'relative', marginRight: 14 },
  avatarPlaceholder: { backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center' },
  avatarInitial: { color: '#fff', fontWeight: 'bold', fontSize: 20 },
  groupBadge: {
    position: 'absolute', bottom: 0, right: 0,
    width: 20, height: 20, borderRadius: 10,
    backgroundColor: Colors.violet,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: Colors.background,
  },
  convBody: { flex: 1, justifyContent: 'center' },
  convHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 3 },
  convName: { fontSize: 16, fontWeight: '700', color: Colors.foreground, flex: 1, marginRight: 8 },
  convTime: { fontSize: 11, color: Colors.muted, flexShrink: 0 },
  convFooter: { flexDirection: 'row', alignItems: 'center' },
  convPreview: { fontSize: 13, color: Colors.muted, flex: 1, lineHeight: 18 },
  convPreviewBold: { color: Colors.foreground, fontWeight: '500' },
  unreadBadge: {
    backgroundColor: '#4CD964',
    borderRadius: 11, minWidth: 22, height: 22,
    alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 6, marginLeft: 8,
  },
  unreadText: { color: '#fff', fontSize: 12, fontWeight: 'bold' },
  separator: { height: 1, backgroundColor: Colors.border, marginLeft: 82 },

  // オープンチャット：ルームアイテム
  roomItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  roomAvatar: {
    width: 52,
    height: 52,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  roomAvatarText: { color: '#fff', fontSize: 22, fontWeight: 'bold' },
  roomBody: { flex: 1, marginRight: 10 },
  roomName: { fontSize: 15, fontWeight: '700', color: Colors.foreground, marginBottom: 2 },
  roomDesc: { fontSize: 12, color: Colors.muted, marginBottom: 4 },
  roomMeta: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  roomMetaText: { fontSize: 11, color: Colors.muted },
  roomMetaTime: { fontSize: 11, color: Colors.muted },
  roomBtn: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    minWidth: 58,
    alignItems: 'center',
  },
  roomBtnEnter: {
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: Colors.primary,
  },
  roomBtnText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  roomBtnTextEnter: { color: Colors.primary },

  // モーダル
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  modalSheet: {
    backgroundColor: Colors.card,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 40,
  },
  modalHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.border,
    alignSelf: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.foreground,
    marginBottom: 20,
  },
  modalLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.muted,
    marginBottom: 6,
  },
  modalInput: {
    backgroundColor: Colors.background,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: Colors.foreground,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  modalCreateBtn: {
    backgroundColor: Colors.primary,
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: 'center',
    marginTop: 4,
  },
  modalCreateBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
});
