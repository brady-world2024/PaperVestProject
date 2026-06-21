'use client';

import { useMemo, useRef, useState } from 'react';
import Link from 'next/link';
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
import {
  getTradeImpactPreview,
  getTradeQuantityPresets,
  type TradeSide,
} from '../lib/trade-impact';
import { formatCurrency } from '../lib/formatters';

type Props = {
  symbol: string;
  side: TradeSide;
  title: string;
  subtitle?: string;
  submitLabel: string;
  currentPrice: number;
  cashBalance: number;
  totalPortfolioValue: number;
  holdingQuantity: number;
  holdingAverageCost: number;
  holdingMarketValue: number;
  availableLabel: string;
  availableValue: string;
  supportLabel: string;
  supportValue: string;
  followThroughAction?: {
    href: string;
    label: string;
    copy: string;
  };
  buttonVariant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  pending: boolean;
  errorMessage?: string | null;
  successMessage?: string | null;
  externalBlockingMessage?: string | null;
  getBlockingMessage?: (quantity: number) => string | null;
  onSubmitQuantity: (quantity: number) => Promise<void>;
};

export function TradeOrderCard({
  symbol,
  side,
  title,
  subtitle,
  submitLabel,
  currentPrice,
  cashBalance,
  totalPortfolioValue,
  holdingQuantity,
  holdingAverageCost,
  holdingMarketValue,
  availableLabel,
  availableValue,
  supportLabel,
  supportValue,
  followThroughAction,
  buttonVariant = 'primary',
  pending,
  errorMessage,
  successMessage,
  externalBlockingMessage,
  getBlockingMessage,
  onSubmitQuantity,
}: Props) {
  const submitLockRef = useRef(false);
  const [submitLocked, setSubmitLocked] = useState(false);
  const {
    register,
    handleSubmit,
    setValue,
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
  const blockingMessage = externalBlockingMessage ?? getBlockingMessage?.(quantity) ?? null;
  const impact = useMemo(
    () =>
      getTradeImpactPreview({
        side,
        quantity,
        currentPrice,
        cashBalance,
        totalPortfolioValue,
        holdingQuantity,
        holdingAverageCost,
        holdingMarketValue,
      }),
    [
      cashBalance,
      currentPrice,
      holdingAverageCost,
      holdingMarketValue,
      holdingQuantity,
      quantity,
      side,
      totalPortfolioValue,
    ]
  );
  const presets = useMemo(
    () =>
      getTradeQuantityPresets({
        side,
        currentPrice,
        cashBalance,
        holdingQuantity,
      }),
    [cashBalance, currentPrice, holdingQuantity, side]
  );

  return (
    <AppCard className="pv-trade-ticket">
      <SectionHeader title={title} subtitle={subtitle} />
      <form
        className="pv-stack"
        onSubmit={handleSubmit(async ({ quantity: rawQuantity }) => {
          if (submitLockRef.current) {
            return;
          }

          const normalizedQuantity = normalizeTradeQuantity(rawQuantity);
          const nextBlockingMessage =
            externalBlockingMessage ?? getBlockingMessage?.(normalizedQuantity) ?? null;
          if (nextBlockingMessage) {
            return;
          }

          submitLockRef.current = true;
          setSubmitLocked(true);

          try {
            await onSubmitQuantity(normalizedQuantity);
            reset({ quantity: '1' });
          } finally {
            submitLockRef.current = false;
            setSubmitLocked(false);
          }
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

        {presets.length ? (
          <div className="pv-trade-presets">
            <span className="pv-kicker">Quick size</span>
            <div className="pv-trade-presets-row">
              {presets.map((preset) => (
                <button
                  key={`${side}-${preset.label}`}
                  className="pv-trade-preset"
                  type="button"
                  onClick={() => {
                    setValue('quantity', formatPresetQuantity(preset.quantity), {
                      shouldDirty: true,
                      shouldTouch: true,
                      shouldValidate: true,
                    });
                  }}
                >
                  <span>{preset.label}</span>
                  <strong>{formatPresetQuantity(preset.quantity)}</strong>
                </button>
              ))}
            </div>
          </div>
        ) : null}

        <div className="pv-trade-impact-shell">
          <div className="pv-trade-impact-head">
            <div className="pv-workspace-toolbar-copy">
              <strong>Impact preview</strong>
              <span>
                This preview uses the current backend quote for {symbol} and your live account state before the order is sent.
              </span>
            </div>
            <span className={`pv-chip ${side === 'BUY' ? 'buy' : 'sell'}`}>{side}</span>
          </div>

          <div className="pv-trade-impact-grid">
            <div className="pv-trade-impact-card">
              <span className="pv-metric-label">{side === 'BUY' ? 'Estimated total' : 'Estimated proceeds'}</span>
              <strong className="pv-trade-impact-value">{formatCurrency(impact.estimatedNotional)}</strong>
            </div>
            <div className="pv-trade-impact-card">
              <span className="pv-metric-label">Cash after</span>
              <strong className="pv-trade-impact-value">{formatCurrency(impact.estimatedCashAfter)}</strong>
            </div>
            <div className="pv-trade-impact-card">
              <span className="pv-metric-label">Shares after</span>
              <strong className="pv-trade-impact-value">{formatCompactQuantity(impact.estimatedSharesAfter)}</strong>
            </div>
            <div className="pv-trade-impact-card">
              <span className="pv-metric-label">Position weight</span>
              <strong className="pv-trade-impact-value">{formatImpactPercent(impact.estimatedPositionWeightAfter)}</strong>
            </div>
            <div className="pv-trade-impact-card">
              <span className="pv-metric-label">Position value after</span>
              <strong className="pv-trade-impact-value">{formatCurrency(impact.estimatedPositionValueAfter)}</strong>
            </div>
            <div className="pv-trade-impact-card">
              <span className="pv-metric-label">{side === 'BUY' ? 'Projected avg cost' : 'Est. realized P&amp;L'}</span>
              <strong
                className={
                  side === 'SELL' && (impact.estimatedRealizedPnl ?? 0) < 0
                    ? 'pv-trade-impact-value pv-negative'
                    : side === 'SELL'
                      ? 'pv-trade-impact-value pv-positive'
                      : 'pv-trade-impact-value'
                }
              >
                {side === 'BUY'
                  ? formatCurrency(impact.estimatedAverageCostAfter ?? 0)
                  : formatCurrency(impact.estimatedRealizedPnl ?? 0)}
              </strong>
            </div>
          </div>

          {impact.insight ? (
            <div className="pv-trade-guidance">
              <strong>{impact.insight.headline}</strong>
              <span>{impact.insight.copy}</span>
            </div>
          ) : null}

          <div className="pv-meta-row">
            <span className="pv-kicker">{availableLabel}</span>
            <strong>{availableValue}</strong>
          </div>
          <div className="pv-meta-row">
            <span className="pv-kicker">Cash allocation after</span>
            <strong>{formatImpactPercent(impact.estimatedCashWeightAfter)}</strong>
          </div>
          <div className="pv-meta-row">
            <span className="pv-kicker">{supportLabel}</span>
            <strong>{supportValue}</strong>
          </div>
        </div>

        <AppButton
          type="submit"
          variant={buttonVariant}
          loading={pending || submitLocked}
          disabled={Boolean(blockingMessage) || currentPrice <= 0 || submitLocked}
        >
          {submitLabel}
        </AppButton>

        {followThroughAction ? (
          <Link className="pv-trade-followthrough" href={followThroughAction.href}>
            <strong>{followThroughAction.label}</strong>
            <span>{followThroughAction.copy}</span>
          </Link>
        ) : null}
      </form>
    </AppCard>
  );
}

function formatPresetQuantity(value: number) {
  const fixed = value.toFixed(4);
  return fixed.replace(/\.?0+$/, '');
}

function formatCompactQuantity(value: number) {
  return new Intl.NumberFormat('en-US', {
    maximumFractionDigits: 4,
  }).format(value);
}

function formatImpactPercent(value: number) {
  return `${value.toFixed(1)}%`;
}
