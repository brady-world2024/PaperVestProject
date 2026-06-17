'use client';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import {
  loginFormSchema,
  type LoginFormValues,
} from '@papervest/validation';

import { AppButton, AppButtonLink } from '@/components/app-button';
import { AppCard } from '@/components/app-card';
import { AppField } from '@/components/app-field';
import { InlineNotice } from '@/components/inline-notice';
import { webApi } from '@/lib/api';
import { useAuthStore } from '@/state/auth-store';

export default function LoginPage() {
  const searchParams = useSearchParams();
  const completeAuth = useAuthStore((state) => state.completeAuth);
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginFormSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  });

  const loginMutation = useMutation({
    mutationFn: webApi.login,
    onSuccess: async (response) => {
      await completeAuth(response);
    },
  });

  return (
    <AppCard className="pv-auth-card">
      <h1 className="pv-section-title">Log in</h1>
      <p className="pv-section-subtitle">Use your web session to open the trading workspace.</p>

      {searchParams.get('passwordReset') === '1' ? (
        <div style={{ marginTop: '20px' }}>
          <InlineNotice tone="info" message="Password updated. Log in with your new password." />
        </div>
      ) : null}

      {searchParams.get('accountDeleted') === '1' ? (
        <div style={{ marginTop: '20px' }}>
          <InlineNotice tone="info" message="Account deleted and the web session was cleared." />
        </div>
      ) : null}

      <form
        className="pv-stack"
        style={{ marginTop: '20px' }}
        onSubmit={handleSubmit(async (values) => {
          await webApi.initializeCsrf();
          await loginMutation.mutateAsync({
            ...values,
            deviceName: 'PaperVest Web',
          });
        })}
      >
        {loginMutation.isError ? (
          <InlineNotice tone="error" message={webApi.getApiErrorMessage(loginMutation.error, 'Unable to log in')} />
        ) : null}

        <AppField
          label="Email"
          placeholder="you@example.com"
          autoComplete="email"
          error={errors.email?.message}
          {...register('email')}
        />
        <AppField
          label="Password"
          type="password"
          placeholder="SecurePass1"
          autoComplete="current-password"
          error={errors.password?.message}
          {...register('password')}
        />

        <div className="pv-auth-actions">
          <AppButton type="submit" loading={loginMutation.isPending}>
            Log in
          </AppButton>
          <AppButtonLink href="/register" variant="ghost">
            Create account
          </AppButtonLink>
          <AppButtonLink href="/forgot-password" variant="ghost">
            Forgot password
          </AppButtonLink>
        </div>
      </form>
    </AppCard>
  );
}
