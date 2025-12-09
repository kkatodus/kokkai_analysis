# Server-Side Authentication Guide

This guide explains how to use server-side authentication in the KOKKAI DOC frontend application.

## Overview

The server-side authentication system provides secure token verification and user authentication without exposing secrets to the client. All token verification happens server-side using AWS Cognito's public keys (JWKS).

## Key Features

- ✅ **Server-Side Token Verification**: JWT tokens are verified using Cognito's public keys
- ✅ **No Hydration Errors**: Server Components can check auth without client-side mismatches
- ✅ **Secure**: All secrets are kept server-side (no `NEXT_PUBLIC_` prefix)
- ✅ **Type-Safe**: Full TypeScript support with verified user types
- ✅ **Flexible**: Works with Server Components, API Routes, and Server Actions

## Environment Variables

### Required Server-Side Variables (NOT `NEXT_PUBLIC_`)

These variables are **server-only** and should never be exposed to the client:

```bash
# .env.local or Vercel environment variables
COGNITO_USER_POOL_ID=us-east-1_XXXXXXXXX
COGNITO_REGION=us-east-1
COGNITO_CLIENT_ID=your-client-id  # Can also use NEXT_PUBLIC_COGNITO_CLIENT_ID
```

### Client-Side Variables (Already Configured)

These are already set up for client-side authentication:

```bash
NEXT_PUBLIC_COGNITO_AUTHORITY=https://cognito-idp.REGION.amazonaws.com/USER_POOL_ID
NEXT_PUBLIC_COGNITO_CLIENT_ID=your-client-id
NEXT_PUBLIC_COGNITO_REDIRECT_URI=https://your-domain.com/
NEXT_PUBLIC_COGNITO_LOGOUT_URI=https://your-domain.com/
NEXT_PUBLIC_COGNITO_DOMAIN=https://your-domain.auth.REGION.amazoncognito.com
```

## Usage Examples

### 1. Server Components

Use `getServerAuth()` or `requireServerAuth()` in Server Components:

```typescript
// app/protected/page.tsx
import { getServerAuth } from "@/app/lib/server/auth-helpers";
import { redirect } from "next/navigation";

export default async function ProtectedPage() {
  const auth = await getServerAuth();
  
  if (!auth.isAuthenticated) {
    redirect("/login");
  }
  
  return (
    <div>
      <h1>Protected Page</h1>
      <p>Welcome, {auth.user?.email}</p>
    </div>
  );
}
```

Or use `requireServerAuth()` for automatic redirect:

```typescript
// app/protected/page.tsx
import { requireServerAuth } from "@/app/lib/server/auth-helpers";

export default async function ProtectedPage() {
  const user = await requireServerAuth("/login");
  
  // User is guaranteed to be authenticated here
  return (
    <div>
      <h1>Protected Page</h1>
      <p>Welcome, {user.email}</p>
    </div>
  );
}
```

### 2. API Routes

Use `requireAuth()` or `optionalAuth()` in API routes:

```typescript
// app/api/protected/route.ts
import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/app/lib/server/middleware-auth";

export async function POST(request: NextRequest) {
  const auth = await requireAuth(request);
  
  if (!auth.valid) {
    return NextResponse.json(
      { error: auth.error },
      { status: auth.expired ? 401 : 403 }
    );
  }
  
  // auth.user is guaranteed to be defined here
  return NextResponse.json({
    message: `Hello, ${auth.user.email}`,
    userId: auth.user.sub,
  });
}
```

For optional authentication:

```typescript
// app/api/public-or-private/route.ts
import { NextRequest, NextResponse } from "next/server";
import { optionalAuth } from "@/app/lib/server/middleware-auth";

export async function GET(request: NextRequest) {
  const auth = await optionalAuth(request);
  
  if (auth.valid && auth.user) {
    // Return personalized content
    return NextResponse.json({
      personalized: true,
      user: auth.user.email,
    });
  }
  
  // Return public content
  return NextResponse.json({
    personalized: false,
    message: "Public content",
  });
}
```

### 3. Server Actions

Use server actions to check auth from Client Components:

