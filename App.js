import { useEffect, useRef } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFonts } from 'expo-font';
import Constants from 'expo-constants';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { AuthProvider, useAuth } from './src/context/AuthContext';
import { LanguageProvider, useLanguage } from './src/context/LanguageContext';
import { StripeProvider } from './src/utils/stripe';
import { notificationAPI } from './src/api/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const queryClient = new QueryClient();

// Screens
import LandingScreen from './src/screens/LandingScreen';
import LoginScreen from './src/screens/LoginScreen';
import RegisterScreen from './src/screens/RegisterScreen';
import ForgotPasswordScreen from './src/screens/ForgotPasswordScreen';
import EmailVerificationScreen from './src/screens/EmailVerificationScreen';
import HomeScreen from './src/screens/HomeScreen';
import SocialScreen from './src/screens/SocialScreen';
import ProfileScreen from './src/screens/ProfileScreen';
import PostCreateScreen from './src/screens/PostCreateScreen';
import PostDetailScreen from './src/screens/PostDetailScreen';
import SeriesScreen from './src/screens/SeriesScreen';
import SeriesDetail from './src/screens/SeriesDetail';
import EarlyFansScreen from './src/screens/EarlyFansScreen';
import ChatScreen from './src/screens/ChatScreen';
import NewConversationScreen from './src/screens/NewConversationScreen';
import GroupSettingsScreen from './src/screens/GroupSettingsScreen';
import AddGroupMemberScreen from './src/screens/AddGroupMemberScreen';
import RankingScreen from './src/screens/RankingScreen';
import BankAccountScreen from './src/screens/BankAccountScreen';
import WithdrawalScreen from './src/screens/WithdrawalScreen';
import EarningsDashboardScreen from './src/screens/EarningsDashboardScreen';
import EditProfileScreen from './src/screens/EditProfileScreen';
import CreateSeriesScreen from './src/screens/CreateSeriesScreen';
import SearchScreen from './src/screens/SearchScreen';
import AnalyticsScreen from './src/screens/AnalyticsScreen';
import SeriesBoardScreen from './src/screens/SeriesBoardScreen';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

// TikTok風中央投稿ボタン
function CreateTabButton({ onPress }) {
  return (
    <TouchableOpacity style={tabStyles.createButtonWrap} onPress={onPress} activeOpacity={0.85}>
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <View style={tabStyles.createButtonShadowLeft} />
        <View style={tabStyles.createButtonShadowRight} />
        <View style={tabStyles.createButtonInner}>
          <Text style={tabStyles.createButtonText}>+</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

// タブアイコン
function TabIcon({ name, focused }) {
  const iconMap = {
    Home:    focused ? 'home'    : 'home-outline',
    Social:  focused ? 'people'  : 'people-outline',
    Ranking: focused ? 'trophy'  : 'trophy-outline',
    Profile: focused ? 'person'  : 'person-outline',
  };
  const color = focused ? '#2563EB' : '#9CA3AF';
  return (
    <View style={tabStyles.iconWrap}>
      <Ionicons name={iconMap[name] || 'apps-outline'} size={24} color={color} />
    </View>
  );
}

// ゲスト向けログイン促進画面
function GuestPromptScreen({ navigation }) {
  return (
    <View style={{ flex: 1, backgroundColor: '#06090F', justifyContent: 'center', alignItems: 'center', padding: 32 }}>
      <Ionicons name="lock-closed-outline" size={52} color="#444" style={{ marginBottom: 20 }} />
      <Text style={{ color: '#FFFFFF', fontSize: 20, fontWeight: '700', marginBottom: 10 }}>ログインが必要です</Text>
      <Text style={{ color: '#888', fontSize: 14, textAlign: 'center', marginBottom: 36, lineHeight: 20 }}>
        この機能を使うにはアカウントが必要です
      </Text>
      <TouchableOpacity
        style={{ backgroundColor: '#2563EB', borderRadius: 14, paddingVertical: 15, paddingHorizontal: 48, marginBottom: 14, width: '100%', alignItems: 'center' }}
        onPress={() => navigation.navigate('Login')}
      >
        <Text style={{ color: '#FFFFFF', fontSize: 16, fontWeight: '700' }}>ログイン</Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={{ borderWidth: 1.5, borderColor: '#2563EB', borderRadius: 14, paddingVertical: 15, paddingHorizontal: 48, width: '100%', alignItems: 'center' }}
        onPress={() => navigation.navigate('Register')}
      >
        <Text style={{ color: '#2563EB', fontSize: 16, fontWeight: '600' }}>新規登録（無料）</Text>
      </TouchableOpacity>
    </View>
  );
}

// ボトムタブナビゲーター（ログイン後 / ゲスト）
function MainTabs() {
  const { user, isGuest } = useAuth();
  const { t } = useLanguage();
  const { bottom: bottomInset } = useSafeAreaInsets();

  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: true,
        tabBarActiveTintColor: '#2563EB',
        tabBarInactiveTintColor: '#9CA3AF',
        tabBarStyle: [
          tabStyles.tabBar,
          Platform.OS === 'web'
            ? { position: 'fixed', bottom: 0, left: 0, right: 0, height: 60, paddingBottom: 4 }
            : { position: 'absolute', height: 60 + bottomInset, paddingBottom: bottomInset + 4 },
        ],
        tabBarLabelStyle: tabStyles.tabLabel,
        tabBarItemStyle: { flex: 1 },
      }}
    >
      <Tab.Screen
        name="Home"
        component={HomeScreen}
        options={{
          title: t('tab.home'),
          tabBarIcon: ({ focused }) => <TabIcon name="Home" focused={focused} />,
        }}
      />
      <Tab.Screen
        name="Social"
        component={isGuest ? GuestPromptScreen : SocialScreen}
        options={{
          title: 'ソーシャル',
          tabBarIcon: ({ focused }) => <TabIcon name="Social" focused={focused} />,
        }}
      />
      <Tab.Screen
        name="Create"
        component={isGuest ? GuestPromptScreen : PostCreateScreen}
        options={{
          title: '',
          tabBarIcon: () => null,
          tabBarLabel: () => null,
          tabBarButton: (props) => <CreateTabButton onPress={props.onPress} />,
        }}
      />
      <Tab.Screen
        name="Ranking"
        component={RankingScreen}
        options={{
          title: t('tab.ranking'),
          tabBarIcon: ({ focused }) => <TabIcon name="Ranking" focused={focused} />,
        }}
      />
      <Tab.Screen
        name="Profile"
        component={isGuest ? GuestPromptScreen : ProfileScreen}
        initialParams={{ username: user?.username }}
        options={{
          title: t('tab.profile'),
          tabBarIcon: ({ focused }) => <TabIcon name="Profile" focused={focused} />,
        }}
      />
    </Tab.Navigator>
  );
}

