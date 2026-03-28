import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, ActivityIndicator, Alert, KeyboardAvoidingView, Platform, Image,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { userAPI } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { Colors } from '../theme/colors';

export default function EditProfileScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { user, updateUser } = useAuth();
  const [displayName, setDisplayName] = useState(user?.display_name || '');
  const [bio, setBio] = useState(user?.bio || '');
  const [avatarUri, setAvatarUri] = useState(null); // 新しく選んだ画像
  const [avatarFile, setAvatarFile] = useState(null); // Webのみ: File オブジェクト
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  const currentAvatar = avatarUri || user?.avatar_url;

  const handlePickAvatar = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('権限が必要です', 'フォトライブラリへのアクセスを許可してください');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) {
      setAvatarUri(result.assets[0].uri);
      setAvatarFile(result.assets[0].file || null); // Webのみ存在する File オブジェクト
    }
  };

  const handleSave = async () => {
    if (!displayName.trim()) {
      Alert.alert('エラー', '表示名を入力してください');
      return;
    }
    setSaving(true);
    try {
      // アバター画像のアップロード
      let newAvatarUrl = user?.avatar_url;
      if (avatarUri) {
        setUploadingAvatar(true);
        const { avatar_url } = await userAPI.uploadAvatar(avatarUri, avatarFile);
        newAvatarUrl = avatar_url;
        setUploadingAvatar(false);
      }

      const data = {};
      if (displayName.trim() !== (user?.display_name || '')) data.display_name = displayName.trim();
      if (bio.trim() !== (user?.bio || '')) data.bio = bio.trim();
      if (newAvatarUrl !== user?.avatar_url) data.avatar_url = newAvatarUrl;

      if (Object.keys(data).length === 0) {
        navigation.goBack();
        return;
      }

      const response = await userAPI.updateProfile(data);
      updateUser({ ...user, ...response.user });
      Alert.alert('保存しました', '', [{ text: 'OK', onPress: () => navigation.goBack() }]);
    } catch (e) {
      console.error('Update profile error:', e);
      Alert.alert('エラー', 'プロフィールの保存に失敗しました');
    } finally {
      setSaving(false);
      setUploadingAvatar(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={[styles.container, { paddingTop: insets.top }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.cancelBtn}>
          <Text style={styles.cancelText}>キャンセル</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>プロフィール編集</Text>
        <TouchableOpacity onPress={handleSave} style={styles.saveBtn} disabled={saving}>
          {saving ? (
            <ActivityIndicator size="small" color={Colors.primary} />
          ) : (
            <Text style={styles.saveText}>保存</Text>
          )}
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        {/* アバター選択 */}
        <TouchableOpacity style={styles.avatarContainer} onPress={handlePickAvatar} disabled={uploadingAvatar}>
          {currentAvatar ? (
            <Image source={{ uri: currentAvatar }} style={styles.avatar} />
          ) : (
            <View style={styles.avatarPlaceholder}>
              <Text style={styles.avatarInitial}>
                {(user?.display_name || user?.username || '?')[0].toUpperCase()}
              </Text>
            </View>
          )}
          <View style={styles.avatarOverlay}>
            {uploadingAvatar
              ? <ActivityIndicator color="#fff" size="small" />
              : <Ionicons name="camera" size={20} color="#fff" />
            }
          </View>
        </TouchableOpacity>
        <Text style={styles.avatarHint}>タップして写真を変更</Text>

        <Text style={styles.label}>表示名</Text>
        <TextInput
          style={styles.input}
          value={displayName}
          onChangeText={setDisplayName}
          placeholder="表示名"
          placeholderTextColor={Colors.muted}
          maxLength={100}
        />

        <Text style={styles.label}>自己紹介</Text>
        <TextInput
          style={[styles.input, styles.bioInput]}
          value={bio}
          onChangeText={setBio}
          placeholder="自己紹介を書いてください"
          placeholderTextColor={Colors.muted}
          multiline
          maxLength={500}
        />
        <Text style={styles.charCount}>{bio.length}/500</Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  headerTitle: { fontSize: 17, fontWeight: '600', color: Colors.foreground },
  cancelBtn: { padding: 4 },
  cancelText: { color: Colors.muted, fontSize: 15 },
  saveBtn: { padding: 4, minWidth: 40, alignItems: 'center' },
  saveText: { color: Colors.primary, fontSize: 15, fontWeight: '700' },
  body: { padding: 20, alignItems: 'center' },
  avatarContainer: {
    width: 90,
    height: 90,
    borderRadius: 45,
    marginTop: 8,
    marginBottom: 4,
    position: 'relative',
  },
  avatar: {
    width: 90,
    height: 90,
    borderRadius: 45,
  },
  avatarPlaceholder: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitial: {
    fontSize: 36,
    fontWeight: '700',
    color: '#fff',
  },
  avatarOverlay: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarHint: {
    fontSize: 12,
    color: Colors.muted,
    marginBottom: 16,
  },
  label: {
    fontSize: 13,
    color: Colors.muted,
    fontWeight: '600',
    marginBottom: 6,
    marginTop: 16,
    alignSelf: 'flex-start',
    width: '100%',
  },
  input: {
    width: '100%',
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    color: Colors.foreground,
    fontSize: 15,
  },
  bioInput: { height: 100, textAlignVertical: 'top' },
  charCount: { fontSize: 11, color: Colors.muted, textAlign: 'right', marginTop: 4, width: '100%' },
});
