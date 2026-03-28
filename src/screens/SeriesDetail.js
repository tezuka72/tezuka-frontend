import { useState, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  Image,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import RepostModal from '../components/repost/RepostModal';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { seriesAPI, postAPI, footprintAPI, libraryAPI } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { Colors } from '../theme/colors';
import { Shadows } from '../theme/styles';
import HeatRing from '../components/HeatRing';
import FootprintPanel from '../components/FootprintPanel';
import SupportModal from '../components/SupportModal';
import ContributionReceipt from '../components/ContributionReceipt';
import { shareSeries } from '../utils/share';

// エピソードカード（横並びレイアウト）
function EpisodeCard({ post, index, onPress, onLike }) {
  const image = post.images?.[0]?.image_url || post.images?.[0] || post.thumbnail;
  const episodeNum = index + 1;

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.85}>
      {/* サムネイル */}
      <View style={styles.cardThumb}>
        {image ? (
          <Image source={{ uri: image }} style={styles.thumbImage} resizeMode="cover" />
        ) : (
          <View style={styles.thumbPlaceholder}>
            <Ionicons name="image-outline" size={24} color={Colors.muted} />
          </View>
        )}
        {/* 話数バッジ */}
        <View style={styles.episodeBadge}>
          <Text style={styles.episodeBadgeText}>#{episodeNum}</Text>
        </View>
      </View>

      {/* 情報 */}
      <View style={styles.cardInfo}>
        <Text style={styles.cardTitle} numberOfLines={2}>{post.title}</Text>
        {post.description ? (
          <Text style={styles.cardDesc} numberOfLines={1}>{post.description}</Text>
        ) : null}
        <View style={styles.cardStats}>
          <TouchableOpacity style={styles.statItem} onPress={onLike} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons
              name={post.is_liked ? 'heart' : 'heart-outline'}
              size={14}
              color={post.is_liked ? '#FF3B5C' : Colors.muted}
            />
            <Text style={styles.statText}>{post.like_count || 0}</Text>
          </TouchableOpacity>
          <View style={styles.statItem}>
            <Ionicons name="chatbubble-outline" size={13} color={Colors.muted} />
            <Text style={styles.statText}>{post.comment_count || 0}</Text>
          </View>
          <View style={styles.statItem}>
            <Ionicons name="eye-outline" size={13} color={Colors.muted} />
            <Text style={styles.statText}>{post.view_count || 0}</Text>
          </View>
        </View>
      </View>

      <Ionicons name="chevron-forward" size={16} color={Colors.muted} style={styles.cardArrow} />
    </TouchableOpacity>
  );
}

