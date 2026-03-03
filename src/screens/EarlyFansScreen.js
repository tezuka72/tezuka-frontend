import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
} from 'react-native';
import { creatorAPI } from '../api/client';
import { Colors } from '../theme/colors';

// 足跡アイコンマップ
const FOOTPRINT_ICON = {
  liked:          '❤️',
  read_completed: '📖',
  shared:         '🚀',
  supported:      '🔥',
};

// タイムスタンプを "yyyy/MM/dd HH:mm" 形式にフォーマット
function formatDate(ts) {
  if (!ts) return '';
  const d = new Date(ts);
  const pad = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}/${pad(d.getMonth() + 1)}/${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// 1行分のファンカード
function FanRow({ fan }) {
  return (
    <View style={styles.row}>
      <View style={styles.rowLeft}>
        <Text style={styles.handle}>@{fan.handle}</Text>
        <Text style={styles.date}>{formatDate(fan.first_any_footprint_at)}</Text>
      </View>
      <View style={styles.icons}>
        {fan.footprints.map(fp => (
          <Text key={fp} style={styles.icon}>{FOOTPRINT_ICON[fp]}</Text>
        ))}
      </View>
    </View>
  );
}

export default function EarlyFansScreen({ route }) {
  const { seriesId } = route.params || {};

  const [fans, setFans] = useState([]);
  const [nextCursor, setNextCursor] = useState(null);
  const [hasMore, setHasMore] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async (cursor = null) => {
    try {
      if (cursor) {
        setIsLoadingMore(true);
      } else {
        setIsLoading(true);
        setError('');
      }

      const res = await creatorAPI.getEarlyFans(seriesId, cursor);

      if (cursor) {
        setFans(prev => [...prev, ...res.fans]);
      } else {
        setFans(res.fans);
      }
      setNextCursor(res.next_cursor);
      setHasMore(res.has_more);
    } catch (e) {
      console.error('EarlyFans load error:', e);
      setError('読み込みに失敗しました');
    } finally {
      setIsLoading(false);
      setIsLoadingMore(false);
    }
  }, [seriesId]);

  useEffect(() => {
    load();
  }, [load]);

  const handleEndReached = () => {
    if (hasMore && !isLoadingMore && nextCursor) {
      load(nextCursor);
    }
  };

  if (isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={Colors.violet} />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity style={styles.retryBtn} onPress={() => load()}>
          <Text style={styles.retryText}>再試行</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* ヘッダー説明 */}
      <View style={styles.descBox}>
        <Text style={styles.descText}>
          作品の公開初期（5話以内）に足跡を残したファンです（非公開）
        </Text>
      </View>

      <FlatList
        data={fans}
        keyExtractor={(item) => item.handle}
        renderItem={({ item }) => <FanRow fan={item} />}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        onEndReached={handleEndReached}
        onEndReachedThreshold={0.3}
        ListEmptyComponent={() => (
          <View style={styles.center}>
            <Text style={styles.emptyText}>まだ初期ファンはいません</Text>
          </View>
        )}
        ListFooterComponent={() =>
          isLoadingMore ? (
            <ActivityIndicator
              size="small"
              color={Colors.violet}
              style={styles.footerSpinner}
            />
          ) : null
        }
        contentContainerStyle={fans.length === 0 && styles.emptyContent}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.background,
    padding: 24,
  },
  descBox: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    backgroundColor: Colors.card,
  },
  descText: {
    fontSize: 13,
    color: Colors.muted,
    lineHeight: 18,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: Colors.card,
  },
  rowLeft: {
    flex: 1,
    marginRight: 12,
  },
  handle: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.foreground,
    marginBottom: 3,
  },
  date: {
    fontSize: 12,
    color: Colors.muted,
  },
  icons: {
    flexDirection: 'row',
    gap: 4,
  },
  icon: {
    fontSize: 18,
  },
  separator: {
    height: 1,
    backgroundColor: Colors.border,
    marginLeft: 16,
  },
  emptyContent: {
    flex: 1,
  },
  emptyText: {
    fontSize: 15,
    color: Colors.muted,
  },
  errorText: {
    fontSize: 15,
    color: Colors.error,
    marginBottom: 16,
    textAlign: 'center',
  },
  retryBtn: {
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.violet,
  },
  retryText: {
    color: Colors.violet,
    fontSize: 14,
    fontWeight: '600',
  },
  footerSpinner: {
    paddingVertical: 16,
  },
});
