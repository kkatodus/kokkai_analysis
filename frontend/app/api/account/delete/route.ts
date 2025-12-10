import { DeleteUserCommand } from "@aws-sdk/client-cognito-identity-provider";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { cognitoClient } from "@/app/lib/cognitoClient";
import { verifyIdToken } from "@/app/lib/verifyToken";
import { clearAuthCookies } from "@/app/lib/authCookies";

export async function POST() {
  const cookieStore = cookies();
  const idToken = cookieStore.get("id_token")?.value;
  const accessToken = cookieStore.get("access_token")?.value;

  if (!idToken || !accessToken) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  try {
    await verifyIdToken(idToken);
  } catch (error) {
    console.error("Invalid id_token", error);
    return NextResponse.json({ error: "Invalid session" }, { status: 401 });
  }

  const command = new DeleteUserCommand({ AccessToken: accessToken });

  try {
    await cognitoClient.send(command);
    const response = NextResponse.json({ ok: true });
    clearAuthCookies(response);
    return response;
  } catch (error) {
    console.error("Delete user error", error);
    return NextResponse.json({ error: "Unable to delete account" }, { status: 400 });
  }
}
