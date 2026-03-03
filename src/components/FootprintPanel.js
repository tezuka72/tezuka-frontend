import { View, Text, StyleSheet } from 'react-native';
import { Colors } from '../theme/colors';

// 足跡の定義（順序固定）
const FOOTPRINT_DEFS = [
  { key: 'liked',          icon: '❤️',  label: '応援しました' },
  { key: 'read_completed', icon: '📖', label: '最後まで読みました' },
  { key: 'shared',         icon: '🚀', label: '共有しました' },
  { key: 'supported',      icon: '🔥', label: '制作を支えました' },
];

// footprints: { liked, read_completed, shared, supported } (boolean)
// isEarlySupporter: boolean
// 自分のみに表示。数値・日付はUIに出さない。
export default function FootprintPanel({ footprints = {}, isEarlySupporter = false, followersAfter = 0 }) {
  const active = FOOTPRINT_DEFS.filter(f => footprints[f.key]);

  if (active.length === 0 && !isEarlySupporter) return null;

  return (
    <View style={styles.container}>
      <Text style={styles.heading}>あなたの足跡</Text>
      {active.map(f => (
        <View key={f.key} style={styles.row}>
          <Text style={styles.icon}>{f.icon}</Text>
          <Text style={styles.label}>{f.label}</Text>
        </View>
      ))}
      {isEarlySupporter && (
        <View style={styles.earlyRow}>
          <Text style={styles.earlyLabel}>✨ 初期から応援しています</Text>
          {followersAfter > 0 && (
            <Text style={styles.deltaLabel}>
              あなたの後に {followersAfter.toLocaleString()} 人がこの物語に参加しました
            </Text>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: 'rgba(183, 108, 200, 0.07)',
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginHorizontal: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(183, 108, 200, 0.18)',
  },
  heading: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.muted,
    letterSpacing: 0.6,
    marginBottom: 10,
    textTransform: 'uppercase',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 7,
  },
  icon: {
    fontSize: 15,
    marginRight: 8,
    lineHeight: 20,
  },
  label: {
    fontSize: 14,
    color: Colors.foreground,
    fontWeight: '500',
  },
  earlyRow: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(183, 108, 200, 0.2)',
  },
  earlyLabel: {
    fontSize: 13,
    color: Colors.violet,
    fontWeight: '600',
  },
  deltaLabel: {
    fontSize: 12,
    color: Colors.muted,
    marginTop: 4,
    lineHeight: 17,
  },
});
