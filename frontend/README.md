# Frontend - Parliament Explorer

Next.js frontend application for exploring Japanese parliamentary data.

## Environment Configuration

### Local Development with Mock Data

To use mock data instead of API calls, set the environment variable:

```bash
NEXT_PUBLIC_ENVIRONMENT=local
```

This will make the data service use mock data from `app/data/mockData.ts` instead of making API calls.

### Local Development with API

To use the local API server (running on port 5000), set:

```bash
NEXT_PUBLIC_ENVIRONMENT=development
# or leave it unset and ensure NODE_ENV=development
NEXT_PUBLIC_API_URL=http://localhost:5000
```

### Production

In production, the app will automatically use the production API URL. You can override it with:

```bash
NEXT_PUBLIC_API_URL=https://your-api-url.com
```

## Data Fetching

The app uses a data service layer (`app/lib/services/dataService.ts`) that automatically switches between:

- **Mock data** when `NEXT_PUBLIC_ENVIRONMENT=local`
- **API calls** in all other cases

### Using the Data Service

```typescript
import { fetchPoliticians, fetchTopics } from "@/app/lib/services/dataService";

// Fetch data directly
const politicians = await fetchPoliticians();
const topics = await fetchTopics();
```

### Using React Hooks

```typescript
import { usePoliticians, useTopics } from "@/app/lib/hooks/useParliamentData";

function MyComponent() {
  const { data: politicians, loading, error, refetch } = usePoliticians();
  const { data: topics } = useTopics();

  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error: {error.message}</div>;

  return <div>{/* Use data */}</div>;
}
```

## Development

```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Build for production
npm run build

# Start production server
npm start
```

## Project Structure

```
app/
├── components/        # React components
│   ├── features/     # Feature-specific components
│   ├── layout/       # Layout components
│   ├── shared/       # Reusable components
│   └── visualizations/ # D3 visualization components
├── data/             # Mock data
├── lib/
│   ├── config/       # Configuration (API URLs, etc.)
│   ├── hooks/        # React hooks for data fetching
│   └── services/     # Data fetching services
├── types/            # TypeScript type definitions
└── page.tsx          # Main page
```
