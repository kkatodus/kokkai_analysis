"use client";

import { useCallback, useEffect, useState } from "react";
import { BiDonateHeart } from "react-icons/bi";
import { FaUserAlt } from "react-icons/fa";
import { IoAdd, IoRemove } from "react-icons/io5";
import { createCheckoutSession } from "@/app/lib/services/paymentService";
import { track } from "@vercel/analytics";
import { Button, IconButton } from "@/app/components/shared/Button";
import { selectedClass } from "@/app/components/shared/Chip";
import { cx } from "@/app/components/shared/cx";
import { Dialog } from "@/app/components/shared/Dialog";
import { ErrorState, Loading } from "@/app/components/shared/states";
import { SegmentedControl } from "@/app/components/shared/Tabs";

type DonateModalProps = {
  removeModal?: () => void;
};

type PlanId = "s" | "m" | "l";
type Plan = { id: PlanId; price: number; quantity: number; name: string };

const yen = (n: number) => `${n.toLocaleString("ja-JP")}円`;

export function DonateModal({ removeModal }: DonateModalProps) {
  const [donors, setDonors] = useState<string[] | null>(null);
  const [donorsFailed, setDonorsFailed] = useState(false);
  const [page, setPage] = useState<"donors" | "payment">("donors");
  const [subscription, setSubscription] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitFailed, setSubmitFailed] = useState(false);

  const [items, setItems] = useState<Record<PlanId, Plan>>({
    s: { id: "s", price: 100, quantity: 0, name: "ちょっと応援する" },
    m: { id: "m", price: 1000, quantity: 0, name: "もっと応援する" },
    l: { id: "l", price: 10000, quantity: 0, name: "めっちゃ応援する" },
  });

  const totalPrice = Object.values(items).reduce((acc, it) => acc + it.price * it.quantity, 0);

  const loadDonors = useCallback(async (signal?: { cancelled: boolean }) => {
    setDonorsFailed(false);
    setDonors(null);
    try {
      const res = await fetch("/api/donors", { cache: "no-store" });
      if (!res.ok) throw new Error(`Request failed: ${res.status}`);
      const data = (await res.json()) as { donors: string[] };
      if (!signal?.cancelled) setDonors(Array.isArray(data.donors) ? data.donors : []);
    } catch {
      if (!signal?.cancelled) setDonorsFailed(true);
    }
  }, []);

  useEffect(() => {
    track("ViewDonationModal", { page: "donors" });
    const signal = { cancelled: false };
    void loadDonors(signal);
    return () => {
      signal.cancelled = true;
    };
  }, [loadDonors]);

  const close = () => {
    track("CloseDonationModal", { location: "donation_modal" });
    removeModal?.();
  };

  const makePayment = async () => {
    setIsSubmitting(true);
    setSubmitFailed(false);
    try {
      track("StartCheckout", {
        type: subscription ? "subscription" : "one_time",
        totalPrice,
        sQty: items.s.quantity,
        mQty: items.m.quantity,
        lQty: items.l.quantity,
        isDonorListEligible: totalPrice >= 4000,
      });
      const { url } = await createCheckoutSession({ subscription, items });
      window.location.href = url;
    } catch {
      setSubmitFailed(true);
    } finally {
      setIsSubmitting(false);
    }
  };

  const footer =
    page === "donors" ? (
      <>
        <Button
          icon={<FaUserAlt className="size-3.5" />}
          onClick={() => {
            track("ManageSubscriptionClick", { location: "donation_modal_donors" });
            const url = process.env.NEXT_PUBLIC_STRIPE_LOGIN_REDIRECT || "";
            if (url) window.location.href = url;
          }}
        >
          サブスクリプションの管理
        </Button>
        <Button
          variant="primary"
          icon={<BiDonateHeart className="size-4" />}
          onClick={() => {
            track("OpenDonationPayment", { location: "donation_modal_donors" });
            setPage("payment");
            track("ViewDonationModal", { page: "payment" });
          }}
        >
          募金する
        </Button>
      </>
    ) : (
      <>
        <Button onClick={() => setPage("donors")}>戻る</Button>
        <Button variant="primary" onClick={makePayment} disabled={totalPrice === 0} busy={isSubmitting}>
          {isSubmitting ? "支払い画面を準備中…" : "支払い画面へ"}
        </Button>
      </>
    );

  return (
    <Dialog title={page === "donors" ? "ご支援いただいた皆さま" : "KOKKAI DOC に募金する"} onClose={close} footer={footer} width="lg">
      {page === "donors" ? (
        <div className="flex flex-col gap-4 text-body-md">
          <p>
            KOKKAI DOCの活動を4,000円以上のご支援で支えてくださった皆さまのお名前を、感謝を込めて掲載しています。掲載名の変更・非掲載をご希望の方は
            <span className="whitespace-nowrap text-link">kokkai.doc[アット]gmail.com</span>
            までご連絡ください。
          </p>

          <div className="max-h-[40dvh] overflow-auto rounded-xl border border-line-subtle bg-surface-raised p-3">
            {donorsFailed && <ErrorState message="支援者の一覧を読み込めませんでした。" onRetry={() => void loadDonors()} />}
            {!donorsFailed && donors === null && <Loading />}
            {!donorsFailed && donors !== null && (
              <ul className="flex flex-wrap justify-center gap-2">
                {donors.map((d) => (
                  <li key={d} className="rounded-lg border border-line bg-surface px-2 py-1 text-body-sm">
                    {d}
                  </li>
                ))}
              </ul>
            )}
          </div>

          <p>
            KOKKAI DOC は、一人のエンジニアが運営するプロジェクトです。日本の政治を見やすく、わかりやすく、調べやすくすることを目指しています。皆さまの温かいご協力が、より開かれた民主主義の実現につながります。何卒よろしくお願い申し上げます。
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2 text-body-md">
            <p>KOKKAI DOC は、一人のエンジニアが運営するプロジェクトです。理念にご賛同いただけましたら、ぜひご支援をご検討ください。</p>
            <p>
              <span className="text-title-sm text-ink-strong">4,000円以上</span>のご支援で、ご希望に応じて支援者一覧にお名前を掲載できます。
            </p>
            <p>サブスクリプション形式でもご支援いただけます。長期的にKOKKAI DOCの活動をご支援いただける方は、ぜひご検討ください。</p>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <SegmentedControl
              label="支援の方法"
              size="md"
              value={subscription ? "subscription" : "one_time"}
              onChange={(v) => {
                track("DonationTypeSelect", { type: v });
                setSubscription(v === "subscription");
              }}
              items={[
                { value: "one_time", label: "今回だけ応援する" },
                { value: "subscription", label: "長期的に応援する（月額）" },
              ]}
            />
            <div className="text-body-md">
              {subscription ? "月額：" : "合計："}
              <span className="tabular-nums text-title-md text-ink-strong">{yen(totalPrice)}</span>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            {(["s", "m", "l"] as const).map((key) => (
              <PlanCard
                key={key}
                item={items[key]}
                onChangeQuantity={(qty) => setItems((prev) => ({ ...prev, [key]: { ...prev[key], quantity: qty } }))}
              />
            ))}
          </div>

          {submitFailed && (
            <p role="alert" className="rounded-lg bg-error-soft px-3 py-2 text-body-sm text-on-error-soft">
              決済を始められませんでした。時間をおいて、もう一度お試しください。
            </p>
          )}
        </div>
      )}
    </Dialog>
  );
}

function PlanCard({ item, onChangeQuantity }: { item: Plan; onChangeQuantity: (qty: number) => void }) {
  const chosen = item.quantity > 0;
  return (
    <div className={cx("rounded-xl border p-3", chosen ? selectedClass : "border-line bg-surface-raised text-ink")}>
      <div className="text-title-sm text-ink-strong">{item.name}</div>
      <div className="text-data text-ink-muted">{yen(item.price)}</div>
      <div className="mt-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <IconButton label={`${item.name}を1つ減らす`} disabled={item.quantity === 0} onClick={() => onChangeQuantity(Math.max(0, item.quantity - 1))}>
            <IoRemove className="size-4" />
          </IconButton>
          <span className="w-6 text-center tabular-nums text-title-sm text-ink-strong" aria-live="polite">
            {item.quantity}
          </span>
          <IconButton label={`${item.name}を1つ増やす`} onClick={() => onChangeQuantity(item.quantity + 1)}>
            <IoAdd className="size-4" />
          </IconButton>
        </div>
        <div className="text-caption text-ink-muted">
          小計：<span className="tabular-nums text-ink-strong">{yen(item.price * item.quantity)}</span>
        </div>
      </div>
    </div>
  );
}
