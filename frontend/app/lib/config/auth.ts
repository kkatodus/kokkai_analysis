/**
 * AWS Cognito Authentication Configuration
 * 
 * SECURITY: All authentication credentials MUST be provided via environment variables.
 * Never hardcode credentials in source code.
 * 
 * Client-Side Environment Variables (NEXT_PUBLIC_*):
 * - NEXT_PUBLIC_COGNITO_AUTHORITY: Cognito User Pool authority URL
 *   Format: https://cognito-idp.REGION.amazonaws.com/USER_POOL_ID
 * - NEXT_PUBLIC_COGNITO_CLIENT_ID: Cognito App Client ID
 * - NEXT_PUBLIC_COGNITO_REDIRECT_URI: Redirect URI after authentication
 * - NEXT_PUBLIC_COGNITO_LOGOUT_URI: Redirect URI after logout (optional, defaults to REDIRECT_URI)
 * - NEXT_PUBLIC_COGNITO_DOMAIN: Cognito User Pool domain (optional, for logout)
 *   Format: https://your-domain.auth.REGION.amazoncognito.com
 * 
 * Server-Side Environment Variables (NOT NEXT_PUBLIC - kept secret):
 * - COGNITO_USER_POOL_ID: AWS Cognito User Pool ID (server-only)
 * - COGNITO_REGION: AWS region where Cognito is deployed (server-only)
 * - COGNITO_CLIENT_ID: Cognito App Client ID (can also use NEXT_PUBLIC_COGNITO_CLIENT_ID)
 * 
 * Note: Server-side authentication utilities are in @/app/lib/server/auth.ts
 * 
 * The application will throw an error if required variables are missing.
 */

export interface CognitoAuthConfig {
  authority: string;
  client_id: string;
  redirect_uri: string;
  response_type: "code";
  scope: string;
  logout_uri?: string;
  cognito_domain?: string;
}

/**
 * Get Cognito authentication configuration
 * All values must be provided via environment variables for security
 * 
 * @throws Error if required environment variables are not set
 */
export function getCognitoAuthConfig(): CognitoAuthConfig {
  const authority = process.env.NEXT_PUBLIC_COGNITO_AUTHORITY;
  const client_id = process.env.NEXT_PUBLIC_COGNITO_CLIENT_ID;
  
  if (!authority) {
    throw new Error(
      "NEXT_PUBLIC_COGNITO_AUTHORITY environment variable is required. " +
      "Please set it in your .env.local file or Vercel environment variables."
    );
  }

  if (!client_id) {
    throw new Error(
      "NEXT_PUBLIC_COGNITO_CLIENT_ID environment variable is required. " +
      "Please set it in your .env.local file or Vercel environment variables."
    );
  }

  // Get redirect URI - prefer env var for consistency, fallback to current origin
  // Using env var ensures the redirect URI is exactly the same during initial redirect and callback
  let redirect_uri: string;
  if (process.env.NEXT_PUBLIC_COGNITO_REDIRECT_URI) {
    redirect_uri = process.env.NEXT_PUBLIC_COGNITO_REDIRECT_URI;
    // Ensure it ends with / for consistency
    if (!redirect_uri.endsWith("/")) {
      redirect_uri = redirect_uri + "/";
    }
  } else if (typeof window !== "undefined") {
    // Fallback to current origin if env var not set
    redirect_uri = `${window.location.origin}/`;
  } else {
    throw new Error(
      "NEXT_PUBLIC_COGNITO_REDIRECT_URI environment variable is required. " +
      "Please set it in your .env.local file or Vercel environment variables."
    );
  }

  const logout_uri = process.env.NEXT_PUBLIC_COGNITO_LOGOUT_URI || redirect_uri;
  const cognito_domain = process.env.NEXT_PUBLIC_COGNITO_DOMAIN || "";

  return {
    authority,
    client_id,
    redirect_uri,
    response_type: "code",
    scope: "phone openid email",
    logout_uri,
    cognito_domain,
  };
}

/**
 * Get logout URL for Cognito
 */
export function getCognitoLogoutUrl(config: CognitoAuthConfig): string {
  if (!config.cognito_domain) {
    console.warn("NEXT_PUBLIC_COGNITO_DOMAIN not set, logout may not work correctly");
    return config.logout_uri || "/";
  }

  const logoutUri = config.logout_uri || config.redirect_uri;
  return `${config.cognito_domain}/logout?client_id=${config.client_id}&logout_uri=${encodeURIComponent(logoutUri)}`;
}

