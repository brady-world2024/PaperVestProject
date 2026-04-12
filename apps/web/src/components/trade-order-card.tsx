'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import {
  normalizeTradeQuantity,
  tradeFormSchema,
  type TradeFormValues,
} from '@papervest/validation';

import { AppButton } from './app-button';
import { AppCard } from './app-card';
import { AppField } from './app-field';
import { InlineNotice } from './inline-notice';
import { SectionHeader } from './section-header';
import { formatCurrency } from '@/lib/formatters';

type Props = {
  title: string;
  subtitle?: string;
  submitLabel: string;
  currentPrice: number;
  availableLabel: string;
  availableValue: string;
  estimateLabel: string;
  supportLabel: string;
  supportValue: string;
  buttonVariant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  pending: boolean;
  errorMessage?: string | null;
  successMessage?: string | null;
  getBlockingMessage?: (quantity: number) => string | null;
  onSubmitQuantity: (quantity: number) => Promise<void>;
};

export function TradeOrderCard({
  title,
  subtitle,
  submitLabel,
  currentPrice,
  availableLabel,
  availableValue,
  estimateLabel,
  supportLabel,
  supportValue,
  buttonVariant = 'primary',
  pending,
  errorMessage,
  successMessage,
  getBlockingMessage,
  onSubmitQuantity,
}: Props) {
  const {
    register,
    handleSubmit,
    watch,
    reset,
    formState: { errors },
  } = useForm<TradeFormValues>({
    resolver: zodResolver(tradeFormSchema),
    defaultValues: {
      quantity: '1',
    },
  });

  const quantity = normalizeTradeQuantity(watch('quantity') || '0');
  const estimatedValue = quantity * currentPrice;
  const blockingMessage = getBlockingMessage?.(quantity) ?? null;

  return (
    <AppCard>
      <SectionHeader title={title} subtitle={subtitle} />
      <form
        className="pv-stack"
        onSubmit={handleSubmit(async ({ quantity: rawQuantity }) => {
          const normalizedQuantity = normalizeTradeQuantity(rawQuantity);
          const nextBlockingMessage = getBlockingMessage?.(normalizedQuantity) ?? null;
          if (nextBlockingMessage) {
            return;
          }

          await onSubmitQuantity(normalizedQuantity);
          reset({ quantity: '1' });
        })}
      >
        {errorMessage ? <InlineNotice tone="error" message={errorMessage} /> : null}
        {blockingMessage ? <InlineNotice tone="error" message={blockingMessage} /> : null}
        {successMessage ? <InlineNotice tone="info" message={successMessage} /> : null}

        <AppField
          label="Quantity"
          placeholder="1"
          inputMode="decimal"
          error={errors.quantity?.message}
          {...register('quantity')}
        />

        <div className="pv-card pv-surface-card">
          <div className="pv-meta-row">
            <span className="pv-kicker">{availableLabel}</span>
            <strong>{availableValue}</strong>
          </div>
          <div className="pv-meta-row">
            <span className="pv-kicker">{estimateLabel}</span>
            <strong>{formatCurrency(estimatedValue || 0)}</strong>
          </div>
          <div className="pv-meta-row">
            <span className="pv-kicker">{supportLabel}</span>
            <strong>{supportValue}</strong>
          </div>
        </div>

        <AppButton
          type="submit"
          variant={buttonVariant}
          loading={pending}
          disabled={Boolean(blockingMessage) || currentPrice <= 0}
        >
          {submitLabel}
        </AppButton>
      </form>
    </AppCard>
  );
}
