import { useState, useEffect, useRef, useCallback, memo } from 'react';
import {
  View,
  Text,
  FlatList,
  Image,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  Animated,
  TouchableWithoutFeedback,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { feedAPI, postAPI, bookmarkAPI } from '../api/client';
import { useLanguage } from '../context/LanguageContext';
import { Colors } from '../theme/colors';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const TAB_BAR_HEIGHT = 60;

// =====================
// 単一投稿フルスクリーンアイテム
// =====================
const PostItem = memo(function PostItem({ post, navigation }) {
  const insets = useSafeAreaInsets();
  const [isLiked, setIsLiked] = useState(post.is_liked || false);
  const [likeCount, setLikeCount] = useState(post.like_count || 0);
  const [isBookmarked, setIsBookmarked] = useState(post.is_bookmarked || false);
  const [currentPage, setCurrentPage] = useState(0);

  // ダブルタップ検出
  const lastTap = useRef(null);
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
      triggerLike();
      lastTap.current = null;
    } else {
      lastTap.current = now;
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
    <TouchableWithoutFeedback onPress={handleTap}>
      <View style={styles.postItem}>

        {/* ===== 画像ページャー（横スクロール） ===== */}
        {pageCount > 0 ? (
          <FlatList
            data={images}
            keyExtractor={(_, i) => i.toString()}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            scrollEnabled={pageCount > 1}
            onMomentumScrollEnd={(e) => {
              const page = Math.round(
                e.nativeEvent.contentOffset.x / SCREEN_WIDTH
              );
              setCurrentPage(page);
            }}
            renderItem={({ item }) => (
              <Image
                source={{ uri: item.image_url || item }}
                style={styles.pageImage}
                resizeMode="contain"
              />
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
        </View>

        {/* ===== 左下 作者・タイトル情報 ===== */}
        <View style={[styles.bottomInfo, { paddingBottom: bottomPad }]}>
          <View style={styles.authorRow}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>
                {(post.display_name || post.creator_name)?.[0]?.toUpperCase() || '?'}
              </Text>
            </View>
            <Text style={styles.authorName} numberOfLines={1}>
              {post.display_name || post.creator_name || post.username}
            </Text>
          </View>

          {post.series_title ? (
            <View style={styles.seriesBadge}>
              <Ionicons name="book-outline" size={11} color="#FFFFFF" />
              <Text style={styles.seriesBadgeText}> {post.series_title}</Text>
            </View>
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
  );
});

// =====================
// メインスクリーン
// =====================
export default function HomeScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { t } = useLanguage();
  const [posts, setPosts] = useState([]);
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadPosts();
  }, []);

  const loadPosts = async () => {
    try {
      setError('');
      const response = await feedAPI.getFeed();
      setPosts(response.posts || []);
    } catch (e) {
      console.error('Load posts error:', e);
      setError(t('home.loadError'));
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadPosts();
    setRefreshing(false);
  };

  const renderItem = useCallback(
    ({ item }) => <PostItem post={item} navigation={navigation} />,
    [navigation]
  );

  const getItemLayout = useCallback(
    (_, index) => ({
      length: SCREEN_HEIGHT,
      offset: SCREEN_HEIGHT * index,
      index,
    }),
    []
  );

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
        data={posts}
        keyExtractor={(item) => item.id.toString()}
        renderItem={renderItem}
        pagingEnabled
        showsVerticalScrollIndicator={false}
        decelerationRate="fast"
        getItemLayout={getItemLayout}
        // パフォーマンス設定
        initialNumToRender={2}
        maxToRenderPerBatch={3}
        windowSize={5}          // 前後2投稿をプリロード
        removeClippedSubviews
        // プルリフレッシュ
        onRefresh={handleRefresh}
        refreshing={refreshing}
      />
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
});
