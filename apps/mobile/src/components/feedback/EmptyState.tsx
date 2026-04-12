import { StyleSheet, Text, View } from 'react-native';

import { appTheme } from '../../theme';
import { AppButton } from '../common/AppButton';

type Props = {
  title: string;
  description: string;
  actionLabel?: string;
  onActionPress?: () => void;
};

export function EmptyState({
  title,
  description,
  actionLabel,
  onActionPress,
}: Props) {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.description}>{description}</Text>
      {actionLabel && onActionPress ? (
        <AppButton label={actionLabel} onPress={onActionPress} variant="ghost" />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: appTheme.spacing.sm,
    paddingVertical: appTheme.spacing.xxl,
    paddingHorizontal: appTheme.spacing.xl,
  },
  title: {
    color: appTheme.colors.textPrimary,
    fontSize: appTheme.typography.heading,
    fontWeight: '700',
    textAlign: 'center',
  },
  description: {
    color: appTheme.colors.textSecondary,
    fontSize: appTheme.typography.body,
    textAlign: 'center',
    lineHeight: 22,
  },
});
