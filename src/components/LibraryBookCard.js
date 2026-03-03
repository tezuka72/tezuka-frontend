import { View, Text, Image, TouchableOpacity, StyleSheet } from 'react-native';
import { Colors } from '../theme/colors';
import { Shadows } from '../theme/styles';

// My Library 用の作品カード
// ・足跡・貢献実績は表示しない
// ・数値（フォロー数・いいね数）は表示しない
// series: {
//   series_id, title, cover_image_url,
//   creator_username, creator_name,
//   has_update, last_episode_id
// }
export default function LibraryBookCard({ series, onPress, onContinue }) {
  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.88}>
      {/* サムネイル */}
      {series.cover_image_url ? (
        <Image
          source={{ uri: series.cover_image_url }}
          style={styles.cover}
          resizeMode="cover"
        />
      ) : (
        <View style={[styles.cover, styles.coverPlaceholder]}>
          <Text style={styles.coverPlaceholderText}>📚</Text>
        </View>
      )}

      {/* 情報エリア */}
      <View style={styles.info}>
        <Text style={styles.title} numberOfLines={2}>
          {series.title}
        </Text>
        <Text style={styles.creator} numberOfLines={1}>
          @{series.creator_username || series.creator_name}
        </Text>

        {/* 新着バッジ（数値なし・存在を示すだけ） */}
        {series.has_update && (
          <View style={styles.updateBadge}>
            <Text style={styles.updateText}>新着</Text>
          </View>
        )}

        {/* 続きから読むボタン（進捗が記録されている場合のみ） */}
        {series.last_episode_id && onContinue && (
          <TouchableOpacity
            style={styles.continueBtn}
            onPress={onContinue}
            activeOpacity={0.8}
          >
            <Text style={styles.continueBtnText}>続きから読む →</Text>
          </TouchableOpacity>
        )}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    backgroundColor: Colors.card,
    borderRadius: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
    ...Shadows.medium,
  },
  cover: {
    width: 72,
    height: 100,
    backgroundColor: Colors.border,
  },
  coverPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  coverPlaceholderText: {
    fontSize: 28,
  },
  info: {
    flex: 1,
    padding: 12,
    justifyContent: 'center',
    gap: 4,
  },
  title: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.foreground,
    lineHeight: 20,
  },
  creator: {
    fontSize: 12,
    color: Colors.muted,
  },
  updateBadge: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(37, 99, 235, 0.15)',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: 'rgba(37, 99, 235, 0.3)',
    marginTop: 4,
  },
  updateText: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.primary,
  },
  continueBtn: {
    alignSelf: 'flex-start',
    marginTop: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: Colors.background,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  continueBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.foreground,
  },
});
