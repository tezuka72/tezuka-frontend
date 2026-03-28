import { useState } from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  Platform,
} from 'react-native';
import { Colors } from '../../theme/colors';

const PINK = '#E94B7A';
const CYAN = '#4DD4E8';

export interface RepostItem {
  id: string;
  repost_type: 'work' | 'page';
  actor: { id: string; name: string; avatar_url: string };
  manga: { id: string; title: string; cover_url: string };
  page?: { id: string; image_url: string; page_number: number };
  comment: string | null;
  is_spoiler: boolean;
  spoiler_auto: boolean;
  viewer_read_status: boolean;
  emotion_tags: string[];
  created_at: string;
}

interface Props {
  repost: RepostItem;
  onReadPress?: (mangaId: string) => void;
}

export default function RepostCard({ repost, onReadPress }: Props) {
  const { actor, manga, page, repost_type, comment, is_spoiler, spoiler_auto, viewer_read_status } = repost;
  const showSpoilerWarning = (is_spoiler || spoiler_auto) && !viewer_read_status;
  const [spoilerRevealed, setSpoilerRevealed] = useState(false);

  return (
    <View style={styles.card}>
      {/* ヘッダー: アバター + 「〇〇さんがリポストしました」 */}
      <View style={styles.header}>
        <View style={styles.avatar}>
          {actor.avatar_url ? (
            <Image source={{ uri: actor.avatar_url }} style={styles.avatarImg} />
          ) : (
            <Text style={styles.avatarText}>{actor.name?.[0]?.toUpperCase() || '?'}</Text>
          )}
        </View>
        <Text style={styles.headerText}>
          <Text style={styles.actorName}>{actor.name}</Text>
          <Text style={styles.headerSuffix}>さんがリポストしました</Text>
        </Text>
        <Text style={styles.repostIcon}>↩️</Text>
      </View>

      {/* コンテンツ */}
      {repost_type === 'work' ? (
        /* 作品カード */
        <View style={styles.workCard}>
          {manga.cover_url ? (
            <Image source={{ uri: manga.cover_url }} style={styles.workCover} resizeMode="cover" />
          ) : (
            <View style={[styles.workCover, styles.coverPlaceholder]}>
              <Text style={styles.coverPlaceholderText}>📚</Text>
            </View>
          )}
          <View style={styles.workInfo}>
            <Text style={styles.workTitle} numberOfLines={2}>{manga.title}</Text>
            <TouchableOpacity
              style={styles.readBtn}
              onPress={() => onReadPress?.(manga.id)}
              activeOpacity={0.85}
            >
              <Text style={styles.readBtnText}>読んでみる →</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : page ? (
        /* ページサムネイル */
        <TouchableOpacity
          activeOpacity={showSpoilerWarning && !spoilerRevealed ? 0.9 : 1}
          onPress={() => {
            if (showSpoilerWarning && !spoilerRevealed) setSpoilerRevealed(true);
          }}
        >
          <View style={styles.pageWrapper}>
            <Image
              source={{ uri: page.image_url }}
              style={[
                styles.pageImage,
                showSpoilerWarning && !spoilerRevealed && styles.pageImageBlurred,
              ]}
              resizeMode="cover"
              blurRadius={showSpoilerWarning && !spoilerRevealed ? 20 : 0}
            />
            {showSpoilerWarning && !spoilerRevealed && (
              <View style={styles.spoilerOverlay}>
                <Text style={styles.spoilerIcon}>⚠</Text>
                <Text style={styles.spoilerTitle}>ネタバレあり</Text>
                <Text style={styles.spoilerHint}>タップして表示</Text>
              </View>
            )}
            <View style={styles.pageNumBadge}>
              <Text style={styles.pageNumText}>p.{page.page_number}</Text>
            </View>
          </View>
        </TouchableOpacity>
      ) : null}

      {/* コメント */}
      {comment ? (
        <Text style={styles.comment}>{comment}</Text>
      ) : null}

      {/* 読むボタン（作品への誘導） */}
      <TouchableOpacity
        style={styles.footerReadBtn}
        onPress={() => onReadPress?.(manga.id)}
        activeOpacity={0.8}
      >
        <Text style={styles.footerReadText}>📖 読む</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.card,
    borderRadius: 16,
    marginHorizontal: 12,
    marginVertical: 6,
    padding: 14,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  avatarImg: { width: 32, height: 32, borderRadius: 16 },
  avatarText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  headerText: { flex: 1, fontSize: 13 },
  actorName: { color: Colors.foreground, fontWeight: '700' },
  headerSuffix: { color: Colors.muted },
  repostIcon: { fontSize: 16 },
  // Work card
  workCard: {
    flexDirection: 'row',
    backgroundColor: Colors.background,
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 10,
  },
  workCover: { width: 72, height: 100 },
  coverPlaceholder: {
    backgroundColor: Colors.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  coverPlaceholderText: { fontSize: 28 },
  workInfo: {
    flex: 1,
    padding: 12,
    justifyContent: 'space-between',
  },
  workTitle: {
    color: Colors.foreground,
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 20,
  },
  readBtn: {
    alignSelf: 'flex-start',
    backgroundColor: PINK,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  readBtnText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  // Page image
  pageWrapper: {
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 10,
    position: 'relative',
  },
  pageImage: {
    width: '100%',
    height: 240,
  },
  pageImageBlurred: {
    opacity: Platform.OS === 'web' ? 1 : 0.15,
  },
  spoilerOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(6,9,15,0.75)',
    gap: 6,
  },
  spoilerIcon: { fontSize: 28 },
  spoilerTitle: { color: Colors.foreground, fontSize: 15, fontWeight: '700' },
  spoilerHint: { color: Colors.muted, fontSize: 12 },
  pageNumBadge: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  pageNumText: { color: '#fff', fontSize: 11 },
  // Comment
  comment: {
    color: Colors.foreground,
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 10,
  },
  // Footer read button
  footerReadBtn: {
    alignSelf: 'flex-start',
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: CYAN,
  },
  footerReadText: { color: CYAN, fontSize: 13, fontWeight: '600' },
});
