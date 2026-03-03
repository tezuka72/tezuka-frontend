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
} from 'react-native';
import { userAPI, bookmarkAPI, libraryAPI } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { Colors } from '../theme/colors';
import { Shadows } from '../theme/styles';
import LibraryBookCard from '../components/LibraryBookCard';

// 投稿ミニカード（既存）
function MiniPostCard({ post, onPress }) {
  const firstImage = post.images?.[0]?.image_url || post.images?.[0];
  return (
    <TouchableOpacity style={styles.miniCard} onPress={onPress} activeOpacity={0.85}>
      {firstImage ? (
        <Image source={{ uri: firstImage }} style={styles.miniImage} resizeMode="cover" />
      ) : (
        <View style={[styles.miniImage, styles.miniImagePlaceholder]}>
          <Text style={styles.miniImagePlaceholderText}>📖</Text>
        </View>
      )}
      <Text style={styles.miniTitle} numberOfLines={1}>{post.title}</Text>
    </TouchableOpacity>
  );
}

// ── 本棚サブタブ ──────────────────────────────────────

function LibraryTab({ navigation }) {
  const { t } = useLanguage();
  const [subTab, setSubTab] = useState('follows');
  const [follows, setFollows] = useState([]);
  const [likes, setLikes] = useState([]);
  const [followsCursor, setFollowsCursor] = useState(null);
  const [likesCursor, setLikesCursor] = useState(null);
  const [followsMore, setFollowsMore] = useState(true);
  const [likesMore, setLikesMore] = useState(true);
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

  // 初回ロード（タブごとに1回だけ）
  useEffect(() => {
    if (!loadedTabs.includes(subTab)) {
      setLoadedTabs(prev => [...prev, subTab]);
      if (subTab === 'follows') loadFollows(null, true);
      else loadLikes(null, true);
    }
  }, [subTab]);

  const handleContinue = (series) => {
    navigation?.navigate('PostDetail', { postId: series.last_episode_id });
  };

  const handleSeriesPress = (series) => {
    navigation?.navigate('SeriesDetail', { seriesId: series.series_id });
  };

  const currentList   = subTab === 'follows' ? follows : likes;
  const currentMore   = subTab === 'follows' ? followsMore  : likesMore;
  const currentCursor = subTab === 'follows' ? followsCursor : likesCursor;
  const loadMore = () => {
    if (!currentMore) return;
    if (subTab === 'follows') loadFollows(currentCursor);
    else loadLikes(currentCursor);
  };

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
      </View>

      {/* リスト */}
      <FlatList
        data={currentList}
        keyExtractor={item => item.series_id}
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
              <Text style={styles.emptyText}>
                {subTab === 'follows'
                  ? t('library.empty.follows')
                  : t('library.empty.likes')}
              </Text>
              <Text style={styles.emptyHint}>
                {subTab === 'follows'
                  ? t('library.empty.follows.hint')
                  : t('library.empty.likes.hint')}
              </Text>
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
  const { username } = route.params;
  const { lang, toggleLanguage, t } = useLanguage();
  const { user: currentUser } = useAuth();
  const [profile, setProfile] = useState(null);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('posts');
  const [bookmarks, setBookmarks] = useState([]);
  const [bookmarksLoaded, setBookmarksLoaded] = useState(false);

  const isOwnProfile = currentUser?.username === username;

  useEffect(() => {
    loadProfile();
  }, [username]);

  const loadProfile = async () => {
    try {
      setError('');
      const response = await userAPI.getProfile(username);
      setProfile(response.user);
    } catch (e) {
      console.error('Load profile error:', e);
      setError(t('profile.loadError'));
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

  const handleTabSwitch = (tab) => {
    setActiveTab(tab);
    if (tab === 'favorites' && !bookmarksLoaded) loadBookmarks();
  };

  const handlePostPress = (post) => {
    navigation?.navigate('PostDetail', { postId: post.id });
  };

  if (!profile) {
    return (
      <View style={styles.container}>
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
    <View style={styles.container}>
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
          <TouchableOpacity style={styles.followButton}>
            <Text style={styles.followButtonText}>{t('profile.follow')}</Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity style={styles.langToggleButton} onPress={toggleLanguage}>
          <Text style={styles.langToggleText}>🌐 {lang === 'ja' ? 'EN' : 'JP'}</Text>
        </TouchableOpacity>
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
          {(profile.posts || []).length === 0 ? (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyIcon}>📖</Text>
              <Text style={styles.emptyText}>{t('profile.posts')}</Text>
            </View>
          ) : (
            <View style={styles.grid}>
              {(profile.posts || []).map((post) => (
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
    paddingTop: 24,
    paddingBottom: 16,
    backgroundColor: Colors.card,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
    ...Shadows.medium,
  },
  avatarText: {
    color: '#FFFFFF',
    fontSize: 32,
    fontWeight: 'bold',
  },
  displayName: {
    fontSize: 22,
    fontWeight: 'bold',
    color: Colors.foreground,
    marginBottom: 4,
  },
  username: {
    fontSize: 14,
    color: Colors.muted,
    marginBottom: 12,
  },
  bio: {
    fontSize: 14,
    color: Colors.foreground,
    textAlign: 'center',
    marginBottom: 12,
    lineHeight: 20,
  },
  stats: {
    flexDirection: 'row',
    marginBottom: 12,
    gap: 32,
  },
  statItem: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: Colors.foreground,
  },
  statLabel: {
    fontSize: 12,
    color: Colors.muted,
    marginTop: 2,
  },
  followButton: {
    backgroundColor: Colors.primary,
    borderRadius: 24,
    paddingVertical: 10,
    paddingHorizontal: 28,
    marginBottom: 8,
    ...Shadows.glow,
  },
  followButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: 'bold',
  },
  langToggleButton: {
    marginTop: 8,
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
