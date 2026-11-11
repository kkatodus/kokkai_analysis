"use client";

import type { ReactNode } from "react";
import type { IdeologyData, QualityAggregate } from "@/app/types";
import {
  CONTRIBUTION_DESC_JA,
  CONTRIBUTION_JA,
  CONTRIBUTIONS,
  FUNCTION_DESC_JA,
  FUNCTION_JA,
  FUNCTIONS,
  ISSUE_DESC_JA,
  ISSUE_JA,
  ISSUE_TYPES,
  OUTCOME_JA,
  OUTCOMES,
  yearMonth,
} from "@/app/lib/quality";
import { QUALITY_PROMPT_VERSION, QUALITY_SYSTEM_PROMPT } from "@/app/lib/qualityPrompt";
import { CONTRIBUTION_STYLE, FUNCTION_STYLE, ISSUE_CHIP, ISSUE_CHIP_PART, OUTCOME_CHIP, OUTCOME_SHORT_JA } from "@/app/lib/quality";

export function DisclaimerToggleButton({
  pressed,
  onClick,
  labelWhenHidden = "注意事項",
  labelWhenShown = "可視化を表示",
}: {
  pressed: boolean;
  onClick: () => void;
  labelWhenHidden?: string;
  labelWhenShown?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={pressed}
      className={
        "rounded-full border px-3 py-1 text-[11px] font-semibold transition-all " +
        (pressed
          ? "border-cyan-400/50 bg-cyan-500/15 text-cyan-100 hover:bg-cyan-500/20"
          : "border-slate-400/30 bg-slate-950/20 text-gray-200 hover:bg-white/5")
      }
      title={pressed ? "可視化に戻る" : "注意事項を見る"}
    >
      {pressed ? labelWhenShown : labelWhenHidden}
    </button>
  );
}

export function DisclaimerPanel({ children, title = "注意事項" }: { children: ReactNode; title?: string }) {
  return (
    <div className="rounded-xl border border-slate-400/15 bg-slate-950/20 p-3 text-[12px] leading-relaxed text-gray-200">
      <div className="mb-2 text-[11px] font-semibold text-gray-100">{title}</div>
      <div className="space-y-2 text-gray-300">{children}</div>
    </div>
  );
}

