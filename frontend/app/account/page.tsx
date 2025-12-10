import Link from "next/link";
import { redirect } from "next/navigation";
import { AccountProfileForm } from "@/app/components/auth/AccountProfileForm";
import { ChangePasswordForm } from "@/app/components/auth/ChangePasswordForm";
import { getCurrentUser } from "@/app/lib/getCurrentUser";

export default async function AccountPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-4xl flex-col gap-8 px-6 py-12">
      <div className="space-y-2">
        <h1 className="text-3xl font-semibold text-white">Your account</h1>
        <p className="text-sm text-gray-300">Manage your profile, credentials, and account status.</p>
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <AccountProfileForm email={user.email} name={user.name} />
        <ChangePasswordForm />
      </div>
      <div className="rounded-2xl border border-red-500/20 bg-slate-950/60 p-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-white">Delete account</h2>
            <p className="text-sm text-gray-300">Permanently remove your account and all associated data.</p>
          </div>
          <Link
            href="/account/delete"
            className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-red-500"
          >
            Delete account
          </Link>
        </div>
      </div>
    </div>
  );
}
