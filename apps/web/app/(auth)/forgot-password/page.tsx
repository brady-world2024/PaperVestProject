'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import {
  forgotPasswordFormSchema,
  type ForgotPasswordFormValues,
} from '@papervest/validation';

import { AppButton, AppButtonLink } from '@/components/app-button';
import { AppCard } from '@/components/app-card';
import { AppField } from '@/components/app-field';
import { InlineNotice } from '@/components/inline-notice';
import { webApi } from '@/lib/api';

export default function ForgotPasswordPage() {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ForgotPasswordFormValues>({
    resolver: zodResolver(forgotPasswordFormSchema),
    defaultValues: {
      email: '',
    },
  });

  const requestResetMutation = useMutation({
    mutationFn: webApi.requestPasswordReset,
    onSuccess: () => {
      reset();
    },
  });

  return (
    <AppCard className="pv-auth-card">
      <h1 className="pv-section-title">Reset your password</h1>
      <p className="pv-section-subtitle">
        We generate a one-time reset link and log it through the backend message service in this environment.
      </p>

      <form
        className="pv-stack"
        style={{ marginTop: '20px' }}
        onSubmit={handleSubmit(async (values) => {
          await webApi.initializeCsrf();
          await requestResetMutation.mutateAsync(values);
        })}
      >
        {requestResetMutation.isError ? (
          <InlineNotice
            tone="error"
            message={webApi.getApiErrorMessage(requestResetMutation.error, 'Unable to request a password reset')}
          />
        ) : requestResetMutation.isSuccess ? (
          <InlineNotice
            tone="info"
            message="If that email exists, a reset link has been issued. Check the backend logs for this environment."
          />
        ) : null}

        <AppField
          label="Email"
          placeholder="you@example.com"
          autoComplete="email"
          error={errors.email?.message}
          {...register('email')}
        />

        <div className="pv-auth-actions">
          <AppButton type="submit" loading={requestResetMutation.isPending}>
            Send reset link
          </AppButton>
          <AppButtonLink href="/login" variant="ghost">
            Back to login
          </AppButtonLink>
        </div>
      </form>
    </AppCard>
  );
}
