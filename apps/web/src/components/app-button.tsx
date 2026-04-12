'use client';

import Link from 'next/link';
import type { ButtonHTMLAttributes, ReactNode } from 'react';

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  children: ReactNode;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  loading?: boolean;
};

export function AppButton({
  children,
  variant = 'primary',
  loading,
  className,
  ...props
}: Props) {
  return (
    <button
      className={className ? `pv-button ${variant} ${className}` : `pv-button ${variant}`}
      disabled={loading || props.disabled}
      {...props}
    >
      {loading ? 'Working...' : children}
    </button>
  );
}

export function AppButtonLink({
  href,
  children,
  variant = 'primary',
  className,
}: {
  href: string;
  children: ReactNode;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  className?: string;
}) {
  return (
    <Link
      className={className ? `pv-button pv-button-link ${variant} ${className}` : `pv-button pv-button-link ${variant}`}
      href={href}
    >
      {children}
    </Link>
  );
}
