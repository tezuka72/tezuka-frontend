import { useState } from 'react';
import {
  View,
  Text,
  Image,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';

const LOGO = require('../../assets/logo.png');
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { Colors } from '../theme/colors';
import { Shadows } from '../theme/styles';

export default function RegisterScreen({ navigation }) {
  const { register } = useAuth();
  const { t } = useLanguage();
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState('');
  const [passwordError, setPasswordError] = useState('');

  const validatePassword = (pwd) => {
    const hasMinLength = pwd.length >= 8;
    const hasUpperCase = /[A-Z]/.test(pwd);
    const hasLowerCase = /[a-z]/.test(pwd);
    const hasNumber = /\d/.test(pwd);

    const isValid = hasMinLength && hasUpperCase && hasLowerCase && hasNumber;
    if (!isValid) {
      setPasswordError(t('register.passwordError'));
    } else {
      setPasswordError('');
    }
    return isValid;
  };

  const handleRegister = async () => {
    if (!validatePassword(password)) {
      return;
    }

    try {
      setError('');
      const result = await register(username, email, password, displayName);
      if (!result.success) {
        setError(result.error || t('register.error'));
      }
    } catch (err) {
      setError(err.message || t('register.error'));
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.logoContainer}>
          <Image source={LOGO} style={styles.logo} resizeMode="contain" />
          <Text style={styles.logoText}>TEZUKA</Text>
        </View>

        <Text style={styles.title}>{t('register.title')}</Text>
        <Text style={styles.subtitle}>{t('register.subtitle')}</Text>

        <View style={styles.form}>
          <View style={styles.inputContainer}>
            <TextInput
              style={styles.input}
              placeholder={t('register.usernamePlaceholder')}
              placeholderTextColor={Colors.muted}
              value={username}
              onChangeText={setUsername}
              autoCapitalize="none"
            />
          </View>

          <View style={styles.inputContainer}>
            <TextInput
              style={styles.input}
              placeholder={t('register.displayNamePlaceholder')}
              placeholderTextColor={Colors.muted}
              value={displayName}
              onChangeText={setDisplayName}
            />
          </View>

          <View style={styles.inputContainer}>
            <TextInput
              style={styles.input}
              placeholder={t('register.emailPlaceholder')}
              placeholderTextColor={Colors.muted}
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
            />
          </View>

          <View style={styles.inputContainer}>
            <TextInput
              style={styles.input}
              placeholder={t('register.passwordPlaceholder')}
              placeholderTextColor={Colors.muted}
              value={password}
              onChangeText={(pwd) => {
                setPassword(pwd);
                validatePassword(pwd);
              }}
              secureTextEntry
            />
          </View>
          {passwordError ? <Text style={styles.passwordHint}>{passwordError}</Text> : null}

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <TouchableOpacity style={styles.button} onPress={handleRegister}>
            <Text style={styles.buttonText}>{t('register.button')}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.linkButton}
            onPress={() => navigation?.navigate('Login')}
          >
            <Text style={styles.linkText}>
              {t('register.hasAccount')} <Text style={styles.linkHighlight}>{t('register.login')}</Text>
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  content: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 24,
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 48,
  },
  logo: {
    width: 72,
    height: 72,
    marginBottom: 8,
  },
  logoText: {
    fontSize: 32,
    fontWeight: 'bold',
    color: Colors.foreground,
    letterSpacing: 2,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: Colors.foreground,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: Colors.muted,
    marginBottom: 32,
  },
  form: {
    width: '100%',
  },
  inputContainer: {
    marginBottom: 16,
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
  },
  error: {
    color: Colors.error,
    fontSize: 14,
    marginBottom: 16,
  },
  passwordHint: {
    color: '#C92A2A',
    fontSize: 12,
    marginTop: -12,
    marginBottom: 12,
  },
  button: {
    backgroundColor: Colors.primary,
    borderRadius: 24,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 8,
    ...Shadows.glow,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  linkButton: {
    marginTop: 24,
    alignItems: 'center',
  },
  linkText: {
    color: Colors.muted,
    fontSize: 14,
  },
  linkHighlight: {
    color: Colors.primary,
    fontWeight: '600',
  },
});
