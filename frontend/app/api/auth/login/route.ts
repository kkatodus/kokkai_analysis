import {
  AuthFlowType,
  InitiateAuthCommand,
} from "@aws-sdk/client-cognito-identity-provider";
import { NextRequest, NextResponse } from "next/server";
import { cognitoClient, getCognitoConfig } from "@/app/lib/cognitoClient";
import { setAuthCookies } from "@/app/lib/authCookies";

export async function POST(request: NextRequest) {
  const body = await request.json();
  const username = body.username as string | undefined;
  const password = body.password as string | undefined;

  if (!username || !password) {
    return NextResponse.json({ error: "username and password are required" }, { status: 400 });
  }

  const { clientId } = getCognitoConfig();

  const command = new InitiateAuthCommand({
    AuthFlow: AuthFlowType.USER_PASSWORD_AUTH,
    ClientId: clientId,
    AuthParameters: {
      USERNAME: username,
      PASSWORD: password,
    },
  });

  try {
    const result = await cognitoClient.send(command);
    const auth = result.AuthenticationResult;

    if (!auth?.AccessToken || !auth.IdToken) {
      return NextResponse.json({ error: "Authentication failed" }, { status: 401 });
    }

    const response = NextResponse.json({ ok: true });
    setAuthCookies(response, {
      accessToken: auth.AccessToken,
      idToken: auth.IdToken,
      refreshToken: auth.RefreshToken,
      expiresIn: auth.ExpiresIn,
    });

    return response;
  } catch (error) {
    console.error("Login error", error);
    return NextResponse.json({ error: "Unable to log in" }, { status: 401 });
  }
}
