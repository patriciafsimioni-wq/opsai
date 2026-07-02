import * as React from "react";
import { cn } from "@/lib/utils";

export function Card({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-sm",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function CardHeader({
  title,
  subtitle,
  action,
}: {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-[var(--color-border)] px-5 py-4">
      <div>
        <h3 className="text-sm font-semibold text-[var(--color-fg)]">{title}</h3>
        {subtitle && (
          <p className="mt-0.5 text-xs text-[var(--color-muted)]">{subtitle}</p>
        )}
      </div>
      {action}
    </div>
  );
}

export function Badge({
  children,
  bg,
  fg,
  className,
}: {
  children: React.ReactNode;
  bg?: string;
  fg?: string;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium",
        className,
      )}
      style={{ backgroundColor: bg ?? "#f1f5f9", color: fg ?? "#475569" }}
    >
      {children}
    </span>
  );
}

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md";
};

export function Button({
  variant = "primary",
  size = "md",
  className,
  ...props
}: ButtonProps) {
  const variants: Record<string, string> = {
    primary:
      "bg-[var(--color-primary)] text-white hover:bg-blue-700 disabled:opacity-50",
    secondary:
      "bg-white text-[var(--color-fg)] border border-[var(--color-border)] hover:bg-slate-50",
    ghost: "text-[var(--color-muted)] hover:bg-slate-100",
    danger: "bg-red-600 text-white hover:bg-red-700",
  };
  const sizes: Record<string, string> = {
    sm: "h-8 px-3 text-xs",
    md: "h-9 px-4 text-sm",
  };
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center gap-1.5 rounded-lg font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500/40 disabled:cursor-not-allowed",
        variants[variant],
        sizes[size],
        className,
      )}
      {...props}
    />
  );
}

export function StatCard({
  label,
  value,
  icon,
  accent = "#2563eb",
  hint,
}: {
  label: string;
  value: React.ReactNode;
  icon?: React.ReactNode;
  accent?: string;
  hint?: React.ReactNode;
}) {
  return (
    <Card className="p-4">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-[var(--color-muted)]">
            {label}
          </p>
          <p className="mt-1.5 text-2xl font-bold text-[var(--color-fg)]">
            {value}
          </p>
          {hint && (
            <p className="mt-1 text-xs text-[var(--color-muted)]">{hint}</p>
          )}
        </div>
        {icon && (
          <div
            className="flex h-10 w-10 items-center justify-center rounded-xl"
            style={{ backgroundColor: `${accent}1a`, color: accent }}
          >
            {icon}
          </div>
        )}
      </div>
    </Card>
  );
}

export function PageHeader({
  title,
  subtitle,
  action,
  flagCategory,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  flagCategory?: string;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-[var(--color-fg)]">
          {title}
        </h1>
        {subtitle && (
          <p className="mt-1 text-sm text-[var(--color-muted)]">{subtitle}</p>
        )}
      </div>
      <div className="flex items-center gap-2">
        {flagCategory && (
          <a
            href={`/issues?create=1&title=${encodeURIComponent(flagCategory + " Issue")}&category=${encodeURIComponent(flagCategory)}`}
            className="inline-flex items-center gap-1.5 rounded-lg border border-amber-300 bg-amber-50 px-3 py-1.5 text-sm font-medium text-amber-700 hover:bg-amber-100 transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" x2="4" y1="22" y2="15"/></svg>
            Flag Issue
          </a>
        )}
        {action}
      </div>
    </div>
  );
}

export function EmptyState({
  icon,
  title,
  description,
}: {
  icon?: React.ReactNode;
  title: string;
  description?: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-6 py-16 text-center">
      {icon && <div className="text-slate-300">{icon}</div>}
      <p className="text-sm font-medium text-[var(--color-fg)]">{title}</p>
      {description && (
        <p className="max-w-sm text-xs text-[var(--color-muted)]">{description}</p>
      )}
    </div>
  );
}

export function Avatar({
  name,
  color = "#2563eb",
  size = 36,
}: {
  name: string;
  color?: string;
  size?: number;
}) {
  const init = name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
  return (
    <div
      className="flex shrink-0 items-center justify-center rounded-full font-semibold text-white"
      style={{
        backgroundColor: color,
        width: size,
        height: size,
        fontSize: size * 0.38,
      }}
    >
      {init}
    </div>
  );
}

export function ProgressBar({
  value,
  color,
}: {
  value: number;
  color?: string;
}) {
  const v = Math.max(0, Math.min(100, value));
  const c = color ?? (v < 20 ? "#dc2626" : v < 50 ? "#d97706" : "#16a34a");
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
      <div
        className="h-full rounded-full transition-all"
        style={{ width: `${v}%`, backgroundColor: c }}
      />
    </div>
  );
}

export function Table({ children }: { children: React.ReactNode }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-sm">{children}</table>
    </div>
  );
}

export function Th({
  children,
  className,
}: {
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <th
      className={cn(
        "border-b border-[var(--color-border)] bg-[var(--color-surface-2)] px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-[var(--color-muted)]",
        className,
      )}
    >
      {children}
    </th>
  );
}

export function Td({
  children,
  className,
}: {
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <td
      className={cn(
        "border-b border-[var(--color-border)] px-4 py-3 align-middle",
        className,
      )}
    >
      {children}
    </td>
  );
}
