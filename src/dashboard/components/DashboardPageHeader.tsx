import { ReactNode } from 'react';

interface DashboardPageHeaderProps {
  label: string;
  title: string;
  meta?: ReactNode;
  actions?: ReactNode;
}

export default function DashboardPageHeader({
  label,
  title,
  meta,
  actions,
}: DashboardPageHeaderProps) {
  return (
    <div className="mb-6 flex flex-col gap-4 border-b border-foreground pb-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <p className="mb-1 font-mono text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
          {label}
        </p>
        <h1 className="text-2xl font-bold text-foreground">{title}</h1>
      </div>
      {(meta || actions) && (
        <div className="flex flex-col gap-3 sm:items-end">
          {meta && <div className="text-sm text-muted-foreground tabular-nums">{meta}</div>}
          {actions}
        </div>
      )}
    </div>
  );
}
