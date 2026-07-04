'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import {
  cashFlowFormSchema,
  changePasswordFormSchema,
  deleteAccountFormSchema,
  normalizeCashFlowAmount,
  type CashFlowFormValues,
  type ChangePasswordFormValues,
  type DeleteAccountFormValues,
} from '@papervest/validation';
import type { CashFlowEntryType } from '@papervest/shared-types';

import { AppButton, AppButtonLink } from '@/components/app-button';
import { AppCard } from '@/components/app-card';
import { AppField } from '@/components/app-field';
import { CashFlowPanel } from '@/components/cash-flow-panel';
import { InlineNotice } from '@/components/inline-notice';
import { MetricCard } from '@/components/metric-card';
import { SectionHeader } from '@/components/section-header';
import { webApi } from '@/lib/api';
import { formatDateTime } from '@/lib/formatters';
import { queryKeys } from '@/lib/query-keys';
import { useAuthStore } from '@/state/auth-store';

export default function AccountPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const completeAuth = useAuthStore((state) => state.completeAuth);
  const clearSession = useAuthStore((state) => state.clearSession);
  const [verificationNotice, setVerificationNotice] = useState<string | null>(null);
  const [changePasswordNotice, setChangePasswordNotice] = useState<string | null>(null);
  const [cashFlowMode, setCashFlowMode] = useState<CashFlowEntryType>('DEPOSIT');
  const [cashFlowNotice, setCashFlowNotice] = useState<string | null>(null);

  const accountQuery = useQuery({
    queryKey: queryKeys.accountProfile,
    queryFn: webApi.getAccountProfile,
  });

  const portfolioQuery = useQuery({
    queryKey: queryKeys.portfolio,
    queryFn: webApi.getPortfolio,
  });

  const cashFlowsQuery = useQuery({
    queryKey: queryKeys.cashFlows,
    queryFn: webApi.getCashFlows,
  });

  const cashFlowForm = useForm<CashFlowFormValues>({
    resolver: zodResolver(cashFlowFormSchema),
    defaultValues: {
      amount: '',
      memo: '',
    },
  });

  const changePasswordForm = useForm<ChangePasswordFormValues>({
    resolver: zodResolver(changePasswordFormSchema),
    defaultValues: {
      currentPassword: '',
      newPassword: '',
      confirmNewPassword: '',
    },
  });

  const deleteAccountForm = useForm<DeleteAccountFormValues>({
    resolver: zodResolver(deleteAccountFormSchema),
    defaultValues: {
      currentPassword: '',
    },
  });

  const sendVerificationMutation = useMutation({
    mutationFn: async () => {
      await webApi.initializeCsrf();
      await webApi.requestEmailVerification();
    },
    onSuccess: () => {
      setVerificationNotice('A fresh verification link was issued. Check the backend logs for this environment.');
    },
  });

  const changePasswordMutation = useMutation({
    mutationFn: async (values: ChangePasswordFormValues) => {
      await webApi.initializeCsrf();
      return webApi.changePassword({
        ...values,
        deviceName: 'PaperVest Web',
      });
    },
    onSuccess: async (response) => {
      await completeAuth(response);
      await queryClient.invalidateQueries({ queryKey: queryKeys.notifications });
      changePasswordForm.reset();
      setChangePasswordNotice('Password updated. Older sessions were revoked and this browser received a fresh session.');
    },
  });

  const cashFlowMutation = useMutation({
    mutationFn: async (values: CashFlowFormValues) => {
      await webApi.initializeCsrf();
      const idempotencyKey = `cash-flow-${cashFlowMode.toLowerCase()}-${Date.now()}`;
      const payload = {
        amount: normalizeCashFlowAmount(values.amount),
        memo: values.memo || null,
      };
      return cashFlowMode === 'DEPOSIT'
        ? webApi.depositCash(payload, idempotencyKey)
        : webApi.withdrawCash(payload, idempotencyKey);
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

  const deleteAccountMutation = useMutation({
    mutationFn: async (values: DeleteAccountFormValues) => {
      await webApi.initializeCsrf();
      await webApi.deleteAccount(values);
    },
    onSuccess: async () => {
      queryClient.clear();
      await clearSession();
      router.replace('/login?accountDeleted=1');
    },
  });

  const profile = accountQuery.data;
  const cashFlowErrorMessage = cashFlowMutation.isError
    ? webApi.getApiErrorMessage(cashFlowMutation.error, 'Unable to record cash movement')
    : cashFlowsQuery.isError
      ? webApi.getApiErrorMessage(cashFlowsQuery.error, 'Unable to load cash flows')
      : portfolioQuery.isError
        ? webApi.getApiErrorMessage(portfolioQuery.error, 'Unable to load portfolio cash')
        : null;

  return (
    <main className="pv-page pv-stack">
      <section className="pv-account-hero">
        <AppCard className="strong pv-account-hero-card">
          <div className="pv-eyebrow">Identity and access</div>
          <h1 className="pv-title">Account center</h1>
          <p className="pv-copy inverse">
            Manage verification state, rotate your password, and control the account lifecycle from one place.
          </p>

          {accountQuery.isError ? (
            <InlineNotice
              tone="error"
              message={webApi.getApiErrorMessage(accountQuery.error, 'Unable to load account profile')}
            />
          ) : (
            <div className="pv-dashboard-summary-grid">
              <MetricCard label="Email" value={profile?.email ?? '...'} />
              <MetricCard
                label="Verification"
                value={profile ? (profile.emailVerified ? 'Verified' : 'Pending') : '...'}
                tone={profile?.emailVerified ? 'positive' : undefined}
              />
              <MetricCard label="Joined" value={profile ? formatDateTime(profile.createdAt) : '...'} />
              <MetricCard
                label="Last verification"
                value={profile?.emailVerifiedAt ? formatDateTime(profile.emailVerifiedAt) : 'Not yet verified'}
              />
            </div>
          )}
        </AppCard>

        <AppCard className="pv-account-sidecard">
          <SectionHeader
            title="Lifecycle checklist"
            subtitle="The first production-grade account slice."
          />
          <div className="pv-meta-row">
            <span className="pv-kicker">Email verification</span>
            <strong>{profile?.emailVerified ? 'Confirmed' : 'Resend available'}</strong>
          </div>
          <div className="pv-meta-row">
            <span className="pv-kicker">Password reset</span>
            <strong>One-time token flow</strong>
          </div>
          <div className="pv-meta-row">
            <span className="pv-kicker">Session hygiene</span>
            <strong>Refresh tokens revoked on rotation</strong>
          </div>
          <div className="pv-action-cluster" style={{ marginTop: '18px' }}>
            <AppButtonLink href="/dashboard" variant="ghost">
              Dashboard
            </AppButtonLink>
            <AppButtonLink href="/portfolio" variant="secondary">
              Portfolio
            </AppButtonLink>
          </div>
        </AppCard>
      </section>

      <section className="pv-account-grid">
        <AppCard>
          <CashFlowPanel
            portfolio={portfolioQuery.data}
            cashFlows={cashFlowsQuery.data?.cashFlows ?? []}
            mode={cashFlowMode}
            amount={cashFlowForm.watch('amount')}
            memo={cashFlowForm.watch('memo') ?? ''}
            amountError={cashFlowForm.formState.errors.amount?.message}
            memoError={cashFlowForm.formState.errors.memo?.message}
            submitting={cashFlowMutation.isPending}
            loading={cashFlowsQuery.isLoading || portfolioQuery.isLoading}
            notice={cashFlowNotice}
            errorMessage={cashFlowErrorMessage}
            onModeChange={(mode) => {
              setCashFlowMode(mode);
              setCashFlowNotice(null);
            }}
            onAmountChange={(value) => cashFlowForm.setValue('amount', value, { shouldValidate: true })}
            onMemoChange={(value) => cashFlowForm.setValue('memo', value, { shouldValidate: true })}
            onSubmit={() => {
              setCashFlowNotice(null);
              void cashFlowForm.handleSubmit(async (values) => {
                await cashFlowMutation.mutateAsync(values);
              })();
            }}
          />
        </AppCard>

        <AppCard>
          <SectionHeader
            title="Email verification"
            subtitle="Verification is separate from session auth so lifecycle controls can evolve cleanly."
          />

          {profile ? (
            <div className="pv-stack">
              <div className="pv-account-identity">
                <span className="pv-kicker">Primary email</span>
                <strong>{profile.email}</strong>
                <span className={`pv-chip ${profile.emailVerified ? 'buy' : 'danger'}`}>
                  {profile.emailVerified ? 'Verified' : 'Verification pending'}
                </span>
              </div>

              {!profile.emailVerified ? (
                <>
                  {sendVerificationMutation.isError ? (
                    <InlineNotice
                      tone="error"
                      message={webApi.getApiErrorMessage(sendVerificationMutation.error, 'Unable to issue a new verification link')}
                    />
                  ) : verificationNotice ? (
                    <InlineNotice tone="info" message={verificationNotice} />
                  ) : (
                    <InlineNotice
                      tone="info"
                      message="Verification links are logged by the backend message service in this environment."
                    />
                  )}

                  <div className="pv-auth-actions">
                    <AppButton
                      onClick={() => {
                        setVerificationNotice(null);
                        void sendVerificationMutation.mutateAsync();
                      }}
                      loading={sendVerificationMutation.isPending}
                    >
                      Resend verification
                    </AppButton>
                  </div>
                </>
              ) : (
                <InlineNotice
                  tone="info"
                  message={`Email verified at ${formatDateTime(profile.emailVerifiedAt ?? profile.createdAt)}.`}
                />
              )}
            </div>
          ) : accountQuery.isLoading ? (
            <div className="pv-subgrid">
              <div className="pv-skeleton" />
            </div>
          ) : null}
        </AppCard>

        <AppCard>
          <SectionHeader
            title="Change password"
            subtitle="Rotates credentials and invalidates older refresh-token sessions."
          />

          <form
            className="pv-stack"
            onSubmit={changePasswordForm.handleSubmit(async (values) => {
              setChangePasswordNotice(null);
              await changePasswordMutation.mutateAsync(values);
            })}
          >
            {changePasswordMutation.isError ? (
              <InlineNotice
                tone="error"
                message={webApi.getApiErrorMessage(changePasswordMutation.error, 'Unable to change password')}
              />
            ) : changePasswordNotice ? (
              <InlineNotice tone="info" message={changePasswordNotice} />
            ) : null}

            <AppField
              label="Current password"
              type="password"
              autoComplete="current-password"
              error={changePasswordForm.formState.errors.currentPassword?.message}
              {...changePasswordForm.register('currentPassword')}
            />
            <AppField
              label="New password"
              type="password"
              autoComplete="new-password"
              error={changePasswordForm.formState.errors.newPassword?.message}
              {...changePasswordForm.register('newPassword')}
            />
            <AppField
              label="Confirm new password"
              type="password"
              autoComplete="new-password"
              error={changePasswordForm.formState.errors.confirmNewPassword?.message}
              {...changePasswordForm.register('confirmNewPassword')}
            />

            <div className="pv-auth-actions">
              <AppButton type="submit" loading={changePasswordMutation.isPending}>
                Update password
              </AppButton>
            </div>
          </form>
        </AppCard>
      </section>

      <section className="pv-account-danger-zone">
        <AppCard className="pv-account-danger-card">
          <SectionHeader
            title="Delete account"
            subtitle="This removes the user and cascades trades, holdings, watchlist items, and tokens."
          />

          <form
            className="pv-stack"
            onSubmit={deleteAccountForm.handleSubmit(async (values) => {
              await deleteAccountMutation.mutateAsync(values);
            })}
          >
            {deleteAccountMutation.isError ? (
              <InlineNotice
                tone="error"
                message={webApi.getApiErrorMessage(deleteAccountMutation.error, 'Unable to delete the account')}
              />
            ) : (
              <InlineNotice
                tone="info"
                message="Use this carefully. The current implementation performs a full hard delete for lifecycle completeness."
              />
            )}

            <AppField
              label="Current password"
              type="password"
              autoComplete="current-password"
              error={deleteAccountForm.formState.errors.currentPassword?.message}
              {...deleteAccountForm.register('currentPassword')}
            />

            <div className="pv-auth-actions">
              <AppButton type="submit" variant="danger" loading={deleteAccountMutation.isPending}>
                Delete account
              </AppButton>
            </div>
          </form>
        </AppCard>
      </section>
    </main>
  );
}
