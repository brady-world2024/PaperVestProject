import { PropsWithChildren } from 'react';
import { StyleProp, StyleSheet, View, ViewStyle } from 'react-native';

import { appTheme } from '../../theme';

type Props = PropsWithChildren<{
  style?: StyleProp<ViewStyle>;
  strong?: boolean;
}>;

export function AppCard({ children, style, strong }: Props) {
  return (
    <View
      style={[
        styles.card,
        strong && styles.strongCard,
        style,
      ]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: appTheme.colors.surface,
    borderRadius: appTheme.radius.md,
    padding: appTheme.spacing.md,
    borderWidth: 1,
    borderColor: appTheme.colors.border,
    ...appTheme.shadows.card,
  },
  strongCard: {
    backgroundColor: appTheme.colors.surfaceStrong,
    borderColor: 'transparent',
  },
});
