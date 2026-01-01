"use client";

import { useEffect, useState } from "react";
import { RxCross1 } from "react-icons/rx";

type DonateModalProps = {
  removeModal?: () => void;
};

export function DonateModal({ removeModal }: DonateModalProps) {
  const [donors, setDonors] = useState<string[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/donors", { cache: "no-store" });
        if (!res.ok) throw new Error(`Request failed: ${res.status}`);
        const data = (await res.json()) as { donors: string[] };
        if (!cancelled) setDonors(Array.isArray(data.donors) ? data.donors : []);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Unknown error");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="flex h-full w-full flex-col gap-3 overflow-hidden rounded-lg border border-slate-400/20 bg-[#020617] p-4 text-gray-100">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">Donors</h1>
        <button
          onClick={removeModal}
          className="flex items-center gap-1 rounded-full border border-slate-400/40 bg-slate-900/90 px-3 py-1 text-xs text-gray-300 hover:bg-slate-800 hover:text-gray-100"
        >
          <RxCross1 className="h-4 w-4" /> 閉じる
        </button>
      </div>
      <p className="text-sm leading-relaxed text-gray-300">
        以下にKOKKAI DOCの活動を4000円以上の募金で支援してくださった皆様のお名前を心より感謝を込めて掲載いたします。掲載名の変更・非掲載をご希望の方は{" "}
        <span className="whitespace-nowrap text-blue-500">kokkai.doc[アット]gmail.com</span>{" "}
        までご連絡ください。
      </p>

      {/* Donor list: shrink-to-fit when short, scroll when long */}
      <div className="max-h-[45vh] overflow-auto rounded-md border border-slate-400/15 bg-slate-900/40 p-2 text-sm">
        {error && <div className="text-red-300">Failed to load donors: {error}</div>}
        {!error && donors === null && <div className="text-gray-300">Loading…</div>}
        {!error && donors !== null && (
          <ul className="flex flex-wrap justify-center gap-2">
            {donors.map((d) => (
              <li key={d} className="rounded-md border border-slate-400/10 px-2 py-1">
                {d}
              </li>
            ))}
          </ul>
        )}
      </div>

      <p className="text-sm leading-relaxed text-gray-300">
        KOKKAI DOC は、一人のエンジニアが運営するプロジェクトです。日本の政治を見やすく、わかりやすく、調べやすくすることを目指しています。
        <br />
        皆さまの温かいご協力が、より開かれた民主主義の実現につながります。何卒よろしくお願い申し上げます。
      </p>
    </div>
  );
}