// メインナビゲーター
function AppNavigator() {
  const { isAuthenticated, isGuest, isLoading } = useAuth();
  const { t } = useLanguage();

  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#FFFFFF' }}>
        <ActivityIndicator size="large" color="#000" />
        <Text style={{ marginTop: 16, color: '#666' }}>{t('app.loading')}</Text>
      </View>
    );
  }

  // 未ログイン・非ゲストはランディング画面
  if (!isAuthenticated && !isGuest) {
    return (
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="Landing" component={LandingScreen} />
        <Stack.Screen name="Login" component={LoginScreen} />
        <Stack.Screen name="Register" component={RegisterScreen} />
        <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
        <Stack.Screen name="EmailVerification" component={EmailVerificationScreen} />
      </Stack.Navigator>
    );
  }

  // ログイン済み or ゲスト → メイン画面
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="MainTabs" component={MainTabs} />
      {/* ゲストがログイン/登録したい場合 */}
      <Stack.Screen name="Login" component={LoginScreen} />
      <Stack.Screen name="Register" component={RegisterScreen} />
      <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
      <Stack.Screen name="EmailVerification" component={EmailVerificationScreen} />
      {/* 認証済みユーザー向け詳細画面 */}
      <Stack.Screen
        name="PostDetail"
        component={PostDetailScreen}
        options={({ navigation }) => ({
          headerShown: true,
          title: '投稿詳細',
          headerLeft: () => (
            <TouchableOpacity onPress={() => navigation.goBack()} style={{ paddingRight: 12 }}>
              <Ionicons name="arrow-back" size={24} color="#000" />
            </TouchableOpacity>
          ),
        })}
      />
      <Stack.Screen
        name="Series"
        component={SeriesScreen}
        options={{ headerShown: true, title: 'シリーズ' }}
      />
      <Stack.Screen
        name="SeriesDetail"
        component={SeriesDetail}
        options={{ headerShown: true, title: 'シリーズ詳細' }}
      />
      <Stack.Screen
        name="UserProfile"
        component={ProfileScreen}
        options={{ headerShown: true, title: 'プロフィール' }}
      />
      <Stack.Screen
        name="EarlyFans"
        component={EarlyFansScreen}
        options={{ headerShown: true, title: '初期ファン' }}
      />
      <Stack.Screen
        name="Chat"
        component={ChatScreen}
        options={({ navigation }) => ({
          headerShown: true,
          headerLeft: () => (
            <TouchableOpacity onPress={() => navigation.goBack()} style={{ paddingRight: 12 }}>
              <Ionicons name="arrow-back" size={24} color="#000" />
            </TouchableOpacity>
          ),
        })}
      />
      <Stack.Screen
        name="NewConversation"
        component={NewConversationScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="GroupSettings"
        component={GroupSettingsScreen}
        options={{ headerShown: true, title: 'グループ設定' }}
      />
      <Stack.Screen
        name="AddGroupMember"
        component={AddGroupMemberScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="BankAccount"
        component={BankAccountScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="Withdrawal"
        component={WithdrawalScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="EarningsDashboard"
        component={EarningsDashboardScreen}
        options={{ headerShown: true, title: '収益ダッシュボード' }}
      />
      <Stack.Screen
        name="EditProfile"
        component={EditProfileScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="CreateSeries"
        component={CreateSeriesScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="Search"
        component={SearchScreen}
        options={({ navigation }) => ({
          headerShown: true,
          title: '検索',
          headerLeft: () => (
            <TouchableOpacity onPress={() => navigation.goBack()} style={{ paddingRight: 12 }}>
              <Ionicons name="arrow-back" size={24} color="#000" />
            </TouchableOpacity>
          ),
        })}
      />
      <Stack.Screen
        name="Analytics"
        component={AnalyticsScreen}
        options={{ headerShown: true, title: '読者分析' }}
      />
      <Stack.Screen
        name="SeriesBoard"
        component={SeriesBoardScreen}
        options={{ headerShown: true, title: '掲示板' }}
      />
    </Stack.Navigator>
  );
}

// プッシュ通知の許可取得・トークン登録
async function registerForPushNotifications() {
  if (!Device.isDevice) return;
  const { status: existing } = await Notifications.getPermissionsAsync();
  let finalStatus = existing;
  if (existing !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }
  if (finalStatus !== 'granted') return;
  const tokenData = await Notifications.getExpoPushTokenAsync({
    projectId: Constants.expoConfig?.extra?.eas?.projectId,
  });
  const token = tokenData.data;
  if (token) {
    notificationAPI.saveToken(token).catch(() => {});
  }
  if (Platform.OS === 'android') {
    Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.MAX,
    });
  }
}

export default function App() {
  const stripeKey = Constants.expoConfig?.extra?.STRIPE_PUBLISHABLE_KEY || '';
  const notifListener = useRef();
  const responseListener = useRef();

  // Web版でIoniconsフォントを読み込む
  const [fontsLoaded, fontError] = useFonts(Ionicons.font);

  useEffect(() => {
    if (!fontsLoaded && !fontError) return;
    registerForPushNotifications();

    notifListener.current = Notifications.addNotificationReceivedListener(() => {});
    responseListener.current = Notifications.addNotificationResponseReceivedListener(() => {});

    return () => {
      try {
        notifListener.current?.remove?.();
        responseListener.current?.remove?.();
      } catch (e) {}
    };
  }, [fontsLoaded]);

  if (!fontsLoaded && !fontError) return null;

  return (
    <QueryClientProvider client={queryClient}>
      <SafeAreaProvider>
        <AuthProvider>
          <LanguageProvider>
            <StripeProvider publishableKey={stripeKey}>
              <NavigationContainer>
                <AppNavigator />
              </NavigationContainer>
            </StripeProvider>
          </LanguageProvider>
        </AuthProvider>
      </SafeAreaProvider>
    </QueryClientProvider>
  );
}

const tabStyles = StyleSheet.create({
  tabBar: {
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    paddingTop: 4,
  },
  tabLabel: {
    fontSize: 10,
    fontWeight: '500',
  },
  iconWrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  // TikTok風中央ボタン
  createButtonWrap: {
    flex: 1,
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  createButtonShadowLeft: {
    position: 'absolute',
    left: -3,
    top: 0,
    width: 46,
    height: 34,
    borderRadius: 8,
    backgroundColor: '#2563EB', // ブルー
  },
  createButtonShadowRight: {
    position: 'absolute',
    right: -3,
    top: 0,
    width: 46,
    height: 34,
    borderRadius: 8,
    backgroundColor: '#F5C00A', // イエロー
  },
  createButtonInner: {
    width: 46,
    height: 34,
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1,
  },
  createButtonText: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#000',
    lineHeight: 26,
  },
});
