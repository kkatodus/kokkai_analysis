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
import { FUNCTION_STYLE, OUTCOME_SHORT_JA } from "@/app/lib/quality";
import type { QualityContribution } from "@/app/types";
import { Button } from "./Button";
import { Badge } from "./Badge";
import { Heading, Panel } from "./Card";
import { cx } from "./cx";

/** 2026-11-09 → 2026年11月9日 (DESIGN.md "Content"). */
function fullDate(d: string | null | undefined): string | null {
  if (!d) return null;
  const [y, m, day] = d.slice(0, 10).split("-");
  if (!y || !m || !day) return d;
  return `${y}年${Number(m)}月${Number(day)}日`;
}

// Contribution levels on the quality scale: 成果あり → 成果は限定的 → 成果なし.
const CONTRIBUTION_TONE: Record<QualityContribution, { dot: string; note: string }> = {
  substantive: { dot: "bg-success", note: "bg-success-soft" },
  limited: { dot: "bg-warning", note: "bg-warning-soft" },
  none: { dot: "bg-error", note: "bg-error-soft" },
};

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
    <Button
      size="sm"
      onClick={onClick}
      aria-pressed={pressed}
      className="aria-pressed:border-primary-line aria-pressed:bg-primary-soft aria-pressed:text-on-primary-soft aria-pressed:hover:bg-primary-soft-hover"
      title={pressed ? "可視化に戻る" : "注意事項を見る"}
    >
      {pressed ? labelWhenShown : labelWhenHidden}
    </Button>
  );
}

export function DisclaimerPanel({ children, title = "注意事項" }: { children: ReactNode; title?: string }) {
  return (
    <section className="text-body-sm text-ink">
      <Heading level={3} size="title-sm" className="mb-2">
        {title}
      </Heading>
      {children}
    </section>
  );
}

