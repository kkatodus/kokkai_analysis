import { ReactNode } from "react";

interface BadgeProps {
  children: ReactNode;
  variant?: "default" | "trust" | "fact" | "major" | "minor";
  className?: string;
}

const variantStyles = {
  default: "border-cyan-400/20 bg-[#0f172a] text-cyan-400",
  trust: "border-emerald-400/40 text-emerald-200",
  fact: "border-yellow-400/50 text-yellow-200",
  major: "border-slate-400/40 text-cyan-400",
  minor: "border-slate-400/40 text-cyan-400",
};

export function Badge({
  children,
  variant = "default",
  className = "",
}: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-1.5 py-0.5 text-[10px] ${variantStyles[variant]} ${className}`}
    >
      {children}
    </span>
  );
}

