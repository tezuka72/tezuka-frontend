import { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
} from 'react-native';
import { earningsAPI } from '../api/client';
import { useLanguage } from '../context/LanguageContext';
import { Colors } from '../theme/colors';
import { Shadows } from '../theme/styles';

export default function EarningsDashboardScreen() {
  const { t } = useLanguage();
  const [earnings, setEarnings] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    loadEarnings();
  }, []);

  const loadEarnings = async () => {
    try {
      setError('');
      const response = await earningsAPI.getDashboard();
      setEarnings(response);
    } catch (error) {
      console.error('Load earnings error:', error);
      setError(t('earnings.loadError'));
    }
  };

  const StatCard = ({ title, value, icon, color }) => (
    <View style={[styles.statCard, { borderLeftColor: color, borderLeftWidth: 4 }]}>
      <Text style={styles.statIcon}>{icon}</Text>
      <View style={styles.statInfo}>
        <Text style={styles.statTitle}>{title}</Text>
        <Text style={styles.statValue}>{value}</Text>
      </View>
    </View>
  );

  return (
    <ScrollView style={styles.container}>
      {error ? (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}
      <View style={styles.header}>
        <Text style={styles.logo}>💰</Text>
        <Text style={styles.title}>{t('earnings.title')}</Text>
        <Text style={styles.subtitle}>{t('earnings.subtitle')}</Text>
      </View>

      <View style={styles.content}>
        <View style={styles.totalCard}>
          <Text style={styles.totalLabel}>{t('earnings.total')}</Text>
          <Text style={styles.totalValue}>
            ¥{earnings?.total || 0}
          </Text>
        </View>

        <View style={styles.statsGrid}>
          <StatCard
            title={t('earnings.tips')}
            value={`¥${earnings?.tips || 0}`}
            icon="💝"
            color={Colors.rose}
          />
          <StatCard
            title={t('earnings.subscriptions')}
            value={`¥${earnings?.subscriptions || 0}`}
            icon="⭐"
            color={Colors.amber}
          />
          <StatCard
            title={t('earnings.affiliates')}
            value={`¥${earnings?.affiliates || 0}`}
            icon="📢"
            color={Colors.cyan}
          />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('earnings.thisMonthSection')}</Text>
          <View style={styles.detailCard}>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>{t('earnings.thisMonth')}</Text>
              <Text style={styles.detailValue}>¥{earnings?.thisMonth || 0}</Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>{t('earnings.growth')}</Text>
              <Text style={[styles.detailValue, styles.detailGrowth]}>
                +{earnings?.growth || 0}%
              </Text>
            </View>
          </View>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    alignItems: 'center',
    padding: 24,
    backgroundColor: Colors.card,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  logo: {
    fontSize: 48,
    marginBottom: 8,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: Colors.foreground,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: Colors.muted,
  },
  content: {
    padding: 16,
  },
  totalCard: {
    backgroundColor: Colors.card,
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    marginBottom: 20,
    borderWidth: 2,
    borderColor: Colors.primary,
    ...Shadows.glow,
  },
  totalLabel: {
    fontSize: 14,
    color: Colors.muted,
    marginBottom: 8,
    fontWeight: '600',
  },
  totalValue: {
    fontSize: 40,
    fontWeight: 'bold',
    color: Colors.primary,
  },
  statsGrid: {
    gap: 12,
    marginBottom: 24,
  },
  statCard: {
    backgroundColor: Colors.card,
    borderRadius: 16,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
    ...Shadows.small,
  },
  statIcon: {
    fontSize: 32,
    marginRight: 16,
  },
  statInfo: {
    flex: 1,
  },
  statTitle: {
    fontSize: 14,
    color: Colors.muted,
    marginBottom: 4,
  },
  statValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: Colors.foreground,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.foreground,
    marginBottom: 12,
  },
  detailCard: {
    backgroundColor: Colors.card,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  detailLabel: {
    fontSize: 14,
    color: Colors.muted,
  },
  detailValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: Colors.foreground,
  },
  detailGrowth: {
    color: Colors.success,
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
