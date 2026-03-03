import { useState, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  Image,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  Dimensions,
} from 'react-native';
import { feedAPI, postAPI, adAPI, bookmarkAPI } from '../api/client';
import AdCard from '../components/AdCard';
import { useLanguage } from '../context/LanguageContext';
import { Colors } from '../theme/colors';
import { Shadows } from '../theme/styles';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// 投稿カードコンポーネント
function PostCard({ post, onPress, onLike, onBookmark }) {
  const { t } = useLanguage();
  const firstImage = post.images?.[0]?.image_url || post.images?.[0];
  const imageCount = post.images?.length || 0;
  
  return (
    <TouchableOpacity
      style={styles.card}
      onPress={onPress}
      activeOpacity={0.9}
    >
      {firstImage && (
        <View style={styles.imageContainer}>
          <Image
            source={{ uri: firstImage }}
            style={styles.image}
            resizeMode="cover"
          />
          {imageCount > 1 && (
            <View style={styles.imageCounter}>
              <Text style={styles.imageCounterText}>{imageCount}{t('home.imageCountSuffix')}</Text>
            </View>
          )}
        </View>
      )}
      
      <View style={styles.content}>
        <View style={styles.header}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {post.creator_name?.[0]?.toUpperCase() || '?'}
            </Text>
          </View>
          <View style={styles.headerText}>
            <Text style={styles.displayName}>{post.creator_name}</Text>
            <Text style={styles.username}>@{post.creator_username}</Text>
          </View>
        </View>

        <Text style={styles.title}>{post.title}</Text>
        {post.description && (
          <Text style={styles.description} numberOfLines={2}>
            {post.description}
          </Text>
        )}

        {post.series_title && (
          <View style={styles.seriesBadge}>
            <Text style={styles.seriesText}>📚 {post.series_title}</Text>
          </View>
        )}

        <View style={styles.stats}>
          <TouchableOpacity style={styles.statItem} onPress={onLike}>
            <Text style={styles.statIcon}>{post.is_liked ? '❤️' : '🤍'}</Text>
            <Text style={styles.statText}>{post.like_count || 0}</Text>
          </TouchableOpacity>
          <View style={styles.statItem}>
            <Text style={styles.statIcon}>💬</Text>
            <Text style={styles.statText}>{post.comment_count || 0}</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statIcon}>👁️</Text>
            <Text style={styles.statText}>{post.view_count || 0}</Text>
          </View>
          <TouchableOpacity style={[styles.statItem, styles.bookmarkItem]} onPress={onBookmark}>
            <Text style={styles.statIcon}>{post.is_bookmarked ? '🔖' : '🏷️'}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </TouchableOpacity>
  );
}

export default function HomeScreen({ navigation }) {
  const { t } = useLanguage();
  const [posts, setPosts] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [ad, setAd] = useState(null);

  useEffect(() => {
    loadPosts();
    loadAd();
  }, []);

  const loadAd = async () => {
    try {
      const response = await adAPI.getRandom();
      setAd(response);
    } catch (error) {
      console.error('Load ad error:', error);
    }
  };

  const loadPosts = async () => {
    try {
      setError('');
      const response = await feedAPI.getFeed();
      setPosts(response.posts || []);
    } catch (error) {
      console.error('Load posts error:', error);
      setError(t('home.loadError'));
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadPosts();
    setRefreshing(false);
  };

  const handlePostPress = (post) => {
    navigation?.navigate('PostDetail', { postId: post.id });
  };

  const handleLike = async (postId) => {
    try {
      const post = posts.find(p => p.id === postId);
      if (post?.is_liked) {
        await postAPI.unlike(postId);
      } else {
        await postAPI.like(postId);
      }
      loadPosts();
    } catch (error) {
      console.error('Like error:', error);
      setError(t('home.likeError'));
    }
  };

  const handleBookmark = async (postId) => {
    try {
      const post = posts.find(p => p.id === postId);
      if (post?.is_bookmarked) {
        await bookmarkAPI.remove(postId);
      } else {
        await bookmarkAPI.add(postId);
      }
      // ローカルで状態を更新（再フェッチ不要）
      setPosts(prev =>
        prev.map(p => p.id === postId ? { ...p, is_bookmarked: !p.is_bookmarked } : p)
      );
    } catch (error) {
      console.error('Bookmark error:', error);
    }
  };

  return (
    <View style={styles.container}>
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
            onPress={() => handlePostPress(item)}
            onLike={() => handleLike(item.id)}
            onBookmark={() => handleBookmark(item.id)}
          />
        )}
        ListHeaderComponent={() => (
          ad ? <AdCard ad={ad} /> : null
        )}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={Colors.primary}
          />
        }
        contentContainerStyle={styles.listContent}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  listContent: {
    padding: 16,
  },
  card: {
    backgroundColor: Colors.card,
    borderRadius: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
    ...Shadows.medium,
  },
  imageContainer: {
    width: '100%',
    height: SCREEN_WIDTH - 32,
    position: 'relative',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  imageCounter: {
    position: 'absolute',
    top: 12,
    right: 12,
    backgroundColor: 'rgba(10, 10, 15, 0.8)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  imageCounterText: {
    color: Colors.foreground,
    fontSize: 12,
    fontWeight: '600',
  },
  content: {
    padding: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  avatarText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: 'bold',
  },
  headerText: {
    flex: 1,
  },
  displayName: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.foreground,
  },
  username: {
    fontSize: 14,
    color: Colors.muted,
    marginTop: 2,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.foreground,
    marginBottom: 8,
  },
  description: {
    fontSize: 14,
    color: Colors.muted,
    marginBottom: 12,
    lineHeight: 20,
  },
  seriesBadge: {
    backgroundColor: 'rgba(183, 108, 200, 0.15)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    alignSelf: 'flex-start',
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(183, 108, 200, 0.3)',
  },
  seriesText: {
    fontSize: 12,
    color: Colors.violet,
    fontWeight: '600',
  },
  stats: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    paddingTop: 12,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 20,
  },
  statIcon: {
    fontSize: 18,
    marginRight: 6,
  },
  statText: {
    fontSize: 14,
    color: Colors.muted,
    fontWeight: '600',
  },
  bookmarkItem: {
    marginLeft: 'auto',
    marginRight: 0,
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
