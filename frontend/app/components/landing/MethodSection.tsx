"use client";

/** §5.7 — どうやって？: data, AI judgement, limits. Calm, single column, no stage. */

import Link from "next/link";
import { motion, useReducedMotion } from "motion/react";
import type { ReactNode } from "react";
import { FiAlertTriangle, FiCpu, FiDatabase } from "react-icons/fi";
import { track } from "./track";

function MethodCard({ icon, title, children, index }: { icon: ReactNode; title: string; children: ReactNode; index: number }) {
  const reduced = useReducedMotion();
  return (
    <motion.div
      initial={reduced ? false : { opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.4 }}
      transition={{ duration: 0.5, delay: index * 0.1 }}
      className="rounded-2xl border border-slate-400/15 bg-slate-900/30 p-5"
    >
      <motion.div
        initial={reduced ? false : { scale: 0.6, opacity: 0 }}
        whileInView={{ scale: 1, opacity: 1 }}
        viewport={{ once: true, amount: 0.4 }}
        transition={{ duration: 0.6, delay: index * 0.1 + 0.15, type: "spring", stiffness: 200, damping: 16 }}
        className="flex h-10 w-10 items-center justify-center rounded-xl border border-cyan-400/20 bg-cyan-500/10 text-cyan-200"
      >
        {icon}
      </motion.div>
      <h3 className="mt-3 text-base font-semibold text-gray-50">{title}</h3>
      <div className="mt-2 text-sm leading-relaxed text-gray-300">{children}</div>
    </motion.div>
  );
}

export function MethodSection() {
  return (
    <section id="method" className="mx-auto w-full max-w-3xl px-4 py-14 sm:py-20">
      <h2 className="text-2xl font-semibold text-gray-50 sm:text-3xl">どうやって？</h2>
      <p className="mt-3 text-base text-gray-400">仕組みと、できないこと。</p>
      <div className="mt-8 grid gap-4">
        <MethodCard index={0} icon={<FiDatabase className="h-5 w-5" />} title="データ">
          国会会議録検索システム（国立国会図書館）の全会議録、衆参の議員名簿、選挙区ポリゴン。詳しくは
          <Link href="/about" onClick={() => track("LandingCTA", { cta: "about", location: "method" })} className="mx-1 text-cyan-300 underline-offset-2 hover:underline">
            「このプロジェクトについて」
          </Link>
          へ。
        </MethodCard>
        <MethodCard index={1} icon={<FiCpu className="h-5 w-5" />} title="AIの判定">
          委員会の質疑を「やり取り」単位で読み、何のための議論か・成果があったか・問題点があったかをラベル付けしています。党派によって基準を変えません。迷ったら本人に有利に判定します。
        </MethodCard>
        <MethodCard index={2} icon={<FiAlertTriangle className="h-5 w-5" />} title="限界">
          表示される数値や図は、すべて会議録からの推定・参考情報です。誤りも含まれます。気になったら必ず原文を確認してください。詳しい注意事項はダッシュボードの「注意事項」ボタンから読めます。
        </MethodCard>
      </div>
    </section>
  );
}
