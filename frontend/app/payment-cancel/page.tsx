import Link from "next/link";

export const dynamic = "force-dynamic";

export default function PaymentCancelPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-linear-to-b from-[#111827] to-[#020617] px-4">
      <div className="w-full max-w-lg rounded-2xl border border-slate-400/20 bg-[#020617] p-6 text-gray-100 shadow-2xl">
        <div className="mb-2 text-lg font-semibold text-gray-50">お支払いがキャンセルされました</div>
        <p className="text-sm leading-relaxed text-gray-300">
          お支払いは完了していません。もう一度お試しいただくか、トップページに戻ってください。
        </p>

        <div className="mt-5 flex flex-col gap-2">
          <Link
            href="/?open=donate"
            className="w-full rounded-xl border border-blue-500/60 bg-blue-600/40 px-4 py-2 text-center text-sm font-semibold text-blue-50 hover:bg-blue-600/55"
          >
            募金画面へ戻る
          </Link>
          <Link
            href="/"
            className="w-full rounded-xl border border-slate-400/30 bg-slate-900/50 px-4 py-2 text-center text-sm font-semibold text-gray-200 hover:bg-slate-800/60"
          >
            トップへ戻る
          </Link>
        </div>
      </div>
    </div>
  );
}


