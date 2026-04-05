import { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, Modal, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import { useStripe } from '../utils/stripe';
import { giftAPI } from '../api/client';
import { useLanguage } from '../context/LanguageContext';

export default function GiftModal({ visible, onClose, receiverId, postId }) {
  const { initPaymentSheet, presentPaymentSheet } = useStripe();
  const { t } = useLanguage();
  const [packages, setPackages] = useState([]);
  const [selectedAmount, setSelectedAmount] = useState(null);
  const [selectedPackageId, setSelectedPackageId] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    loadPackages();
  }, []);

  const loadPackages = async () => {
    try {
      const response = await giftAPI.getPackages();
      setPackages(response.packages);
    } catch (error) {
      console.error('Load packages error:', error);
    }
  };

  const handleGift = async () => {
    if (!selectedAmount) {
      Alert.alert(t('common.error'), t('gift.errorSelect'));
      return;
    }

    setIsProcessing(true);
    try {
      // Payment Intent作成（Customer・EphemeralKeyも返ってくる）
      const { clientSecret, payment_intent_id, ephemeralKeySecret, customerId } =
        await giftAPI.createPaymentIntent(selectedAmount, receiverId, postId);

      // PaymentSheetを初期化（保存済みカードの表示・新規カード保存が可能）
      const { error: initError } = await initPaymentSheet({
        paymentIntentClientSecret: clientSecret,
        customerEphemeralKeySecret: ephemeralKeySecret,
        customerId,
        merchantDisplayName: 'LORE MANGA',
        allowsDelayedPaymentMethods: false,
      });

      if (initError) {
        Alert.alert(t('common.error'), initError.message);
        return;
      }

      // PaymentSheetを表示してユーザーが決済
      const { error: payError } = await presentPaymentSheet();

      if (payError) {
        // キャンセルは無視、その他はエラー表示
        if (payError.code !== 'Canceled') {
          Alert.alert(t('common.error'), payError.message);
        }
      } else {
        // 決済成功 → バックエンドにDB記録を依頼
        // payment_intent_idはclientSecretから取り出せる（"pi_xxx_secret_yyy" の先頭部分）
        const piId = payment_intent_id || clientSecret.split('_secret_')[0];
        try {
          await giftAPI.sendGift(piId, receiverId, postId, selectedAmount);
        } catch (recordError) {
          // 記録失敗はWebhookで補完されるためユーザーには通知しない
          console.error('Gift record error (webhook will handle):', recordError);
        }
        const creatorReceives = Math.ceil(selectedAmount * 0.6);
        Alert.alert(
          t('common.success'),
          `${selectedAmount}pt${t('gift.successMessage')}${creatorReceives}pt${t('gift.successSuffix')}`
        );
        onClose();
      }
    } catch (error) {
      Alert.alert(t('common.error'), t('gift.paymentError'));
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.overlay}>
        <View style={styles.modal}>
          <Text style={styles.title}>{t('gift.title')}</Text>
          
          <View style={styles.packages}>
            {packages.map((pkg) => (
              <TouchableOpacity
                key={pkg.id}
                style={[
                  styles.package,
                  selectedAmount === pkg.amount && styles.packageSelected,
                ]}
                onPress={() => { setSelectedAmount(pkg.amount); setSelectedPackageId(pkg.id); }}
              >
                <Text style={styles.emoji}>{pkg.emoji}</Text>
                <Text style={styles.packageName}>{pkg.name}</Text>
                <Text style={styles.packageAmount}>{pkg.amount}pt</Text>
              </TouchableOpacity>
            ))}
          </View>


          <View style={styles.actions}>
            <TouchableOpacity
              style={[styles.button, styles.cancelButton]}
              onPress={onClose}
            >
              <Text>{t('gift.cancel')}</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[styles.button, styles.sendButton, isProcessing && styles.buttonDisabled]}
              onPress={handleGift}
              disabled={isProcessing || !selectedAmount}
            >
              <Text style={styles.sendButtonText}>
                {isProcessing ? t('gift.processing') : t('gift.send')}
              </Text>
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
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modal: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 20,
  },
  packages: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-around',
    marginBottom: 20,
  },
  package: {
    width: '30%',
    aspectRatio: 1,
    borderWidth: 2,
    borderColor: '#e0e0e0',
    borderRadius: 12,
    padding: 12,
    margin: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  packageSelected: {
    borderColor: '#000',
    backgroundColor: '#f5f5f5',
  },
  emoji: {
    fontSize: 32,
    marginBottom: 8,
  },
  packageName: {
    fontSize: 12,
    marginBottom: 4,
  },
  packageAmount: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  info: {
    backgroundColor: '#f5f5f5',
    padding: 12,
    borderRadius: 8,
    marginBottom: 20,
    alignItems: 'center',
  },
  infoText: {
    fontSize: 14,
    marginBottom: 4,
  },
  feeText: {
    fontSize: 12,
    color: '#666',
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
  },
  button: {
    flex: 1,
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: '#f5f5f5',
  },
  sendButton: {
    backgroundColor: '#000',
  },
  sendButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
});
