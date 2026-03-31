import { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  TextInput, ActivityIndicator, Alert,
} from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { Colors } from '../theme/colors';
import { useAuth } from '../context/AuthContext';
import { messageAPI } from '../api/client';

function Avatar({ uri, name, size = 40 }) {
  if (uri) {
    return <ExpoImage source={{ uri }} style={{ width: size, height: size, borderRadius: size / 2 }} contentFit="cover" />;
  }
  const initial = (name || '?')[0].toUpperCase();
  return (
    <View style={[styles.avatarPlaceholder, { width: size, height: size, borderRadius: size / 2 }]}>
      <Text style={[styles.avatarInitial, { fontSize: size * 0.38 }]}>{initial}</Text>
    </View>
  );
}

export default function GroupSettingsScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const { conversation: initialConv } = route.params;
  const { user } = useAuth();

  const [members, setMembers] = useState([]);
  const [groupName, setGroupName] = useState(initialConv.name || '');
  const [iconUrl, setIconUrl] = useState(initialConv.icon_url || null);
  const [editingName, setEditingName] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const myRole = members.find(m => m.user_id === user?.id)?.role;
  const isAdmin = myRole === 'admin';

  useEffect(() => {
    loadDetails();
  }, []);

  const loadDetails = async () => {
    try {
      const data = await messageAPI.getConversationDetails(initialConv.id);
      setMembers(data.members || []);
      if (data.name) setGroupName(data.name);
      if (data.icon_url) setIconUrl(data.icon_url);
    } catch {
      Alert.alert('エラー', 'グループ情報の読み込みに失敗しました');
    } finally {
      setLoading(false);
    }
  };

  const handleChangeIcon = async () => {
    if (!isAdmin) return;
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('許可が必要です', 'フォトライブラリへのアクセスを許可してください');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (result.canceled) return;
    setSaving(true);
    try {
      const uri = result.assets[0].uri;
      const ext = uri.split('.').pop() || 'jpg';
      const formData = new FormData();
      formData.append('icon', { uri, name: `icon.${ext}`, type: `image/${ext}` });
      const data = await messageAPI.updateGroupIcon(initialConv.id, formData);
      setIconUrl(data.icon_url);
    } catch {
      Alert.alert('エラー', 'アイコンの更新に失敗しました');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveName = async () => {
    if (!groupName.trim()) return;
    setSaving(true);
    try {
      await messageAPI.updateGroup(initialConv.id, { name: groupName.trim() });
      setEditingName(false);
    } catch {
      Alert.alert('エラー', 'グループ名の更新に失敗しました');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleAdmin = (member) => {
    if (!isAdmin || member.user_id === user?.id) return;
    const newRole = member.role === 'admin' ? 'member' : 'admin';
    const label = newRole === 'admin' ? '管理者に設定' : '管理者を解除';
    Alert.alert(label, `${member.display_name || member.username} を${label}しますか？`, [
      { text: 'キャンセル', style: 'cancel' },
      {
        text: label,
        onPress: async () => {
          try {
            await messageAPI.updateMemberRole(initialConv.id, member.user_id, newRole);
            setMembers(prev => prev.map(m =>
              m.user_id === member.user_id ? { ...m, role: newRole } : m
            ));
          } catch {
            Alert.alert('エラー', '権限の変更に失敗しました');
          }
        },
      },
    ]);
  };

  const handleRemoveMember = (member) => {
    Alert.alert(
      'メンバーを削除',
      `${member.display_name || member.username} をグループから削除しますか？`,
      [
        { text: 'キャンセル', style: 'cancel' },
        {
          text: '削除',
          style: 'destructive',
          onPress: async () => {
            try {
              await messageAPI.removeMember(initialConv.id, member.user_id);
              setMembers(prev => prev.filter(m => m.user_id !== member.user_id));
            } catch {
              Alert.alert('エラー', 'メンバーの削除に失敗しました');
            }
          },
        },
      ]
    );
  };

  const handleAddMember = () => {
    navigation.navigate('AddGroupMember', {
      conversationId: initialConv.id,
      existingMemberIds: members.map(m => m.user_id),
      onAdded: (newMembers) => {
        setMembers(prev => {
          const ids = new Set(prev.map(m => m.user_id));
          return [...prev, ...newMembers.filter(m => !ids.has(m.user_id))];
        });
      },
    });
  };

  const handleLeave = () => {
    Alert.alert('グループを退出', 'このグループから退出しますか？', [
      { text: 'キャンセル', style: 'cancel' },
      {
        text: '退出',
        style: 'destructive',
        onPress: async () => {
          try {
            await messageAPI.leaveGroup(initialConv.id);
            navigation.popToTop();
          } catch {
            Alert.alert('エラー', 'グループの退出に失敗しました');
          }
        },
      },
    ]);
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={Colors.primary} size="large" />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* アイコン・グループ名 */}
      <View style={styles.iconSection}>
        <TouchableOpacity onPress={handleChangeIcon} disabled={!isAdmin || saving} activeOpacity={isAdmin ? 0.7 : 1}>
          <Avatar uri={iconUrl} name={groupName} size={84} />
          {isAdmin && (
            <View style={styles.cameraBadge}>
              {saving ? <ActivityIndicator size="small" color="#fff" /> : <Ionicons name="camera" size={14} color="#fff" />}
            </View>
          )}
        </TouchableOpacity>

        {editingName ? (
          <View style={styles.nameEditRow}>
            <TextInput
              style={styles.nameInput}
              value={groupName}
              onChangeText={setGroupName}
              autoFocus
              maxLength={50}
              placeholderTextColor={Colors.muted}
            />
            <TouchableOpacity onPress={handleSaveName} disabled={saving} style={styles.nameEditBtn}>
              <Ionicons name="checkmark" size={22} color={Colors.primary} />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setEditingName(false)} style={styles.nameEditBtn}>
              <Ionicons name="close" size={22} color={Colors.muted} />
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity
            style={styles.nameRow}
            onPress={() => isAdmin && setEditingName(true)}
            activeOpacity={isAdmin ? 0.7 : 1}
          >
            <Text style={styles.groupName}>{groupName}</Text>
            {isAdmin && <Ionicons name="pencil-outline" size={16} color={Colors.muted} style={{ marginLeft: 6 }} />}
          </TouchableOpacity>
        )}
        <Text style={styles.memberCount}>{members.length}人のメンバー</Text>
      </View>

      {/* メンバー一覧 */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>メンバー</Text>
          {isAdmin && (
            <TouchableOpacity style={styles.addBtn} onPress={handleAddMember}>
              <Ionicons name="person-add-outline" size={15} color={Colors.primary} />
              <Text style={styles.addBtnText}>追加</Text>
            </TouchableOpacity>
          )}
        </View>

        {members.map((member, index) => (
          <View key={member.user_id} style={[styles.memberRow, index > 0 && styles.memberRowBorder]}>
            <Avatar uri={member.avatar_url} name={member.display_name || member.username} size={42} />
            <View style={styles.memberInfo}>
              <View style={styles.memberNameRow}>
                <Text style={styles.memberName}>{member.display_name || member.username}</Text>
                {member.role === 'admin' && (
                  <View style={styles.adminBadge}>
                    <Text style={styles.adminBadgeText}>管理者</Text>
                  </View>
                )}
                {member.user_id === user?.id && (
                  <Text style={styles.meSuffix}>（自分）</Text>
                )}
              </View>
              <Text style={styles.memberUsername}>@{member.username}</Text>
            </View>

            {isAdmin && member.user_id !== user?.id && (
              <View style={styles.memberActions}>
                <TouchableOpacity
                  style={styles.actionBtn}
                  onPress={() => handleToggleAdmin(member)}
                >
                  <Ionicons
                    name={member.role === 'admin' ? 'shield' : 'shield-outline'}
                    size={20}
                    color={member.role === 'admin' ? Colors.primary : Colors.muted}
                  />
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.actionBtn}
                  onPress={() => handleRemoveMember(member)}
                >
                  <Ionicons name="person-remove-outline" size={20} color={Colors.error} />
                </TouchableOpacity>
              </View>
            )}
          </View>
        ))}
      </View>

      {/* 退出ボタン */}
      <TouchableOpacity style={styles.leaveBtn} onPress={handleLeave}>
        <Ionicons name="exit-outline" size={18} color={Colors.error} />
        <Text style={styles.leaveBtnText}>グループを退出</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { paddingBottom: 40 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.background },

  iconSection: {
    alignItems: 'center',
    paddingVertical: 28,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  cameraBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: Colors.background,
  },
  nameRow: { flexDirection: 'row', alignItems: 'center', marginTop: 14, marginBottom: 4 },
  groupName: { fontSize: 20, fontWeight: 'bold', color: Colors.foreground },
  nameEditRow: { flexDirection: 'row', alignItems: 'center', marginTop: 14, marginBottom: 4, gap: 6 },
  nameInput: {
    flex: 1,
    backgroundColor: Colors.card,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    color: Colors.foreground,
    fontSize: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    minWidth: 160,
  },
  nameEditBtn: { padding: 4 },
  memberCount: { fontSize: 13, color: Colors.muted, marginTop: 4 },

  section: {
    backgroundColor: Colors.card,
    marginTop: 16,
    marginHorizontal: 16,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  sectionTitle: { fontSize: 14, fontWeight: '600', color: Colors.muted, textTransform: 'uppercase', letterSpacing: 0.5 },
  addBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  addBtnText: { fontSize: 14, color: Colors.primary, fontWeight: '600' },

  memberRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12 },
  memberRowBorder: { borderTopWidth: 1, borderTopColor: Colors.border },
  memberInfo: { flex: 1, marginLeft: 12 },
  memberNameRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  memberName: { fontSize: 15, fontWeight: '600', color: Colors.foreground },
  meSuffix: { fontSize: 12, color: Colors.muted },
  memberUsername: { fontSize: 12, color: Colors.muted, marginTop: 2 },
  adminBadge: {
    backgroundColor: Colors.primary + '33',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
  },
  adminBadgeText: { fontSize: 11, color: Colors.primary, fontWeight: '600' },
  memberActions: { flexDirection: 'row', gap: 4 },
  actionBtn: { padding: 6 },

  avatarPlaceholder: {
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitial: { color: '#fff', fontWeight: 'bold' },

  leaveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 24,
    marginHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.error + '55',
    backgroundColor: Colors.error + '11',
  },
  leaveBtnText: { fontSize: 15, color: Colors.error, fontWeight: '600' },
});
