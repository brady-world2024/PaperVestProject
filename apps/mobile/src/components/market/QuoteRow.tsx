import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Quote } from '../../services/api/types';
import { appTheme } from '../../theme';
import { formatCurrency, formatMarketTimestamp, formatPercent, formatSignedCurrency } from '../../utils/formatters';
import { describeMarketSession } from '../../utils/marketSession';
import { AppCard } from '../common/AppCard';
import { MarketSessionBadge } from './MarketSessionBadge';

type Props = {
  quote: Quote;
  onPress?: () => void;
};

export function QuoteRow({ quote, onPress }: Props) {
  const positive = quote.dailyChange >= 0;
  const marketSession = describeMarketSession(quote.marketSession);

  return (
    <Pressable onPress={onPress}>
      <AppCard style={styles.card}>
        <View style={styles.left}>
          <View style={styles.symbolRow}>
            <Text style={styles.symbol}>{quote.symbol}</Text>
            <MarketSessionBadge session={quote.marketSession} />
          </View>
          <Text numberOfLines={1} style={styles.company}>
            {quote.companyName}
          </Text>
          <Text style={styles.meta}>{marketSession.priceLabel}</Text>
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
          <Text style={styles.meta}>{marketSession.changeLabel}</Text>
          <Text style={styles.meta}>
            {formatMarketTimestamp(quote.quoteTimestamp, quote.marketTimezone)}
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
  symbolRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  right: {
    alignItems: 'flex-end',
    gap: 4,
    flexShrink: 1,
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
  meta: {
    color: appTheme.colors.textSecondary,
    fontSize: appTheme.typography.micro,
    textAlign: 'right',
  },
  positive: {
    color: appTheme.colors.positive,
  },
  negative: {
    color: appTheme.colors.negative,
  },
});
