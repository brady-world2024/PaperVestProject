'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import type { ReactNode } from 'react';

import { AppShell } from '@/components/app-shell';
import { useAuthStore } from '@/state/auth-store';

export default function ProtectedLayout({ children }: { children: ReactNode }) {
  const router = useRouter();
  const status = useAuthStore((state) => state.status);

  useEffect(() => {
    if (status === 'anonymous') {
      router.replace('/login');
    }
  }, [router, status]);

  if (status !== 'authenticated') {
    return (
      <main className="pv-page">
        <div className="pv-skeleton" style={{ minHeight: '200px' }} />
      </main>
    );
  }

  return <AppShell>{children}</AppShell>;
}
