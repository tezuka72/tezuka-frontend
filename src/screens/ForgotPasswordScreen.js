import { useState } from 'react';
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
import { authAPI } from '../api/client';
import { Colors } from '../theme/colors';
import { Shadows } from '../theme/styles';

export default function ForgotPasswordScreen({ navigation }) {
  const [step, setStep] = useState(1); // 1: メール入力, 2: コード+新パスワード
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleSendCode = async () => {
    if (!email.trim()) {
      setError('メールアドレスを入力してください');
      return;
    }
    setLoading(true);
    setError('');
    try {
      await authAPI.forgotPassword(email.trim());
      setStep(2);
    } catch (e) {
      setError(e.response?.data?.error || 'メール送信に失敗しました');
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async () => {
    if (code.length !== 6) {
      setError('6桁のコードを入力してください');
      return;
    }
    if (newPassword.length < 8) {
      setError('パスワードは8文字以上で入力してください');
      return;
    }
    if (!/[A-Z]/.test(newPassword) || !/[a-z]/.test(newPassword) || !/\d/.test(newPassword)) {
      setError('パスワードは大文字・小文字・数字をそれぞれ含めてください');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('パスワードが一致しません');
      return;
    }
    setLoading(true);
    setError('');
    try {
      await authAPI.resetPassword(email.trim(), code.trim(), newPassword);
      setSuccess(true);
    } catch (e) {
      setError(e.response?.data?.error || 'パスワードのリセットに失敗しました');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <LinearGradient colors={['#FFD60A', '#FFFFFF', '#29B6F6']} locations={[0, 0.45, 1]} style={styles.gradient}>
        <View style={styles.successContainer}>
          <Text style={styles.successIcon}>✅</Text>
          <Text style={styles.successTitle}>パスワードを更新しました</Text>
          <Text style={styles.successSubtitle}>新しいパスワードでログインしてください</Text>
          <TouchableOpacity style={styles.button} onPress={() => navigation?.navigate('Login')}>
            <Text style={styles.buttonText}>ログイン画面へ</Text>
          </TouchableOpacity>
        </View>
      </LinearGradient>
    );
  }

  return (
    <LinearGradient colors={['#FFD60A', '#FFFFFF', '#29B6F6']} locations={[0, 0.45, 1]} style={styles.gradient}>
      <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView contentContainerStyle={styles.content}>
          <TouchableOpacity style={styles.backButton} onPress={() => navigation?.goBack()}>
            <Text style={styles.backButtonText}>← 戻る</Text>
          </TouchableOpacity>

          <Text style={styles.title}>パスワードを忘れた方</Text>

          {step === 1 ? (
            <>
              <Text style={styles.subtitle}>
                登録したメールアドレスに6桁のリセットコードをお送りします
              </Text>
              <TextInput
                style={styles.input}
                placeholder="メールアドレス"
                placeholderTextColor={Colors.muted}
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
              />
              {error ? <Text style={styles.error}>{error}</Text> : null}
              <TouchableOpacity
                style={[styles.button, loading && styles.buttonDisabled]}
                onPress={handleSendCode}
                disabled={loading}
              >
                {loading
                  ? <ActivityIndicator color="#fff" />
                  : <Text style={styles.buttonText}>コードを送信</Text>
                }
              </TouchableOpacity>
            </>
          ) : (
            <>
              <Text style={styles.subtitle}>
                <Text style={styles.emailHighlight}>{email}</Text>{'\n'}
                に送信された6桁のコードと新しいパスワードを入力してください
              </Text>
              <TextInput
                style={styles.input}
                placeholder="6桁のコード"
                placeholderTextColor={Colors.muted}
                value={code}
                onChangeText={setCode}
                keyboardType="number-pad"
                maxLength={6}
              />
              <TextInput
                style={styles.input}
                placeholder="新しいパスワード（8文字以上、大小文字+数字）"
                placeholderTextColor={Colors.muted}
                value={newPassword}
                onChangeText={setNewPassword}
                secureTextEntry
              />
              <TextInput
                style={styles.input}
                placeholder="パスワード（確認）"
                placeholderTextColor={Colors.muted}
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secureTextEntry
              />
              {error ? <Text style={styles.error}>{error}</Text> : null}
              <TouchableOpacity
                style={[styles.button, loading && styles.buttonDisabled]}
                onPress={handleResetPassword}
                disabled={loading}
              >
                {loading
                  ? <ActivityIndicator color="#fff" />
                  : <Text style={styles.buttonText}>パスワードを変更</Text>
                }
              </TouchableOpacity>
              <TouchableOpacity style={styles.resendButton} onPress={() => { setStep(1); setError(''); }}>
                <Text style={styles.resendText}>コードを再送信する</Text>
              </TouchableOpacity>
            </>
          )}
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
    padding: 24,
    paddingTop: 60,
  },
  backButton: { marginBottom: 24 },
  backButtonText: {
    color: '#1A1A2E',
    fontSize: 16,
    fontWeight: '600',
  },
  title: {
    fontSize: 26,
    fontWeight: 'bold',
    color: '#1A1A2E',
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 14,
    color: '#555566',
    marginBottom: 28,
    lineHeight: 22,
  },
  emailHighlight: {
    color: Colors.primary,
    fontWeight: '600',
  },
  input: {
    backgroundColor: 'rgba(255,255,255,0.7)',
    borderRadius: 16,
    paddingHorizontal: 20,
    paddingVertical: 16,
    fontSize: 16,
    color: '#1A1A2E',
    borderWidth: 1,
    borderColor: 'rgba(37,99,235,0.2)',
    marginBottom: 16,
  },
  error: {
    color: Colors.error,
    fontSize: 14,
    marginBottom: 12,
  },
  button: {
    backgroundColor: Colors.primary,
    borderRadius: 24,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 4,
    ...Shadows.glow,
  },
  buttonDisabled: { opacity: 0.6 },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  resendButton: {
    marginTop: 20,
    alignItems: 'center',
  },
  resendText: {
    color: Colors.primary,
    fontSize: 14,
    fontWeight: '600',
  },
  successContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  successIcon: { fontSize: 64, marginBottom: 24 },
  successTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#1A1A2E',
    marginBottom: 12,
    textAlign: 'center',
  },
  successSubtitle: {
    fontSize: 15,
    color: '#555566',
    marginBottom: 32,
    textAlign: 'center',
  },
});
