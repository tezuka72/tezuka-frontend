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
  Platform,
  Modal,
  ScrollView,
  TextInput,
  KeyboardAvoidingView,
} from 'react-native';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { feedAPI, postAPI, bookmarkAPI, adAPI } from '../api/client';
import RepostModal from '../components/repost/RepostModal';
import { useLanguage } from '../context/LanguageContext';
import { Colors } from '../theme/colors';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const HEADER_HEIGHT = 52;
const TAB_BAR_HEIGHT = 60;
const AUTHOR_H = 70;
const FOOTER_H = 120;
const REPOST_H = 36;
const CARD_H_PADDING = 16; // カード上下の余白（前後カードが少し見える）

function formatCount(n) {
  if (n >= 10000) return `${(n / 10000).toFixed(1)}万`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return String(n || 0);
}

// =====================
// 投稿カード（1画面1枚・スナップ）
// =====================
const PostItem = memo(function PostItem({ post, navigation, itemHeight }) {
  const [isLiked, setIsLiked] = useState(post.is_liked || false);
  const [likeCount, setLikeCount] = useState(post.like_count || 0);
  const [isBookmarked, setIsBookmarked] = useState(post.is_bookmarked || false);
  const [repostModalVisible, setRepostModalVisible] = useState(false);

  const [commentVisible, setCommentVisible] = useState(false);
  const [comments, setComments] = useState([]);
  const [commentText, setCommentText] = useState('');
  const [replyingTo, setReplyingTo] = useState(null);
  const [commentCount, setCommentCount] = useState(post.comment_count || 0);
  const slideAnim = useRef(new Animated.Value(0)).current;

  const openComments = () => {
    setCommentVisible(true);
    loadComments();
    Animated.spring(slideAnim, { toValue: 1, useNativeDriver: true, tension: 65, friction: 11 }).start();
  };

  const closeComments = () => {
    Animated.timing(slideAnim, { toValue: 0, duration: 250, useNativeDriver: true }).start(() => setCommentVisible(false));
  };

  const loadComments = async () => {
    try {
      const response = await postAPI.getComments(post.id);
      setComments(response.comments || []);
    } catch (e) {}
  };

  const handleComment = async () => {
    if (!commentText.trim()) return;
    try {
      await postAPI.addComment(post.id, commentText, replyingTo?.id || null);
      setCommentText('');
      setReplyingTo(null);
      setCommentCount(c => c + 1);
      loadComments();
    } catch (e) {}
  };

  const renderComment = (comment) => (
    <View key={comment.id} style={styles.comment}>
      <Text style={styles.commentUser}>{comment.display_name || comment.username}</Text>
      <Text style={styles.commentText}>{comment.content}</Text>
      <TouchableOpacity style={styles.replyBtn} onPress={() => setReplyingTo({ id: comment.id, username: comment.username })}>
        <Text style={styles.replyBtnText}>返信</Text>
      </TouchableOpacity>
    </View>
  );

  const lastTap = useRef(null);
  const tapTimeout = useRef(null);
  const heartScale = useRef(new Animated.Value(0)).current;
  const heartOpacity = useRef(new Animated.Value(0)).current;

  const showHeartAnimation = () => {
    heartScale.setValue(0);
    heartOpacity.setValue(1);
    Animated.sequence([
      Animated.spring(heartScale, { toValue: 1.2, useNativeDriver: true, tension: 60, friction: 5 }),
      Animated.timing(heartScale, { toValue: 1, duration: 100, useNativeDriver: true }),
      Animated.delay(400),
      Animated.timing(heartOpacity, { toValue: 0, duration: 300, useNativeDriver: true }),
    ]).start();
  };

  const triggerLike = async () => {
    if (!isLiked) {
      showHeartAnimation();
      setIsLiked(true);
      setLikeCount((c) => c + 1);
      try { await postAPI.like(post.id); } catch {
        setIsLiked(false); setLikeCount((c) => Math.max(0, c - 1));
      }
    }
  };

  const handleTap = () => {
    const now = Date.now();
    if (lastTap.current && now - lastTap.current < 350) {
      clearTimeout(tapTimeout.current);
      tapTimeout.current = null;
      lastTap.current = null;
      triggerLike();
    } else {
      lastTap.current = now;
      tapTimeout.current = setTimeout(() => {
        tapTimeout.current = null;
        navigation?.navigate('PostDetail', { postId: post.id });
      }, 350);
    }
  };

  const handleLikeButton = async () => {
    if (isLiked) {
      setIsLiked(false); setLikeCount((c) => Math.max(0, c - 1));
      try { await postAPI.unlike(post.id); } catch { setIsLiked(true); setLikeCount((c) => c + 1); }
    } else { triggerLike(); }
  };

  const handleBookmark = async () => {
    const next = !isBookmarked;
    setIsBookmarked(next);
    try {
      if (next) { await bookmarkAPI.add(post.id); } else { await bookmarkAPI.remove(post.id); }
    } catch { setIsBookmarked(!next); }
  };

  const images = post.images || [];
  const thumbUri = images[0]?.image_url || images[0] || post.thumbnail_url;
  const pageCount = parseInt(post.total_images) || images.length || 0;
  const avatarUri = post.avatar_url;

  // カードの実高さ = ページ高さ - 上下余白
  const cardHeight = itemHeight - CARD_H_PADDING;

  return (
    // ページ区切り用コンテナ（透明・itemHeight と同じ高さ）
    <View style={{ height: itemHeight, paddingHorizontal: 12, paddingTop: CARD_H_PADDING / 2, paddingBottom: CARD_H_PADDING / 2 }}>
      <View style={[styles.card, { height: cardHeight }]}>

        {/* ─── リポストバナー ─── */}
        {post.feed_type === 'repost' && (
          <TouchableOpacity
            style={styles.repostBanner}
            activeOpacity={0.7}
            onPress={() => navigation?.navigate('UserProfile', { username: post.reposter_username })}
          >
            <Ionicons name="repeat" size={13} color={Colors.primary} />
            <Text style={styles.repostBannerText}>
              {' '}{post.reposter_name || post.reposter_username}さんがリポスト
            </Text>
          </TouchableOpacity>
        )}

        {/* ─── 作者情報（上部） ─── */}
        <TouchableOpacity
          style={styles.authorSection}
          onPress={() => navigation?.navigate('UserProfile', { username: post.creator_username || post.username })}
          activeOpacity={0.8}
        >
          <View style={styles.authorAvatarWrap}>
            {avatarUri ? (
              <Image
                source={{ uri: avatarUri }}
                style={styles.authorAvatarImg}
                contentFit="cover"
                cachePolicy="memory-disk"
              />
            ) : (
              <View style={styles.authorAvatarFallback}>
                <Text style={styles.authorAvatarText}>
                  {(post.creator_name || post.display_name || '?')[0].toUpperCase()}
                </Text>
              </View>
            )}
          </View>
          <View style={styles.authorInfo}>
            <View style={styles.authorNameRow}>
              <Text style={styles.authorDisplayName} numberOfLines={1}>
                {post.creator_name || post.display_name || post.username}
              </Text>
              {post.is_verified && (
                <Ionicons name="checkmark-circle" size={14} color={Colors.primary} style={{ marginLeft: 3 }} />
              )}
            </View>
            <Text style={styles.authorUsername} numberOfLines={1}>
              @{post.creator_username || post.username}
            </Text>
          </View>
          {post.series_title && (
            <View style={styles.seriesPill}>
              <Ionicons name="book-outline" size={11} color={Colors.primary} />
              <Text style={styles.seriesPillText} numberOfLines={1}> {post.series_title}</Text>
            </View>
          )}
        </TouchableOpacity>

        {/* ─── サムネイル画像（残り全空間を使う） ─── */}
        <TouchableWithoutFeedback onPress={handleTap}>
          <View style={styles.imageWrap}>
            {thumbUri ? (
              <Image
                source={{ uri: thumbUri }}
                style={StyleSheet.absoluteFill}
                contentFit="cover"
                transition={80}
                placeholder={{ color: Colors.border }}
                cachePolicy="memory-disk"
                priority="high"
              />
            ) : (
              <View style={[StyleSheet.absoluteFill, styles.imagePlaceholder]}>
                <Ionicons name="image-outline" size={48} color={Colors.muted} />
              </View>
            )}
            <Animated.View
              pointerEvents="none"
              style={[StyleSheet.absoluteFill, styles.heartOverlay, { opacity: heartOpacity, transform: [{ scale: heartScale }] }]}
            >
              <Text style={styles.heartEmoji}>❤️</Text>
            </Animated.View>
            {pageCount > 1 && (
              <View style={styles.pageBadge}>
                <Ionicons name="images-outline" size={11} color="#fff" />
                <Text style={styles.pageBadgeText}> {pageCount}P</Text>
              </View>
            )}
          </View>
        </TouchableWithoutFeedback>

        {/* ─── フッター（タイトル → 説明 → アクション） ─── */}
        <View style={styles.footer}>
          <TouchableOpacity onPress={() => navigation?.navigate('PostDetail', { postId: post.id })} activeOpacity={0.85}>
            <Text style={styles.postTitle} numberOfLines={2}>{post.title}</Text>
          </TouchableOpacity>
          {post.description ? (
            <Text style={styles.postDesc} numberOfLines={1}>{post.description}</Text>
          ) : null}
          <View style={styles.actionBar}>
            {/* ❤ いいね — 思考バブル（雲形） */}
            <TouchableOpacity style={styles.mangaBtn} onPress={handleLikeButton} activeOpacity={0.7}>
              <View style={[styles.cloudBubble, isLiked && styles.cloudBubbleActive]}>
                <Text style={[styles.cloudIcon, isLiked && { color: '#FF3B5C' }]}>{isLiked ? '❤' : '♡'}</Text>
              </View>
              <Text style={[styles.mangaCount, isLiked && { color: '#FF3B5C' }]}>{formatCount(likeCount)}</Text>
            </TouchableOpacity>

            {/* 💬 コメント — スターバースト */}
            <TouchableOpacity style={styles.mangaBtn} onPress={openComments} activeOpacity={0.7}>
              <View style={styles.burstWrap}>
                <View style={[StyleSheet.absoluteFillObject, styles.burstCenter]}>
                  <View style={styles.burst1} />
                </View>
                <View style={[StyleSheet.absoluteFillObject, styles.burstCenter]}>
                  <View style={styles.burst2} />
                </View>
                <Text style={styles.bangText}>!!</Text>
              </View>
              <Text style={styles.mangaCount}>{formatCount(commentCount)}</Text>
            </TouchableOpacity>

            {/* 🔖 ブックマーク — 短冊＋ハッチング */}
            <TouchableOpacity style={styles.mangaBtn} onPress={handleBookmark} activeOpacity={0.7}>
              <View style={[styles.ribbon, isBookmarked && styles.ribbonActive]}>
                <View style={[styles.hatchLine, isBookmarked && { backgroundColor: Colors.accent }]} />
                <View style={[styles.hatchLine, isBookmarked && { backgroundColor: Colors.accent }]} />
                <View style={[styles.hatchLine, isBookmarked && { backgroundColor: Colors.accent }]} />
              </View>
            </TouchableOpacity>

            {/* 🔁 リポスト — 傾きフレーム */}
            <TouchableOpacity style={styles.mangaBtn} onPress={() => setRepostModalVisible(true)} activeOpacity={0.7}>
              <View style={styles.repostFrame}>
                <Ionicons name="repeat" size={15} color={Colors.foreground} />
              </View>
            </TouchableOpacity>

            <Text style={styles.starAccent}>★</Text>
            <View style={styles.actionSpacer} />
            <View style={styles.viewRow}>
              <Ionicons name="eye-outline" size={13} color={Colors.muted} />
              <Text style={styles.viewCount}>{formatCount(post.view_count)}</Text>
            </View>
          </View>
        </View>

      </View>

      <RepostModal
        visible={repostModalVisible}
        onClose={() => setRepostModalVisible(false)}
        repostType="work"
        manga={{
          id: post.series_id ? String(post.series_id) : '',
          title: post.series_title || post.title,
          cover_url: post.thumbnail_url || thumbUri || '',
        }}
        episodeId={String(post.id)}
      />

      {/* ─── コメントボトムシート ─── */}
      <Modal visible={commentVisible} transparent animationType="none" onRequestClose={closeComments}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
          <TouchableWithoutFeedback onPress={closeComments}>
            <View style={styles.modalOverlay} />
          </TouchableWithoutFeedback>
          <Animated.View style={[styles.commentsPanel, {
            transform: [{
              translateY: slideAnim.interpolate({ inputRange: [0, 1], outputRange: [SCREEN_HEIGHT * 0.6, 0] })
            }]
          }]}>
            <View style={styles.commentsPanelHandle}>
              <View style={styles.handleBarWrapper}>
                <View style={styles.handleBar} />
              </View>
              <View style={styles.commentsPanelTitleRow}>
                <Text style={styles.commentsPanelTitle}>
                  💬 コメント {comments.length > 0 ? `(${comments.length})` : ''}
                </Text>
                <TouchableOpacity onPress={closeComments} style={styles.closeBtn}>
                  <Ionicons name="close" size={20} color={Colors.muted} />
                </TouchableOpacity>
              </View>
            </View>
            <ScrollView style={styles.commentsScroll} keyboardShouldPersistTaps="handled">
              {comments.length === 0 ? (
                <Text style={styles.noComments}>まだコメントはありません</Text>
              ) : (
                comments.map(renderComment)
              )}
            </ScrollView>
            {replyingTo && (
              <View style={styles.replyingBar}>
                <Text style={styles.replyingText}>@{replyingTo.username} に返信中</Text>
                <TouchableOpacity onPress={() => setReplyingTo(null)}>
                  <Ionicons name="close" size={16} color={Colors.muted} />
                </TouchableOpacity>
              </View>
            )}
            <View style={styles.commentInput}>
              <TextInput
                style={styles.input}
                placeholder={replyingTo ? `@${replyingTo.username} への返信...` : 'コメントを入力...'}
                placeholderTextColor={Colors.muted}
                value={commentText}
                onChangeText={setCommentText}
              />
              <TouchableOpacity style={styles.sendButton} onPress={handleComment}>
                <Text style={styles.sendButtonText}>送信</Text>
              </TouchableOpacity>
            </View>
          </Animated.View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
});

// =====================
// 広告カード
// =====================
const AdItem = memo(function AdItem({ ad, itemHeight }) {
  const cardHeight = itemHeight - CARD_H_PADDING;
  return (
    <TouchableOpacity
      style={{ height: itemHeight, paddingHorizontal: 12, paddingTop: CARD_H_PADDING / 2, paddingBottom: CARD_H_PADDING / 2 }}
      activeOpacity={0.95}
      onPress={() => ad.target_url && Linking.openURL(ad.target_url).catch(() => {})}
    >
      <View style={[styles.card, { height: cardHeight }]}>
        <View style={styles.adBanner}>
          <Text style={styles.adBannerText}>スポンサード</Text>
        </View>
        <View style={styles.imageWrap}>
          {ad.image_url ? (
            <Image source={{ uri: ad.image_url }} style={StyleSheet.absoluteFill} contentFit="cover" cachePolicy="memory-disk" />
          ) : (
            <View style={[StyleSheet.absoluteFill, styles.imagePlaceholder]} />
          )}
        </View>
        <View style={styles.footer}>
          <Text style={styles.postTitle} numberOfLines={2}>{ad.title}</Text>
          <Text style={styles.postDesc}>タップして詳細を見る →</Text>
        </View>
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
  const [activeTab, setActiveTab] = useState('recommend');
  const [listHeight, setListHeight] = useState(0);

  const [posts, setPosts] = useState([]);
  const [ad, setAd] = useState(null);
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const offsetRef = useRef(0);

  const [followingPosts, setFollowingPosts] = useState([]);
  const [followingRefreshing, setFollowingRefreshing] = useState(false);
  const [followingLoadingMore, setFollowingLoadingMore] = useState(false);
  const [followingHasMore, setFollowingHasMore] = useState(true);
  const [followingLoaded, setFollowingLoaded] = useState(false);
  const followingOffsetRef = useRef(0);

  const FEED_LIMIT = 10;
  const WEB_OFFSET = Platform.OS === 'web' ? TAB_BAR_HEIGHT : 0;
  const itemHeight = listHeight > 0
    ? listHeight - WEB_OFFSET
    : SCREEN_HEIGHT - insets.top - HEADER_HEIGHT - TAB_BAR_HEIGHT - insets.bottom;

  useEffect(() => {
    loadPosts();
    adAPI.getRandom().then(res => setAd(res)).catch(() => {});
  }, []);

  useEffect(() => {
    if (activeTab === 'following' && !followingLoaded) loadFollowingPosts();
  }, [activeTab]);

  const loadPosts = async () => {
    try {
      setError('');
      offsetRef.current = 0;
      const response = await feedAPI.getFeed({ limit: FEED_LIMIT, offset: 0 });
      const newPosts = response.posts || [];
      setPosts(newPosts);
      setHasMore(newPosts.length === FEED_LIMIT);
      offsetRef.current = newPosts.length;
      newPosts.slice(0, 3).forEach((p) => {
        const url = p.images?.[0]?.image_url || p.thumbnail_url;
        if (url) Image.prefetch(url);
      });
    } catch (e) {
      setError(t('home.loadError'));
    }
  };

  const loadMorePosts = async () => {
    if (loadingMore || !hasMore) return;
    try {
      setLoadingMore(true);
      const response = await feedAPI.getFeed({ limit: FEED_LIMIT, offset: offsetRef.current });
      const newPosts = response.posts || [];
      if (newPosts.length > 0) { setPosts(prev => [...prev, ...newPosts]); offsetRef.current += newPosts.length; }
      setHasMore(newPosts.length === FEED_LIMIT);
    } catch (e) {} finally { setLoadingMore(false); }
  };

  const loadFollowingPosts = async () => {
    try {
      followingOffsetRef.current = 0;
      const response = await feedAPI.getFollowingFeed({ limit: FEED_LIMIT, offset: 0 });
      const newPosts = response.posts || [];
      setFollowingPosts(newPosts);
      setFollowingHasMore(newPosts.length === FEED_LIMIT);
      followingOffsetRef.current = newPosts.length;
      setFollowingLoaded(true);
    } catch (e) { setFollowingLoaded(true); }
  };

  const loadMoreFollowingPosts = async () => {
    if (followingLoadingMore || !followingHasMore) return;
    try {
      setFollowingLoadingMore(true);
      const response = await feedAPI.getFollowingFeed({ limit: FEED_LIMIT, offset: followingOffsetRef.current });
      const newPosts = response.posts || [];
      if (newPosts.length > 0) { setFollowingPosts(prev => [...prev, ...newPosts]); followingOffsetRef.current += newPosts.length; }
      setFollowingHasMore(newPosts.length === FEED_LIMIT);
    } catch (e) {} finally { setFollowingLoadingMore(false); }
  };

  const handleRefresh = async () => { setRefreshing(true); await loadPosts(); setRefreshing(false); };
  const handleFollowingRefresh = async () => { setFollowingRefreshing(true); await loadFollowingPosts(); setFollowingRefreshing(false); };

  const feedItems = (() => {
    if (!ad || posts.length === 0) return posts;
    const result = [...posts];
    result.splice(4, 0, { ...ad, _isAd: true, id: `ad_${ad.id}` });
    return result;
  })();

  const renderItem = useCallback(
    ({ item }) => item._isAd
      ? <AdItem ad={item} itemHeight={itemHeight} />
      : <PostItem post={item} navigation={navigation} itemHeight={itemHeight} />,
    [navigation, itemHeight]
  );

  const renderFollowingItem = useCallback(
    ({ item }) => <PostItem post={item} navigation={navigation} itemHeight={itemHeight} />,
    [navigation, itemHeight]
  );

  const getItemLayout = useCallback(
    (_, index) => ({ length: itemHeight, offset: itemHeight * index, index }),
    [itemHeight]
  );

  if (error && posts.length === 0) {
    return (
      <View style={[styles.screen, { paddingTop: insets.top }]}>
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
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      {/* ヘッダー */}
      <View style={styles.header}>
        <View style={styles.tabs}>
          <TouchableOpacity style={styles.tabBtn} onPress={() => setActiveTab('recommend')} activeOpacity={0.8}>
            <Text style={[styles.tabText, activeTab === 'recommend' && styles.tabTextActive]}>発見</Text>
            {activeTab === 'recommend' && <View style={styles.tabUnderline} />}
          </TouchableOpacity>
          <TouchableOpacity style={styles.tabBtn} onPress={() => setActiveTab('following')} activeOpacity={0.8}>
            <Text style={[styles.tabText, activeTab === 'following' && styles.tabTextActive]}>フォロー</Text>
            {activeTab === 'following' && <View style={styles.tabUnderline} />}
          </TouchableOpacity>
        </View>
        <TouchableOpacity style={styles.searchBtn} onPress={() => navigation?.navigate('Search')} activeOpacity={0.8}>
          <Ionicons name="search-outline" size={22} color={Colors.foreground} />
        </TouchableOpacity>
      </View>

      {/* フィード */}
      <View
        style={{ flex: 1 }}
        onLayout={(e) => setListHeight(e.nativeEvent.layout.height)}
      >
        {activeTab === 'recommend' && itemHeight > 0 && (
          <FlatList
            data={feedItems}
            keyExtractor={(item) => String(item.id)}
            renderItem={renderItem}
            pagingEnabled
            showsVerticalScrollIndicator={false}
            decelerationRate="fast"
            getItemLayout={getItemLayout}
            initialNumToRender={1}
            maxToRenderPerBatch={2}
            windowSize={3}
            removeClippedSubviews
            onRefresh={handleRefresh}
            refreshing={refreshing}
            onEndReached={loadMorePosts}
            onEndReachedThreshold={0.5}
            style={{ height: itemHeight, flex: undefined }}
          />
        )}

        {activeTab === 'following' && (
          followingPosts.length === 0 && followingLoaded ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyIcon}>📖</Text>
              <Text style={styles.emptyTitle}>フォロー中のユーザーの投稿がまだありません</Text>
            </View>
          ) : itemHeight > 0 ? (
            <FlatList
              data={followingPosts}
              keyExtractor={(item) => `f_${item.id}`}
              renderItem={renderFollowingItem}
              pagingEnabled
              showsVerticalScrollIndicator={false}
              decelerationRate="fast"
              getItemLayout={getItemLayout}
              initialNumToRender={1}
              maxToRenderPerBatch={2}
              windowSize={3}
              removeClippedSubviews
              onRefresh={handleFollowingRefresh}
              refreshing={followingRefreshing}
              onEndReached={loadMoreFollowingPosts}
              onEndReachedThreshold={0.5}
              style={{ height: itemHeight, flex: undefined }}
            />
          ) : null
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: Colors.background,
  },

  // ---- ヘッダー ----
  header: {
    height: HEADER_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    backgroundColor: Colors.background,
  },
  tabs: {
    flex: 1,
    flexDirection: 'row',
    gap: 20,
  },
  tabBtn: {
    alignItems: 'center',
    paddingBottom: 2,
  },
  tabText: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.muted,
  },
  tabTextActive: {
    color: Colors.foreground,
  },
  tabUnderline: {
    height: 2,
    width: '100%',
    backgroundColor: Colors.primary,
    borderRadius: 2,
    marginTop: 3,
  },
  searchBtn: {
    padding: 4,
  },

  // ---- 作品カード（角丸・左右余白） ----
  card: {
    flex: 1,
    borderRadius: 16,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
    flexDirection: 'column',
  },

  // リポストバナー
  repostBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 7,
    backgroundColor: Colors.background,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    height: REPOST_H,
  },
  repostBannerText: {
    color: Colors.primary,
    fontSize: 12,
    fontWeight: '500',
  },

  // 広告バナー
  adBanner: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    backgroundColor: Colors.background,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    alignItems: 'flex-end',
  },
  adBannerText: {
    color: Colors.muted,
    fontSize: 11,
    fontWeight: '500',
    letterSpacing: 0.5,
  },

  // ---- 作者セクション（固定高） ----
  authorSection: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 10,
    height: AUTHOR_H,
  },
  authorAvatarWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    overflow: 'hidden',
  },
  authorAvatarImg: {
    width: 44,
    height: 44,
    borderRadius: 22,
  },
  authorAvatarFallback: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  authorAvatarText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '800',
  },
  authorInfo: {
    flex: 1,
  },
  authorNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  authorDisplayName: {
    color: Colors.foreground,
    fontSize: 14,
    fontWeight: '700',
  },
  authorUsername: {
    color: Colors.muted,
    fontSize: 12,
    marginTop: 1,
  },
  seriesPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.border,
    borderRadius: 10,
    paddingHorizontal: 9,
    paddingVertical: 4,
    maxWidth: 120,
  },
  seriesPillText: {
    color: Colors.primary,
    fontSize: 11,
    fontWeight: '600',
  },

  // ---- 画像エリア（flex:1 で残りを全部使う） ----
  imageWrap: {
    flex: 1,
    backgroundColor: Colors.border,
    overflow: 'hidden',
  },
  imagePlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  heartOverlay: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  heartEmoji: {
    fontSize: 90,
  },
  pageBadge: {
    position: 'absolute',
    top: 10,
    right: 10,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
  },
  pageBadgeText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '600',
  },

  // ---- フッター（固定高・タイトル→説明→アクション） ----
  footer: {
    height: FOOTER_H,
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 10,
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  postTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.foreground,
    lineHeight: 21,
  },
  postDesc: {
    fontSize: 13,
    color: Colors.muted,
    lineHeight: 18,
    flex: 1,
    marginTop: 2,
  },
  actionBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },

  // ── マンガ風アクションボタン共通 ──
  mangaBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginRight: 12,
  },
  mangaCount: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.muted,
  },

  // ❤ 思考バブル（雲形いいね）
  cloudBubble: {
    width: 40,
    height: 34,
    borderWidth: 3,
    borderColor: Colors.foreground,
    borderRadius: 18,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 13,
    borderBottomLeftRadius: 13,
    borderBottomRightRadius: 21,
    backgroundColor: '#FEFCE8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cloudBubbleActive: {
    borderColor: '#FF3B5C',
    backgroundColor: '#FFF0F3',
  },
  cloudIcon: {
    fontSize: 17,
    lineHeight: 21,
    color: Colors.foreground,
  },

  // !! スターバースト（爆発吹き出しコメント）
  burstWrap: {
    width: 42,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
  },
  burstCenter: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  burst1: {
    width: 30,
    height: 30,
    borderWidth: 3,
    borderColor: Colors.foreground,
    backgroundColor: '#FEFCE8',
    borderRadius: 3,
  },
  burst2: {
    width: 30,
    height: 30,
    borderWidth: 3,
    borderColor: Colors.foreground,
    backgroundColor: '#FEFCE8',
    borderRadius: 3,
    transform: [{ rotate: '45deg' }],
  },
  bangText: {
    fontSize: 13,
    fontWeight: '900',
    color: Colors.foreground,
    letterSpacing: -2,
    zIndex: 3,
  },

  // 🔖 短冊ブックマーク＋ハッチング
  ribbon: {
    width: 26,
    height: 36,
    borderWidth: 3,
    borderColor: Colors.foreground,
    borderTopLeftRadius: 4,
    borderTopRightRadius: 4,
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
    backgroundColor: '#FEFCE8',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 2,
  },
  ribbonActive: {
    borderColor: Colors.accent,
    backgroundColor: Colors.accent + '18',
  },
  hatchLine: {
    width: 13,
    height: 2,
    backgroundColor: Colors.foreground,
    borderRadius: 1,
  },

  // 🔁 傾きフレームリポスト
  repostFrame: {
    width: 36,
    height: 30,
    borderWidth: 3,
    borderColor: Colors.foreground,
    borderRadius: 5,
    borderTopRightRadius: 13,
    borderBottomLeftRadius: 13,
    backgroundColor: '#FEFCE8',
    alignItems: 'center',
    justifyContent: 'center',
    transform: [{ rotate: '3deg' }],
  },

  // 装飾
  starAccent: {
    fontSize: 11,
    color: Colors.muted,
    marginLeft: 2,
    marginTop: -6,
  },

  actionSpacer: {
    flex: 1,
  },
  viewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  viewCount: {
    color: Colors.muted,
    fontSize: 12,
  },

  // ---- コメントシート ----
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  commentsPanel: {
    height: SCREEN_HEIGHT * 0.6,
    backgroundColor: Colors.card,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  commentsPanelHandle: {
    paddingTop: 10,
    paddingBottom: 8,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  handleBarWrapper: {
    alignItems: 'center',
    marginBottom: 10,
  },
  handleBar: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.border,
  },
  commentsPanelTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  commentsPanelTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.foreground,
    flex: 1,
  },
  closeBtn: {
    padding: 4,
  },
  commentsScroll: {
    flex: 1,
    paddingHorizontal: 12,
    paddingTop: 8,
  },
  noComments: {
    color: Colors.muted,
    fontSize: 13,
    textAlign: 'center',
    marginTop: 20,
  },
  comment: {
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  commentUser: {
    color: Colors.foreground,
    fontWeight: '600',
    fontSize: 13,
    marginBottom: 3,
  },
  commentText: {
    color: Colors.foreground,
    fontSize: 14,
    lineHeight: 20,
  },
  replyBtn: {
    marginTop: 4,
    alignSelf: 'flex-start',
  },
  replyBtnText: {
    color: Colors.muted,
    fontSize: 12,
  },
  replyingBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 6,
    backgroundColor: Colors.border,
  },
  replyingText: {
    flex: 1,
    color: Colors.muted,
    fontSize: 12,
  },
  commentInput: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    gap: 8,
  },
  input: {
    flex: 1,
    backgroundColor: Colors.background,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
    color: Colors.foreground,
    fontSize: 14,
  },
  sendButton: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  sendButtonText: {
    color: '#fff',
    fontSize: 14,
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
