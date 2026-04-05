import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { analyticsAPI, notificationAPI } from '../api/client';
import { Colors } from '../theme/colors';

// シンプルな折れ線グラフ（バー形式）
function BarChart({ data = [], label = '' }) {
  if (!data.length) return null;
  const max = Math.max(...data.map(d => Number(d.count || 0)), 1);

  return (
    <View style={chart.wrap}>
      <Text style={chart.label}>{label}</Text>
      <View style={chart.bars}>
        {data.map((d, i) => {
          const h = Math.max(4, (Number(d.count || 0) / max) * 80);
          return (
            <View key={i} style={chart.barCol}>
              <Text style={chart.barVal}>{d.count}</Text>
              <View style={[chart.bar, { height: h }]} />
              <Text style={chart.barDay}>{d.day || d.date || ''}</Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

// 統計カード
function StatCard({ label, value, sub, color }) {
  return (
    <View style={[styles.statCard, color && { borderLeftColor: color, borderLeftWidth: 3 }]}>
      <Text style={styles.statValue}>{value ?? '—'}</Text>
      <Text style={styles.statLabel}>{label}</Text>
      {sub ? <Text style={styles.statSub}>{sub}</Text> : null}
    </View>
  );
}

export default function AnalyticsScreen({ route, navigation }) {
  const { seriesId, seriesTitle } = route.params || {};
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [notifSending, setNotifSending] = useState(false);
  const [notifSent, setNotifSent] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (navigation) {
      navigation.setOptions({ title: '読者分析' });
    }
  }, [navigation]);

  const load = useCallback(async () => {
    try {
      setError('');
      const res = await analyticsAPI.getSeries(seriesId);
      setData(res);
    } catch (e) {
      setError('データの取得に失敗しました');
    } finally {
      setLoading(false);
    }
  }, [seriesId]);

  useEffect(() => { load(); }, [load]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const handleNotify = async () => {
    setNotifSending(true);
    try {
      await notificationAPI.notifyFollowers(
        seriesId,
        `${seriesTitle || 'シリーズ'}が更新されました`,
        '新しいエピソードを読もう！'
      );
      setNotifSent(true);
      setTimeout(() => setNotifSent(false), 3000);
    } catch (e) {
      setError('通知の送信に失敗しました');
    } finally {
      setNotifSending(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  const fp = data?.footprints || {};
  const eps = data?.episodes || [];
  const viewTrend = data?.view_trend || [];
  const fanTrend = data?.fan_trend || [];
  const giftEarnings = data?.earnings || { total_gift_earnings: 0, gift_count: 0 };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={Colors.primary} />}
    >
      {/* 更新通知ボタン */}
      <TouchableOpacity
        style={[styles.notifyBtn, notifSent && styles.notifyBtnSent]}
        onPress={handleNotify}
        disabled={notifSending || notifSent}
        activeOpacity={0.85}
      >
        {notifSending
          ? <ActivityIndicator size="small" color="#fff" />
          : <Text style={styles.notifyBtnText}>
              {notifSent ? '✓ 通知を送信しました' : '🔔 フォロワーに更新通知を送る'}
            </Text>
        }
      </TouchableOpacity>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      {/* 足跡サマリー */}
      <Text style={styles.sectionTitle}>足跡サマリー</Text>
      <View style={styles.statRow}>
        <StatCard label="いいね" value={fp.total_liked} color={Colors.rose} />
        <StatCard label="読了" value={fp.total_read_completed} color={Colors.emerald} />
        <StatCard label="外部シェア" value={fp.total_shared} color={Colors.cyan} />
        <StatCard label="応援" value={fp.total_supported} color={Colors.accent} />
      </View>
      <View style={styles.statRow}>
        <StatCard label="リポスト" value={fp.total_reposts} color={Colors.primary} />
        {Number(fp.early_supporters) > 0 && (
          <StatCard label="初期応援者" value={fp.early_supporters} color={Colors.violet} sub="✨ アーリーサポーター" />
        )}
      </View>

      {/* ギフト収益 */}
      <Text style={styles.sectionTitle}>ギフト収益</Text>
      <View style={styles.statRow}>
        <StatCard label="累計ギフト額" value={`${Number(giftEarnings.total_gift_earnings || 0).toLocaleString()}pt`} color={Colors.primary} />
        <StatCard label="ギフト数" value={giftEarnings.gift_count} color={Colors.violet} />
      </View>

      {/* 7日間閲覧トレンド */}
      {viewTrend.length > 0 && (
        <BarChart
          data={viewTrend.map(d => ({ count: d.views, day: (d.date || '').slice(5) }))}
          label="過去7日間の閲覧数"
        />
      )}

      {/* 30日間ファントレンド */}
      {fanTrend.length > 0 && (
        <BarChart
          data={fanTrend.map(d => ({ count: d.new_fans, day: (d.date || '').slice(5) }))}
          label="過去30日間の新規ファン"
        />
      )}

      {/* エピソード別統計 */}
      {eps.length > 0 && (
        <>
          <Text style={styles.sectionTitle}>エピソード別統計</Text>
          {eps.map((ep) => (
            <View key={ep.id} style={styles.epRow}>
              <Text style={styles.epTitle} numberOfLines={1}>{ep.title}</Text>
              <View style={styles.epStats}>
                <Text style={styles.epStat}>👁️ {ep.view_count || 0}</Text>
                <Text style={styles.epStat}>❤️ {ep.like_count || 0}</Text>
                <Text style={styles.epStat}>💬 {ep.comment_count || 0}</Text>
              </View>
            </View>
          ))}
        </>
      )}
    </ScrollView>
  );
}

const chart = StyleSheet.create({
  wrap: {
    backgroundColor: Colors.card,
    borderRadius: 14,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  label: {
    color: Colors.muted,
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 12,
  },
  bars: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 4,
    height: 100,
  },
  barCol: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  bar: {
    width: '80%',
    backgroundColor: Colors.primary,
    borderRadius: 4,
  },
  barVal: {
    color: Colors.muted,
    fontSize: 9,
    marginBottom: 2,
  },
  barDay: {
    color: Colors.muted,
    fontSize: 9,
    marginTop: 4,
  },
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  content: {
    padding: 16,
    paddingBottom: 40,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.background,
  },
  notifyBtn: {
    backgroundColor: Colors.primary,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 20,
  },
  notifyBtnSent: {
    backgroundColor: Colors.emerald,
  },
  notifyBtnText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },
  error: {
    color: Colors.error,
    fontSize: 13,
    marginBottom: 12,
    textAlign: 'center',
  },
  sectionTitle: {
    color: Colors.muted,
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  statRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  statCard: {
    flex: 1,
    backgroundColor: Colors.card,
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
  },
  statValue: {
    color: Colors.foreground,
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 4,
  },
  statLabel: {
    color: Colors.muted,
    fontSize: 11,
    fontWeight: '600',
  },
  statSub: {
    color: Colors.muted,
    fontSize: 10,
    marginTop: 2,
  },
  epRow: {
    backgroundColor: Colors.card,
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  epTitle: {
    color: Colors.foreground,
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  epStats: {
    flexDirection: 'row',
    gap: 16,
  },
  epStat: {
    color: Colors.muted,
    fontSize: 13,
  },
});