export function IdeologyDisclaimerContent({ ideologyData }: { ideologyData?: IdeologyData | null }) {
  const topics = ideologyData?.data ?? [];
  const subTopics = topics.reduce((n, t) => n + (t.sub_topics?.length ?? 0), 0);
  const maxScaled = Math.max(0, ...topics.map((t) => t.n_scaled ?? 0));
  const generated = fullDate(ideologyData?.generated_at);
  const fmt = (d: string | null | undefined) => (d ? yearMonth(d) : null);

  return (
    <div className="space-y-3">
      <Slide kicker="01 これは何？" title="国会での発言から、論点ごとの「立場」を推定した参考情報です">
        <p className="text-body-sm text-ink">
          各議員が国会で述べた意見を論点ごとに要約し、その文章の意味をベクトル（数値の並び）に変換して、
          「賛成」「反対」の基準文との近さや、議員どうしの近さを図にしています。
          投票行動や公約ではなく<strong>国会での発言</strong>だけが材料で、推定には誤差と偏りが含まれます。
        </p>
        <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-3">
          <StatTile label="トピック" value={topics.length ? String(topics.length) : "—"} sub={subTopics ? `${subTopics}の論点（軸）` : undefined} />
          <StatTile label="推定された議員" value={maxScaled ? `最大${maxScaled.toLocaleString()}人` : "—"} sub="トピックごとに異なります" />
          <StatTile label="最終更新" value={generated ?? "—"} sub={ideologyData?.current_members_as_of ? `現職判定：${fullDate(ideologyData.current_members_as_of)}` : undefined} />
        </div>
        <div className="mt-2">
          <Callout tone="warn" title="立場を断定するものではありません">
            図の位置は「その論点について国会でどう語ったか」の推定です。点をクリックすると発言そのものを確認できますので、判断はご自身で行ってください。
          </Callout>
        </div>
      </Slide>

      <Slide kicker="02 どう推定しているか" title="発言 → 意見の要約 → 数値化 → 配置">
        <div className={box}>
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge>① 発言の収集</Badge>
            <Arrow />
            <Badge>② 意見文の抽出</Badge>
            <Arrow />
            <Badge>③ 論点ごとの要約（LLM）</Badge>
            <Arrow />
            <Badge>④ ベクトル化</Badge>
            <Arrow />
            <Badge>⑤ 軸への投影／2D配置</Badge>
          </div>
          <div className="mt-2 grid gap-1 text-caption text-ink sm:grid-cols-2">
            <div>① トピックの検索語を含む発言を、トピックごとの期間内から集めます</div>
            <div>② 分類モデルで「意見を述べている文」だけを残します（3文未満の人は推定しません）</div>
            <div>③ LLMがその人の意見を論点ごとに要約します（複数回行い平均します）</div>
            <div>④ 要約文を埋め込みモデルで数値ベクトルにします</div>
            <div className="sm:col-span-2">⑤ 「賛成」「反対」の基準となる文章（生成した模範発言）との位置関係で1次元に、議員どうしの近さで2次元に配置します</div>
            <div className="text-link sm:col-span-2">
              ③ の要約の本文は議員の詳細パネル「立場」タブで読めます。要約には氏名を含めないよう指示していますが、役職名が残ることがあります。
            </div>
          </div>
        </div>
      </Slide>

      <Slide kicker="03 2つの見方" title="1D と 2D は別のものを見せています">
        <div className="grid gap-2 sm:grid-cols-2">
          <div className={box}>
            <BoxTitle>1D：賛成 ↔ 反対 の軸</BoxTitle>
            <div className="mt-1 flex items-center gap-1 text-caption text-ink-muted">
              <span>反対</span>
              <div className="relative h-1.5 flex-1 rounded-full bg-surface-hover">
                <div className="absolute inset-y-0 left-1/2 w-px bg-ink-muted" />
              </div>
              <span>賛成</span>
            </div>
            <ul className={list}>
              <li>論点ごとに「賛成の模範発言」と「反対の模範発言」を両端に置き、その直線上に各議員を投影します</li>
              <li>中央の線が中間点。左右の距離は相対的なもので、絶対的な強さではありません</li>
              <li>上下の並びは順位で、意味はありません</li>
            </ul>
          </div>
          <div className={box}>
            <BoxTitle>2D：近い人ほど似た語り方</BoxTitle>
            <ul className={list}>
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
              <div key={t.topic} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-2 rounded-lg bg-surface-raised px-2 py-1 text-caption sm:grid-cols-[minmax(0,1fr)_auto_auto]">
                <div className="truncate text-ink-strong">{t.topic_jp ?? t.topic_en ?? t.topic}</div>
                <div className="text-ink-muted max-sm:order-last max-sm:col-span-2">
                  {fmt(t.window?.from) ?? "—"}〜{fmt(t.window?.to) ?? "現在"}
                </div>
                <div className="text-data text-ink">
                  {t.n_scaled?.toLocaleString() ?? "—"}人{t.n_current != null ? <span className="text-ink-muted">（現職{t.n_current.toLocaleString()}人）</span> : null}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-caption text-ink-muted">トピック情報を読み込めませんでした。</p>
        )}
        <div className="mt-2 text-caption text-ink-muted">
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

      <Slide kicker="06 手法" title="使用したモデルと参考文献">
        <div className="grid gap-1 text-caption text-ink">
          <div>
            <span className="text-ink-muted">要約：</span>
            <span className="font-mono text-ink-strong">{ideologyData?.summary_model ?? "—"}</span>
          </div>
          <div>
            <span className="text-ink-muted">埋め込み：</span>
            <span className="font-mono text-ink-strong">{ideologyData?.embed_model ?? "cl-tohoku/bert-base-japanese-v3"}</span>
          </div>
          <div>
            <span className="text-ink-muted">2D配置：</span>UMAP（n_neighbors=30）
          </div>
          <div>
            <span className="text-ink-muted">論文：</span>
            <a href="https://arxiv.org/abs/2505.07118" target="_blank" rel="noopener noreferrer" className="text-link underline underline-offset-2">
              KOKKAI DOC: An LLM-driven framework for scaling parliamentary representatives
            </a>
          </div>
        </div>
      </Slide>
    </div>
  );
}

