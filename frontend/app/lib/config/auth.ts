/**
 * AWS Cognito Authentication Configuration
 * 
 * Environment variables should be set:
 * - NEXT_PUBLIC_COGNITO_AUTHORITY: Cognito User Pool authority URL
 * - NEXT_PUBLIC_COGNITO_CLIENT_ID: Cognito App Client ID
 * - NEXT_PUBLIC_COGNITO_REDIRECT_URI: Redirect URI after authentication
 * - NEXT_PUBLIC_COGNITO_LOGOUT_URI: Redirect URI after logout
 * - NEXT_PUBLIC_COGNITO_DOMAIN: Cognito User Pool domain (for logout)
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
 * Falls back to default values if environment variables are not set
 */
export function getCognitoAuthConfig(): CognitoAuthConfig {
  const authority = process.env.NEXT_PUBLIC_COGNITO_AUTHORITY || 
    "https://cognito-idp.ap-northeast-1.amazonaws.com/ap-northeast-1_WFUAyQtMs";
  
  const client_id = process.env.NEXT_PUBLIC_COGNITO_CLIENT_ID || 
    "237qf0kbmlmrugugfsdqfnj02r";
  
  // Get redirect URI - use current origin in browser, or env var
  const redirect_uri = typeof window !== "undefined" 
    ? `${window.location.origin}/`
    : (process.env.NEXT_PUBLIC_COGNITO_REDIRECT_URI || "https://kokkaidoc.vercel.app/");

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

