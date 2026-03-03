import { View, Text, StyleSheet } from 'react-native';
import { useLanguage } from '../context/LanguageContext';
import { Colors } from '../theme/colors';

export default function InboxScreen() {
  const { t } = useLanguage();

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>{t('inbox.title')}</Text>
      </View>
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyIcon}>📬</Text>
        <Text style={styles.emptyText}>{t('inbox.empty')}</Text>
        <Text style={styles.emptySubtext}>{t('inbox.emptyHint')}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: Colors.foreground,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  emptyIcon: { fontSize: 56, marginBottom: 20 },
  emptyText: { fontSize: 18, fontWeight: 'bold', color: Colors.foreground, marginBottom: 8 },
  emptySubtext: { fontSize: 14, color: Colors.muted, textAlign: 'center', lineHeight: 22 },
});
