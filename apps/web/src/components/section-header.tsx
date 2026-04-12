import type { ReactNode } from 'react';

export function SectionHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  return (
    <div className="pv-section-header">
      <div>
        <h2 className="pv-section-title">{title}</h2>
        {subtitle ? <p className="pv-section-subtitle">{subtitle}</p> : null}
      </div>
      {action}
    </div>
  );
}
