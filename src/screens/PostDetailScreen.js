import { useState, useEffect } from 'react';
import {
  View,
  Text,
  Image,
  ScrollView,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
} from 'react-native';
import { postAPI, footprintAPI } from '../api/client';
import { useLanguage } from '../context/LanguageContext';
import { Colors } from '../theme/colors';
import { Shadows } from '../theme/styles';
import SupportModal from '../components/SupportModal';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export default function PostDetailScreen({ route }) {
  const { postId } = route.params;
  const { t } = useLanguage();
  const [post, setPost] = useState(null);
  const [comments, setComments] = useState([]);
  const [commentText, setCommentText] = useState('');
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [supportModalVisible, setSupportModalVisible] = useState(false);

  useEffect(() => {
    loadPost();
    loadComments();
  }, [postId]);

  const loadPost = async () => {
    try {
      setError('');
      setIsLoading(true);
      const response = await postAPI.getPost(postId);
      setPost(response.post);
    } catch (e) {
      console.error('Load post error:', e);
      setError(t('postDetail.loadError'));
    } finally {
      setIsLoading(false);
    }
  };

  const loadComments = async () => {
    try {
      const response = await postAPI.getComments(postId);
      setComments(response.comments || []);
    } catch (e) {
      console.error('Load comments error:', e);
      setError(t('postDetail.commentLoadError'));
    }
  };

  const handleLike = async () => {
    try {
      if (post.is_liked) {
        await postAPI.unlike(postId);
      } else {
        await postAPI.like(postId);
        if (post.series_id) {
          footprintAPI.record(post.series_id, 'liked').catch(() => {});
        }
      }
      loadPost();
    } catch (e) {
      console.error('Like error:', e);
    }
  };

  // スクロール末尾で読了足跡を記録
  const handleScrollEnd = () => {
    if (post?.series_id) {
      footprintAPI.record(post.series_id, 'read_completed').catch(() => {});
    }
  };

  const handleComment = async () => {
    if (!commentText.trim()) return;
    try {
      await postAPI.addComment(postId, commentText);
      setCommentText('');
      loadComments();
    } catch (e) {
      console.error('Comment error:', e);
      setError(t('postDetail.commentPostError'));
    }
  };

  if (!post) {
    return (
      <View style={styles.container}>
        <Text style={styles.loading}>{t('common.loading')}</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {error ? (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      <ScrollView onScrollEndDrag={handleScrollEnd} scrollEventThrottle={400}>
        {post.images && post.images.length > 0 && (
          <View style={styles.imageContainer}>
            <Image
              source={{ uri: post.images[currentImageIndex]?.image_url || post.images[currentImageIndex] }}
              style={styles.image}
              resizeMode="cover"
            />
            {post.images.length > 1 && (
              <View style={styles.imageCounter}>
                <Text style={styles.imageCounterText}>
                  {currentImageIndex + 1} / {post.images.length}
                </Text>
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
            <View>
              <Text style={styles.displayName}>{post.creator_name}</Text>
              <Text style={styles.username}>@{post.creator_username}</Text>
            </View>
          </View>

          <Text style={styles.title}>{post.title}</Text>
          {post.description && (
            <Text style={styles.description}>{post.description}</Text>
          )}

          <View style={styles.actions}>
            <TouchableOpacity style={styles.actionButton} onPress={handleLike}>
              <Text style={styles.actionIcon}>{post.is_liked ? '❤️' : '🤍'}</Text>
              <Text style={styles.actionText}>{post.like_count || 0}</Text>
            </TouchableOpacity>
            <View style={styles.actionButton}>
              <Text style={styles.actionIcon}>💬</Text>
              <Text style={styles.actionText}>{post.comment_count || 0}</Text>
            </View>
            <View style={styles.actionButton}>
              <Text style={styles.actionIcon}>👁️</Text>
              <Text style={styles.actionText}>{post.view_count || 0}</Text>
            </View>

            {/* 応援ボタン */}
            <TouchableOpacity
              style={styles.supportButton}
              onPress={() => setSupportModalVisible(true)}
            >
              <Text style={styles.supportButtonText}>⚡ 応援</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.commentsSection}>
            <Text style={styles.sectionTitle}>{t('postDetail.comments')}</Text>
            {comments.map((comment) => (
              <View key={comment.id} style={styles.comment}>
                <Text style={styles.commentUser}>
                  {comment.display_name || comment.username}
                </Text>
                <Text style={styles.commentText}>{comment.content}</Text>
              </View>
            ))}
          </View>
        </View>
      </ScrollView>

      <View style={styles.commentInput}>
        <TextInput
          style={styles.input}
          placeholder={t('postDetail.commentPlaceholder')}
          placeholderTextColor={Colors.muted}
          value={commentText}
          onChangeText={setCommentText}
        />
        <TouchableOpacity style={styles.sendButton} onPress={handleComment}>
          <Text style={styles.sendButtonText}>{t('postDetail.send')}</Text>
        </TouchableOpacity>
      </View>

      <SupportModal
        visible={supportModalVisible}
        onClose={() => setSupportModalVisible(false)}
        seriesId={post.series_id}
        episodeId={post.id}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  loading: {
    color: Colors.foreground,
    textAlign: 'center',
    marginTop: 100,
    fontSize: 16,
  },
  imageContainer: {
    width: SCREEN_WIDTH,
    height: SCREEN_WIDTH,
    position: 'relative',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  imageCounter: {
    position: 'absolute',
    top: 20,
    right: 20,
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
    marginBottom: 16,
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
  displayName: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.foreground,
  },
  username: {
    fontSize: 14,
    color: Colors.muted,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: Colors.foreground,
    marginBottom: 8,
  },
  description: {
    fontSize: 14,
    color: Colors.muted,
    marginBottom: 16,
    lineHeight: 20,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: Colors.border,
    paddingVertical: 12,
    marginBottom: 16,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 20,
  },
  actionIcon: {
    fontSize: 20,
    marginRight: 6,
  },
  actionText: {
    color: Colors.muted,
    fontSize: 14,
    fontWeight: '600',
  },
  supportButton: {
    marginLeft: 'auto',
    backgroundColor: Colors.primary,
    paddingHorizontal: 16,
    paddingVertical: 7,
    borderRadius: 20,
  },
  supportButtonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 13,
  },
  commentsSection: {
    marginTop: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.foreground,
    marginBottom: 12,
  },
  comment: {
    backgroundColor: Colors.card,
    padding: 12,
    borderRadius: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  commentUser: {
    fontWeight: '600',
    color: Colors.foreground,
    marginBottom: 4,
  },
  commentText: {
    color: Colors.muted,
    fontSize: 14,
  },
  commentInput: {
    flexDirection: 'row',
    padding: 12,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    backgroundColor: Colors.card,
  },
  input: {
    flex: 1,
    backgroundColor: Colors.background,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginRight: 8,
    color: Colors.foreground,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  sendButton: {
    backgroundColor: Colors.primary,
    borderRadius: 20,
    paddingHorizontal: 20,
    justifyContent: 'center',
    ...Shadows.small,
  },
  sendButtonText: {
    color: '#FFFFFF',
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
