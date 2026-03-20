import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, ActivityIndicator, Alert, KeyboardAvoidingView, Platform, Image,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { seriesAPI } from '../api/client';
import { Colors } from '../theme/colors';

export default function CreateSeriesScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [coverAsset, setCoverAsset] = useState(null);
  const [creating, setCreating] = useState(false);

  const pickCover = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('権限エラー', 'フォトライブラリへのアクセスを許可してください');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [3, 4],
      quality: 0.85,
    });
    if (!result.canceled && result.assets?.[0]) {
      setCoverAsset(result.assets[0]);
    }
  };

  const handleCreate = async () => {
    if (!title.trim()) {
      Alert.alert('エラー', 'シリーズ名を入力してください');
      return;
    }
    setCreating(true);
    try {
      const formData = new FormData();
      formData.append('title', title.trim());
      if (description.trim()) formData.append('description', description.trim());
      if (coverAsset) {
        const isHeif = /heic|heif/i.test(coverAsset.mimeType || '');
        formData.append('cover_image', {
          uri: coverAsset.uri,
          type: isHeif ? 'image/jpeg' : (coverAsset.mimeType || 'image/jpeg'),
          name: (coverAsset.fileName || 'cover.jpg').replace(/\.(heic|heif)$/i, '.jpg'),
        });
      }
      const response = await seriesAPI.create(formData);
      Alert.alert('作成しました', `「${response.series.title}」を作成しました`, [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } catch (e) {
      console.error('Create series error:', e);
      Alert.alert('エラー', 'シリーズの作成に失敗しました');
    } finally {
      setCreating(false);
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
        <Text style={styles.headerTitle}>シリーズを作成</Text>
        <TouchableOpacity onPress={handleCreate} style={styles.createBtn} disabled={creating}>
          {creating ? (
            <ActivityIndicator size="small" color={Colors.primary} />
          ) : (
            <Text style={styles.createText}>作成</Text>
          )}
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        <TouchableOpacity style={styles.coverPicker} onPress={pickCover}>
          {coverAsset ? (
            <Image source={{ uri: coverAsset.uri }} style={styles.coverPreview} resizeMode="cover" />
          ) : (
            <View style={styles.coverPlaceholder}>
              <Text style={styles.coverPlaceholderIcon}>🖼️</Text>
              <Text style={styles.coverPlaceholderText}>カバー画像を選択</Text>
              <Text style={styles.coverPlaceholderSub}>推奨: 3:4 比率</Text>
            </View>
          )}
        </TouchableOpacity>

        <Text style={styles.label}>シリーズ名 <Text style={styles.required}>*</Text></Text>
        <TextInput
          style={styles.input}
          value={title}
          onChangeText={setTitle}
          placeholder="シリーズ名を入力"
          placeholderTextColor={Colors.muted}
          maxLength={200}
        />

        <Text style={styles.label}>説明</Text>
        <TextInput
          style={[styles.input, styles.descInput]}
          value={description}
          onChangeText={setDescription}
          placeholder="シリーズの説明を書いてください（任意）"
          placeholderTextColor={Colors.muted}
          multiline
          maxLength={1000}
        />
        <Text style={styles.charCount}>{description.length}/1000</Text>
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
  createBtn: { padding: 4, minWidth: 40, alignItems: 'center' },
  createText: { color: Colors.primary, fontSize: 15, fontWeight: '700' },
  body: { padding: 20 },
  coverPicker: {
    alignSelf: 'center',
    marginBottom: 24,
    borderRadius: 12,
    overflow: 'hidden',
  },
  coverPreview: { width: 180, height: 240, borderRadius: 12 },
  coverPlaceholder: {
    width: 180,
    height: 240,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  coverPlaceholderIcon: { fontSize: 40, marginBottom: 8 },
  coverPlaceholderText: { color: Colors.foreground, fontSize: 14, fontWeight: '600' },
  coverPlaceholderSub: { color: Colors.muted, fontSize: 11, marginTop: 4 },
  label: { fontSize: 13, color: Colors.muted, fontWeight: '600', marginBottom: 6, marginTop: 16 },
  required: { color: Colors.error || '#e53e3e' },
  input: {
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    color: Colors.foreground,
    fontSize: 15,
  },
  descInput: { height: 120, textAlignVertical: 'top' },
  charCount: { fontSize: 11, color: Colors.muted, textAlign: 'right', marginTop: 4 },
});
