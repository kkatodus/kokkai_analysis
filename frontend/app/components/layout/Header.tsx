import { Badge } from "@/app/components/shared/Badge";
import { AuthButton } from "@/app/components/auth/AuthButton";

export function Header() {
  return (
    <header className="flex items-center justify-between rounded-2xl border border-white/5 bg-linear-to-br from-gray-800 to-[#020617] px-5 py-3 shadow-2xl">
      <div>
        <h1 className="flex items-center gap-2 text-xl font-semibold">
          <span className="h-2.5 w-2.5 rounded-full bg-linear-to-br from-cyan-400 to-indigo-600 shadow-lg shadow-cyan-400/90" />
          Parliament Explorer
          <span className="text-base opacity-60">(Mock)</span>
        </h1>
        <div className="text-[13px] text-gray-400">
          Explore ideology, cross-platform speeches, trust, factual accuracy, geography, and
          citizen commentary.
        </div>
      </div>
      <div className="flex items-center gap-3">
        <Badge variant="default" className="text-[11px] uppercase tracking-wider">
          Ideology • Trust • Facts • Map
        </Badge>
        <AuthButton />
      </div>
    </header>
  );
}

