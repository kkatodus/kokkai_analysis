import { NextResponse } from "next/server";

export const AUTH_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: true,
  sameSite: "lax" as const,
  path: "/",
};

interface TokenBundle {
  accessToken?: string;
  idToken?: string;
  refreshToken?: string;
  expiresIn?: number;
}

export function setAuthCookies(response: NextResponse, tokens: TokenBundle) {
  if (tokens.accessToken) {
    response.cookies.set("access_token", tokens.accessToken, {
      ...AUTH_COOKIE_OPTIONS,
      maxAge: tokens.expiresIn,
    });
  }

  if (tokens.idToken) {
    response.cookies.set("id_token", tokens.idToken, {
      ...AUTH_COOKIE_OPTIONS,
      maxAge: tokens.expiresIn,
    });
  }

  if (tokens.refreshToken) {
    response.cookies.set("refresh_token", tokens.refreshToken, {
      ...AUTH_COOKIE_OPTIONS,
      // Cognito refresh tokens commonly live longer; do not trim here
    });
  }
}

export function clearAuthCookies(response: NextResponse) {
  response.cookies.set("access_token", "", { ...AUTH_COOKIE_OPTIONS, maxAge: 0 });
  response.cookies.set("id_token", "", { ...AUTH_COOKIE_OPTIONS, maxAge: 0 });
  response.cookies.set("refresh_token", "", { ...AUTH_COOKIE_OPTIONS, maxAge: 0 });
}
