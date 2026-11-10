"use client";

/**
 * §5.7 — どうやって？: the pipeline from the Diet record to the labels and the stance figures, step by step,
 * then the limits. Wording follows the dashboard's 注意事項 panels; label vocabularies come from quality.ts.
 */

import Link from "next/link";
import { motion, useReducedMotion } from "motion/react";
import type { ReactNode } from "react";
import { FiAlertTriangle, FiCpu, FiDatabase, FiGitCommit, FiMap, FiUserCheck } from "react-icons/fi";
import {
  CONTRIBUTION_JA,
  CONTRIBUTION_STYLE,
  CONTRIBUTIONS,
  FUNCTION_JA,
  FUNCTION_STYLE,
  FUNCTIONS,
  ISSUE_CHIP,
  ISSUE_JA,
  ISSUE_TYPES,
  OUTCOME_CHIP,
  OUTCOME_JA,
  OUTCOMES,
} from "@/app/lib/quality";
import { track } from "./track";

const CHIP = "inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold whitespace-nowrap";

function Step({ n, icon, title, children }: { n: number; icon: ReactNode; title: string; children: ReactNode }) {
  const reduced = useReducedMotion();
  return (
    <motion.li
      initial={reduced ? false : { opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.3 }}
      transition={{ duration: 0.5 }}
      className="relative rounded-2xl border border-slate-400/15 bg-slate-900/30 p-5 sm:p-6"
    >
      <div className="flex items-start gap-4">
        <motion.div
          initial={reduced ? false : { scale: 0.6, opacity: 0 }}
          whileInView={{ scale: 1, opacity: 1 }}
          viewport={{ once: true, amount: 0.3 }}
          transition={{ duration: 0.6, delay: 0.15, type: "spring", stiffness: 200, damping: 16 }}
          className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-cyan-400/20 bg-cyan-500/10 text-cyan-200"
        >
          {icon}
          <span className="absolute -left-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-[#020617] text-[10px] font-bold text-cyan-200 ring-1 ring-cyan-400/40">{n}</span>
        </motion.div>
        <div className="min-w-0 flex-1">
          <h3 className="text-base font-semibold text-gray-50 sm:text-lg">{title}</h3>
          <div className="mt-2 space-y-3 text-sm leading-relaxed text-gray-300">{children}</div>
        </div>
      </div>
    </motion.li>
  );
}

function Vocab({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <div className="mb-1 text-[11px] font-semibold text-gray-400">{label}</div>
      <div className="flex flex-wrap gap-1">{children}</div>
    </div>
  );
}

