"use client";

import { useState, useMemo } from "react";
import { Card, CardHeader } from "@/app/components/shared/Card";
import { Badge } from "@/app/components/shared/Badge";
import { EmptyState } from "@/app/components/shared/EmptyState";
import type { Politician } from "@/app/types";

interface SearchListProps {
  politicians: Politician[];
  selectedId: string | null;
  onPoliticianSelect: (id: string) => void;
}

export function SearchList({
  politicians,
  selectedId,
  onPoliticianSelect,
}: SearchListProps) {
  const [searchQuery, setSearchQuery] = useState("");

  const filtered = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return politicians;

    return politicians.filter(
      (p) =>
        p.name.toLowerCase().includes(query) ||
        p.party.toLowerCase().includes(query)
    );
  }, [politicians, searchQuery]);

  return (
    <Card>
      <CardHeader
        title="Search & browse politicians"
        subtitle="Filter by name, party, and topic; click to open the detail pane."
      />

      <div className="mb-2.5 flex items-center gap-2">
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search by name or party (e.g. Tanaka, Reform)…"
          className="flex-1 rounded-full border border-slate-400/40 bg-slate-900/90 px-2.5 py-1.5 text-xs text-gray-50 outline-none placeholder:text-gray-500"
        />
        <div className="text-[11px] text-gray-400">
          {filtered.length}/{politicians.length}
        </div>
      </div>

      <div className="max-h-[180px] overflow-auto rounded-lg border border-slate-400/20 bg-[#020617] pr-1">
        {filtered.length === 0 ? (
          <EmptyState message="No politicians match this search/topic filter." />
        ) : (
          filtered.map((p) => (
            <div
              key={p.id}
              onClick={() => onPoliticianSelect(p.id)}
              className={`flex cursor-pointer items-center justify-between gap-2 border-b border-gray-800/60 px-2 py-1.5 text-xs transition-colors last:border-b-0 hover:bg-blue-700/35 ${
                p.id === selectedId ? "bg-blue-700/70" : ""
              }`}
            >
              <div>
                <div className="font-medium">{p.name}</div>
                <div className="text-[11px] text-gray-400">{p.party}</div>
              </div>
              <div className="flex flex-col items-end gap-0.5">
                <Badge variant={p.isMajor ? "major" : "minor"}>
                  {p.isMajor ? "Major party" : "Minor/Ind."}
                </Badge>
                <Badge variant="trust">Trust {p.trustScore}</Badge>
                <Badge variant="fact">Fact {p.factScore}</Badge>
              </div>
            </div>
          ))
        )}
      </div>
    </Card>
  );
}

