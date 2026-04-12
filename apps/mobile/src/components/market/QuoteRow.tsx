import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Quote } from '../../services/api/types';
import { appTheme } from '../../theme';
import { formatCurrency, formatPercent, formatSignedCurrency } from '../../utils/formatters';
import { AppCard } from '../common/AppCard';

type Props = {
  quote: Quote;
  onPress?: () => void;
};

export function QuoteRow({ quote, onPress }: Props) {
  const positive = quote.dailyChange >= 0;

  return (
    <Pressable onPress={onPress}>
      <AppCard style={styles.card}>
        <View style={styles.left}>
          <Text style={styles.symbol}>{quote.symbol}</Text>
          <Text numberOfLines={1} style={styles.company}>
            {quote.companyName}
          </Text>
        </View>

        <View style={styles.right}>
          <Text style={styles.price}>{formatCurrency(quote.currentPrice)}</Text>
          <Text
            style={[
              styles.change,
              positive ? styles.positive : styles.negative,
            ]}
          >
            {formatSignedCurrency(quote.dailyChange)} · {formatPercent(quote.dailyChangePercent)}
          </Text>
        </View>
      </AppCard>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  left: {
    flex: 1,
    gap: 4,
  },
  right: {
    alignItems: 'flex-end',
    gap: 4,
  },
  symbol: {
    color: appTheme.colors.textPrimary,
    fontSize: appTheme.typography.heading,
    fontWeight: '800',
  },
  company: {
    color: appTheme.colors.textSecondary,
    fontSize: appTheme.typography.caption,
    maxWidth: 180,
  },
  price: {
    color: appTheme.colors.textPrimary,
    fontSize: appTheme.typography.heading,
    fontWeight: '700',
  },
  change: {
    fontSize: appTheme.typography.caption,
    fontWeight: '700',
  },
  positive: {
    color: appTheme.colors.positive,
  },
  negative: {
    color: appTheme.colors.negative,
  },
});
