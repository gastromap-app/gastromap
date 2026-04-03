# GastroMap Developer Guide

A practical onboarding and reference guide for developers joining the GastroMap project.

---

## Table of Contents

1. [Getting Started](#1-getting-started)
2. [Project Structure](#2-project-structure)
3. [How to Add Features](#3-how-to-add-features)
4. [State Management Guide](#4-state-management-guide)
5. [Testing](#5-testing)
6. [Deployment](#6-deployment)
7. [Common Tasks](#7-common-tasks)
8. [Troubleshooting](#8-troubleshooting)

---

## 1. Getting Started

### Prerequisites

| Tool | Version | Purpose |
|------|---------|---------|
| **Node.js** | 18+ | JavaScript runtime |
| **npm** | 9+ | Package manager |
| **Git** | 2.x | Version control |
| **Supabase Account** | — | Database & Auth |
| **OpenRouter Account** | — | AI API (free tier available) |

Verify your setup:

```bash
node -v    # v18.0.0 or higher
npm -v     # 9.0.0 or higher
```

### Clone and Install

```bash
git clone https://github.com/alik2191/Gastromap_StandAlone.git
cd Gastromap_StandAlone
npm install
```

### Environment Variables Setup

1. Copy the example file:

```bash
cp .env.example .env
```

2. Fill in your values:

```env
# Supabase (required for full functionality)
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key

# OpenRouter AI (optional — app works without it using mock data)
VITE_OPENROUTER_API_KEY=sk-or-v1-your-key-here
VITE_AI_MODEL=meta-llama/llama-3.3-70b-instruct:free
VITE_AI_MODEL_FALLBACK=qwen/qwen3-coder:free

# App config
VITE_APP_VERSION=2.0.0
```

> **Important:** All environment variables are accessed through `@/shared/config/env`, never via `import.meta.env` directly in components. See [Shared Config](#shared-config) for details.

**Available free models on OpenRouter:**
- `deepseek/deepseek-chat-v3-0324:free` (Recommended)
- `meta-llama/llama-3.3-70b-instruct:free`
- `qwen/qwen3-coder:free`
- `nvidia/nemotron-3-super:free`

### Supabase Project Setup

1. **Create a project** at [app.supabase.com](https://app.supabase.com)
2. **Run migrations** in the Supabase SQL Editor, in order:

```
supabase/migrations/001_locations.sql
supabase/migrations/002_seed_venues.sql
supabase/migrations/003_profiles.sql
supabase/migrations/004_favorites.sql
supabase/migrations/005_visits_and_reviews.sql
supabase/migrations/006_admin_stats_helpers.sql
supabase/migrations/20260328_knowledge_graph.sql
supabase/migrations/20260331_add_admin_user.sql
supabase/migrations/20260331_auto_translation.sql
supabase/migrations/20260331_knowledge_graph_ontology.sql
supabase/migrations/20260331_payments_system.sql
supabase/migrations/20260331_user_preferences_learning.sql
```

Alternatively, run migrations from the command line:

```bash
node scripts/run-migrations.cjs
```

3. **Set up Row-Level Security (RLS):** All migrations include RLS policies. Verify they are enabled in the Supabase dashboard under Authentication > Policies.

4. **Create an admin user:** Run the setup script or manually update a profile's role:

```bash
node scripts/setup-admin.js
```

### Running Locally

```bash
npm run dev
```

The app starts at `http://localhost:5173`.

> **Note:** The app works in **offline/mock mode** if Supabase credentials are not set. Locations, categories, and AI features use local fallback data.

### Building for Production

```bash
npm run build
```

Output goes to `dist/`. Preview the production build:

```bash
npm run preview
```

Other useful commands:

```bash
npm run lint              # Run ESLint
npm run test              # Run tests in watch mode
npm run test:coverage     # Run tests with coverage report
npm run i18n:check        # Check for missing translation keys
npm run i18n:add          # Interactive script to add translation keys
```

---

## 2. Project Structure

GastroMap uses a **Feature-Sliced Design** (FSD-inspired) architecture. The codebase is organized by feature domain rather than by technical layer.

```
Gastromap_StandAlone/
├── src/
│   ├── app/                      # Application bootstrap
│   │   ├── providers/            # App-level providers (QueryClient, etc.)
│   │   ├── router/               # React Router configuration
│   │   │   └── AppRouter.jsx     # Main router with guards
│   │   └── ErrorBoundary.jsx     # Error boundaries per route
│   │
│   ├── features/                 # Feature modules (the core of FSD)
│   │   ├── admin/                # Admin panel feature
│   │   │   ├── components/       # Admin-specific UI components
│   │   │   ├── pages/            # Admin pages (Dashboard, Users, etc.)
│   │   │   ├── layout/           # AdminLayout.jsx
│   │   │   └── __tests__/        # Admin-specific tests
│   │   │
│   │   ├── auth/                 # Authentication feature
│   │   │   ├── components/       # LoginPage, SignUpPage, etc.
│   │   │   ├── hooks/            # useAuthStore (Zustand)
│   │   │   └── pages/            # Auth pages
│   │   │
│   │   ├── dashboard/            # User dashboard feature
│   │   │   ├── components/       # Dashboard widgets
│   │   │   ├── hooks/            # Dashboard-specific hooks
│   │   │   └── pages/            # Dashboard, Profile, Saved, etc.
│   │   │
│   │   ├── public/               # Public-facing feature
│   │   │   ├── components/       # Public UI components
│   │   │   ├── hooks/            # useLocationsStore, etc.
│   │   │   └── pages/            # Landing, LocationDetails, etc.
│   │   │
│   │   └── shared/               # Cross-feature shared components
│   │       ├── components/       # LanguageSelector, etc.
│   │       └── hooks/            # Shared custom hooks
│   │
│   ├── shared/                   # Shared infrastructure (cross-cutting)
│   │   ├── api/                  # API layer
│   │   │   ├── client.js         # Supabase client, ApiError class
│   │   │   ├── locations.api.js  # Location CRUD functions
│   │   │   ├── auth.api.js       # Auth functions
│   │   │   ├── ai.api.js         # AI/OpenRouter integration
│   │   │   ├── queries.js        # All React Query hooks
│   │   │   ├── favorites.api.js  # Favorites CRUD
│   │   │   ├── visits.api.js     # Visits CRUD
│   │   │   ├── reviews.api.js    # Reviews CRUD
│   │   │   ├── admin.api.js      # Admin-specific queries
│   │   │   ├── preferences.api.js# User preferences
│   │   │   ├── leaderboard.api.js# Leaderboard
│   │   │   ├── stripe.api.js     # Stripe integration
│   │   │   ├── translation.api.js# Auto-translation
│   │   │   ├── knowledge-graph.api.js
│   │   │   └── index.js          # Barrel exports
│   │   │
│   │   └── config/               # Configuration
│   │       └── env.js            # Centralized env config
│   │
│   ├── components/               # Reusable layout/UI components
│   │   ├── layout/               # MainLayout, PublicLayout
│   │   ├── guards/               # MaintenanceGuard, etc.
│   │   ├── ui/                   # Button, Card, Badge, Skeleton, etc.
│   │   ├── auth/                 # SubscriptionGate, etc.
│   │   └── pwa/                  # PWA install prompt
│   │
│   ├── store/                    # Zustand stores
│   │   └── useAppConfigStore.js  # App config + AI settings
│   │
│   ├── hooks/                    # Top-level custom hooks
│   ├── i18n/                     # i18n configuration
│   │   └── config.js
│   ├── locales/                  # Translation files
│   │   ├── en/                   # English
│   │   ├── ru/                   # Russian
│   │   ├── pl/                   # Polish
│   │   └── ua/                   # Ukrainian
│   ├── mocks/                    # Mock data for offline dev
│   ├── services/                 # External service integrations
│   ├── utils/                    # Utility functions
│   ├── assets/                   # Static assets
│   └── test/                     # Test setup
│       └── setup.js              # Vitest setup (mocks, globals)
│
├── api/                          # Vercel serverless functions
│   └── ai/                       # AI proxy endpoint
├── supabase/migrations/          # SQL migrations
├── scripts/                      # Utility scripts
├── public/                       # Static public files
└── tests/e2e/                    # End-to-end tests
```

### Naming Conventions

| Type | Convention | Examples |
|------|------------|----------|
| **Components** | PascalCase, descriptive | `LocationDetailsPage.jsx`, `AdminDashboardPage.jsx` |
| **API functions** | camelCase, verb-noun | `getLocations()`, `createLocation()`, `deleteLocation()` |
| **React Query hooks** | `use` + PascalCase noun | `useLocations()`, `useLocation(id)`, `useCreateLocationMutation()` |
| **Zustand stores** | `use` + noun + `Store` | `useAppConfigStore`, `useAuthStore`, `useLocationsStore` |
| **Query keys** | camelCase arrays | `['locations']`, `['locations', 'detail', id]` |
| **API files** | kebab-case + `.api.js` | `locations.api.js`, `ai.api.js` |
| **Test files** | `.test.jsx` or `.test.js` next to source or in `__tests__/` | |
| **Translation keys** | dot-separated, lowercase | `nav.explore`, `location.save`, `common.loading` |

### Path Aliases

The `@` alias maps to `src/`:

```javascript
// Instead of:
import { getLocations } from '../../shared/api/locations.api'

// Use:
import { getLocations } from '@/shared/api/locations.api'
```

---

## 3. How to Add Features

### Adding a New API Endpoint

API functions live in `src/shared/api/`. Each domain has its own file.

**Step 1:** Create or edit the API file.

```javascript
// src/shared/api/events.api.js
import { supabase, ApiError } from './client'

/**
 * Fetch upcoming events.
 * @param {Object} filters
 * @param {number} [filters.limit=20]
 * @returns {Promise<Array>}
 */
export async function getEvents(filters = {}) {
    const { limit = 20 } = filters

    const { data, error } = await supabase
        .from('events')
        .select('*')
        .eq('status', 'active')
        .order('date', { ascending: true })
        .limit(limit)

    if (error) throw new ApiError(error.message, 400, error.code)
    return data
}

/**
 * Create a new event.
 * @param {Object} event
 * @returns {Promise<Object>}
 */
export async function createEvent(event) {
    const { data, error } = await supabase
        .from('events')
        .insert(event)
        .select()
        .single()

    if (error) throw new ApiError(error.message, 400, error.code)
    return data
}
```

**Step 2:** Export from the barrel file (optional, for shared APIs).

```javascript
// src/shared/api/index.js
export * from './events.api'
```

**Step 3:** Add React Query hooks in `queries.js` (see next section).

### Adding a New React Query Hook

All React Query hooks live in `src/shared/api/queries.js`.

**Step 1:** Define the query key in `queryKeys`:

```javascript
export const queryKeys = {
    locations: { /* ... */ },
    categories: ['categories'],
    events: {
        all: ['events'],
        detail: (id) => ['events', 'detail', id],
    },
    // ...
}
```

**Step 2:** Import your API function and create the hook:

```javascript
import { getEvents, createEvent } from './events.api'

// Query hook
export function useEvents(limit = 20) {
    return useQuery({
        queryKey: [...queryKeys.events.all, { limit }],
        queryFn: () => getEvents({ limit }),
        staleTime: 5 * 60_000, // 5 minutes
    })
}

// Single item query
export function useEvent(id) {
    return useQuery({
        queryKey: queryKeys.events.detail(id),
        queryFn: () => getEventById(id),
        enabled: Boolean(id),
    })
}

// Mutation hook
export function useCreateEventMutation() {
    const qc = useQueryClient()
    return useMutation({
        mutationFn: createEvent,
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: queryKeys.events.all })
        },
    })
}
```

**Step 3:** Use in any component:

```javascript
import { useEvents, useCreateEventMutation } from '@/shared/api/queries'

function EventsList() {
    const { data: events, isLoading } = useEvents()
    const createEvent = useCreateEventMutation()

    if (isLoading) return <Skeleton />

    return (
        <div>
            {events?.map(event => (
                <EventCard key={event.id} event={event} />
            ))}
        </div>
    )
}
```

### Adding a New Page

Pages live inside feature modules under `features/<feature>/pages/`.

**Step 1:** Create the page component:

```jsx
// src/features/dashboard/pages/EventsPage.jsx
import { useEvents } from '@/shared/api/queries'
import { Skeleton } from '@/components/ui/Skeleton'
import { useTranslation } from 'react-i18next'

export default function EventsPage() {
    const { t } = useTranslation()
    const { data: events, isLoading } = useEvents()

    if (isLoading) return <Skeleton />

    return (
        <div className="p-6">
            <h1>{t('events.title', 'Events')}</h1>
            {/* Page content */}
        </div>
    )
}
```

**Step 2:** Register the route in `AppRouter.jsx`:

```jsx
// src/app/router/AppRouter.jsx
const EventsPage = lazy(() => import('@/features/dashboard/pages/EventsPage'))

// Inside <Routes>:
<Route path="/events" element={<EventsPage />} />
```

For protected routes, nest inside the appropriate guard:

```jsx
<Route element={<RequireAuth />}>
    <Route path="/events" element={<EventsPage />} />
</Route>
```

### Adding a New Component

Components are placed based on their scope:

| Scope | Location |
|-------|----------|
| Feature-specific | `src/features/<feature>/components/` |
| Shared across features | `src/features/shared/components/` |
| Layout-level | `src/components/layout/` |
| Base UI primitives | `src/components/ui/` |

**Example — feature component:**

```jsx
// src/features/dashboard/components/EventCard.jsx
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

export function EventCard({ event }) {
    return (
        <Card>
            <h3>{event.title}</h3>
            <Badge>{event.category}</Badge>
            <p>{event.description}</p>
        </Card>
    )
}
```

### Adding Translations

**Step 1:** Add English keys to the translation file:

```json
// src/locales/en/translation.json
{
    "events": {
        "title": "Events",
        "no_events": "No events scheduled",
        "upcoming": "Upcoming Events",
        "attend": "Attend Event"
    }
}
```

For modular translations, you can also add a separate file:

```json
// src/locales/en/features/events.json
{
    "events": {
        "title": "Events",
        "no_events": "No events scheduled"
    }
}
```

**Step 2:** Add translations for other languages:

```json
// src/locales/ru/translation.json
{
    "events": {
        "title": "События",
        "no_events": "Событий пока нет",
        "upcoming": "Предстоящие события",
        "attend": "Посетить"
    }
}
```

**Step 3:** Update the i18n config if using a new file:

```javascript
// src/i18n/config.js
import enEvents from '../locales/en/features/events.json'
import ruEvents from '../locales/ru/features/events.json'

const resources = {
    en: { translation: { ...enTranslation, ...enEvents } },
    ru: { translation: { ...ruTranslation, ...ruEvents } },
    // ...
}
```

**Step 4:** Use in components:

```jsx
import { useTranslation } from 'react-i18next'

function EventsPage() {
    const { t } = useTranslation()

    return (
        <div>
            <h1>{t('events.title')}</h1>
            {events?.length === 0 && <p>{t('events.no_events')}</p>}
        </div>
    )
}
```

**Helper scripts:**

```bash
npm run i18n:check   # Check for missing translation keys across languages
npm run i18n:add     # Interactively add new translation keys
```

---

## 4. State Management Guide

GastroMap uses two state management solutions, each with a specific purpose:

### When to Use Zustand vs React Query

| Use Case | Tool | Reason |
|----------|------|--------|
| **Server data** (API responses) | React Query | Built-in caching, refetching, invalidation |
| **UI state** (modals, sidebar open/close) | Zustand | Simple, synchronous, persisted |
| **Auth state** | Zustand | Needs to be available synchronously for route guards |
| **Form state** | Local component state or React Hook Form | Component-scoped |
| **App configuration** | Zustand + persist middleware | Persisted to localStorage |
| **User preferences** | React Query (fetched from DB) | Server data, needs syncing |

**Rule of thumb:** If the data comes from an API or database, use React Query. If it is client-side state that controls UI behavior or app settings, use Zustand.

### Creating a New Zustand Store

```javascript
// src/store/useEventsStore.js
import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export const useEventsStore = create(
    persist(
        (set, get) => ({
            // State
            selectedCategory: null,
            filterDate: null,
            viewMode: 'list', // 'list' | 'calendar'

            // Actions
            setSelectedCategory: (category) => set({ selectedCategory: category }),
            setFilterDate: (date) => set({ filterDate: date }),
            setViewMode: (mode) => set({ viewMode: mode }),

            // Computed (using get())
            hasActiveFilters: () => {
                const { selectedCategory, filterDate } = get()
                return selectedCategory !== null || filterDate !== null
            },

            // Reset
            resetFilters: () => set({ selectedCategory: null, filterDate: null }),
        }),
        {
            name: 'events-filter-storage', // localStorage key
            partialize: (state) => ({
                // Only persist these fields
                selectedCategory: state.selectedCategory,
                viewMode: state.viewMode,
            }),
        }
    )
)
```

**Usage in a component:**

```jsx
import { useEventsStore } from '@/store/useEventsStore'

function EventFilters() {
    const { selectedCategory, setSelectedCategory, resetFilters } = useEventsStore()

    return (
        <div>
            <select
                value={selectedCategory || ''}
                onChange={(e) => setSelectedCategory(e.target.value)}
            >
                <option value="">All</option>
                <option value="music">Music</option>
                <option value="food">Food</option>
            </select>
            <button onClick={resetFilters}>Reset</button>
        </div>
    )
}
```

### Creating New Queries/Mutations

Follow the established patterns in `src/shared/api/queries.js`:

**Query with filters:**

```javascript
export function useEvents(filters = {}) {
    return useQuery({
        queryKey: ['events', 'filtered', filters],
        queryFn: () => getEvents(filters),
        staleTime: 5 * 60_000,
    })
}
```

**Query that depends on another value:**

```javascript
export function useEventAttendees(eventId) {
    return useQuery({
        queryKey: ['event-attendees', eventId],
        queryFn: () => getEventAttendees(eventId),
        enabled: Boolean(eventId), // Only fetch when eventId exists
    })
}
```

**Mutation with cache invalidation:**

```javascript
export function useUpdateEventMutation() {
    const qc = useQueryClient()
    return useMutation({
        mutationFn: ({ id, updates }) => updateEvent(id, updates),
        onSuccess: (_data, { id }) => {
            // Invalidate list and detail
            qc.invalidateQueries({ queryKey: ['events'] })
            qc.invalidateQueries({ queryKey: ['events', 'detail', id] })
        },
    })
}
```

**Mutation with optimistic updates (advanced):**

```javascript
export function useDeleteEventMutation() {
    const qc = useQueryClient()
    return useMutation({
        mutationFn: deleteEvent,
        onMutate: async (eventId) => {
            // Cancel outgoing refetches
            await qc.cancelQueries({ queryKey: ['events'] })

            // Snapshot current cache
            const previous = qc.getQueryData(['events'])

            // Optimistically remove from cache
            qc.setQueryData(['events'], (old) =>
                old?.filter((e) => e.id !== eventId)
            )

            return { previous }
        },
        onError: (_err, _vars, context) => {
            // Roll back on error
            qc.setQueryData(['events'], context.previous)
        },
        onSettled: () => {
            qc.invalidateQueries({ queryKey: ['events'] })
        },
    })
}
```

---

## 5. Testing

### How to Run Tests

```bash
# Watch mode (recommended for development)
npm run test

# Run once and exit
npm run test -- --run

# With coverage
npm run test:coverage

# Run specific test file
npm run test -- src/features/auth/Auth.test.jsx

# Run only changed tests
npm run test -- --related
```

### Test File Conventions

| Pattern | Location | Purpose |
|---------|----------|---------|
| `*.test.jsx` | Next to source or in `__tests__/` | Component and unit tests |
| `*.test.js` | Next to source or in `__tests__/` | Utility and API tests |
| `tests/e2e/*.test.js` | In `tests/e2e/` | Integration/E2E tests |

**Current active tests:**

```
src/features/auth/Auth.test.jsx                    # Login flows
src/features/admin/__tests__/AdminLocationsPage.test.jsx
src/features/admin/__tests__/AdminStatsPage.test.jsx
src/features/public/Public.test.jsx                # Landing page
tests/e2e/auto-translation.test.js
tests/e2e/stripe-payment.test.js
```

### Writing Tests

**Test setup** is configured in `src/test/setup.js`, which provides:
- `@testing-library/jest-dom` matchers
- Mocked `localStorage`
- Mocked `matchMedia`
- Mocked `ResizeObserver` and `IntersectionObserver`
- Mocked `SubscriptionGate` (bypasses payment wall)

**Example component test:**

```jsx
// src/features/dashboard/components/__tests__/EventCard.test.jsx
import { render, screen } from '@testing-library/react'
import { EventCard } from '../EventCard'
import { describe, it, expect } from 'vitest'

describe('EventCard', () => {
    const mockEvent = {
        id: '1',
        title: 'Jazz Night',
        category: 'Music',
        description: 'Live jazz performance',
    }

    it('renders event title and category', () => {
        render(<EventCard event={mockEvent} />)

        expect(screen.getByText('Jazz Night')).toBeInTheDocument()
        expect(screen.getByText('Music')).toBeInTheDocument()
    })

    it('renders description', () => {
        render(<EventCard event={mockEvent} />)
        expect(screen.getByText('Live jazz performance')).toBeInTheDocument()
    })
})
```

**Example test with mocks:**

```jsx
import { render, screen, waitFor } from '@testing-library/react'
import { EventsList } from '../EventsList'
import { describe, it, expect, vi } from 'vitest'

// Mock the API
vi.mock('@/shared/api/queries', () => ({
    useEvents: vi.fn(() => ({
        data: [{ id: '1', title: 'Test Event' }],
        isLoading: false,
    })),
}))

describe('EventsList', () => {
    it('renders events from API', async () => {
        render(<EventsList />)
        await waitFor(() => {
            expect(screen.getByText('Test Event')).toBeInTheDocument()
        })
    })
})
```

---

## 6. Deployment

### Vercel Deployment

GastroMap is configured for one-click deployment to Vercel.

**Step 1:** Push your code to GitHub.

**Step 2:** Connect the repository to Vercel:
1. Go to [vercel.com/new](https://vercel.com/new)
2. Import your GitHub repository
3. Vercel auto-detects the Vite framework

**Step 3:** Add environment variables in Vercel dashboard:

| Variable | Description |
|----------|-------------|
| `VITE_SUPABASE_URL` | Your Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Your Supabase anon/public key |
| `VITE_OPENROUTER_API_KEY` | OpenRouter API key (leave empty for proxy mode) |
| `VITE_AI_MODEL` | Primary AI model |
| `VITE_AI_MODEL_FALLBACK` | Fallback AI model |
| `VITE_APP_VERSION` | App version string |

**Step 4:** Deploy. Vercel automatically runs `npm install`, `npm run build`, and deploys the `dist/` output.

### Environment Variables in Production

**Security note:** In production, do not embed the `VITE_OPENROUTER_API_KEY` in the client bundle. Instead, use the AI proxy endpoint.

The app is configured to:
1. If `VITE_OPENROUTER_API_KEY` is set — use it directly (dev mode)
2. If not set in production — proxy requests through `/api/ai/chat`

Set up the proxy by ensuring `api/ai/chat` serverless function is deployed (Vercel handles this automatically from the `api/` directory).

### Serverless Functions

Vercel serverless functions live in the `api/` directory:

```
api/
└── ai/
    └── chat/
        └── route.js    # POST /api/ai/chat
```

Each file in `api/` becomes a serverless endpoint:
- `api/ai/chat/route.js` → `POST /api/ai/chat`
- `api/ai/translate/route.js` → `POST /api/ai/translate`

**Creating a new endpoint:**

```javascript
// api/my-endpoint/route.js
export const config = {
    runtime: 'edge', // or 'nodejs'
}

export async function POST(request) {
    const body = await request.json()

    // Your logic here
    return Response.json({ success: true, data: body })
}
```

### Vercel Configuration

The `vercel.json` file configures:

```json
{
    "buildCommand": "npm run build",
    "outputDirectory": "dist",
    "framework": "vite",
    "headers": [
        {
            "source": "/assets/(.*)",
            "headers": [
                { "key": "Cache-Control", "value": "public, max-age=31536000, immutable" }
            ]
        }
    ],
    "rewrites": [
        { "source": "/((?!api/).*)", "destination": "/index.html" }
    ]
}
```

The rewrite rule ensures all non-API routes fall back to `index.html` for client-side routing.

---

## 7. Common Tasks

### Adding a New Location Field

**Step 1:** Add the column to the database via migration:

```sql
-- supabase/migrations/007_add_location_website.sql
ALTER TABLE locations ADD COLUMN website TEXT;
```

**Step 2:** Update the normalizer in `locations.api.js`:

```javascript
function normalise(row) {
    return {
        // ... existing fields
        website: row.website ?? '',
    }
}
```

**Step 3:** Update the create/update functions to include the field:

```javascript
export async function createLocation(data) {
    const { data: result, error } = await supabase
        .from('locations')
        .insert({
            // ... existing fields
            website: data.website,
        })
        // ...
}
```

**Step 4:** Use the field in components:

```jsx
{location.website && (
    <a href={location.website} target="_blank" rel="noopener noreferrer">
        Website
    </a>
)}
```

### Adding a New User Preference

**Step 1:** Add the field to the `user_preferences` table (or use the JSONB `preferences` column):

```javascript
// The preferences column is JSONB, so you can add any field:
{
    "cuisines": ["Italian", "Japanese"],
    "dietary": ["vegan"],
    "budget": "$$",
    "newPreference": "value"  // Just add it!
}
```

**Step 2:** Update the preferences API if needed:

```javascript
// src/shared/api/preferences.api.js
export async function updateUserPreferences(userId, preferences) {
    const { data, error } = await supabase
        .from('user_preferences')
        .upsert({
            user_id: userId,
            preferences,
        })
    // ...
}
```

**Step 3:** Use the React Query hook:

```jsx
import { useUserPreferences, useUpdatePreferencesMutation } from '@/shared/api/queries'

function PreferencesForm({ userId }) {
    const { data: prefs } = useUserPreferences(userId)
    const updatePrefs = useUpdatePreferencesMutation()

    const handleSave = () => {
        updatePrefs.mutate({
            userId,
            preferences: { ...prefs?.preferences, newField: value },
        })
    }
}
```

### Adding AI Functionality

**Step 1:** Define the tool/function in `ai.api.js`:

```javascript
const TOOLS = [
    // ... existing tools
    {
        type: 'function',
        function: {
            name: 'search_events',
            description: 'Search for upcoming events by category and date.',
            parameters: {
                type: 'object',
                properties: {
                    category: { type: 'string' },
                    date: { type: 'string', description: 'ISO date string' },
                },
            },
        },
    },
]
```

**Step 2:** Handle the tool call in the tool execution logic:

```javascript
// Inside analyzeQuery() or similar function
if (toolCall.name === 'search_events') {
    const args = JSON.parse(toolCall.arguments)
    const results = await searchEvents(args)
    return { content: JSON.stringify(results) }
}
```

**Step 3:** Create a React Query hook if the AI feature needs its own data fetching:

```javascript
// src/shared/api/queries.js
export function useEventSearchMutation() {
    return useMutation({
        mutationFn: ({ category, date }) => analyzeQuery(`Find events`, { category, date }),
    })
}
```

### Adding i18n Translations

See the [Adding Translations](#adding-translations) section above. Quick reference:

1. Add keys to `src/locales/en/translation.json`
2. Add translations to `src/locales/<lang>/translation.json`
3. Use `t('key')` in components
4. Run `npm run i18n:check` to verify completeness

**Adding a new language:**

```bash
# 1. Create locale directories
mkdir -p src/locales/es/common
mkdir -p src/locales/es/features

# 2. Add translation.json
# 3. Update src/i18n/config.js:
import esTranslation from '../locales/es/translation.json'

const resources = {
    en: { translation: enTranslation },
    ru: { translation: ruTranslation },
    pl: { translation: plTranslation },
    ua: { translation: uaTranslation },
    es: { translation: esTranslation },  // Add this
}

// Update supportedLngs:
supportedLngs: ['en', 'ru', 'pl', 'ua', 'es'],
```

---

## 8. Troubleshooting

### Common Issues and Solutions

#### App shows mock data instead of real data

**Cause:** Supabase environment variables are not set.

**Solution:**
```bash
# Check your .env file
cat .env | grep SUPABASE

# Ensure variables are set:
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key

# Restart the dev server
npm run dev
```

#### "Module not found" errors

**Cause:** Path alias `@/` is not resolving correctly.

**Solution:** The alias is configured in `vite.config.js`:
```javascript
resolve: {
    alias: {
        "@": path.resolve(__dirname, "./src"),
    },
},
```

If your IDE shows errors but the app runs fine, configure your IDE's path aliases. For VS Code, add to `.vscode/settings.json`:

```json
{
    "typescript.preferences.importModuleSpecifier": "non-relative"
}
```

#### Tests fail with "i18n key not found"

**Cause:** Tests expect English text but components render Russian (or vice versa).

**Solution:**
```javascript
// Use regex to match either language
expect(screen.getByText(/Dashboard|Панель управления/i)).toBeInTheDocument()

// Or mock i18n in the test:
vi.mock('react-i18next', () => ({
    useTranslation: () => ({ t: (key) => key }),
}))
```

#### AI features not working

**Cause:** OpenRouter API key is missing or invalid.

**Solution:**
1. Get a free API key at [openrouter.ai/keys](https://openrouter.ai/keys)
2. Set `VITE_OPENROUTER_API_KEY` in your `.env`
3. Verify with `npm run i18n:check` that the key is detected

The app falls back to a local scoring engine when no API key is set, so the UI still works but without AI-powered responses.

#### Chunk size warnings during build

**Cause:** Large bundles from libraries like Leaflet or Framer Motion.

**Solution:** The project already uses `manualChunks` in `vite.config.js` to split bundles:

```javascript
manualChunks: {
    'react-core': ['react', 'react-dom'],
    'framer-motion': ['framer-motion'],
    'leaflet': ['leaflet', 'react-leaflet'],
    'admin': [/* admin files */],
}
```

If you add a large library, add it to `manualChunks`.

#### Supabase RLS errors (permission denied)

**Cause:** Row-Level Security policies are blocking the query.

**Solution:**
1. Check the Supabase dashboard > Authentication > Policies
2. Verify the policy matches your query
3. For development, you can temporarily disable RLS on a table (never in production):

```sql
ALTER TABLE locations DISABLE ROW LEVEL SECURITY;
-- Re-enable after debugging:
ALTER TABLE locations ENABLE ROW LEVEL SECURITY;
```

#### PWA not installing on iOS

**Cause:** iOS requires specific meta tags and user interaction.

**Solution:** The PWA is configured via `vite-plugin-pwa` in `vite.config.js`. Ensure:
- The site is served over HTTPS
- The `manifest.json` is correctly generated
- Users are instructed to use Share > Add to Home Screen on iOS

#### Hot Module Replacement (HMR) not working

**Solution:**
```bash
# Clear Vite cache
rm -rf node_modules/.vite

# Restart
npm run dev
```

#### Translation keys showing as raw strings

**Cause:** Translation file not imported in `i18n/config.js`.

**Solution:**
1. Check that the JSON file is imported in `src/i18n/config.js`
2. Verify the key path matches: `t('events.title')` requires `{"events": {"title": "..."}}`
3. Check the JSON syntax is valid (no trailing commas)

---

## Quick Reference

### Key Imports Cheat Sheet

```javascript
// API functions
import { getLocations, createLocation } from '@/shared/api/locations.api'
import { analyzeQuery } from '@/shared/api/ai.api'
import { supabase, ApiError } from '@/shared/api/client'

// React Query hooks
import {
    useLocations,
    useLocation,
    useCreateLocationMutation,
    useDeleteLocationMutation,
    queryKeys,
} from '@/shared/api/queries'

// Zustand stores
import { useAppConfigStore } from '@/store/useAppConfigStore'
import { useAuthStore } from '@/features/auth/hooks/useAuthStore'

// UI components
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/Skeleton'

// Config
import { config } from '@/shared/config/env'

// i18n
import { useTranslation } from 'react-i18next'
import { changeLanguage } from '@/i18n/config'

// Routing
import { Navigate } from 'react-router-dom'
// Guards are in AppRouter.jsx: RequireAuth, RequireAdmin
```

### File Creation Checklist

When adding a new feature, ensure you have:

- [ ] API functions in `src/shared/api/<feature>.api.js`
- [ ] React Query hooks in `src/shared/api/queries.js`
- [ ] Page component in `src/features/<feature>/pages/`
- [ ] Route registered in `src/app/router/AppRouter.jsx`
- [ ] Translation keys in `src/locales/<lang>/translation.json`
- [ ] Tests in `src/features/<feature>/__tests__/` or alongside source
- [ ] Updated barrel exports in `src/shared/api/index.js` (if shared API)
