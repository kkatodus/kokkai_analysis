import { UpdateUserAttributesCommand } from "@aws-sdk/client-cognito-identity-provider";
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
  const attributes: { Name: string; Value: string }[] = Object.entries(body)
    .filter(([, value]) => typeof value === "string")
    .map(([key, value]) => ({ Name: key, Value: value as string }));

  if (attributes.length === 0) {
    return NextResponse.json({ error: "No attributes provided" }, { status: 400 });
  }

  const command = new UpdateUserAttributesCommand({
    AccessToken: accessToken,
    UserAttributes: attributes,
  });

  try {
    await cognitoClient.send(command);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Update attributes error", error);
    return NextResponse.json({ error: "Unable to update attributes" }, { status: 400 });
  }
}
