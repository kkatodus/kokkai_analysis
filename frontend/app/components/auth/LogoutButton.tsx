"use client";

import { useRouter } from "next/navigation";

export function LogoutButton() {
  const router = useRouter();

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
    router.refresh();
  };

  return (
    <button
      type="button"
      onClick={handleLogout}
      className="rounded-full border border-slate-400/40 bg-slate-900/90 px-3 py-1 text-xs text-gray-200 transition hover:bg-slate-800"
    >
      Logout
    </button>
  );
}
