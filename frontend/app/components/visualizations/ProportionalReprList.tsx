"use client";

import type { ParliamentMemberData, ShugiinPolitician, SangiinPolitician } from "@/app/types";
import { EmptyState } from "@/app/components/shared/EmptyState";
import { Badge } from "@/app/components/shared/Badge";

function isProportionalDistrict(district: string | undefined | null): boolean {
  if (!district) return false;
  // Data seems to use Japanese parentheses: （比）
  return district.includes("（比）") || district.includes("(比)") || district.includes("比例");
}

type Props = {
  parliamentMemberData: ParliamentMemberData | null;
  onPoliticianSelect?: (id: string) => void;
};

function Row({
  name,
  yomikata,
  kaiha,
  district,
  onClick,
}: {
  name: string;
  yomikata?: string;
  kaiha?: string;
  district?: string;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-start justify-between gap-2 rounded-xl border border-white/5 bg-[#020617] px-2.5 py-2 text-left transition hover:border-cyan-300/25 hover:bg-white/5 hover:shadow-[0_0_0_1px_rgba(34,211,238,0.25),0_0_22px_rgba(34,211,238,0.12)]"
    >
      <div className="min-w-0">
        <div className="truncate text-[13px] font-semibold text-slate-100 sm:text-sm">
          {name}
        </div>
        {yomikata ? (
          <div className="truncate text-[10px] text-slate-400 sm:text-[11px]">
            {yomikata}
          </div>
        ) : null}
        {district ? (
          <div className="mt-1 truncate text-[10px] text-slate-500 sm:text-[11px]">
            {district}
          </div>
        ) : null}
      </div>
      {kaiha ? <Badge className="shrink-0">{kaiha}</Badge> : null}
    </button>
  );
}

export function ProportionalReprList({ parliamentMemberData, onPoliticianSelect }: Props) {
  const shugiin = (parliamentMemberData?.shugiin.reprs ?? []).filter((r) =>
    isProportionalDistrict(r.district)
  );
  const sangiin = (parliamentMemberData?.sangiin.reprs ?? []).filter((r) =>
    isProportionalDistrict(r.district)
  );

  if (!parliamentMemberData) {
    return <EmptyState message="No data loaded." className="py-8" />;
  }

  if (!shugiin.length && !sangiin.length) {
    return <EmptyState message="（比）の議員データが見つかりません。" className="py-8" />;
  }

  const renderHouse = (
    title: string,
    reprs: Array<ShugiinPolitician | SangiinPolitician>
  ) => {
    if (!reprs.length) return null;
    return (
      <div className="rounded-xl border border-white/5 bg-[#0b1220] p-2.5">
        <div className="mb-2 flex items-baseline justify-between gap-2">
          <div className="text-[11px] font-semibold text-slate-200 sm:text-xs">
            {title}
          </div>
          <div className="text-[9px] text-slate-500 sm:text-[10px]">
            {reprs.length}人
          </div>
        </div>
        {/* Wrap cards to reduce scrolling */}
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {reprs.map((p) => (
            <Row
              key={`${p.name}:${p.district}:${p.kaiha}`}
              name={p.name}
              yomikata={p.yomikata}
              kaiha={p.kaiha}
              district={p.district}
              onClick={
                onPoliticianSelect
                  ? () => {
                      const id = String((p as any).person_id ?? p.name);
                      onPoliticianSelect(id);
                    }
                  : undefined
              }
            />
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="relative h-[500px] overflow-hidden">
      <div className="h-full overflow-y-auto overscroll-contain pr-1">
        <div className="grid gap-3">
          {renderHouse("衆議院（比例）", shugiin)}
          {renderHouse("参議院（比例）", sangiin)}
        </div>
      </div>
    </div>
  );
}


