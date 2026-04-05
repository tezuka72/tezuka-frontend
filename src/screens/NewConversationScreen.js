import { useState, useEffect } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  TextInput, ActivityIndicator, Alert,
} from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors } from '../theme/colors';
import { useLanguage } from '../context/LanguageContext';
import { messageAPI, userAPI, feedAPI } from '../api/client';

function Avatar({ uri, name, size = 40 }) {
  if (uri) {
    return <ExpoImage source={{ uri }} style={{ width: size, height: size, borderRadius: size / 2 }} contentFit="cover" />;
  }
  const initial = (name || '?')[0].toUpperCase();
  return (
    <View style={[styles.avatarPlaceholder, { width: size, height: size, borderRadius: size / 2 }]}>
      <Text style={styles.avatarInitial}>{initial}</Text>
    </View>
  );
}

export default function NewConversationScreen() {
  const { t } = useLanguage();
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const [users, setUsers] = useState([]);
  const [filtered, setFiltered] = useState([]);
  const [selected, setSelected] = useState([]);
  const [search, setSearch] = useState('');
  const [groupName, setGroupName] = useState('');
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);
  const [creating, setCreating] = useState(false);
  const searchTimer = useState(null);

  useEffect(() => {
    userAPI.getFollowing()
      .then(data => {
        const list = data?.users || data || [];
        setUsers(list);
        setFiltered(list);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const onSearch = (text) => {
    setSearch(text);
    clearTimeout(searchTimer[0]);
    if (!text.trim()) {
      setFiltered(users);
      setSearching(false);
      return;
    }
    // 400ms デバウンスで全ユーザー検索
    searchTimer[0] = setTimeout(async () => {
      setSearching(true);
      try {
        const data = await feedAPI.searchUsers(text.trim());
        setFiltered(data.users || []);
      } catch {
        // フォールバック: フォロー中をローカルフィルタ
        const q = text.toLowerCase();
        setFiltered(users.filter(u =>
          (u.username || '').toLowerCase().includes(q) ||
          (u.display_name || '').toLowerCase().includes(q)
        ));
      } finally {
        setSearching(false);
      }
    }, 400);
  };

  const toggleSelect = (user) => {
    if (selected.find(u => u.id === user.id)) {
      setSelected(selected.filter(u => u.id !== user.id));
    } else {
      if (selected.length >= 9) {
        Alert.alert(t('common.error'), t('newConv.maxMembers'));
        return;
      }
      setSelected([...selected, user]);
    }
  };

  const onCreate = async () => {
    if (selected.length === 0) return;
    setCreating(true);
    try {
      const type = selected.length === 1 ? 'dm' : 'group';
      const participantIds = selected.map(u => u.id);
      const data = await messageAPI.createConversation(participantIds, type, groupName.trim() || null);

      // ChatScreen に遷移
      const others = selected;
      const convName = type === 'group'
        ? (groupName.trim() || others.map(u => u.display_name || u.username).join(', '))
        : (others[0].display_name || others[0].username);

      navigation.replace('Chat', {
        conversation: {
          id: data.conversation_id,
          type,
          name: convName,
          other_participants: others.map(u => ({
            user_id: u.id,
            username: u.username,
            display_name: u.display_name,
            avatar_url: u.avatar_url,
          })),
        },
      });
    } catch (e) {
      Alert.alert(t('common.error'), t('newConv.createError'));
    } finally {
      setCreating(false);
    }
  };

  const isGroup = selected.length > 1;

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* ヘッダー */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={Colors.foreground} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('newConv.title')}</Text>
        <TouchableOpacity
          style={[styles.createBtn, (selected.length === 0 || creating) && styles.createBtnDisabled]}
          onPress={onCreate}
          disabled={selected.length === 0 || creating}
        >
          {creating
            ? <ActivityIndicator size="small" color="#fff" />
            : <Text style={styles.createBtnText}>{t('newConv.create')}</Text>
          }
        </TouchableOpacity>
      </View>

      {/* 選択済みチップ */}
      {selected.length > 0 && (
        <View style={styles.chips}>
          {selected.map(u => (
            <TouchableOpacity key={u.id} style={styles.chip} onPress={() => toggleSelect(u)}>
              <Text style={styles.chipText}>{u.display_name || u.username}</Text>
              <Ionicons name="close" size={14} color={Colors.foreground} />
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* グループ名入力（2人以上選択時） */}
      {isGroup && (
        <TextInput
          style={styles.groupNameInput}
          placeholder={t('newConv.groupName')}
          placeholderTextColor={Colors.muted}
          value={groupName}
          onChangeText={setGroupName}
        />
      )}

      {/* 検索 */}
      <View style={styles.searchBar}>
        <Ionicons name="search" size={18} color={Colors.muted} />
        <TextInput
          style={styles.searchInput}
          placeholder={t('newConv.searchPlaceholder')}
          placeholderTextColor={Colors.muted}
          value={search}
          onChangeText={onSearch}
        />
      </View>

      {loading || searching ? (
        <View style={styles.center}>
          <ActivityIndicator color={Colors.primary} />
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={item => String(item.id)}
          contentContainerStyle={{ flexGrow: 1 }}
          renderItem={({ item }) => {
            const isSelected = !!selected.find(u => u.id === item.id);
            return (
              <TouchableOpacity style={styles.userItem} onPress={() => toggleSelect(item)} activeOpacity={0.7}>
                <Avatar uri={item.avatar_url} name={item.display_name || item.username} />
                <View style={styles.userInfo}>
                  <Text style={styles.displayName}>{item.display_name || item.username}</Text>
                  <Text style={styles.username}>@{item.username}</Text>
                </View>
                <View style={[styles.checkbox, isSelected && styles.checkboxSelected]}>
                  {isSelected && <Ionicons name="checkmark" size={16} color="#fff" />}
                </View>
              </TouchableOpacity>
            );
          }}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          ListEmptyComponent={
            <View style={styles.center}>
              <Text style={styles.emptyText}>
                {search.trim() ? 'ユーザーが見つかりませんでした' : t('newConv.selectUser')}
              </Text>
            </View>
          }
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
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  backBtn: { marginRight: 12, padding: 2 },
  headerTitle: { flex: 1, fontSize: 18, fontWeight: 'bold', color: Colors.foreground },
  createBtn: {
    backgroundColor: Colors.primary,
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 8,
    minWidth: 56,
    alignItems: 'center',
  },
  createBtnDisabled: { opacity: 0.4 },
  createBtnText: { color: '#fff', fontWeight: '600', fontSize: 14 },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 6,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.card,
    borderRadius: 16,
    paddingHorizontal: 10,
    paddingVertical: 5,
    gap: 4,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  chipText: { color: Colors.foreground, fontSize: 13 },
  groupNameInput: {
    marginHorizontal: 16,
    marginBottom: 8,
    backgroundColor: Colors.card,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    color: Colors.foreground,
    fontSize: 14,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginVertical: 8,
    backgroundColor: Colors.card,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  searchInput: { flex: 1, color: Colors.foreground, marginLeft: 8, fontSize: 14 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  emptyText: { color: Colors.muted, fontSize: 14, textAlign: 'center' },
  userItem: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12 },
  avatarPlaceholder: {
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  avatarInitial: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
  userInfo: { flex: 1, marginRight: 12 },
  displayName: { fontSize: 15, fontWeight: '600', color: Colors.foreground },
  username: { fontSize: 13, color: Colors.muted, marginTop: 2 },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxSelected: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  separator: { height: 1, backgroundColor: Colors.border, marginLeft: 68 },
});
