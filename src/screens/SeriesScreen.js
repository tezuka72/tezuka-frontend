import { useState, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { seriesAPI } from '../api/client';
import { useLanguage } from '../context/LanguageContext';
import { Colors } from '../theme/colors';
import { Shadows } from '../theme/styles';

export default function SeriesScreen({ navigation }) {
  const { t } = useLanguage();
  const [series, setSeries] = useState([]);
  const [error, setError] = useState('');

  useEffect(() => {
    loadSeries();
  }, []);

  const loadSeries = async () => {
    try {
      setError('');
      const response = await seriesAPI.getAll();
      setSeries(response.series || []);
    } catch (error) {
      console.error('Load series error:', error);
      setError(t('series.loadError'));
    }
  };

  const renderSeriesCard = ({ item }) => (
    <TouchableOpacity
      style={styles.card}
      onPress={() => navigation?.navigate('SeriesDetail', { seriesId: item.id })}
    >
      <View style={styles.cardHeader}>
        <Text style={styles.seriesIcon}>📚</Text>
        <View style={styles.cardInfo}>
          <Text style={styles.title}>{item.title}</Text>
          <Text style={styles.creator}>by {item.creator_name}</Text>
        </View>
      </View>
      {item.description && (
        <Text style={styles.description} numberOfLines={2}>
          {item.description}
        </Text>
      )}
      <View style={styles.meta}>
        <Text style={styles.metaText}>{item.episode_count || 0}{t('series.episodeSuffix')}</Text>
        <Text style={styles.metaText}>👁️ {item.view_count || 0}</Text>
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      {error ? (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>{t('series.title')}</Text>
        <Text style={styles.headerSubtitle}>{t('series.subtitle')}</Text>
      </View>
      <FlatList
        data={series}
        keyExtractor={(item) => item.id.toString()}
        renderItem={renderSeriesCard}
        contentContainerStyle={styles.list}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    padding: 24,
    backgroundColor: Colors.card,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: Colors.foreground,
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 14,
    color: Colors.muted,
  },
  list: {
    padding: 16,
  },
  card: {
    backgroundColor: Colors.card,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    ...Shadows.small,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  seriesIcon: {
    fontSize: 32,
    marginRight: 12,
  },
  cardInfo: {
    flex: 1,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.foreground,
    marginBottom: 4,
  },
  creator: {
    fontSize: 14,
    color: Colors.muted,
  },
  description: {
    fontSize: 14,
    color: Colors.muted,
    lineHeight: 20,
    marginBottom: 12,
  },
  meta: {
    flexDirection: 'row',
    gap: 16,
  },
  metaText: {
    fontSize: 12,
    color: Colors.muted,
    fontWeight: '600',
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
