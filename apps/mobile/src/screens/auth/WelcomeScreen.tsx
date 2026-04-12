import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, Text, View } from 'react-native';

import { AuthStackParamList } from '../../navigation/RootNavigator';
import { AppButton } from '../../components/common/AppButton';
import { BrandLogo } from '../../components/common/BrandLogo';
import { AppCard } from '../../components/common/AppCard';
import { ScreenContainer } from '../../components/layout/ScreenContainer';
import { appTheme } from '../../theme';

type Props = NativeStackScreenProps<AuthStackParamList, 'Welcome'>;

export function WelcomeScreen({ navigation }: Props) {
  return (
    <ScreenContainer contentStyle={styles.content}>
      <LinearGradient
        colors={['#DDF1EA', '#FFF7EA', '#F5E9D5']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.hero}
      >
        <BrandLogo size={156} />
        <Text style={styles.title}>Practice the market before real money ever touches the line.</Text>
        <Text style={styles.subtitle}>
          Track major US stocks, build a watchlist, and manage a paper portfolio with live-backed pricing and clean portfolio math.
        </Text>
        <View style={styles.buttonStack}>
          <AppButton label="Log In" onPress={() => navigation.navigate('Login')} />
          <AppButton
            label="Create Account"
            onPress={() => navigation.navigate('Register')}
            variant="ghost"
          />
        </View>
      </LinearGradient>

      <View style={styles.grid}>
        <AppCard style={styles.featureCard}>
          <Text style={styles.featureTitle}>Live-backed quotes</Text>
          <Text style={styles.featureBody}>Browse a curated home board, symbol search, and detailed stock snapshots.</Text>
        </AppCard>
        <AppCard style={styles.featureCard}>
          <Text style={styles.featureTitle}>Paper trading</Text>
          <Text style={styles.featureBody}>Buy and sell with virtual cash, audited transactions, and backend validation.</Text>
        </AppCard>
        <AppCard style={styles.featureCard}>
          <Text style={styles.featureTitle}>Portfolio insight</Text>
          <Text style={styles.featureBody}>See cash, holdings, unrealized P&L, realized P&L, and portfolio value in one place.</Text>
        </AppCard>
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingTop: appTheme.spacing.md,
  },
  hero: {
    borderRadius: appTheme.radius.lg,
    padding: appTheme.spacing.xl,
    gap: appTheme.spacing.md,
    alignItems: 'flex-start',
  },
  title: {
    color: appTheme.colors.textPrimary,
    fontSize: appTheme.typography.display,
    lineHeight: 38,
    fontWeight: '800',
  },
  subtitle: {
    color: appTheme.colors.textSecondary,
    fontSize: appTheme.typography.body,
    lineHeight: 23,
  },
  buttonStack: {
    gap: appTheme.spacing.sm,
    marginTop: appTheme.spacing.sm,
  },
  grid: {
    gap: appTheme.spacing.md,
  },
  featureCard: {
    gap: appTheme.spacing.xs,
  },
  featureTitle: {
    color: appTheme.colors.textPrimary,
    fontSize: appTheme.typography.heading,
    fontWeight: '700',
  },
  featureBody: {
    color: appTheme.colors.textSecondary,
    fontSize: appTheme.typography.body,
    lineHeight: 22,
  },
});
