import { useState, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  Image,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
} from 'react-native';
import { feedAPI, postAPI } from '../api/client';
import { useLanguage } from '../context/LanguageContext';
import { Colors } from '../theme/colors';
import { Shadows } from '../theme/styles';

function PostCard({ post, onPress, onLike }) {
  const { t } = useLanguage();
  const firstImage = post.images?.[0]?.image_url || post.images?.[0];
  const imageCount = post.images?.length || 0;

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.9}>
      {firstImage && (
        <View style={styles.imageContainer}>
          <Image source={{ uri: firstImage }} style={styles.image} resizeMode="cover" />
          {imageCount > 1 && (
            <View style={styles.imageCounter}>
              <Text style={styles.imageCounterText}>{imageCount}{t('home.imageCountSuffix')}</Text>
            </View>
          )}
        </View>
      )}
      <View style={styles.cardContent}>
        <View style={styles.cardHeader}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {post.display_name?.[0]?.toUpperCase() || '?'}
            </Text>
          </View>
          <View style={styles.headerText}>
            <Text style={styles.displayName}>{post.display_name}</Text>
            <Text style={styles.username}>@{post.username}</Text>
          </View>
        </View>
        <Text style={styles.title}>{post.title}</Text>
        <View style={styles.stats}>
          <TouchableOpacity style={styles.statItem} onPress={onLike}>
            <Text style={styles.statIcon}>{post.is_liked ? '❤️' : '🤍'}</Text>
            <Text style={styles.statText}>{post.like_count || 0}</Text>
          </TouchableOpacity>
          <View style={styles.statItem}>
            <Text style={styles.statIcon}>💬</Text>
            <Text style={styles.statText}>{post.comment_count || 0}</Text>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
}

export default function FriendsScreen({ navigation }) {
  const { t } = useLanguage();
  const [posts, setPosts] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    loadPosts();
  }, []);

  const loadPosts = async () => {
    try {
      setError('');
      const response = await feedAPI.getFollowingFeed();
      setPosts(response.posts || []);
    } catch (err) {
      setError(t('friends.loadError'));
    }
  };

  const handleLike = async (postId) => {
    try {
      const post = posts.find((p) => p.id === postId);
      if (post?.is_liked) {
        await postAPI.unlike(postId);
      } else {
        await postAPI.like(postId);
      }
      loadPosts();
    } catch (err) {
      console.error('Like error:', err);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>{t('friends.title')}</Text>
      </View>
      {error ? (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}
      <FlatList
        data={posts}
        keyExtractor={(item) => item.id.toString()}
        renderItem={({ item }) => (
          <PostCard
            post={item}
            onPress={() => navigation?.navigate('PostDetail', { postId: item.id })}
            onLike={() => handleLike(item.id)}
          />
        )}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyIcon}>👥</Text>
            <Text style={styles.emptyText}>{t('friends.empty')}</Text>
            <Text style={styles.emptySubtext}>{t('friends.emptyHint')}</Text>
          </View>
        }
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={async () => {
              setRefreshing(true);
              await loadPosts();
              setRefreshing(false);
            }}
            tintColor={Colors.primary}
          />
        }
        contentContainerStyle={styles.listContent}
      />
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
  listContent: { padding: 16, flexGrow: 1 },
  card: {
    backgroundColor: Colors.card,
    borderRadius: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
    ...Shadows.medium,
  },
  imageContainer: { width: '100%', height: 200, position: 'relative' },
  image: { width: '100%', height: '100%' },
  imageCounter: {
    position: 'absolute',
    top: 12,
    right: 12,
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  imageCounterText: { color: '#fff', fontSize: 12, fontWeight: '600' },
  cardContent: { padding: 16 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  avatarText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  headerText: { flex: 1 },
  displayName: { fontSize: 15, fontWeight: '600', color: Colors.foreground },
  username: { fontSize: 13, color: Colors.muted },
  title: { fontSize: 16, fontWeight: 'bold', color: Colors.foreground, marginBottom: 10 },
  stats: { flexDirection: 'row', borderTopWidth: 1, borderTopColor: Colors.border, paddingTop: 10 },
  statItem: { flexDirection: 'row', alignItems: 'center', marginRight: 16 },
  statIcon: { fontSize: 16, marginRight: 4 },
  statText: { fontSize: 13, color: Colors.muted, fontWeight: '600' },
  emptyContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 80 },
  emptyIcon: { fontSize: 48, marginBottom: 16 },
  emptyText: { fontSize: 18, fontWeight: 'bold', color: Colors.foreground, marginBottom: 8 },
  emptySubtext: { fontSize: 14, color: Colors.muted, textAlign: 'center', lineHeight: 20 },
  errorContainer: { backgroundColor: '#FFE0E0', padding: 12, borderBottomWidth: 1, borderBottomColor: '#FF6B6B' },
  errorText: { color: '#C92A2A', fontSize: 14 },
});
