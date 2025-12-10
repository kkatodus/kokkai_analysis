"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

export function SignupForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      const response = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, name }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || "Signup failed");
      }

      router.push("/login");
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Signup failed");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 rounded-2xl border border-white/5 bg-slate-900/70 p-6 shadow-xl">
      <div>
        <label className="block text-sm font-medium text-gray-200">Name</label>
        <input
          type="text"
          value={name}
          onChange={(event) => setName(event.target.value)}
          className="mt-1 w-full rounded-lg border border-white/10 bg-slate-950/80 px-3 py-2 text-sm text-white focus:border-cyan-500 focus:outline-none"
          required
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-200">Email</label>
        <input
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          className="mt-1 w-full rounded-lg border border-white/10 bg-slate-950/80 px-3 py-2 text-sm text-white focus:border-cyan-500 focus:outline-none"
          required
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-200">Password</label>
        <input
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          className="mt-1 w-full rounded-lg border border-white/10 bg-slate-950/80 px-3 py-2 text-sm text-white focus:border-cyan-500 focus:outline-none"
          required
        />
      </div>
      {error && <div className="text-sm text-red-400">{error}</div>}
      <button
        type="submit"
        disabled={isSubmitting}
        className="w-full rounded-lg bg-cyan-600 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-cyan-500 disabled:opacity-60"
      >
        {isSubmitting ? "Creating account..." : "Create account"}
      </button>
    </form>
  );
}
