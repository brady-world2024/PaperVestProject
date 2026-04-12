import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Text } from 'react-native';

import { useAuthStore } from '../state/authStore';
import { appTheme } from '../theme';
import { AccountScreen } from '../screens/app/AccountScreen';
import { ActivityScreen } from '../screens/app/ActivityScreen';
import { BootScreen } from '../screens/app/BootScreen';
import { HomeScreen } from '../screens/app/HomeScreen';
import { OrdersScreen } from '../screens/app/OrdersScreen';
import { PortfolioScreen } from '../screens/app/PortfolioScreen';
import { StockDetailScreen } from '../screens/app/StockDetailScreen';
import { TradeTicketScreen } from '../screens/app/TradeTicketScreen';
import { WatchlistScreen } from '../screens/app/WatchlistScreen';
import { LoginScreen } from '../screens/auth/LoginScreen';
import { RegisterScreen } from '../screens/auth/RegisterScreen';
import { WelcomeScreen } from '../screens/auth/WelcomeScreen';

export type AuthStackParamList = {
  Welcome: undefined;
  Login: undefined;
  Register: undefined;
};

export type AppTabsParamList = {
  Home: undefined;
  Watchlist: undefined;
  Portfolio: undefined;
  Activity: undefined;
  Account: undefined;
};

export type AppStackParamList = {
  Tabs: undefined;
  Orders:
    | {
        symbol?: string;
        side?: 'BUY' | 'SELL';
      }
    | undefined;
  StockDetail: {
    symbol: string;
    companyName?: string;
  };
  TradeTicket: {
    symbol: string;
    companyName?: string;
    side: 'BUY' | 'SELL';
  };
};

const AuthStack = createNativeStackNavigator<AuthStackParamList>();
const Tab = createBottomTabNavigator<AppTabsParamList>();
const AppStack = createNativeStackNavigator<AppStackParamList>();

export function RootNavigator() {
  const status = useAuthStore((state) => state.status);

  if (status === 'hydrating') {
    return <BootScreen />;
  }

  return status === 'authenticated' ? <AuthenticatedNavigator /> : <UnauthenticatedNavigator />;
}

function UnauthenticatedNavigator() {
  return (
    <AuthStack.Navigator
      screenOptions={{
        headerShadowVisible: false,
        headerTintColor: appTheme.colors.textPrimary,
        contentStyle: {
          backgroundColor: appTheme.colors.background,
        },
      }}
    >
      <AuthStack.Screen name="Welcome" component={WelcomeScreen} options={{ headerShown: false }} />
      <AuthStack.Screen name="Login" component={LoginScreen} options={{ title: 'Log In' }} />
      <AuthStack.Screen name="Register" component={RegisterScreen} options={{ title: 'Create Account' }} />
    </AuthStack.Navigator>
  );
}

function AuthenticatedNavigator() {
  return (
    <AppStack.Navigator
      screenOptions={{
        headerShadowVisible: false,
        headerTintColor: appTheme.colors.textPrimary,
        contentStyle: {
          backgroundColor: appTheme.colors.background,
        },
      }}
    >
      <AppStack.Screen name="Tabs" component={TabNavigator} options={{ headerShown: false }} />
      <AppStack.Screen name="Orders" component={OrdersScreen} options={{ title: 'Target Orders' }} />
      <AppStack.Screen name="StockDetail" component={StockDetailScreen} options={{ title: 'Stock Detail' }} />
      <AppStack.Screen
        name="TradeTicket"
        component={TradeTicketScreen}
        options={({ route }) => ({
          title: route.params.side === 'BUY' ? 'Buy Stock' : 'Sell Stock',
          presentation: 'modal',
        })}
      />
    </AppStack.Navigator>
  );
}

function TabNavigator() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          height: 72,
          paddingBottom: 8,
          paddingTop: 10,
          backgroundColor: appTheme.colors.surface,
          borderTopColor: appTheme.colors.border,
        },
        tabBarActiveTintColor: appTheme.colors.accent,
        tabBarInactiveTintColor: appTheme.colors.textSecondary,
        tabBarLabelStyle: {
          fontWeight: '700',
          fontSize: 12,
        },
      }}
    >
      <Tab.Screen
        name="Home"
        component={HomeScreen}
        options={{
          tabBarLabel: ({ color }) => <TabLabel color={color} label="Home" />,
        }}
      />
      <Tab.Screen
        name="Watchlist"
        component={WatchlistScreen}
        options={{
          tabBarLabel: ({ color }) => <TabLabel color={color} label="Watchlist" />,
        }}
      />
      <Tab.Screen
        name="Portfolio"
        component={PortfolioScreen}
        options={{
          tabBarLabel: ({ color }) => <TabLabel color={color} label="Portfolio" />,
        }}
      />
      <Tab.Screen
        name="Activity"
        component={ActivityScreen}
        options={{
          tabBarLabel: ({ color }) => <TabLabel color={color} label="Activity" />,
        }}
      />
      <Tab.Screen
        name="Account"
        component={AccountScreen}
        options={{
          tabBarLabel: ({ color }) => <TabLabel color={color} label="Account" />,
        }}
      />
    </Tab.Navigator>
  );
}

function TabLabel({ color, label }: { color: string; label: string }) {
  return <Text style={{ color, fontWeight: '700', fontSize: 12 }}>{label}</Text>;
}
