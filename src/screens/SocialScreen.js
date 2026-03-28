import { useState, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  RefreshControl, ActivityIndicator, Image,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { feedAPI, postAPI, messageAPI, repostAPI } from '../api/client';
import RepostCard from '../components/repost/RepostCard';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
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

// ─── フォロー中フィード：投稿カード ──────────────────────
function PostCard({ post, onPress, onLike, onAuthorPress }) {
  const { t } = useLanguage();
  const firstImage = post.images?.[0]?.image_url || post.images?.[0];
  const imageCount = post.images?.length || 0;

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.9}>
      {firstImage && (
        <View style={styles.imageContainer}>
          <Image source={{ uri: firstImage }} style={styles.cardImage} resizeMode="cover" />
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
    return <Image source={{ uri }} style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: Colors.card }} />;
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
  const isGroup = item.type === 'group';
  const displayName = isGroup
    ? (item.name || others.map(u => u.display_name || u.username).join(', '))
    : (others[0]?.display_name || others[0]?.username || '?');
  const avatarUri = isGroup ? null : others[0]?.avatar_url;
  const lastContent = item.last_message_content || '';
  const isMine = item.last_message_sender_id === currentUserId;
  const senderLabel = isMine ? 'あなた: ' : (item.last_message_sender_display_name || item.last_message_sender_username || '');
  const unread = parseInt(item.unread_count) || 0;

  return (
    <TouchableOpacity style={styles.convItem} onPress={onPress} activeOpacity={0.7}>
      <View style={styles.convAvatarWrap}>
        <Avatar uri={avatarUri} name={displayName} />
        {isGroup && (
          <View style={styles.groupBadge}>
            <Ionicons name="people" size={10} color="#fff" />
          </View>
        )}
      </View>
      <View style={styles.convBody}>
        <View style={styles.convHeader}>
          <Text style={styles.convName} numberOfLines={1}>{displayName}</Text>
          {item.last_message_created_at && (
            <Text style={styles.convTime}>{timeAgo(item.last_message_created_at)}</Text>
          )}
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

// ─── メイン画面 ───────────────────────────────────────────
export default function SocialScreen() {
  const insets = useSafeAreaInsets();
  const { t } = useLanguage();
  const { user } = useAuth();
  const navigation = useNavigation();
  const [tab, setTab] = useState('friends'); // 'friends' | 'reposts' | 'messages'

  // フォロー中フィード
  const [posts, setPosts] = useState([]);
  const [postsRefreshing, setPostsRefreshing] = useState(false);
  const [postsError, setPostsError] = useState('');

  // リポストタイムライン
  const [reposts, setReposts] = useState([]);
  const [repostsLoading, setRepostsLoading] = useState(false);
  const [repostsRefreshing, setRepostsRefreshing] = useState(false);
  const [repostsError, setRepostsError] = useState('');

  // メッセージ
  const [conversations, setConversations] = useState([]);
  const [convLoading, setConvLoading] = useState(true);
  const [convRefreshing, setConvRefreshing] = useState(false);
  const [convError, setConvError] = useState('');

  const loadPosts = useCallback(async () => {
    try {
      setPostsError('');
      const response = await feedAPI.getFollowingFeed();
      setPosts(response.posts || []);
    } catch {
      setPostsError(t('friends.loadError'));
    }
  }, [t]);

  const loadReposts = useCallback(async () => {
    try {
      setRepostsError('');
      const response = await repostAPI.getTimeline({ limit: 20 });
      setReposts(response.items || []);
    } catch {
      setRepostsError('リポストの読み込みに失敗しました');
    } finally {
      setRepostsLoading(false);
      setRepostsRefreshing(false);
    }
  }, []);

  const loadConversations = useCallback(async () => {
    try {
      setConvError('');
      const data = await messageAPI.getConversations();
      setConversations(data.conversations || []);
    } catch {
      setConvError(t('inbox.loadError'));
    } finally {
      setConvLoading(false);
      setConvRefreshing(false);
    }
  }, [t]);

  useFocusEffect(useCallback(() => {
    loadPosts();
    setRepostsLoading(true);
    loadReposts();
    setConvLoading(true);
    loadConversations();
  }, [loadPosts, loadReposts, loadConversations]));

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

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* ヘッダー */}
      <View style={styles.header}>
        <View style={styles.segmentRow}>
          <TouchableOpacity
            style={[styles.segmentBtn, tab === 'friends' && styles.segmentActive]}
            onPress={() => setTab('friends')}
          >
            <Ionicons
              name={tab === 'friends' ? 'people' : 'people-outline'}
              size={16}
              color={tab === 'friends' ? Colors.primary : Colors.muted}
              style={{ marginRight: 6 }}
            />
            <Text style={[styles.segmentText, tab === 'friends' && styles.segmentTextActive]}>
              フォロー中
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.segmentBtn, tab === 'reposts' && styles.segmentActive]}
            onPress={() => setTab('reposts')}
          >
            <Text style={{ marginRight: 4, fontSize: 14 }}>↩️</Text>
            <Text style={[styles.segmentText, tab === 'reposts' && styles.segmentTextActive]}>
              リポスト
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.segmentBtn, tab === 'messages' && styles.segmentActive]}
            onPress={() => setTab('messages')}
          >
            <Ionicons
              name={tab === 'messages' ? 'chatbubble-ellipses' : 'chatbubble-ellipses-outline'}
              size={16}
              color={tab === 'messages' ? Colors.primary : Colors.muted}
              style={{ marginRight: 6 }}
            />
            <Text style={[styles.segmentText, tab === 'messages' && styles.segmentTextActive]}>
              メッセージ
            </Text>
          </TouchableOpacity>
        </View>

        {tab === 'messages' && (
          <TouchableOpacity style={styles.newBtn} onPress={() => navigation.navigate('NewConversation')}>
            <Ionicons name="create-outline" size={24} color={Colors.primary} />
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

      {/* リポストタブ */}
      {tab === 'reposts' && (
        repostsLoading ? (
          <View style={styles.center}>
            <ActivityIndicator color={Colors.primary} />
          </View>
        ) : repostsError ? (
          <View style={styles.center}>
            <Text style={styles.errorText}>{repostsError}</Text>
            <TouchableOpacity style={styles.retryBtn} onPress={() => { setRepostsLoading(true); loadReposts(); }}>
              <Text style={styles.retryText}>再試行</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <FlatList
            data={reposts}
            keyExtractor={item => String(item.id)}
            renderItem={({ item }) => (
              <RepostCard
                repost={item}
                onReadPress={(seriesId) => navigation.navigate('SeriesDetail', { seriesId })}
              />
            )}
            ListEmptyComponent={
              <View style={styles.center}>
                <Text style={styles.emptyIcon}>↩️</Text>
                <Text style={styles.emptyTitle}>リポストがありません</Text>
                <Text style={styles.emptySubtext}>フォロー中のユーザーがリポストすると表示されます</Text>
              </View>
            }
            refreshControl={
              <RefreshControl
                refreshing={repostsRefreshing}
                onRefresh={() => { setRepostsRefreshing(true); loadReposts(); }}
                tintColor={Colors.primary}
              />
            }
            contentContainerStyle={reposts.length === 0 ? { flex: 1 } : { paddingVertical: 8 }}
          />
        )
      )}

      {/* メッセージタブ */}
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
    fontSize: 13,
    fontWeight: '500',
    color: Colors.muted,
  },
  segmentTextActive: {
    color: Colors.primary,
    fontWeight: '700',
  },
  newBtn: { paddingLeft: 12, padding: 4 },

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
  convItem: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12 },
  convAvatarWrap: { position: 'relative', marginRight: 12 },
  avatarPlaceholder: { backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center' },
  avatarInitial: { color: '#fff', fontWeight: 'bold', fontSize: 18 },
  groupBadge: {
    position: 'absolute', bottom: 0, right: 0,
    width: 18, height: 18, borderRadius: 9,
    backgroundColor: Colors.violet,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: Colors.background,
  },
  convBody: { flex: 1 },
  convHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  convName: { fontSize: 15, fontWeight: '600', color: Colors.foreground, flex: 1, marginRight: 8 },
  convTime: { fontSize: 12, color: Colors.muted },
  convFooter: { flexDirection: 'row', alignItems: 'center' },
  convPreview: { fontSize: 13, color: Colors.muted, flex: 1 },
  convPreviewBold: { color: Colors.foreground, fontWeight: '500' },
  unreadBadge: {
    backgroundColor: Colors.primary,
    borderRadius: 10, minWidth: 20, height: 20,
    alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 5, marginLeft: 8,
  },
  unreadText: { color: '#fff', fontSize: 11, fontWeight: 'bold' },
  separator: { height: 1, backgroundColor: Colors.border, marginLeft: 72 },
});
