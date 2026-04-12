import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useNavigation } from '@react-navigation/native';
import { useQueryClient } from '@tanstack/react-query';
import { Alert, StyleSheet, Text, View } from 'react-native';

import { AppStackParamList } from '../../navigation/RootNavigator';
import { AppButton } from '../../components/common/AppButton';
import { AppCard } from '../../components/common/AppCard';
import { ScreenContainer } from '../../components/layout/ScreenContainer';
import { SectionHeader } from '../../components/layout/SectionHeader';
import { logout } from '../../services/api/papervestApi';
import { env } from '../../services/api/env';
import { useAuthStore } from '../../state/authStore';
import { appTheme } from '../../theme';

export function AccountScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<AppStackParamList>>();
  const queryClient = useQueryClient();
  const session = useAuthStore((state) => state.session);
  const signOut = useAuthStore((state) => state.signOut);

  const handleSignOut = () => {
    Alert.alert('Sign out?', 'This will clear your local session from the app.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out',
        style: 'destructive',
        onPress: () => {
          void (async () => {
            try {
              if (session?.refreshToken) {
                await logout(session.refreshToken);
              }
            } catch {
              // Ignore logout transport failures and still clear local auth state.
            } finally {
              queryClient.clear();
              await signOut();
            }
          })();
        },
      },
    ]);
  };

  return (
    <ScreenContainer contentStyle={styles.content}>
      <SectionHeader
        title="Account"
        subtitle="Session details and environment information for your local build."
      />

      <AppCard>
        <Text style={styles.label}>Signed in as</Text>
        <Text style={styles.value}>{session?.user.email ?? 'Unknown user'}</Text>
      </AppCard>

      <AppCard>
        <Text style={styles.label}>API base URL</Text>
        <Text style={styles.url}>{env.apiBaseUrl}</Text>
        <Text style={styles.caption}>
          Change `EXPO_PUBLIC_API_BASE_URL` in `apps/mobile/.env` when testing on a simulator or device.
        </Text>
      </AppCard>

      <View style={styles.buttonArea}>
        <AppButton
          label="Target Orders"
          onPress={() => navigation.navigate('Orders')}
          variant="secondary"
        />
      </View>

      <View style={styles.buttonArea}>
        <AppButton label="Sign Out" onPress={handleSignOut} variant="danger" />
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingTop: appTheme.spacing.md,
  },
  label: {
    color: appTheme.colors.textSecondary,
    fontSize: appTheme.typography.caption,
    fontWeight: '700',
  },
  value: {
    marginTop: appTheme.spacing.xs,
    color: appTheme.colors.textPrimary,
    fontSize: appTheme.typography.heading,
    fontWeight: '800',
  },
  url: {
    marginTop: appTheme.spacing.xs,
    color: appTheme.colors.textPrimary,
    fontSize: appTheme.typography.body,
    fontWeight: '700',
  },
  caption: {
    marginTop: appTheme.spacing.sm,
    color: appTheme.colors.textSecondary,
    fontSize: appTheme.typography.caption,
    lineHeight: 18,
  },
  buttonArea: {
    marginTop: appTheme.spacing.md,
  },
});
