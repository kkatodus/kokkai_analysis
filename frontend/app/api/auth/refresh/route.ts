import {
  AuthFlowType,
  InitiateAuthCommand,
} from "@aws-sdk/client-cognito-identity-provider";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { cognitoClient, getCognitoConfig } from "@/app/lib/cognitoClient";
import { setAuthCookies } from "@/app/lib/authCookies";

export async function POST() {
  const refreshToken = cookies().get("refresh_token")?.value;

  if (!refreshToken) {
    return NextResponse.json({ error: "refresh_token is missing" }, { status: 401 });
  }

  const { clientId } = getCognitoConfig();

  const command = new InitiateAuthCommand({
    AuthFlow: AuthFlowType.REFRESH_TOKEN_AUTH,
    ClientId: clientId,
    AuthParameters: {
      REFRESH_TOKEN: refreshToken,
    },
  });

  try {
    const result = await cognitoClient.send(command);
    const auth = result.AuthenticationResult;

    if (!auth?.AccessToken || !auth.IdToken) {
      return NextResponse.json({ error: "Unable to refresh tokens" }, { status: 401 });
    }

    const response = NextResponse.json({ ok: true });
    setAuthCookies(response, {
      accessToken: auth.AccessToken,
      idToken: auth.IdToken,
      expiresIn: auth.ExpiresIn,
    });

    return response;
  } catch (error) {
    console.error("Refresh error", error);
    return NextResponse.json({ error: "Unable to refresh session" }, { status: 401 });
  }
}
