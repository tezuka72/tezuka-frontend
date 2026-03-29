import { useState, useEffect } from 'react';
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
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { postAPI, affiliateAPI, seriesAPI } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { Colors } from '../theme/colors';
import { Shadows } from '../theme/styles';

const MAX_PAGES = 11;

export default function PostCreateScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { t } = useLanguage();
  const { user } = useAuth();
  const [step, setStep] = useState(1); // 1: 写真選択, 2: プレビュー, 3: 詳細入力
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [postType, setPostType] = useState('vertical_scroll');
  const [images, setImages] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [titleError, setTitleError] = useState('');
  const [thumbnailIndex, setThumbnailIndex] = useState(0);
  const [createError, setCreateError] = useState('');
  const [hashtagText, setHashtagText] = useState('');
  const [hashtags, setHashtags] = useState([]);
  const [isPremium, setIsPremium] = useState(false);
  const [scheduledAt, setScheduledAt] = useState('');
  const [pendingProducts, setPendingProducts] = useState([]);
  const [showProductForm, setShowProductForm] = useState(false);
  const [productName, setProductName] = useState('');
  const [productUrlAmazon, setProductUrlAmazon] = useState('');
  const [productUrlRakuten, setProductUrlRakuten] = useState('');
  const [productUrlYahoo, setProductUrlYahoo] = useState('');
  const [productImageUrl, setProductImageUrl] = useState('');
  const [productPrice, setProductPrice] = useState('');

  // シリーズ選択
  const [mySeries, setMySeries] = useState([]);
  const [selectedSeriesId, setSelectedSeriesId] = useState(null);
  const [showSeriesPicker, setShowSeriesPicker] = useState(false);

  useEffect(() => {
    if (user?.username) {
      seriesAPI.getMySeries(user.username)
        .then(res => setMySeries(res.series || []))
        .catch(() => {});
    }
  }, [user?.username]);

  const handlePickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      quality: 0.85,   // iOS: HEIC → JPEG へ自動変換される
      exif: false,     // EXIF不要 / 変換を促進
    });

    if (!result.canceled) {
      if (result.assets.length > MAX_PAGES) {
        Alert.alert(t('common.error'), `${t('create.uploadMaxPrefix')}${MAX_PAGES}${t('create.errorMaxImages')}`);
        return;
      }
      setImages(result.assets);
      setThumbnailIndex(0);
      setStep(2);
    }
  };

  // Web用: expo-image-picker v17はasset.fileで生のFileオブジェクトを提供
  const getWebFile = async (asset, index) => {
    if (asset.file) return asset.file;
    // フォールバック: blob URIからFileを作成
    const response = await fetch(asset.uri);
    const blob = await response.blob();
    const ext = asset.mimeType === 'image/png' ? '.png' : '.jpg';
    return new File([blob], asset.fileName || `page-${index + 1}${ext}`, {
      type: asset.mimeType || 'image/jpeg',
    });
  };

  const handleAddProduct = () => {
    if (!productName.trim()) {
      Alert.alert(t('common.error'), '商品名を入力してください');
      return;
    }
    if (!productUrlAmazon && !productUrlRakuten && !productUrlYahoo) {
      Alert.alert(t('common.error'), 'いずれかのショッピングURLを入力してください');
      return;
    }
    setPendingProducts(prev => [...prev, {
      product_name: productName.trim(),
      product_url_amazon: productUrlAmazon.trim() || null,
      product_url_rakuten: productUrlRakuten.trim() || null,
      product_url_yahoo: productUrlYahoo.trim() || null,
      image_url: productImageUrl.trim() || null,
      price: productPrice ? parseInt(productPrice, 10) : null,
    }]);
    setProductName('');
    setProductUrlAmazon('');
    setProductUrlRakuten('');
    setProductUrlYahoo('');
    setProductImageUrl('');
    setProductPrice('');
    setShowProductForm(false);
  };

  const handleRemoveProduct = (index) => {
    setPendingProducts(prev => prev.filter((_, i) => i !== index));
  };

  const handleNextFromPreview = () => {
    setStep(3);
  };

  const handleCreate = async () => {
    setShowPreview(false);
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('title', title);
      formData.append('description', description);
      formData.append('type', postType);
      if (selectedSeriesId) formData.append('series_id', String(selectedSeriesId));
      if (isPremium) formData.append('is_premium', 'true');
      if (scheduledAt.trim()) formData.append('scheduled_at', scheduledAt.trim());
      hashtags.forEach(tag => formData.append('hashtags[]', tag));

      // サムネを先頭に並べ替え
      const orderedImages = thumbnailIndex === 0
        ? images
        : [images[thumbnailIndex], ...images.filter((_, i) => i !== thumbnailIndex)];

      for (let i = 0; i < orderedImages.length; i++) {
        const asset = orderedImages[i];
        if (Platform.OS === 'web') {
          const file = await getWebFile(asset, i);
          formData.append('images', file);
        } else {
          // HEIC/HEIF はmimeType・URI・ファイル名いずれかで検出してJPEGに変換
          const isHeif = /heic|heif/i.test(asset.mimeType || '')
            || /heic|heif/i.test(asset.uri || '')
            || /heic|heif/i.test(asset.fileName || '');
          const safeType = isHeif ? 'image/jpeg' : (asset.mimeType || 'image/jpeg');
          const safeName = (asset.fileName || `page-${i + 1}.jpg`)
            .replace(/\.(heic|heif)$/i, '.jpg');
          formData.append('images', {
            uri: asset.uri,
            type: safeType,
            name: safeName,
          });
        }
      }

      const created = await postAPI.create(formData);
      const postId = created.post?.id || created.id;
      if (postId && pendingProducts.length > 0) {
        await Promise.all(
          pendingProducts.map(p => affiliateAPI.tagProduct({ post_id: postId, ...p }).catch(() => {}))
        );
      }
      Alert.alert(t('common.success'), t('create.successMessage'));
      setTitle('');
      setDescription('');
      setImages([]);
      setPendingProducts([]);
      setStep(1);
      navigation?.goBack();
    } catch (error) {
      console.error('Post create error:', error.code, error.response?.status, JSON.stringify(error.response?.data));
      let msg;
      if (!error.response) {
        if (error.code === 'ECONNABORTED' || error.message?.includes('timeout')) {
          msg = 'サーバーの起動に時間がかかっています。しばらく待ってから再度お試しください（最大60秒）';
        } else {
          msg = `ネットワークエラー: ${error.message} (${error.code})`;
        }
      } else if (error.response.status === 401) {
        msg = 'ログインが必要です。再ログインしてください。';
      } else {
        msg = error.response.data?.error || error.response.data?.errors?.[0]?.msg || t('create.errorCreate');
      }
      setCreateError(msg);
    } finally {
      setUploading(false);
    }
  };

  const addHashtag = () => {
    const tag = hashtagText.trim().replace(/^#/, '').toLowerCase();
    if (tag && !hashtags.includes(tag)) {
      setHashtags(prev => [...prev, tag]);
    }
    setHashtagText('');
  };

  const removeHashtag = (tag) => setHashtags(prev => prev.filter(t => t !== tag));

  const postTypes = [
    { value: 'vertical_scroll', label: t('create.verticalScroll'), emoji: '📖' },
    { value: 'horizontal_scroll', label: t('create.horizontalScroll'), emoji: '📚' },
  ];

  const postTypeLabel = postType === 'vertical_scroll' ? t('create.verticalScroll') : t('create.horizontalScroll');

  // Step 1: 写真選択
  if (step === 1) {
    return (
      <View style={[styles.stepContainer, { paddingTop: insets.top }]}>
        <Text style={styles.stepTitle}>写真・漫画を選ぶ</Text>
        <TouchableOpacity style={styles.bigUploadBox} onPress={handlePickImage}>
          <Text style={styles.bigUploadIcon}>＋</Text>
          <Text style={styles.bigUploadText}>写真を選択</Text>
          <Text style={styles.uploadHint}>最大{MAX_PAGES}枚</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // Step 2: サムネ選択
  if (step === 2) {
    return (
      <View style={[styles.stepContainer, { paddingTop: insets.top, justifyContent: 'flex-start' }]}>
        <View style={styles.stepHeader}>
          <TouchableOpacity onPress={() => setStep(1)}>
            <Text style={styles.backText}>＜ 戻る</Text>
          </TouchableOpacity>
          <Text style={styles.stepTitle}>{images.length}枚選択済み</Text>
        </View>
        <Text style={styles.thumbSelectLabel}>タップしてサムネイルを選択</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.previewScroll} contentContainerStyle={{ paddingHorizontal: 16, gap: 10 }}>
          {images.map((img, i) => (
            <TouchableOpacity
              key={i}
              onPress={() => setThumbnailIndex(i)}
              activeOpacity={0.8}
              style={styles.thumbWrapper}
            >
              <Image source={{ uri: img.uri }} style={[styles.thumbImage, thumbnailIndex === i && styles.thumbImageSelected]} resizeMode="cover" />
              {thumbnailIndex === i && (
                <View style={styles.thumbBadge}>
                  <Text style={styles.thumbBadgeText}>🖼️ カバー</Text>
                </View>
              )}
            </TouchableOpacity>
          ))}
        </ScrollView>
        <TouchableOpacity style={[styles.button, { marginTop: 24, marginBottom: Math.max(insets.bottom, 20) + 16 }]} onPress={handleNextFromPreview}>
          <Text style={styles.buttonText}>次へ</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // Step 3: 詳細入力
  return (
    <>
    {/* シリーズ選択モーダル */}
    <Modal visible={showSeriesPicker} animationType="slide" transparent>
      <View style={styles.previewOverlay}>
        <View style={styles.previewModal}>
          <Text style={styles.previewHeading}>シリーズを選択</Text>
          <ScrollView showsVerticalScrollIndicator={false}>
            <TouchableOpacity
              style={[styles.seriesOption, !selectedSeriesId && styles.seriesOptionActive]}
              onPress={() => { setSelectedSeriesId(null); setShowSeriesPicker(false); }}
            >
              <Text style={styles.seriesOptionText}>なし（シリーズに追加しない）</Text>
            </TouchableOpacity>
            {mySeries.map(s => (
              <TouchableOpacity
                key={s.id}
                style={[styles.seriesOption, selectedSeriesId === s.id && styles.seriesOptionActive]}
                onPress={() => { setSelectedSeriesId(s.id); setShowSeriesPicker(false); }}
              >
                <Ionicons name="book-outline" size={16} color={selectedSeriesId === s.id ? Colors.primary : Colors.muted} />
                <Text style={[styles.seriesOptionText, selectedSeriesId === s.id && styles.seriesOptionTextActive]} numberOfLines={1}>
                  {s.title}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
          <TouchableOpacity style={[styles.button, styles.cancelButton]} onPress={() => setShowSeriesPicker(false)}>
            <Text style={styles.cancelButtonText}>キャンセル</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>

    <Modal visible={showProductForm} animationType="slide" transparent>
      <View style={styles.previewOverlay}>
        <View style={styles.previewModal}>
          <Text style={styles.previewHeading}>商品を追加</Text>
          <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            <TextInput
              style={styles.input}
              placeholder="商品名（必須）"
              placeholderTextColor={Colors.muted}
              value={productName}
              onChangeText={setProductName}
            />
            <TextInput
              style={styles.input}
              placeholder="Amazon URL（任意）"
              placeholderTextColor={Colors.muted}
              value={productUrlAmazon}
              onChangeText={setProductUrlAmazon}
              autoCapitalize="none"
              keyboardType="url"
            />
            <TextInput
              style={styles.input}
              placeholder="楽天 URL（任意）"
              placeholderTextColor={Colors.muted}
              value={productUrlRakuten}
              onChangeText={setProductUrlRakuten}
              autoCapitalize="none"
              keyboardType="url"
            />
            <TextInput
              style={styles.input}
              placeholder="Yahoo! URL（任意）"
              placeholderTextColor={Colors.muted}
              value={productUrlYahoo}
              onChangeText={setProductUrlYahoo}
              autoCapitalize="none"
              keyboardType="url"
            />
            <TextInput
              style={styles.input}
              placeholder="商品画像URL（任意）"
              placeholderTextColor={Colors.muted}
              value={productImageUrl}
              onChangeText={setProductImageUrl}
              autoCapitalize="none"
              keyboardType="url"
            />
            <TextInput
              style={styles.input}
              placeholder="価格（任意、例: 2980）"
              placeholderTextColor={Colors.muted}
              value={productPrice}
              onChangeText={setProductPrice}
              keyboardType="number-pad"
            />
          </ScrollView>
          <View style={styles.previewActions}>
            <TouchableOpacity
              style={[styles.button, styles.cancelButton]}
              onPress={() => setShowProductForm(false)}
            >
              <Text style={styles.cancelButtonText}>キャンセル</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.button} onPress={handleAddProduct}>
              <Text style={styles.buttonText}>追加する</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>

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
    <ScrollView style={styles.container} contentContainerStyle={[styles.contentContainer, { paddingTop: insets.top, paddingBottom: insets.bottom + 24 }]}>
      <View style={styles.content}>
        <View style={styles.stepHeader}>
          <TouchableOpacity onPress={() => setStep(2)}>
            <Text style={styles.backText}>＜ 戻る</Text>
          </TouchableOpacity>
          <Text style={styles.title}>{t('create.title')}</Text>
        </View>

        <View style={styles.form}>
          {/* シリーズ選択 */}
          {mySeries.length > 0 && (
            <>
              <Text style={styles.label}>📚 シリーズに追加（任意）</Text>
              <TouchableOpacity
                style={styles.seriesPickerBtn}
                onPress={() => setShowSeriesPicker(true)}
                activeOpacity={0.8}
              >
                <Ionicons name="book-outline" size={16} color={Colors.muted} />
                <Text style={[styles.seriesPickerText, selectedSeriesId && styles.seriesPickerTextActive]} numberOfLines={1}>
                  {selectedSeriesId
                    ? mySeries.find(s => s.id === selectedSeriesId)?.title || 'シリーズを選択'
                    : 'シリーズを選択（なし）'}
                </Text>
                <Ionicons name="chevron-down" size={16} color={Colors.muted} />
              </TouchableOpacity>
              {selectedSeriesId && (
                <TouchableOpacity onPress={() => setSelectedSeriesId(null)} style={styles.seriesClearBtn}>
                  <Text style={styles.seriesClearText}>✕ シリーズの選択を解除</Text>
                </TouchableOpacity>
              )}
            </>
          )}

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
            style={[styles.input, titleError ? { borderColor: Colors.error } : null]}
            placeholder={t('create.titlePlaceholder')}
            placeholderTextColor={Colors.muted}
            value={title}
            onChangeText={(v) => { setTitle(v); if (v.trim()) setTitleError(''); }}
          />
          {titleError ? <Text style={{ color: Colors.error, fontSize: 13, marginTop: -14, marginBottom: 14 }}>{titleError}</Text> : null}

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

          {/* ハッシュタグ */}
          <Text style={styles.label}># ハッシュタグ（任意）</Text>
          <View style={styles.hashtagInputRow}>
            <TextInput
              style={[styles.input, styles.hashtagInput]}
              placeholder="#タグを入力してEnter"
              placeholderTextColor={Colors.muted}
              value={hashtagText}
              onChangeText={setHashtagText}
              onSubmitEditing={addHashtag}
              returnKeyType="done"
              autoCapitalize="none"
            />
            <TouchableOpacity style={styles.hashtagAddBtn} onPress={addHashtag}>
              <Text style={styles.hashtagAddBtnText}>追加</Text>
            </TouchableOpacity>
          </View>
          {hashtags.length > 0 && (
            <View style={styles.hashtagChips}>
              {hashtags.map(tag => (
                <TouchableOpacity key={tag} style={styles.hashtagChip} onPress={() => removeHashtag(tag)}>
                  <Text style={styles.hashtagChipText}>#{tag} ✕</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          {/* ファン限定 */}
          <View style={styles.toggleRow}>
            <View>
              <Text style={styles.label}>🔒 ファン限定コンテンツ</Text>
              <Text style={styles.toggleDesc}>応援したファンのみ閲覧可能にする</Text>
            </View>
            <TouchableOpacity
              style={[styles.toggle, isPremium && styles.toggleOn]}
              onPress={() => setIsPremium(v => !v)}
            >
              <View style={[styles.toggleThumb, isPremium && styles.toggleThumbOn]} />
            </TouchableOpacity>
          </View>

          {/* 予約投稿 */}
          <Text style={styles.label}>🕐 予約投稿日時（任意）</Text>
          <TextInput
            style={styles.input}
            placeholder="例: 2025-06-01T18:00:00"
            placeholderTextColor={Colors.muted}
            value={scheduledAt}
            onChangeText={setScheduledAt}
            autoCapitalize="none"
          />
          {scheduledAt.trim() ? (
            <Text style={styles.scheduleHint}>この日時に自動公開されます</Text>
          ) : null}

          <View style={styles.productSection}>
            <View style={styles.productSectionHeader}>
              <Text style={styles.label}>🛍️ 関連商品タグ（任意）</Text>
              <TouchableOpacity
                style={styles.addProductButton}
                onPress={() => setShowProductForm(true)}
              >
                <Text style={styles.addProductButtonText}>＋ 追加</Text>
              </TouchableOpacity>
            </View>
            {pendingProducts.map((product, index) => (
              <View key={index} style={styles.pendingProductCard}>
                <View style={styles.pendingProductInfo}>
                  <Text style={styles.pendingProductName} numberOfLines={1}>
                    {product.product_name}
                  </Text>
                  <Text style={styles.pendingProductMeta}>
                    {[
                      product.product_url_amazon && 'Amazon',
                      product.product_url_rakuten && '楽天',
                      product.product_url_yahoo && 'Yahoo!',
                    ].filter(Boolean).join(' · ')}
                    {product.price ? `　¥${product.price.toLocaleString()}` : ''}
                  </Text>
                </View>
                <TouchableOpacity onPress={() => handleRemoveProduct(index)}>
                  <Text style={styles.removeProductText}>✕</Text>
                </TouchableOpacity>
              </View>
            ))}
          </View>

          {createError ? <Text style={{ color: Colors.error, fontSize: 13, marginBottom: 12 }}>{createError}</Text> : null}

          <TouchableOpacity
            style={[styles.button, uploading && styles.buttonDisabled]}
            onPress={() => {
              if (!title.trim()) {
                setTitleError(t('create.errorNoTitle'));
                return;
              }
              setTitleError('');
              setCreateError('');
              handleCreate();
            }}
            disabled={uploading}
          >
            <Text style={styles.buttonText}>
              {uploading ? t('common.uploading') : '投稿する'}
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
  contentContainer: {
    flexGrow: 1,
    justifyContent: 'center',
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
    borderStyle: Platform.OS === 'android' ? 'solid' : 'dashed',
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
  productSection: {
    marginBottom: 24,
  },
  productSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  addProductButton: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 16,
  },
  addProductButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  pendingProductCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 8,
  },
  pendingProductInfo: {
    flex: 1,
  },
  pendingProductName: {
    color: Colors.foreground,
    fontSize: 14,
    fontWeight: '600',
  },
  pendingProductMeta: {
    color: Colors.muted,
    fontSize: 12,
    marginTop: 2,
  },
  removeProductText: {
    color: Colors.muted,
    fontSize: 18,
    paddingLeft: 12,
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
  stepContainer: {
    flex: 1,
    backgroundColor: Colors.background,
    padding: 24,
    justifyContent: 'center',
  },
  stepHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    marginBottom: 24,
  },
  backText: {
    color: Colors.primary,
    fontSize: 16,
    fontWeight: '600',
  },
  stepTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: Colors.foreground,
    textAlign: 'center',
    marginBottom: 32,
  },
  bigUploadBox: {
    backgroundColor: Colors.card,
    borderRadius: 24,
    borderWidth: 2,
    borderColor: Colors.primary,
    borderStyle: 'dashed',
    padding: 60,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bigUploadIcon: {
    fontSize: 64,
    color: Colors.primary,
    fontWeight: '300',
    marginBottom: 16,
  },
  bigUploadText: {
    fontSize: 18,
    color: Colors.foreground,
    fontWeight: '600',
    marginBottom: 8,
  },
  hashtagInputRow: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  hashtagInput: { flex: 1, marginBottom: 0 },
  hashtagAddBtn: {
    backgroundColor: Colors.primary,
    borderRadius: 16,
    paddingHorizontal: 16,
    justifyContent: 'center',
  },
  hashtagAddBtnText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  hashtagChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 20 },
  hashtagChip: {
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.primary,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  hashtagChipText: { color: Colors.primary, fontSize: 13, fontWeight: '600' },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  toggleDesc: { fontSize: 12, color: Colors.muted, marginTop: 2 },
  toggle: {
    width: 48,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.border,
    padding: 3,
    justifyContent: 'center',
  },
  toggleOn: { backgroundColor: Colors.primary },
  toggleThumb: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#fff',
  },
  toggleThumbOn: { alignSelf: 'flex-end' },
  scheduleHint: { fontSize: 12, color: Colors.primary, marginTop: -14, marginBottom: 20 },
  seriesPickerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: Colors.background,
    marginBottom: 8,
  },
  seriesPickerText: {
    flex: 1,
    fontSize: 14,
    color: Colors.muted,
  },
  seriesPickerTextActive: {
    color: Colors.foreground,
    fontWeight: '600',
  },
  seriesClearBtn: {
    marginBottom: 16,
  },
  seriesClearText: {
    fontSize: 12,
    color: Colors.error,
  },
  seriesOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 14,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  seriesOptionActive: {
    backgroundColor: 'rgba(183,108,200,0.08)',
    borderRadius: 8,
    paddingHorizontal: 8,
  },
  seriesOptionText: {
    fontSize: 14,
    color: Colors.foreground,
    flex: 1,
  },
  seriesOptionTextActive: {
    color: Colors.primary,
    fontWeight: '700',
  },
  previewScroll: {
    marginBottom: 24,
  },
  thumbImage: {
    width: 120,
    height: 160,
    borderRadius: 12,
  },
  thumbImageSelected: {
    borderWidth: 3,
    borderColor: Colors.primary,
    borderRadius: 12,
  },
  thumbWrapper: {
    position: 'relative',
  },
  thumbBadge: {
    position: 'absolute',
    bottom: 6,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  thumbBadgeText: {
    backgroundColor: Colors.primary,
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    overflow: 'hidden',
  },
  thumbSelectLabel: {
    fontSize: 13,
    color: Colors.muted,
    textAlign: 'center',
    marginBottom: 12,
  },
});
