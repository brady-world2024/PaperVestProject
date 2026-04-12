'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

import { AppButtonLink } from '@/components/app-button';
import { AppCard } from '@/components/app-card';
import { BrandLogo } from '@/components/brand-logo';
import { useAuthStore } from '@/state/auth-store';

const homeSections = [
  { label: 'Search', value: 'Symbols and quote detail' },
  { label: 'Watchlist', value: 'Saved names with live pricing' },
  { label: 'Portfolio', value: 'Cash, holdings, and P&L' },
  { label: 'Orders', value: 'Paper buy and sell execution' },
];

export default function HomePage() {
  const router = useRouter();
  const status = useAuthStore((state) => state.status);

  useEffect(() => {
    if (status === 'authenticated') {
      router.replace('/dashboard');
    }
  }, [router, status]);

  if (status === 'hydrating' || status === 'authenticated') {
    return (
      <main className="pv-page pv-home">
        <div className="pv-home-shell">
          <div className="pv-skeleton" style={{ minHeight: '220px' }} />
        </div>
      </main>
    );
  }

  return (
    <main className="pv-page pv-home">
      <section className="pv-home-shell">
        <AppCard className="pv-home-card">
          <BrandLogo size="hero" className="pv-home-brand" priority />
          <h1 className="pv-home-title">Paper trading desk</h1>
          <p className="pv-section-subtitle">Search, watchlist, portfolio, and simulated orders.</p>
          <div className="pv-home-actions">
            <AppButtonLink href="/login">Log in</AppButtonLink>
            <AppButtonLink href="/register" variant="ghost">
              Create account
            </AppButtonLink>
          </div>
        </AppCard>

        <AppCard>
          <div className="pv-home-list">
            {homeSections.map((section) => (
              <div key={section.label} className="pv-home-list-row">
                <span className="pv-home-list-label">{section.label}</span>
                <span className="pv-home-list-value">{section.value}</span>
              </div>
            ))}
          </div>
        </AppCard>
      </section>
    </main>
  );
}
