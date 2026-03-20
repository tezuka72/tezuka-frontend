import { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  FlatList,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { boardAPI } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { Colors } from '../theme/colors';

function timeAgo(dateStr) {
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (diff < 60) return `${diff}秒前`;
  if (diff < 3600) return `${Math.floor(diff / 60)}分前`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}時間前`;
  return `${Math.floor(diff / 86400)}日前`;
}

function BoardPost({ post, onReply, onDelete, expandedId, onToggleReplies, replies, isOwner }) {
  const replying = expandedId === post.id;

  return (
    <View style={styles.postCard}>
      <View style={styles.postHeader}>
        <Text style={styles.postAuthor}>{post.display_name || post.username}</Text>
        <Text style={styles.postTime}>{timeAgo(post.created_at)}</Text>
      </View>
      <Text style={styles.postContent}>{post.content}</Text>
      <View style={styles.postActions}>
        <TouchableOpacity style={styles.actionBtn} onPress={() => onReply(post)}>
          <Text style={styles.actionBtnText}>返信</Text>
        </TouchableOpacity>
        {parseInt(post.reply_count) > 0 && (
          <TouchableOpacity style={styles.actionBtn} onPress={() => onToggleReplies(post.id)}>
            <Text style={styles.actionBtnText}>
              {replying ? '閉じる' : `返信 ${post.reply_count}件`}
            </Text>
          </TouchableOpacity>
        )}
        {isOwner && (
          <TouchableOpacity style={[styles.actionBtn, styles.deleteBtn]} onPress={() => onDelete(post.id)}>
            <Text style={[styles.actionBtnText, styles.deleteBtnText]}>削除</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* 返信一覧 */}
      {replying && Array.isArray(replies) && replies.map(reply => (
        <View key={reply.id} style={styles.replyCard}>
          <View style={styles.postHeader}>
            <Text style={styles.postAuthor}>{reply.display_name || reply.username}</Text>
            <Text style={styles.postTime}>{timeAgo(reply.created_at)}</Text>
          </View>
          <Text style={styles.postContent}>{reply.content}</Text>
        </View>
      ))}
      {replying && !replies && (
        <ActivityIndicator size="small" color={Colors.primary} style={{ marginTop: 8 }} />
      )}
    </View>
  );
}

export default function SeriesBoardScreen({ route, navigation }) {
  const { seriesId, seriesTitle } = route.params || {};
  const { user } = useAuth();

  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [inputText, setInputText] = useState('');
  const [replyingTo, setReplyingTo] = useState(null); // { id, username }
  const [posting, setPosting] = useState(false);
  const [expandedReplies, setExpandedReplies] = useState({}); // { postId: [] | null }
  const inputRef = useRef(null);

  useEffect(() => {
    if (navigation) {
      navigation.setOptions({ title: `${seriesTitle || ''} 掲示板` });
    }
  }, [navigation, seriesTitle]);

  const load = useCallback(async () => {
    try {
      const res = await boardAPI.getPosts(seriesId);
      setPosts(res.posts || []);
    } catch (e) {
      console.error('Board load error:', e);
    } finally {
      setLoading(false);
    }
  }, [seriesId]);

  useEffect(() => { load(); }, [load]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const handleToggleReplies = async (postId) => {
    if (expandedReplies[postId] !== undefined) {
      // 閉じる
      setExpandedReplies(prev => {
        const next = { ...prev };
        delete next[postId];
        return next;
      });
      return;
    }
    // null = loading
    setExpandedReplies(prev => ({ ...prev, [postId]: null }));
    try {
      const res = await boardAPI.getReplies(seriesId, postId);
      setExpandedReplies(prev => ({ ...prev, [postId]: res.replies || [] }));
    } catch (e) {
      setExpandedReplies(prev => ({ ...prev, [postId]: [] }));
    }
  };

  const handleReply = (post) => {
    setReplyingTo({ id: post.id, username: post.display_name || post.username });
    inputRef.current?.focus();
  };

  const handlePost = async () => {
    const text = inputText.trim();
    if (!text) return;
    if (!user) {
      Alert.alert('ログインが必要です');
      return;
    }
    setPosting(true);
    try {
      const res = await boardAPI.post(seriesId, text, replyingTo?.id || null);
      if (replyingTo) {
        // 返信の場合: 返信リストを更新
        setExpandedReplies(prev => ({
          ...prev,
          [replyingTo.id]: [...(prev[replyingTo.id] || []), res.post],
        }));
        // 親投稿のreply_countをインクリメント
        setPosts(prev => prev.map(p =>
          p.id === replyingTo.id
            ? { ...p, reply_count: (parseInt(p.reply_count) || 0) + 1 }
            : p
        ));
      } else {
        setPosts(prev => [res.post, ...prev]);
      }
      setInputText('');
      setReplyingTo(null);
    } catch (e) {
      Alert.alert('投稿に失敗しました');
    } finally {
      setPosting(false);
    }
  };

  const handleDelete = (postId) => {
    Alert.alert('削除', 'この投稿を削除しますか？', [
      { text: 'キャンセル', style: 'cancel' },
      {
        text: '削除',
        style: 'destructive',
        onPress: async () => {
          try {
            await boardAPI.delete(seriesId, postId);
            setPosts(prev => prev.filter(p => p.id !== postId));
          } catch (e) {
            Alert.alert('削除に失敗しました');
          }
        },
      },
    ]);
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={90}
    >
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      ) : (
        <FlatList
          data={posts}
          keyExtractor={item => item.id.toString()}
          renderItem={({ item }) => (
            <BoardPost
              post={item}
              onReply={handleReply}
              onDelete={handleDelete}
              expandedId={
                expandedReplies[item.id] !== undefined ? item.id : null
              }
              onToggleReplies={handleToggleReplies}
              replies={expandedReplies[item.id]}
              isOwner={user && user.id === item.user_id}
            />
          )}
          refreshing={refreshing}
          onRefresh={handleRefresh}
          contentContainerStyle={{ padding: 12, paddingBottom: 20 }}
          ListEmptyComponent={
            <View style={styles.center}>
              <Text style={styles.emptyText}>まだ投稿がありません</Text>
              <Text style={styles.emptySubText}>最初に書き込んでみよう！</Text>
            </View>
          }
        />
      )}

      {/* 入力欄 */}
      <View style={styles.inputArea}>
        {replyingTo && (
          <View style={styles.replyingBar}>
            <Text style={styles.replyingText}>↩ {replyingTo.username} に返信中</Text>
            <TouchableOpacity onPress={() => setReplyingTo(null)}>
              <Text style={styles.replyingClose}>✕</Text>
            </TouchableOpacity>
          </View>
        )}
        <View style={styles.inputRow}>
          <TextInput
            ref={inputRef}
            style={styles.input}
            placeholder={user ? '書き込む...' : 'ログインして書き込もう'}
            placeholderTextColor={Colors.muted}
            value={inputText}
            onChangeText={setInputText}
            multiline
            maxLength={1000}
            editable={!!user}
          />
          <TouchableOpacity
            style={[styles.sendBtn, (!inputText.trim() || posting) && styles.sendBtnDisabled]}
            onPress={handlePost}
            disabled={!inputText.trim() || posting}
          >
            {posting
              ? <ActivityIndicator size="small" color="#fff" />
              : <Text style={styles.sendBtnText}>投稿</Text>
            }
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 48,
  },
  emptyText: {
    color: Colors.muted,
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 6,
  },
  emptySubText: {
    color: Colors.muted,
    fontSize: 13,
  },
  postCard: {
    backgroundColor: Colors.card,
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  postHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  postAuthor: {
    color: Colors.foreground,
    fontSize: 13,
    fontWeight: '700',
  },
  postTime: {
    color: Colors.muted,
    fontSize: 11,
  },
  postContent: {
    color: Colors.foreground,
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 10,
  },
  postActions: {
    flexDirection: 'row',
    gap: 10,
  },
  actionBtn: {
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  actionBtnText: {
    color: Colors.muted,
    fontSize: 12,
    fontWeight: '600',
  },
  deleteBtn: {
    borderColor: Colors.rose,
  },
  deleteBtnText: {
    color: Colors.rose,
  },
  replyCard: {
    backgroundColor: Colors.background,
    borderRadius: 10,
    padding: 10,
    marginTop: 8,
    borderLeftWidth: 2,
    borderLeftColor: Colors.primary,
  },
  inputArea: {
    backgroundColor: Colors.card,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: Platform.OS === 'ios' ? 24 : 10,
  },
  replyingBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 6,
  },
  replyingText: {
    color: Colors.primary,
    fontSize: 12,
    fontWeight: '600',
  },
  replyingClose: {
    color: Colors.muted,
    fontSize: 14,
    paddingHorizontal: 4,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
  },
  input: {
    flex: 1,
    backgroundColor: Colors.background,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    color: Colors.foreground,
    fontSize: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
    maxHeight: 100,
  },
  sendBtn: {
    backgroundColor: Colors.primary,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 60,
  },
  sendBtnDisabled: {
    opacity: 0.4,
  },
  sendBtnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
});
