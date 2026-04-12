import { StyleSheet, Text, View } from 'react-native';

import { BrandLogo } from '../../components/common/BrandLogo';
import { SkeletonBlock } from '../../components/feedback/SkeletonBlock';
import { appTheme } from '../../theme';

export function BootScreen() {
  return (
    <View style={styles.container}>
      <BrandLogo size={132} />
      <Text style={styles.title}>Loading your paper desk</Text>
      <View style={styles.stack}>
        <SkeletonBlock height={18} width={180} />
        <SkeletonBlock height={18} width={220} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: appTheme.colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    gap: appTheme.spacing.md,
    padding: appTheme.spacing.xl,
  },
  title: {
    color: appTheme.colors.textPrimary,
    fontSize: appTheme.typography.title,
    fontWeight: '800',
  },
  stack: {
    gap: appTheme.spacing.sm,
    alignItems: 'center',
  },
});
