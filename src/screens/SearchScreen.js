import { useState, useCallback, useEffect } from 'react';
import {
  View, Text, TextInput, FlatList, TouchableOpacity, StyleSheet,
  ActivityIndicator, KeyboardAvoidingView, Platform, Dimensions,
} from 'react-native';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { feedAPI } from '../api/client';
import { Colors } from '../theme/colors';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const GRID_COLS = 3;
const GRID_GAP = 2;
const CELL_SIZE = (SCREEN_WIDTH - GRID_GAP * (GRID_COLS + 1)) / GRID_COLS;

// 3カラムグリッドアイテム
function GridItem({ item, onPress }) {
  const thumb = item.thumbnail_url || item.images?.[0]?.image_url || item.images?.[0];
  return (
    <TouchableOpacity style={styles.gridItem} onPress={onPress} activeOpacity={0.85}>
      {thumb ? (
        <Image source={{ uri: thumb }} style={styles.gridImage} contentFit="cover" cachePolicy="memory-disk" />
      ) : (
        <View style={[styles.gridImage, styles.gridImagePlaceholder]}>
          <Text style={{ fontSize: 24 }}>📖</Text>
        </View>
      )}
      <View style={styles.gridOverlay}>
        <Ionicons name="eye-outline" size={11} color="#fff" />
        <Text style={styles.gridViews}>{formatCount(item.view_count || 0)}</Text>
      </View>
    </TouchableOpacity>
  );
}

function formatCount(n) {
  if (n >= 10000) return `${(n / 10000).toFixed(1)}万`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return String(n);
}

// リスト形式の検索結果アイテム
function PostCard({ item, onPress }) {
  const firstImage = item.thumbnail_url || item.images?.[0]?.image_url || item.images?.[0];
  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.8}>
      {firstImage ? (
        <Image source={{ uri: firstImage }} style={styles.cardImage} contentFit="cover" cachePolicy="memory-disk" />
      ) : (
        <View style={[styles.cardImage, styles.cardImagePlaceholder]}>
          <Text style={{ fontSize: 28 }}>📖</Text>
        </View>
      )}
      <View style={styles.cardBody}>
        <Text style={styles.cardTitle} numberOfLines={2}>{item.title}</Text>
        <Text style={styles.cardUser} numberOfLines={1}>
          @{item.username}{item.display_name ? ` · ${item.display_name}` : ''}
        </Text>
        {item.series_title && (
          <Text style={styles.cardSeries} numberOfLines={1}>📚 {item.series_title}</Text>
        )}
        <View style={styles.cardStats}>
          <Text style={styles.cardStat}>❤️ {item.like_count || 0}</Text>
          <Text style={styles.cardStat}>👁️ {formatCount(item.view_count || 0)}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

