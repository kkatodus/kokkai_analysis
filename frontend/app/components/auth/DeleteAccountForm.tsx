"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

export function DeleteAccountForm() {
  const router = useRouter();
  const [confirmation, setConfirmation] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setStatus(null);

    if (confirmation !== "DELETE") {
      setStatus("Type DELETE to confirm.");
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch("/api/account/delete", {
        method: "POST",
        credentials: "include",
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || "Unable to delete account");
      }

      router.push("/");
    } catch (submitError) {
      setStatus(submitError instanceof Error ? submitError.message : "Unable to delete account");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 rounded-2xl border border-red-500/20 bg-slate-900/70 p-6 shadow">
      <p className="text-sm text-gray-300">This will permanently delete your account. Type DELETE to confirm.</p>
      <input
        value={confirmation}
        onChange={(event) => setConfirmation(event.target.value)}
        className="w-full rounded-lg border border-white/10 bg-slate-950/80 px-3 py-2 text-sm text-white focus:border-red-500 focus:outline-none"
      />
      {status && <div className="text-sm text-red-300">{status}</div>}
      <button
        type="submit"
        disabled={isSubmitting}
        className="w-full rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-red-500 disabled:opacity-60"
      >
        {isSubmitting ? "Deleting..." : "Delete account"}
      </button>
    </form>
  );
}
