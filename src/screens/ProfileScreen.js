import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  FlatList,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { userAPI, bookmarkAPI, libraryAPI, postAPI, repostAPI } from '../api/client';
import RepostCard from '../components/repost/RepostCard';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { Colors } from '../theme/colors';
import { Shadows } from '../theme/styles';
import LibraryBookCard from '../components/LibraryBookCard';

// 投稿ミニカード
function MiniPostCard({ post, onPress, onDelete }) {
  const firstImage = post.images?.[0]?.image_url || post.images?.[0];

  const handleLongPress = () => {
    if (!onDelete) return;
    Alert.alert(
      '投稿を削除',
      `「${post.title}」を削除しますか？\nこの操作は取り消せません。`,
      [
        { text: 'キャンセル', style: 'cancel' },
        { text: '削除', style: 'destructive', onPress: onDelete },
      ]
    );
  };

  return (
    <TouchableOpacity
      style={styles.miniCard}
      onPress={onPress}
      onLongPress={handleLongPress}
      activeOpacity={0.85}
      delayLongPress={400}
    >
      {firstImage ? (
        <Image source={{ uri: firstImage }} style={styles.miniImage} resizeMode="cover" />
      ) : (
        <View style={[styles.miniImage, styles.miniImagePlaceholder]}>
          <Text style={styles.miniImagePlaceholderText}>📖</Text>
        </View>
      )}
      <Text style={styles.miniTitle} numberOfLines={1}>{post.title}</Text>
      {onDelete && (
        <View style={styles.deleteHint}>
          <Ionicons name="ellipsis-horizontal" size={12} color={Colors.muted} />
        </View>
      )}
    </TouchableOpacity>
  );
}

// ── 本棚サブタブ ──────────────────────────────────────