export function MethodSection() {
  return (
    <section id="method" className="mx-auto w-full max-w-4xl px-4 py-14 sm:py-20">
      <h2 className="text-2xl font-semibold text-gray-50 sm:text-3xl">どうやって？</h2>
      <p className="mt-3 text-base text-gray-400">会議録がラベルと図になるまでの手順と、できないこと。</p>

      <ol className="mt-8 grid gap-4">
        <Step n={1} icon={<FiDatabase className="h-5 w-5" />} title="会議録と議員の情報を集める">
          <p>
            発言はすべて国会会議録検索システム（国立国会図書館）から取得しています。新しい会議は毎晩取り込み、やり取りの評価は2000年以降の委員会質疑を対象に順次さかのぼっています（本会議は対象外）。
          </p>
          <p>議員の名簿は衆参の公式サイトから毎月更新し、選挙区の地図データや過去の選挙結果と結びつけています。</p>
        </Step>

        <Step n={2} icon={<FiUserCheck className="h-5 w-5" />} title="発言者を議員に結びつける">
          <p>
            会議録に載る発言者名を議員のデータベースと照合します。同姓同名や表記ゆれで確信が持てない組み合わせは自動で確定せず、人の目で確認してから反映します。大臣や政府参考人としての答弁も、その人の記録として残ります。
          </p>
        </Step>

        <Step n={3} icon={<FiGitCommit className="h-5 w-5" />} title="質疑を「やり取り」に区切る">
          <p>
            評価の単位は発言ひとつではなく、「質問者の持ち時間＋それへの答弁」のひとまとまりです。これを「やり取り」と呼び、質問者としての記録と答弁者としての記録を分けて集計します。
          </p>
        </Step>

        <Step n={4} icon={<FiCpu className="h-5 w-5" />} title="AIが3つの軸でラベルを付ける">
          <p>やり取りごとに、何のための議論か・成果があったか・問題点があったかを大規模言語モデルが読んで判定します。語彙は次のとおりで、ダッシュボードの表示と同じものです。</p>
          <div className="space-y-2.5 rounded-xl border border-slate-400/10 bg-slate-950/30 p-3">
            <Vocab label="何のため">
              {FUNCTIONS.map((f) => (
                <span key={f} className={`${CHIP} ${FUNCTION_STYLE[f].chip}`}>{FUNCTION_JA[f]}</span>
              ))}
            </Vocab>
            <Vocab label="成果">
              {CONTRIBUTIONS.map((c) => (
                <span key={c} className={`${CHIP} ${CONTRIBUTION_STYLE[c].chip}`}>{CONTRIBUTION_JA[c]}</span>
              ))}
              {OUTCOMES.map((o) => (
                <span key={o} className={`${CHIP} ${OUTCOME_CHIP}`}>{OUTCOME_JA[o]}</span>
              ))}
            </Vocab>
            <Vocab label="問題点（質問者側・答弁者側のどちらに付くかも記録）">
              {ISSUE_TYPES.map((t) => (
                <span key={t} className={`${CHIP} ${ISSUE_CHIP}`}>{ISSUE_JA[t]}</span>
              ))}
            </Vocab>
          </div>
          <ul className="ml-4 list-disc space-y-1">
            <li>党派によって基準を変えません。同じプロンプト、同じモデルで全員を読みます。</li>
            <li>疑わしきは本人に有利に。問題点は明らかなときだけ付け、迷ったら付けません。</li>
            <li>「成果」と「問題点」は別の指標です。成果があって問題点も付くやり取りはあります。</li>
            <li>使用したモデルとプロンプトの全文は、ダッシュボードの「注意事項」で公開しています。</li>
          </ul>
        </Step>

        <Step n={5} icon={<FiMap className="h-5 w-5" />} title="発言から立場を推定する">
          <p>論点ごとの立場の図は、次の手順で作っています。</p>
          <ol className="ml-4 list-decimal space-y-1">
            <li>トピックの検索語を含む発言を、トピックごとの期間内から集める</li>
            <li>分類モデルで「意見を述べている文」だけを残す（3文未満の人は推定しない）</li>
            <li>大規模言語モデルがその人の意見を論点ごとに要約する（複数回行って平均）</li>
            <li>要約文を埋め込みモデルで数値ベクトルにする</li>
            <li>「賛成」「反対」の模範発言との位置関係で1次元に、議員どうしの近さ（UMAP）で2次元に配置する</li>
          </ol>
          <p>
            期間内にその論点で意見を述べていない議員は図に現れません。沈黙は「中立」ではなく「不明」です。手法の詳細と検証は
            <a href="https://arxiv.org/abs/2505.07118" target="_blank" rel="noreferrer" className="mx-1 text-cyan-300 underline-offset-2 hover:underline">
              論文（arXiv）
            </a>
            にまとめています。
          </p>
        </Step>

        <Step n={6} icon={<FiAlertTriangle className="h-5 w-5" />} title="できないこと・限界">
          <ul className="ml-4 list-disc space-y-1">
            <li>表示される数値や図は、すべて会議録からの推定・参考情報です。誤りも偏りも含まれます。</li>
            <li>材料は国会での発言だけです。投票行動、公約、国会の外での活動は見ていません。</li>
            <li>ラベルは議員の能力や人格の評価ではなく、「その日のやり取りがどうだったか」の記録です。</li>
            <li>気になったら、必ず「原文を開く」で会議録そのものを確認してください。</li>
          </ul>
          <p>
            データの出典や免責事項は
            <Link href="/about" onClick={() => track("LandingCTA", { cta: "about", location: "method" })} className="mx-1 text-cyan-300 underline-offset-2 hover:underline">
              「このプロジェクトについて」
            </Link>
            、詳しい注意事項はダッシュボードの「注意事項」ボタンから読めます。
          </p>
        </Step>
      </ol>
    </section>
  );
}
