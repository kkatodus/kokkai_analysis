"use client";

import { useEffect, useState } from "react";
import { RxCross1 } from "react-icons/rx";
import { BiDonateHeart } from "react-icons/bi";
import { FaUserAlt } from "react-icons/fa";
import { createCheckoutSession, createCustomerPortal } from "@/app/lib/services/paymentService";
import { LoadingIndicator } from "@/app/components/shared/LoadingIndicator";
import { track } from "@vercel/analytics";

type DonateModalProps = {
  removeModal?: () => void;
};

export function DonateModal({ removeModal }: DonateModalProps) {
  const [donors, setDonors] = useState<string[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState<"donors" | "payment">("donors");
  const [subscription, setSubscription] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const [items, setItems] = useState<Record<
    "s" | "m" | "l",
    { id: "s" | "m" | "l"; price: number; quantity: number; name: string; colorClass: string }
  >>({
    s: { id: "s", price: 100, quantity: 0, name: "ちょっと応援する", colorClass: "bg-cyan-500/10 border-cyan-400/30" },
    m: { id: "m", price: 1000, quantity: 0, name: "もっと応援する", colorClass: "bg-blue-500/10 border-blue-400/30" },
    l: { id: "l", price: 10000, quantity: 0, name: "めっちゃ応援する", colorClass: "bg-indigo-500/10 border-indigo-400/30" },
  });

  const totalPrice = Object.values(items).reduce((acc, it) => acc + it.price * it.quantity, 0);

  useEffect(() => {
    track("ViewDonationModal", { page: "donors" });
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

  const makePayment = async () => {
    setIsSubmitting(true);
    setSubmitError(null);
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
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setIsSubmitting(false);
    }
  };


  return (
    <div className="flex h-full w-full flex-col gap-3 overflow-hidden rounded-lg border border-slate-400/20 bg-[#020617] p-4 text-gray-100">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h1 className="text-lg font-semibold">{page === "donors" ? "Donors" : "募金"}</h1>
          {page === "payment" && (
            <button
              type="button"
              onClick={() => setPage("donors")}
              className="rounded-full border border-slate-400/40 bg-slate-900/90 px-3 py-1 text-xs text-gray-300 hover:bg-slate-800 hover:text-gray-100"
            >
              戻る
            </button>
          )}
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              track("CloseDonationModal", { location: "donation_modal" });
              removeModal?.();
            }}
            className="flex items-center gap-1 rounded-full border border-slate-400/40 bg-slate-900/90 px-3 py-1 text-xs text-gray-300 hover:bg-slate-800 hover:text-gray-100"
          >
            <RxCross1 className="h-4 w-4" /> 閉じる
          </button>
        </div>
      </div>

      {page === "donors" ? (
        <>
          <p className="text-sm leading-relaxed text-gray-300">
            以下にKOKKAI DOCの活動を4000円以上の募金で支援してくださった皆様のお名前を心より感謝を込めて掲載いたします。掲載名の変更・非掲載をご希望の方は{" "}
            <span className="whitespace-nowrap text-blue-500">kokkai.doc[アット]gmail.com</span>{" "}
            までご連絡ください。
          </p>

          {/* Donor list: shrink-to-fit when short, scroll when long */}
          <div className="max-h-[45vh] overflow-auto rounded-md border border-slate-400/15 bg-slate-900/40 p-2 text-sm">
            {error && <div className="text-red-300">Failed to load donors: {error}</div>}
            {!error && donors === null && (
              <div className="py-2">
                <LoadingIndicator label="読み込み中" size="sm" />
              </div>
            )}
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
          <div className="flex items-stretch gap-2">
            <button
            type="button"
            onClick={() => {
              track("OpenDonationPayment", { location: "donation_modal_donors" });
              setPage("payment");
              track("ViewDonationModal", { page: "payment" });
            }}
            className="flex flex-2 items-center justify-center gap-2 rounded-2xl border border-blue-500/60 bg-linear-to-r from-blue-600/45 to-cyan-500/35 px-4 py-3.5 text-base font-semibold text-blue-50 shadow-lg shadow-blue-900/25 transition hover:from-blue-600/60 hover:to-cyan-500/45"
          >
            <BiDonateHeart className="h-6 w-6" />
            募金する
          </button>

            <button
              type="button"
              onClick={() => {
                track("ManageSubscriptionClick", { location: "donation_modal_donors" });
                const url = process.env.NEXT_PUBLIC_STRIPE_LOGIN_REDIRECT || "";
                if (url) window.location.href = url;
              }}
              className="flex flex-1 items-center justify-center gap-2 rounded-2xl border border-slate-400/40 bg-slate-900/60 px-4 py-3.5 text-base font-semibold text-gray-100 transition hover:bg-slate-800"
            >
              <FaUserAlt className="h-5 w-5" />
              サブスクリプション管理はこちら
            </button>
          </div>
        </>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden">
          <div className="rounded-xl border border-slate-400/15 bg-slate-900/40 p-3 text-sm text-gray-200">
            <p className="leading-relaxed">
              KOKKAI DOC は、一人のエンジニアが運営するプロジェクトです。理念にご賛同いただけましたら、ぜひご支援をご検討ください。
            </p>
            <p className="mt-2 leading-relaxed text-gray-300">
              <span className="font-semibold text-gray-100">4,000円以上</span>のご支援で、ご希望に応じて支援者一覧にお名前を掲載できます。
            </p>
			<p className="mt-2 leading-relaxed text-gray-300">
              <span className="font-semibold text-gray-100">また、サブスクリプション形式でもご支援いただけます。長期的にKOKKAIDOCの活動をご支援いただける方は是非ともご検討ください。</span>
            </p>
          </div>


          <div className="flex items-center justify-between gap-2">
            <div
              className="flex items-center overflow-hidden rounded-full border border-slate-400/40 bg-slate-900/90"
              role="tablist"
              aria-label="Donation type"
            >
              <button
                type="button"
                role="tab"
                aria-selected={!subscription}
                onClick={() => {
                  if (subscription) {
                    track("DonationTypeSelect", { type: "one_time" });
                    setSubscription(false);
                  }
                }}
                className={`px-3 py-1 text-xs transition-colors ${
                  !subscription ? "bg-blue-600/60 text-blue-50" : "text-gray-200 hover:bg-slate-800"
                }`}
              >
                一度応援する
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={subscription}
                onClick={() => {
                  if (!subscription) {
                    track("DonationTypeSelect", { type: "subscription" });
                    setSubscription(true);
                  }
                }}
                className={`px-3 py-1 text-xs transition-colors ${
                  subscription ? "bg-blue-600/60 text-blue-50" : "text-gray-200 hover:bg-slate-800"
                }`}
              >
                長期的に応援する（月額）
              </button>
            </div>
            <div className="text-sm text-gray-200">
              {subscription ? "月額：" : "合計："}
              <span className="ml-1 font-semibold text-gray-50">{totalPrice}円</span>
            </div>
          </div>

          <div className="grid flex-1 grid-cols-1 gap-2 overflow-auto rounded-xl border border-slate-400/15 bg-[#020617] p-2 sm:grid-cols-3">
            {(["s", "m", "l"] as const).map((key) => (
              <PlanCard
                key={key}
                item={items[key]}
                onChangeQuantity={(qty) =>
                  setItems((prev) => ({ ...prev, [key]: { ...prev[key], quantity: qty } }))
                }
              />
            ))}
          </div>

          {submitError && <div className="text-sm text-red-300">決済を開始できませんでした: {submitError}</div>}

          <button
            type="button"
            onClick={makePayment}
            disabled={totalPrice === 0 || isSubmitting}
            className={`w-full rounded-xl border px-3 py-2 text-sm font-semibold transition ${
              totalPrice === 0 || isSubmitting
                ? "border-slate-400/20 bg-slate-900/40 text-slate-400"
                : "border-blue-500/60 bg-blue-600/40 text-blue-50 hover:bg-blue-600/55"
            }`}
          >
            {isSubmitting ? "支払い画面を準備中…" : "支払い画面へ"}
          </button>
        </div>
      )}
    </div>
  );
}

function PlanCard({
  item,
  onChangeQuantity,
}: {
  item: { id: "s" | "m" | "l"; price: number; quantity: number; name: string; colorClass: string };
  onChangeQuantity: (qty: number) => void;
}) {
  return (
    <div className={`rounded-xl border p-3 ${item.colorClass}`}>
      <div className="text-sm font-semibold text-gray-50">{item.name}</div>
      <div className="mt-1 text-xs text-gray-300">{item.price}円</div>
      <div className="mt-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => onChangeQuantity(Math.max(0, item.quantity - 1))}
            className="h-8 w-8 rounded-lg border border-slate-400/30 bg-slate-900/60 text-gray-200 hover:bg-slate-800"
          >
            −
          </button>
          <div className="w-6 text-center text-sm font-semibold text-gray-50">{item.quantity}</div>
          <button
            type="button"
            onClick={() => onChangeQuantity(item.quantity + 1)}
            className="h-8 w-8 rounded-lg border border-slate-400/30 bg-slate-900/60 text-gray-200 hover:bg-slate-800"
          >
            +
          </button>
        </div>
        <div className="text-xs text-gray-300">
          小計: <span className="font-semibold text-gray-50">{item.price * item.quantity}円</span>
        </div>
      </div>
    </div>
  );
}