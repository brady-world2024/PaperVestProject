import type { ReactNode } from 'react';

import { AppButton } from './app-button';
import { AppCard } from './app-card';
import { SectionHeader } from './section-header';

type Props = {
  title: string;
  subtitle?: string;
  className?: string;
  collapsed: boolean;
  canMoveUp: boolean;
  canMoveDown: boolean;
  canMoveAcross: boolean;
  moveAcrossLabel: string;
  onToggleCollapse: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onMoveAcross: () => void;
  onHide: () => void;
  action?: ReactNode;
  collapsedPreview?: ReactNode;
  children: ReactNode;
};

export function DashboardModuleCard({
  title,
  subtitle,
  className,
  collapsed,
  canMoveUp,
  canMoveDown,
  canMoveAcross,
  moveAcrossLabel,
  onToggleCollapse,
  onMoveUp,
  onMoveDown,
  onMoveAcross,
  onHide,
  action,
  collapsedPreview,
  children,
}: Props) {
  return (
    <AppCard
      className={
        className
          ? `pv-dashboard-module ${collapsed ? 'is-collapsed ' : ''}${className}`.trim()
          : collapsed
            ? 'pv-dashboard-module is-collapsed'
            : 'pv-dashboard-module'
      }
    >
      <SectionHeader
        title={title}
        subtitle={subtitle}
        action={
          <div className="pv-module-toolbar">
            {action}
            <div className="pv-module-controls">
              <AppButton className="pv-module-button" variant="ghost" onClick={onToggleCollapse}>
                {collapsed ? 'Expand' : 'Collapse'}
              </AppButton>
              <AppButton
                className="pv-module-button"
                variant="ghost"
                disabled={!canMoveUp}
                onClick={onMoveUp}
              >
                Up
              </AppButton>
              <AppButton
                className="pv-module-button"
                variant="ghost"
                disabled={!canMoveDown}
                onClick={onMoveDown}
              >
                Down
              </AppButton>
              <AppButton
                className="pv-module-button"
                variant="ghost"
                disabled={!canMoveAcross}
                onClick={onMoveAcross}
              >
                {moveAcrossLabel}
              </AppButton>
              <AppButton className="pv-module-button" variant="ghost" onClick={onHide}>
                Hide
              </AppButton>
            </div>
          </div>
        }
      />

      {collapsed ? collapsedPreview : children}
    </AppCard>
  );
}
