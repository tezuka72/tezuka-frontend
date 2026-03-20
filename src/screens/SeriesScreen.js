import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  Image,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { seriesAPI, libraryAPI } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { Colors } from '../theme/colors';
import { Shadows } from '../theme/styles';

const TABS = ['フォロー中', '自分の作品'];

// シリーズカード
function SeriesCard({ series, onPress }) {
  const episodeCount = series.episode_count ?? 0;

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.88}>
      {series.cover_image_url ? (
        <Image source={{ uri: series.cover_image_url }} style={styles.cover} resizeMode="cover" />
      ) : (
        <View style={styles.coverPlaceholder}>
          <Text style={styles.coverPlaceholderText}>📚</Text>
        </View>
      )}
      <View style={styles.cardInfo}>
        <Text style={styles.cardTitle} numberOfLines={2}>{series.title}</Text>
        <Text style={styles.cardCreator} numberOfLines={1}>
          @{series.creator_username || series.creator_name}
        </Text>
        {series.description ? (
          <Text style={styles.cardDesc} numberOfLines={1}>{series.description}</Text>
        ) : null}
        <View style={styles.cardMeta}>
          <View style={styles.metaItem}>
            <Ionicons name="book-outline" size={12} color={Colors.muted} />
            <Text style={styles.metaText}>{episodeCount}話</Text>
          </View>
          {series.follower_count != null && (
            <View style={styles.metaItem}>
              <Ionicons name="people-outline" size={12} color={Colors.muted} />
              <Text style={styles.metaText}>{series.follower_count.toLocaleString()}</Text>
            </View>
          )}
        </View>
      </View>
      <Ionicons name="chevron-forward" size={16} color={Colors.muted} style={{ paddingRight: 12 }} />
    </TouchableOpacity>
  );
}

export default function SeriesScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState(0);

  const [followedSeries, setFollowedSeries] = useState([]);
  const [mySeries, setMySeries] = useState([]);
  const [loadingFollowed, setLoadingFollowed] = useState(true);
  const [loadingMy, setLoadingMy] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const loadFollowed = useCallback(async () => {
    try {
      const res = await libraryAPI.getFollows();
      setFollowedSeries(res.items || []);
    } catch (e) {
      console.error('Load followed series error:', e);
      setError('フォロー中のシリーズを読み込めませんでした');
    } finally {
      setLoadingFollowed(false);
    }
  }, []);

  const loadMySeries = useCallback(async () => {
    if (!user?.username) { setLoadingMy(false); return; }
    try {
      const res = await seriesAPI.getMySeries(user.username);
      setMySeries(res.series || []);
    } catch (e) {
      console.error('Load my series error:', e);
    } finally {
      setLoadingMy(false);
    }
  }, [user?.username]);

  useEffect(() => {
    loadFollowed();
    loadMySeries();
  }, []);

  const handleRefresh = async () => {
    setRefreshing(true);
    setError('');
    await Promise.all([loadFollowed(), loadMySeries()]);
    setRefreshing(false);
  };

  const isLoading = activeTab === 0 ? loadingFollowed : loadingMy;
  const currentList = activeTab === 0 ? followedSeries : mySeries;

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* タブバー */}
      <View style={styles.tabBar}>
        {TABS.map((tab, i) => (
          <TouchableOpacity
            key={tab}
            style={[styles.tab, activeTab === i && styles.tabActive]}
            onPress={() => setActiveTab(i)}
          >
            <Text style={[styles.tabText, activeTab === i && styles.tabTextActive]}>
              {tab}
            </Text>
            {i === 0 && followedSeries.length > 0 && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{followedSeries.length}</Text>
              </View>
            )}
            {i === 1 && mySeries.length > 0 && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{mySeries.length}</Text>
              </View>
            )}
          </TouchableOpacity>
        ))}
      </View>

      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator color={Colors.primary} size="large" />
        </View>
      ) : (
        <FlatList
          data={currentList}
          keyExtractor={(item) => (item.series?.id ?? item.id ?? item.series_id)?.toString()}
          renderItem={({ item }) => (
            <SeriesCard
              series={item.series || item}
              onPress={() => navigation?.navigate('SeriesDetail', {
                seriesId: item.series?.id ?? item.id ?? item.series_id,
              })}
            />
          )}
          ListHeaderComponent={
            activeTab === 1 && user ? (
              <TouchableOpacity
                style={styles.createBtn}
                onPress={() => navigation?.navigate('CreateSeries')}
                activeOpacity={0.85}
              >
                <Ionicons name="add-circle-outline" size={20} color="#fff" />
                <Text style={styles.createBtnText}>新しいシリーズを作る</Text>
              </TouchableOpacity>
            ) : null
          }
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor={Colors.primary}
            />
          }
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={() => (
            <View style={styles.center}>
              {activeTab === 0 ? (
                <>
                  <Ionicons name="heart-outline" size={44} color={Colors.muted} />
                  <Text style={styles.emptyTitle}>フォロー中の作品がありません</Text>
                  <Text style={styles.emptyHint}>気に入った作品のシリーズページでフォローしましょう</Text>
                </>
              ) : (
                <>
                  <Ionicons name="create-outline" size={44} color={Colors.muted} />
                  <Text style={styles.emptyTitle}>まだシリーズがありません</Text>
                  <Text style={styles.emptyHint}>「新しいシリーズを作る」から作品を始めましょう</Text>
                </>
              )}
            </View>
          )}
        />
      )}

      {error ? (
        <View style={styles.errorBanner}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: Colors.card,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    gap: 6,
  },
  tabActive: {
    borderBottomWidth: 2,
    borderBottomColor: Colors.primary,
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.muted,
  },
  tabTextActive: {
    color: Colors.foreground,
  },
  badge: {
    backgroundColor: Colors.primary,
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 2,
    minWidth: 20,
    alignItems: 'center',
  },
  badgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '700',
  },
  createBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.primary,
    marginHorizontal: 16,
    marginTop: 16,
    marginBottom: 8,
    paddingVertical: 14,
    borderRadius: 14,
  },
  createBtnText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.card,
    marginHorizontal: 16,
    marginBottom: 10,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
    ...Shadows.small,
  },
  cover: {
    width: 80,
    height: 100,
    backgroundColor: Colors.border,
  },
  coverPlaceholder: {
    width: 80,
    height: 100,
    backgroundColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  coverPlaceholderText: {
    fontSize: 28,
  },
  cardInfo: {
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.foreground,
    marginBottom: 4,
    lineHeight: 20,
  },
  cardCreator: {
    fontSize: 12,
    color: Colors.muted,
    marginBottom: 4,
  },
  cardDesc: {
    fontSize: 11,
    color: Colors.muted,
    marginBottom: 6,
  },
  cardMeta: {
    flexDirection: 'row',
    gap: 12,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  metaText: {
    fontSize: 11,
    color: Colors.muted,
    fontWeight: '600',
  },
  listContent: {
    paddingBottom: 32,
    paddingTop: 4,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 80,
    gap: 12,
    paddingHorizontal: 32,
  },
  emptyTitle: {
    fontSize: 15,
    color: Colors.muted,
    fontWeight: '600',
    textAlign: 'center',
  },
  emptyHint: {
    fontSize: 13,
    color: Colors.muted,
    textAlign: 'center',
    lineHeight: 18,
  },
  errorBanner: {
    position: 'absolute',
    bottom: 20,
    left: 16,
    right: 16,
    backgroundColor: '#FFE0E0',
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: '#FF6B6B',
  },
  errorText: {
    color: '#C92A2A',
    fontSize: 13,
    fontWeight: '500',
    textAlign: 'center',
  },
});
