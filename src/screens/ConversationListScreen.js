import { useState, useEffect, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  ActivityIndicator, RefreshControl,
} from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../theme/colors';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { messageAPI } from '../api/client';

function timeAgo(dateStr) {
  const diff = (Date.now() - new Date(dateStr)) / 1000;
  if (diff < 60) return '今';
  if (diff < 3600) return `${Math.floor(diff / 60)}分前`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}時間前`;
  return `${Math.floor(diff / 86400)}日前`;
}

function Avatar({ uri, name, size = 44 }) {
  if (uri) {
    return <ExpoImage source={{ uri }} style={[styles.avatar, { width: size, height: size, borderRadius: size / 2 }]} contentFit="cover" />;
  }
  const initial = (name || '?')[0].toUpperCase();
  return (
    <View style={[styles.avatarPlaceholder, { width: size, height: size, borderRadius: size / 2 }]}>
      <Text style={styles.avatarInitial}>{initial}</Text>
    </View>
  );
}

function ConversationItem({ item, currentUserId, onPress }) {
  const others = item.other_participants || [];
  const isGroup = item.type === 'group';
  const displayName = isGroup
    ? (item.name || others.map(u => u.display_name || u.username).join(', '))
    : (others[0]?.display_name || others[0]?.username || '?');
  const avatarUri = isGroup ? null : others[0]?.avatar_url;

  const lastContent = item.last_message_content || '';
  const isMine = item.last_message_sender_id === currentUserId;
  const senderLabel = isMine ? 'あなた: ' : (item.last_message_sender_display_name || item.last_message_sender_username || '');
  const unread = parseInt(item.unread_count) || 0;

  return (
    <TouchableOpacity style={styles.item} onPress={onPress} activeOpacity={0.7}>
      <View style={styles.avatarWrap}>
        <Avatar uri={avatarUri} name={displayName} />
        {isGroup && (
          <View style={styles.groupBadge}>
            <Ionicons name="people" size={10} color="#fff" />
          </View>
        )}
      </View>
      <View style={styles.itemBody}>
        <View style={styles.itemHeader}>
          <Text style={styles.itemName} numberOfLines={1}>{displayName}</Text>
          {item.last_message_created_at && (
            <Text style={styles.itemTime}>{timeAgo(item.last_message_created_at)}</Text>
          )}
        </View>
        <View style={styles.itemFooter}>
          <Text style={[styles.itemPreview, unread > 0 && styles.itemPreviewBold]} numberOfLines={1}>
            {lastContent ? `${senderLabel}${lastContent}` : 'まだメッセージがありません'}
          </Text>
          {unread > 0 && (
            <View style={styles.unreadBadge}>
              <Text style={styles.unreadText}>{unread > 99 ? '99+' : unread}</Text>
            </View>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
}

export default function ConversationListScreen() {
  const { t } = useLanguage();
  const { user } = useAuth();
  const navigation = useNavigation();
  const [conversations, setConversations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    try {
      const data = await messageAPI.getConversations();
      setConversations(data.conversations || []);
      setError(null);
    } catch (e) {
      setError(t('inbox.loadError'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [t]);

  // 画面フォーカス時にリロード
  useFocusEffect(useCallback(() => {
    setLoading(true);
    load();
  }, [load]));

  const onRefresh = () => {
    setRefreshing(true);
    load();
  };

  const openChat = (conv) => {
    navigation.navigate('Chat', { conversation: conv });
  };

  const openNew = () => {
    navigation.navigate('NewConversation');
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>{t('inbox.title')}</Text>
        <TouchableOpacity style={styles.newBtn} onPress={openNew}>
          <Ionicons name="create-outline" size={24} color={Colors.primary} />
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={Colors.primary} />
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : conversations.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyIcon}>📬</Text>
          <Text style={styles.emptyText}>{t('inbox.empty')}</Text>
          <Text style={styles.emptySubtext}>{t('inbox.emptyHint')}</Text>
        </View>
      ) : (
        <FlatList
          data={conversations}
          keyExtractor={item => String(item.id)}
          renderItem={({ item }) => (
            <ConversationItem
              item={item}
              currentUserId={user?.id}
              onPress={() => openChat(item)}
            />
          )}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  headerTitle: { fontSize: 22, fontWeight: 'bold', color: Colors.foreground },
  newBtn: { padding: 4 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  errorText: { color: Colors.error, fontSize: 14 },
  emptyContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  emptyIcon: { fontSize: 56, marginBottom: 20 },
  emptyText: { fontSize: 18, fontWeight: 'bold', color: Colors.foreground, marginBottom: 8 },
  emptySubtext: { fontSize: 14, color: Colors.muted, textAlign: 'center', lineHeight: 22 },
  item: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12 },
  avatarWrap: { position: 'relative', marginRight: 12 },
  avatar: { backgroundColor: Colors.card },
  avatarPlaceholder: {
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitial: { color: '#fff', fontWeight: 'bold', fontSize: 18 },
  groupBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: Colors.violet,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: Colors.background,
  },
  itemBody: { flex: 1 },
  itemHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  itemName: { fontSize: 15, fontWeight: '600', color: Colors.foreground, flex: 1, marginRight: 8 },
  itemTime: { fontSize: 12, color: Colors.muted },
  itemFooter: { flexDirection: 'row', alignItems: 'center' },
  itemPreview: { fontSize: 13, color: Colors.muted, flex: 1 },
  itemPreviewBold: { color: Colors.foreground, fontWeight: '500' },
  unreadBadge: {
    backgroundColor: Colors.primary,
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 5,
    marginLeft: 8,
  },
  unreadText: { color: '#fff', fontSize: 11, fontWeight: 'bold' },
  separator: { height: 1, backgroundColor: Colors.border, marginLeft: 72 },
});
