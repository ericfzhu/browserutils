import { ReactNode } from 'react';

interface DashboardPageHeaderProps {
  title: string;
  meta?: ReactNode;
  actions?: ReactNode;
}

export default function DashboardPageHeader({ title, meta, actions }: DashboardPageHeaderProps) {
  return (
    <header className="mb-6 border-b border-border pb-4">
      <h1 className="text-2xl font-bold leading-8 text-foreground">{title}</h1>
      <div className="mt-3 flex min-h-10 flex-wrap items-center justify-between gap-3">
        {meta && <div className="text-sm text-muted-foreground tabular-nums">{meta}</div>}
        {actions && <div className="ml-auto flex max-w-full flex-wrap items-center justify-end gap-2">{actions}</div>}
      </div>
    </header>
  );
}
