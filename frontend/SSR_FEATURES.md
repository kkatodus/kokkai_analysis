# Server-Side Rendering (SSR) Features in Next.js

This document explains which Next.js features require server-side rendering and what alternatives are available for static export deployment.

## Features That Require SSR

### 1. **API Routes** (`app/api/` or `pages/api/`)

**What it is:**
- Server-side endpoints that run on the Next.js server
- Can handle POST/PUT/DELETE requests, file uploads, database operations
- Access to server-side environment variables and secrets

**Example:**
```typescript
// app/api/data/route.ts
export async function GET(request: Request) {
  const data = await fetchFromDatabase();
  return Response.json(data);
}
```

**Why it needs SSR:**
- Runs on the server, not in the browser
- Needs Node.js runtime environment

**Alternative for Static Export:**
- ✅ Use your existing Express.js backend (`api/` directory)
- ✅ Call external APIs directly from the frontend
- ✅ Use AWS API Gateway + Lambda for serverless endpoints

**For KOKKAI DOC:**
- Your Express.js backend already handles API endpoints
- Frontend can call `/manifesto/party/:name`, `/sangiin/repr`, etc. from the Express server
- No need for Next.js API routes

---

### 2. **Server Components** (with dynamic data)

**What it is:**
- React components that render on the server
- Can fetch data directly from databases/APIs during render
- Access to server-only APIs (filesystem, environment variables)

**Example:**
```typescript
// app/page.tsx
async function getData() {
  const res = await fetch('https://api.example.com/data', {
    cache: 'no-store' // Forces server-side fetch
  });
  return res.json();
}

export default async function Page() {
  const data = await getData(); // Runs on server
  return <div>{data.title}</div>;
}
```

**Why it needs SSR:**
- `async` components and server-side data fetching require a Node.js server
- Static export pre-renders everything at build time

**Alternative for Static Export:**
- ✅ Use Client Components with `useEffect` or React Query
- ✅ Fetch data in the browser after page loads
- ✅ Use static generation with build-time data fetching

**For KOKKAI DOC:**
- Fetch data from your Express.js API in client components
- Use React Query or SWR for data fetching and caching
- Pre-fetch data at build time if it's static

---

### 3. **Dynamic Routes with Server-Side Data**

**What it is:**
- Routes that fetch different data based on URL parameters
- Example: `/representative/[id]` that loads rep data from database

**Example:**
```typescript
// app/representative/[id]/page.tsx
export default async function RepPage({ params }: { params: { id: string } }) {
  const rep = await getRepresentative(params.id); // Server-side fetch
  return <div>{rep.name}</div>;
}
```

**Why it needs SSR:**
- Data is fetched on each request, not at build time
- Requires server to handle dynamic requests

**Alternative for Static Export:**
- ✅ Use client-side data fetching with dynamic routes
- ✅ Pre-generate common pages at build time
- ✅ Use client-side routing with data fetching

**For KOKKAI DOC:**
```typescript
// app/representative/[id]/page.tsx (Client Component)
'use client';
import { useEffect, useState } from 'react';

export default function RepPage({ params }: { params: { id: string } }) {
  const [rep, setRep] = useState(null);
  
  useEffect(() => {
    fetch(`/api/sangiin/repr/${params.id}`)
      .then(res => res.json())
      .then(setRep);
  }, [params.id]);
  
  return rep ? <div>{rep.name}</div> : <div>Loading...</div>;
}
```

---

### 4. **Middleware** (`middleware.ts`)

**What it is:**
- Code that runs before a request is completed
- Can redirect, rewrite URLs, set headers, authenticate
- Runs on Edge or Node.js runtime

**Example:**
```typescript
// middleware.ts
export function middleware(request: NextRequest) {
  if (request.nextUrl.pathname.startsWith('/admin')) {
    return NextResponse.redirect(new URL('/login', request.url));
  }
}
```

**Why it needs SSR:**
- Runs on the server/edge before rendering
- Needs server runtime

**Alternative for Static Export:**
- ✅ Handle redirects/routing in client-side code
- ✅ Use CloudFront functions or Lambda@Edge for edge logic
- ✅ Handle authentication in the frontend or API Gateway

---

### 5. **Incremental Static Regeneration (ISR)**

**What it is:**
- Pages that are statically generated but can be revalidated periodically
- Example: Rebuild a page every 60 seconds if data changes

**Example:**
```typescript
export const revalidate = 60; // Revalidate every 60 seconds
```

