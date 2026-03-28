import { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  TextInput, ActivityIndicator, Image, Alert, Modal,
  KeyboardAvoidingView, Platform, Pressable,
} from 'react-native';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../theme/colors';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { messageAPI } from '../api/client';

const EMOJIS = ['👍', '❤️', '😂', '😮', '😢', '🔥'];
const POLL_INTERVAL = 5000;

// @username を青色でハイライトするヘルパー
function MentionText({ text, style }) {
  const parts = text.split(/(@\w+)/g);
  return (
    <Text style={style}>
      {parts.map((part, i) =>
        part.startsWith('@')
          ? <Text key={i} style={styles.mention}>{part}</Text>
          : <Text key={i}>{part}</Text>
      )}
    </Text>
  );
}

function Avatar({ uri, name, size = 32 }) {
  if (uri) {
    return <Image source={{ uri }} style={{ width: size, height: size, borderRadius: size / 2 }} />;
  }
  const initial = (name || '?')[0].toUpperCase();
  return (
    <View style={[styles.avatarPlaceholder, { width: size, height: size, borderRadius: size / 2 }]}>
      <Text style={[styles.avatarInitial, { fontSize: size * 0.4 }]}>{initial}</Text>
    </View>
  );
}

function ReactionBar({ reactions, onToggle, myId }) {
  if (!reactions || reactions.length === 0) return null;
  return (
    <View style={styles.reactionBar}>
      {reactions.map(r => (
        <TouchableOpacity
          key={r.emoji}
          style={[styles.reactionChip, r.reacted && styles.reactionChipActive]}
          onPress={() => onToggle(r.emoji, r.reacted)}
        >
          <Text style={styles.reactionEmoji}>{r.emoji}</Text>
          <Text style={[styles.reactionCount, r.reacted && styles.reactionCountActive]}>{r.count}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

function MessageItem({ msg, isMine, onLongPress, onReactionToggle }) {
  return (
    <Pressable onLongPress={() => onLongPress(msg)} delayLongPress={400}>
      <View style={[styles.msgRow, isMine && styles.msgRowMine]}>
        {!isMine && (
          <Avatar uri={msg.sender_avatar} name={msg.sender_display_name || msg.sender_username} />
        )}
        <View style={[styles.msgBubbleWrap, isMine && styles.msgBubbleWrapMine]}>
          {!isMine && (
            <Text style={styles.senderName}>{msg.sender_display_name || msg.sender_username}</Text>
          )}
          {/* 返信引用 */}
          {msg.reply_to_id && (
            <View style={[styles.replyQuote, isMine && styles.replyQuoteMine]}>
              <Text style={styles.replyQuoteUser}>↩ {msg.reply_to_username}</Text>
              <Text style={styles.replyQuoteText} numberOfLines={1}>{msg.reply_to_content}</Text>
            </View>
          )}
          <View style={[styles.bubble, isMine ? styles.bubbleMine : styles.bubbleOther]}>
            <MentionText text={msg.content} style={[styles.bubbleText, isMine && styles.bubbleTextMine]} />
            <Text style={[styles.msgTime, isMine && styles.msgTimeMine]}>
              {new Date(msg.created_at).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })}
            </Text>
          </View>
          <ReactionBar reactions={msg.reactions} onToggle={(emoji, reacted) => onReactionToggle(msg.id, emoji, reacted)} />
        </View>
      </View>
    </Pressable>
  );
}

export default function ChatScreen() {
  const { t } = useLanguage();
  const { user } = useAuth();
  const navigation = useNavigation();
  const route = useRoute();
  const { conversation } = route.params || {};

  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [replyTo, setReplyTo] = useState(null); // { id, content, username }
  const [actionMsg, setActionMsg] = useState(null); // 長押しメニュー対象
  const flatListRef = useRef(null);
  const pollingRef = useRef(null);
  const oldestIdRef = useRef(null); // 最も古いメッセージID（前読み込み用）
  const newestIdRef = useRef(null); // 最も新しいメッセージID（ポーリング用）

  // 会話タイトルをヘッダーに設定
  useEffect(() => {
    const others = conversation.other_participants || [];
    const title = conversation.type === 'group'
      ? (conversation.name || others.map(u => u.display_name || u.username).join(', '))
      : (others[0]?.display_name || others[0]?.username || 'DM');
    navigation.setOptions({
      title,
      headerRight: conversation.type === 'group' ? () => (
        <TouchableOpacity
          onPress={() => navigation.navigate('GroupSettings', { conversation })}
          style={{ paddingHorizontal: 4 }}
        >
          <Ionicons name="people-outline" size={22} color={Colors.foreground} />
        </TouchableOpacity>
      ) : undefined,
    });
  }, [conversation, navigation]);

  // 初回ロード
  useEffect(() => {
    loadMessages();
    return () => clearInterval(pollingRef.current);
  }, []);

  const loadMessages = async () => {
    try {
      const data = await messageAPI.getMessages(conversation.id);
      const msgs = data.messages || [];
      setMessages(msgs);
      if (msgs.length > 0) {
        oldestIdRef.current = msgs[0].id;
        newestIdRef.current = msgs[msgs.length - 1].id;
      }
    } catch (e) {
      Alert.alert(t('common.error'), t('chat.loadError'));
    } finally {
      setLoading(false);
    }
  };

  // ポーリング: newestIdRef より新しいメッセージを取得
  const pollNewMessages = useCallback(async () => {
    try {
      const data = await messageAPI.getMessages(conversation.id);
      const fresh = data.messages || [];
      if (fresh.length === 0) return;
      const latestId = fresh[fresh.length - 1].id;
      if (latestId === newestIdRef.current) return;

      setMessages(prev => {
        const existingIds = new Set(prev.map(m => m.id));
        const newOnes = fresh.filter(m => !existingIds.has(m.id));
        if (newOnes.length === 0) return prev;
        newestIdRef.current = latestId;
        return [...prev, ...newOnes];
      });
      messageAPI.markRead(conversation.id).catch(() => {});
    } catch {}
  }, [conversation.id]);

  // フォーカス時に既読更新とポーリング開始
  useFocusEffect(useCallback(() => {
    messageAPI.markRead(conversation.id).catch(() => {});
    pollingRef.current = setInterval(pollNewMessages, POLL_INTERVAL);
    return () => clearInterval(pollingRef.current);
  }, [conversation.id, pollNewMessages]));

  const sendMessage = async () => {
    const content = text.trim();
    if (!content || sending) return;
    setSending(true);
    setText('');
    const replyToId = replyTo?.id || null;
    setReplyTo(null);
    try {
      const data = await messageAPI.sendMessage(conversation.id, content, replyToId);
      const newMsg = data.message;
      setMessages(prev => [...prev, newMsg]);
      newestIdRef.current = newMsg.id;
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
    } catch (e) {
      Alert.alert(t('common.error'), t('chat.sendError'));
      setText(content);
    } finally {
      setSending(false);
    }
  };

  const onLongPress = (msg) => {
    setActionMsg(msg);
  };

  const onReactionToggle = async (msgId, emoji, alreadyReacted) => {
    try {
      if (alreadyReacted) {
        await messageAPI.removeReaction(msgId, emoji);
      } else {
        await messageAPI.addReaction(msgId, emoji);
      }
      // ローカル状態を楽観的更新
      setMessages(prev => prev.map(m => {
        if (m.id !== msgId) return m;
        const reactions = (m.reactions || []).map(r => {
          if (r.emoji !== emoji) return r;
          return {
            ...r,
            count: alreadyReacted ? r.count - 1 : r.count + 1,
            reacted: !alreadyReacted,
          };
        });
        const hasEmoji = (m.reactions || []).some(r => r.emoji === emoji);
        if (!hasEmoji && !alreadyReacted) {
          reactions.push({ emoji, count: 1, reacted: true });
        }
        return { ...m, reactions: reactions.filter(r => r.count > 0) };
      }));
    } catch {}
  };

  const handleEmojiPick = (emoji) => {
    if (actionMsg) {
      const existing = (actionMsg.reactions || []).find(r => r.emoji === emoji);
      onReactionToggle(actionMsg.id, emoji, existing?.reacted || false);
    }
  };

  const handleDeleteMessage = async () => {
    if (!actionMsg) return;
    setActionMsg(null);
    try {
      await messageAPI.deleteMessage(actionMsg.id);
      setMessages(prev => prev.filter(m => m.id !== actionMsg.id));
    } catch {
      Alert.alert(t('common.error'), t('chat.deleteError'));
    }
  };

  const handleReply = () => {
    if (!actionMsg) return;
    setReplyTo({
      id: actionMsg.id,
      content: actionMsg.content,
      username: actionMsg.sender_display_name || actionMsg.sender_username,
    });
    setActionMsg(null);
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={90}
    >
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={Colors.primary} />
        </View>
      ) : (
        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={item => String(item.id)}
          renderItem={({ item }) => (
            <MessageItem
              msg={item}
              isMine={item.sender_id === user?.id}
              onLongPress={onLongPress}
              onReactionToggle={onReactionToggle}
            />
          )}
          contentContainerStyle={styles.listContent}
          onLayout={() => flatListRef.current?.scrollToEnd({ animated: false })}
          ListEmptyComponent={
            <View style={styles.emptyWrap}>
              <Text style={styles.emptyText}>{t('inbox.noMessages')}</Text>
            </View>
          }
        />
      )}

      {/* 返信バナー */}
      {replyTo && (
        <View style={styles.replyBanner}>
          <View style={styles.replyBannerBody}>
            <Text style={styles.replyBannerLabel}>{t('chat.replyingTo')} {replyTo.username}</Text>
            <Text style={styles.replyBannerContent} numberOfLines={1}>{replyTo.content}</Text>
          </View>
          <TouchableOpacity onPress={() => setReplyTo(null)}>
            <Ionicons name="close" size={20} color={Colors.muted} />
          </TouchableOpacity>
        </View>
      )}

      {/* 入力エリア */}
      <View style={styles.inputArea}>
        <TextInput
          style={styles.input}
          placeholder={t('chat.placeholder')}
          placeholderTextColor={Colors.muted}
          value={text}
          onChangeText={setText}
          multiline
          maxLength={1000}
        />
        <TouchableOpacity
          style={[styles.sendBtn, (!text.trim() || sending) && styles.sendBtnDisabled]}
          onPress={sendMessage}
          disabled={!text.trim() || sending}
        >
          {sending
            ? <ActivityIndicator size="small" color="#fff" />
            : <Ionicons name="send" size={18} color="#fff" />
          }
        </TouchableOpacity>
      </View>

      {/* 長押しアクションメニュー */}
      <Modal visible={!!actionMsg} transparent animationType="fade" onRequestClose={() => setActionMsg(null)}>
        <Pressable style={styles.modalOverlay} onPress={() => setActionMsg(null)}>
          <View style={styles.actionSheet}>
            {/* リアクション行 */}
            <View style={styles.emojiRow}>
              {EMOJIS.map(e => (
                <TouchableOpacity key={e} style={styles.emojiBtn} onPress={() => handleEmojiPick(e)}>
                  <Text style={styles.emojiBtnText}>{e}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <View style={styles.actionDivider} />
            {/* 返信 */}
            <TouchableOpacity style={styles.actionItem} onPress={handleReply}>
              <Ionicons name="arrow-undo-outline" size={20} color={Colors.foreground} />
              <Text style={styles.actionItemText}>{t('chat.reply')}</Text>
            </TouchableOpacity>
            {/* 自分のメッセージのみ削除可能 */}
            {actionMsg?.sender_id === user?.id && (
              <TouchableOpacity style={styles.actionItem} onPress={handleDeleteMessage}>
                <Ionicons name="trash-outline" size={20} color={Colors.error} />
                <Text style={[styles.actionItemText, { color: Colors.error }]}>{t('chat.deleteMessage')}</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity style={[styles.actionItem, styles.actionCancel]} onPress={() => setActionMsg(null)}>
              <Text style={styles.actionCancelText}>{t('common.cancel')}</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  listContent: { paddingVertical: 12, paddingHorizontal: 12 },
  emptyWrap: { flex: 1, alignItems: 'center', paddingTop: 60 },
  emptyText: { color: Colors.muted, fontSize: 14 },

  // メッセージ行
  msgRow: { flexDirection: 'row', alignItems: 'flex-end', marginVertical: 4, gap: 8 },
  msgRowMine: { flexDirection: 'row-reverse' },
  msgBubbleWrap: { maxWidth: '75%' },
  msgBubbleWrapMine: { alignItems: 'flex-end' },
  senderName: { fontSize: 12, color: Colors.muted, marginBottom: 2, marginLeft: 4 },

  // 返信引用
  replyQuote: {
    backgroundColor: Colors.card,
    borderLeftWidth: 3,
    borderLeftColor: Colors.primary,
    borderRadius: 6,
    padding: 6,
    marginBottom: 4,
  },
  replyQuoteMine: { borderLeftColor: Colors.accent },
  replyQuoteUser: { fontSize: 11, color: Colors.primary, fontWeight: '600', marginBottom: 2 },
  replyQuoteText: { fontSize: 12, color: Colors.muted },

  // バブル
  bubble: { borderRadius: 16, paddingHorizontal: 12, paddingVertical: 8, paddingBottom: 4 },
  bubbleMine: { backgroundColor: Colors.primary, borderBottomRightRadius: 4 },
  bubbleOther: { backgroundColor: Colors.card, borderBottomLeftRadius: 4 },
  bubbleText: { fontSize: 15, color: Colors.foreground, lineHeight: 21 },
  bubbleTextMine: { color: '#fff' },
  msgTime: { fontSize: 10, color: Colors.muted, alignSelf: 'flex-end', marginTop: 2 },
  msgTimeMine: { color: 'rgba(255,255,255,0.65)' },

  // メンション
  mention: { color: Colors.cyan, fontWeight: '600' },

  // リアクション
  reactionBar: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 4, marginLeft: 4 },
  reactionChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.card,
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 3,
  },
  reactionChipActive: { borderColor: Colors.primary, backgroundColor: '#1e3a6e' },
  reactionEmoji: { fontSize: 14 },
  reactionCount: { fontSize: 12, color: Colors.muted },
  reactionCountActive: { color: Colors.primary, fontWeight: '600' },

  // アバター
  avatarPlaceholder: {
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitial: { color: '#fff', fontWeight: 'bold' },

  // 返信バナー
  replyBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: Colors.card,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  replyBannerBody: { flex: 1 },
  replyBannerLabel: { fontSize: 12, color: Colors.primary, fontWeight: '600' },
  replyBannerContent: { fontSize: 13, color: Colors.muted, marginTop: 2 },

  // 入力エリア
  inputArea: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    backgroundColor: Colors.background,
    gap: 8,
  },
  input: {
    flex: 1,
    backgroundColor: Colors.card,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
    color: Colors.foreground,
    fontSize: 15,
    maxHeight: 120,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtnDisabled: { opacity: 0.4 },

  // 長押しモーダル
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  actionSheet: {
    backgroundColor: Colors.card,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 32,
    paddingTop: 8,
  },
  emojiRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  emojiBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emojiBtnText: { fontSize: 28 },
  actionDivider: { height: 1, backgroundColor: Colors.border, marginHorizontal: 16 },
  actionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    gap: 12,
  },
  actionItemText: { fontSize: 16, color: Colors.foreground },
  actionCancel: { borderTopWidth: 1, borderTopColor: Colors.border, marginTop: 4 },
  actionCancelText: { fontSize: 16, color: Colors.muted, flex: 1, textAlign: 'center' },
});