function Slide({ title, kicker, children }: { title: string; kicker?: string; children: ReactNode }) {
  return (
    <Panel>
      {kicker && <p className="text-label-sm text-link">{kicker}</p>}
      <Heading level={3} size="title-sm" className="mb-2">
        {title}
      </Heading>
      {children}
    </Panel>
  );
}

function StatTile({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-lg bg-surface-raised px-3 py-2">
      <div className="text-caption text-ink-muted">{label}</div>
      <div className="text-title-md text-ink-strong tabular-nums">{value}</div>
      {sub && <div className="text-caption text-ink-muted">{sub}</div>}
    </div>
  );
}

function Callout({ tone, title, children }: { tone: "info" | "warn" | "good"; title: string; children: ReactNode }) {
  const cls =
    tone === "warn"
      ? "bg-warning-soft text-on-warning-soft"
      : tone === "good"
        ? "bg-success-soft text-on-success-soft"
        : "bg-info-soft text-on-info-soft";
  return (
    <div className={cx("rounded-lg p-3", cls)}>
      <p className="mb-0.5 text-label-md">{title}</p>
      <p className="text-body-sm">{children}</p>
    </div>
  );
}

/** Inner box of a slide: a fill, no outline (a panel holds no bordered box). */
const box = "rounded-lg bg-surface-raised p-3";
const list = "mt-1.5 ml-4 list-disc space-y-0.5 text-body-sm text-ink";

function BoxTitle({ children }: { children: ReactNode }) {
  return <p className="text-label-md text-ink-strong">{children}</p>;
}

function Arrow() {
  return (
    <span aria-hidden className="text-ink-muted">
      →
    </span>
  );
}