**Why it needs SSR:**
- Requires a server to handle revalidation requests
- Needs Next.js server to rebuild pages

**Alternative for Static Export:**
- ✅ Use client-side data fetching with cache headers
- ✅ Rebuild and redeploy when data changes
- ✅ Use stale-while-revalidate pattern in the frontend

---

### 6. **Server Actions**

**What it is:**
- Functions that run on the server, called from client components
- Can mutate data, send emails, etc.

**Example:**
```typescript
// app/actions.ts
'use server';
export async function submitForm(formData: FormData) {
  await saveToDatabase(formData);
}
```

**Why it needs SSR:**
- Runs on the server, not in the browser

**Alternative for Static Export:**
- ✅ Use regular API calls to your Express.js backend
- ✅ Use fetch POST/PUT/DELETE requests

---

### 7. **Image Optimization** (Next.js built-in)

**What it is:**
- Automatic image resizing, format conversion, lazy loading
- Requires Next.js Image Optimization API

**Why it needs SSR:**
- Image optimization runs on the server
- Requires Next.js server or Vercel's Image Optimization API

**Alternative for Static Export:**
- ✅ Use `images: { unoptimized: true }` (already configured)
- ✅ Pre-optimize images before build
- ✅ Use external image CDN (Cloudinary, Imgix, etc.)
- ✅ Use regular `<img>` tags with optimized images

---

## Features That Work with Static Export

### ✅ **Client Components**
- All React components that run in the browser
- Can use hooks (`useState`, `useEffect`, etc.)
- Can fetch data from APIs

### ✅ **Static Generation**
- Pages generated at build time
- Perfect for content that doesn't change often

### ✅ **Dynamic Routes (Client-Side)**
- Routes like `/representative/[id]` work fine
- Just fetch data in the client component

### ✅ **Client-Side Routing**
- Next.js App Router works perfectly
- All navigation happens in the browser

### ✅ **Metadata API**
- Static metadata works (title, description, etc.)
- Dynamic metadata based on URL params requires client-side logic

### ✅ **Font Optimization**
- `next/font` works with static export
- Fonts are optimized at build time

---

## Recommended Architecture for KOKKAI DOC

### Current Setup (Static Export + Express Backend)

```
┌─────────────────┐
│  CloudFront     │  ← Serves static Next.js app
│  + S3           │
└────────┬────────┘
         │
         │ (API calls)
         ▼
┌─────────────────┐
│  Express.js API │  ← Handles all server-side logic
│  (Heroku/AWS)   │
└─────────────────┘
```

### What to Use Where

**Frontend (Static Export):**
- ✅ All UI components and pages
- ✅ Client-side routing
- ✅ Data fetching from Express API
- ✅ Client-side state management
- ✅ Static content (HTML, CSS, JS)

**Backend (Express.js):**
- ✅ All API endpoints (`/manifesto/*`, `/sangiin/*`, etc.)
- ✅ Database queries
- ✅ Data processing
- ✅ Authentication (if needed)
- ✅ File uploads/downloads

### Example: Fetching Representative Data

```typescript
// frontend/app/representative/[id]/page.tsx
'use client';
import { useEffect, useState } from 'react';

export default function RepresentativePage({ params }: { params: { id: string } }) {
  const [rep, setRep] = useState(null);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    // Fetch from Express.js backend
    fetch(`https://api.kokkaidoc.com/sangiin/repr/${params.id}`)
      .then(res => res.json())
      .then(data => {
        setRep(data);
        setLoading(false);
      });
  }, [params.id]);
  
  if (loading) return <div>Loading...</div>;
  if (!rep) return <div>Not found</div>;
  
  return (
    <div>
      <h1>{rep.name}</h1>
      {/* Render representative data */}
    </div>
  );
}
```

---

## Summary

**You DON'T need SSR for:**
- ✅ Displaying data from your Express.js API
- ✅ Client-side routing and navigation
- ✅ Interactive UI components
- ✅ Forms and user input
- ✅ Data visualization and charts
- ✅ Search and filtering (client-side)

**You WOULD need SSR for:**
- ❌ Next.js API routes (but you have Express.js instead)
- ❌ Server-side data fetching in components (use client-side fetching)
- ❌ Server Actions (use API calls instead)
- ❌ Middleware (use client-side or CloudFront functions)
- ❌ ISR (use client-side caching instead)

**Your current architecture is perfect for static export!** The Express.js backend handles all server-side needs, and the Next.js frontend can be fully static.

