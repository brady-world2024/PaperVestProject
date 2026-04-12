import { StyleSheet, Text, View } from 'react-native';

import { appTheme } from '../../theme';

type Props = {
  message: string;
  tone?: 'info' | 'error';
};

export function InlineNotice({ message, tone = 'info' }: Props) {
  return (
    <View
      style={[
        styles.container,
        tone === 'error' ? styles.error : styles.info,
      ]}
    >
      <Text style={styles.text}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: appTheme.radius.md,
    padding: appTheme.spacing.sm,
  },
  info: {
    backgroundColor: appTheme.colors.accentSoft,
  },
  error: {
    backgroundColor: appTheme.colors.negativeSoft,
  },
  text: {
    color: appTheme.colors.textPrimary,
    fontSize: appTheme.typography.caption,
    fontWeight: '600',
  },
});
