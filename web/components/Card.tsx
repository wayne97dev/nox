import clsx from "clsx";
import type { ReactNode } from "react";

interface CardProps {
  children: ReactNode;
  className?: string;
  hover?: boolean;
}

export function Card({ children, className, hover = false }: CardProps) {
  return (
    <div className={clsx("nox-card p-6", hover && "nox-card-hover", className)}>
      {children}
    </div>
  );
}

export function StatCard({
  label,
  value,
  sub,
}: {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
}) {
  return (
    <Card className="flex flex-col gap-1.5">
      <span className="text-xs uppercase tracking-wider text-mist">{label}</span>
      <span className="text-2xl font-mono font-semibold text-fog">{value}</span>
      {sub && <span className="text-sm text-mist">{sub}</span>}
    </Card>
  );
}
