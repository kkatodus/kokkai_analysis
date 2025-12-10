import Link from "next/link";
import { redirect } from "next/navigation";
import { LoginForm } from "@/app/components/auth/LoginForm";
import { getCurrentUser } from "@/app/lib/getCurrentUser";

export default async function LoginPage() {
  const user = await getCurrentUser();

  if (user) {
    redirect("/account");
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-3xl flex-col justify-center gap-8 px-6 py-12">
      <div className="space-y-2 text-center">
        <h1 className="text-3xl font-semibold text-white">Sign in</h1>
        <p className="text-sm text-gray-300">Access your Parliament Explorer account</p>
      </div>
      <LoginForm />
      <div className="text-center text-sm text-gray-300">
        No account? <Link href="/signup" className="text-cyan-300 hover:text-cyan-200">Create one</Link>
      </div>
    </div>
  );
}
