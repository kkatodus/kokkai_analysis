import Link from "next/link";
import { redirect } from "next/navigation";
import { SignupForm } from "@/app/components/auth/SignupForm";
import { getCurrentUser } from "@/app/lib/getCurrentUser";

export default async function SignupPage() {
  const user = await getCurrentUser();

  if (user) {
    redirect("/account");
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-3xl flex-col justify-center gap-8 px-6 py-12">
      <div className="space-y-2 text-center">
        <h1 className="text-3xl font-semibold text-white">Create your account</h1>
        <p className="text-sm text-gray-300">Sign up to manage your profile and saved insights.</p>
      </div>
      <SignupForm />
      <div className="text-center text-sm text-gray-300">
        Already have an account? <Link href="/login" className="text-cyan-300 hover:text-cyan-200">Sign in</Link>
      </div>
    </div>
  );
}
