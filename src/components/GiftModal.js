import { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, Modal, StyleSheet, Alert } from 'react-native';
import { useStripe } from '../utils/stripe';
import { giftAPI } from '../api/client';
import { useLanguage } from '../context/LanguageContext';

export default function GiftModal({ visible, onClose, receiverId, postId }) {
  const stripe = useStripe();
  const { t } = useLanguage();
  const [packages, setPackages] = useState([]);
  const [selectedAmount, setSelectedAmount] = useState(null);
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
      // Payment Intent作成
      const { clientSecret, creator_receives } =
        await giftAPI.createPaymentIntent(selectedAmount, receiverId, postId);

      // Stripe決済画面表示
      const { error, paymentIntent } = await stripe.confirmPayment(clientSecret, {
        paymentMethodType: 'Card',
      });

      if (error) {
        Alert.alert(t('common.error'), error.message);
      } else if (paymentIntent) {
        Alert.alert(
          t('common.success'),
          `¥${selectedAmount}${t('gift.successMessage')}${creator_receives}${t('gift.successSuffix')}`
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
                onPress={() => setSelectedAmount(pkg.amount)}
              >
                <Text style={styles.emoji}>{pkg.emoji}</Text>
                <Text style={styles.packageName}>{pkg.name}</Text>
                <Text style={styles.packageAmount}>¥{pkg.amount}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <View style={styles.info}>
            <Text style={styles.infoText}>
              {t('gift.creatorReceives')}{selectedAmount ? Math.floor(selectedAmount * 0.6) : 0}{t('gift.creatorReceivesSuffix')}
            </Text>
            <Text style={styles.feeText}>{t('gift.fee')}</Text>
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
