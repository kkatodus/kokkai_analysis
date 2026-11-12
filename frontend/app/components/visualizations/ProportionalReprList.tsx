"use client";
import { canonicalParty } from "@/app/lib/config/parties";

import type { ParliamentMemberData, ShugiinPolitician, SangiinPolitician } from "@/app/types";
import { Empty } from "@/app/components/shared/states";
import { Heading } from "@/app/components/shared/Card";
import { Badge } from "@/app/components/shared/Badge";
import { ListRow, rowTitleClass } from "@/app/components/shared/ListRow";

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
    <ListRow onClick={onClick} className="flex items-start justify-between gap-2">
      <div className="min-w-0">
        <div className={rowTitleClass()}>{name}</div>
        {yomikata ? <div className="truncate text-caption text-ink-muted">{yomikata}</div> : null}
        {district ? <div className="mt-1 truncate text-caption text-ink-muted">{district}</div> : null}
      </div>
      {kaiha ? <Badge className="shrink-0">{canonicalParty(kaiha)}</Badge> : null}
    </ListRow>
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
    return <Empty message="議員データを読み込めませんでした。" />;
  }

  if (!shugiin.length && !sangiin.length) {
    return <Empty message="比例代表の議員データが見つかりません。" />;
  }

  const renderHouse = (
    title: string,
    reprs: Array<ShugiinPolitician | SangiinPolitician>
  ) => {
    if (!reprs.length) return null;
    return (
      <section>
        <div className="mb-2 flex items-baseline justify-between gap-2">
          <Heading level={3}>{title}</Heading>
          <p className="text-data text-ink-muted">{reprs.length.toLocaleString()}人</p>
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
      </section>
    );
  };

  return (
    <div className="relative h-[500px] overflow-hidden">
      <div className="h-full overflow-y-auto overscroll-contain pr-1">
        <div className="grid gap-4">
          {renderHouse("衆議院（比例）", shugiin)}
          {renderHouse("参議院（比例）", sangiin)}
        </div>
      </div>
    </div>
  );
}


