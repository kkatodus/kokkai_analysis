"use client";

import { FormEvent, useState } from "react";

export function ChangePasswordForm() {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setStatus(null);
    setIsSubmitting(true);

    try {
      const response = await fetch("/api/account/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          previousPassword: currentPassword,
          proposedPassword: newPassword,
        }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || "Unable to change password");
      }

      setStatus("Password updated successfully");
      setCurrentPassword("");
      setNewPassword("");
    } catch (submitError) {
      setStatus(submitError instanceof Error ? submitError.message : "Unable to change password");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 rounded-2xl border border-white/5 bg-slate-900/70 p-6 shadow">
      <div>
        <label className="block text-sm font-medium text-gray-200">Current password</label>
        <input
          type="password"
          value={currentPassword}
          onChange={(event) => setCurrentPassword(event.target.value)}
          className="mt-1 w-full rounded-lg border border-white/10 bg-slate-950/80 px-3 py-2 text-sm text-white focus:border-cyan-500 focus:outline-none"
          required
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-200">New password</label>
        <input
          type="password"
          value={newPassword}
          onChange={(event) => setNewPassword(event.target.value)}
          className="mt-1 w-full rounded-lg border border-white/10 bg-slate-950/80 px-3 py-2 text-sm text-white focus:border-cyan-500 focus:outline-none"
          required
        />
      </div>
      {status && <div className="text-sm text-cyan-300">{status}</div>}
      <button
        type="submit"
        disabled={isSubmitting}
        className="w-full rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-emerald-500 disabled:opacity-60"
      >
        {isSubmitting ? "Updating..." : "Change password"}
      </button>
    </form>
  );
}
