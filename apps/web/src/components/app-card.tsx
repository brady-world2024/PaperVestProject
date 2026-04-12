import type { ReactNode } from 'react';

export function AppCard({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <section className={className ? `pv-card ${className}` : 'pv-card'}>{children}</section>;
}
