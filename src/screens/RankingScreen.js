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
import { igsAPI } from '../api/client';
import HeatRing from '../components/HeatRing';
import { Colors } from '../theme/colors';
import { Shadows } from '../theme/styles';

const TABS = ['Popular', 'Trending', 'New'];
const TAB_KEYS = ['popular', 'trending', 'new'];

// ランキングカード（ランク番号は表示しない）
function SeriesCard({ series, onPress }) {
  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.9}>
      <View style={styles.cardInner}>
        {series.cover_image_url ? (
          <Image
            source={{ uri: series.cover_image_url }}
            style={styles.cover}
            resizeMode="cover"
          />
        ) : (
          <View style={styles.coverPlaceholder}>
            <Text style={styles.coverPlaceholderText}>📚</Text>
          </View>
        )}

        <View style={styles.cardInfo}>
          <Text style={styles.seriesTitle} numberOfLines={2}>
            {series.title}
          </Text>
          <Text style={styles.creatorName} numberOfLines={1}>
            @{series.creator_username || series.creator_name}
          </Text>
          {series.genre ? (
            <View style={styles.genreBadge}>
              <Text style={styles.genreText}>{series.genre}</Text>
            </View>
          ) : null}
          {series.description ? (
            <Text style={styles.description} numberOfLines={2}>
              {series.description}
            </Text>
          ) : null}
          <View style={styles.countRow}>
            {series.follower_count != null && (
              <Text style={styles.countText}>
                👥 {series.follower_count.toLocaleString()}
              </Text>
            )}
            {series.series_like_count != null && (
              <Text style={styles.countText}>
                ❤️ {series.series_like_count.toLocaleString()}
              </Text>
            )}
          </View>
        </View>

        {/* 熱量リング（数値なし） */}
        <View style={styles.heatWrap}>
          <HeatRing heatLevel={series.heat_level ?? 0} size={48} />
        </View>
      </View>
    </TouchableOpacity>
  );
}

export default function RankingScreen({ navigation }) {
  const [activeTab, setActiveTab] = useState(0);
  const [data, setData] = useState({ popular: [], trending: [], new: [] });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    const type = TAB_KEYS[activeTab];
    try {
      setError('');
      const res = await igsAPI.getRanking(type, 50);
      setData(prev => ({ ...prev, [type]: res.series || [] }));
    } catch (e) {
      console.error('Ranking error:', e);
      setError('ランキングの読み込みに失敗しました');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [activeTab]);

  useEffect(() => {
    setLoading(true);
    load();
  }, [activeTab]);

  const handleRefresh = () => {
    setRefreshing(true);
    load();
  };

  const currentList = data[TAB_KEYS[activeTab]];

  return (
    <View style={styles.container}>
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
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={Colors.primary} size="large" />
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : (
        <FlatList
          data={currentList}
          keyExtractor={(item) => item.id.toString()}
          renderItem={({ item }) => (
            <SeriesCard
              series={item}
              onPress={() =>
                navigation?.navigate('SeriesDetail', { seriesId: item.id })
              }
            />
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
            <View style={styles.center}>
              <Text style={styles.emptyText}>まだ作品がありません</Text>
            </View>
          )}
        />
      )}
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
    paddingVertical: 14,
    alignItems: 'center',
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
  listContent: {
    padding: 12,
  },
  card: {
    backgroundColor: Colors.card,
    borderRadius: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
    ...Shadows.medium,
  },
  cardInner: {
    flexDirection: 'row',
    padding: 12,
    alignItems: 'center',
  },
  cover: {
    width: 72,
    height: 100,
    borderRadius: 8,
    backgroundColor: Colors.border,
  },
  coverPlaceholder: {
    width: 72,
    height: 100,
    borderRadius: 8,
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
  },
  seriesTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.foreground,
    marginBottom: 4,
  },
  creatorName: {
    fontSize: 12,
    color: Colors.muted,
    marginBottom: 8,
  },
  genreBadge: {
    backgroundColor: 'rgba(183,108,200,0.15)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    alignSelf: 'flex-start',
    marginBottom: 6,
    borderWidth: 1,
    borderColor: 'rgba(183,108,200,0.3)',
  },
  genreText: {
    fontSize: 11,
    color: Colors.violet,
    fontWeight: '600',
  },
  description: {
    fontSize: 11,
    color: Colors.muted,
    lineHeight: 16,
    marginBottom: 4,
  },
  countRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 4,
  },
  countText: {
    fontSize: 11,
    color: Colors.muted,
    fontWeight: '500',
  },
  heatWrap: {
    paddingLeft: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 80,
  },
  errorText: {
    color: Colors.error,
    fontSize: 14,
  },
  emptyText: {
    color: Colors.muted,
    fontSize: 15,
  },
});
