'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'next/navigation';
import { Suspense, useEffect } from 'react';

import { AppButtonLink } from '@/components/app-button';
import { AppCard } from '@/components/app-card';
import { BrandLogo } from '@/components/brand-logo';
import { InlineNotice } from '@/components/inline-notice';
import { webApi } from '@/lib/api';
import { queryKeys } from '@/lib/query-keys';
import { useAuthStore } from '@/state/auth-store';

function VerifyEmailContent() {
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const authStatus = useAuthStore((state) => state.status);
  const token = searchParams.get('token')?.trim() ?? '';

  const confirmMutation = useMutation({
    mutationFn: async (verificationToken: string) => {
      await webApi.initializeCsrf();
      return webApi.confirmEmailVerification({ token: verificationToken });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.accountProfile });
    },
  });

  useEffect(() => {
    if (!token || confirmMutation.isPending || confirmMutation.isSuccess || confirmMutation.isError) {
      return;
    }

    void confirmMutation.mutateAsync(token);
  }, [confirmMutation, token]);

  return (
    <div className="pv-auth-wrap">
      <div className="pv-auth-shell">
        <BrandLogo size="auth" priority />
        <AppCard className="pv-auth-card">
          <h1 className="pv-section-title">Verify email</h1>
          <p className="pv-section-subtitle">
            Confirmation uses a one-time token and updates account state without depending on an active browser session.
          </p>

          <div className="pv-stack" style={{ marginTop: '20px' }}>
            {!token ? (
              <InlineNotice tone="error" message="Verification link is missing a token. Request a fresh link from the account page." />
            ) : confirmMutation.isPending ? (
              <InlineNotice tone="info" message="Checking your verification token..." />
            ) : confirmMutation.isError ? (
              <InlineNotice
                tone="error"
                message={webApi.getApiErrorMessage(confirmMutation.error, 'Unable to verify that email')}
              />
            ) : confirmMutation.data ? (
              <InlineNotice
                tone="info"
                message={`Email verified for ${confirmMutation.data.email}. Your account can now be treated as confirmed.`}
              />
            ) : null}

            <div className="pv-auth-actions">
              <AppButtonLink href={authStatus === 'authenticated' ? '/account' : '/login'} variant="secondary">
                {authStatus === 'authenticated' ? 'Open account center' : 'Go to login'}
              </AppButtonLink>
              <AppButtonLink href="/dashboard" variant="ghost">
                Dashboard
              </AppButtonLink>
            </div>
          </div>
        </AppCard>
      </div>
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense
      fallback={
        <div className="pv-auth-wrap">
          <div className="pv-auth-shell">
            <BrandLogo size="auth" priority />
            <AppCard className="pv-auth-card">
              <h1 className="pv-section-title">Verify email</h1>
              <p className="pv-section-subtitle">Loading verification details...</p>
              <div className="pv-stack" style={{ marginTop: '20px' }}>
                <InlineNotice tone="info" message="Preparing the verification flow..." />
              </div>
            </AppCard>
          </div>
        </div>
      }
    >
      <VerifyEmailContent />
    </Suspense>
  );
}
