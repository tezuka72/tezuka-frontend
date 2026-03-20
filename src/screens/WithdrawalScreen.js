import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, ActivityIndicator, Alert, RefreshControl
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { payoutAPI } from '../api/client';
import { useLanguage } from '../context/LanguageContext';

const STATUS_COLORS = {
  pending:    '#F5C00A',
  processing: '#2563EB',
  paid:       '#10B981',
  rejected:   '#EF4444',
};

const STATUS_LABELS_JA = {
  pending:    '申請中',
  processing: '処理中',
  paid:       '振込完了',
  rejected:   '却下',
};

export default function WithdrawalScreen({ navigation }) {
  const { t } = useLanguage();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [balance, setBalance] = useState(null);
  const [bankAccount, setBankAccount] = useState(null);
  const [history, setHistory] = useState([]);
  const [amount, setAmount] = useState('');

  const loadData = async () => {
    try {
      const [balData, bankData, histData] = await Promise.all([
        payoutAPI.getBalance(),
        payoutAPI.getBankAccount(),
        payoutAPI.getHistory(),
      ]);
      setBalance(balData);
      setBankAccount(bankData.bank_account);
      setHistory(histData.history);
    } catch (e) {
      console.error('Load withdrawal data error:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(useCallback(() => { loadData(); }, []));

  const handleRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const handleWithdraw = async () => {
    const amtNum = parseInt(amount);
    if (!amtNum || amtNum < 1000) {
      Alert.alert(t('common.error'), t('withdrawal.errorMinAmount'));
      return;
    }
    if (!bankAccount) {
      Alert.alert(t('common.error'), t('withdrawal.errorNoBankAccount'));
      return;
    }
    if (balance && amtNum > balance.available_balance) {
      Alert.alert(t('common.error'), t('withdrawal.errorInsufficientBalance'));
      return;
    }

    Alert.alert(
      t('withdrawal.confirmTitle'),
      t('withdrawal.confirmMessage', { amount: amtNum.toLocaleString() }),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('withdrawal.submit'),
          onPress: async () => {
            setSubmitting(true);
            try {
              await payoutAPI.requestWithdrawal(amtNum);
              setAmount('');
              Alert.alert(t('common.success'), t('withdrawal.submitSuccess'));
              loadData();
            } catch (e) {
              const msg = e?.response?.data?.error || t('withdrawal.submitError');
              Alert.alert(t('common.error'), msg);
            } finally {
              setSubmitting(false);
            }
          }
        }
      ]
    );
  };

  const hasPendingRequest = history.some(
    (r) => r.status === 'pending' || r.status === 'processing'
  );

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#2563EB" />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor="#2563EB" />}
      >
        {/* ヘッダー */}
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{t('withdrawal.title')}</Text>
          <View style={{ width: 40 }} />
        </View>

        {/* 残高カード */}
        <View style={styles.balanceCard}>
          <Text style={styles.balanceLabel}>{t('withdrawal.availableBalance')}</Text>
          <Text style={styles.balanceAmount}>
            ¥{(balance?.available_balance ?? 0).toLocaleString()}
          </Text>
          <View style={styles.balanceDetails}>
            <View style={styles.balanceDetailItem}>
              <Text style={styles.balanceDetailLabel}>{t('withdrawal.totalEarned')}</Text>
              <Text style={styles.balanceDetailValue}>¥{(balance?.total_earned ?? 0).toLocaleString()}</Text>
            </View>
            <View style={styles.balanceDivider} />
            <View style={styles.balanceDetailItem}>
              <Text style={styles.balanceDetailLabel}>{t('withdrawal.totalWithdrawn')}</Text>
              <Text style={styles.balanceDetailValue}>¥{(balance?.total_withdrawn ?? 0).toLocaleString()}</Text>
            </View>
          </View>
        </View>

        {/* 銀行口座情報 */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>{t('withdrawal.bankAccount')}</Text>
            <TouchableOpacity onPress={() => navigation.navigate('BankAccount')}>
              <Text style={styles.editLink}>{bankAccount ? t('withdrawal.edit') : t('withdrawal.register')}</Text>
            </TouchableOpacity>
          </View>
          {bankAccount ? (
            <View style={styles.bankCard}>
              <Text style={styles.bankText}>{bankAccount.bank_name}　{bankAccount.branch_name}</Text>
              <Text style={styles.bankText}>{bankAccount.account_type}　{bankAccount.account_number}</Text>
              <Text style={styles.bankHolder}>{bankAccount.account_holder}</Text>
            </View>
          ) : (
            <TouchableOpacity
              style={styles.registerBankBtn}
              onPress={() => navigation.navigate('BankAccount')}
            >
              <Ionicons name="add-circle-outline" size={20} color="#2563EB" />
              <Text style={styles.registerBankBtnText}>{t('withdrawal.registerBankAccount')}</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* 出金申請フォーム */}
        {bankAccount && !hasPendingRequest && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t('withdrawal.requestTitle')}</Text>
            <Text style={styles.minAmountNote}>{t('withdrawal.minAmountNote')}</Text>
            <View style={styles.amountRow}>
              <Text style={styles.yenSign}>¥</Text>
              <TextInput
                style={styles.amountInput}
                value={amount}
                onChangeText={setAmount}
                placeholder="1000"
                placeholderTextColor="#555"
                keyboardType="numeric"
              />
            </View>
            <TouchableOpacity
              style={[styles.submitBtn, (submitting || !amount) && styles.submitBtnDisabled]}
              onPress={handleWithdraw}
              disabled={submitting || !amount}
            >
              {submitting
                ? <ActivityIndicator color="#000" />
                : <Text style={styles.submitBtnText}>{t('withdrawal.submit')}</Text>
              }
            </TouchableOpacity>
          </View>
        )}

        {hasPendingRequest && (
          <View style={styles.pendingBanner}>
            <Ionicons name="time-outline" size={20} color="#F5C00A" />
            <Text style={styles.pendingBannerText}>{t('withdrawal.pendingNote')}</Text>
          </View>
        )}

        {/* 出金履歴 */}
        {history.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t('withdrawal.history')}</Text>
            {history.map((req) => (
              <View key={req.id} style={styles.historyItem}>
                <View style={styles.historyLeft}>
                  <Text style={styles.historyAmount}>¥{parseInt(req.amount).toLocaleString()}</Text>
                  <Text style={styles.historyDate}>
                    {new Date(req.requested_at).toLocaleDateString('ja-JP')}
                  </Text>
                  {req.admin_note ? (
                    <Text style={styles.historyNote}>{req.admin_note}</Text>
                  ) : null}
                </View>
                <View style={[styles.statusBadge, { backgroundColor: STATUS_COLORS[req.status] + '22' }]}>
                  <Text style={[styles.statusText, { color: STATUS_COLORS[req.status] }]}>
                    {STATUS_LABELS_JA[req.status] || req.status}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#06090F' },
  container: { flex: 1 },
  content: { padding: 20, paddingBottom: 40 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#06090F' },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  backBtn: { width: 40, height: 40, justifyContent: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#FFFFFF' },

  balanceCard: {
    backgroundColor: '#111827',
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#1F2937',
  },
  balanceLabel: { fontSize: 13, color: '#888', marginBottom: 4 },
  balanceAmount: { fontSize: 36, fontWeight: '800', color: '#FFFFFF', marginBottom: 16 },
  balanceDetails: { flexDirection: 'row', alignItems: 'center' },
  balanceDetailItem: { flex: 1, alignItems: 'center' },
  balanceDetailLabel: { fontSize: 11, color: '#666', marginBottom: 2 },
  balanceDetailValue: { fontSize: 14, color: '#AAA', fontWeight: '600' },
  balanceDivider: { width: 1, height: 30, backgroundColor: '#1F2937' },

  section: { marginBottom: 24 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: '#FFFFFF', marginBottom: 12 },
  editLink: { fontSize: 13, color: '#2563EB' },

  bankCard: {
    backgroundColor: '#111827',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#1F2937',
    gap: 4,
  },
  bankText: { fontSize: 14, color: '#CCC' },
  bankHolder: { fontSize: 15, fontWeight: '600', color: '#FFFFFF', marginTop: 4 },
  registerBankBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#111827',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#2563EB',
    borderStyle: 'dashed',
  },
  registerBankBtnText: { fontSize: 14, color: '#2563EB' },

  minAmountNote: { fontSize: 12, color: '#666', marginBottom: 12 },
  amountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#111827',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#1F2937',
    paddingHorizontal: 14,
    marginBottom: 16,
  },
  yenSign: { fontSize: 20, color: '#888', marginRight: 4 },
  amountInput: { flex: 1, fontSize: 24, fontWeight: '600', color: '#FFFFFF', paddingVertical: 12 },

  submitBtn: {
    backgroundColor: '#F5C00A',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  submitBtnDisabled: { opacity: 0.5 },
  submitBtnText: { fontSize: 16, fontWeight: '700', color: '#000' },

  pendingBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#F5C00A18',
    borderRadius: 10,
    padding: 14,
    borderWidth: 1,
    borderColor: '#F5C00A44',
    marginBottom: 24,
  },
  pendingBannerText: { flex: 1, fontSize: 13, color: '#F5C00A', lineHeight: 18 },

  historyItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#111827',
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#1F2937',
  },
  historyLeft: { flex: 1 },
  historyAmount: { fontSize: 16, fontWeight: '700', color: '#FFFFFF' },
  historyDate: { fontSize: 12, color: '#666', marginTop: 2 },
  historyNote: { fontSize: 12, color: '#EF4444', marginTop: 4 },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 20,
  },
  statusText: { fontSize: 12, fontWeight: '600' },
});
