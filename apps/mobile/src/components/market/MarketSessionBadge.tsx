import { StyleSheet, Text, View } from 'react-native';
import type { MarketSessionState } from '@papervest/shared-types';

import { describeMarketSession, getMarketSessionTone } from '../../utils/marketSession';
import { appTheme } from '../../theme';

type Props = {
  session: MarketSessionState;
};

export function MarketSessionBadge({ session }: Props) {
  const tone = getMarketSessionTone(session);
  const presentation = describeMarketSession(session);

  return (
    <View
      style={[
        styles.base,
        tone === 'open' ? styles.open : tone === 'extended' ? styles.extended : styles.closed,
      ]}
    >
      <Text
        style={[
          styles.label,
          tone === 'open'
            ? styles.openText
            : tone === 'extended'
              ? styles.extendedText
              : styles.closedText,
        ]}
      >
        {presentation.statusLabel}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: appTheme.radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  open: {
    backgroundColor: appTheme.colors.positiveSoft,
  },
  extended: {
    backgroundColor: '#D8E5F0',
  },
  closed: {
    backgroundColor: appTheme.colors.surfaceMuted,
  },
  label: {
    fontSize: appTheme.typography.micro,
    fontWeight: '800',
  },
  openText: {
    color: appTheme.colors.positive,
  },
  extendedText: {
    color: '#1F4460',
  },
  closedText: {
    color: appTheme.colors.textPrimary,
  },
});