function LibraryTab({ navigation }) {
  const { t } = useLanguage();
  const [subTab, setSubTab] = useState('follows');
  const [follows, setFollows] = useState([]);
  const [likes, setLikes] = useState([]);
  const [reposts, setReposts] = useState([]);
  const [followsCursor, setFollowsCursor] = useState(null);
  const [likesCursor, setLikesCursor] = useState(null);
  const [repostsCursor, setRepostsCursor] = useState(null);
  const [followsMore, setFollowsMore] = useState(true);
  const [likesMore, setLikesMore] = useState(true);
  const [repostsMore, setRepostsMore] = useState(true);
  const [loading, setLoading] = useState(false);
  const [loadedTabs, setLoadedTabs] = useState([]);

  const loadFollows = useCallback(async (cursor = null, reset = false) => {
    if (loading) return;
    setLoading(true);
    try {
      const res = await libraryAPI.getFollows(cursor);
      const newItems = res.items || [];
      setFollows(prev => reset ? newItems : [...prev, ...newItems]);
      setFollowsCursor(res.next_cursor ?? null);
      setFollowsMore(res.has_more ?? false);
    } catch (e) {
      console.error('Library follows error:', e);
    } finally {
      setLoading(false);
    }
  }, [loading]);

  const loadLikes = useCallback(async (cursor = null, reset = false) => {
    if (loading) return;
    setLoading(true);
    try {
      const res = await libraryAPI.getLikes(cursor);
      const newItems = res.items || [];
      setLikes(prev => reset ? newItems : [...prev, ...newItems]);
      setLikesCursor(res.next_cursor ?? null);
      setLikesMore(res.has_more ?? false);
    } catch (e) {
      console.error('Library likes error:', e);
    } finally {
      setLoading(false);
    }
  }, [loading]);

  const loadReposts = useCallback(async (cursor = null, reset = false) => {
    if (loading) return;
    setLoading(true);
    try {
      const res = await libraryAPI.getReposts(cursor);
      const newItems = res.items || [];
      setReposts(prev => reset ? newItems : [...prev, ...newItems]);
      setRepostsCursor(res.next_cursor ?? null);
      setRepostsMore(res.has_more ?? false);
    } catch (e) {
      console.error('Library reposts error:', e);
    } finally {
      setLoading(false);
    }
  }, [loading]);

  // 初回ロード（タブごとに1回だけ）
  useEffect(() => {
    if (!loadedTabs.includes(subTab)) {
      setLoadedTabs(prev => [...prev, subTab]);
      if (subTab === 'follows') loadFollows(null, true);
      else if (subTab === 'likes') loadLikes(null, true);
      else loadReposts(null, true);
    }
  }, [subTab]);

  const handleContinue = (series) => {
    navigation?.navigate('PostDetail', { postId: series.last_episode_id });
  };

  const handleSeriesPress = (series) => {
    navigation?.navigate('SeriesDetail', { seriesId: series.series_id });
  };

  const currentList   = subTab === 'follows' ? follows : subTab === 'likes' ? likes : reposts;
  const currentMore   = subTab === 'follows' ? followsMore : subTab === 'likes' ? likesMore : repostsMore;
  const currentCursor = subTab === 'follows' ? followsCursor : subTab === 'likes' ? likesCursor : repostsCursor;
  const loadMore = () => {
    if (!currentMore) return;
    if (subTab === 'follows') loadFollows(currentCursor);
    else if (subTab === 'likes') loadLikes(currentCursor);
    else loadReposts(currentCursor);
  };

  const emptyText = subTab === 'follows'
    ? t('library.empty.follows')
    : subTab === 'likes'
    ? t('library.empty.likes')
    : 'まだリポストした作品がありません';
  const emptyHint = subTab === 'follows'
    ? t('library.empty.follows.hint')
    : subTab === 'likes'
    ? t('library.empty.likes.hint')
    : 'フィードや作品ページの ↩️ ボタンでリポストできます';

  return (
    <View style={{ flex: 1 }}>
      {/* サブタブ */}
      <View style={styles.subTabBar}>
        <TouchableOpacity
          style={[styles.subTab, subTab === 'follows' && styles.subTabActive]}
          onPress={() => setSubTab('follows')}
        >
          <Text style={[styles.subTabText, subTab === 'follows' && styles.subTabTextActive]}>
            {t('library.follows')}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.subTab, subTab === 'likes' && styles.subTabActive]}
          onPress={() => setSubTab('likes')}
        >
          <Text style={[styles.subTabText, subTab === 'likes' && styles.subTabTextActive]}>
            {t('library.likes')}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.subTab, subTab === 'reposts' && styles.subTabActive]}
          onPress={() => setSubTab('reposts')}
        >
          <Text style={[styles.subTabText, subTab === 'reposts' && styles.subTabTextActive]}>
            リポスト
          </Text>
        </TouchableOpacity>
      </View>

      {/* リスト */}
      <FlatList
        data={currentList}
        keyExtractor={item => String(item.series_id)}
        renderItem={({ item }) => (
          <LibraryBookCard
            series={item}
            onPress={() => handleSeriesPress(item)}
            onContinue={item.last_episode_id ? () => handleContinue(item) : null}
          />
        )}
        contentContainerStyle={styles.libraryList}
        onEndReached={loadMore}
        onEndReachedThreshold={0.3}
        ListEmptyComponent={() =>
          loading ? (
            <ActivityIndicator color={Colors.primary} style={{ marginTop: 40 }} />
          ) : (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyIcon}>📚</Text>
              <Text style={styles.emptyText}>{emptyText}</Text>
              <Text style={styles.emptyHint}>{emptyHint}</Text>
            </View>
          )
        }
        ListFooterComponent={() =>
          loading && currentList.length > 0
            ? <ActivityIndicator color={Colors.primary} style={{ marginVertical: 16 }} />
            : null
        }
      />
    </View>
  );
}

