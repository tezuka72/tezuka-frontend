import { useState, useCallback, useEffect, useRef } from 'react';
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

// ユーザー検索結果アイテム
function UserCard({ item, onPress }) {
  return (
    <TouchableOpacity style={styles.userCard} onPress={onPress} activeOpacity={0.8}>
      {item.avatar_url ? (
        <Image source={{ uri: item.avatar_url }} style={styles.userAvatar} contentFit="cover" cachePolicy="memory-disk" />
      ) : (
        <View style={styles.userAvatarPlaceholder}>
          <Text style={styles.userAvatarInitial}>{(item.display_name || item.username || '?')[0].toUpperCase()}</Text>
        </View>
      )}
      <View style={styles.userInfo}>
        <View style={styles.userNameRow}>
          <Text style={styles.userDisplayName} numberOfLines={1}>{item.display_name || item.username}</Text>
          {item.is_verified && <Text style={styles.verifiedBadge}> ✓</Text>}
        </View>
        <Text style={styles.userUsername} numberOfLines={1}>@{item.username}</Text>
        {item.bio ? <Text style={styles.userBio} numberOfLines={1}>{item.bio}</Text> : null}
      </View>
      <Text style={styles.userFollowers}>{formatCount(item.follower_count || 0)}{'\n'}フォロワー</Text>
    </TouchableOpacity>
  );
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
  const [activeTab, setActiveTab] = useState('posts'); // 'posts' | 'accounts'
  const [results, setResults] = useState([]);
  const [userResults, setUserResults] = useState([]);
  const [trending, setTrending] = useState([]);
  const [loading, setLoading] = useState(false);
  const [trendingLoading, setTrendingLoading] = useState(true);
  const [searched, setSearched] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const data = await feedAPI.getTrending({ limit: 30 });
        setTrending(data.posts || []);
      } catch (e) {}
      finally { setTrendingLoading(false); }
    })();
  }, []);

  const debounceTimer = useRef(null);

  const doSearch = useCallback(async (q) => {
    const trimmed = q.trim();
    if (!trimmed) return;
    setLoading(true);
    setSearched(true);
    try {
      const [postData, userData] = await Promise.all([
        feedAPI.search(trimmed),
        feedAPI.searchUsers(trimmed, 20),
      ]);
      setResults(postData.posts || []);
      setUserResults(userData.users || []);
    } catch (e) {
      setResults([]);
      setUserResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleChangeText = (text) => {
    setQuery(text);
    if (!text.trim()) {
      setSearched(false);
      setResults([]);
      setUserResults([]);
      clearTimeout(debounceTimer.current);
      return;
    }
    // 400ms デバウンスでリアルタイム検索
    clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => doSearch(text), 400);
  };

  const handleSubmit = () => {
    clearTimeout(debounceTimer.current);
    doSearch(query);
  };

  const handleClear = () => {
    clearTimeout(debounceTimer.current);
    setQuery('');
    setResults([]);
    setUserResults([]);
    setSearched(false);
  };

  const isHashtagSearch = activeTab === 'posts' && query.startsWith('#');
  const placeholder = activeTab === 'accounts'
    ? 'ユーザー名・表示名で検索'
    : '#ハッシュタグ または タイトル・作者名で検索';
  const showGrid = !searched && !loading && activeTab === 'posts';

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    if (searched && query.trim()) doSearch(query);
  };

  return (
    <KeyboardAvoidingView
      style={[styles.container, { paddingTop: insets.top }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {/* 検索バー */}
      <View style={styles.searchBar}>
        {isHashtagSearch
          ? <Text style={styles.hashtagIcon}>#</Text>
          : <Ionicons name="search-outline" size={20} color={Colors.muted} style={styles.searchIcon} />
        }
        <TextInput
          style={styles.searchInput}
          value={query}
          onChangeText={handleChangeText}
          onSubmitEditing={handleSubmit}
          placeholder={placeholder}
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

      {/* タブ切り替え */}
      <View style={styles.tabRow}>
        <TouchableOpacity
          style={[styles.tabBtn, activeTab === 'posts' && styles.tabBtnActive]}
          onPress={() => handleTabChange('posts')}
          activeOpacity={0.8}
        >
          <Ionicons name="book-outline" size={15} color={activeTab === 'posts' ? Colors.primary : Colors.muted} />
          <Text style={[styles.tabText, activeTab === 'posts' && styles.tabTextActive]}>投稿</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tabBtn, activeTab === 'accounts' && styles.tabBtnActive]}
          onPress={() => handleTabChange('accounts')}
          activeOpacity={0.8}
        >
          <Ionicons name="people-outline" size={15} color={activeTab === 'accounts' ? Colors.primary : Colors.muted} />
          <Text style={[styles.tabText, activeTab === 'accounts' && styles.tabTextActive]}>アカウント</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={Colors.primary} />
        </View>
      ) : activeTab === 'accounts' ? (
        /* ── アカウントタブ ── */
        !searched ? (
          <View style={styles.center}>
            <Ionicons name="people-outline" size={48} color={Colors.muted} />
            <Text style={[styles.emptyText, { marginTop: 12 }]}>ユーザー名や表示名で検索してください</Text>
          </View>
        ) : userResults.length === 0 ? (
          <View style={styles.center}>
            <Text style={styles.emptyIcon}>🔍</Text>
            <Text style={styles.emptyText}>「{query}」のアカウントは見つかりませんでした</Text>
          </View>
        ) : (
          <FlatList
            keyboardShouldPersistTaps="handled"
            data={userResults}
            keyExtractor={item => `user_${item.id}`}
            renderItem={({ item }) => (
              <UserCard
                item={item}
                onPress={() => navigation.navigate('UserProfile', { username: item.username })}
              />
            )}
            ItemSeparatorComponent={() => <View style={styles.separator} />}
            contentContainerStyle={{ paddingBottom: 20 }}
            ListHeaderComponent={
              <Text style={styles.sectionLabel}>{userResults.length}件のアカウント</Text>
            }
          />
        )
      ) : /* ── 投稿タブ ── */
      searched ? (
        results.length === 0 ? (
          <View style={styles.center}>
            <Text style={styles.emptyIcon}>🔍</Text>
            <Text style={styles.emptyText}>「{query}」に一致する投稿は見つかりませんでした</Text>
          </View>
        ) : (
          <FlatList
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.list}
            data={results}
            keyExtractor={item => `post_${item.id}`}
            renderItem={({ item }) => (
              <PostCard
                item={item}
                onPress={() => navigation.navigate('PostDetail', { postId: item.id })}
              />
            )}
            ItemSeparatorComponent={() => <View style={styles.separator} />}
            ListHeaderComponent={
              <Text style={styles.sectionLabel}>
                {isHashtagSearch ? `#${query.slice(1)} · ` : ''}{results.length}件の投稿
              </Text>
            }
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
            ListHeaderComponent={<Text style={styles.sectionLabel}>人気の投稿</Text>}
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
  hashtagIcon: { fontSize: 20, fontWeight: '800', color: Colors.primary, marginRight: 8, lineHeight: 24 },
  searchInput: {
    flex: 1,
    paddingVertical: 12,
    color: Colors.foreground,
    fontSize: 15,
  },
  clearBtn: { padding: 4 },
  tabRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    backgroundColor: Colors.background,
  },
  tabBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabBtnActive: {
    borderBottomColor: Colors.primary,
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.muted,
  },
  tabTextActive: {
    color: Colors.primary,
  },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  emptyIcon: { fontSize: 48, marginBottom: 16 },
  emptyText: { color: Colors.muted, fontSize: 14, textAlign: 'center' },

  // ユーザーカード
  userCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: Colors.card,
    gap: 12,
  },
  userAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.border,
  },
  userAvatarPlaceholder: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  userAvatarInitial: { color: '#fff', fontWeight: 'bold', fontSize: 20 },
  userInfo: { flex: 1 },
  userNameRow: { flexDirection: 'row', alignItems: 'center' },
  userDisplayName: { color: Colors.foreground, fontWeight: '700', fontSize: 15 },
  verifiedBadge: { color: Colors.primary, fontWeight: '700', fontSize: 13 },
  userUsername: { color: Colors.muted, fontSize: 13, marginTop: 1 },
  userBio: { color: Colors.muted, fontSize: 12, marginTop: 3 },
  userFollowers: { color: Colors.muted, fontSize: 11, textAlign: 'center', lineHeight: 16 },

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
