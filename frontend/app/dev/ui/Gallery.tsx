"use client";

import { useId, useState } from "react";
import { FaRegCircleQuestion } from "react-icons/fa6";
import { BiDonateHeart } from "react-icons/bi";
import { IoAdd, IoRemove } from "react-icons/io5";
import { Badge } from "@/app/components/shared/Badge";
import { Button, ButtonLink, IconButton } from "@/app/components/shared/Button";
import { Card, CardHeader, Heading, Panel } from "@/app/components/shared/Card";
import { Chip } from "@/app/components/shared/Chip";
import { Dialog, SidePane } from "@/app/components/shared/Dialog";
import { ExpandableText } from "@/app/components/shared/ExpandableText";
import { Field, SearchInput, Select, TextInput } from "@/app/components/shared/inputs";
import { Legend } from "@/app/components/shared/Legend";
import { Pager } from "@/app/components/shared/Pager";
import { Empty, ErrorState, Loading } from "@/app/components/shared/states";
import { SegmentedControl, TabPanel, Tabs } from "@/app/components/shared/Tabs";

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2 border-t border-line-subtle py-3 first:border-t-0 sm:flex-row sm:items-center">
      <div className="w-40 shrink-0 text-label-sm text-ink-muted">{label}</div>
      <div className="flex flex-wrap items-center gap-3">{children}</div>
    </div>
  );
}

const SWATCHES = [
  "primary", "on-primary", "primary-soft", "primary-soft-hover", "on-primary-soft", "primary-line", "link", "secondary", "secondary-soft",
  "page", "surface", "surface-raised", "surface-control", "surface-hover",
  "ink-strong", "ink", "ink-muted", "ink-disabled", "line-subtle", "line", "line-strong",
  "success", "success-soft", "warning", "warning-soft", "error", "error-soft", "info", "info-soft",
];

const TYPE: Record<string, string> = {
  display: "text-display", "headline-lg": "text-headline-lg", "headline-md": "text-headline-md", "headline-sm": "text-headline-sm",
  "title-md": "text-title-md", "title-sm": "text-title-sm", "body-lg": "text-body-lg", "body-md": "text-body-md", "body-sm": "text-body-sm",
  "label-md": "text-label-md", "label-sm": "text-label-sm", caption: "text-caption", data: "text-data",
};

