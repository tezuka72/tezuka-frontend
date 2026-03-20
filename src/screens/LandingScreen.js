import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const LOGO = require('../../assets/logo.png');
import { Colors } from '../theme/colors';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const headingFontSize = SCREEN_WIDTH < 480 ? 40 : Platform.OS === 'web' ? 72 : 56;
const headingLineHeight = SCREEN_WIDTH < 480 ? 50 : Platform.OS === 'web' ? 80 : 64;

export default function LandingScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { lang, toggleLanguage, t } = useLanguage();
  const { browseAsGuest } = useAuth();

  return (
    <LinearGradient
      colors={['#FFD60A', '#FFFFFF', '#29B6F6']}
      locations={[0, 0.45, 1]}
      style={styles.container}
    >

      {/* ナビゲーションバー */}
      <View style={[styles.navbar, { paddingTop: insets.top || (Platform.OS === 'web' ? 20 : 56) }]}>
        <View style={styles.logoContainer}>
          <Image source={LOGO} style={styles.logoIcon} resizeMode="contain" />
          <Text style={styles.logoText}>LORE MANGA</Text>
        </View>
        <View style={styles.navButtons}>
          <TouchableOpacity style={styles.langToggleButton} onPress={toggleLanguage}>
            <Text style={styles.langToggleText}>🌐 {lang === 'ja' ? 'EN' : 'JP'}</Text>
          </TouchableOpacity>
          {SCREEN_WIDTH >= 480 && (
            <TouchableOpacity
              style={styles.navLoginButton}
              onPress={() => navigation?.navigate('Login')}
            >
              <Text style={styles.navLoginText}>{t('landing.login')}</Text>
            </TouchableOpacity>
          )}
          {SCREEN_WIDTH >= 480 && (
            <TouchableOpacity
              style={styles.navRegisterButton}
              onPress={() => navigation?.navigate('Register')}
            >
              <Text style={styles.navRegisterText}>{t('landing.startFree')}</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* ヒーローセクション */}
      <View style={styles.hero}>
        {/* バッジ */}
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{t('landing.badge')}</Text>
        </View>

        {/* メイン見出し */}
        <View style={styles.headingContainer}>
          <Text style={styles.headingLine1}>
            あなたの<Text style={styles.headingManga}>漫画</Text>を
          </Text>
          <View style={styles.headingLine2Container}>
            <Text style={[styles.headingLine2, styles.headingAccent]}>{t('landing.headingAccent')}</Text>
            <Text style={styles.headingLine2}>{t('landing.heading2')}</Text>
          </View>
        </View>

        {/* CTAボタン */}
        <View style={styles.ctaContainer}>
          <TouchableOpacity
            style={styles.ctaPrimary}
            onPress={() => navigation?.navigate('Register')}
          >
            <Text style={styles.ctaPrimaryText}>{t('landing.ctaPrimary')}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.ctaSecondary}
            onPress={() => browseAsGuest()}
          >
            <Text style={styles.ctaSecondaryText}>{t('landing.ctaSecondary')}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
    overflow: 'hidden',
  },

  // 背景グロー
  glowContainer: {
    ...StyleSheet.absoluteFillObject,
  },
  glowPurple: {
    position: 'absolute',
    width: SCREEN_WIDTH * 0.8,
    height: SCREEN_WIDTH * 0.8,
    borderRadius: SCREEN_WIDTH * 0.4,
    backgroundColor: Colors.violet,
    opacity: 0.12,
    top: SCREEN_HEIGHT * 0.1,
    left: -SCREEN_WIDTH * 0.2,
  },
  glowCyan: {
    position: 'absolute',
    width: SCREEN_WIDTH * 0.6,
    height: SCREEN_WIDTH * 0.6,
    borderRadius: SCREEN_WIDTH * 0.3,
    backgroundColor: Colors.accent,
    opacity: 0.07,
    bottom: SCREEN_HEIGHT * 0.1,
    right: -SCREEN_WIDTH * 0.15,
  },

  // ナビバー
  navbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingBottom: 16,
  },
  logoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  logoIcon: {
    width: 28,
    height: 28,
  },
  logoText: {
    fontSize: 20,
    fontWeight: '800',
    color: '#1A1A2E',
    letterSpacing: 2,
  },
  navButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  langToggleButton: {
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  langToggleText: {
    color: '#555566',
    fontSize: 13,
    fontWeight: '600',
  },
  navLoginButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  navLoginText: {
    color: '#1A1A2E',
    fontSize: 15,
    fontWeight: '500',
  },
  navRegisterButton: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 18,
    paddingVertical: 9,
    borderRadius: 24,
  },
  navRegisterText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },

  // ヒーローセクション
  hero: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingBottom: 60,
  },

  // バッジ
  badge: {
    backgroundColor: 'rgba(255,255,255,0.5)',
    borderWidth: 1,
    borderColor: 'rgba(37, 99, 235, 0.3)',
    borderRadius: 24,
    paddingHorizontal: 16,
    paddingVertical: 7,
    marginBottom: 32,
  },
  badgeText: {
    color: '#2563EB',
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0.5,
  },

  // 見出し
  headingContainer: {
    alignItems: 'center',
    marginBottom: 24,
  },
  headingLine1: {
    fontSize: headingFontSize,
    fontWeight: '900',
    color: '#1A1A2E',
    lineHeight: headingLineHeight,
    letterSpacing: -1,
    textAlign: 'center',
  },
  headingLine2Container: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  headingLine2: {
    fontSize: headingFontSize,
    fontWeight: '900',
    color: '#1A1A2E',
    lineHeight: headingLineHeight,
    letterSpacing: -1,
    textAlign: 'center',
  },
  headingAccent: {
    color: Colors.accent,
  },
  headingManga: {
    color: '#F58A23',
  },

  // CTAボタン
  ctaContainer: {
    flexDirection: 'row',
    gap: 16,
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  ctaPrimary: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 32,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 8,
  },
  ctaPrimaryText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  ctaSecondary: {
    borderWidth: 1.5,
    borderColor: '#1A1A2E',
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 32,
    backgroundColor: 'rgba(255,255,255,0.4)',
  },
  ctaSecondaryText: {
    color: '#1A1A2E',
    fontSize: 16,
    fontWeight: '600',
  },
});
