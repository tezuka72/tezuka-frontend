import { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  TextInput, ActivityIndicator, Image, Alert, Modal,
  KeyboardAvoidingView, Platform, Pressable,
} from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { Colors } from '../theme/colors';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { messageAPI, userAPI } from '../api/client';

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
    return <ExpoImage source={{ uri }} style={{ width: size, height: size, borderRadius: size / 2 }} contentFit="cover" />;
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

function MessageItem({ msg, isMine, isGroup, onLongPress, onReactionToggle, readAvatars }) {
  const showAvatar = !isMine || isGroup;
  const showName = !isMine || isGroup;
  return (
    <Pressable onLongPress={() => onLongPress(msg)} delayLongPress={400}>
      <View style={[styles.msgRow, isMine && styles.msgRowMine]}>
        {showAvatar && (
          <Avatar uri={msg.sender_avatar} name={msg.sender_display_name || msg.sender_username} size={34} />
        )}
        <View style={[styles.msgBubbleWrap, isMine && styles.msgBubbleWrapMine]}>
          {showName && (
            <Text style={[styles.senderName, isMine && styles.senderNameMine]}>
              {msg.sender_display_name || msg.sender_username}
            </Text>
          )}
          {/* 返信引用 */}
          {msg.reply_to_id && (
            <View style={[styles.replyQuote, isMine && styles.replyQuoteMine]}>
              <Text style={styles.replyQuoteUser}>↩ {msg.reply_to_username}</Text>
              <Text style={styles.replyQuoteText} numberOfLines={1}>{msg.reply_to_content}</Text>
            </View>
          )}
          <View style={[styles.bubble, isMine ? styles.bubbleMine : styles.bubbleOther]}>
            {/* 画像 */}
            {msg.image_url && (
              <Image source={{ uri: msg.image_url }} style={styles.msgImage} resizeMode="cover" />
            )}
            {/* テキスト */}
            {msg.content ? (
              <MentionText text={msg.content} style={[styles.bubbleText, isMine && styles.bubbleTextMine]} />
            ) : null}
            <Text style={[styles.msgTime, isMine && styles.msgTimeMine]}>
              {new Date(msg.created_at).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })}
            </Text>
          </View>
          <ReactionBar reactions={msg.reactions} onToggle={(emoji, reacted) => onReactionToggle(msg.id, emoji, reacted)} />
          {/* 既読アバター（自分のメッセージのみ、最後に読んだメッセージに表示） */}
          {isMine && readAvatars && readAvatars.length > 0 && (
            <View style={styles.readAvatarRow}>
              {readAvatars.map(r => (
                <Avatar key={r.user_id} uri={r.avatar_url} name={r.display_name || r.username} size={16} />
              ))}
            </View>
          )}
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
  const [readers, setReaders] = useState([]); // [{user_id, last_read_at, username, display_name, avatar_url}]
  const flatListRef = useRef(null);
  const pollingRef = useRef(null);
  const oldestIdRef = useRef(null); // 最も古いメッセージID（前読み込み用）
  const newestIdRef = useRef(null); // 最も新しいメッセージID（ポーリング用）

  // チャンネル関連
  const isGroup = conversation.type === 'group' && !conversation.parent_id;
  const [channels, setChannels] = useState([]);
  const [activeChannelId, setActiveChannelId] = useState(null); // nullはグループ本体
  const [showCreateChannel, setShowCreateChannel] = useState(false);
  const [newChannelName, setNewChannelName] = useState('');
  const [newChannelDesc, setNewChannelDesc] = useState('');
  const [creatingChannel, setCreatingChannel] = useState(false);

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

  // チャンネル読み込み（グループのみ）
  useEffect(() => {
    if (isGroup) loadChannels();
  }, [isGroup]);

  const loadChannels = async () => {
    try {
      const data = await messageAPI.getChannels(conversation.id);
      setChannels(data.channels || []);
    } catch {}
  };

  const handleCreateChannel = async () => {
    if (!newChannelName.trim()) return;
    setCreatingChannel(true);
    try {
      const data = await messageAPI.createChannel(conversation.id, newChannelName, newChannelDesc);
      const newCh = { id: data.channel_id, name: newChannelName.trim(), description: newChannelDesc.trim(), unread_count: 0, is_member: true, member_count: 1 };
      setChannels(prev => [...prev, newCh]);
      setNewChannelName('');
      setNewChannelDesc('');
      setShowCreateChannel(false);
      setActiveChannelId(data.channel_id);
    } catch {
      Alert.alert('エラー', 'チャンネルの作成に失敗しました');
    } finally {
      setCreatingChannel(false);
    }
  };

  const handleChannelPress = async (ch) => {
    if (ch.is_member) {
      setActiveChannelId(ch.id);
    } else {
      Alert.alert(
        `# ${ch.name}`,
        ch.description ? `${ch.description}\n\nこのチャンネルに参加しますか？` : 'このチャンネルに参加しますか？',
        [
          { text: 'キャンセル', style: 'cancel' },
          {
            text: '参加する',
            onPress: async () => {
              try {
                await messageAPI.joinChannel(conversation.id, ch.id);
                setChannels(prev => prev.map(c => c.id === ch.id ? { ...c, is_member: true, member_count: (c.member_count || 0) + 1 } : c));
                setActiveChannelId(ch.id);
              } catch {
                Alert.alert('エラー', '参加に失敗しました');
              }
            },
          },
        ]
      );
    }
  };

  // アクティブチャンネルID変更時にメッセージ再ロード
  const currentConvId = activeChannelId || conversation.id;

  // 初回ロード
  useEffect(() => {
    loadMessages();
    return () => clearInterval(pollingRef.current);
  }, [currentConvId]);

  const loadMessages = async () => {
    setLoading(true);
    try {
      const data = await messageAPI.getMessages(currentConvId);
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

  // ポーリング: 新着メッセージ + 既読者を更新
  const pollNewMessages = useCallback(async () => {
    try {
      const [msgData, readersData] = await Promise.all([
        messageAPI.getMessages(currentConvId),
        messageAPI.getReaders(currentConvId),
      ]);
      const fresh = msgData.messages || [];
      if (fresh.length > 0) {
        const latestId = fresh[fresh.length - 1].id;
        if (latestId !== newestIdRef.current) {
          setMessages(prev => {
            const existingIds = new Set(prev.map(m => m.id));
            const newOnes = fresh.filter(m => !existingIds.has(m.id));
            if (newOnes.length === 0) return prev;
            newestIdRef.current = latestId;
            return [...prev, ...newOnes];
          });
          messageAPI.markRead(currentConvId).catch(() => {});
        }
      }
      setReaders(readersData.readers || []);
    } catch {}
  }, [currentConvId]);

  // フォーカス時に既読更新とポーリング開始
  useFocusEffect(useCallback(() => {
    messageAPI.markRead(currentConvId).catch(() => {});
    pollingRef.current = setInterval(pollNewMessages, POLL_INTERVAL);
    return () => clearInterval(pollingRef.current);
  }, [currentConvId, pollNewMessages]));

  const sendMessage = async () => {
    const content = text.trim();
    if (!content || sending) return;
    setSending(true);
    setText('');
    const replyToId = replyTo?.id || null;
    setReplyTo(null);
    try {
      const data = await messageAPI.sendMessage(currentConvId, content, replyToId);
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

  const handlePickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('権限が必要です', '写真へのアクセスを許可してください');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.8,
    });
    if (result.canceled) return;
    const asset = result.assets[0];
    setSending(true);
    try {
      const data = await messageAPI.sendMessageWithImage(
        conversation.id,
        asset.uri,
        asset.file || null,
        text.trim() || null,
        replyTo?.id || null
      );
      const newMsg = data.message;
      setMessages(prev => [...prev, newMsg]);
      newestIdRef.current = newMsg.id;
      setText('');
      setReplyTo(null);
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
    } catch {
      Alert.alert(t('common.error'), t('chat.sendError'));
    } finally {
      setSending(false);
    }
  };

  const handleBlockUser = async () => {
    if (!actionMsg) return;
    const targetId = actionMsg.sender_id;
    const targetName = actionMsg.sender_display_name || actionMsg.sender_username;
    setActionMsg(null);
    Alert.alert(
      `${targetName}をブロック`,
      'このユーザーをブロックしますか？',
      [
        { text: 'キャンセル', style: 'cancel' },
        {
          text: 'ブロック',
          style: 'destructive',
          onPress: async () => {
            try {
              await userAPI.blockUser(targetId);
              Alert.alert('ブロックしました');
            } catch {
              Alert.alert(t('common.error'), 'ブロックに失敗しました');
            }
          },
        },
      ]
    );
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={90}
    >
      {/* チャンネルバー（グループのみ） */}
      {isGroup && (
        <View style={styles.channelBar}>
          <TouchableOpacity
            style={[styles.channelTab, activeChannelId === null && styles.channelTabActive]}
            onPress={() => setActiveChannelId(null)}
          >
            <Text style={[styles.channelTabText, activeChannelId === null && styles.channelTabTextActive]}>
              # メイン
            </Text>
          </TouchableOpacity>
          {channels.map(ch => (
            <TouchableOpacity
              key={ch.id}
              style={[styles.channelTab, activeChannelId === ch.id && styles.channelTabActive, !ch.is_member && styles.channelTabLocked]}
              onPress={() => handleChannelPress(ch)}
            >
              <Text style={[styles.channelTabText, activeChannelId === ch.id && styles.channelTabTextActive, !ch.is_member && styles.channelTabTextLocked]}>
                {ch.is_member ? `# ${ch.name}` : `🔒 ${ch.name}`}
              </Text>
              {ch.unread_count > 0 && (
                <View style={styles.channelUnread}>
                  <Text style={styles.channelUnreadText}>{ch.unread_count}</Text>
                </View>
              )}
            </TouchableOpacity>
          ))}
          <TouchableOpacity style={styles.channelAddBtn} onPress={() => setShowCreateChannel(true)}>
            <Ionicons name="add" size={20} color={Colors.primary} />
          </TouchableOpacity>
        </View>
      )}

      {/* チャンネル作成モーダル */}
      <Modal visible={showCreateChannel} transparent animationType="slide" onRequestClose={() => setShowCreateChannel(false)}>
        <Pressable style={styles.modalOverlay} onPress={() => setShowCreateChannel(false)}>
          <Pressable style={styles.channelCreateSheet} onPress={e => e.stopPropagation()}>
            <Text style={styles.channelCreateTitle}>チャンネルを作成</Text>
            <TextInput
              style={styles.channelInput}
              placeholder="チャンネル名（例：雑談）"
              placeholderTextColor={Colors.muted}
              value={newChannelName}
              onChangeText={setNewChannelName}
              maxLength={30}
              autoFocus
            />
            <TextInput
              style={[styles.channelInput, { marginTop: 8 }]}
              placeholder="説明（任意）"
              placeholderTextColor={Colors.muted}
              value={newChannelDesc}
              onChangeText={setNewChannelDesc}
              maxLength={100}
            />
            <View style={styles.channelCreateButtons}>
              <TouchableOpacity style={styles.channelCancelBtn} onPress={() => setShowCreateChannel(false)}>
                <Text style={styles.channelCancelText}>キャンセル</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.channelConfirmBtn, (!newChannelName.trim() || creatingChannel) && { opacity: 0.5 }]}
                onPress={handleCreateChannel}
                disabled={!newChannelName.trim() || creatingChannel}
              >
                {creatingChannel
                  ? <ActivityIndicator size="small" color="#fff" />
                  : <Text style={styles.channelConfirmText}>作成</Text>}
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={Colors.primary} />
        </View>
      ) : (
        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={item => String(item.id)}
          renderItem={({ item }) => {
            // この自分のメッセージが最後に読まれているリーダーのアバターを計算
            const readAvatars = item.sender_id === user?.id
              ? readers.filter(r => {
                  // r.last_read_at がこのメッセージより後、かつ次のメッセージより前（または最後）
                  if (!r.last_read_at) return false;
                  const readTime = new Date(r.last_read_at).getTime();
                  const msgTime = new Date(item.created_at).getTime();
                  return readTime >= msgTime;
                }).filter(r => {
                  // 次の自分のメッセージより後のリーダーは除外（次のメッセージに表示）
                  const idx = messages.indexOf(item);
                  const nextMsg = messages.slice(idx + 1).find(m => m.sender_id === user?.id);
                  if (!nextMsg) return true;
                  const readTime = new Date(r.last_read_at).getTime();
                  const nextTime = new Date(nextMsg.created_at).getTime();
                  return readTime < nextTime;
                })
              : [];
            return (
              <MessageItem
                msg={item}
                isMine={item.sender_id === user?.id}
                isGroup={isGroup}
                onLongPress={onLongPress}
                onReactionToggle={onReactionToggle}
                readAvatars={readAvatars}
              />
            );
          }}
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
        <TouchableOpacity
          style={styles.imageBtn}
          onPress={handlePickImage}
          disabled={sending}
        >
          <Ionicons name="image-outline" size={24} color={sending ? Colors.muted : Colors.foreground} />
        </TouchableOpacity>
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
            {/* 他人のメッセージのみブロック可能 */}
            {actionMsg?.sender_id !== user?.id && (
              <TouchableOpacity style={styles.actionItem} onPress={handleBlockUser}>
                <Ionicons name="ban-outline" size={20} color={Colors.error} />
                <Text style={[styles.actionItemText, { color: Colors.error }]}>ブロック</Text>
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
  channelBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.card,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    paddingHorizontal: 8,
    paddingVertical: 6,
    flexWrap: 'wrap',
    gap: 6,
  },
  channelTab: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    backgroundColor: Colors.background,
    gap: 4,
  },
  channelTabActive: {
    backgroundColor: Colors.primary,
  },
  channelTabText: {
    color: Colors.muted,
    fontSize: 13,
    fontWeight: '600',
  },
  channelTabTextActive: {
    color: '#fff',
  },
  channelTabLocked: {
    opacity: 0.6,
  },
  channelTabTextLocked: {
    color: Colors.muted,
  },
  channelUnread: {
    backgroundColor: '#E94B7A',
    borderRadius: 8,
    paddingHorizontal: 5,
    paddingVertical: 1,
    minWidth: 16,
    alignItems: 'center',
  },
  channelUnreadText: { color: '#fff', fontSize: 10, fontWeight: '700' },
  channelAddBtn: {
    padding: 4,
  },
  channelCreateSheet: {
    backgroundColor: Colors.card,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 24,
    paddingBottom: 36,
  },
  channelCreateTitle: {
    color: Colors.foreground,
    fontSize: 17,
    fontWeight: '700',
    marginBottom: 16,
    textAlign: 'center',
  },
  channelInput: {
    backgroundColor: Colors.background,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: Colors.foreground,
    fontSize: 15,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  channelCreateButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 20,
  },
  channelCancelBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    alignItems: 'center',
  },
  channelCancelText: { color: Colors.muted, fontWeight: '600' },
  channelConfirmBtn: {
    flex: 2,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: Colors.primary,
    alignItems: 'center',
  },
  channelConfirmText: { color: '#fff', fontWeight: '700', fontSize: 15 },
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
  senderNameMine: { textAlign: 'right', marginLeft: 0, marginRight: 4 },

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

  // メッセージ画像
  msgImage: {
    width: 200,
    height: 200,
    borderRadius: 10,
    marginBottom: 4,
  },
  // 既読アバター行
  readAvatarRow: {
    flexDirection: 'row',
    gap: 2,
    marginTop: 3,
    justifyContent: 'flex-end',
  },
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
  imageBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
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
