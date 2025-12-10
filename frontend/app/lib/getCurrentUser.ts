import { cookies } from "next/headers";
import { verifyIdToken } from "@/app/lib/verifyToken";

export interface CurrentUser {
  sub: string;
  email?: string;
  name?: string;
}

export async function getCurrentUser(): Promise<CurrentUser | null> {
  const cookieStore = cookies();
  const idToken = cookieStore.get("id_token")?.value;

  if (!idToken) {
    return null;
  }

  try {
    const payload = await verifyIdToken(idToken);
    return {
      sub: payload.sub,
      email: payload.email,
      name: payload.name,
    };
  } catch (error) {
    console.error("Failed to verify id_token", error);
    return null;
  }
}
