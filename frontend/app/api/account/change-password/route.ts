import { ChangePasswordCommand } from "@aws-sdk/client-cognito-identity-provider";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { cognitoClient } from "@/app/lib/cognitoClient";
import { verifyIdToken } from "@/app/lib/verifyToken";

export async function POST(request: NextRequest) {
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

  const body = await request.json();
  const previousPassword = body.previousPassword as string | undefined;
  const proposedPassword = body.proposedPassword as string | undefined;

  if (!previousPassword || !proposedPassword) {
    return NextResponse.json({ error: "previousPassword and proposedPassword are required" }, { status: 400 });
  }

  const command = new ChangePasswordCommand({
    AccessToken: accessToken,
    PreviousPassword: previousPassword,
    ProposedPassword: proposedPassword,
  });

  try {
    await cognitoClient.send(command);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Change password error", error);
    return NextResponse.json({ error: "Unable to change password" }, { status: 400 });
  }
}