// ── メイン ProfileScreen ─────────────────────────────
export default function ProfileScreen({ route, navigation }) {
  const insets = useSafeAreaInsets();
  const { username } = route.params;
  const { lang, toggleLanguage, t } = useLanguage();
  const { user: currentUser } = useAuth();
  const [profile, setProfile] = useState(null);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('posts');
  const [bookmarks, setBookmarks] = useState([]);
  const [bookmarksLoaded, setBookmarksLoaded] = useState(false);
  const [reposts, setReposts] = useState([]);
  const [repostsLoaded, setRepostsLoaded] = useState(false);
  const [repostsLoading, setRepostsLoading] = useState(false);

  const isOwnProfile = currentUser?.username === username;
  const [isFollowing, setIsFollowing] = useState(false);
  const [userPosts, setUserPosts] = useState([]);
  const [postsLoading, setPostsLoading] = useState(false);

  useEffect(() => {
    loadProfile();
    loadUserPosts();
  }, [username]);

  const loadProfile = async () => {
    try {
      setError('');
      const response = await userAPI.getProfile(username);
      setProfile(response.user);
      setIsFollowing(response.user?.is_following ?? false);
    } catch (e) {
      console.error('Load profile error:', e);
      setError(t('profile.loadError'));
    }
  };

  const loadUserPosts = async () => {
    setPostsLoading(true);
    try {
      const response = await userAPI.getUserPosts(username);
      setUserPosts(response.posts || []);
    } catch (e) {
      console.error('Load user posts error:', e);
    } finally {
      setPostsLoading(false);
    }
  };

  const handleFollow = async () => {
    if (!profile) return;
    try {
      if (isFollowing) {
        await userAPI.unfollow(profile.id);
        setIsFollowing(false);
        setProfile(prev => ({ ...prev, follower_count: Math.max(0, (prev.follower_count || 1) - 1) }));
      } else {
        await userAPI.follow(profile.id);
        setIsFollowing(true);
        setProfile(prev => ({ ...prev, follower_count: (prev.follower_count || 0) + 1 }));
      }
    } catch (e) {
      console.error('Follow error:', e);
    }
  };

  const loadBookmarks = async () => {
    if (bookmarksLoaded) return;
    try {
      const response = await bookmarkAPI.getMyBookmarks();
      setBookmarks(response.posts || []);
      setBookmarksLoaded(true);
    } catch (e) {
      console.error('Load bookmarks error:', e);
    }
  };

  const loadReposts = async () => {
    if (repostsLoaded) return;
    setRepostsLoading(true);
    try {
      const response = await repostAPI.list({ limit: 50 });
      setReposts(response.reposts || []);
      setRepostsLoaded(true);
    } catch (e) {
      console.error('Load reposts error:', e);
    } finally {
      setRepostsLoading(false);
    }
  };

  const handleTabSwitch = (tab) => {
    setActiveTab(tab);
    if (tab === 'favorites' && !bookmarksLoaded) loadBookmarks();
    if (tab === 'reposts' && !repostsLoaded) loadReposts();
  };

  const handlePostPress = (post) => {
    navigation?.navigate('PostDetail', { postId: post.id });
  };

  const handleDeletePost = async (postId) => {
    try {
      await postAPI.delete(postId);
      setUserPosts(prev => prev.filter(p => p.id !== postId));
    } catch (e) {
      console.error('Delete post error:', e);
      Alert.alert('エラー', '削除に失敗しました。もう一度お試しください。');
    }
  };

  if (!profile) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        {error ? (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}
        <Text style={styles.loading}>{t('common.loading')}</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {error ? (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      {/* プロフィールヘッダー */}
      <View style={styles.header}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>
            {profile.display_name?.[0]?.toUpperCase() || '?'}
          </Text>
        </View>
        <Text style={styles.displayName}>{profile.display_name}</Text>
        <Text style={styles.username}>@{profile.username}</Text>

        {profile.bio && (
          <Text style={styles.bio}>{profile.bio}</Text>
        )}

        <View style={styles.stats}>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{profile.follower_count || 0}</Text>
            <Text style={styles.statLabel}>{t('profile.followers')}</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{profile.following_count || 0}</Text>
            <Text style={styles.statLabel}>{t('profile.following')}</Text>
          </View>
        </View>

        {!isOwnProfile && (
          <TouchableOpacity
            style={[styles.followButton, isFollowing && styles.followButtonActive]}
            onPress={handleFollow}
          >
            <Text style={[styles.followButtonText, isFollowing && styles.followButtonTextActive]}>
              {isFollowing ? `✓ ${t('profile.following')}` : t('profile.follow')}
            </Text>
          </TouchableOpacity>
        )}

        <View style={styles.profileActions}>
          <TouchableOpacity style={styles.langToggleButton} onPress={toggleLanguage}>
            <Text style={styles.langToggleText}>🌐 {lang === 'ja' ? 'EN' : 'JP'}</Text>
          </TouchableOpacity>
          {isOwnProfile && (
            <>
              <TouchableOpacity
                style={styles.earningsButton}
                onPress={() => navigation?.navigate('EarningsDashboard')}
              >
                <Text style={styles.earningsButtonText}>💰 収益</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.editProfileButton}
                onPress={() => navigation?.navigate('EditProfile')}
              >
                <Text style={styles.editProfileButtonText}>✏️ 編集</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.createSeriesButton}
                onPress={() => navigation?.navigate('CreateSeries')}
              >
                <Text style={styles.createSeriesButtonText}>＋ シリーズ</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </View>

      {/* タブバー */}
      <View style={styles.tabBar}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'posts' && styles.tabActive]}
          onPress={() => handleTabSwitch('posts')}
        >
          <Text style={[styles.tabText, activeTab === 'posts' && styles.tabTextActive]}>
            {t('profile.posts')}
          </Text>
        </TouchableOpacity>

        {isOwnProfile && (
          <>
            <TouchableOpacity
              style={[styles.tab, activeTab === 'library' && styles.tabActive]}
              onPress={() => handleTabSwitch('library')}
            >
              <Text style={[styles.tabText, activeTab === 'library' && styles.tabTextActive]}>
                📚 {t('library.title')}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.tab, activeTab === 'favorites' && styles.tabActive]}
              onPress={() => handleTabSwitch('favorites')}
            >
              <Text style={[styles.tabText, activeTab === 'favorites' && styles.tabTextActive]}>
                🔖 {t('profile.favorites')}
              </Text>
            </TouchableOpacity>
          </>
        )}
      </View>

      {/* コンテンツ */}
      {activeTab === 'posts' && (
        <ScrollView contentContainerStyle={styles.gridContainer}>
          {postsLoading ? (
            <ActivityIndicator color={Colors.primary} style={{ marginTop: 40 }} />
          ) : userPosts.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyIcon}>📖</Text>
              <Text style={styles.emptyText}>{t('profile.posts')}</Text>
            </View>
          ) : (
            <View style={styles.grid}>
              {userPosts.map((post) => (
                <MiniPostCard
                  key={post.id}
                  post={post}
                  onPress={() => handlePostPress(post)}
                  onDelete={isOwnProfile ? () => handleDeletePost(post.id) : undefined}
                />
              ))}
            </View>
          )}
        </ScrollView>
      )}

      {/* 本棚（自分のみ） */}
      {activeTab === 'library' && isOwnProfile && (
        <LibraryTab navigation={navigation} />
      )}

      {activeTab === 'favorites' && (
        <ScrollView contentContainerStyle={styles.gridContainer}>
          {bookmarks.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyIcon}>🔖</Text>
              <Text style={styles.emptyText}>{t('profile.favoritesEmpty')}</Text>
              <Text style={styles.emptyHint}>{t('profile.favoritesEmptyHint')}</Text>
            </View>
          ) : (
            <View style={styles.grid}>
              {bookmarks.map((post) => (
                <MiniPostCard
                  key={post.id}
                  post={post}
                  onPress={() => handlePostPress(post)}
                />
              ))}
            </View>
          )}
        </ScrollView>
      )}
    </View>
  );
}

