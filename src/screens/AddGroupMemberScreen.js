import { useState, useEffect } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  TextInput, ActivityIndicator, Image, Alert,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../theme/colors';
import { messageAPI, userAPI } from '../api/client';

function Avatar({ uri, name, size = 40 }) {
  if (uri) {
    return <Image source={{ uri }} style={{ width: size, height: size, borderRadius: size / 2 }} />;
  }
  const initial = (name || '?')[0].toUpperCase();
  return (
    <View style={[styles.avatarPlaceholder, { width: size, height: size, borderRadius: size / 2 }]}>
      <Text style={styles.avatarInitial}>{initial}</Text>
    </View>
  );
}

export default function AddGroupMemberScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const { conversationId, existingMemberIds = [], onAdded } = route.params;

  const [users, setUsers] = useState([]);
  const [filtered, setFiltered] = useState([]);
  const [selected, setSelected] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    userAPI.getFollowing()
      .then(data => {
        const all = data?.users || data || [];
        // 既存メンバーを除外
        const candidates = all.filter(u => !existingMemberIds.includes(u.id));
        setUsers(candidates);
        setFiltered(candidates);
      })
      .catch(() => Alert.alert('エラー', 'ユーザー一覧の読み込みに失敗しました'))
      .finally(() => setLoading(false));
  }, []);

  const onSearch = (text) => {
    setSearch(text);
    if (!text.trim()) {
      setFiltered(users);
    } else {
      const q = text.toLowerCase();
      setFiltered(users.filter(u =>
        (u.username || '').toLowerCase().includes(q) ||
        (u.display_name || '').toLowerCase().includes(q)
      ));
    }
  };

  const toggleSelect = (user) => {
    if (selected.find(u => u.id === user.id)) {
      setSelected(selected.filter(u => u.id !== user.id));
    } else {
      setSelected([...selected, user]);
    }
  };

  const handleAdd = async () => {
    if (selected.length === 0 || adding) return;
    setAdding(true);
    const added = [];
    const failed = [];
    for (const u of selected) {
      try {
        const data = await messageAPI.addMember(conversationId, u.id);
        added.push({
          user_id: u.id,
          username: u.username,
          display_name: u.display_name,
          avatar_url: u.avatar_url,
          role: data?.role || 'member',
        });
      } catch {
        failed.push(u.display_name || u.username);
      }
    }
    setAdding(false);
    if (added.length > 0) {
      onAdded?.(added);
    }
    if (failed.length > 0) {
      Alert.alert('一部失敗', `${failed.join(', ')} の追加に失敗しました`);
    }
    navigation.goBack();
  };

  return (
    <View style={styles.container}>
      {/* ヘッダー */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={Colors.foreground} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>メンバーを追加</Text>
        <TouchableOpacity
          style={[styles.addBtn, (selected.length === 0 || adding) && styles.addBtnDisabled]}
          onPress={handleAdd}
          disabled={selected.length === 0 || adding}
        >
          {adding
            ? <ActivityIndicator size="small" color="#fff" />
            : <Text style={styles.addBtnText}>追加{selected.length > 0 ? `(${selected.length})` : ''}</Text>
          }
        </TouchableOpacity>
      </View>

      {/* 選択済みチップ */}
      {selected.length > 0 && (
        <View style={styles.chips}>
          {selected.map(u => (
            <TouchableOpacity key={u.id} style={styles.chip} onPress={() => toggleSelect(u)}>
              <Text style={styles.chipText}>{u.display_name || u.username}</Text>
              <Ionicons name="close" size={13} color={Colors.foreground} />
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* 検索 */}
      <View style={styles.searchBar}>
        <Ionicons name="search" size={18} color={Colors.muted} />
        <TextInput
          style={styles.searchInput}
          placeholder="ユーザーを検索"
          placeholderTextColor={Colors.muted}
          value={search}
          onChangeText={onSearch}
        />
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={Colors.primary} />
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={item => String(item.id)}
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
              <Text style={styles.emptyText}>追加できるユーザーがいません</Text>
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
    paddingTop: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  backBtn: { marginRight: 12, padding: 2 },
  headerTitle: { flex: 1, fontSize: 18, fontWeight: 'bold', color: Colors.foreground },
  addBtn: {
    backgroundColor: Colors.primary,
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 8,
    minWidth: 56,
    alignItems: 'center',
  },
  addBtnDisabled: { opacity: 0.4 },
  addBtnText: { color: '#fff', fontWeight: '600', fontSize: 14 },
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
