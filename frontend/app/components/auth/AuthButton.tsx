import Link from "next/link";
import { getCurrentUser } from "@/app/lib/getCurrentUser";
import { LogoutButton } from "@/app/components/auth/LogoutButton";

export async function AuthButton() {
  const user = await getCurrentUser();

  if (user) {
    return (
      <div className="flex items-center gap-2 text-sm text-gray-200">
        <span className="rounded-full bg-slate-800/70 px-3 py-1 text-xs text-gray-100">
          {user.email || "Signed in"}
        </span>
        <Link
          href="/account"
          className="rounded-full border border-slate-400/40 bg-slate-900/90 px-3 py-1 text-xs text-gray-200 transition hover:bg-slate-800"
        >
          Account
        </Link>
        <LogoutButton />
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 text-sm text-gray-200">
      <Link
        href="/login"
        className="rounded-full border border-slate-400/40 bg-slate-900/90 px-3 py-1 text-xs text-gray-200 transition hover:bg-slate-800"
      >
        Sign in
      </Link>
      <Link
        href="/signup"
        className="rounded-full bg-cyan-600 px-3 py-1 text-xs font-semibold text-white shadow hover:bg-cyan-500"
      >
        Create account
      </Link>
    </div>
  );
}
