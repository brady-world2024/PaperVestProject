import { useEffect, useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { Controller, useForm } from 'react-hook-form';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import {
  conditionalOrderFormSchema,
  normalizeConditionalOrderNumber,
  type ConditionalOrderFormValues,
} from '@papervest/validation';

import type { CreateConditionalOrderPayload, TradeSide } from '../../services/api/types';
import { appTheme } from '../../theme';
import { AppButton } from '../common/AppButton';
import { InlineNotice } from '../feedback/InlineNotice';
import { AppTextField } from '../form/AppTextField';

type Props = {
  initialSymbol?: string;
  initialSide?: TradeSide;
  busy?: boolean;
  errorMessage?: string | null;
  onSubmitOrder: (payload: CreateConditionalOrderPayload) => Promise<void>;
};

export function ConditionalOrderComposer({
  initialSymbol = '',
  initialSide = 'BUY',
  busy = false,
  errorMessage,
  onSubmitOrder,
}: Props) {
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const {
    control,
    handleSubmit,
    setValue,
    reset,
    watch,
    formState: { errors },
  } = useForm<ConditionalOrderFormValues>({
    resolver: zodResolver(conditionalOrderFormSchema),
    defaultValues: {
      symbol: initialSymbol,
      side: initialSide,
      targetPrice: '',
      quantity: '1',
    },
  });

  const selectedSide = watch('side');

  useEffect(() => {
    if (initialSymbol) {
      setValue('symbol', initialSymbol);
    }
    setValue('side', initialSide);
  }, [initialSide, initialSymbol, setValue]);

  const onSubmit = handleSubmit(async (values) => {
    setSuccessMessage(null);

    const payload: CreateConditionalOrderPayload = {
      symbol: values.symbol.trim().toUpperCase(),
      side: values.side,
      targetPrice: normalizeConditionalOrderNumber(values.targetPrice),
      quantity: normalizeConditionalOrderNumber(values.quantity),
    };

    try {
      await onSubmitOrder(payload);
      reset({
        symbol: payload.symbol,
        side: payload.side,
        targetPrice: '',
        quantity: '1',
      });
      setSuccessMessage('Conditional order created.');
    } catch {
      setSuccessMessage(null);
    }
  });

  return (
    <View style={styles.container}>
      {errorMessage ? <InlineNotice tone="error" message={errorMessage} /> : null}
      {successMessage ? <InlineNotice message={successMessage} /> : null}

      <Controller
        control={control}
        name="symbol"
        render={({ field: { onBlur, onChange, value } }) => (
          <AppTextField
            label="Symbol"
            value={value}
            onBlur={onBlur}
            onChangeText={(nextValue) => {
              setSuccessMessage(null);
              onChange(nextValue.toUpperCase());
            }}
            placeholder="AAPL"
            autoCapitalize="characters"
            autoCorrect={false}
            error={errors.symbol?.message}
          />
        )}
      />

      <Controller
        control={control}
        name="side"
        render={({ field: { onChange, value } }) => (
          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>Side</Text>
            <View style={styles.segmentedControl}>
              {(['BUY', 'SELL'] as const).map((option) => {
                const active = option === value;
                return (
                  <Pressable
                    key={option}
                    accessibilityRole="button"
                    onPress={() => {
                      setSuccessMessage(null);
                      onChange(option);
                    }}
                    style={[styles.segment, active && styles.segmentActive]}
                  >
                    <Text style={[styles.segmentLabel, active && styles.segmentLabelActive]}>
                      {option}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        )}
      />

      <Controller
        control={control}
        name="targetPrice"
        render={({ field: { onBlur, onChange, value } }) => (
          <AppTextField
            label={
              selectedSide === 'BUY'
                ? 'Buy when price is at or below'
                : 'Sell when price is at or above'
            }
            value={value}
            onBlur={onBlur}
            onChangeText={(nextValue) => {
              setSuccessMessage(null);
              onChange(nextValue);
            }}
            keyboardType="decimal-pad"
            placeholder="100.00"
            error={errors.targetPrice?.message}
          />
        )}
      />

      <Controller
        control={control}
        name="quantity"
        render={({ field: { onBlur, onChange, value } }) => (
          <AppTextField
            label="Quantity"
            value={value}
            onBlur={onBlur}
            onChangeText={(nextValue) => {
              setSuccessMessage(null);
              onChange(nextValue);
            }}
            keyboardType="decimal-pad"
            placeholder="1"
            error={errors.quantity?.message}
          />
        )}
      />

      <AppButton
        label="Create conditional order"
        onPress={() => {
          void onSubmit();
        }}
        loading={busy}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: appTheme.spacing.md,
  },
  fieldGroup: {
    gap: appTheme.spacing.xs,
  },
  fieldLabel: {
    color: appTheme.colors.textPrimary,
    fontSize: appTheme.typography.caption,
    fontWeight: '700',
  },
  segmentedControl: {
    flexDirection: 'row',
    borderRadius: appTheme.radius.pill,
    backgroundColor: appTheme.colors.surfaceMuted,
    padding: 4,
    gap: 4,
  },
  segment: {
    flex: 1,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: appTheme.radius.pill,
  },
  segmentActive: {
    backgroundColor: appTheme.colors.surfaceStrong,
  },
  segmentLabel: {
    color: appTheme.colors.textSecondary,
    fontSize: appTheme.typography.body,
    fontWeight: '700',
  },
  segmentLabelActive: {
    color: appTheme.colors.textInverse,
  },
});