const pill = "inline-flex items-center justify-center rounded-full border px-2 py-0.5 text-label-sm whitespace-nowrap ";

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
        <p className="text-body-sm text-ink">
          国会会議録（一次情報）の委員会質疑を、大規模言語モデル（LLM）が「何のための議論か」「成果があったか」「問題点があったか」の3つの軸で分類しています。
          議員や大臣の能力・意図・誠実性・政治的立場を断定するものではありません。
        </p>
        <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-3">
          <StatTile label="対象期間" value={cov?.from ? `${yearMonth(cov.from)}〜` : "—"} sub={cov?.to ? `${yearMonth(cov.to)}まで（順次さかのぼり中）` : undefined} />
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
        <div className={box}>
          <p className="mb-1 text-caption text-ink-muted">ひとつのやり取り</p>
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge tone="accent">質問者A</Badge>
            <Arrow />
            <Badge>大臣</Badge>
            <Arrow />
            <Badge tone="accent">質問者A</Badge>
            <Arrow />
            <Badge>政府参考人</Badge>
            <Arrow />
            <Badge tone="accent">質問者A</Badge>
            <span aria-hidden className="text-ink-muted">…</span>
          </div>
          <div className="mt-2 grid gap-1 text-caption text-ink sm:grid-cols-2">
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
          <div className={box}>
            <BoxTitle>何のためのやり取りか</BoxTitle>
            <p className="mb-2 text-caption text-ink-muted">種類の分類。良し悪しではありません。主なものを一つ。</p>
            <div className="grid gap-1.5">
              {FUNCTIONS.map((f) => (
                <div key={f} className="flex items-start gap-2">
                  <span className={pill + "w-[8.5rem] shrink-0 " + FUNCTION_STYLE[f].chip}>{FUNCTION_JA[f]}</span>
                  <span className="text-caption text-ink">{FUNCTION_DESC_JA[f]}</span>
                </div>
              ))}
            </div>
          </div>

          <div className={box}>
            <BoxTitle>成果（やり取り全体として）</BoxTitle>
            <p className="mb-2 text-caption text-ink-muted">棒グラフの色はこの3段階です。</p>
            <div className="grid gap-1.5 sm:grid-cols-3">
              {CONTRIBUTIONS.map((c) => (
                <div key={c} className={cx("rounded-lg p-2", CONTRIBUTION_TONE[c].note)}>
                  <div className="flex items-center gap-1.5">
                    <span aria-hidden className={cx("inline-block size-2.5 rounded-full", CONTRIBUTION_TONE[c].dot)} />
                    <span className="text-label-sm text-ink-strong">{CONTRIBUTION_JA[c]}</span>
                  </div>
                  <div className="mt-0.5 text-caption text-ink">{CONTRIBUTION_DESC_JA[c]}</div>
                </div>
              ))}
            </div>
            <p className="mt-2 text-caption text-ink-muted">成果の内訳</p>
            <div className="mt-1 flex flex-wrap items-center gap-1">
              {OUTCOMES.map((o) => (
                <Badge key={o} tone="success" title={OUTCOME_JA[o]}>
                  {OUTCOME_SHORT_JA[o]}
                </Badge>
              ))}
              <span className="text-caption text-ink-muted">既存施策の確認・後押しは「提案」に含めません</span>
            </div>
          </div>

          <div className={box}>
            <BoxTitle>問題点（該当する場合のみ）</BoxTitle>
            <p className="mb-2 text-caption text-ink-muted">
              誰の問題か（<span className="text-ink">質問者／答弁者</span>）と、やり取りの
              <Badge tone="warning" className="mx-1">一部</Badge>か
              <Badge tone="error" className="mx-1">大半</Badge>かを区別します。
            </p>
            <div className="grid gap-1.5">
              {ISSUE_TYPES.map((t) => (
                <div key={t} className="flex items-start gap-2">
                  <Badge tone="warning" className="w-[8.5rem] shrink-0 justify-center">
                    {ISSUE_JA[t]}
                    {t === "evasive" && <span className="ml-1 font-normal">（答弁）</span>}
                  </Badge>
                  <span className="text-caption text-ink">{ISSUE_DESC_JA[t]}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </Slide>

      {/* 4. who gets counted */}
      <Slide kicker="04 誰に数えるか" title="質問者としての記録と、答弁者としての記録を分けて集計します">
        <div className="grid gap-2 sm:grid-cols-2">
          <div className={box}>
            <BoxTitle>質問者として</BoxTitle>
            <ul className={list}>
              <li>その人が始めたやり取りが対象</li>
              <li>何のため・成果・成果の内訳</li>
              <li>質問者側の問題点（お膳立て、演説、繰り返し、私生活、人格攻撃、議事の争い）</li>
            </ul>
          </div>
          <div className={box}>
            <BoxTitle>答弁者として</BoxTitle>
            <ul className={list}>
              <li>大臣・副大臣・政府参考人・法案提出者として答えたやり取りが対象</li>
              <li>答弁者側の問題点（はぐらかし、人格攻撃、議事の争い）</li>
              <li>答弁から新事実が出たか、具体的な約束をしたか</li>
            </ul>
          </div>
        </div>
        <div className="mt-2 text-caption text-ink-muted">
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
      <Slide kicker="06 手法" title="使用したモデルとプロンプト">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-caption text-ink">
          <div>
            <span className="text-ink-muted">モデル：</span>
            <span className="font-mono text-ink-strong">{modelText}</span>
          </div>
          <div>
            <span className="text-ink-muted">設定：</span>バッチ処理、temperature 0、思考レベル low
          </div>
          <div>
            <span className="text-ink-muted">プロンプト：</span>
            {QUALITY_PROMPT_VERSION}
          </div>
        </div>
        <details className="mt-2 rounded-lg bg-surface-raised px-3 py-2">
          <summary className="cursor-pointer text-label-md text-link select-none">
            プロンプト全文を表示
          </summary>
          <pre className="mt-2 max-h-72 overflow-auto rounded-lg bg-surface p-2 text-caption whitespace-pre-wrap text-ink">
            {QUALITY_SYSTEM_PROMPT}
          </pre>
          <div className="mt-1 text-caption text-ink-muted">
            結果を再現する際には、モデルのバージョン、前処理・後処理、設定の差により結果が変わり得ます。
          </div>
        </details>
      </Slide>
    </div>
  );
}
