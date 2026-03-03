import { useState } from 'react';
import {
  View,
  Text,
  Image,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  Platform,
  Modal,
} from 'react-native';

const LOGO = require('../../assets/logo.png');
import * as ImagePicker from 'expo-image-picker';
import { postAPI } from '../api/client';
import { useLanguage } from '../context/LanguageContext';
import { Colors } from '../theme/colors';
import { Shadows } from '../theme/styles';

const MAX_PAGES = 11;

export default function PostCreateScreen({ navigation }) {
  const { t } = useLanguage();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [postType, setPostType] = useState('vertical_scroll');
  const [images, setImages] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  const handlePickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      quality: 0.85,
    });

    if (!result.canceled) {
      if (result.assets.length > MAX_PAGES) {
        Alert.alert(t('common.error'), `${t('create.uploadMaxPrefix')}${MAX_PAGES}${t('create.errorMaxImages')}`);
        return;
      }
      setImages(result.assets);
    }
  };

  // Web用: blob URI → File オブジェクトに変換
  const uriToFile = async (asset, index) => {
    const response = await fetch(asset.uri);
    const blob = await response.blob();
    const ext = asset.mimeType === 'image/png' ? '.png' : '.jpg';
    return new File([blob], asset.fileName || `page-${index + 1}${ext}`, {
      type: asset.mimeType || 'image/jpeg',
    });
  };

  const handlePreviewPress = () => {
    if (!title.trim()) {
      Alert.alert(t('common.error'), t('create.errorNoTitle'));
      return;
    }
    if (images.length === 0) {
      Alert.alert(t('common.error'), t('create.errorNoImages'));
      return;
    }
    setShowPreview(true);
  };

  const handleCreate = async () => {
    setShowPreview(false);
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('title', title);
      formData.append('description', description);
      formData.append('type', postType);

      for (let i = 0; i < images.length; i++) {
        const asset = images[i];
        if (Platform.OS === 'web') {
          const file = await uriToFile(asset, i);
          formData.append('images', file);
        } else {
          formData.append('images', {
            uri: asset.uri,
            type: asset.mimeType || 'image/jpeg',
            name: asset.fileName || `page-${i + 1}.jpg`,
          });
        }
      }

      await postAPI.create(formData);
      Alert.alert(t('common.success'), t('create.successMessage'));
      setTitle('');
      setDescription('');
      setImages([]);
      navigation?.goBack();
    } catch (error) {
      Alert.alert(t('common.error'), error.response?.data?.error || t('create.errorCreate'));
    } finally {
      setUploading(false);
    }
  };

  const postTypes = [
    { value: 'vertical_scroll', label: t('create.verticalScroll'), emoji: '📖' },
    { value: 'horizontal_scroll', label: t('create.horizontalScroll'), emoji: '📚' },
  ];

  const postTypeLabel = postType === 'vertical_scroll' ? t('create.verticalScroll') : t('create.horizontalScroll');

  return (
    <>
    <Modal visible={showPreview} animationType="slide" transparent>
      <View style={styles.previewOverlay}>
        <View style={styles.previewModal}>
          <Text style={styles.previewHeading}>投稿プレビュー</Text>

          {images[0] && (
            <Image
              source={{ uri: images[0].uri }}
              style={styles.previewImage}
              resizeMode="cover"
            />
          )}

          <View style={styles.previewMeta}>
            <Text style={styles.previewType}>{postTypeLabel} / {images.length}ページ</Text>
            <Text style={styles.previewTitle}>{title}</Text>
            {description ? <Text style={styles.previewDesc}>{description}</Text> : null}
          </View>

          <View style={styles.previewActions}>
            <TouchableOpacity
              style={[styles.button, styles.cancelButton]}
              onPress={() => setShowPreview(false)}
            >
              <Text style={styles.cancelButtonText}>修正する</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.button}
              onPress={handleCreate}
            >
              <Text style={styles.buttonText}>投稿する</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
    <ScrollView style={styles.container}>
      <View style={styles.content}>
        <View style={styles.header}>
          <Image source={LOGO} style={styles.logo} resizeMode="contain" />
          <Text style={styles.title}>{t('create.title')}</Text>
          <Text style={styles.subtitle}>{t('create.subtitle')}</Text>
        </View>

        <View style={styles.form}>
          <Text style={styles.label}>{t('create.postTypeLabel')}</Text>
          <View style={styles.typeSelector}>
            {postTypes.map((type) => (
              <TouchableOpacity
                key={type.value}
                style={[
                  styles.typeButton,
                  postType === type.value && styles.typeButtonActive,
                ]}
                onPress={() => setPostType(type.value)}
              >
                <Text style={styles.typeEmoji}>{type.emoji}</Text>
                <Text
                  style={[
                    styles.typeLabel,
                    postType === type.value && styles.typeLabelActive,
                  ]}
                >
                  {type.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.typeDescription}>
            {postType === 'vertical_scroll'
              ? t('create.verticalDesc')
              : t('create.horizontalDesc')}
          </Text>

          <Text style={styles.label}>{t('create.titleLabel')}</Text>
          <TextInput
            style={styles.input}
            placeholder={t('create.titlePlaceholder')}
            placeholderTextColor={Colors.muted}
            value={title}
            onChangeText={setTitle}
          />

          <Text style={styles.label}>{t('create.descLabel')}</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            placeholder={t('create.descPlaceholder')}
            placeholderTextColor={Colors.muted}
            value={description}
            onChangeText={setDescription}
            multiline
            numberOfLines={4}
          />

          <View style={styles.imageUpload}>
            <TouchableOpacity style={styles.uploadBox} onPress={handlePickImage}>
              <Text style={styles.uploadIcon}>🖼️</Text>
              <Text style={styles.uploadText}>{t('create.uploadText')}</Text>
              <Text style={styles.uploadHint}>
                {images.length > 0
                  ? `${images.length}${t('create.uploadSelectedSuffix')}`
                  : `${t('create.uploadMaxPrefix')}${MAX_PAGES}${t('create.uploadMaxSuffix')}`}
              </Text>
            </TouchableOpacity>
            {images.length > 0 && (
              <Text style={styles.pageCount}>
                {images.length}{t('create.pagesSelected')}
              </Text>
            )}
          </View>

          <TouchableOpacity
            style={[styles.button, uploading && styles.buttonDisabled]}
            onPress={handlePreviewPress}
            disabled={uploading}
          >
            <Text style={styles.buttonText}>
              {uploading ? t('common.uploading') : t('create.button')}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  content: {
    padding: 24,
  },
  header: {
    alignItems: 'center',
    marginBottom: 32,
  },
  logo: {
    width: 64,
    height: 64,
    marginBottom: 8,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: Colors.foreground,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: Colors.muted,
  },
  form: {
    width: '100%',
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.foreground,
    marginBottom: 8,
  },
  typeSelector: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  typeButton: {
    flex: 1,
    backgroundColor: Colors.card,
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: Colors.border,
  },
  typeButtonActive: {
    borderColor: Colors.primary,
    backgroundColor: 'rgba(37, 99, 235, 0.1)',
  },
  typeEmoji: {
    fontSize: 24,
    marginBottom: 4,
  },
  typeLabel: {
    fontSize: 12,
    color: Colors.muted,
    fontWeight: '600',
  },
  typeLabelActive: {
    color: Colors.primary,
  },
  typeDescription: {
    fontSize: 12,
    color: Colors.muted,
    marginBottom: 20,
    paddingHorizontal: 4,
    lineHeight: 18,
  },
  input: {
    backgroundColor: Colors.card,
    borderRadius: 16,
    paddingHorizontal: 20,
    paddingVertical: 16,
    fontSize: 16,
    color: Colors.foreground,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 20,
  },
  textArea: {
    height: 120,
    textAlignVertical: 'top',
  },
  imageUpload: {
    marginBottom: 24,
  },
  uploadBox: {
    backgroundColor: Colors.card,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: Colors.border,
    borderStyle: 'dashed',
    padding: 32,
    alignItems: 'center',
  },
  uploadIcon: {
    fontSize: 40,
    marginBottom: 8,
  },
  uploadText: {
    fontSize: 16,
    color: Colors.foreground,
    fontWeight: '600',
    marginBottom: 4,
  },
  uploadHint: {
    fontSize: 12,
    color: Colors.muted,
  },
  pageCount: {
    textAlign: 'center',
    marginTop: 8,
    fontSize: 14,
    color: Colors.primary,
    fontWeight: '600',
  },
  button: {
    backgroundColor: Colors.primary,
    borderRadius: 24,
    paddingVertical: 16,
    alignItems: 'center',
    ...Shadows.glow,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  cancelButton: {
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  cancelButtonText: {
    color: Colors.foreground,
    fontSize: 16,
    fontWeight: '600',
  },
  previewOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  previewModal: {
    backgroundColor: Colors.background,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
  },
  previewHeading: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.foreground,
    textAlign: 'center',
    marginBottom: 16,
  },
  previewImage: {
    width: '100%',
    height: 220,
    borderRadius: 12,
    marginBottom: 16,
  },
  previewMeta: {
    marginBottom: 20,
  },
  previewType: {
    fontSize: 12,
    color: Colors.muted,
    marginBottom: 6,
  },
  previewTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: Colors.foreground,
    marginBottom: 6,
  },
  previewDesc: {
    fontSize: 14,
    color: Colors.muted,
    lineHeight: 20,
  },
  previewActions: {
    flexDirection: 'row',
    gap: 12,
  },
});
