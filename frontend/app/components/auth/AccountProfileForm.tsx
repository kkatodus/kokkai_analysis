"use client";

import { FormEvent, useState } from "react";

interface AccountProfileFormProps {
  email?: string;
  name?: string;
}

export function AccountProfileForm({ email, name }: AccountProfileFormProps) {
  const [displayName, setDisplayName] = useState(name ?? "");
  const [status, setStatus] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setStatus(null);
    setIsSubmitting(true);

    try {
      const response = await fetch("/api/account/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ name: displayName }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || "Unable to update profile");
      }

      setStatus("Profile updated successfully");
    } catch (submitError) {
      setStatus(submitError instanceof Error ? submitError.message : "Unable to update profile");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 rounded-2xl border border-white/5 bg-slate-900/70 p-6 shadow">
      <div>
        <label className="block text-sm font-medium text-gray-200">Email</label>
        <input
          value={email ?? ""}
          disabled
          className="mt-1 w-full rounded-lg border border-white/10 bg-slate-950/50 px-3 py-2 text-sm text-gray-400"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-200">Name</label>
        <input
          value={displayName}
          onChange={(event) => setDisplayName(event.target.value)}
          className="mt-1 w-full rounded-lg border border-white/10 bg-slate-950/80 px-3 py-2 text-sm text-white focus:border-cyan-500 focus:outline-none"
        />
      </div>
      {status && <div className="text-sm text-cyan-300">{status}</div>}
      <button
        type="submit"
        disabled={isSubmitting}
        className="w-full rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-indigo-500 disabled:opacity-60"
      >
        {isSubmitting ? "Saving..." : "Save changes"}
      </button>
    </form>
  );
}
