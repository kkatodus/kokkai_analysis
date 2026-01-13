import Link from "next/link";
import { TrackOnMount } from "@/app/components/analytics/TrackOnMount";

export const dynamic = "force-dynamic";

export default function PaymentSuccessPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-linear-to-b from-[#111827] to-[#020617] px-4">
      <TrackOnMount event="PaymentSuccess" properties={{ location: "payment-success" }} />
      <div className="w-full max-w-lg rounded-2xl border border-slate-400/20 bg-[#020617] p-6 text-gray-100 shadow-2xl">
        <div className="mb-2 text-lg font-semibold text-gray-50">お支払いが完了しました</div>
        <p className="text-sm leading-relaxed text-gray-300">
          ご支援ありがとうございます。KOKKAI DOC の改善に活用させていただきます。
        </p>

        <div className="mt-5 flex flex-col gap-2">
          <Link
            href="/"
            className="w-full rounded-xl border border-blue-500/60 bg-blue-600/40 px-4 py-2 text-center text-sm font-semibold text-blue-50 hover:bg-blue-600/55"
          >
            トップへ戻る
          </Link>
          <Link
            href="/?open=donate"
            className="w-full rounded-xl border border-slate-400/30 bg-slate-900/50 px-4 py-2 text-center text-sm font-semibold text-gray-200 hover:bg-slate-800/60"
          >
            もう一度募金する
          </Link>
        </div>
      </div>
    </div>
  );
}