export default function SeriesDetail({ route, navigation }) {
  const { seriesId } = route.params || {};
  const { t } = useLanguage();
  const { user } = useAuth();
  const [series, setSeries] = useState(null);
  const [posts, setPosts] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  const [footprints, setFootprints] = useState({});
  const [isEarlySupporter, setIsEarlySupporter] = useState(false);
  const [followersAfter, setFollowersAfter] = useState(0);
  const [supportModalVisible, setSupportModalVisible] = useState(false);
  const [receipt, setReceipt] = useState({ visible: false, type: null });

  const [isFollowing, setIsFollowing] = useState(false);
  const [isSeriesLiked, setIsSeriesLiked] = useState(false);
  const [repostModalVisible, setRepostModalVisible] = useState(false);

  const handleFollow = async () => {
    try {
      if (isFollowing) {
        await libraryAPI.unfollow(seriesId);
        setIsFollowing(false);
      } else {
        await libraryAPI.follow(seriesId);
        setIsFollowing(true);
      }
    } catch (e) {
      console.error('Follow error:', e);
    }
  };

  const handleSeriesLike = async () => {
    try {
      if (isSeriesLiked) {
        await libraryAPI.unlikeSeries(seriesId);
        setIsSeriesLiked(false);
      } else {
        await libraryAPI.likeSeries(seriesId);
        setIsSeriesLiked(true);
      }
    } catch (e) {
      console.error('Series like error:', e);
    }
  };

  useEffect(() => {
    if (seriesId) {
      loadSeriesData();
      loadFootprints();
    }
  }, [seriesId]);

  const loadSeriesData = async () => {
    try {
      setError('');
      setIsLoading(true);
      const response = await seriesAPI.getById(seriesId);
      setSeries(response.series);
      setPosts(response.episodes || []);
      setIsFollowing(response.series.is_following ?? false);
      setIsSeriesLiked(response.series.is_series_liked ?? false);
    } catch (e) {
      console.error('Load series error:', e);
      setError(t('seriesDetail.loadError'));
    } finally {
      setIsLoading(false);
    }
  };

  const loadFootprints = async () => {
    try {
      const res = await footprintAPI.get(seriesId);
      setFootprints({
        liked:          res.liked ?? false,
        read_completed: res.read_completed ?? false,
        shared:         res.shared ?? false,
        supported:      res.supported ?? false,
      });
      setIsEarlySupporter(res.is_early_supporter ?? false);
      setFollowersAfter(res.followers_delta ?? 0);
    } catch (e) {
      // サイレント
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await Promise.all([loadSeriesData(), loadFootprints()]);
    setRefreshing(false);
  };

  const handlePostPress = (post) => {
    navigation?.navigate('PostDetail', { postId: post.id });
  };

  const handleLike = async (postId) => {
    try {
      const post = posts.find(p => p.id === postId);
      if (post?.is_liked) {
        await postAPI.unlike(postId);
      } else {
        await postAPI.like(postId);
        if (!footprints.liked) {
          const result = await footprintAPI.record(seriesId, 'liked');
          setFootprints(prev => ({ ...prev, liked: true }));
          if (result?.is_early_supporter) setIsEarlySupporter(true);
          setReceipt({ visible: true, type: 'liked' });
        }
      }
      loadSeriesData();
    } catch (e) {
      console.error('Like error:', e);
    }
  };

  const handleShare = async () => {
    try {
      await shareSeries(seriesId, null, series?.title || '', async () => {
        if (!footprints.shared) {
          const result = await footprintAPI.record(seriesId, 'shared');
          setFootprints(prev => ({ ...prev, shared: true }));
          if (result?.is_early_supporter) setIsEarlySupporter(true);
        }
        setReceipt({ visible: true, type: 'shared' });
      });
    } catch (e) {
      console.error('Share error:', e);
    }
  };

  const handleSupportClose = async () => {
    setSupportModalVisible(false);
    if (!footprints.supported) {
      const result = await footprintAPI.record(seriesId, 'supported').catch(() => null);
      setFootprints(prev => ({ ...prev, supported: true }));
      if (result?.is_early_supporter) setIsEarlySupporter(true);
    }
  };

  if (isLoading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  const heatLevel = series?.heat_level ?? 0;
  const episodeCount = Array.isArray(posts) ? posts.length : 0;
  const isOwner = user && series && user.id === series.user_id;

  return (
    <View style={styles.container}>
      <FlatList
        data={posts}
        keyExtractor={(item) => item.id.toString()}
        renderItem={({ item, index }) => (
          <EpisodeCard
            post={item}
            index={index}
            onPress={() => handlePostPress(item)}
            onLike={() => handleLike(item.id)}
          />
        )}
        ListHeaderComponent={() => (
          <>
            {series && (
              <>
                {/* ===== カバーヒーロー ===== */}
                <View style={styles.hero}>
                  {series.cover_image_url ? (
                    <Image
                      source={{ uri: series.cover_image_url }}
                      style={styles.heroImage}
                      resizeMode="cover"
                    />
                  ) : (
                    <View style={styles.heroPlaceholder}>
                      <Text style={styles.heroPlaceholderText}>📚</Text>
                    </View>
                  )}
                  <LinearGradient
                    colors={['transparent', 'rgba(0,0,0,0.75)']}
                    style={styles.heroGradient}
                    pointerEvents="none"
                  />
                  {/* 熱量リング（右上） */}
                  <View style={styles.heroHeat}>
                    <HeatRing heatLevel={heatLevel} size={48} />
                  </View>
                </View>

                {/* ===== ヘッダー情報 ===== */}
                <View style={styles.headerContent}>

                  {/* タイトル */}
                  <Text style={styles.seriesTitle}>{series.title}</Text>

                  {/* 作者情報 */}
                  <TouchableOpacity
                    style={styles.authorRow}
                    activeOpacity={0.8}
                    onPress={() => navigation?.navigate('UserProfile', {
                      username: series.creator_username || series.username,
                    })}
                  >
                    <View style={styles.authorAvatar}>
                      <Text style={styles.authorAvatarText}>
                        {(series.creator_name || series.creator_username)?.[0]?.toUpperCase() || '?'}
                      </Text>
                    </View>
                    <Text style={styles.authorName}>
                      {series.creator_name || series.creator_username}
                    </Text>
                    <Ionicons name="chevron-forward" size={14} color={Colors.muted} />
                  </TouchableOpacity>

                  {/* 説明文 */}
                  {series.description ? (
                    <Text style={styles.seriesDescription}>{series.description}</Text>
                  ) : null}

                  {/* 統計 */}
                  <View style={styles.metaRow}>
                    <View style={styles.metaBadge}>
                      <Ionicons name="book-outline" size={13} color={Colors.muted} />
                      <Text style={styles.metaText}>{episodeCount}話</Text>
                    </View>
                    <View style={styles.metaBadge}>
                      <Ionicons name="people-outline" size={13} color={Colors.muted} />
                      <Text style={styles.metaText}>{(series.follower_count || 0).toLocaleString()}</Text>
                    </View>
                    <View style={styles.metaBadge}>
                      <Ionicons name="heart-outline" size={13} color={Colors.muted} />
                      <Text style={styles.metaText}>{(series.series_like_count || 0).toLocaleString()}</Text>
                    </View>
                    <View style={styles.metaBadge}>
                      <Ionicons name="eye-outline" size={13} color={Colors.muted} />
                      <Text style={styles.metaText}>{(series.total_views || 0).toLocaleString()}</Text>
                    </View>
                  </View>

                  {/* ===== 第1話から読むCTA ===== */}
                  {episodeCount > 0 && (
                    <TouchableOpacity
                      style={styles.startReadBtn}
                      onPress={() => handlePostPress(posts[0])}
                      activeOpacity={0.85}
                    >
                      <Ionicons name="play" size={16} color="#fff" />
                      <Text style={styles.startReadBtnText}>第1話から読む</Text>
                    </TouchableOpacity>
                  )}

                  {/* ===== アクションボタン行 ===== */}
                  <View style={styles.actionRow}>
                    <TouchableOpacity
                      style={[styles.followBtn, isFollowing && styles.followBtnActive]}
                      onPress={handleFollow}
                      activeOpacity={0.85}
                    >
                      <Ionicons
                        name={isFollowing ? 'checkmark' : 'add'}
                        size={16}
                        color={isFollowing ? Colors.violet : Colors.foreground}
                      />
                      <Text style={[styles.followBtnText, isFollowing && styles.followBtnTextActive]}>
                        {isFollowing ? 'フォロー中' : 'フォロー'}
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[styles.iconBtn, isSeriesLiked && styles.iconBtnActive]}
                      onPress={handleSeriesLike}
                      activeOpacity={0.85}
                    >
                      <Ionicons
                        name={isSeriesLiked ? 'heart' : 'heart-outline'}
                        size={20}
                        color={isSeriesLiked ? '#FF3B5C' : Colors.foreground}
                      />
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[styles.iconBtn, styles.supportBtn]}
                      onPress={() => setSupportModalVisible(true)}
                      activeOpacity={0.85}
                    >
                      <Text style={styles.supportBtnText}>⚡</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.iconBtn}
                      onPress={handleShare}
                      activeOpacity={0.85}
                    >
                      <Ionicons name="share-outline" size={20} color={Colors.foreground} />
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[styles.iconBtn, { borderColor: '#E94B7A' }]}
                      onPress={() => setRepostModalVisible(true)}
                      activeOpacity={0.85}
                    >
                      <Text style={{ fontSize: 16 }}>↩️</Text>
                    </TouchableOpacity>
                  </View>

                  {/* 掲示板ボタン */}
                  <TouchableOpacity
                    style={styles.boardBtn}
                    onPress={() => navigation?.navigate('SeriesBoard', {
                      seriesId,
                      seriesTitle: series.title,
                    })}
                    activeOpacity={0.85}
                  >
                    <Ionicons name="chatbubbles-outline" size={16} color={Colors.muted} />
                    <Text style={styles.boardBtnText}>コミュニティ掲示板</Text>
                  </TouchableOpacity>

                  {/* 作者専用ツール */}
                  {isOwner && (
                    <View style={styles.ownerRow}>
                      <TouchableOpacity
                        style={styles.ownerBtn}
                        onPress={() => navigation?.navigate('Analytics', { seriesId, seriesTitle: series.title })}
                        activeOpacity={0.85}
                      >
                        <Ionicons name="bar-chart-outline" size={14} color={Colors.violet} />
                        <Text style={styles.ownerBtnText}>読者分析</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.ownerBtn}
                        onPress={() => navigation?.navigate('EarlyFans', { seriesId, seriesTitle: series.title })}
                        activeOpacity={0.85}
                      >
                        <Ionicons name="star-outline" size={14} color={Colors.violet} />
                        <Text style={styles.ownerBtnText}>初期ファン</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>

                {/* 足跡パネル */}
                <FootprintPanel
                  footprints={footprints}
                  isEarlySupporter={isEarlySupporter}
                  followersAfter={followersAfter}
                />
              </>
            )}

            {error ? (
              <View style={styles.errorContainer}>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null}

            {/* エピソード一覧ヘッダー */}
            {episodeCount > 0 && (
              <View style={styles.sectionHeader}>
                <Ionicons name="list" size={15} color={Colors.foreground} />
                <Text style={styles.sectionHeaderText}>エピソード一覧</Text>
                <Text style={styles.sectionHeaderCount}>{episodeCount}話</Text>
              </View>
            )}
          </>
        )}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={Colors.primary}
          />
        }
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={() => (
          <View style={styles.emptyContainer}>
            <Ionicons name="book-outline" size={40} color={Colors.muted} />
            <Text style={styles.emptyText}>{t('seriesDetail.empty')}</Text>
            {isOwner && (
              <Text style={styles.emptyHint}>投稿画面からこのシリーズにエピソードを追加しましょう</Text>
            )}
          </View>
        )}
      />

      <SupportModal
        visible={supportModalVisible}
        onClose={handleSupportClose}
        seriesId={seriesId}
      />

      {series && (
        <RepostModal
          visible={repostModalVisible}
          onClose={() => setRepostModalVisible(false)}
          repostType="work"
          manga={{
            id: series.id,
            title: series.title,
            cover_url: series.cover_image_url,
          }}
        />
      )}

      <ContributionReceipt
        visible={receipt.visible}
        type={receipt.type}
        onDismiss={() => setReceipt({ visible: false, type: null })}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.background,
  },

  // ---- カバーヒーロー ----
  hero: {
    width: '100%',
    height: 240,
    backgroundColor: Colors.card,
  },
  heroImage: {
    width: '100%',
    height: '100%',
  },
  heroPlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.border,
  },
  heroPlaceholderText: {
    fontSize: 56,
  },
  heroGradient: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 100,
  },
  heroHeat: {
    position: 'absolute',
    top: 12,
    right: 12,
  },

  // ---- ヘッダー情報 ----
  headerContent: {
    padding: 16,
    backgroundColor: Colors.card,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    marginBottom: 8,
  },
  seriesTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: Colors.foreground,
    marginBottom: 10,
    lineHeight: 28,
  },

  // ---- 作者情報 ----
  authorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    paddingVertical: 6,
    paddingHorizontal: 10,
    backgroundColor: Colors.background,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.border,
    alignSelf: 'flex-start',
    gap: 8,
  },
  authorAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  authorAvatarText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  authorName: {
    fontSize: 13,
    color: Colors.foreground,
    fontWeight: '600',
  },

  seriesDescription: {
    fontSize: 14,
    color: Colors.muted,
    marginBottom: 14,
    lineHeight: 20,
  },

  // ---- 統計バッジ ----
  metaRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
    flexWrap: 'wrap',
  },
  metaBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    backgroundColor: Colors.background,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  metaText: {
    fontSize: 12,
    color: Colors.muted,
    fontWeight: '600',
  },

  // ---- 第1話から読むCTA ----
  startReadBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.primary,
    borderRadius: 14,
    paddingVertical: 14,
    marginBottom: 14,
  },
  startReadBtnText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },

  // ---- アクションボタン行 ----
  actionRow: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
    marginBottom: 10,
  },
  followBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: Colors.background,
    borderRadius: 12,
    paddingVertical: 10,
    borderWidth: 1.5,
    borderColor: Colors.border,
  },
  followBtnActive: {
    borderColor: Colors.violet,
    backgroundColor: 'rgba(183,108,200,0.10)',
  },
  followBtnText: {
    color: Colors.foreground,
    fontSize: 13,
    fontWeight: '700',
  },
  followBtnTextActive: {
    color: Colors.violet,
  },
  iconBtn: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconBtnActive: {
    borderColor: '#FF3B5C',
    backgroundColor: 'rgba(255,59,92,0.08)',
  },
  supportBtn: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  supportBtnText: {
    fontSize: 18,
  },

  // ---- 掲示板ボタン ----
  boardBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 11,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.background,
    marginBottom: 8,
  },
  boardBtnText: {
    color: Colors.muted,
    fontSize: 13,
    fontWeight: '600',
  },

  // ---- 作者専用 ----
  ownerRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
  },
  ownerBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(183,108,200,0.4)',
    backgroundColor: 'rgba(183,108,200,0.08)',
  },
  ownerBtnText: {
    color: Colors.violet,
    fontSize: 13,
    fontWeight: '600',
  },

  // ---- セクションヘッダー ----
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: Colors.background,
  },
  sectionHeaderText: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.foreground,
    flex: 1,
  },
  sectionHeaderCount: {
    fontSize: 13,
    color: Colors.muted,
    fontWeight: '500',
  },

  // ---- エピソードカード ----
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.card,
    marginHorizontal: 16,
    marginBottom: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
    ...Shadows.small,
  },
  cardThumb: {
    width: 88,
    height: 88,
    backgroundColor: Colors.border,
    position: 'relative',
  },
  thumbImage: {
    width: '100%',
    height: '100%',
  },
  thumbPlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.border,
  },
  episodeBadge: {
    position: 'absolute',
    bottom: 4,
    left: 4,
    backgroundColor: 'rgba(0,0,0,0.65)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  episodeBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '700',
  },
  cardInfo: {
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.foreground,
    marginBottom: 4,
    lineHeight: 19,
  },
  cardDesc: {
    fontSize: 11,
    color: Colors.muted,
    marginBottom: 8,
  },
  cardStats: {
    flexDirection: 'row',
    gap: 12,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  statText: {
    fontSize: 11,
    color: Colors.muted,
    fontWeight: '600',
  },
  cardArrow: {
    paddingRight: 12,
  },

  listContent: {
    paddingBottom: 32,
  },

  errorContainer: {
    backgroundColor: '#FFE0E0',
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginHorizontal: 16,
    borderRadius: 10,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#FF6B6B',
  },
  errorText: {
    color: '#C92A2A',
    fontSize: 14,
    fontWeight: '500',
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 48,
    gap: 12,
  },
  emptyText: {
    fontSize: 15,
    color: Colors.muted,
    fontWeight: '500',
  },
  emptyHint: {
    fontSize: 13,
    color: Colors.muted,
    textAlign: 'center',
    paddingHorizontal: 32,
    lineHeight: 18,
  },
});
