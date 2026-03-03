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
  Dimensions,
} from 'react-native';
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

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// エピソードカード
function EpisodeCard({ post, onPress, onLike }) {
  const image = post.images?.[0]?.image_url || post.images?.[0] || post.thumbnail;

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.9}>
      {image && (
        <Image source={{ uri: image }} style={styles.image} resizeMode="cover" />
      )}
      <View style={styles.content}>
        <Text style={styles.title}>{post.title}</Text>
        {post.description ? (
          <Text style={styles.description} numberOfLines={2}>
            {post.description}
          </Text>
        ) : null}
        <View style={styles.stats}>
          <TouchableOpacity style={styles.statItem} onPress={onLike}>
            <Text style={styles.statIcon}>{post.is_liked ? '❤️' : '🤍'}</Text>
            <Text style={styles.statText}>{post.like_count || 0}</Text>
          </TouchableOpacity>
          <View style={styles.statItem}>
            <Text style={styles.statIcon}>💬</Text>
            <Text style={styles.statText}>{post.comment_count || 0}</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statIcon}>👁️</Text>
            <Text style={styles.statText}>{post.view_count || 0}</Text>
          </View>
        </View>
      </View>
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

  // 足跡・応援
  const [footprints, setFootprints] = useState({});
  const [isEarlySupporter, setIsEarlySupporter] = useState(false);
  const [followersAfter, setFollowersAfter] = useState(0);
  const [supportModalVisible, setSupportModalVisible] = useState(false);
  const [receipt, setReceipt] = useState({ visible: false, type: null });

  // My Library — フォロー / シリーズいいね
  const [isFollowing, setIsFollowing] = useState(false);
  const [isSeriesLiked, setIsSeriesLiked] = useState(false);

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
      // 足跡取得失敗はサイレント
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
        // いいね足跡を記録
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
      setError(t('seriesDetail.likeError'));
    }
  };

  const handleShare = async () => {
    try {
      await shareSeries(
        seriesId,
        null,
        series?.title || '',
        async () => {
          // 共有足跡を記録
          if (!footprints.shared) {
            const result = await footprintAPI.record(seriesId, 'shared');
            setFootprints(prev => ({ ...prev, shared: true }));
            if (result?.is_early_supporter) setIsEarlySupporter(true);
          }
          setReceipt({ visible: true, type: 'shared' });
        }
      );
    } catch (e) {
      console.error('Share error:', e);
    }
  };

  const handleSupportClose = async () => {
    setSupportModalVisible(false);
    // 応援後に足跡を更新
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

  return (
    <View style={styles.container}>
      <FlatList
        data={posts}
        keyExtractor={(item) => item.id.toString()}
        renderItem={({ item }) => (
          <EpisodeCard
            post={item}
            onPress={() => handlePostPress(item)}
            onLike={() => handleLike(item.id)}
          />
        )}
        ListHeaderComponent={() => (
          <>
            {/* シリーズヘッダー */}
            {series && (
              <View style={styles.header}>
                {series.cover_image_url && (
                  <Image
                    source={{ uri: series.cover_image_url }}
                    style={styles.coverImage}
                    resizeMode="cover"
                  />
                )}
                <View style={styles.headerContent}>
                  {/* タイトル行 + 熱量リング */}
                  <View style={styles.titleRow}>
                    <Text style={styles.seriesTitle}>{series.title}</Text>
                    <HeatRing heatLevel={heatLevel} size={52} />
                  </View>

                  {series.description ? (
                    <Text style={styles.seriesDescription}>
                      {series.description}
                    </Text>
                  ) : null}

                  {/* エピソード数・フォロー数・いいね数 */}
                  <View style={styles.metaRow}>
                    <Text style={styles.metaItem}>
                      📚 {Array.isArray(posts) ? posts.length : 0}{t('seriesDetail.episodeSuffix')}
                    </Text>
                    {series.follower_count != null && (
                      <Text style={styles.metaItem}>
                        👥 {series.follower_count.toLocaleString()}
                      </Text>
                    )}
                    {series.series_like_count != null && (
                      <Text style={styles.metaItem}>
                        ❤️ {series.series_like_count.toLocaleString()}
                      </Text>
                    )}
                  </View>

                  {/* フォロー / いいね / 応援 / 共有 */}
                  <View style={styles.actionRow}>
                    <TouchableOpacity
                      style={[styles.followBtn, isFollowing && styles.followBtnActive]}
                      onPress={handleFollow}
                      activeOpacity={0.85}
                    >
                      <Text style={[styles.followBtnText, isFollowing && styles.followBtnTextActive]}>
                        {isFollowing ? '✓ フォロー中' : '+ フォロー'}
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.iconBtn}
                      onPress={handleSeriesLike}
                      activeOpacity={0.85}
                    >
                      <Text style={styles.iconBtnText}>
                        {isSeriesLiked ? '❤️' : '🤍'}
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.supportBtn}
                      onPress={() => setSupportModalVisible(true)}
                      activeOpacity={0.85}
                    >
                      <Text style={styles.supportBtnText}>⚡ 応援</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.iconBtn}
                      onPress={handleShare}
                      activeOpacity={0.85}
                    >
                      <Text style={styles.iconBtnText}>🚀</Text>
                    </TouchableOpacity>
                  </View>

                  {/* 初期ファン（作者のみ表示）*/}
                  {user && series && user.id === series.user_id && (
                    <TouchableOpacity
                      style={styles.earlyFanBtn}
                      onPress={() => navigation?.navigate('EarlyFans', {
                        seriesId,
                        seriesTitle: series.title,
                      })}
                      activeOpacity={0.85}
                    >
                      <Text style={styles.earlyFanBtnText}>✨ 初期ファン（非公開）</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            )}

            {/* 足跡パネル（自分だけ表示） */}
            <FootprintPanel
              footprints={footprints}
              isEarlySupporter={isEarlySupporter}
              followersAfter={followersAfter}
            />

            {error ? (
              <View style={styles.errorContainer}>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null}
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
            <Text style={styles.emptyText}>{t('seriesDetail.empty')}</Text>
          </View>
        )}
      />

      {/* 応援モーダル */}
      <SupportModal
        visible={supportModalVisible}
        onClose={handleSupportClose}
        seriesId={seriesId}
      />

      {/* いいね/共有後の貢献レシート */}
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
  metaRow: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 14,
    flexWrap: 'wrap',
  },
  metaItem: {
    fontSize: 14,
    color: Colors.muted,
    fontWeight: '500',
  },
  header: {
    backgroundColor: Colors.card,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    overflow: 'hidden',
    marginBottom: 8,
  },
  coverImage: {
    width: '100%',
    height: 150,
  },
  headerContent: {
    padding: 16,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  seriesTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: Colors.foreground,
    flex: 1,
    marginRight: 12,
  },
  seriesDescription: {
    fontSize: 14,
    color: Colors.muted,
    marginBottom: 12,
    lineHeight: 20,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  followBtn: {
    flex: 2,
    backgroundColor: Colors.background,
    borderRadius: 14,
    paddingVertical: 11,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: Colors.border,
  },
  followBtnActive: {
    borderColor: Colors.violet,
    backgroundColor: 'rgba(183,108,200,0.10)',
  },
  followBtnText: {
    color: Colors.foreground,
    fontSize: 14,
    fontWeight: '700',
  },
  followBtnTextActive: {
    color: Colors.violet,
  },
  iconBtn: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconBtnText: {
    fontSize: 20,
  },
  supportBtn: {
    flex: 2,
    backgroundColor: Colors.primary,
    borderRadius: 14,
    paddingVertical: 11,
    alignItems: 'center',
  },
  supportBtnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
  earlyFanBtn: {
    marginTop: 10,
    paddingVertical: 10,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(183,108,200,0.4)',
    backgroundColor: 'rgba(183,108,200,0.08)',
    alignItems: 'center',
  },
  earlyFanBtnText: {
    color: Colors.violet,
    fontSize: 13,
    fontWeight: '600',
  },
  listContent: {
    paddingBottom: 24,
  },
  card: {
    backgroundColor: Colors.card,
    borderRadius: 12,
    marginHorizontal: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
    ...Shadows.medium,
  },
  image: {
    width: '100%',
    height: SCREEN_WIDTH * 0.5,
  },
  content: {
    padding: 12,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.foreground,
    marginBottom: 6,
  },
  description: {
    fontSize: 12,
    color: Colors.muted,
    marginBottom: 10,
    lineHeight: 18,
  },
  stats: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    paddingTop: 10,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 16,
  },
  statIcon: {
    fontSize: 14,
    marginRight: 4,
  },
  statText: {
    fontSize: 12,
    color: Colors.muted,
    fontWeight: '600',
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
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    fontSize: 16,
    color: Colors.muted,
    fontWeight: '500',
  },
});
