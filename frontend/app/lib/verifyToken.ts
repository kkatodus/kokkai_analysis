import { createRemoteJWKSet, jwtVerify, JWTPayload } from "jose";

interface VerifiedIdToken extends JWTPayload {
  sub: string;
  email?: string;
  name?: string;
  email_verified?: boolean;
}

function getVerificationConfig() {
  const jwksUrl = process.env.COGNITO_JWKS_URL;
  const userPoolId = process.env.COGNITO_USER_POOL_ID;
  const clientId = process.env.COGNITO_CLIENT_ID;
  const region = process.env.COGNITO_REGION;

  if (!jwksUrl) {
    throw new Error("COGNITO_JWKS_URL is not set");
  }

  if (!userPoolId) {
    throw new Error("COGNITO_USER_POOL_ID is not set");
  }

  if (!clientId) {
    throw new Error("COGNITO_CLIENT_ID is not set");
  }

  if (!region) {
    throw new Error("COGNITO_REGION is not set");
  }

  const issuer = `https://cognito-idp.${region}.amazonaws.com/${userPoolId}`;
  return { jwksUrl, issuer, clientId };
}

let jwks: ReturnType<typeof createRemoteJWKSet> | null = null;

export async function verifyIdToken(token: string): Promise<VerifiedIdToken> {
  const { jwksUrl, issuer, clientId } = getVerificationConfig();

  if (!jwks) {
    jwks = createRemoteJWKSet(new URL(jwksUrl));
  }

  const { payload } = await jwtVerify(token, jwks, {
    issuer,
    audience: clientId,
  });

  return payload as VerifiedIdToken;
}
