import { ActivityIndicator, Pressable, StyleProp, StyleSheet, Text, ViewStyle } from 'react-native';

import { appTheme } from '../../theme';

type Props = {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  style?: StyleProp<ViewStyle>;
};

export function AppButton({
  label,
  onPress,
  disabled,
  loading,
  variant = 'primary',
  style,
}: Props) {
  const textColor =
    variant === 'ghost'
      ? appTheme.colors.textPrimary
      : appTheme.colors.textInverse;

  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled || loading}
      onPress={onPress}
      style={({ pressed }) => [
        styles.base,
        styles[variant],
        pressed && !disabled && !loading && styles.pressed,
        (disabled || loading) && styles.disabled,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={textColor} />
      ) : (
        <Text style={[styles.label, { color: textColor }]}>{label}</Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: 48,
    borderRadius: appTheme.radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: appTheme.spacing.lg,
  },
  primary: {
    backgroundColor: appTheme.colors.accent,
  },
  secondary: {
    backgroundColor: appTheme.colors.surfaceStrong,
  },
  ghost: {
    backgroundColor: appTheme.colors.surfaceMuted,
  },
  danger: {
    backgroundColor: appTheme.colors.negative,
  },
  pressed: {
    opacity: 0.9,
    transform: [{ scale: 0.99 }],
  },
  disabled: {
    opacity: 0.55,
  },
  label: {
    fontSize: appTheme.typography.body,
    fontWeight: '700',
  },
});
