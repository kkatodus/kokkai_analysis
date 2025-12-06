interface ScoreBarProps {
  value: number; // 0-100
  label: string;
  variant?: "trust" | "fact";
  className?: string;
}

const gradientStyles = {
  trust: "bg-gradient-to-r from-emerald-500 via-emerald-400 to-lime-400",
  fact: "bg-gradient-to-r from-cyan-500 via-emerald-500 to-yellow-400",
};

export function ScoreBar({
  value,
  label,
  variant = "trust",
  className = "",
}: ScoreBarProps) {
  return (
    <div className={className}>
      <div className="mb-0.5 text-right text-xs text-gray-400">{label}</div>
      <div className="mb-0.5 h-1.5 w-[130px] overflow-hidden rounded-full bg-gray-800">
        <div
          className={`h-full rounded-full transition-all duration-200 ${gradientStyles[variant]}`}
          style={{ width: `${value}%` }}
        />
      </div>
    </div>
  );
}