```typescript
// app/actions/my-action.ts
"use server";

import { getCurrentUserAction } from "@/app/actions/auth";

export async function myProtectedAction() {
  const user = await getCurrentUserAction();
  
  if (!user) {
    throw new Error("Authentication required");
  }
  
  // Perform protected operation
  return { success: true, userId: user.sub };
}
```

### 4. Client Components (with Server Verification)

Use `useServerAuth()` hook to check server-side auth from Client Components:

```typescript
// app/components/ProtectedContent.tsx
"use client";

import { useServerAuth } from "@/app/lib/hooks/useServerAuth";

export function ProtectedContent() {
  const { isAuthenticated, user, isLoading, error } = useServerAuth();
  
  if (isLoading) {
    return <div>Loading...</div>;
  }
  
  if (!isAuthenticated) {
    return <div>Please sign in</div>;
  }
  
  return <div>Welcome, {user?.email}</div>;
}
```

## API Endpoints

### POST /api/auth/verify

Verify a JWT token server-side.

**Request:**
```typescript
POST /api/auth/verify
Content-Type: application/json

{
  "token": "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...",
  "tokenType": "id"  // or "access"
}
```

Or use Authorization header:
```typescript
POST /api/auth/verify
Authorization: Bearer eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Response:**
```typescript
{
  "valid": true,
  "user": {
    "sub": "user-id",
    "email": "user@example.com",
    "email_verified": true,
    // ... other user fields
  }
}
```

## Architecture

### Token Flow

1. **Client-Side**: User authenticates via `react-oidc-context`, receives ID token
2. **Client → Server**: Token sent in `Authorization: Bearer <token>` header
3. **Server-Side**: Token verified using Cognito's JWKS (public keys)
4. **Server Response**: Returns verified user information or error

### Security Model

- **Secrets**: All secrets (User Pool ID, Region) are server-only
- **Token Verification**: Uses Cognito's public keys (JWKS) - no secrets needed
- **No Client Exposure**: Secrets never sent to client
- **Automatic Expiration**: Tokens are checked for expiration server-side

## Files Structure

```
app/lib/server/
├── auth.ts              # Core token verification utilities
├── auth-helpers.ts      # Server Component helpers
└── middleware-auth.ts   # API route middleware

app/actions/
└── auth.ts              # Server actions for auth

app/api/auth/
└── verify/route.ts      # Token verification API endpoint

app/lib/hooks/
└── useServerAuth.ts     # Client hook for server auth
```

## Error Handling

### Token Expired

```typescript
{
  "valid": false,
  "expired": true,
  "error": "Token has expired"
}
```

### Invalid Token

```typescript
{
  "valid": false,
  "error": "Token signature verification failed"
}
```

### Missing Token

```typescript
{
  "valid": false,
  "error": "No authorization token provided"
}
```

## Best Practices

1. **Always verify tokens server-side**: Never trust client-side token claims
2. **Use Server Components when possible**: Avoid hydration issues
3. **Handle errors gracefully**: Show user-friendly error messages
4. **Check token expiration**: Use `expired` flag to handle expired tokens
5. **Use appropriate status codes**: 401 for expired, 403 for invalid

## Troubleshooting

### "COGNITO_USER_POOL_ID is required"

**Solution**: Set `COGNITO_USER_POOL_ID` environment variable (server-side only).

### "Token signature verification failed"

**Solution**: 
- Check that `COGNITO_REGION` matches your Cognito User Pool region
- Verify `COGNITO_USER_POOL_ID` is correct
- Ensure token is from the correct User Pool

### "Token has expired"

**Solution**: Client should refresh the token using `react-oidc-context`'s automatic refresh.

### Hydration Errors

**Solution**: Use Server Components with `getServerAuth()` instead of client-side checks.

## Additional Resources

- [AWS Cognito JWT Verification](https://docs.aws.amazon.com/cognito/latest/developerguide/amazon-cognito-user-pools-using-tokens-verifying-a-jwt.html)
- [Next.js Server Components](https://nextjs.org/docs/app/building-your-application/rendering/server-components)
- [jose Library Documentation](https://github.com/panva/jose)

