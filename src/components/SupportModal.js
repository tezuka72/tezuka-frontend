import { useState, useEffect } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { energyAPI } from '../api/client';
import ContributionReceipt from './ContributionReceipt';
import { Colors } from '../theme/colors';

// 応援タイプ定義（¥/$ は一切表示しない。ENのみ）
const SUPPORT_TYPES = [
  {
    key: 'boost',
    label: 'Boost',
    desc: '軽く応援する',
    icon: '⚡',
    en: 10,
  },
  {
    key: 'backstage',
    label: 'Backstage',
    desc: '制作を支える',
    icon: '🎨',
    en: 50,
  },
  {
    key: 'participate',
    label: 'Participate',
    desc: '深く関わる',
    icon: '🌟',
    en: 100,
  },
  {
    key: 'message',
    label: 'Message',
    desc: 'メッセージを送る',
    icon: '💌',
    en: 30,
  },
];

export default function SupportModal({ visible, onClose, seriesId, episodeId = null }) {
  const [balance, setBalance] = useState(null);
  const [selectedKey, setSelectedKey] = useState(null);
  const [message, setMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [receipt, setReceipt] = useState({ visible: false, type: null });

  useEffect(() => {
    if (visible) {
      setSelectedKey(null);
      setMessage('');
      loadBalance();
    }
  }, [visible]);

  const loadBalance = async () => {
    try {
      const res = await energyAPI.getBalance();
      setBalance(res.balance ?? 0);
    } catch (e) {
      console.error('Balance load error:', e);
    }
  };

  const handleSend = async () => {
    if (!selectedKey) return;
    const type = SUPPORT_TYPES.find(t => t.key === selectedKey);
    if (balance !== null && balance < type.en) {
      Alert.alert('ENが不足しています', 'ENを購入して応援しましょう。');
      return;
    }
    setIsSending(true);
    try {
      await energyAPI.sendSupport(
        seriesId,
        episodeId,
        selectedKey,
        type.en,
        selectedKey === 'message' ? message.trim() || null : null
      );
      onClose();
      setReceipt({ visible: true, type: selectedKey });
    } catch (e) {
      Alert.alert('エラー', '応援の送信に失敗しました');
    } finally {
      setIsSending(false);
    }
  };

  return (
    <>
      <Modal visible={visible} animationType="slide" transparent>
        <View style={styles.overlay}>
          <View style={styles.sheet}>
            <View style={styles.handle} />

            <Text style={styles.title}>応援する</Text>

            {/* EN残高 */}
            {balance !== null && (
              <View style={styles.balanceRow}>
                <Text style={styles.balanceLabel}>残高</Text>
                <Text style={styles.balanceValue}>{balance} EN</Text>
              </View>
            )}

            {/* 応援タイプ選択 */}
            <View style={styles.typeGrid}>
              {SUPPORT_TYPES.map(type => (
                <TouchableOpacity
                  key={type.key}
                  style={[
                    styles.typeCard,
                    selectedKey === type.key && styles.typeCardSelected,
                  ]}
                  onPress={() => setSelectedKey(type.key)}
                  activeOpacity={0.8}
                >
                  <Text style={styles.typeIcon}>{type.icon}</Text>
                  <Text style={[
                    styles.typeLabel,
                    selectedKey === type.key && styles.typeLabelSelected,
                  ]}>
                    {type.label}
                  </Text>
                  <Text style={styles.typeDesc}>{type.desc}</Text>
                  <Text style={styles.typeEN}>{type.en} EN</Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Message入力欄（Messageタイプ選択時のみ） */}
            {selectedKey === 'message' && (
              <TextInput
                style={styles.messageInput}
                placeholder="メッセージを入力..."
                placeholderTextColor={Colors.muted}
                value={message}
                onChangeText={setMessage}
                multiline
                maxLength={200}
              />
            )}

            {/* アクションボタン */}
            <View style={styles.actions}>
              <TouchableOpacity style={styles.cancelBtn} onPress={onClose}>
                <Text style={styles.cancelText}>キャンセル</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.sendBtn, (!selectedKey || isSending) && styles.sendBtnDisabled]}
                onPress={handleSend}
                disabled={!selectedKey || isSending}
              >
                {isSending
                  ? <ActivityIndicator color="#fff" size="small" />
                  : <Text style={styles.sendText}>応援する</Text>
                }
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* 応援後の即時フィードバック（数値なし） */}
      <ContributionReceipt
        visible={receipt.visible}
        type={receipt.type}
        onDismiss={() => setReceipt({ visible: false, type: null })}
      />
    </>
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
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    paddingBottom: 40,
    borderTopWidth: 1,
    borderColor: Colors.border,
  },
  handle: {
    width: 40,
    height: 4,
    backgroundColor: Colors.border,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.foreground,
    textAlign: 'center',
    marginBottom: 16,
  },
  balanceRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    marginBottom: 20,
    backgroundColor: 'rgba(37,99,235,0.10)',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 24,
  },
  balanceLabel: {
    fontSize: 13,
    color: Colors.muted,
  },
  balanceValue: {
    fontSize: 17,
    fontWeight: '700',
    color: Colors.primary,
  },
  typeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 16,
    justifyContent: 'space-between',
  },
  typeCard: {
    width: '47.5%',
    backgroundColor: Colors.background,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1.5,
    borderColor: Colors.border,
    alignItems: 'center',
  },
  typeCardSelected: {
    borderColor: Colors.primary,
    backgroundColor: 'rgba(37,99,235,0.08)',
  },
  typeIcon: {
    fontSize: 28,
    marginBottom: 6,
  },
  typeLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.foreground,
    marginBottom: 3,
  },
  typeLabelSelected: {
    color: Colors.primary,
  },
  typeDesc: {
    fontSize: 11,
    color: Colors.muted,
    textAlign: 'center',
    marginBottom: 6,
  },
  typeEN: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.accent,
  },
  messageInput: {
    backgroundColor: Colors.background,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 12,
    color: Colors.foreground,
    fontSize: 14,
    minHeight: 80,
    textAlignVertical: 'top',
    marginBottom: 16,
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  cancelText: {
    color: Colors.muted,
    fontWeight: '600',
    fontSize: 15,
  },
  sendBtn: {
    flex: 2,
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
    backgroundColor: Colors.primary,
  },
  sendBtnDisabled: {
    opacity: 0.4,
  },
  sendText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 15,
  },
});
