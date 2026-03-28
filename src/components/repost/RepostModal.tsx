import { useState } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  StyleSheet,
  Platform,
  Alert,
} from 'react-native';
import { Colors } from '../../theme/colors';
import { useCreateRepost } from '../../hooks/useCreateRepost';

const PINK = '#E94B7A';
const CYAN = '#4DD4E8';

interface Manga {
  id: string;
  title: string;
  cover_url: string;
}

interface Page {
  id: string;
  image_url: string;
  page_number: number;
  episode_id: string;
}

interface Props {
  visible: boolean;
  onClose: () => void;
  repostType: 'work' | 'page';
  manga: Manga;
  page?: Page;
  episodeId?: string;
}

export default function RepostModal({ visible, onClose, repostType, manga, page, episodeId }: Props) {
  const [comment, setComment] = useState('');
  const [isSpoiler, setIsSpoiler] = useState(false);
  const { mutate, isPending } = useCreateRepost();

  const handleSubmit = () => {
    mutate(
      {
        repost_type: repostType,
        manga_id: manga.id || undefined,
        page_id: repostType === 'page' ? page?.id : undefined,
        episode_id: page?.episode_id || episodeId,
        comment: comment.trim() || undefined,
        is_spoiler: isSpoiler,
        emotion_tags: [],
      },
      {
        onSuccess: () => {
          setComment('');
          setIsSpoiler(false);
          onClose();
        },
        onError: (error: any) => {
          const status = error?.response?.status;
          const message =
            status === 409
              ? 'すでにリポスト済みです'
              : status === 403
              ? 'リポストが許可されていません'
              : 'リポストに失敗しました';
          Alert.alert('エラー', message);
        },
      }
    );
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          {/* ハンドルバー */}
          <View style={styles.handle} />

          <Text style={styles.title}>リポスト</Text>

          {/* プレビュー */}
          {repostType === 'work' ? (
            <View style={styles.workPreview}>
              {manga.cover_url ? (
                <Image source={{ uri: manga.cover_url }} style={styles.coverThumb} resizeMode="cover" />
              ) : (
                <View style={[styles.coverThumb, styles.coverPlaceholder]}>
                  <Text style={styles.coverPlaceholderText}>📚</Text>
                </View>
              )}
              <Text style={styles.mangaTitle} numberOfLines={2}>{manga.title}</Text>
            </View>
          ) : page ? (
            <View style={styles.pagePreview}>
              <Image source={{ uri: page.image_url }} style={styles.pageThumb} resizeMode="cover" />
              <Text style={styles.pageLabel}>p.{page.page_number}</Text>
            </View>
          ) : null}

          {/* コメント入力 */}
          <TextInput
            style={styles.input}
            placeholder="感想を書く（任意）"
            placeholderTextColor={Colors.muted}
            value={comment}
            onChangeText={setComment}
            maxLength={200}
            multiline
          />
          <Text style={styles.charCount}>{comment.length}/200</Text>

          {/* ネタバレチェックボックス */}
          <TouchableOpacity style={styles.checkRow} onPress={() => setIsSpoiler(!isSpoiler)} activeOpacity={0.7}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <View style={[styles.checkbox, isSpoiler && styles.checkboxChecked]}>
                {isSpoiler && <Text style={styles.checkmark}>✓</Text>}
              </View>
              <Text style={styles.checkLabel}>ネタバレあり</Text>
            </View>
          </TouchableOpacity>

          {/* ボタン */}
          <View style={styles.buttonRow}>
            <TouchableOpacity style={styles.cancelBtn} onPress={onClose} activeOpacity={0.8}>
              <Text style={styles.cancelText}>キャンセル</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.submitBtn, isPending && styles.submitBtnDisabled]}
              onPress={handleSubmit}
              disabled={isPending}
              activeOpacity={0.85}
            >
              {isPending ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.submitText}>リポスト</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: Colors.card,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    paddingBottom: Platform.OS === 'ios' ? 36 : 20,
  },
  handle: {
    width: 40,
    height: 4,
    backgroundColor: Colors.borderLight,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 16,
  },
  title: {
    color: Colors.foreground,
    fontSize: 17,
    fontWeight: '700',
    marginBottom: 16,
    textAlign: 'center',
  },
  // Work preview
  workPreview: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.background,
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
    gap: 12,
  },
  coverThumb: {
    width: 52,
    height: 72,
    borderRadius: 6,
  },
  coverPlaceholder: {
    backgroundColor: Colors.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  coverPlaceholderText: { fontSize: 24 },
  mangaTitle: {
    flex: 1,
    color: Colors.foreground,
    fontSize: 14,
    fontWeight: '600',
  },
  // Page preview
  pagePreview: {
    alignItems: 'center',
    marginBottom: 16,
    gap: 6,
  },
  pageThumb: {
    width: 120,
    height: 160,
    borderRadius: 8,
  },
  pageLabel: {
    color: Colors.muted,
    fontSize: 12,
  },
  // Input
  input: {
    backgroundColor: Colors.background,
    borderRadius: 10,
    padding: 12,
    color: Colors.foreground,
    fontSize: 14,
    minHeight: 80,
    textAlignVertical: 'top',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  charCount: {
    color: Colors.muted,
    fontSize: 12,
    textAlign: 'right',
    marginTop: 4,
    marginBottom: 12,
  },
  // Checkbox
  checkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 20,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: Colors.borderLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxChecked: {
    backgroundColor: PINK,
    borderColor: PINK,
  },
  checkmark: { color: '#fff', fontSize: 13, fontWeight: '700' },
  checkLabel: { color: Colors.foreground, fontSize: 14 },
  // Buttons
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    alignItems: 'center',
  },
  cancelText: { color: Colors.muted, fontSize: 15, fontWeight: '600' },
  submitBtn: {
    flex: 2,
    paddingVertical: 13,
    borderRadius: 12,
    backgroundColor: PINK,
    alignItems: 'center',
  },
  submitBtnDisabled: { opacity: 0.5 },
  submitText: { color: '#fff', fontSize: 15, fontWeight: '700' },
});
