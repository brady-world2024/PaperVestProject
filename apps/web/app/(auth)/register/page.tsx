'use client';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import {
  registerFormSchema,
  type RegisterFormValues,
} from '@papervest/validation';

import { AppButton, AppButtonLink } from '@/components/app-button';
import { AppCard } from '@/components/app-card';
import { AppField } from '@/components/app-field';
import { InlineNotice } from '@/components/inline-notice';
import { webApi } from '@/lib/api';
import { useAuthStore } from '@/state/auth-store';

export default function RegisterPage() {
  const completeAuth = useAuthStore((state) => state.completeAuth);
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<RegisterFormValues>({
    resolver: zodResolver(registerFormSchema),
    defaultValues: {
      email: '',
      password: '',
      confirmPassword: '',
    },
  });

  const registerMutation = useMutation({
    mutationFn: webApi.register,
    onSuccess: async (response) => {
      await completeAuth(response);
    },
  });

  return (
    <AppCard className="pv-auth-card">
      <h1 className="pv-section-title">Create account</h1>
      <p className="pv-section-subtitle">
        Open a web session, start with virtual cash, and receive an email verification link.
      </p>

      <form
        className="pv-stack"
        style={{ marginTop: '20px' }}
        onSubmit={handleSubmit(async (values) => {
          await webApi.initializeCsrf();
          await registerMutation.mutateAsync({
            ...values,
            deviceName: 'PaperVest Web',
          });
        })}
      >
        {registerMutation.isError ? (
          <InlineNotice
            tone="error"
            message={webApi.getApiErrorMessage(registerMutation.error, 'Unable to create account')}
          />
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
          autoComplete="new-password"
          error={errors.password?.message}
          {...register('password')}
        />
        <AppField
          label="Confirm password"
          type="password"
          placeholder="SecurePass1"
          autoComplete="new-password"
          error={errors.confirmPassword?.message}
          {...register('confirmPassword')}
        />

        <div className="pv-auth-actions">
          <AppButton type="submit" loading={registerMutation.isPending}>
            Create account
          </AppButton>
          <AppButtonLink href="/login" variant="ghost">
            Already have an account?
          </AppButtonLink>
        </div>
      </form>
    </AppCard>
  );
}
