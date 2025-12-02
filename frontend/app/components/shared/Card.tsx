import { ReactNode } from "react";

interface CardProps {
  children: ReactNode;
  className?: string;
}

export function Card({ children, className = "" }: CardProps) {
  return (
    <div
      className={`relative overflow-hidden rounded-2xl border border-white/5 bg-linear-to-br from-[#020617] to-[#020617] p-3.5 ${className}`}
    >
      {/* Gradient overlay */}
      <div
        className="pointer-events-none absolute inset-0 opacity-50"
        style={{
          background:
            "radial-gradient(circle at top left, rgba(79, 70, 229, 0.1), transparent 60%)",
        }}
      />
      <div className="relative">{children}</div>
    </div>
  );
}

interface CardHeaderProps {
  title: string;
  subtitle?: string;
  action?: ReactNode;
}

export function CardHeader({ title, subtitle, action }: CardHeaderProps) {
  return (
    <div className="mb-2 flex items-center justify-between">
      <div>
        <div className="flex items-center gap-1.5 text-sm font-semibold">
          <span className="h-1.5 w-1.5 rounded-full bg-cyan-400" />
          {title}
        </div>
        {subtitle && (
          <div className="text-xs text-gray-400">{subtitle}</div>
        )}
      </div>
      {action && <div>{action}</div>}
    </div>
  );
}

