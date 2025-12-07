# Server-Side Rendering Migration Guide

## Summary

The Parliament Explorer page has been converted from a fully client-side component to a **hybrid Server/Client Component architecture** that enables:

1. **Server-Side Rendering (SSR)** - Initial data is fetched on the server
2. **Dynamic Interactivity** - All user interactions remain fully interactive
3. **Shareable URLs** - Selected politician IDs are stored in URL params
4. **Better Performance** - Faster initial page load with server-rendered HTML

## Architecture Changes

### Before (Client-Side Only)
```
Page (Client Component)
  └─> useEffect hooks fetch data on client
  └─> All data loading happens in browser
```

### After (Server + Client Hybrid)
```
Page (Server Component)
  ├─> Fetches initial data on server
  └─> ParliamentExplorerClient (Client Component)
      └─> Handles all interactivity
      └─> Can refetch data if needed
```

## Key Files Changed

### 1. `app/page.tsx` (Server Component)
- **Before**: Client component (`"use client"`) with hooks
- **After**: Async Server Component that fetches data server-side
- Fetches initial data using `getPoliticians()`, `getTopics()`, etc.
- Passes data as props to client component
- Reads `searchParams` for initial selected politician ID

### 2. `app/components/ParliamentExplorerClient.tsx` (New Client Component)
- **Purpose**: Handles all interactive state and user actions
- Receives initial data from Server Component
- Manages state (selectedId, topics, filters, etc.)
- Updates URL for shareable links
- Fetches comments client-side (for dynamic updates)

### 3. `app/lib/server/dataFetcher.ts` (New Server-Side Data Fetcher)
- Server-compatible data fetching functions
- Uses native `fetch` with proper cache settings
- Works in Server Components (no `useEffect`, no hooks)

### 4. `next.config.ts` (Updated)
- **Before**: `output: "export"` (static export)
- **After**: Removed static export to enable SSR
- **Important**: This requires deploying Next.js as a server (not static files)

## Deployment Requirements

### ⚠️ Important: Deployment Change Required

**Before**: Static export → Deployed to S3/CloudFront as static files  
**After**: SSR enabled → Requires Next.js server runtime

### Deployment Options

1. **Vercel** (Recommended for Next.js)
   - Zero-config deployment
   - Built-in SSR support
   - Free tier available

2. **AWS with Container**
   - Deploy Next.js as containerized app
   - Use ECS/Fargate or App Runner
   - Requires Docker setup

3. **AWS Lambda** (with `@vercel/next`)
   - Serverless Next.js deployment
   - Good for cost optimization

4. **Other Platforms**
   - Railway, Render, Fly.io
   - Any Node.js hosting platform

### If You Need to Revert to Static Export

If you need to keep static export (S3/CloudFront), you can:

1. Set `output: "export"` back in `next.config.ts`
2. Convert `app/page.tsx` back to a Client Component
3. Remove `app/lib/server/dataFetcher.ts` (use client-side hooks instead)

## Benefits of SSR

1. **Faster Initial Load**
   - HTML is pre-rendered with data
   - No loading spinner on first render (for initial data)

2. **Better SEO**
   - Search engines see fully rendered content
   - Better meta tags and structured data

3. **Shareable URLs**
   - Selected politician ID in URL (`?id=politician_123`)
   - Users can share links to specific views

4. **Progressive Enhancement**
   - Works even if JavaScript is disabled (for initial view)
   - Client-side interactivity enhances the experience

## How It Works

### Initial Page Load (Server-Side)

1. User requests `/` or `/?id=politician_123`
2. Next.js Server Component (`app/page.tsx`) runs on server
3. Server fetches all initial data:
   - Politicians list
   - Topics
   - Prefectures
   - Network edges
4. Server renders HTML with data pre-filled
5. HTML sent to browser
6. Client Component hydrates and takes over interactivity

### User Interactions (Client-Side)

1. User clicks a politician
2. `handlePoliticianSelect()` updates:
   - Local React state
   - URL search params (for shareable links)
3. Comments are fetched client-side (using existing hooks)
4. UI updates immediately

### Browser Navigation

1. User clicks browser back/forward
2. URL changes
3. `useSearchParams()` hook detects change
4. State syncs with URL
5. UI updates accordingly

## Testing Locally

1. **Development Mode** (with SSR):
   ```bash
   npm run dev
   ```
   - Server Component runs on dev server
   - Data fetched server-side
   - Hot reload works normally

2. **Build & Test Production Build**:
   ```bash
   npm run build
   npm start
   ```
   - Tests production SSR behavior
   - Verify data loads correctly

## Future Enhancements

### Optional: Server Actions for Comments

You could convert comment adding to use Server Actions instead of client-side prompts:

```typescript
// app/actions/comments.ts
'use server';

export async function addComment(politicianId: string, comment: string) {
  // Save to database
  // Return updated comments
}
```

Then use in Client Component:
```typescript
import { addComment } from '@/app/actions/comments';

const handleAddComment = async (politicianId: string, comment: string) => {
  await addComment(politicianId, comment);
  // Refresh comments
};
```

### Incremental Static Regeneration (ISR) - ✅ Implemented

ISR is configured to cache rendered pages and prevent API hammering:

```typescript
// app/page.tsx
export const revalidate = 604800; // Revalidate every week (7 days)
```

**How it works:**
- Page is cached after first render
- Subsequent requests serve cached version (fast!)
- After 1 week, Next.js revalidates in the background
- Users see cached data until new data is ready
- API is only called once per week, not on every request

**Benefits:**
- ✅ Prevents backend API from being hammered
- ✅ Faster page loads (served from cache)
- ✅ Automatic background revalidation
- ✅ Cost-effective (fewer API calls)

**On Vercel:**
- ISR works seamlessly with Vercel's Edge Network
- Pages are cached globally for optimal performance
- You can manually trigger revalidation via Vercel dashboard or API if needed

## Troubleshooting

### "Cannot use hooks in Server Component"
- Make sure interactive components are Client Components (`"use client"`)
- Only data fetching should happen in Server Components

### "fetch failed" errors
- Check `NEXT_PUBLIC_API_URL` environment variable
- Verify API is accessible from server (not just browser)
- Check CORS settings if needed

### URL params not updating
- Ensure `useSearchParams()` is used in Client Component
- Check that `router.push()` is called correctly
- Verify Suspense boundary is in place (already done in page.tsx)

## Questions?

If you encounter issues or need help with deployment, check:
- [Next.js SSR Documentation](https://nextjs.org/docs/app/building-your-application/rendering/server-components)
- [App Router Data Fetching](https://nextjs.org/docs/app/building-your-application/data-fetching)

