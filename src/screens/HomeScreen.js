import { useState, useEffect, useRef, useCallback, memo } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  Animated,
  TouchableWithoutFeedback,
  Linking,
} from 'react-native';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { feedAPI, postAPI, bookmarkAPI, adAPI, repostAPI } from '../api/client';
import RepostModal from '../components/repost/RepostModal';
import { useLanguage } from '../context/LanguageContext';
import { Colors } from '../theme/colors';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const TAB_BAR_HEIGHT = 60;

// =====================
// 単一投稿フルスクリーンアイテム
// =====================
const PostItem = memo(function PostItem({ post, navigation, itemHeight }) {
  const insets = useSafeAreaInsets();
  const ITEM_HEIGHT = itemHeight > 0 ? itemHeight : SCREEN_HEIGHT;
  const [isLiked, setIsLiked] = useState(post.is_liked || false);
  const [likeCount, setLikeCount] = useState(post.like_count || 0);
  const [isBookmarked, setIsBookmarked] = useState(post.is_bookmarked || false);
  const [currentPage, setCurrentPage] = useState(0);
  const [repostModalVisible, setRepostModalVisible] = useState(false);

  // ダブルタップ検出
  const lastTap = useRef(null);
  const tapTimeout = useRef(null);
  // ハートアニメーション
  const heartScale = useRef(new Animated.Value(0)).current;
  const heartOpacity = useRef(new Animated.Value(0)).current;

  const showHeartAnimation = () => {
    heartScale.setValue(0);
    heartOpacity.setValue(1);
    Animated.sequence([
      Animated.spring(heartScale, {
        toValue: 1.2,
        useNativeDriver: true,
        tension: 60,
        friction: 5,
      }),
      Animated.timing(heartScale, {
        toValue: 1,
        duration: 100,
        useNativeDriver: true,
      }),
      Animated.delay(400),
      Animated.timing(heartOpacity, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const triggerLike = async () => {
    if (!isLiked) {
      showHeartAnimation();
      setIsLiked(true);
      setLikeCount((c) => c + 1);
      try {
        await postAPI.like(post.id);
      } catch {
        setIsLiked(false);
        setLikeCount((c) => Math.max(0, c - 1));
      }
    }
  };

  const handleTap = () => {
    const now = Date.now();
    if (lastTap.current && now - lastTap.current < 350) {
      // ダブルタップ → いいね
      clearTimeout(tapTimeout.current);
      tapTimeout.current = null;
      lastTap.current = null;
      triggerLike();
    } else {
      // 1回目のタップ → 350ms待って遷移
      lastTap.current = now;
      tapTimeout.current = setTimeout(() => {
        tapTimeout.current = null;
        navigation?.navigate('PostDetail', { postId: post.id });
      }, 350);
    }
  };

  const handleLikeButton = async () => {
    if (isLiked) {
      setIsLiked(false);
      setLikeCount((c) => Math.max(0, c - 1));
      try {
        await postAPI.unlike(post.id);
      } catch {
        setIsLiked(true);
        setLikeCount((c) => c + 1);
      }
    } else {
      triggerLike();
    }
  };

  const handleBookmark = async () => {
    const next = !isBookmarked;
    setIsBookmarked(next);
    try {
      if (next) {
        await bookmarkAPI.add(post.id);
      } else {
        await bookmarkAPI.remove(post.id);
      }
    } catch {
      setIsBookmarked(!next);
    }
  };

  const images = post.images || [];
  const pageCount = images.length;
  const bottomPad = TAB_BAR_HEIGHT + insets.bottom + 16;

  return (
    <View style={{ height: ITEM_HEIGHT }}>
    {/* リポストバナー */}
    {post.feed_type === 'repost' && (
      <View style={styles.repostBanner}>
        <Ionicons name="repeat" size={13} color="#aaa" />
        <Text style={styles.repostBannerText}>
          {post.reposter_name || post.reposter_username}さんがリポスト
        </Text>
      </View>
    )}
    <TouchableWithoutFeedback onPress={handleTap}>
      <View style={[styles.postItem, { height: ITEM_HEIGHT }]}>

        {/* ===== 画像ページャー（横スクロール） ===== */}
        {pageCount > 0 ? (
          <FlatList
            data={images}
            keyExtractor={(_, i) => i.toString()}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            scrollEnabled={pageCount > 1}
            style={{ flex: 1 }}
            onMomentumScrollEnd={(e) => {
              const page = Math.round(
                e.nativeEvent.contentOffset.x / SCREEN_WIDTH
              );
              setCurrentPage(page);
            }}
            renderItem={({ item }) => (
              <View style={{ width: SCREEN_WIDTH, height: ITEM_HEIGHT, justifyContent: 'center', alignItems: 'center', backgroundColor: '#000' }}>
                <Image
                  source={{ uri: item.image_url || item }}
                  style={{ width: SCREEN_WIDTH, height: ITEM_HEIGHT }}
                  contentFit="contain"
                />
              </View>
            )}
            getItemLayout={(_, index) => ({
              length: SCREEN_WIDTH,
              offset: SCREEN_WIDTH * index,
              index,
            })}
            removeClippedSubviews
          />
        ) : (
          <View style={styles.noImage}>
            <Ionicons name="image-outline" size={48} color={Colors.muted} />
          </View>
        )}

        {/* ===== ダブルタップ ハートエフェクト ===== */}
        <Animated.View
          pointerEvents="none"
          style={[
            styles.heartOverlay,
            { opacity: heartOpacity, transform: [{ scale: heartScale }] },
          ]}
        >
          <Text style={styles.heartEmoji}>❤️</Text>
        </Animated.View>

        {/* ===== 下部グラデーションオーバーレイ ===== */}
        <LinearGradient
          colors={['transparent', 'rgba(0,0,0,0.55)', 'rgba(0,0,0,0.85)']}
          style={[styles.bottomGradient, { height: 260 + bottomPad }]}
          pointerEvents="none"
        />

        {/* ===== 右サイドバー ===== */}
        <View style={[styles.sidebar, { bottom: bottomPad + 8 }]}>
          {/* いいね */}
          <TouchableOpacity
            style={styles.sideBtn}
            onPress={handleLikeButton}
            activeOpacity={0.7}
          >
            <Ionicons
              name={isLiked ? 'heart' : 'heart-outline'}
              size={32}
              color={isLiked ? '#FF3B5C' : '#FFFFFF'}
            />
            <Text style={styles.sideBtnLabel}>{likeCount}</Text>
          </TouchableOpacity>

          {/* コメント */}
          <TouchableOpacity
            style={styles.sideBtn}
            onPress={() => navigation?.navigate('PostDetail', { postId: post.id })}
            activeOpacity={0.7}
          >
            <Ionicons name="chatbubble-outline" size={30} color="#FFFFFF" />
            <Text style={styles.sideBtnLabel}>{post.comment_count || 0}</Text>
          </TouchableOpacity>

          {/* 保存 */}
          <TouchableOpacity
            style={styles.sideBtn}
            onPress={handleBookmark}
            activeOpacity={0.7}
          >
            <Ionicons
              name={isBookmarked ? 'bookmark' : 'bookmark-outline'}
              size={30}
              color={isBookmarked ? Colors.accent : '#FFFFFF'}
            />
          </TouchableOpacity>

          {/* リポスト */}
          <TouchableOpacity
            style={styles.sideBtn}
            onPress={() => setRepostModalVisible(true)}
            activeOpacity={0.7}
          >
            <Ionicons name="repeat" size={30} color="#FFFFFF" />
          </TouchableOpacity>
        </View>

        {/* ===== 左下 作者・タイトル情報 ===== */}
        <View style={[styles.bottomInfo, { paddingBottom: bottomPad }]}>
          <TouchableOpacity
            style={styles.authorRow}
            activeOpacity={0.8}
            onPress={() => navigation?.navigate('UserProfile', { username: post.creator_username || post.username })}
          >
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>
                {(post.display_name || post.creator_name)?.[0]?.toUpperCase() || '?'}
              </Text>
            </View>
            <Text style={styles.authorName} numberOfLines={1}>
              {post.display_name || post.creator_name || post.username}
            </Text>
          </TouchableOpacity>

          {post.series_title ? (
            <TouchableOpacity
              style={styles.seriesBadge}
              onPress={() => post.series_id && navigation?.navigate('SeriesDetail', { seriesId: post.series_id })}
              activeOpacity={0.8}
            >
              <Ionicons name="book-outline" size={11} color="#FFFFFF" />
              <Text style={styles.seriesBadgeText}> {post.series_title}</Text>
            </TouchableOpacity>
          ) : null}

          <Text style={styles.postTitle} numberOfLines={2}>
            {post.title}
          </Text>

          {post.description ? (
            <Text style={styles.postDesc} numberOfLines={2}>
              {post.description}
            </Text>
          ) : null}
        </View>

        {/* ===== ページインジケーター（縦ドット）===== */}
        {pageCount > 1 && (
          <View style={[styles.pageIndicator, { top: insets.top + 12 }]}>
            {images.map((_, i) => (
              <View
                key={i}
                style={[styles.dot, i === currentPage && styles.dotActive]}
              />
            ))}
          </View>
        )}

        {/* ===== ページ番号バッジ ===== */}
        {pageCount > 1 && (
          <View style={[styles.pageCounter, { top: insets.top + 12 }]}>
            <Text style={styles.pageCounterText}>
              {currentPage + 1} / {pageCount}
            </Text>
          </View>
        )}
      </View>
    </TouchableWithoutFeedback>

    {/* リポストモーダル */}
    <RepostModal
      visible={repostModalVisible}
      onClose={() => setRepostModalVisible(false)}
      repostType="work"
      manga={{
        id: post.series_id ? String(post.series_id) : '',
        title: post.series_title || post.title,
        cover_url: post.thumbnail_url || images[0]?.image_url || '',
      }}
      episodeId={String(post.id)}
    />
    </View>
  );
});

// =====================
// 広告アイテム（フルスクリーン）
// =====================
const AdItem = memo(function AdItem({ ad, itemHeight }) {
  const insets = useSafeAreaInsets();
  const ITEM_HEIGHT = itemHeight > 0 ? itemHeight : SCREEN_HEIGHT;
  return (
    <TouchableOpacity
      style={[styles.container, { height: ITEM_HEIGHT }]}
      activeOpacity={0.95}
      onPress={() => ad.target_url && Linking.openURL(ad.target_url).catch(() => {})}
    >
      {ad.image_url ? (
        <Image source={{ uri: ad.image_url }} style={StyleSheet.absoluteFill} contentFit="cover" />
      ) : (
        <View style={[StyleSheet.absoluteFill, { backgroundColor: Colors.card }]} />
      )}
      <LinearGradient
        colors={['transparent', 'rgba(0,0,0,0.85)']}
        style={[styles.gradient, { height: ITEM_HEIGHT * 0.5 }]}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
      />
      <View style={[styles.bottomInfo, { paddingBottom: insets.bottom + 70 }]}>
        <View style={styles.adBadge}>
          <Text style={styles.adBadgeText}>広告</Text>
        </View>
        <Text style={styles.postTitle} numberOfLines={2}>{ad.title}</Text>
        <Text style={styles.adCta}>タップして詳細を見る →</Text>
      </View>
    </TouchableOpacity>
  );
});

// =====================
// メインスクリーン
// =====================
export default function HomeScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { t } = useLanguage();
  const [posts, setPosts] = useState([]);
  const [ad, setAd] = useState(null);
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const offsetRef = useRef(0);
  const FEED_LIMIT = 10;

  useEffect(() => {
    loadPosts();
    adAPI.getRandom().then(res => setAd(res)).catch(() => {});
  }, []);

  const loadPosts = async () => {
    try {
      setError('');
      offsetRef.current = 0;
      const response = await feedAPI.getFeed({ limit: FEED_LIMIT, offset: 0 });
      const newPosts = response.posts || [];
      setPosts(newPosts);
      setHasMore(newPosts.length === FEED_LIMIT);
      offsetRef.current = newPosts.length;
    } catch (e) {
      console.error('Load posts error:', e);
      setError(t('home.loadError'));
    }
  };

  const loadMorePosts = async () => {
    if (loadingMore || !hasMore) return;
    try {
      setLoadingMore(true);
      const response = await feedAPI.getFeed({ limit: FEED_LIMIT, offset: offsetRef.current });
      const newPosts = response.posts || [];
      if (newPosts.length > 0) {
        setPosts(prev => [...prev, ...newPosts]);
        offsetRef.current += newPosts.length;
      }
      setHasMore(newPosts.length === FEED_LIMIT);
    } catch (e) {
      console.error('Load more posts error:', e);
    } finally {
      setLoadingMore(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadPosts();
    setRefreshing(false);
  };

  // 5投稿ごとに広告を挿入
  const feedItems = (() => {
    if (!ad || posts.length === 0) return posts;
    const result = [...posts];
    result.splice(4, 0, { ...ad, _isAd: true, id: `ad_${ad.id}` });
    return result;
  })();

  const renderItem = useCallback(
    ({ item }) => item._isAd
      ? <AdItem ad={item} itemHeight={SCREEN_HEIGHT} />
      : <PostItem post={item} navigation={navigation} itemHeight={SCREEN_HEIGHT} />,
    [navigation, ad]
  );

  const getItemLayout = useCallback(
    (_, index) => ({
      length: SCREEN_HEIGHT,
      offset: SCREEN_HEIGHT * index,
      index,
    }),
    []
  );

  const feedItemsRef = useRef(feedItems);
  useEffect(() => { feedItemsRef.current = feedItems; }, [feedItems]);

  const viewabilityConfig = useRef({ itemVisiblePercentThreshold: 80 });
  const onViewableItemsChanged = useRef(({ viewableItems }) => {
    const visibleIndex = viewableItems[0]?.index ?? 0;
    // 次の1〜2投稿の画像をプリフェッチ
    [visibleIndex + 1, visibleIndex + 2].forEach((nextIdx) => {
      const nextItem = feedItemsRef.current[nextIdx];
      if (!nextItem || nextItem._isAd) return;
      (nextItem.images || []).forEach((img) => {
        const url = img?.image_url || img;
        if (url) Image.prefetch(url);
      });
    });
  });

  if (error && posts.length === 0) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.emptyState}>
          <Text style={styles.emptyIcon}>📡</Text>
          <Text style={styles.emptyTitle}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={loadPosts}>
            <Text style={styles.retryText}>再試行</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={feedItems}
        keyExtractor={(item) => String(item.id)}
        renderItem={renderItem}
        pagingEnabled
        showsVerticalScrollIndicator={false}
        decelerationRate="fast"
        style={{ flex: 1 }}
        getItemLayout={getItemLayout}
        onViewableItemsChanged={onViewableItemsChanged.current}
        viewabilityConfig={viewabilityConfig.current}
        // パフォーマンス設定
        initialNumToRender={2}
        maxToRenderPerBatch={3}
        windowSize={5}
        removeClippedSubviews
        onRefresh={handleRefresh}
        refreshing={refreshing}
        onEndReached={loadMorePosts}
        onEndReachedThreshold={0.5}
      />
      {/* 検索ボタン（フローティング） */}
      <TouchableOpacity
        style={[styles.searchFab, { top: insets.top + 12 }]}
        onPress={() => navigation?.navigate('Search')}
        activeOpacity={0.8}
      >
        <Ionicons name="search-outline" size={22} color="#fff" />
      </TouchableOpacity>
    </View>
  );
}

// =====================
// スタイル
// =====================
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  searchFab: {
    position: 'absolute',
    right: 16,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // ---- 投稿アイテム ----
  postItem: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
    backgroundColor: '#000',
  },
  pageImage: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
    backgroundColor: '#000',
  },
  noImage: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#111',
  },

  // ---- ハートエフェクト ----
  heartOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
  },
  heartEmoji: {
    fontSize: 100,
  },

  // ---- グラデーション ----
  bottomGradient: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
  },

  // ---- 右サイドバー ----
  sidebar: {
    position: 'absolute',
    right: 12,
    alignItems: 'center',
  },
  repostBanner: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 14,
    paddingVertical: 5,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  repostBannerText: {
    color: '#aaa',
    fontSize: 12,
  },
  sideBtn: {
    alignItems: 'center',
    marginBottom: 20,
  },
  sideBtnLabel: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
    marginTop: 3,
    textShadowColor: 'rgba(0,0,0,0.9)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },

  // ---- 下部情報 ----
  bottomInfo: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 72,
    paddingHorizontal: 16,
    paddingTop: 20,
  },
  authorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
    marginRight: 10,
  },
  avatarText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: 'bold',
  },
  authorName: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
    textShadowColor: 'rgba(0,0,0,0.9)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
    flex: 1,
  },
  seriesBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(37,99,235,0.85)',
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 10,
    marginBottom: 6,
  },
  seriesBadgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '600',
  },
  postTitle: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 4,
    textShadowColor: 'rgba(0,0,0,0.9)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  postDesc: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 13,
    lineHeight: 18,
    textShadowColor: 'rgba(0,0,0,0.9)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },

  // ---- ページインジケーター ----
  pageIndicator: {
    position: 'absolute',
    right: 10,
    alignItems: 'center',
  },
  dot: {
    width: 3,
    height: 3,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.4)',
    marginBottom: 3,
  },
  dotActive: {
    height: 14,
    backgroundColor: '#FFFFFF',
  },
  pageCounter: {
    position: 'absolute',
    left: 16,
    backgroundColor: 'rgba(0,0,0,0.55)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  pageCounterText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },

  // ---- エラー / 空 ----
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  emptyTitle: {
    color: Colors.muted,
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 24,
  },
  retryButton: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 32,
    paddingVertical: 12,
    borderRadius: 24,
  },
  retryText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
  },
  adBadge: {
    backgroundColor: 'rgba(255,255,255,0.25)',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    alignSelf: 'flex-start',
    marginBottom: 8,
  },
  adBadgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
  adCta: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 13,
    marginTop: 6,
  },
});
