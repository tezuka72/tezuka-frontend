import { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  Linking,
  Animated,
  Modal,
  KeyboardAvoidingView,
  Platform,
  TouchableWithoutFeedback,
  ActivityIndicator,
} from 'react-native';
import { Image } from 'expo-image';
import { postAPI, footprintAPI, affiliateAPI, tipsAPI, bookmarkAPI } from '../api/client';
import RepostModal from '../components/repost/RepostModal';
import { useLanguage } from '../context/LanguageContext';
import { Colors } from '../theme/colors';
import { Shadows } from '../theme/styles';
import { Ionicons } from '@expo/vector-icons';
import SupportModal from '../components/SupportModal';
import GiftModal from '../components/GiftModal';
import { shareSeries } from '../utils/share';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

export default function PostDetailScreen({ route, navigation }) {
  const { postId } = route.params;
  const { t } = useLanguage();
  const [post, setPost] = useState(null);
  const [comments, setComments] = useState([]);
  const [commentText, setCommentText] = useState('');
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [error, setError] = useState('');
  const [descExpanded, setDescExpanded] = useState(false);
  const scrollToImage = (index) => {
    if (!post?.images) return;
    const clamped = Math.max(0, Math.min(index, post.images.length - 1));
    setCurrentImageIndex(clamped);
  };
  const [supportModalVisible, setSupportModalVisible] = useState(false);
  const [giftModalVisible, setGiftModalVisible] = useState(false);
  const [isBookmarked, setIsBookmarked] = useState(false);
  const [products, setProducts] = useState([]);
  const [topTippers, setTopTippers] = useState([]);
  const [replyingTo, setReplyingTo] = useState(null); // { id, username }
  const [expandedReplies, setExpandedReplies] = useState({}); // { commentId: [replies] }
  const [commentLikes, setCommentLikes] = useState({}); // { commentId: { liked, count } }
  const [commentsVisible, setCommentsVisible] = useState(false);
  const [repostModalVisible, setRepostModalVisible] = useState(false);
  // 縦スクロール漫画のlazy loading: 最初の5枚だけ表示し、スクロールに応じて追加
  const [visibleImageCount, setVisibleImageCount] = useState(5);
  // 各画像の実際のアスペクト比に基づく高さ
  const [imageHeights, setImageHeights] = useState({});

  // visibleImageCount が増えるたびに次の3枚をプリフェッチ
  useEffect(() => {
    if (!post?.images) return;
    const nextUrls = post.images
      .slice(visibleImageCount, visibleImageCount + 3)
      .map(img => img?.image_url || img)
      .filter(Boolean);
    if (nextUrls.length > 0) Image.prefetch(nextUrls);
  }, [visibleImageCount, post]);
  const slideAnim = useRef(new Animated.Value(0)).current;

  const openComments = () => {
    setCommentsVisible(true);
    Animated.spring(slideAnim, { toValue: 1, useNativeDriver: true, tension: 65, friction: 11 }).start();
  };

  const closeComments = () => {
    Animated.timing(slideAnim, { toValue: 0, duration: 250, useNativeDriver: true }).start(() => setCommentsVisible(false));
  };

  useEffect(() => {
    loadPost();
    loadComments();
    loadProducts();
    loadTopTippers();
  }, [postId]);

  const loadPost = async () => {
    try {
      setError('');
      const response = await postAPI.getPost(postId);
      setPost(response.post);
      // 最初の8枚をプリフェッチ
      const urls = (response.post?.images || [])
        .slice(0, 8)
        .map(img => img?.image_url || img)
        .filter(Boolean);
      if (urls.length > 0) Image.prefetch(urls);
    } catch (e) {
      console.error('Load post error:', e);
      setError(t('postDetail.loadError'));
    }
  };

  const loadComments = async () => {
    try {
      const response = await postAPI.getComments(postId);
      const loaded = response.comments || [];
      setComments(loaded);
      // いいね状態を初期化
      const likes = {};
      loaded.forEach(c => {
        likes[c.id] = { liked: c.is_liked || false, count: parseInt(c.like_count) || 0 };
      });
      setCommentLikes(likes);
    } catch (e) {
      console.error('Load comments error:', e);
      setError(t('postDetail.commentLoadError'));
    }
  };

  const handleCommentLike = async (commentId) => {
    const current = commentLikes[commentId] || { liked: false, count: 0 };
    // 楽観的更新
    setCommentLikes(prev => ({
      ...prev,
      [commentId]: { liked: !current.liked, count: current.liked ? current.count - 1 : current.count + 1 },
    }));
    try {
      if (current.liked) {
        await postAPI.unlikeComment(postId, commentId);
      } else {
        await postAPI.likeComment(postId, commentId);
      }
    } catch {
      // 失敗時は元に戻す
      setCommentLikes(prev => ({ ...prev, [commentId]: current }));
    }
  };

  const handleLike = async () => {
    try {
      if (post.is_liked) {
        await postAPI.unlike(postId);
      } else {
        await postAPI.like(postId);
        if (post.series_id) {
          footprintAPI.record(post.series_id, 'liked').catch(() => {});
        }
      }
      loadPost();
    } catch (e) {
      console.error('Like error:', e);
    }
  };

  const handleBookmark = async () => {
    try {
      if (isBookmarked) {
        await bookmarkAPI.remove(postId);
        setIsBookmarked(false);
      } else {
        await bookmarkAPI.add(postId);
        setIsBookmarked(true);
      }
    } catch (e) {
      console.error('Bookmark error:', e);
    }
  };

  // 縦スクロール漫画のlazy loading: スクロール位置に応じて表示画像を追加
  const handleMangaScroll = useCallback((e) => {
    if (!post?.images) return;
    const scrollY = e.nativeEvent.contentOffset.y;
    const contentHeight = e.nativeEvent.contentSize.height;
    const viewportHeight = e.nativeEvent.layoutMeasurement.height;
    // 残りスクロール量がviewport2画面分以下になったら次の5枚を追加
    if (contentHeight - scrollY - viewportHeight < viewportHeight * 2) {
      setVisibleImageCount((prev) => Math.min(prev + 5, post.images.length));
    }
    // 末尾近く（90%）で読了足跡を記録
    if (scrollY + viewportHeight > contentHeight * 0.9 && post?.series_id) {
      footprintAPI.record(post.series_id, 'read_completed').catch(() => {});
    }
  }, [post]);

  // スクロール末尾で読了足跡を記録（非縦スクロール用）
  const handleScrollEnd = () => {
    if (post?.series_id) {
      footprintAPI.record(post.series_id, 'read_completed').catch(() => {});
    }
  };

  const handleComment = async () => {
    if (!commentText.trim()) return;
    try {
      await postAPI.addComment(postId, commentText, replyingTo?.id || null);
      setCommentText('');
      setReplyingTo(null);
      if (replyingTo?.id) {
        loadReplies(replyingTo.id);
      } else {
        loadComments();
      }
    } catch (e) {
      console.error('Comment error:', e);
      setError(t('postDetail.commentPostError'));
    }
  };

  const loadReplies = async (commentId) => {
    try {
      const response = await postAPI.getReplies(postId, commentId);
      setExpandedReplies(prev => ({ ...prev, [commentId]: response.replies || [] }));
    } catch (e) {
      console.error('Load replies error:', e);
    }
  };

  const toggleReplies = (commentId) => {
    if (expandedReplies[commentId]) {
      setExpandedReplies(prev => { const n = { ...prev }; delete n[commentId]; return n; });
    } else {
      loadReplies(commentId);
    }
  };

  const loadProducts = async () => {
    try {
      const response = await affiliateAPI.getPostProducts(postId);
      setProducts(response.products || []);
    } catch (e) {
      console.error('Load products error:', e);
    }
  };

  const loadTopTippers = async () => {
    try {
      const response = await tipsAPI.getTopTippers(postId);
      setTopTippers(response?.topTippers || response?.tippers || []);
    } catch (e) {
      console.error('Load top tippers error:', e);
    }
  };

  const handleProductClick = async (productId, platform) => {
    try {
      const response = await affiliateAPI.recordClick(productId, platform);
      if (response.redirect_url) {
        Linking.openURL(response.redirect_url);
      }
    } catch (e) {
      console.error('Product click error:', e);
    }
  };

  if (!post) {
    return (
      <View style={styles.container}>
        {error ? (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : (
          <Text style={styles.loading}>{t('common.loading')}</Text>
        )}
      </View>
    );
  }

  const renderComment = (comment) => (
    <View key={comment.id} style={styles.comment}>
      <Text style={styles.commentUser}>
        {comment.display_name || comment.username}
      </Text>
      <Text style={styles.commentText}>{comment.content}</Text>
      <View style={styles.commentActions}>
        <TouchableOpacity
          style={styles.replyBtn}
          onPress={() => setReplyingTo({ id: comment.id, username: comment.username })}
        >
          <Text style={styles.replyBtnText}>返信</Text>
        </TouchableOpacity>
        {parseInt(comment.reply_count) > 0 && (
          <TouchableOpacity
            style={styles.replyBtn}
            onPress={() => toggleReplies(comment.id)}
          >
            <Text style={styles.replyBtnText}>
              {expandedReplies[comment.id]
                ? '返信を閉じる'
                : `返信 ${comment.reply_count}件`}
            </Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity
          style={styles.commentLikeBtn}
          onPress={() => handleCommentLike(comment.id)}
          activeOpacity={0.7}
        >
          <Ionicons
            name={commentLikes[comment.id]?.liked ? 'heart' : 'heart-outline'}
            size={14}
            color={commentLikes[comment.id]?.liked ? '#FF3B5C' : Colors.muted}
          />
          {(commentLikes[comment.id]?.count || 0) > 0 && (
            <Text style={[styles.replyBtnText, commentLikes[comment.id]?.liked && { color: '#FF3B5C' }]}>
              {commentLikes[comment.id].count}
            </Text>
          )}
        </TouchableOpacity>
      </View>
      {expandedReplies[comment.id]?.map(reply => (
        <View key={reply.id} style={styles.replyItem}>
          <Text style={styles.commentUser}>
            @{reply.username} {reply.display_name}
          </Text>
          <Text style={styles.commentText}>{reply.content}</Text>
          <TouchableOpacity
            style={[styles.replyBtn, { marginTop: 4 }]}
            onPress={() => setReplyingTo({ id: comment.id, username: reply.username })}
          >
            <Text style={styles.replyBtnText}>返信</Text>
          </TouchableOpacity>
        </View>
      ))}
    </View>
  );

  return (
    <View style={styles.container}>

      {/* 上部：漫画エリア（独立スクロール） */}
      <View style={styles.mangaArea}>
        <ScrollView
          onScrollEndDrag={handleScrollEnd}
          onScroll={post?.type === 'vertical_scroll' ? handleMangaScroll : undefined}
          scrollEventThrottle={200}
        >
          {post.images && post.images.length > 0 && (
            post.type === 'vertical_scroll' ? (
              <View>
                {/* lazy load: 最初の visibleImageCount 枚だけレンダリング */}
                {post.images.slice(0, visibleImageCount).map((img, i) => (
                  <Image
                    key={i}
                    source={{ uri: img?.image_url || img }}
                    style={[styles.verticalImage, imageHeights[i] != null && { height: imageHeights[i] }]}
                    contentFit="cover"
                    transition={150}
                    onLoad={(e) => {
                      const { width, height } = e.source;
                      if (width > 0) {
                        setImageHeights(prev => ({ ...prev, [i]: SCREEN_WIDTH * (height / width) }));
                      }
                    }}
                  />
                ))}
                {visibleImageCount < post.images.length && (
                  <View style={styles.imageLoadingMore}>
                    <ActivityIndicator size="small" color="#888" />
                    <Text style={styles.imageLoadingText}>
                      {visibleImageCount}/{post.images.length}ページ読み込み済み
                    </Text>
                  </View>
                )}
              </View>
            ) : (
              <View style={styles.imageContainer}>
                <Image
                  source={{ uri: post.images[currentImageIndex]?.image_url || post.images[currentImageIndex] }}
                  style={styles.image}
                  contentFit="cover"
                />
                <View style={styles.tapOverlay}>
                  <TouchableOpacity
                    style={styles.tapZoneLeft}
                    activeOpacity={1}
                    onPress={() => scrollToImage(currentImageIndex - 1)}
                  />
                  <TouchableOpacity
                    style={styles.tapZoneRight}
                    activeOpacity={1}
                    onPress={() => scrollToImage(currentImageIndex + 1)}
                  />
                </View>
                {post.images.length > 1 && (
                  <View style={styles.imageCounter}>
                    <Text style={styles.imageCounterText}>
                      {currentImageIndex + 1} / {post.images.length}
                    </Text>
                  </View>
                )}
              </View>
            )
          )}

          <View style={styles.content}>
            <TouchableOpacity
              style={styles.header}
              onPress={() => navigation?.navigate('UserProfile', { username: post.creator_username || post.username })}
              activeOpacity={0.7}
            >
              {post.avatar_url ? (
                <Image source={{ uri: post.avatar_url }} style={styles.avatarImg} contentFit="cover" />
              ) : (
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>
                    {(post.creator_name || post.display_name)?.[0]?.toUpperCase() || '?'}
                  </Text>
                </View>
              )}
              <View>
                <Text style={styles.displayName}>{post.creator_name || post.display_name}</Text>
                <Text style={styles.username}>@{post.creator_username || post.username}</Text>
              </View>
            </TouchableOpacity>

            <Text style={styles.title}>{post.title}</Text>
            {post.description && (
              <>
                <Text style={styles.description} numberOfLines={descExpanded ? undefined : 3}>
                  {post.description}
                </Text>
                {post.description.length > 60 && (
                  <TouchableOpacity onPress={() => setDescExpanded(!descExpanded)}>
                    <Text style={styles.expandButton}>
                      {descExpanded ? '閉じる' : '続きを読む'}
                    </Text>
                  </TouchableOpacity>
                )}
              </>
            )}

            {/* 漫画・シリーズ詳細 */}
            {post.series_id && (
              <TouchableOpacity
                style={styles.seriesCard}
                onPress={() => navigation?.navigate('SeriesDetail', { seriesId: post.series_id })}
                activeOpacity={0.8}
              >
                <Ionicons name="book" size={18} color={Colors.primary} />
                <View style={{ flex: 1, marginLeft: 10 }}>
                  <Text style={styles.seriesCardTitle}>{post.series_title}</Text>
                  {post.episode_number && (
                    <Text style={styles.seriesCardEpisode}>第{post.episode_number}話</Text>
                  )}
                </View>
                <Ionicons name="chevron-forward" size={16} color={Colors.muted} />
              </TouchableOpacity>
            )}

            <View style={styles.actions}>
              <View style={styles.actionsRow}>
                <TouchableOpacity style={styles.actionButton} onPress={handleLike}>
                  <Text style={styles.actionIcon}>{post.is_liked ? '❤️' : '🤍'}</Text>
                  <Text style={styles.actionText}>{post.like_count || 0}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.actionButton} onPress={openComments}>
                  <Text style={styles.actionIcon}>💬</Text>
                  <Text style={styles.actionText}>{post.comment_count || 0}</Text>
                </TouchableOpacity>
                <View style={styles.actionButton}>
                  <Text style={styles.actionIcon}>👁️</Text>
                  <Text style={styles.actionText}>{post.view_count || 0}</Text>
                </View>
                <TouchableOpacity style={styles.actionButton} onPress={handleBookmark}>
                  <Ionicons
                    name={isBookmarked ? 'bookmark' : 'bookmark-outline'}
                    size={22}
                    color={isBookmarked ? Colors.primary : Colors.muted}
                  />
                </TouchableOpacity>
                {post.series_id && (
                  <TouchableOpacity
                    style={styles.actionButton}
                    onPress={() => shareSeries(post.series_id, post.id, post.title).catch(() => {})}
                  >
                    <Ionicons name="share-outline" size={22} color={Colors.muted} />
                  </TouchableOpacity>
                )}
                <TouchableOpacity
                  style={styles.actionButton}
                  onPress={() => setRepostModalVisible(true)}
                >
                  <Text style={{ fontSize: 20 }}>↩️</Text>
                </TouchableOpacity>
              </View>
              <TouchableOpacity
                style={styles.supportButton}
                onPress={() => setGiftModalVisible(true)}
              >
                <Text style={styles.supportButtonText}>応援</Text>
              </TouchableOpacity>
            </View>

            {products.length > 0 && (
              <View style={styles.productsSection}>
                <Text style={styles.sectionTitle}>🛍️ アフィリエイト</Text>
                {products.map((product) => (
                  <View key={product.id} style={styles.productCard}>
                    {product.image_url ? (
                      <Image source={{ uri: product.image_url }} style={styles.productImage} contentFit="cover" />
                    ) : (
                      <View style={[styles.productImage, styles.productImagePlaceholder]}>
                        <Text style={styles.productImagePlaceholderText}>🛍️</Text>
                      </View>
                    )}
                    <View style={styles.productInfo}>
                      <Text style={styles.productName} numberOfLines={2}>{product.product_name}</Text>
                      {product.price && (
                        <Text style={styles.productPrice}>¥{product.price.toLocaleString()}</Text>
                      )}
                      <View style={styles.productLinks}>
                        {product.product_url_amazon && (
                          <TouchableOpacity
                            style={[styles.platformButton, styles.amazonButton]}
                            onPress={() => handleProductClick(product.id, 'amazon')}
                          >
                            <Ionicons name="logo-amazon" size={13} color="#fff" style={{ marginRight: 4 }} />
                            <Text style={styles.platformButtonText}>Amazon</Text>
                          </TouchableOpacity>
                        )}
                        {product.product_url_rakuten && (
                          <TouchableOpacity
                            style={[styles.platformButton, styles.rakutenButton]}
                            onPress={() => handleProductClick(product.id, 'rakuten')}
                          >
                            <Text style={styles.platformButtonText}>楽天</Text>
                          </TouchableOpacity>
                        )}
                        {product.product_url_yahoo && (
                          <TouchableOpacity
                            style={[styles.platformButton, styles.yahooButton]}
                            onPress={() => handleProductClick(product.id, 'yahoo')}
                          >
                            <Text style={styles.platformButtonText}>Yahoo!</Text>
                          </TouchableOpacity>
                        )}
                      </View>
                    </View>
                  </View>
                ))}
              </View>
            )}

            {topTippers.length > 0 && (
              <View style={styles.tippersSection}>
                <Text style={styles.sectionTitle}>⚡ 応援してくれた人</Text>
                <View style={styles.tippersRow}>
                  {topTippers.map((tipper, i) => (
                    <TouchableOpacity
                      key={tipper.user_id || i}
                      onPress={() => navigation?.navigate('UserProfile', { username: tipper.username })}
                    >
                      <Text style={styles.tipperName}>
                        {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : '⚡'}
                        {tipper.display_name || tipper.username}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            )}

            {post.hashtags && post.hashtags.length > 0 && (
              <View style={styles.hashtagRow}>
                {post.hashtags.map(h => (
                  <Text key={h.id} style={styles.hashtag}>#{h.tag}</Text>
                ))}
              </View>
            )}
          </View>
        </ScrollView>
      </View>

      {/* コメントボトムシート */}
      <Modal visible={commentsVisible} transparent animationType="none" onRequestClose={closeComments}>
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
                  💬 {t('postDetail.comments')} {comments.length > 0 ? `(${comments.length})` : ''}
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
                placeholder={replyingTo ? `@${replyingTo.username} への返信...` : t('postDetail.commentPlaceholder')}
                placeholderTextColor={Colors.muted}
                value={commentText}
                onChangeText={setCommentText}
              />
              <TouchableOpacity style={styles.sendButton} onPress={handleComment}>
                <Text style={styles.sendButtonText}>{t('postDetail.send')}</Text>
              </TouchableOpacity>
            </View>
          </Animated.View>
        </KeyboardAvoidingView>
      </Modal>

      <SupportModal
        visible={supportModalVisible}
        onClose={() => setSupportModalVisible(false)}
        seriesId={post.series_id}
        episodeId={post.id}
      />
      <GiftModal
        visible={giftModalVisible}
        onClose={() => setGiftModalVisible(false)}
        receiverId={post.user_id}
        postId={post.id}
      />
      <RepostModal
        visible={repostModalVisible}
        onClose={() => setRepostModalVisible(false)}
        repostType="page"
        manga={{
          id: post.series_id || post.id,
          title: post.title,
          cover_url: post.images?.[0]?.image_url || post.images?.[0] || '',
        }}
        page={post.images?.[currentImageIndex] ? {
          id: post.images[currentImageIndex]?.id || String(currentImageIndex),
          image_url: post.images[currentImageIndex]?.image_url || post.images[currentImageIndex],
          page_number: currentImageIndex + 1,
          episode_id: post.id,
        } : undefined}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  mangaArea: {
    flex: 1,
  },
  imageLoadingMore: {
    paddingVertical: 20,
    alignItems: 'center',
    gap: 8,
  },
  imageLoadingText: {
    color: '#888',
    fontSize: 12,
  },
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
  loading: {
    color: Colors.foreground,
    textAlign: 'center',
    marginTop: 100,
    fontSize: 16,
  },
  imageContainer: {
    width: SCREEN_WIDTH,
    height: SCREEN_WIDTH,
    position: 'relative',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  verticalImage: {
    width: SCREEN_WIDTH,
    height: SCREEN_WIDTH * 1.4,
  },
  tapOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
  },
  tapZoneLeft: {
    flex: 1,
  },
  tapZoneRight: {
    flex: 1,
  },
  imageCounter: {
    position: 'absolute',
    top: 20,
    right: 20,
    backgroundColor: 'rgba(10, 10, 15, 0.8)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  imageCounterText: {
    color: Colors.foreground,
    fontSize: 12,
    fontWeight: '600',
  },
  content: {
    padding: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  avatarImg: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 12,
  },
  avatarText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: 'bold',
  },
  displayName: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.foreground,
  },
  username: {
    fontSize: 14,
    color: Colors.muted,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: Colors.foreground,
    marginBottom: 8,
  },
  description: {
    fontSize: 14,
    color: Colors.muted,
    marginBottom: 16,
    lineHeight: 20,
  },
  actions: {
    flexDirection: 'column',
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: Colors.border,
    paddingVertical: 12,
    marginBottom: 16,
    gap: 10,
  },
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 20,
  },
  actionIcon: {
    fontSize: 20,
    marginRight: 6,
  },
  actionText: {
    color: Colors.muted,
    fontSize: 14,
    fontWeight: '600',
  },
  supportButton: {
    alignSelf: 'flex-start',
    backgroundColor: Colors.primary,
    paddingHorizontal: 16,
    paddingVertical: 7,
    borderRadius: 20,
  },
  supportButtonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 13,
  },
  productsSection: {
    marginTop: 16,
    marginBottom: 8,
  },
  productCard: {
    flexDirection: 'row',
    backgroundColor: Colors.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 10,
    overflow: 'hidden',
  },
  productImage: {
    width: 80,
    height: 80,
  },
  productImagePlaceholder: {
    backgroundColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  productImagePlaceholderText: {
    fontSize: 28,
  },
  productInfo: {
    flex: 1,
    padding: 10,
    justifyContent: 'space-between',
  },
  productName: {
    color: Colors.foreground,
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 4,
  },
  productPrice: {
    color: Colors.accent,
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 6,
  },
  productLinks: {
    flexDirection: 'row',
    gap: 6,
  },
  platformButton: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  amazonButton: {
    backgroundColor: '#FF9900',
  },
  rakutenButton: {
    backgroundColor: '#BF0000',
  },
  yahooButton: {
    backgroundColor: '#FF0033',
  },
  platformButtonText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
  hashtagRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 12,
  },
  hashtag: {
    color: Colors.primary,
    fontSize: 13,
    fontWeight: '600',
  },
  commentsSection: {
    marginTop: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.foreground,
    marginBottom: 12,
  },
  comment: {
    backgroundColor: Colors.card,
    padding: 12,
    borderRadius: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  commentUser: {
    fontWeight: '600',
    color: Colors.foreground,
    marginBottom: 4,
  },
  commentText: {
    color: Colors.muted,
    fontSize: 14,
  },
  commentActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 6,
  },
  replyBtn: { padding: 2 },
  commentLikeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    marginLeft: 'auto',
    padding: 4,
  },
  replyBtnText: { color: Colors.primary, fontSize: 12, fontWeight: '600' },
  replyItem: {
    marginLeft: 16,
    marginTop: 8,
    backgroundColor: Colors.background,
    borderRadius: 8,
    padding: 10,
    borderLeftWidth: 2,
    borderLeftColor: Colors.border,
  },
  replyingBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 6,
    backgroundColor: Colors.card,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  replyingText: { color: Colors.muted, fontSize: 12 },
  commentInput: {
    flexDirection: 'row',
    padding: 12,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    backgroundColor: Colors.card,
  },
  input: {
    flex: 1,
    backgroundColor: Colors.background,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginRight: 8,
    color: Colors.foreground,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  sendButton: {
    backgroundColor: Colors.primary,
    borderRadius: 20,
    paddingHorizontal: 20,
    justifyContent: 'center',
    ...Shadows.small,
  },
  sendButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  expandButton: {
    color: Colors.primary,
    fontSize: 13,
    fontWeight: '600',
    marginTop: 4,
    marginBottom: 8,
  },
  seriesCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 12,
    marginTop: 4,
  },
  seriesCardTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.foreground,
  },
  seriesCardEpisode: {
    fontSize: 12,
    color: Colors.muted,
    marginTop: 2,
  },
  seriesButton: {
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 8,
    alignSelf: 'flex-start',
    marginBottom: 12,
    marginTop: 4,
  },
  seriesButtonText: {
    color: Colors.foreground,
    fontSize: 13,
    fontWeight: '600',
  },
  tippersSection: {
    marginTop: 16,
    marginBottom: 8,
  },
  tippersRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  tipperName: {
    color: Colors.foreground,
    fontSize: 13,
    fontWeight: '600',
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
    overflow: 'hidden',
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
