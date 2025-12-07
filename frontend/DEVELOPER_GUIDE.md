# Developer Guide: KOKKAI DOC Frontend

## Table of Contents

1. [Project Overview](#project-overview)
2. [Project Structure](#project-structure)
3. [Adding New Pages](#adding-new-pages)
4. [Component Library](#component-library)
5. [Data Fetching](#data-fetching)
6. [Authentication](#authentication)
7. [Styling & Design System](#styling--design-system)
8. [Best Practices](#best-practices)
9. [Common Patterns](#common-patterns)

---

## Project Overview

This is a Next.js 15+ application using the **App Router** with:
- **Server-Side Rendering (SSR)** for initial data fetching
- **Incremental Static Regeneration (ISR)** with 1-week revalidation
- **Client Components** for interactive UI
- **TypeScript** for type safety

### Tech Stack

- **Framework**: Next.js 15+ (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **Deployment**: Vercel
- **Data Visualization**: D3.js (via custom components)

---

## Project Structure

```
frontend/app/
├── app/
│   ├── components/          # All React components
│   │   ├── features/        # Feature-specific components
│   │   ├── layout/          # Layout components
│   │   ├── shared/          # Reusable UI components
│   │   ├── visualizations/  # Data visualization components
│   │   └── ParliamentExplorerClient.tsx  # Client wrapper example
│   ├── data/                # Mock data (development)
│   ├── lib/                 # Utilities and helpers
│   │   ├── config/          # Configuration (API endpoints, etc.)
│   │   ├── hooks/           # React hooks
│   │   ├── services/        # Client-side data services
│   │   └── server/          # Server-side data fetchers
│   ├── types/               # TypeScript type definitions
│   ├── layout.tsx           # Root layout (Server Component)
│   ├── page.tsx             # Home page (Server Component)
│   └── globals.css          # Global styles
├── public/                  # Static assets
└── next.config.ts           # Next.js configuration
```

---

## Adding New Pages

### Overview: Server + Client Component Pattern

Next.js App Router uses a hybrid approach:
- **Server Components** (`page.tsx`): Fetch data on the server, render initial HTML
- **Client Components** (`"use client"`): Handle interactivity, state, and user actions

### Step 1: Create a New Route

Pages are created using the file-system routing. Create a folder structure:

```
app/
  └── your-page/
      └── page.tsx          # The page (Server Component)
```

**Example**: To create `/about`, create `app/about/page.tsx`

### Step 2: Server Component (page.tsx)

The Server Component fetches data and renders initial HTML:

```typescript
// app/about/page.tsx

import { Suspense } from "react";
import { YourPageClient } from "@/app/components/YourPageClient";
import { getData } from "@/app/lib/server/dataFetcher";

/**
 * Revalidation period (optional)
 * Only include if you want ISR caching
 */
export const revalidate = 604800; // 1 week (optional)

/**
 * Loading component for Suspense boundary
 */
function LoadingState() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="text-center">
        <div className="mb-4 text-lg text-gray-400">Loading...</div>
      </div>
    </div>
  );
}

/**
 * Server Component - Fetches data on the server
 */
export default async function AboutPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  // Await searchParams (required in Next.js 15+)
  const params = await searchParams;
  
  // Fetch data on the server
  const data = await getData();
  
  // Optional: Extract URL params for initial state
  const initialFilter = params.filter as string | undefined;

  return (
    <Suspense fallback={<LoadingState />}>
      <YourPageClient
        initialData={data}
        initialFilter={initialFilter}
      />
    </Suspense>
  );
}
```

### Step 3: Client Component (Handles Interactivity)

Create a Client Component wrapper for interactive features:

```typescript
// app/components/YourPageClient.tsx

"use client";

import { useState, useMemo, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Card, CardHeader } from "@/app/components/shared/Card";

interface YourPageClientProps {
  initialData: YourDataType[];
  initialFilter?: string;
}

export function YourPageClient({
  initialData,
  initialFilter,
}: YourPageClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  
  // State management
  const [selectedId, setSelectedId] = useState<string | null>(
    initialFilter || null
  );
  const [filter, setFilter] = useState("");

  // Sync state with URL (for shareable links)
  useEffect(() => {
    const urlFilter = searchParams.get("filter");
    if (urlFilter !== selectedId) {
      setSelectedId(urlFilter);
    }
  }, [searchParams]);

  // Update URL when state changes
  const handleFilterChange = useCallback((newFilter: string) => {
    setFilter(newFilter);
    const params = new URLSearchParams(searchParams.toString());
    if (newFilter) {
      params.set("filter", newFilter);
    } else {
      params.delete("filter");
    }
    router.push(`?${params.toString()}`, { scroll: false });
  }, [router, searchParams]);

  // Computed values
  const filteredData = useMemo(() => {
    return initialData.filter(item => 
      !filter || item.name.includes(filter)
    );
  }, [initialData, filter]);

  return (
    <div className="min-h-screen bg-linear-to-b from-[#111827] to-[#020617] p-4">
      <div className="mx-auto max-w-7xl">
        <Card>
          <CardHeader
            title="Your Page Title"
            subtitle="Page description"
          />
          {/* Your content here */}
          <div>
            {filteredData.map(item => (
              <div key={item.id}>{item.name}</div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
```

### Step 4: Dynamic Routes

For routes like `/politician/[id]`:

```typescript
// app/politician/[id]/page.tsx

import { Suspense } from "react";
import { PoliticianClient } from "@/app/components/PoliticianClient";
import { getPoliticianById } from "@/app/lib/server/dataFetcher";

export default async function PoliticianPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params; // Next.js 15+ requires await
  
  const politician = await getPoliticianById(id);

  if (!politician) {
    return <div>Politician not found</div>;
  }

  return (
    <Suspense fallback={<div>Loading...</div>}>
      <PoliticianClient initialPolitician={politician} />
    </Suspense>
  );
}
```

### Step 5: Metadata (SEO)

Add metadata to your page:

```typescript
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "About | KOKKAI DOC",
  description: "Learn about the Parliament Explorer platform",
};

export default async function AboutPage() {
  // ...
}
```

---

## Component Library

### Layout Components

#### `<Header />`

Application header component.

```typescript
import { Header } from "@/app/components/layout/Header";

<Header />
```

**Location**: `app/components/layout/Header.tsx`

---

#### `<ResizableContainer />`

Two-column resizable layout container.

```typescript
import { ResizableContainer } from "@/app/components/layout/ResizableContainer";

<ResizableContainer
  left={
    <Card>
      {/* Left column content */}
    </Card>
  }
  right={
    <Card>
      {/* Right column content */}
    </Card>
  }
/>
```

**Props**:
- `left: ReactNode` - Content for left column
- `right: ReactNode` - Content for right column

**Features**:
- Drag-to-resize divider
- Responsive (hides on mobile)
- Minimum widths enforced

**Location**: `app/components/layout/ResizableContainer.tsx`

---

### Shared Components

#### `<Card />`

Container with consistent styling and gradient overlay.

```typescript
import { Card } from "@/app/components/shared/Card";

<Card className="optional-custom-classes">
  <div>Your content</div>
</Card>
```

**Props**:
- `children: ReactNode` - Content
- `className?: string` - Additional CSS classes

**Location**: `app/components/shared/Card.tsx`

---

#### `<CardHeader />`

Header for Card components with title, subtitle, and optional action.

```typescript
import { CardHeader } from "@/app/components/shared/Card";

<Card>
  <CardHeader
    title="Section Title"
    subtitle="Optional description text"
    action={<button>Action</button>} // Optional
  />
  {/* Card content */}
</Card>
```

**Props**:
- `title: string` - Main title
- `subtitle?: string` - Optional description
- `action?: ReactNode` - Optional action button/element

**Location**: `app/components/shared/Card.tsx`

---

#### `<Badge />`

Small badge component for labels and tags.

```typescript
import { Badge } from "@/app/components/shared/Badge";

<Badge variant="trust">High Trust</Badge>
<Badge variant="fact">Verified</Badge>
<Badge variant="default">Default</Badge>
```

**Props**:
- `children: ReactNode` - Badge text
- `variant?: "default" | "trust" | "fact" | "major" | "minor"` - Style variant
- `className?: string` - Additional CSS classes

**Variants**:
- `default` - Cyan border, dark background
- `trust` - Emerald green
- `fact` - Yellow/amber
- `major` - For major parties
- `minor` - For minor parties

**Location**: `app/components/shared/Badge.tsx`

---

#### `<ScoreBar />`

Progress bar for displaying scores (0-100).

```typescript
import { ScoreBar } from "@/app/components/shared/ScoreBar";

<ScoreBar
  value={75}
  label="Trust score: 75/100"
  variant="trust"
/>
<ScoreBar
  value={60}
  label="Fact score: 60/100"
  variant="fact"
/>
```

**Props**:
- `value: number` - Score value (0-100)
- `label: string` - Label text
- `variant?: "trust" | "fact"` - Color scheme
- `className?: string` - Additional CSS classes

**Location**: `app/components/shared/ScoreBar.tsx`

---

#### `<EmptyState />`

Displays a message when there's no content.

```typescript
import { EmptyState } from "@/app/components/shared/EmptyState";

<EmptyState message="No items found" />
```

**Props**:
- `message: string` - Message to display
- `className?: string` - Additional CSS classes

**Location**: `app/components/shared/EmptyState.tsx`

---

#### `<Tooltip />`

Tooltip that appears on hover (positioned absolutely).

```typescript
import { Tooltip } from "@/app/components/shared/Tooltip";

// In your component
const [tooltipData, setTooltipData] = useState<{ title: string; meta?: string } | null>(null);
const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });

const handleMouseEnter = (e: React.MouseEvent, title: string, meta?: string) => {
  setTooltipData({ title, meta });
  setTooltipPos({ x: e.clientX, y: e.clientY });
};

const handleMouseLeave = () => {
  setTooltipData(null);
};

// In JSX
<Tooltip data={tooltipData} x={tooltipPos.x} y={tooltipPos.y} />
```

**Props**:
- `data: { title: string; meta?: string } | null` - Tooltip content
- `x: number` - X position (mouse/clientX)
- `y: number` - Y position (mouse/clientY)

**Usage Pattern**:
```typescript
<div
  onMouseEnter={(e) => handleMouseEnter(e, "Tooltip Title", "Optional meta info")}
  onMouseLeave={handleMouseLeave}
>
  Hover me
</div>
```

**Location**: `app/components/shared/Tooltip.tsx`

---

### Feature Components

These are feature-specific components. See their implementations for usage:

- **`<DetailPane />`** - Politician detail modal/panel
- **`<TopicSelector />`** - Topic filtering component
- **`<SearchList />`** - Searchable list of items
- **`<Rankings />`** - Ranking/leaderboard display

**Location**: `app/components/features/`

---

### Visualization Components

Custom D3.js-based visualizations:

- **`<IdeologicalScatterPlot />`** - 2D scatter plot of politician ideologies
- **`<NetworkGraph />`** - Network/graph visualization of politician interactions
- **`<JapanMap />`** - Map of Japan with prefecture highlighting

**Location**: `app/components/visualizations/`

**Note**: These are complex components. Refer to their implementations for props and usage.

---

## Data Fetching

### Server-Side Data Fetching

For Server Components, use server-side fetchers:

```typescript
// app/lib/server/dataFetcher.ts

import { API_ENDPOINTS } from "@/app/lib/config/api";

const REVALIDATION_TIME = 604800; // 1 week

async function fetchApi<T>(endpoint: string): Promise<T> {
  const baseUrl = getServerApiBaseUrl();
  const url = `${baseUrl}${endpoint}`;

  const response = await fetch(url, {
    headers: { "Content-Type": "application/json" },
    next: { revalidate: REVALIDATION_TIME }, // ISR caching
  });

  if (!response.ok) {
    throw new Error(`API request failed: ${response.status}`);
  }

  return await response.json();
}

export async function getYourData(): Promise<YourType[]> {
  if (isLocalDevelopment()) {
    return mockData; // Use mock data in development
  }

  try {
    return await fetchApi<YourType[]>(API_ENDPOINTS.yourEndpoint);
  } catch (error) {
    console.error("Failed to fetch data:", error);
    return mockData; // Fallback to mock data
  }
}
```

**Key Points**:
- ✅ Use `next: { revalidate: 604800 }` for caching
- ✅ Handle errors gracefully
- ✅ Use mock data in development
- ✅ Export functions for use in Server Components

### Client-Side Data Fetching

For Client Components, use hooks:

```typescript
// app/lib/hooks/useYourData.ts

import { useState, useEffect, useCallback } from "react";
import { fetchYourData } from "@/app/lib/services/dataService";

export function useYourData() {
  const [data, setData] = useState<YourType[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const result = await fetchYourData();
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err : new Error("Failed to fetch"));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { data, loading, error, refetch: fetchData };
}
```

**Usage**:
```typescript
"use client";

import { useYourData } from "@/app/lib/hooks/useYourData";

export function YourComponent() {
  const { data, loading, error } = useYourData();

  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error: {error.message}</div>;

  return <div>{/* Render data */}</div>;
}
```

### Existing Hooks

Located in `app/lib/hooks/useParliamentData.ts`:

- `usePoliticians()` - Fetch all politicians
- `useTopics()` - Fetch topics
- `usePrefectures()` - Fetch prefectures
- `useNetworkEdges()` - Fetch network edges
- `useComments(politicianId)` - Fetch comments for a politician
- `usePolitician(id)` - Fetch single politician

---

## Authentication

The application uses **AWS Cognito** for authentication via `react-oidc-context`. Authentication is integrated at the root layout level, making it available throughout the application.

### Overview

- **Provider**: `react-oidc-context` (OIDC/OAuth2)
- **Backend**: AWS Cognito User Pool
- **Flow**: Authorization Code Flow with PKCE
- **Integration**: Wrapped at root layout level

### Configuration

Authentication configuration is managed via environment variables:

```bash
# .env.local or .env.production
NEXT_PUBLIC_COGNITO_AUTHORITY=https://cognito-idp.ap-northeast-1.amazonaws.com/ap-northeast-1_WFUAyQtMs
NEXT_PUBLIC_COGNITO_CLIENT_ID=237qf0kbmlmrugugfsdqfnj02r
NEXT_PUBLIC_COGNITO_REDIRECT_URI=https://kokkaidoc.vercel.app/
NEXT_PUBLIC_COGNITO_LOGOUT_URI=https://kokkaidoc.vercel.app/
NEXT_PUBLIC_COGNITO_DOMAIN=https://your-cognito-domain.auth.ap-northeast-1.amazoncognito.com
```

**Location**: `app/lib/config/auth.ts`

**Note**: If environment variables are not set, the system falls back to default values (for development).

### Using Authentication

#### 1. Check Authentication Status

```typescript
"use client";

import { useAuth } from "@/app/lib/hooks/useAuth";

export function MyComponent() {
  const { isAuthenticated, isLoading, user } = useAuth();

  if (isLoading) {
    return <div>Loading...</div>;
  }

  if (isAuthenticated) {
    return <div>Welcome, {user?.profile.email}!</div>;
  }

  return <div>Please sign in</div>;
}
```

#### 2. Sign In

```typescript
"use client";

import { useAuth } from "@/app/lib/hooks/useAuth";

export function LoginButton() {
  const { signIn } = useAuth();

  return (
    <button onClick={() => signIn()}>
      Sign in
    </button>
  );
}
```

#### 3. Sign Out

There are two sign-out methods:

**Local Sign Out** (removes user from local storage):
```typescript
const { signOut } = useAuth();

<button onClick={() => signOut()}>
  Sign out
</button>
```

**Sign Out with Redirect** (redirects to Cognito logout):
```typescript
const { signOutRedirect } = useAuth();

<button onClick={() => signOutRedirect()}>
  Sign out
</button>
```

#### 4. Access User Information

```typescript
const { user } = useAuth();

// User profile information
const email = user?.profile.email;
const phone = user?.profile.phone;

// Tokens
const idToken = user?.id_token;
const accessToken = user?.access_token;
const refreshToken = user?.refresh_token;
```

#### 5. Protect Routes

Use the `AuthGuard` component to protect routes that require authentication:

```typescript
"use client";

import { AuthGuard } from "@/app/components/auth/AuthGuard";

export function ProtectedPage() {
  return (
    <AuthGuard>
      <div>This content is only visible to authenticated users</div>
    </AuthGuard>
  );
}
```

**AuthGuard Features**:
- Shows loading state while checking authentication
- Automatically redirects to login if not authenticated
- Renders children only when authenticated

### Authentication Components

#### `<AuthProvider />`

Wraps the application with OIDC authentication context. Already integrated in `app/layout.tsx`.

**Location**: `app/components/auth/AuthProvider.tsx`

---

#### `<AuthGuard />`

Protects routes that require authentication.

```typescript
import { AuthGuard } from "@/app/components/auth/AuthGuard";

<AuthGuard fallback={<CustomLoading />}>
  <ProtectedContent />
</AuthGuard>
```

**Props**:
- `children: ReactNode` - Content to protect
- `fallback?: ReactNode` - Custom loading component (optional)

**Location**: `app/components/auth/AuthGuard.tsx`

---

#### `<AuthButton />`

Pre-built login/logout button component.

```typescript
import { AuthButton } from "@/app/components/auth/AuthButton";

<AuthButton />
```

**Features**:
- Shows "Sign in" when not authenticated
- Shows user email and "Sign out" when authenticated
- Handles loading states

**Location**: `app/components/auth/AuthButton.tsx`

**Usage Example** (already in Header):
```typescript
import { AuthButton } from "@/app/components/auth/AuthButton";

<header>
  {/* ... */}
  <AuthButton />
</header>
```

### Authentication Hook

#### `useAuth()`

Custom hook that wraps `react-oidc-context`'s `useAuth` with additional utilities.

```typescript
import { useAuth } from "@/app/lib/hooks/useAuth";

const {
  // Authentication state
  isAuthenticated,  // boolean
  isLoading,        // boolean
  error,            // Error | null
  user,             // User | null
  
  // Actions
  signIn,           // () => void
  signOut,          // () => Promise<void>
  signOutRedirect,  // () => void
  
  // Original react-oidc-context methods
  signinRedirect,   // () => Promise<void>
  removeUser,       // () => Promise<void>
  // ... other methods
} = useAuth();
```

**Location**: `app/lib/hooks/useAuth.ts`

### User Object Structure

The `user` object from `react-oidc-context` contains:

```typescript
interface User {
  id_token: string;
  access_token: string;
  refresh_token?: string;
  profile: {
    sub: string;              // User ID
    email?: string;
    email_verified?: boolean;
    phone?: string;
    phone_verified?: boolean;
    // ... other profile fields
  };
  expires_at?: number;        // Token expiration timestamp
}
```

### Protecting API Calls

To include the access token in API requests:

```typescript
"use client";

import { useAuth } from "@/app/lib/hooks/useAuth";

async function fetchProtectedData() {
  const { user } = useAuth();
  
  if (!user?.access_token) {
    throw new Error("Not authenticated");
  }

  const response = await fetch("/api/protected", {
    headers: {
      "Authorization": `Bearer ${user.access_token}`,
      "Content-Type": "application/json",
    },
  });

  return response.json();
}
```

### Error Handling

```typescript
const { error, isAuthenticated } = useAuth();

if (error) {
  return (
    <div>
      <p>Authentication error: {error.message}</p>
      <button onClick={() => signIn()}>Try again</button>
    </div>
  );
}
```

### Common Patterns

#### Pattern 1: Conditional Rendering Based on Auth

```typescript
"use client";

import { useAuth } from "@/app/lib/hooks/useAuth";

export function ConditionalContent() {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) return <div>Loading...</div>;
  
  return (
    <div>
      {isAuthenticated ? (
        <div>Authenticated content</div>
      ) : (
        <div>Public content</div>
      )}
    </div>
  );
}
```

#### Pattern 2: Protected Page

```typescript
// app/protected/page.tsx (Server Component)
import { Suspense } from "react";
import { ProtectedClient } from "@/app/components/ProtectedClient";

export default function ProtectedPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <ProtectedClient />
    </Suspense>
  );
}

// app/components/ProtectedClient.tsx (Client Component)
"use client";

import { AuthGuard } from "@/app/components/auth/AuthGuard";
import { useAuth } from "@/app/lib/hooks/useAuth";

export function ProtectedClient() {
  const { user } = useAuth();

  return (
    <AuthGuard>
      <div>
        <h1>Protected Page</h1>
        <p>Welcome, {user?.profile.email}!</p>
      </div>
    </AuthGuard>
  );
}
```

#### Pattern 3: User Profile Display

```typescript
"use client";

import { useAuth } from "@/app/lib/hooks/useAuth";
import { Badge } from "@/app/components/shared/Badge";

export function UserProfile() {
  const { user, isAuthenticated } = useAuth();

  if (!isAuthenticated || !user) {
    return null;
  }

  return (
    <div>
      <Badge variant="default">
        {user.profile.email || "User"}
      </Badge>
      {user.profile.email_verified && (
        <Badge variant="trust">Verified</Badge>
      )}
    </div>
  );
}
```

### Environment Setup

#### Development

1. Create `.env.local`:
```bash
NEXT_PUBLIC_COGNITO_AUTHORITY=https://cognito-idp.ap-northeast-1.amazonaws.com/ap-northeast-1_WFUAyQtMs
NEXT_PUBLIC_COGNITO_CLIENT_ID=237qf0kbmlmrugugfsdqfnj02r
NEXT_PUBLIC_COGNITO_REDIRECT_URI=http://localhost:3000/
NEXT_PUBLIC_COGNITO_LOGOUT_URI=http://localhost:3000/
NEXT_PUBLIC_COGNITO_DOMAIN=https://your-cognito-domain.auth.ap-northeast-1.amazoncognito.com
```

2. Ensure your Cognito User Pool is configured:
   - App client must allow the redirect URI
   - OAuth 2.0 settings enabled
   - Authorization code grant enabled

#### Production

Set environment variables in Vercel dashboard:
- Go to Project Settings → Environment Variables
- Add all `NEXT_PUBLIC_COGNITO_*` variables
- Redeploy after adding variables

### Troubleshooting

#### "Redirect URI mismatch"

**Solution**: Ensure the redirect URI in your environment variables matches exactly what's configured in AWS Cognito App Client settings.

#### "User is not authenticated" after login

**Solution**: 
1. Check that `NEXT_PUBLIC_COGNITO_REDIRECT_URI` matches the current domain
2. Verify Cognito User Pool domain is correct
3. Check browser console for OIDC errors

#### "Cannot read property 'profile' of null"

**Solution**: Always check if `user` exists before accessing properties:
```typescript
const { user } = useAuth();
if (user?.profile?.email) {
  // Safe to use
}
```

#### Tokens not refreshing

**Solution**: `react-oidc-context` automatically handles token refresh. If issues occur:
1. Check token expiration times
2. Verify refresh token is included in response
3. Check browser console for refresh errors

### Security Best Practices

1. **Never expose secrets**: Only use `NEXT_PUBLIC_*` for public configuration
2. **Validate tokens server-side**: Don't trust client-side tokens for sensitive operations
3. **Use HTTPS in production**: Required for OAuth flows
4. **Handle token expiration**: Implement proper error handling for expired tokens
5. **Secure logout**: Use `signOutRedirect()` to fully log out from Cognito

### Additional Resources

- [react-oidc-context Documentation](https://github.com/authts/react-oidc-context)
- [AWS Cognito Documentation](https://docs.aws.amazon.com/cognito/)
- [OAuth 2.0 / OIDC Flow](https://oauth.net/2/)

---

## Styling & Design System

### Tailwind CSS

The project uses Tailwind CSS with custom configuration.

### Color Palette

- **Primary**: Cyan (`cyan-400`, `cyan-500`)
- **Trust**: Emerald green (`emerald-400`, `emerald-500`)
- **Fact**: Yellow/amber (`yellow-400`, `amber-500`)
- **Background**: Dark slate (`slate-800`, `slate-900`, `#020617`)
- **Text**: Gray scale (`gray-400`, `gray-500`)

### Common Classes

```typescript
// Container
className="min-h-screen bg-linear-to-b from-[#111827] to-[#020617] p-4"

// Card
className="rounded-2xl border border-white/5 bg-linear-to-br from-[#020617] to-[#020617]"

// Text
className="text-sm text-gray-400"
className="text-xs text-gray-500"

// Buttons
className="rounded-full border border-slate-400/40 px-2 py-1 text-xs"
```

### Design Principles

1. **Dark Theme**: Consistent dark color scheme
2. **Gradients**: Subtle gradient overlays on cards
3. **Spacing**: Consistent padding and margins (`p-4`, `gap-4`)
4. **Typography**: Small text sizes (`text-xs`, `text-sm`) for compact UI
5. **Rounded Corners**: `rounded-xl`, `rounded-2xl` for modern look

---

## Best Practices

### 1. Server vs Client Components

✅ **Server Components** for:
- Data fetching
- Direct database/API access
- Sensitive operations (API keys, tokens)
- Static content

✅ **Client Components** (`"use client"`) for:
- Interactivity (onClick, onChange, etc.)
- Browser APIs (localStorage, window)
- React hooks (useState, useEffect, useContext)
- Event listeners

### 2. Data Fetching Strategy

**Prefer Server-Side Fetching**:
- ✅ Faster initial page load
- ✅ Better SEO
- ✅ Reduced client-side JavaScript

**Use Client-Side Fetching** for:
- ✅ Dynamic updates (real-time data)
- ✅ User-triggered actions (search, filters)
- ✅ Dependent data (fetch after user interaction)

### 3. State Management

**URL State** for:
- ✅ Shareable state (selected politician, filters)
- ✅ Browser back/forward support
- ✅ Deep linking

**React State** for:
- ✅ UI state (modals, dropdowns)
- ✅ Temporary filters
- ✅ Form inputs

### 4. Error Handling

Always handle errors gracefully:

```typescript
// Server Component
try {
  const data = await getData();
} catch (error) {
  console.error("Failed to fetch:", error);
  // Fallback to mock data or show error UI
}

// Client Component
const { data, loading, error } = useYourData();

if (error) {
  return <div>Error: {error.message}</div>;
}
```

### 5. TypeScript

- ✅ Always define types for props and data
- ✅ Use interfaces from `app/types/`
- ✅ Avoid `any` - use `unknown` with type guards
- ✅ Export types for reuse

---

## Common Patterns

### Pattern 1: Server Component + Client Component

```typescript
// page.tsx (Server)
export default async function Page() {
  const data = await getData();
  return <ClientComponent initialData={data} />;
}

// ClientComponent.tsx (Client)
"use client";
export function ClientComponent({ initialData }) {
  const [state, setState] = useState(initialData);
  // Interactive logic
}
```

### Pattern 2: URL State Synchronization

```typescript
"use client";

const router = useRouter();
const searchParams = useSearchParams();
const [selectedId, setSelectedId] = useState(initialId);

// Sync URL → State
useEffect(() => {
  const urlId = searchParams.get("id");
  if (urlId !== selectedId) {
    setSelectedId(urlId);
  }
}, [searchParams]);

// Sync State → URL
const handleSelect = (id: string) => {
  setSelectedId(id);
  const params = new URLSearchParams(searchParams.toString());
  params.set("id", id);
  router.push(`?${params.toString()}`, { scroll: false });
};
```

### Pattern 3: Loading States

```typescript
// Server Component with Suspense
<Suspense fallback={<LoadingState />}>
  <ClientComponent data={data} />
</Suspense>

// Client Component with hooks
const { data, loading, error } = useData();

if (loading) return <LoadingState />;
if (error) return <ErrorState />;
return <Content data={data} />;
```

### Pattern 4: Filtered/Sorted Lists

```typescript
const filteredItems = useMemo(() => {
  return items.filter(item => {
    if (filter && !item.name.includes(filter)) return false;
    if (topic && !item.topics.includes(topic)) return false;
    return true;
  });
}, [items, filter, topic]);
```

---

## API Configuration

### Environment Variables

```bash
# .env.local (development)
NEXT_PUBLIC_ENVIRONMENT=local  # Use mock data
NEXT_PUBLIC_API_URL=http://localhost:5000

# .env.production
NEXT_PUBLIC_API_URL=https://your-api.com
```

### API Endpoints

Defined in `app/lib/config/api.ts`:

```typescript
export const API_ENDPOINTS = {
  sangiinRepr: "/sangiin/repr",
  shugiinRepr: "/shugiin/repr",
  // Add your endpoints here
};
```

---

## Deployment

### Vercel Deployment

1. **Push to GitHub**: Code is automatically deployed
2. **Environment Variables**: Set in Vercel dashboard
3. **ISR**: Automatically works with `revalidate` export

### Manual Revalidation

Force revalidation via Vercel API:

```bash
curl -X POST "https://your-app.vercel.app/api/revalidate?secret=YOUR_SECRET"
```

Or use Vercel dashboard to clear cache.

---

## Troubleshooting

### "Cannot use hooks in Server Component"

**Solution**: Move hook usage to a Client Component.

```typescript
// ❌ Wrong
export default async function Page() {
  const data = useData(); // Error!
}

// ✅ Correct
"use client";
export function ClientPage() {
  const { data } = useData(); // OK
}
```

### "searchParams must be awaited"

**Solution**: In Next.js 15+, `searchParams` is a Promise.

```typescript
// ✅ Correct
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ id?: string }>;
}) {
  const params = await searchParams;
  const id = params.id;
}
```

### "fetch failed" errors

**Solution**: Check:
1. API URL environment variable
2. CORS settings on backend
3. Network connectivity (server-side fetch can't use localhost if deployed)

---

## Additional Resources

- [Next.js App Router Docs](https://nextjs.org/docs/app)
- [Server Components](https://nextjs.org/docs/app/building-your-application/rendering/server-components)
- [Data Fetching](https://nextjs.org/docs/app/building-your-application/data-fetching)
- [Tailwind CSS Docs](https://tailwindcss.com/docs)

---

---

## Quick Reference: Component Usage Examples

### Complete Page Example

```typescript
// app/dashboard/page.tsx (Server Component)
import { Suspense } from "react";
import { DashboardClient } from "@/app/components/DashboardClient";
import { getDashboardData } from "@/app/lib/server/dataFetcher";

export const revalidate = 604800; // 1 week

function LoadingState() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="text-lg text-gray-400">Loading...</div>
    </div>
  );
}

export default async function DashboardPage() {
  const data = await getDashboardData();
  
  return (
    <Suspense fallback={<LoadingState />}>
      <DashboardClient initialData={data} />
    </Suspense>
  );
}
```

```typescript
// app/components/DashboardClient.tsx (Client Component)
"use client";

import { useState } from "react";
import { Card, CardHeader } from "@/app/components/shared/Card";
import { Badge } from "@/app/components/shared/Badge";

export function DashboardClient({ initialData }) {
  const [selectedItem, setSelectedItem] = useState(null);

  return (
    <div className="min-h-screen bg-linear-to-b from-[#111827] to-[#020617] p-4">
      <div className="mx-auto max-w-7xl">
        <Card>
          <CardHeader
            title="Dashboard"
            subtitle="Overview of all data"
          />
          <div>
            {initialData.map(item => (
              <div key={item.id}>{item.name}</div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
```

### Feature Component Usage

```typescript
// Using TopicSelector
import { TopicSelector } from "@/app/components/features/TopicSelector";

<TopicSelector
  topics={topicsData}
  selectedTopicId={selectedTopicId}
  selectedSubtopicId={selectedSubtopicId}
  onTopicChange={(topicId, subtopicId) => {
    setSelectedTopicId(topicId);
    setSelectedSubtopicId(subtopicId);
  }}
/>

// Using SearchList
import { SearchList } from "@/app/components/features/SearchList";

<SearchList
  politicians={politiciansData}
  selectedId={selectedId}
  onPoliticianSelect={(id) => setSelectedId(id)}
/>
```

### Card Layout Pattern

```typescript
import { Card, CardHeader } from "@/app/components/shared/Card";

<Card>
  <CardHeader
    title="Section Title"
    subtitle="Optional description"
    action={<button>Action</button>}
  />
  <div>
    {/* Your content */}
  </div>
</Card>
```

### Score Display Pattern

```typescript
import { ScoreBar } from "@/app/components/shared/ScoreBar";

<div className="flex items-center gap-4">
  <ScoreBar
    value={politician.trustScore}
    label={`${politician.trustLabel} · ${politician.trustScore}/100`}
    variant="trust"
  />
  <ScoreBar
    value={politician.factScore}
    label={`${politician.factLabel} · ${politician.factScore}/100`}
    variant="fact"
  />
</div>
```

### Badge Usage Pattern

```typescript
import { Badge } from "@/app/components/shared/Badge";

<div className="flex gap-2">
  <Badge variant="trust">High Trust</Badge>
  <Badge variant="fact">Verified</Badge>
  <Badge variant="major">{politician.party}</Badge>
</div>
```

### Empty State Pattern

```typescript
import { EmptyState } from "@/app/components/shared/EmptyState";

{filteredItems.length === 0 ? (
  <EmptyState message="No items found matching your criteria" />
) : (
  filteredItems.map(item => <Item key={item.id} {...item} />)
)}
```

### Tooltip Pattern

```typescript
import { Tooltip } from "@/app/components/shared/Tooltip";

const [tooltipData, setTooltipData] = useState(null);
const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });

const handleMouseEnter = (e: React.MouseEvent, title: string) => {
  setTooltipData({ title });
  setTooltipPos({ x: e.clientX, y: e.clientY });
};

return (
  <>
    <div
      onMouseEnter={(e) => handleMouseEnter(e, "Tooltip text")}
      onMouseLeave={() => setTooltipData(null)}
    >
      Hover me
    </div>
    <Tooltip data={tooltipData} x={tooltipPos.x} y={tooltipPos.y} />
  </>
);
```

---

## Questions?

For questions or issues:
1. Check existing code for patterns (especially `app/page.tsx` and `app/components/ParliamentExplorerClient.tsx`)
2. Review `SSR_MIGRATION.md` for SSR details
3. Review `SSR_FEATURES.md` for Next.js features
4. Check TypeScript types in `app/types/index.ts`
5. Refer to component source files for detailed prop definitions

Happy coding! 🚀

