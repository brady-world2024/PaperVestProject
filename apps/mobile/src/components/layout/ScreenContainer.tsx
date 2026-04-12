import { PropsWithChildren, ReactElement } from 'react';
import {
  RefreshControl,
  type RefreshControlProps,
  ScrollView,
  StyleProp,
  StyleSheet,
  View,
  ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { appTheme } from '../../theme';

type Props = PropsWithChildren<{
  scroll?: boolean;
  refreshControl?: ReactElement<RefreshControlProps>;
  contentStyle?: StyleProp<ViewStyle>;
}>;

export function ScreenContainer({
  children,
  scroll = true,
  refreshControl,
  contentStyle,
}: Props) {
  if (!scroll) {
    return (
      <SafeAreaView edges={['top']} style={styles.safeArea}>
        <View style={[styles.content, contentStyle]}>{children}</View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={['top']} style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={[styles.content, contentStyle]}
        refreshControl={refreshControl}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {children}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: appTheme.colors.background,
  },
  content: {
    gap: appTheme.spacing.lg,
    paddingHorizontal: appTheme.spacing.md,
    paddingBottom: appTheme.spacing.xxl,
  },
});