export function IdeologyDisclaimerContent({ ideologyData }: { ideologyData?: IdeologyData | null }) {
  const topics = ideologyData?.data ?? [];
  const subTopics = topics.reduce((n, t) => n + (t.sub_topics?.length ?? 0), 0);
  const maxScaled = Math.max(0, ...topics.map((t) => t.n_scaled ?? 0));
  const generated = ideologyData?.generated_at ? ideologyData.generated_at.slice(0, 10) : null;
  const fmt = (d: string | null | undefined) => (d ? yearMonth(d) : null);

  return (
    <div className="space-y-3">
      <Slide kicker="01 これは何？" title="国会での発言から、論点ごとの「立場」を推定した参考情報です">
        <p className="text-[12px] leading-relaxed text-gray-200">
          各議員が国会で述べた意見を論点ごとに要約し、その文章の意味をベクトル（数値の並び）に変換して、
          「賛成」「反対」の基準文との近さや、議員どうしの近さを図にしています。
          投票行動や公約ではなく<strong>国会での発言</strong>だけが材料で、推定には誤差と偏りが含まれます。
        </p>
        <div className="mt-2 grid grid-cols-3 gap-2">
          <StatTile label="トピック" value={topics.length ? String(topics.length) : "—"} sub={subTopics ? `${subTopics} の論点（軸）` : undefined} />
          <StatTile label="推定された議員" value={maxScaled ? `最大 ${maxScaled.toLocaleString()} 人` : "—"} sub="トピックごとに異なります" />
          <StatTile label="最終更新" value={generated ?? "—"} sub={ideologyData?.current_members_as_of ? `現職判定 ${ideologyData.current_members_as_of.slice(0, 10)}` : undefined} />
        </div>
        <div className="mt-2">
          <Callout tone="warn" title="立場を断定するものではありません">
            図の位置は「その論点について国会でどう語ったか」の推定です。点をクリックすると発言そのものを確認できますので、判断はご自身で行ってください。
          </Callout>
        </div>
      </Slide>

      <Slide kicker="02 どう推定しているか" title="発言 → 意見の要約 → 数値化 → 配置">
        <div className="rounded-xl border border-slate-400/15 bg-slate-900/60 p-2.5">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className={pill + "border-slate-400/40 bg-slate-500/15 text-slate-100"}>① 発言の収集</span>
            <span className="text-gray-500">→</span>
            <span className={pill + "border-slate-400/40 bg-slate-500/15 text-slate-100"}>② 意見文の抽出</span>
            <span className="text-gray-500">→</span>
            <span className={pill + "border-cyan-400/40 bg-cyan-500/15 text-cyan-100"}>③ 論点ごとの要約（LLM）</span>
            <span className="text-gray-500">→</span>
            <span className={pill + "border-violet-400/40 bg-violet-500/15 text-violet-100"}>④ ベクトル化</span>
            <span className="text-gray-500">→</span>
            <span className={pill + "border-emerald-400/40 bg-emerald-500/15 text-emerald-100"}>⑤ 軸への投影／2D配置</span>
          </div>
          <div className="mt-2 grid gap-1 text-[11px] text-gray-300 sm:grid-cols-2">
            <div>① トピックの検索語を含む発言を、トピックごとの期間内から集めます</div>
            <div>② 分類モデルで「意見を述べている文」だけを残します（3文未満の人は推定しません）</div>
            <div>③ LLMがその人の意見を論点ごとに要約します（複数回行い平均します）</div>
            <div>④ 要約文を埋め込みモデルで数値ベクトルにします</div>
            <div className="sm:col-span-2">⑤ 「賛成」「反対」の基準となる文章（生成した模範発言）との位置関係で1次元に、議員どうしの近さで2次元に配置します</div>
            <div className="sm:col-span-2 text-cyan-200/90">
              ③ の要約の本文は議員の詳細パネル「立場」タブで読めます。要約には氏名を含めないよう指示していますが、役職名が残ることがあります。
            </div>
          </div>
        </div>
      </Slide>

      <Slide kicker="03 2つの見方" title="1D と 2D は別のものを見せています">
        <div className="grid gap-2 sm:grid-cols-2">
          <div className="rounded-xl border border-cyan-400/25 bg-cyan-500/10 p-2.5">
            <div className="text-[12px] font-semibold text-cyan-100">1D：賛成 ↔ 反対 の軸</div>
            <div className="mt-1 flex items-center gap-1 text-[10px] text-gray-300">
              <span>反対</span>
              <div className="relative h-1.5 flex-1 rounded-full bg-slate-900/70 ring-1 ring-slate-400/10">
                <div className="absolute inset-y-0 left-1/2 w-px bg-white/60" />
              </div>
              <span>賛成</span>
            </div>
            <ul className="mt-1.5 ml-4 list-disc space-y-0.5 text-[11px] text-gray-200">
              <li>論点ごとに「賛成の模範発言」と「反対の模範発言」を両端に置き、その直線上に各議員を投影します</li>
              <li>中央の線が中間点。左右の距離は相対的なもので、絶対的な強さではありません</li>
              <li>上下の並びは順位で、意味はありません</li>
            </ul>
          </div>
          <div className="rounded-xl border border-violet-400/25 bg-violet-500/10 p-2.5">
            <div className="text-[12px] font-semibold text-violet-100">2D：近い人ほど似た語り方</div>
            <ul className="mt-1.5 ml-4 list-disc space-y-0.5 text-[11px] text-gray-200">
              <li>高次元のベクトルをUMAPで平面に圧縮したもの。縦軸・横軸そのものに意味はありません</li>
              <li>近くにある議員は、その論点について似た内容・論調で語っています</li>
              <li>「賛成」「反対」の基準点も同じ図に置いています</li>
              <li>「現職のみ」では現職だけで配置し直すため、位置関係が変わります</li>
            </ul>
          </div>
        </div>
      </Slide>

      <Slide kicker="04 対象と期間" title="トピックごとに、対象とする発言の期間が違います">
        {topics.length ? (
          <div className="grid gap-1">
            {topics.map((t) => (
              <div key={t.topic} className="grid grid-cols-[1fr_auto_auto] items-center gap-2 rounded-lg border border-slate-400/10 bg-slate-900/50 px-2 py-1 text-[11px]">
                <div className="truncate text-gray-100">{t.topic_jp ?? t.topic_en ?? t.topic}</div>
                <div className="text-gray-400">
                  {fmt(t.window?.from) ?? "—"}〜{fmt(t.window?.to) ?? "現在"}
                </div>
                <div className="tabular-nums text-gray-300">
                  {t.n_scaled?.toLocaleString() ?? "—"} 人{t.n_current != null ? <span className="text-gray-500">（現職 {t.n_current}）</span> : null}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-[11px] text-gray-400">トピック情報を読み込めませんでした。</div>
        )}
        <div className="mt-2 text-[11px] text-gray-400">
          期間外の発言は使いません。期間内にその論点で意見を述べていない議員は図に現れません（沈黙は「中立」ではなく「不明」です）。
        </div>
      </Slide>

      <Slide kicker="05 読み方の注意" title="図を読むときに知っておいてほしいこと">
        <div className="grid gap-2 sm:grid-cols-2">
          <Callout tone="info" title="発言だけが材料です">
            採決での投票、公約、党の方針は使っていません。国会で語った内容と、実際の行動が違うことはあり得ます。
          </Callout>
          <Callout tone="warn" title="発言が少ない人ほどぶれます">
            要約の材料が数文しかない議員の位置は不安定です。大臣など答弁側の発言は「意見」として拾われにくく、位置がずれることがあります。
          </Callout>
          <Callout tone="warn" title="モデルに依存します">
            要約するLLMや埋め込みモデルを替えると位置は動きます。この不安定さ自体を研究対象にした後続の論文を準備中です。
          </Callout>
          <Callout tone="good" title="原文にたどれます">
            点をクリックすると詳細パネルが開き、その議員の発言を論点ごとに読めます。図は入口として使ってください。
          </Callout>
        </div>
      </Slide>

      <Slide kicker="06 手法" title="使用したモデルと参考文献" className="bg-slate-950/20">
        <div className="grid gap-1 text-[11px] text-gray-300">
          <div>
            <span className="text-gray-400">要約：</span>
            <span className="font-mono text-gray-100">{ideologyData?.summary_model ?? "—"}</span>
          </div>
          <div>
            <span className="text-gray-400">埋め込み：</span>
            <span className="font-mono text-gray-100">{ideologyData?.embed_model ?? "cl-tohoku/bert-base-japanese-v3"}</span>
          </div>
          <div>
            <span className="text-gray-400">2D配置：</span>UMAP（n_neighbors=30）
          </div>
          <div>
            <span className="text-gray-400">論文：</span>
            <a href="https://arxiv.org/abs/2505.07118" target="_blank" rel="noopener noreferrer" className="text-cyan-200 underline-offset-2 hover:underline">
              KOKKAI DOC: An LLM-driven framework for scaling parliamentary representatives
            </a>
          </div>
        </div>
      </Slide>
    </div>
  );
}

function Slide({ title, kicker, children, className = "" }: { title: string; kicker?: string; children: ReactNode; className?: string }) {
  return (
    <section className={"rounded-2xl border border-slate-400/15 bg-slate-950/40 p-3 " + className}>
      {kicker && <div className="text-[10px] font-semibold uppercase tracking-wider text-cyan-300/80">{kicker}</div>}
      <div className="mb-2 text-[14px] font-semibold text-gray-50">{title}</div>
      {children}
    </section>
  );
}

function StatTile({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-xl border border-slate-400/15 bg-slate-900/60 px-3 py-2">
      <div className="text-[10px] text-gray-400">{label}</div>
      <div className="text-[16px] font-semibold tabular-nums text-gray-50">{value}</div>
      {sub && <div className="text-[10px] text-gray-500">{sub}</div>}
    </div>
  );
}

function Callout({ tone, title, children }: { tone: "info" | "warn" | "good"; title: string; children: ReactNode }) {
  const cls =
    tone === "warn"
      ? "border-amber-400/30 bg-amber-500/10"
      : tone === "good"
        ? "border-emerald-400/30 bg-emerald-500/10"
        : "border-cyan-400/30 bg-cyan-500/10";
  return (
    <div className={"rounded-xl border p-2.5 " + cls}>
      <div className="mb-0.5 text-[11px] font-semibold text-gray-50">{title}</div>
      <div className="text-[11px] leading-relaxed text-gray-200">{children}</div>
    </div>
  );
}

const pill = "rounded-full border px-2 py-0.5 text-[10px] font-semibold whitespace-nowrap ";

export function SpeechQualityDisclaimerContent({ aggregate }: { aggregate: QualityAggregate | null }) {
  const cov = aggregate?.coverage ?? null;
  // Models that labelled at least 1% of the exchanges (a two-exchange smoke test on another model is left out).
  const allModels = Object.entries(aggregate?.models ?? {}).sort((a, b) => b[1] - a[1]);
  const modelTotal = allModels.reduce((n, [, c]) => n + c, 0);
  const modelEntries = allModels.filter(([, c]) => c >= modelTotal * 0.01);
  const modelText = modelEntries.length ? modelEntries.map(([m]) => m).join("、") : "gemini-3.8-flash";

  return (
    <div className="space-y-3">
      {/* 1. what this is */}
      <Slide kicker="01 これは何？" title="委員会の「やり取り」をAIが分類した参考情報です">
        <p className="text-[12px] leading-relaxed text-gray-200">
          国会会議録（一次情報）の委員会質疑を、大規模言語モデル（LLM）が「何のための議論か」「成果があったか」「問題点があったか」の3つの軸で分類しています。
          議員や大臣の能力・意図・誠実性・政治的立場を断定するものではありません。
        </p>
        <div className="mt-2 grid grid-cols-3 gap-2">
          <StatTile label="対象期間" value={cov?.from ? `${yearMonth(cov.from)}〜` : "—"} sub={cov?.to ? `${yearMonth(cov.to)} まで（順次さかのぼり中）` : undefined} />
          <StatTile label="やり取り" value={cov ? cov.exchanges.toLocaleString() : "—"} sub="2000年以降の委員会質疑が対象" />
          <StatTile label="会議" value={cov ? cov.meetings.toLocaleString() : "—"} sub="本会議は対象外" />
        </div>
        <div className="mt-2">
          <Callout tone="warn" title="必ず原文を確認してください">
            表示は推定です。各やり取りから会議録の原文を開けますので、判断はご自身で行ってください。
          </Callout>
        </div>
      </Slide>

      {/* 2. unit */}
      <Slide kicker="02 評価の単位" title="発言ひとつではなく、「質問の持ち時間＋それへの答弁」をひとまとまりで見ます">
        <div className="rounded-xl border border-slate-400/15 bg-slate-900/60 p-2.5">
          <div className="mb-1 text-[10px] text-gray-400">ひとつのやり取り</div>
          <div className="flex flex-wrap items-center gap-1.5">
            <span className={pill + "border-cyan-400/40 bg-cyan-500/15 text-cyan-100"}>質問者 A</span>
            <span className="text-gray-500">→</span>
            <span className={pill + "border-slate-400/40 bg-slate-500/15 text-slate-100"}>大臣</span>
            <span className="text-gray-500">→</span>
            <span className={pill + "border-cyan-400/40 bg-cyan-500/15 text-cyan-100"}>質問者 A</span>
            <span className="text-gray-500">→</span>
            <span className={pill + "border-slate-400/40 bg-slate-500/15 text-slate-100"}>政府参考人</span>
            <span className="text-gray-500">→</span>
            <span className={pill + "border-cyan-400/40 bg-cyan-500/15 text-cyan-100"}>質問者 A</span>
            <span className="text-gray-500">…</span>
          </div>
          <div className="mt-2 grid gap-1 text-[11px] text-gray-300 sm:grid-cols-2">
            <div>・ 次の委員に質問者が替わるところで、やり取りが切り替わります</div>
            <div>・ ラベルはやり取り全体に一つ。質問者側と答弁者側の問題点は区別します</div>
            <div>・ ごく短い手続き的なやり取り、答弁のないやり取りは対象外</div>
            <div>・ 会議名・日付・会派・同じ会議での前のやり取りの冒頭も文脈として渡します</div>
          </div>
        </div>
      </Slide>

      {/* 3. the three axes */}
      <Slide kicker="03 3つの軸" title="何のため ／ 成果 ／ 問題点">
        <div className="grid gap-2">
          <div className="rounded-xl border border-slate-400/15 bg-slate-900/60 p-2.5">
            <div className="mb-1 text-[12px] font-semibold text-gray-50">何のためのやり取りか</div>
            <div className="mb-2 text-[10px] text-gray-400">種類の分類。良し悪しではありません。主なものを一つ。</div>
            <div className="grid gap-1.5">
              {FUNCTIONS.map((f) => (
                <div key={f} className="flex items-start gap-2">
                  <span className={pill + "w-[7.5rem] shrink-0 text-center " + FUNCTION_STYLE[f].chip}>{FUNCTION_JA[f]}</span>
                  <span className="text-[11px] leading-snug text-gray-300">{FUNCTION_DESC_JA[f]}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-slate-400/15 bg-slate-900/60 p-2.5">
            <div className="mb-1 text-[12px] font-semibold text-gray-50">成果（やり取り全体として）</div>
            <div className="mb-2 text-[10px] text-gray-400">棒グラフの色はこの3段階です。</div>
            <div className="grid gap-1.5 sm:grid-cols-3">
              {CONTRIBUTIONS.map((c) => (
                <div key={c} className={"rounded-lg border p-2 " + CONTRIBUTION_STYLE[c].note}>
                  <div className="flex items-center gap-1.5">
                    <span className={`inline-block h-2.5 w-2.5 rounded-full ${CONTRIBUTION_STYLE[c].dot}`} />
                    <span className="text-[11px] font-semibold text-gray-50">{CONTRIBUTION_JA[c]}</span>
                  </div>
                  <div className="mt-0.5 text-[11px] leading-snug text-gray-300">{CONTRIBUTION_DESC_JA[c]}</div>
                </div>
              ))}
            </div>
            <div className="mt-2 text-[10px] text-gray-400">成果の内訳</div>
            <div className="mt-1 flex flex-wrap gap-1">
              {OUTCOMES.map((o) => (
                <span key={o} className={pill + OUTCOME_CHIP} title={OUTCOME_JA[o]}>
                  {OUTCOME_SHORT_JA[o]}
                </span>
              ))}
              <span className="text-[10px] text-gray-400">既存施策の確認・後押しは「提案」に含めません</span>
            </div>
          </div>

          <div className="rounded-xl border border-slate-400/15 bg-slate-900/60 p-2.5">
            <div className="mb-1 text-[12px] font-semibold text-gray-50">問題点（該当する場合のみ）</div>
            <div className="mb-2 text-[10px] text-gray-400">
              誰の問題か（<span className="text-gray-200">質問者／答弁者</span>）と、やり取りの
              <span className={pill + ISSUE_CHIP_PART + " mx-1"}>一部</span>か
              <span className={pill + ISSUE_CHIP + " mx-1"}>大半</span>かを区別します。
            </div>
            <div className="grid gap-1.5">
              {ISSUE_TYPES.map((t) => (
                <div key={t} className="flex items-start gap-2">
                  <span className={pill + "w-[8.5rem] shrink-0 text-center " + (t === "evasive" ? "border-violet-400/30 bg-violet-500/15 text-violet-100" : ISSUE_CHIP_PART)}>
                    {ISSUE_JA[t]}
                    {t === "evasive" && <span className="ml-1 font-normal opacity-80">答弁</span>}
                  </span>
                  <span className="text-[11px] leading-snug text-gray-300">{ISSUE_DESC_JA[t]}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </Slide>

      {/* 4. who gets counted */}
      <Slide kicker="04 誰に数えるか" title="質問者としての記録と、答弁者としての記録を分けて集計します">
        <div className="grid gap-2 sm:grid-cols-2">
          <div className="rounded-xl border border-cyan-400/25 bg-cyan-500/10 p-2.5">
            <div className="text-[12px] font-semibold text-cyan-100">質問者として</div>
            <ul className="mt-1 ml-4 list-disc space-y-0.5 text-[11px] text-gray-200">
              <li>その人が始めたやり取りが対象</li>
              <li>何のため・成果・成果の内訳</li>
              <li>質問者側の問題点（お膳立て、演説、繰り返し、私生活、人格攻撃、議事の争い）</li>
            </ul>
          </div>
          <div className="rounded-xl border border-violet-400/25 bg-violet-500/10 p-2.5">
            <div className="text-[12px] font-semibold text-violet-100">答弁者として</div>
            <ul className="mt-1 ml-4 list-disc space-y-0.5 text-[11px] text-gray-200">
              <li>大臣・副大臣・政府参考人・法案提出者として答えたやり取りが対象</li>
              <li>答弁者側の問題点（はぐらかし、人格攻撃、議事の争い）</li>
              <li>答弁から新事実が出たか、具体的な約束をしたか</li>
            </ul>
          </div>
        </div>
        <div className="mt-2 text-[11px] text-gray-400">
          発言者と議員の対応付けは自動で行っています。対応付けできなかった発言は、どの議員にも数えられません。
        </div>
      </Slide>

      {/* 5. how to read */}
      <Slide kicker="05 読み方の注意" title="数字を見るときに知っておいてほしいこと">
        <div className="grid gap-2 sm:grid-cols-2">
          <Callout tone="good" title="疑わしきは本人に有利に">
            否定的なラベルは、問題が明らかな場合にだけ付くようモデルに指示しています。迷ったら付けません。質問者にも答弁者にも同じです。
          </Callout>
          <Callout tone="info" title="「成果」と「問題点」は別の指標">
            冒頭の一言が演説的でも、残りに中身があれば成果は「成果あり」です。問題点の割合が高くても成果がないとは限りません。
          </Callout>
          <Callout tone="info" title="党派で基準を変えません">
            不祥事の追及は主に野党、お膳立て質問は主に与党の行動なので、基準は双方を数えます。公金・公的権限に関わる不祥事の追及は正当な「行政監視」で、私生活への固執だけを問題点とします。
          </Callout>
          <Callout tone="warn" title="それでも誤りや偏りはあります">
            モデルの判断には誤りが含まれます。ランキングは件数が少ない人ほどぶれます（最低やり取り数で絞れます）。
          </Callout>
        </div>
      </Slide>

      {/* 6. method */}
      <Slide kicker="06 手法" title="使用したモデルとプロンプト" className="bg-slate-950/20">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-gray-300">
          <div>
            <span className="text-gray-400">モデル：</span>
            <span className="font-mono text-gray-100">{modelText}</span>
          </div>
          <div>
            <span className="text-gray-400">設定：</span>バッチ処理、temperature 0、思考レベル low
          </div>
          <div>
            <span className="text-gray-400">プロンプト：</span>
            {QUALITY_PROMPT_VERSION}
          </div>
        </div>
        <details className="mt-2 rounded-lg border border-slate-400/15 bg-slate-950/30 px-3 py-2">
          <summary className="cursor-pointer select-none text-[11px] font-semibold text-gray-100 hover:text-white">
            プロンプト全文を表示
          </summary>
          <pre className="mt-2 max-h-72 overflow-auto whitespace-pre-wrap rounded-md border border-slate-400/15 bg-black/20 p-2 text-[11px] text-gray-200">
            {QUALITY_SYSTEM_PROMPT}
          </pre>
          <div className="mt-1 text-[11px] text-gray-400">
            結果を再現する際には、モデルのバージョン、前処理・後処理、設定の差により結果が変わり得ます。
          </div>
        </details>
      </Slide>
    </div>
  );
}