export default function SearchScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [trending, setTrending] = useState([]);
  const [loading, setLoading] = useState(false);
  const [trendingLoading, setTrendingLoading] = useState(true);
  const [searched, setSearched] = useState(false);

  // 画面を開いたらトレンドをロード
  useEffect(() => {
    (async () => {
      try {
        const data = await feedAPI.getTrending({ limit: 30 });
        setTrending(data.posts || []);
      } catch (e) {
        console.error('Trending load error:', e);
      } finally {
        setTrendingLoading(false);
      }
    })();
  }, []);

  const doSearch = useCallback(async (q) => {
    const trimmed = q.trim();
    if (!trimmed) return;
    setLoading(true);
    setSearched(true);
    try {
      const data = await feedAPI.search(trimmed);
      setResults(data.posts || []);
    } catch (e) {
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleSubmit = () => doSearch(query);

  const handleClear = () => {
    setQuery('');
    setResults([]);
    setSearched(false);
  };

  const showGrid = !searched && !loading;
  const showResults = searched;

  return (
    <KeyboardAvoidingView
      style={[styles.container, { paddingTop: insets.top }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {/* 検索バー */}
      <View style={styles.searchBar}>
        <Ionicons name="search-outline" size={20} color={Colors.muted} style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          value={query}
          onChangeText={setQuery}
          onSubmitEditing={handleSubmit}
          placeholder="タイトル・作者名で検索"
          placeholderTextColor={Colors.muted}
          returnKeyType="search"
          autoCapitalize="none"
          autoCorrect={false}
        />
        {query.length > 0 && (
          <TouchableOpacity onPress={handleClear} style={styles.clearBtn}>
            <Ionicons name="close-circle" size={18} color={Colors.muted} />
          </TouchableOpacity>
        )}
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={Colors.primary} />
        </View>
      ) : showResults ? (
        results.length === 0 ? (
          <View style={styles.center}>
            <Text style={styles.emptyIcon}>🔍</Text>
            <Text style={styles.emptyText}>「{query}」に一致する投稿が見つかりませんでした</Text>
          </View>
        ) : (
          <FlatList
            data={results}
            keyExtractor={item => String(item.id)}
            renderItem={({ item }) => (
              <PostCard
                item={item}
                onPress={() => navigation.navigate('PostDetail', { postId: item.id })}
              />
            )}
            contentContainerStyle={styles.list}
            keyboardShouldPersistTaps="handled"
            ItemSeparatorComponent={() => <View style={styles.separator} />}
          />
        )
      ) : showGrid ? (
        trendingLoading ? (
          <View style={styles.center}>
            <ActivityIndicator color={Colors.primary} />
          </View>
        ) : (
          <FlatList
            data={trending}
            keyExtractor={item => String(item.id)}
            numColumns={GRID_COLS}
            columnWrapperStyle={styles.gridRow}
            renderItem={({ item }) => (
              <GridItem
                item={item}
                onPress={() => navigation.navigate('PostDetail', { postId: item.id })}
              />
            )}
            contentContainerStyle={styles.gridContainer}
            keyboardShouldPersistTaps="handled"
            ListHeaderComponent={
              <Text style={styles.sectionLabel}>人気の投稿</Text>
            }
          />
        )
      ) : null}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    margin: 12,
    backgroundColor: Colors.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 12,
  },
  searchIcon: { marginRight: 8 },
  searchInput: {
    flex: 1,
    paddingVertical: 12,
    color: Colors.foreground,
    fontSize: 15,
  },
  clearBtn: { padding: 4 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  emptyIcon: { fontSize: 48, marginBottom: 16 },
  emptyText: { color: Colors.muted, fontSize: 14, textAlign: 'center' },

  // グリッド
  sectionLabel: {
    color: Colors.muted,
    fontSize: 12,
    fontWeight: '600',
    paddingHorizontal: GRID_GAP,
    paddingVertical: 8,
  },
  gridContainer: { paddingBottom: 20 },
  gridRow: { gap: GRID_GAP, paddingHorizontal: GRID_GAP, marginBottom: GRID_GAP },
  gridItem: {
    width: CELL_SIZE,
    height: CELL_SIZE * 1.3,
    position: 'relative',
  },
  gridImage: {
    width: '100%',
    height: '100%',
    borderRadius: 4,
  },
  gridImagePlaceholder: {
    backgroundColor: Colors.card,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 4,
  },
  gridOverlay: {
    position: 'absolute',
    bottom: 4,
    left: 4,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 6,
  },
  gridViews: { color: '#fff', fontSize: 10, fontWeight: '600' },

  // 検索結果リスト
  list: { paddingHorizontal: 12, paddingBottom: 20 },
  separator: { height: 1, backgroundColor: Colors.border },
  card: { flexDirection: 'row', paddingVertical: 12, alignItems: 'flex-start' },
  cardImage: {
    width: 72,
    height: 96,
    borderRadius: 8,
    backgroundColor: Colors.card,
    marginRight: 12,
  },
  cardImagePlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  cardBody: { flex: 1 },
  cardTitle: { fontSize: 15, fontWeight: '600', color: Colors.foreground, marginBottom: 4 },
  cardUser: { fontSize: 12, color: Colors.muted, marginBottom: 4 },
  cardSeries: { fontSize: 12, color: Colors.primary, marginBottom: 6 },
  cardStats: { flexDirection: 'row', gap: 12 },
  cardStat: { fontSize: 12, color: Colors.muted },
});