export function Gallery() {
  const [tab, setTab] = useState<"speeches" | "exchanges" | "history" | "stance">("speeches");
  const [dim, setDim] = useState<"1d" | "2d">("1d");
  const [scope, setScope] = useState<"all" | "current">("all");
  const [chip, setChip] = useState("all");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(3);
  const [dialog, setDialog] = useState(false);
  const [pane, setPane] = useState(false);
  const paneTitle = useId();

  return (
    <div className="min-h-dvh bg-linear-to-b from-page to-surface">
      <main className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-8">
        <Heading level={1}>UI gallery</Heading>
        <p className="text-body-md text-ink-muted">frontend/DESIGN.md の部品と状態の一覧（開発環境のみ）。Tab キーでフォーカスリングを確認できます。</p>

        <Card>
          <CardHeader title="色" subtitle="DESIGN.md colors" />
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-6">
            {SWATCHES.map((s) => (
              <div key={s} className="flex items-center gap-2">
                <span className="size-6 shrink-0 rounded-sm border border-line" style={{ backgroundColor: `var(--color-${s})` }} />
                <span className="text-caption text-ink-muted">{s}</span>
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <CardHeader title="文字" subtitle="typography roles" />
          <div className="flex flex-col gap-2">
            {Object.entries(TYPE).map(([t, cls]) => (
              <div key={t} className="flex items-baseline gap-4">
                <span className="w-28 shrink-0 text-caption text-ink-muted">{t}</span>
                <span className={cls}>国会の会議録 KOKKAI DOC 1,248件</span>
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <CardHeader
            title="ボタン"
            subtitle="primary は1画面に1つまで"
            action={
              <Button size="sm" variant="secondary">
                注意事項
              </Button>
            }
          />
          <Row label="primary">
            <Button variant="primary" icon={<BiDonateHeart className="size-4" />}>募金する</Button>
            <Button variant="primary" size="lg">ダッシュボードを開く</Button>
            <Button variant="primary" busy>送信中</Button>
            <Button variant="primary" disabled>無効</Button>
          </Row>
          <Row label="secondary">
            <Button size="sm">小</Button>
            <Button icon={<FaRegCircleQuestion className="size-3.5" />}>使い方</Button>
            <Button size="lg">大</Button>
            <ButtonLink href="/about">このプロジェクトについて</ButtonLink>
            <Button disabled>無効</Button>
          </Row>
          <Row label="ghost">
            <Button variant="ghost">全文を表示</Button>
            <Button variant="ghost" size="sm">解除</Button>
            <Button variant="ghost" disabled>無効</Button>
          </Row>
          <Row label="icon">
            <IconButton label="拡大"><IoAdd className="size-4" /></IconButton>
            <IconButton label="縮小"><IoRemove className="size-4" /></IconButton>
            <IconButton label="縮小" size="sm"><IoRemove className="size-3.5" /></IconButton>
            <IconButton label="無効" disabled><IoRemove className="size-4" /></IconButton>
          </Row>
        </Card>

        <Card>
          <CardHeader title="タブと切り替え" />
          <Row label="Tabs">
            <Tabs
              idBase="g-tabs"
              label="詳細パネルの表示"
              value={tab}
              onChange={setTab}
              items={[
                { value: "speeches", label: "発言" },
                { value: "exchanges", label: "やり取り" },
                { value: "history", label: "選挙履歴" },
                { value: "stance", label: "立場", disabled: true },
              ]}
            />
          </Row>
          <TabPanel idBase="g-tabs" value={tab} className="pb-2 text-body-sm text-ink-muted">
            選択中：{tab}
          </TabPanel>
          <Row label="SegmentedControl">
            <SegmentedControl label="次元" value={dim} onChange={setDim} items={[{ value: "1d", label: "1D" }, { value: "2d", label: "2D" }]} />
            <SegmentedControl label="対象" value={scope} onChange={setScope} items={[{ value: "all", label: "全議員" }, { value: "current", label: "現職のみ" }]} />
            <SegmentedControl size="md" label="地図" value="map" onChange={() => {}} items={[{ value: "map", label: "地図" }, { value: "pr", label: "比例" }]} />
          </Row>
        </Card>

        <Card>
          <CardHeader title="チップとバッジ" />
          <Row label="Chip">
            {(
              [
                ["all", "全発言", undefined],
                ["econ", "経済対策", "#0ea5e9"],
                ["energy", "原発", "#f59e0b"],
                ["long", "社会保障全般の見直し（医療・介護）", "#10b981"],
              ] as Array<[string, string, string | undefined]>
            ).map(([k, l, d]) => (
              <Chip key={k} selected={chip === k} dot={d} onClick={() => setChip(k)}>
                {l}
              </Chip>
            ))}
            <Chip disabled>無効</Chip>
          </Row>
          <Row label="Badge">
            <Badge>自民</Badge>
            <Badge dot="#e0e7ff">自民</Badge>
            <Badge tone="success" label="成果">あり</Badge>
            <Badge tone="warning" label="成果">限定的</Badge>
            <Badge tone="error" label="問題点">指摘あり</Badge>
            <Badge tone="info" label="種類">政策論議</Badge>
            <Badge tone="accent">未選択</Badge>
          </Row>
        </Card>

        <Card>
          <CardHeader title="入力" />
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="議員名" htmlFor="g-search">
              <SearchInput id="g-search" value={query} onValueChange={setQuery} placeholder="例：山田 / やまだ" />
            </Field>
            <Field label="最低やり取り数" htmlFor="g-num">
              <TextInput id="g-num" type="number" defaultValue={20} />
            </Field>
            <Field label="並び替え" htmlFor="g-sel">
              <Select id="g-sel" defaultValue="rate">
                <option value="rate">成果ありの割合</option>
                <option value="count">質問の件数</option>
              </Select>
            </Field>
          </div>
          <Row label="小さいサイズ">
            <Select size="sm" aria-label="表示件数" defaultValue="25">
              <option>25</option>
              <option>50</option>
            </Select>
            <TextInput size="sm" aria-label="無効の入力" disabled placeholder="無効" className="w-32" />
          </Row>
        </Card>

        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader title="パネル、リスト、ページ送り" subtitle="カードの中はパネルまで" />
            <Panel className="flex flex-col gap-2">
              {["倉林明子", "田村貴昭", "山添拓"].map((n, i) => (
                <button
                  key={n}
                  type="button"
                  className={`rounded-lg border px-3 py-2 text-left text-body-md transition-colors ${
                    i === 1
                      ? "border-primary-line bg-primary-soft text-on-primary-soft edge-primary"
                      : "border-line bg-surface-raised text-ink hover:bg-surface-hover hover:text-ink-strong"
                  }`}
                >
                  {n}
                  <span className="ml-2 text-data text-ink-muted">質問 407件</span>
                </button>
              ))}
              <Pager page={page} pageCount={1248} onChange={setPage} className="pt-2" />
            </Panel>
          </Card>
          <Card>
            <CardHeader title="状態" />
            <div className="grid gap-3">
              <Panel><Loading /></Panel>
              <Panel><Loading rows={2} /></Panel>
              <Panel><Empty message="この条件に合う議員はいません。条件をゆるめてください。" action={<Button size="sm">条件をリセット</Button>} /></Panel>
              <Panel><ErrorState message="発言を読み込めませんでした。" onRetry={() => {}} /></Panel>
            </div>
          </Card>
        </div>

        <Card>
          <CardHeader title="長い文と凡例" />
          <ExpandableText lines={2} className="text-body-md">
            あれもこれも手をつけて結局何もできないということを恐れるので、そのことは特に与党自民党、維新の皆さんに改めて申し上げたいと思います。特に、自民党の主張する自衛隊明記論では自衛隊のできることが変わるわけではないということは、新藤幹事からも何度も御説明がありました。よく、我が国を取り巻く安全保障環境が厳しくなったから九条改正が必要だという議論があります。
          </ExpandableText>
          <Legend
            className="mt-4"
            title="色＝発言時の会派"
            unit="人"
            items={[
              { label: "自民", color: "#e0e7ff", count: 596 },
              { label: "国民", color: "#3d87f5", count: 257 },
              { label: "立憲", color: "#ee8857", count: 155 },
              { label: "根拠が少ない点", color: "#94a3b8", hollow: true },
            ]}
          />
        </Card>

        <Card>
          <CardHeader title="ダイアログとサイドパネル" />
          <Row label="開く">
            <Button onClick={() => setDialog(true)}>ダイアログ</Button>
            <Button onClick={() => setPane(true)}>サイドパネル</Button>
          </Row>
        </Card>
      </main>

      {dialog && (
        <Dialog
          title="KOKKAI DOC に募金する"
          onClose={() => setDialog(false)}
          footer={
            <>
              <Button onClick={() => setDialog(false)}>キャンセル</Button>
              <Button variant="primary" onClick={() => setDialog(false)}>募金する</Button>
            </>
          }
        >
          <p className="text-body-md">サーバー代と AI の利用料にあてます。Esc キーか背景のクリックで閉じます。</p>
        </Dialog>
      )}
      {pane && (
        <SidePane width={420} onClose={() => setPane(false)} labelledBy={paneTitle}>
          <div className="flex flex-col gap-3 overflow-y-auto p-4">
            <div className="pr-10">
              <h2 id={paneTitle} className="text-headline-sm text-ink-strong">玉木雄一郎</h2>
              <p className="text-body-sm text-ink-muted">たまきゆういちろう · 国民 · 衆議院 · 香川2区</p>
            </div>
            <Tabs
              idBase="g-pane"
              label="詳細パネルの表示"
              value={tab}
              onChange={setTab}
              items={[
                { value: "speeches", label: "発言" },
                { value: "exchanges", label: "やり取り" },
                { value: "history", label: "選挙履歴" },
                { value: "stance", label: "立場" },
              ]}
            />
            <TabPanel idBase="g-pane" value={tab}>
              <Loading rows={3} />
            </TabPanel>
          </div>
        </SidePane>
      )}
    </div>
  );
}
