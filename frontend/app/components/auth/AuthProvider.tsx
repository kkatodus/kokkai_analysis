"use client";

/**
 * AuthProvider Component
 * Wraps the application with react-oidc-context AuthProvider
 * This must be a Client Component since it uses React Context
 */

import { ReactNode } from "react";
import { AuthProvider as OidcAuthProvider } from "react-oidc-context";
import { getCognitoAuthConfig } from "@/app/lib/config/auth";

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const config = getCognitoAuthConfig();

  return (
    <OidcAuthProvider
      authority={config.authority}
      client_id={config.client_id}
      redirect_uri={config.redirect_uri}
      response_type={config.response_type}
      scope={config.scope}
    >
      {children}
    </OidcAuthProvider>
  );
}

