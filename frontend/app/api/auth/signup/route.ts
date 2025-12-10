import { SignUpCommand } from "@aws-sdk/client-cognito-identity-provider";
import { NextRequest, NextResponse } from "next/server";
import { cognitoClient, getCognitoConfig } from "@/app/lib/cognitoClient";

export async function POST(request: NextRequest) {
  const body = await request.json();
  const email = body.email as string | undefined;
  const password = body.password as string | undefined;
  const name = body.name as string | undefined;

  if (!email || !password || !name) {
    return NextResponse.json({ error: "email, password, and name are required" }, { status: 400 });
  }

  const { clientId } = getCognitoConfig();

  const command = new SignUpCommand({
    ClientId: clientId,
    Username: email,
    Password: password,
    UserAttributes: [
      { Name: "email", Value: email },
      { Name: "name", Value: name },
    ],
  });

  try {
    const result = await cognitoClient.send(command);
    return NextResponse.json({
      userSub: result.UserSub,
      userConfirmed: result.UserConfirmed,
    });
  } catch (error) {
    console.error("Signup error", error);
    return NextResponse.json({ error: "Unable to sign up" }, { status: 400 });
  }
}
