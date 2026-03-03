import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import { AuthProvider, useAuth } from './src/context/AuthContext';
import { LanguageProvider, useLanguage } from './src/context/LanguageContext';
import { StripeProvider } from './src/utils/stripe';

// Screens
import LandingScreen from './src/screens/LandingScreen';
import LoginScreen from './src/screens/LoginScreen';
import RegisterScreen from './src/screens/RegisterScreen';
import HomeScreen from './src/screens/HomeScreen';
import FriendsScreen from './src/screens/FriendsScreen';
import ProfileScreen from './src/screens/ProfileScreen';
import PostCreateScreen from './src/screens/PostCreateScreen';
import PostDetailScreen from './src/screens/PostDetailScreen';
import SeriesScreen from './src/screens/SeriesScreen';
import SeriesDetail from './src/screens/SeriesDetail';
import EarlyFansScreen from './src/screens/EarlyFansScreen';
import InboxScreen from './src/screens/InboxScreen';
import RankingScreen from './src/screens/RankingScreen';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

// TikTok風中央投稿ボタン
function CreateTabButton({ onPress }) {
  return (
    <TouchableOpacity style={tabStyles.createButtonWrap} onPress={onPress} activeOpacity={0.85}>
      <View style={tabStyles.createButtonShadowLeft} />
      <View style={tabStyles.createButtonShadowRight} />
      <View style={tabStyles.createButtonInner}>
        <Text style={tabStyles.createButtonText}>+</Text>
      </View>
    </TouchableOpacity>
  );
}

// タブアイコン
function TabIcon({ name, focused }) {
  const iconMap = {
    Home:    focused ? 'home'              : 'home-outline',
    Friends: focused ? 'people'            : 'people-outline',
    Ranking: focused ? 'trophy'            : 'trophy-outline',
    Inbox:   focused ? 'chatbubble-ellipses' : 'chatbubble-ellipses-outline',
    Profile: focused ? 'person'            : 'person-outline',
  };
  const color = focused ? '#FFFFFF' : '#888888';
  return (
    <View style={tabStyles.iconWrap}>
      <Ionicons name={iconMap[name] || 'apps-outline'} size={24} color={color} />
    </View>
  );
}

// ボトムタブナビゲーター（ログイン後）
function MainTabs() {
  const { user } = useAuth();
  const { t } = useLanguage();

  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: true,
        tabBarActiveTintColor: '#FFFFFF',
        tabBarInactiveTintColor: '#888888',
        tabBarStyle: tabStyles.tabBar,
        tabBarLabelStyle: tabStyles.tabLabel,
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
        name="Friends"
        component={FriendsScreen}
        options={{
          title: t('tab.friends'),
          tabBarIcon: ({ focused }) => <TabIcon name="Friends" focused={focused} />,
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
        name="Create"
        component={PostCreateScreen}
        options={{
          title: '',
          tabBarIcon: () => null,
          tabBarLabel: () => null,
          tabBarButton: (props) => <CreateTabButton onPress={props.onPress} />,
        }}
      />
      <Tab.Screen
        name="Inbox"
        component={InboxScreen}
        options={{
          title: t('tab.inbox'),
          tabBarIcon: ({ focused }) => <TabIcon name="Inbox" focused={focused} />,
        }}
      />
      <Tab.Screen
        name="Profile"
        component={ProfileScreen}
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
  const { isAuthenticated, isLoading } = useAuth();
  const { t } = useLanguage();

  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#FFFFFF' }}>
        <ActivityIndicator size="large" color="#000" />
        <Text style={{ marginTop: 16, color: '#666' }}>{t('app.loading')}</Text>
      </View>
    );
  }

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      {!isAuthenticated ? (
        <>
          <Stack.Screen name="Landing" component={LandingScreen} />
          <Stack.Screen name="Login" component={LoginScreen} />
          <Stack.Screen name="Register" component={RegisterScreen} />
        </>
      ) : (
        <>
          <Stack.Screen name="MainTabs" component={MainTabs} />
          <Stack.Screen
            name="PostDetail"
            component={PostDetailScreen}
            options={{ headerShown: true, title: '投稿詳細' }}
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
            name="EarlyFans"
            component={EarlyFansScreen}
            options={{ headerShown: true, title: '初期ファン' }}
          />
        </>
      )}
    </Stack.Navigator>
  );
}

export default function App() {
  const stripeKey = Constants.expoConfig?.extra?.STRIPE_PUBLISHABLE_KEY || '';

  return (
    <AuthProvider>
      <LanguageProvider>
        <StripeProvider publishableKey={stripeKey}>
          <NavigationContainer>
            <AppNavigator />
          </NavigationContainer>
        </StripeProvider>
      </LanguageProvider>
    </AuthProvider>
  );
}

const tabStyles = StyleSheet.create({
  tabBar: {
    backgroundColor: '#000',
    borderTopWidth: 0,
    height: 60,
    paddingBottom: 8,
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
    width: 50,
    height: 34,
    alignSelf: 'center',
    marginBottom: 2,
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
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
