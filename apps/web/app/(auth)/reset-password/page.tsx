'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { useRouter, useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import {
  resetPasswordFormSchema,
  type ResetPasswordFormValues,
} from '@papervest/validation';

import { AppButton, AppButtonLink } from '@/components/app-button';
import { AppCard } from '@/components/app-card';
import { AppField } from '@/components/app-field';
import { InlineNotice } from '@/components/inline-notice';
import { webApi } from '@/lib/api';

export default function ResetPasswordPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token')?.trim() ?? '';
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ResetPasswordFormValues>({
    resolver: zodResolver(resetPasswordFormSchema),
    defaultValues: {
      password: '',
      confirmPassword: '',
    },
  });

  const resetPasswordMutation = useMutation({
    mutationFn: webApi.resetPassword,
    onSuccess: () => {
      router.replace('/login?passwordReset=1');
    },
  });

  return (
    <AppCard className="pv-auth-card">
      <h1 className="pv-section-title">Choose a new password</h1>
      <p className="pv-section-subtitle">
        This consumes a one-time reset token and revokes older refresh-token sessions.
      </p>

      {!token ? (
        <div style={{ marginTop: '20px' }} className="pv-stack">
          <InlineNotice tone="error" message="Reset link is missing a token. Request a fresh password reset link." />
          <div className="pv-auth-actions">
            <AppButtonLink href="/forgot-password" variant="ghost">
              Request new link
            </AppButtonLink>
          </div>
        </div>
      ) : (
        <form
          className="pv-stack"
          style={{ marginTop: '20px' }}
          onSubmit={handleSubmit(async (values) => {
            await webApi.initializeCsrf();
            await resetPasswordMutation.mutateAsync({
              token,
              ...values,
            });
          })}
        >
          {resetPasswordMutation.isError ? (
            <InlineNotice
              tone="error"
              message={webApi.getApiErrorMessage(resetPasswordMutation.error, 'Unable to reset your password')}
            />
          ) : null}

          <AppField
            label="New password"
            type="password"
            placeholder="SecurePass1"
            autoComplete="new-password"
            error={errors.password?.message}
            {...register('password')}
          />
          <AppField
            label="Confirm new password"
            type="password"
            placeholder="SecurePass1"
            autoComplete="new-password"
            error={errors.confirmPassword?.message}
            {...register('confirmPassword')}
          />

          <div className="pv-auth-actions">
            <AppButton type="submit" loading={resetPasswordMutation.isPending}>
              Update password
            </AppButton>
            <AppButtonLink href="/login" variant="ghost">
              Back to login
            </AppButtonLink>
          </div>
        </form>
      )}
    </AppCard>
  );
}