const CARD_WIDTH = '48%';

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  loading: {
    color: Colors.foreground,
    textAlign: 'center',
    marginTop: 100,
    fontSize: 16,
  },
  header: {
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: 10,
    backgroundColor: Colors.card,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
    ...Shadows.medium,
  },
  avatarText: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: 'bold',
  },
  displayName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: Colors.foreground,
    marginBottom: 2,
  },
  username: {
    fontSize: 12,
    color: Colors.muted,
    marginBottom: 8,
  },
  bio: {
    fontSize: 12,
    color: Colors.foreground,
    textAlign: 'center',
    marginBottom: 8,
    lineHeight: 17,
  },
  stats: {
    flexDirection: 'row',
    marginBottom: 8,
    gap: 24,
  },
  statItem: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: Colors.foreground,
  },
  statLabel: {
    fontSize: 11,
    color: Colors.muted,
    marginTop: 1,
  },
  followButton: {
    backgroundColor: Colors.primary,
    borderRadius: 24,
    paddingVertical: 10,
    paddingHorizontal: 28,
    marginBottom: 8,
    ...Shadows.glow,
  },
  followButtonActive: {
    backgroundColor: Colors.background,
    borderWidth: 1.5,
    borderColor: Colors.primary,
  },
  followButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: 'bold',
  },
  followButtonTextActive: {
    color: Colors.primary,
  },
  profileActions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
    alignItems: 'center',
  },
  langToggleButton: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  langToggleText: {
    color: Colors.muted,
    fontSize: 12,
    fontWeight: '600',
  },
  earningsButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: Colors.primary,
  },
  earningsButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  editProfileButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  editProfileButtonText: {
    color: Colors.foreground,
    fontSize: 12,
    fontWeight: '600',
  },
  createSeriesButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.primary,
  },
  createSeriesButtonText: {
    color: Colors.primary,
    fontSize: 12,
    fontWeight: '700',
  },
  // メインタブ
  tabBar: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    backgroundColor: Colors.card,
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabActive: {
    borderBottomColor: Colors.primary,
  },
  tabText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.muted,
  },
  tabTextActive: {
    color: Colors.primary,
  },
  // 本棚サブタブ
  subTabBar: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    backgroundColor: Colors.background,
    paddingHorizontal: 16,
    paddingTop: 4,
  },
  subTab: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    marginRight: 4,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  subTabActive: {
    borderBottomColor: Colors.violet,
  },
  subTabText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.muted,
  },
  subTabTextActive: {
    color: Colors.violet,
  },
  // 本棚リスト
  libraryList: {
    padding: 16,
  },
  // グリッド（投稿・お気に入り）
  gridContainer: {
    padding: 12,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  miniCard: {
    width: CARD_WIDTH,
    backgroundColor: Colors.card,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 4,
  },
  miniImage: {
    width: '100%',
    aspectRatio: 0.75,
  },
  miniImagePlaceholder: {
    backgroundColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  miniImagePlaceholderText: {
    fontSize: 32,
  },
  miniTitle: {
    fontSize: 12,
    color: Colors.foreground,
    fontWeight: '600',
    padding: 8,
  },
  deleteHint: {
    position: 'absolute',
    top: 6,
    right: 6,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 10,
    padding: 3,
  },
  // 空状態
  emptyContainer: {
    alignItems: 'center',
    paddingTop: 60,
    paddingHorizontal: 32,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: Colors.foreground,
    marginBottom: 8,
    textAlign: 'center',
  },
  emptyHint: {
    fontSize: 13,
    color: Colors.muted,
    textAlign: 'center',
    lineHeight: 20,
  },
  errorContainer: {
    backgroundColor: '#FFE0E0',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#FF6B6B',
  },
  errorText: {
    color: '#C92A2A',
    fontSize: 14,
    fontWeight: '500',
  },
});
