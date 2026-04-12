'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import type { ReactNode } from 'react';

import { AppCard } from '@/components/app-card';
import { BrandLogo } from '@/components/brand-logo';
import { useAuthStore } from '@/state/auth-store';

export default function AuthLayout({ children }: { children: ReactNode }) {
  const router = useRouter();
  const status = useAuthStore((state) => state.status);

  useEffect(() => {
    if (status === 'authenticated') {
      router.replace('/dashboard');
    }
  }, [router, status]);

  if (status === 'authenticated') {
    return null;
  }

  if (status === 'hydrating') {
    return (
      <div className="pv-auth-wrap">
        <div className="pv-auth-shell">
          <BrandLogo size="auth" priority />
          <AppCard className="pv-auth-card">
            <div className="pv-skeleton" style={{ minHeight: '180px' }} />
          </AppCard>
        </div>
      </div>
    );
  }

  return (
    <div className="pv-auth-wrap">
      <div className="pv-auth-shell">
        <BrandLogo size="auth" priority />
        {children}
      </div>
    </div>
  );
}
