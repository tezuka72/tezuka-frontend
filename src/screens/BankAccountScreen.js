import React, { useState, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, ActivityIndicator, Alert, KeyboardAvoidingView, Platform
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { payoutAPI } from '../api/client';
import { useLanguage } from '../context/LanguageContext';

const ACCOUNT_TYPES = ['普通', '当座'];

export default function BankAccountScreen({ navigation }) {
  const { t } = useLanguage();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    bank_name: '',
    branch_name: '',
    account_type: '普通',
    account_number: '',
    account_holder: '',
  });

  useEffect(() => {
    loadBankAccount();
  }, []);

  const loadBankAccount = async () => {
    try {
      const data = await payoutAPI.getBankAccount();
      if (data.bank_account) {
        const ba = data.bank_account;
        setForm({
          bank_name: ba.bank_name,
          branch_name: ba.branch_name,
          account_type: ba.account_type,
          account_number: ba.account_number,
          account_holder: ba.account_holder,
        });
      }
    } catch (e) {
      console.error('Load bank account error:', e);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    const { bank_name, branch_name, account_type, account_number, account_holder } = form;

    if (!bank_name.trim()) {
      Alert.alert(t('common.error'), t('bank.errorBankName'));
      return;
    }
    if (!branch_name.trim()) {
      Alert.alert(t('common.error'), t('bank.errorBranchName'));
      return;
    }
    if (!account_number.trim()) {
      Alert.alert(t('common.error'), t('bank.errorAccountNumber'));
      return;
    }
    if (!account_holder.trim()) {
      Alert.alert(t('common.error'), t('bank.errorAccountHolder'));
      return;
    }

    setSaving(true);
    try {
      await payoutAPI.saveBankAccount({
        bank_name: bank_name.trim(),
        branch_name: branch_name.trim(),
        account_type,
        account_number: account_number.trim(),
        account_holder: account_holder.trim(),
      });
      Alert.alert(t('common.success'), t('bank.saveSuccess'), [
        { text: 'OK', onPress: () => navigation.goBack() }
      ]);
    } catch (e) {
      console.error('Save bank account error:', e);
      Alert.alert(t('common.error'), t('bank.saveError'));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#2563EB" />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView style={styles.container} contentContainerStyle={styles.content}>
          {/* ヘッダー */}
          <View style={styles.headerRow}>
            <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
              <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>{t('bank.title')}</Text>
            <View style={{ width: 40 }} />
          </View>

          <Text style={styles.note}>{t('bank.note')}</Text>

          {/* 銀行名 */}
          <Text style={styles.label}>{t('bank.bankName')}<Text style={styles.required}> *</Text></Text>
          <TextInput
            style={styles.input}
            value={form.bank_name}
            onChangeText={(v) => setForm({ ...form, bank_name: v })}
            placeholder={t('bank.bankNamePlaceholder')}
            placeholderTextColor="#555"
          />

          {/* 支店名 */}
          <Text style={styles.label}>{t('bank.branchName')}<Text style={styles.required}> *</Text></Text>
          <TextInput
            style={styles.input}
            value={form.branch_name}
            onChangeText={(v) => setForm({ ...form, branch_name: v })}
            placeholder={t('bank.branchNamePlaceholder')}
            placeholderTextColor="#555"
          />

          {/* 口座種別 */}
          <Text style={styles.label}>{t('bank.accountType')}<Text style={styles.required}> *</Text></Text>
          <View style={styles.typeRow}>
            {ACCOUNT_TYPES.map((type) => (
              <TouchableOpacity
                key={type}
                style={[styles.typeBtn, form.account_type === type && styles.typeBtnActive]}
                onPress={() => setForm({ ...form, account_type: type })}
              >
                <Text style={[styles.typeBtnText, form.account_type === type && styles.typeBtnTextActive]}>
                  {type}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* 口座番号 */}
          <Text style={styles.label}>{t('bank.accountNumber')}<Text style={styles.required}> *</Text></Text>
          <TextInput
            style={styles.input}
            value={form.account_number}
            onChangeText={(v) => setForm({ ...form, account_number: v })}
            placeholder={t('bank.accountNumberPlaceholder')}
            placeholderTextColor="#555"
            keyboardType="numeric"
            maxLength={20}
          />

          {/* 口座名義（カタカナ） */}
          <Text style={styles.label}>{t('bank.accountHolder')}<Text style={styles.required}> *</Text></Text>
          <TextInput
            style={styles.input}
            value={form.account_holder}
            onChangeText={(v) => setForm({ ...form, account_holder: v })}
            placeholder={t('bank.accountHolderPlaceholder')}
            placeholderTextColor="#555"
            maxLength={100}
          />

          <Text style={styles.holderHint}>{t('bank.accountHolderHint')}</Text>

          {/* 保存ボタン */}
          <TouchableOpacity
            style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
            onPress={handleSave}
            disabled={saving}
          >
            {saving
              ? <ActivityIndicator color="#000" />
              : <Text style={styles.saveBtnText}>{t('bank.save')}</Text>
            }
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
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
  note: {
    fontSize: 13,
    color: '#888',
    marginBottom: 24,
    lineHeight: 20,
    backgroundColor: '#111827',
    padding: 12,
    borderRadius: 8,
    borderLeftWidth: 3,
    borderLeftColor: '#2563EB',
  },
  label: { fontSize: 13, color: '#AAA', marginBottom: 6, marginTop: 16 },
  required: { color: '#EF4444' },
  input: {
    backgroundColor: '#111827',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#1F2937',
    color: '#FFFFFF',
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
  },
  typeRow: { flexDirection: 'row', gap: 12 },
  typeBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#1F2937',
    backgroundColor: '#111827',
    alignItems: 'center',
  },
  typeBtnActive: {
    borderColor: '#2563EB',
    backgroundColor: '#1D3461',
  },
  typeBtnText: { color: '#888', fontSize: 15 },
  typeBtnTextActive: { color: '#FFFFFF', fontWeight: '600' },
  holderHint: { fontSize: 11, color: '#555', marginTop: 6 },
  saveBtn: {
    marginTop: 32,
    backgroundColor: '#F5C00A',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  saveBtnDisabled: { opacity: 0.6 },
  saveBtnText: { fontSize: 16, fontWeight: '700', color: '#000' },
});
