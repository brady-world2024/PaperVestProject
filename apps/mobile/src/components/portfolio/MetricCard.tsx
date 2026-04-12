import { StyleProp, StyleSheet, Text, TextStyle, View, ViewStyle } from 'react-native';

import { appTheme } from '../../theme';

type Props = {
  label: string;
  value: string;
  tone?: 'default' | 'positive' | 'negative';
  style?: StyleProp<ViewStyle>;
  labelStyle?: StyleProp<TextStyle>;
  valueStyle?: StyleProp<TextStyle>;
  valueNumberOfLines?: number;
};

export function MetricCard({
  label,
  value,
  tone = 'default',
  style,
  labelStyle,
  valueStyle,
  valueNumberOfLines,
}: Props) {
  return (
    <View style={[styles.card, style]}>
      <Text style={[styles.label, labelStyle]}>{label}</Text>
      <Text
        style={[
          styles.value,
          valueStyle,
          tone === 'positive' && styles.positive,
          tone === 'negative' && styles.negative,
        ]}
        numberOfLines={valueNumberOfLines}
        adjustsFontSizeToFit={valueNumberOfLines === 1}
        minimumFontScale={0.8}
      >
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    minWidth: 120,
    backgroundColor: appTheme.colors.surfaceMuted,
    borderRadius: appTheme.radius.md,
    padding: appTheme.spacing.md,
    gap: 6,
  },
  label: {
    color: appTheme.colors.textSecondary,
    fontSize: appTheme.typography.caption,
    fontWeight: '600',
  },
  value: {
    color: appTheme.colors.textPrimary,
    fontSize: appTheme.typography.heading,
    fontWeight: '800',
    flexShrink: 1,
  },
  positive: {
    color: appTheme.colors.positive,
  },
  negative: {
    color: appTheme.colors.negative,
  },
});
