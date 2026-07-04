import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useNavigation } from '@react-navigation/native';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Alert, StyleSheet, Text, View } from 'react-native';
import type { CashFlowEntryType } from '@papervest/shared-types';
import {
  cashFlowFormSchema,
  normalizeCashFlowAmount,
  type CashFlowFormValues,
} from '@papervest/validation';

import { AppStackParamList } from '../../navigation/RootNavigator';
import { AppButton } from '../../components/common/AppButton';
import { AppCard } from '../../components/common/AppCard';
import { CashFlowCard } from '../../components/account/CashFlowCard';
import { ScreenContainer } from '../../components/layout/ScreenContainer';
import { SectionHeader } from '../../components/layout/SectionHeader';
import { getApiErrorMessage } from '../../services/api/client';
import {
  depositCash,
  getCashFlows,
  getPortfolio,
  logout,
  withdrawCash,
} from '../../services/api/papervestApi';
import { env } from '../../services/api/env';
import { queryKeys } from '../../services/api/queryKeys';
import { useAuthStore } from '../../state/authStore';
import { appTheme } from '../../theme';

export function AccountScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<AppStackParamList>>();
  const queryClient = useQueryClient();
  const session = useAuthStore((state) => state.session);
  const signOut = useAuthStore((state) => state.signOut);
  const [cashFlowMode, setCashFlowMode] = useState<CashFlowEntryType>('DEPOSIT');
  const [cashFlowNotice, setCashFlowNotice] = useState<string | null>(null);

  const portfolioQuery = useQuery({
    queryKey: queryKeys.portfolio,
    queryFn: getPortfolio,
  });

  const cashFlowsQuery = useQuery({
    queryKey: queryKeys.cashFlows,
    queryFn: getCashFlows,
  });

  const cashFlowForm = useForm<CashFlowFormValues>({
    resolver: zodResolver(cashFlowFormSchema),
    defaultValues: {
      amount: '',
      memo: '',
    },
  });

  const cashFlowMutation = useMutation({
    mutationFn: async (values: CashFlowFormValues) => {
      const idempotencyKey = `mobile-cash-flow-${cashFlowMode.toLowerCase()}-${Date.now()}`;
      const payload = {
        amount: normalizeCashFlowAmount(values.amount),
        memo: values.memo || null,
      };
      return cashFlowMode === 'DEPOSIT'
        ? depositCash(payload, idempotencyKey)
        : withdrawCash(payload, idempotencyKey);
    },
    onSuccess: async () => {
      cashFlowForm.reset({
        amount: '',
        memo: '',
      });
      setCashFlowNotice(cashFlowMode === 'DEPOSIT' ? 'Simulated deposit recorded.' : 'Simulated withdrawal recorded.');
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.cashFlows }),
        queryClient.invalidateQueries({ queryKey: queryKeys.portfolio }),
        queryClient.invalidateQueries({ queryKey: queryKeys.portfolioPerformanceRoot }),
      ]);
    },
  });

  const handleSignOut = () => {
    Alert.alert('Sign out?', 'This will clear your local session from the app.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out',
        style: 'destructive',
        onPress: () => {
          void (async () => {
            try {
              if (session?.refreshToken) {
                await logout(session.refreshToken);
              }
            } catch {
              // Ignore logout transport failures and still clear local auth state.
            } finally {
              queryClient.clear();
              await signOut();
            }
          })();
        },
      },
    ]);
  };

  const submitCashFlow = cashFlowForm.handleSubmit(async (values) => {
    setCashFlowNotice(null);
    await cashFlowMutation.mutateAsync(values);
  });

  const cashFlowErrorMessage = cashFlowMutation.isError
    ? getApiErrorMessage(cashFlowMutation.error, 'Unable to record cash movement')
    : cashFlowsQuery.isError
      ? getApiErrorMessage(cashFlowsQuery.error, 'Unable to load cash flows')
      : portfolioQuery.isError
        ? getApiErrorMessage(portfolioQuery.error, 'Unable to load portfolio cash')
        : null;

  return (
    <ScreenContainer contentStyle={styles.content}>
      <SectionHeader
        title="Account"
        subtitle="Session details and environment information for your local build."
      />

      <AppCard>
        <Text style={styles.label}>Signed in as</Text>
        <Text style={styles.value}>{session?.user.email ?? 'Unknown user'}</Text>
      </AppCard>

      <AppCard>
        <Text style={styles.label}>API base URL</Text>
        <Text style={styles.url}>{env.apiBaseUrl}</Text>
        <Text style={styles.caption}>
          Change `EXPO_PUBLIC_API_BASE_URL` in `apps/mobile/.env` when testing on a simulator or device.
        </Text>
      </AppCard>

      <CashFlowCard
        portfolio={portfolioQuery.data}
        cashFlows={cashFlowsQuery.data?.cashFlows ?? []}
        mode={cashFlowMode}
        amount={cashFlowForm.watch('amount')}
        memo={cashFlowForm.watch('memo') ?? ''}
        amountError={cashFlowForm.formState.errors.amount?.message}
        memoError={cashFlowForm.formState.errors.memo?.message}
        loading={cashFlowsQuery.isLoading || portfolioQuery.isLoading}
        submitting={cashFlowMutation.isPending}
        notice={cashFlowNotice}
        errorMessage={cashFlowErrorMessage}
        onModeChange={(mode) => {
          setCashFlowMode(mode);
          setCashFlowNotice(null);
        }}
        onAmountChange={(value) => cashFlowForm.setValue('amount', value, { shouldValidate: true })}
        onMemoChange={(value) => cashFlowForm.setValue('memo', value, { shouldValidate: true })}
        onSubmit={() => {
          void submitCashFlow();
        }}
      />

      <View style={styles.buttonArea}>
        <AppButton
          label="Target Orders"
          onPress={() => navigation.navigate('Orders')}
          variant="secondary"
        />
      </View>

      <View style={styles.buttonArea}>
        <AppButton label="Sign Out" onPress={handleSignOut} variant="danger" />
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingTop: appTheme.spacing.md,
  },
  label: {
    color: appTheme.colors.textSecondary,
    fontSize: appTheme.typography.caption,
    fontWeight: '700',
  },
  value: {
    marginTop: appTheme.spacing.xs,
    color: appTheme.colors.textPrimary,
    fontSize: appTheme.typography.heading,
    fontWeight: '800',
  },
  url: {
    marginTop: appTheme.spacing.xs,
    color: appTheme.colors.textPrimary,
    fontSize: appTheme.typography.body,
    fontWeight: '700',
  },
  caption: {
    marginTop: appTheme.spacing.sm,
    color: appTheme.colors.textSecondary,
    fontSize: appTheme.typography.caption,
    lineHeight: 18,
  },
  buttonArea: {
    marginTop: appTheme.spacing.md,
  },
});
