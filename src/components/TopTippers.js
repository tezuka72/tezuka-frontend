import { useEffect, useState } from 'react';
import { View, Text, FlatList, Image, StyleSheet } from 'react-native';
import { tipsAPI } from '../api/client';
import { useLanguage } from '../context/LanguageContext';

export default function TopTippers({ postId }) {
  const { t } = useLanguage();
  const [topTippers, setTopTippers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadTopTippers();
  }, [postId]);

  const loadTopTippers = async () => {
    try {
      const data = await tipsAPI.getTopTippers(postId);
      setTopTippers(data.topTippers || []);
    } catch (error) {
      console.error('Load top tippers error:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading || topTippers.length === 0) {
    return null;
  }

  const renderTipper = ({ item, index }) => (
    <View style={styles.tipperItem}>
      <View style={styles.rankBadge}>
        <Text style={styles.rankText}>#{index + 1}</Text>
      </View>
      
      <Image
        source={{ uri: item.avatar_url || 'https://via.placeholder.com/40' }}
        style={styles.avatar}
      />
      
      <View style={styles.tipperInfo}>
        <Text style={styles.username}>{item.display_name || item.username}</Text>
        <Text style={styles.tipAmount}>
          ¥{parseInt(item.total_amount)} ({item.tip_count}{t('tippers.timesSuffix')})
        </Text>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{t('tippers.title')}</Text>
      <Text style={styles.subtitle}>{t('tippers.subtitle')}</Text>
      
      <FlatList
        data={topTippers}
        renderItem={renderTipper}
        keyExtractor={(item) => item.id.toString()}
        scrollEnabled={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#fff',
    padding: 16,
    marginVertical: 12,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 4,
    color: '#1a1a1a',
  },
  subtitle: {
    fontSize: 13,
    color: '#666',
    marginBottom: 16,
  },
  tipperItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  rankBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#ffd700',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  rankText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#fff',
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 12,
    backgroundColor: '#f0f0f0',
  },
  tipperInfo: {
    flex: 1,
  },
  username: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1a1a1a',
    marginBottom: 2,
  },
  tipAmount: {
    fontSize: 13,
    color: '#666',
  },
});
