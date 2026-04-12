import { StyleSheet, Text, TextInput, TextInputProps, View } from 'react-native';

import { appTheme } from '../../theme';

type Props = TextInputProps & {
  label: string;
  error?: string;
};

export function AppTextField({ label, error, ...inputProps }: Props) {
  return (
    <View style={styles.wrapper}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        placeholderTextColor={appTheme.colors.textSecondary}
        {...inputProps}
        style={[styles.input, error && styles.inputError]}
      />
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    gap: appTheme.spacing.xs,
  },
  label: {
    color: appTheme.colors.textPrimary,
    fontSize: appTheme.typography.caption,
    fontWeight: '700',
  },
  input: {
    minHeight: 52,
    borderRadius: appTheme.radius.md,
    borderWidth: 1,
    borderColor: appTheme.colors.border,
    backgroundColor: appTheme.colors.surface,
    paddingHorizontal: appTheme.spacing.md,
    color: appTheme.colors.textPrimary,
    fontSize: appTheme.typography.body,
  },
  inputError: {
    borderColor: appTheme.colors.negative,
  },
  error: {
    color: appTheme.colors.negative,
    fontSize: appTheme.typography.micro,
    fontWeight: '600',
  },
});
