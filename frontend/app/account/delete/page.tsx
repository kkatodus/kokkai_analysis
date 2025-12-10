import Link from "next/link";
import { redirect } from "next/navigation";
import { DeleteAccountForm } from "@/app/components/auth/DeleteAccountForm";
import { getCurrentUser } from "@/app/lib/getCurrentUser";

export default async function DeleteAccountPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-3xl flex-col gap-8 px-6 py-12">
      <div className="space-y-2">
        <h1 className="text-3xl font-semibold text-white">Delete account</h1>
        <p className="text-sm text-gray-300">This action cannot be undone. Your profile and tokens will be removed.</p>
      </div>
      <DeleteAccountForm />
      <div className="text-sm text-gray-300">
        Changed your mind? <Link href="/account" className="text-cyan-300 hover:text-cyan-200">Go back</Link>
      </div>
    </div>
  );
}
