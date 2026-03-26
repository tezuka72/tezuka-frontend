import { useState, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../context/AuthContext';
import { authAPI } from '../api/client';
import { Colors } from '../theme/colors';
import { Shadows } from '../theme/styles';

export default function EmailVerificationScreen({ route, navigation }) {
  const insets = useSafeAreaInsets();
  const { verifyEmail } = useAuth();
  const email = route?.params?.email || '';

  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState('');
  const [resendMessage, setResendMessage] = useState('');

  const handleVerify = async () => {
    if (code.length !== 6) {
      setError('6桁のコードを入力してください');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const result = await verifyEmail(email, code);
      if (!result.success) {
        setError(result.error || 'コードが無効または期限切れです');
      }
      // 成功時は AuthContext が user をセットし、自動的にメイン画面へ遷移
    } catch {
      setError('メール確認に失敗しました');
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    setResending(true);
    setError('');
    setResendMessage('');
    try {
      await authAPI.resendVerification(email);
      setResendMessage('確認コードを再送信しました');
    } catch {
      setError('再送信に失敗しました');
    } finally {
      setResending(false);
    }
  };

  return (
    <LinearGradient
      colors={['#FFD60A', '#FFFFFF', '#29B6F6']}
      locations={[0, 0.45, 1]}
      style={[styles.gradient, { paddingTop: insets.top }]}
    >
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView contentContainerStyle={styles.content}>
          <Text style={styles.icon}>📧</Text>
          <Text style={styles.title}>メールを確認してください</Text>
          <Text style={styles.subtitle}>
            <Text style={styles.emailText}>{email}</Text>
            {'\n'}に送信した6桁のコードを入力してください
          </Text>

          <TextInput
            style={styles.input}
            placeholder="6桁のコード"
            placeholderTextColor={Colors.muted}
            value={code}
            onChangeText={(v) => { setCode(v); setError(''); }}
            keyboardType="number-pad"
            maxLength={6}
            textAlign="center"
          />

          {error ? <Text style={styles.error}>{error}</Text> : null}
          {resendMessage ? <Text style={styles.success}>{resendMessage}</Text> : null}

          <TouchableOpacity
            style={[styles.button, (loading || code.length !== 6) && styles.buttonDisabled]}
            onPress={handleVerify}
            disabled={loading || code.length !== 6}
          >
            {loading
              ? <ActivityIndicator color="#fff" />
              : <Text style={styles.buttonText}>確認する</Text>}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.resendButton}
            onPress={handleResend}
            disabled={resending}
          >
            {resending
              ? <ActivityIndicator color={Colors.primary} size="small" />
              : <Text style={styles.resendText}>コードを再送信する</Text>}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation?.navigate('Register')}
          >
            <Text style={styles.backText}>← 登録画面に戻る</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  gradient: { flex: 1 },
  container: { flex: 1 },
  content: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 24,
    alignItems: 'center',
  },
  icon: {
    fontSize: 64,
    marginBottom: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1A1A2E',
    marginBottom: 12,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    color: '#555566',
    marginBottom: 32,
    textAlign: 'center',
    lineHeight: 22,
  },
  emailText: {
    color: Colors.primary,
    fontWeight: '600',
  },
  input: {
    backgroundColor: 'rgba(255,255,255,0.7)',
    borderRadius: 16,
    paddingHorizontal: 20,
    paddingVertical: 16,
    fontSize: 28,
    fontWeight: 'bold',
    color: '#1A1A2E',
    borderWidth: 1,
    borderColor: 'rgba(37,99,235,0.2)',
    width: '100%',
    letterSpacing: 12,
    marginBottom: 16,
  },
  error: {
    color: Colors.error,
    fontSize: 14,
    marginBottom: 12,
    textAlign: 'center',
  },
  success: {
    color: '#16a34a',
    fontSize: 14,
    marginBottom: 12,
    textAlign: 'center',
  },
  button: {
    backgroundColor: Colors.primary,
    borderRadius: 24,
    paddingVertical: 16,
    alignItems: 'center',
    width: '100%',
    marginTop: 4,
    ...Shadows.glow,
  },
  buttonDisabled: { opacity: 0.5 },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  resendButton: {
    marginTop: 24,
    padding: 8,
  },
  resendText: {
    color: Colors.primary,
    fontSize: 14,
    fontWeight: '600',
  },
  backButton: {
    marginTop: 12,
    padding: 8,
  },
  backText: {
    color: '#888',
    fontSize: 14,
  },
});
