# GastroMap V2 -- Architecture Document

> AI-powered restaurant discovery Progressive Web App (PWA)

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Tech Stack](#2-tech-stack)
3. [Architecture Pattern](#3-architecture-pattern)
4. [Directory Structure](#4-directory-structure)
5. [Data Flow](#5-data-flow)
6. [State Management](#6-state-management)
7. [Authentication Flow](#7-authentication-flow)
8. [AI System](#8-ai-system)
9. [Routing](#9-routing)
10. [Internationalization](#10-internationalization)
11. [Deployment](#11-deployment)

---

## 1. Project Overview

**GastroMap V2** is an AI-powered restaurant discovery Progressive Web Application (PWA) that helps users find the best dining experiences through intelligent recommendations, interactive maps, and a conversational AI assistant (GastroGuide).

### Core Features

- **AI-Powered Discovery** -- Conversational AI assistant (GastroGuide) that understands natural language queries and recommends restaurants using function-calling with Supabase location data
- **Interactive Map** -- Leaflet-based map with CARTO basemaps (light/dark themes) for exploring restaurants geographically
- **Smart Filtering** -- Category, price level, rating, vibe, cuisine, dietary restrictions, and keyword search
- **User Profiles** -- Authentication, favorites, visit history, reviews, leaderboards, and personalized preferences
- **Multi-language** -- Full i18n support for English, Polish, Russian, and Ukrainian
- **Admin Dashboard** -- Full CRUD for locations, user management, moderation, AI configuration, and analytics
- **PWA** -- Installable, offline-capable, with auto-update service worker
- **Auto-Translation** -- AI-powered translation of location content to all supported languages on create/update

### Key Design Decisions

- **Mock-first development** -- All API layers fall back to in-memory mocks when Supabase/AI keys are not configured, enabling full offline development
- **Client-side AI tool execution** -- The AI model calls tools (`search_locations`, `get_location_details`) which are executed locally against the Zustand store, avoiding extra network requests
- **Cascading model rotation** -- 8 free OpenRouter models are tried in sequence when rate-limited, ensuring high availability at zero cost

---

## 2. Tech Stack

### Frontend Framework

| Technology | Version | Purpose |
|---|---|---|
| React | 18.3.1 | UI component library |
| Vite | 7.2.4 | Build tool and dev server |
| React Router DOM | 6.28.0 | Client-side routing |

### State & Data Management

| Technology | Version | Purpose |
|---|---|---|
| Zustand | 5.0.10 | Client-side state management (auth, filters, favorites, config) |
| TanStack React Query | 5.90.19 | Server state management, caching, mutations |
| TanStack Virtual | 3.13.23 | Virtualized lists for performance |

### Backend & Services

| Technology | Version | Purpose |
|---|---|---|
| Supabase JS SDK | 2.100.1 | Database, authentication, real-time |
| OpenRouter API | -- | AI/LLM access (8 free models with tool-use) |
| Vercel Serverless | -- | AI chat proxy function (`/api/ai/chat`) |

### UI & Styling

| Technology | Version | Purpose |
|---|---|---|
| Tailwind CSS | 3.4.17 | Utility-first CSS framework |
| DaisyUI | 5.5.14 | Component library for Tailwind |
| Framer Motion | 12.28.1 | Animations and page transitions |
| Lucide React | 0.562.0 | Icon library |
| Lenis | 1.3.17 | Smooth scrolling |
| OGL | 1.0.11 | WebGL aurora background effects |

### Mapping

| Technology | Version | Purpose |
|---|---|---|
| Leaflet | 1.9.4 | Interactive map rendering |
| React Leaflet | 4.2.1 | React bindings for Leaflet |
| CARTO Basemaps | -- | Light and dark map tiles |

### Internationalization

| Technology | Version | Purpose |
|---|---|---|
| i18next | 25.8.13 | i18n framework |
| react-i18next | 16.5.4 | React bindings |
| i18next-browser-languagedetector | 8.2.1 | Automatic language detection |

### Testing

| Technology | Version | Purpose |
|---|---|---|
| Vitest | 4.0.17 | Unit/integration test runner |
| Testing Library | 16.3.2 | Component testing utilities |
| jsdom | 27.4.0 | DOM simulation for tests |

### Build & Quality

| Technology | Version | Purpose |
|---|---|---|
| ESLint | 9.39.1 | Linting |
| Vite Plugin PWA | 1.2.0 | Service worker and manifest generation |
| PostCSS | 8.5.6 | CSS processing |
| Autoprefixer | 10.4.23 | Vendor prefix handling |

---

## 3. Architecture Pattern

GastroMap follows a **Feature-Sliced Design (FSD)** inspired architecture, organizing code by business capabilities rather than technical layers.

### Layers

```
src/
  app/           -- Application initialization (entry point, providers, router)
  features/      -- Business feature modules (auth, admin, dashboard, public, shared)
  shared/        -- Cross-cutting concerns (API, config, utilities)
  components/    -- Reusable UI components (layout, UI primitives, guards, PWA)
  hooks/         -- Shared custom React hooks
  services/      -- External service integrations (Overpass, Nominatim)
  store/         -- Global Zustand stores
  i18n/          -- Internationalization configuration
  locales/       -- Translation JSON files
  mocks/         -- Development mock data
  utils/         -- Utility functions
```

### Principles

1. **Feature isolation** -- Each feature (`auth`, `admin`, `dashboard`, `public`) owns its pages, components, hooks, and stores
2. **Shared API layer** -- All data access goes through `src/shared/api/` modules, never directly from components
3. **React Query for server state** -- All Supabase data fetching is wrapped in React Query hooks (`src/shared/api/queries.js`)
4. **Zustand for client state** -- UI state, filters, auth session, and app config use Zustand stores
5. **Lazy loading** -- All pages except the landing page are lazy-loaded with `React.lazy()` for optimal initial bundle size
6. **Error boundaries** -- Route-level and feature-level error boundaries prevent cascading failures

---

## 4. Directory Structure

```
Gastromap_StandAlone/
├── api/                              # Vercel serverless functions
│   └── ai/chat.js                    # AI chat proxy (OpenRouter cascade)
│
├── public/                           # Static assets (favicon, PWA icons)
│
├── src/
│   ├── main.jsx                      # Application entry point
│   ├── index.css                     # Global styles (Tailwind, custom)
│   │
│   ├── app/                          # Application shell
│   │   ├── App.jsx                   # Root component: providers, PWA, onboarding
│   │   ├── ErrorBoundary.jsx         # Error boundaries with custom fallbacks
│   │   ├── providers/
│   │   │   └── AppProviders.jsx      # BrowserRouter, QueryClient, SmoothScroll
│   │   └── router/
│   │       └── AppRouter.jsx         # Route definitions, guards, lazy imports
│   │
│   ├── features/                     # Feature modules
│   │   ├── auth/                     # Authentication feature
│   │   │   ├── components/
│   │   │   │   ├── OnboardingFlow.jsx
│   │   │   │   └── OnboardingGate.jsx
│   │   │   ├── hooks/
│   │   │   │   ├── useAuthStore.js       # Auth state (Zustand + persist)
│   │   │   │   └── useUserPrefsStore.js  # User preferences
│   │   │   ├── pages/
│   │   │   │   ├── LoginPage.jsx
│   │   │   │   └── SignUpPage.jsx
│   │   │   └── Auth.test.jsx
│   │   │
│   │   ├── admin/                    # Admin dashboard feature
│   │   │   ├── layout/
│   │   │   │   └── AdminLayout.jsx
│   │   │   ├── components/
│   │   │   │   ├── ImportWizard.jsx
│   │   │   │   └── LocationHierarchyExplorer.jsx
│   │   │   ├── pages/
│   │   │   │   ├── AdminPage.jsx
│   │   │   │   ├── AdminDashboardPage.jsx
│   │   │   │   ├── AdminLocationsPage.jsx
│   │   │   │   ├── AdminUsersPage.jsx
│   │   │   │   ├── AdminModerationPage.jsx
│   │   │   │   ├── AdminSubscriptionsPage.jsx
│   │   │   │   ├── AdminAIPage.jsx         # AI model/key config
│   │   │   │   ├── AdminStatsPage.jsx
│   │   │   │   └── AdminSettingsPage.jsx
│   │   │   └── __tests__/
│   │   │
│   │   ├── dashboard/                # User dashboard feature
│   │   │   ├── components/
│   │   │   │   ├── FilterModal.jsx
│   │   │   │   └── MapTab.jsx
│   │   │   ├── hooks/
│   │   │   │   ├── useFavoritesStore.js
│   │   │   │   └── useReviewsStore.js
│   │   │   └── pages/
│   │   │       ├── DashboardPage.jsx
│   │   │       ├── ExploreWrapper.jsx
│   │   │       ├── MapPage.jsx
│   │   │       ├── CitiesPage.jsx
│   │   │       ├── SavedPage.jsx
│   │   │       ├── VisitedPage.jsx
│   │   │       ├── LeaderboardPage.jsx
│   │   │       ├── ProfilePage.jsx
│   │   │       ├── ProfileEditPage.jsx
│   │   │       ├── AddPlacePage.jsx
│   │   │       ├── AIGuidePage.jsx
│   │   │       ├── LanguageSettingsPage.jsx
│   │   │       ├── SecurityPrivacyPage.jsx
│   │   │       ├── DeleteDataPage.jsx
│   │   │       ├── HelpCenterPage.jsx
│   │   │       ├── TermsPage.jsx
│   │   │       ├── PrivacyPage.jsx
│   │   │       └── CookiePolicyPage.jsx
│   │   │
│   │   ├── public/                   # Public-facing pages (no auth required)
│   │   │   ├── components/
│   │   │   │   ├── GastroGuideChat.jsx
│   │   │   │   └── LocationCard.jsx
│   │   │   ├── hooks/
│   │   │   │   └── useLocationsStore.js  # Locations + filter state
│   │   │   └── pages/
│   │   │       ├── LandingPage.jsx         # CRITICAL: not lazy-loaded
│   │   │       ├── PublicPage.jsx
│   │   │       ├── FeaturesPage.jsx
│   │   │       ├── PricingPage.jsx
│   │   │       ├── AboutPage.jsx
│   │   │       ├── ContactPage.jsx
│   │   │       └── LocationDetailsPage.jsx
│   │   │
│   │   └── shared/                   # Cross-feature shared components
│   │       ├── components/
│   │       │   ├── LanguageSelector.jsx
│   │       │   ├── PaymentStub.jsx
│   │       │   └── GastroAIChat.jsx
│   │       └── hooks/
│   │           └── useAIChatStore.js
│   │
│   ├── shared/                       # Cross-cutting shared code
│   │   ├── api/
│   │   │   ├── client.js             # Supabase client, ApiError class
│   │   │   ├── index.js              # Barrel export
│   │   │   ├── locations.api.js      # Locations CRUD + auto-translation
│   │   │   ├── auth.api.js           # Auth operations + mock fallback
│   │   │   ├── ai.api.js             # AI/GastroIntelligence with tool calling
│   │   │   ├── admin.api.js          # Admin-specific queries
│   │   │   ├── favorites.api.js      # User favorites
│   │   │   ├── visits.api.js         # Visit history
│   │   │   ├── reviews.api.js        # Reviews CRUD
│   │   │   ├── leaderboard.api.js    # Leaderboard queries
│   │   │   ├── preferences.api.js    # User preferences
│   │   │   ├── stripe.api.js         # Stripe payment integration
│   │   │   ├── translation.api.js    # AI-powered auto-translation
│   │   │   ├── knowledge-graph.api.js # Knowledge graph service
│   │   │   └── queries.js            # React Query hooks (all data fetching)
│   │   └── config/
│   │       ├── env.js                # Centralized env var access
│   │       └── queryClient.js        # TanStack Query configuration
│   │
│   ├── components/                   # Reusable UI components
│   │   ├── ui/                       # Primitive UI components
│   │   │   ├── button.jsx
│   │   │   ├── card.jsx
│   │   │   ├── input.jsx
│   │   │   ├── badge.jsx
│   │   │   ├── Skeleton.jsx
│   │   │   ├── LazyImage.jsx
│   │   │   ├── PageTransition.jsx
│   │   │   ├── smooth-scroll.jsx
│   │   │   ├── glass-card.jsx
│   │   │   ├── glass-button.jsx
│   │   │   ├── aurora-background.jsx
│   │   │   └── aurora-webgl.jsx
│   │   ├── layout/                   # Layout components
│   │   │   ├── MainLayout.jsx        # Authenticated app layout
│   │   │   ├── PublicLayout.jsx      # Public site layout
│   │   │   ├── UniversalHeader.jsx
│   │   │   ├── BottomNav.jsx         # Mobile bottom navigation
│   │   │   ├── MobileHeader.jsx
│   │   │   ├── AnimatedInputBar.jsx
│   │   │   └── public/
│   │   │       ├── PublicNavbar.jsx
│   │   │       ├── PublicFooter.jsx
│   │   │       └── PageHeader.jsx
│   │   ├── guards/
│   │   │   └── MaintenanceGuard.jsx  # Maintenance mode gate
│   │   ├── auth/
│   │   │   └── SubscriptionGate.jsx  # Subscription check wrapper
│   │   ├── pwa/
│   │   │   ├── ReloadPrompt.jsx      # PWA update notification
│   │   │   ├── InstallPrompt.jsx     # PWA install prompt
│   │   │   └── OfflineIndicator.jsx  # Offline status indicator
│   │   └── ThemeToggle.jsx
│   │
│   ├── hooks/                        # Shared custom hooks
│   │   ├── useAIChat.js              # AI chat interaction hook
│   │   ├── useCitiesQuery.js         # Cities data query
│   │   ├── useDebounce.js            # Debounce utility
│   │   ├── useFavorites.js           # Favorites interaction
│   │   ├── useGeolocation.js         # Browser geolocation
│   │   ├── useI18n.js                # i18n convenience
│   │   ├── useLocationFilter.js      # Location filtering
│   │   ├── useLocationsQuery.js      # Location data query
│   │   ├── useOfflineSync.js         # Offline data synchronization
│   │   ├── useOpenStatus.js          # Restaurant open/closed status
│   │   ├── usePWA.js                 # PWA installation state
│   │   └── useTheme.js               # Theme management
│   │
│   ├── services/                     # External service integrations
│   │   ├── gastroIntelligence.js     # Local AI scoring engine (offline fallback)
│   │   ├── overpassApi.js            # OpenStreetMap Overpass API
│   │   └── nominatimApi.js           # Geocoding service
│   │
│   ├── store/                        # Global Zustand stores
│   │   └── useAppConfigStore.js      # App-wide configuration (status, AI config)
│   │
│   ├── i18n/
│   │   └── config.js                 # i18next initialization
│   │
│   ├── locales/                      # Translation files
│   │   ├── en/                       # English
│   │   │   ├── translation.json
│   │   │   ├── common/
│   │   │   └── features/
│   │   ├── pl/                       # Polish
│   │   ├── ru/                       # Russian
│   │   │   ├── translation.json
│   │   │   ├── common/
│   │   │   └── admin/
│   │   └── ua/                       # Ukrainian
│   │
│   ├── mocks/                        # Development mock data
│   │   ├── locations.js              # Mock restaurant locations
│   │   └── userPersona.js            # Mock user data
│   │
│   ├── utils/                        # Utility functions
│   │   ├── ThemeController.js
│   │   └── translation.js
│   │
│   ├── lib/
│   │   └── utils.js                  # cn() utility (tailwind-merge + clsx)
│   │
│   └── test/
│       ├── setup.js                  # Vitest test setup
│       └── helpers.jsx               # Test rendering helpers
│
├── vercel.json                       # Vercel deployment configuration
├── vite.config.js                    # Vite build configuration + PWA + code splitting
├── package.json
└── ...
```

---

## 5. Data Flow

### How Data Flows: Supabase to Components

```
┌─────────────────────────────────────────────────────────────────┐
│                        DATA FLOW ARCHITECTURE                    │
│                                                                 │
│   Supabase DB                                                   │
│       │                                                         │
│       ▼                                                         │
│   ┌──────────────────────┐                                      │
│   │  API Layer           │   locations.api.js                   │
│   │  (src/shared/api/)   │   auth.api.js                        │
│   │                      │   favorites.api.js                   │
│   │                      │   reviews.api.js                     │
│   │                      │   ...                                │
│   │   Fallback: Mocks ───┼── when Supabase not configured       │
│   └──────────┬───────────┘                                      │
│              │                                                  │
│              ▼                                                  │
│   ┌──────────────────────┐                                      │
│   │  React Query Hooks   │   queries.js                         │
│   │  (Server State)      │                                      │
│   │                      │   useLocations(filters)              │
│   │                      │   useLocation(id)                    │
│   │                      │   useCreateLocationMutation()        │
│   │                      │   useUserFavorites(userId)           │
│   │                      │   ...                                │
│   └──────────┬───────────┘                                      │
│              │                                                  │
│              ▼                                                  │
│   ┌──────────────────────┐                                      │
│   │  Components          │   Pages, UI components               │
│   │  (src/features/)     │                                      │
│   │                      │   const { data } = useLocations()    │
│   │                      │   const { data } = useLocation(id)   │
│   └──────────────────────┘                                      │
│                                                                 │
│   Parallel Client State:                                        │
│   ┌──────────────────────┐                                      │
│   │  Zustand Stores      │   useLocationsStore (filter state)   │
│   │  (Client State)      │   useAuthStore (session)             │
│   │                      │   useFavoritesStore (UI state)       │
│   │                      │   useAppConfigStore (app config)     │
│   └──────────────────────┘                                      │
└─────────────────────────────────────────────────────────────────┘
```

### Query Key Structure

All React Query keys are centralized in `src/shared/api/queries.js`:

```javascript
export const queryKeys = {
    locations: {
        all: ['locations'],
        filtered: (filters) => ['locations', 'filtered', filters],
        detail: (id) => ['locations', 'detail', id],
        nearby: (coords) => ['locations', 'nearby', coords],
    },
    categories: ['categories'],
    ai: {
        query: (message) => ['ai', 'query', message],
    },
}
```

### React Query Configuration

Configured for mobile-first PWA usage (`src/shared/config/queryClient.js`):

```javascript
export const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            refetchOnWindowFocus: false,   // Prevents janky mobile UX
            retry: 1,                       // Single retry on failure
            staleTime: 5 * 60 * 1000,      // 5 minutes before refetch
            gcTime: 10 * 60 * 1000,        // 10 minutes cache retention
        },
        mutations: {
            retry: 0,                       // No retries on mutations
        },
    },
})
```

### Example: Loading Locations

```javascript
// Component uses the React Query hook
const { data, isLoading } = useLocations({ category: 'Restaurant', city: 'Krakow' })

// Under the hood:
// 1. React Query checks cache with key ['locations', 'filtered', { category, city }]
// 2. If stale/missing, calls getLocations() from locations.api.js
// 3. locations.api.js queries Supabase:
//    supabase.from('locations').select('*').eq('status', 'active').eq('city', 'Krakow')
// 4. If Supabase fails, falls back to MOCK_LOCATIONS
// 5. Results are normalized and cached by React Query
```

---

## 6. State Management

GastroMap uses a **dual-state strategy**: Zustand for client/UI state, TanStack React Query for server state.

### Zustand Stores (Client State)

| Store | File | Purpose | Persistence |
|---|---|---|---|
| `useAuthStore` | `features/auth/hooks/useAuthStore.js` | User session, authentication state | `localStorage` (`auth-storage`) |
| `useLocationsStore` | `features/public/hooks/useLocationsStore.js` | Location filter state (category, search, price, vibe, sort) | In-memory only |
| `useFavoritesStore` | `features/dashboard/hooks/useFavoritesStore.js` | Saved/favorited locations | In-memory (backed by Supabase) |
| `useReviewsStore` | `features/dashboard/hooks/useReviewsStore.js` | Review draft state | In-memory |
| `useAIChatStore` | `features/shared/hooks/useAIChatStore.js` | AI chat conversation history | In-memory |
| `useUserPrefsStore` | `features/auth/hooks/useUserPrefsStore.js` | User dietary/preferences | In-memory |
| `useAppConfigStore` | `store/useAppConfigStore.js` | App status, AI model config, maintenance messages | `localStorage` (`app-config-storage`) |

### When to Use Which

```
Server State (React Query):
  - Location data from Supabase
  - User favorites/visits/reviews
  - Admin stats and user lists
  - Leaderboard data
  - AI query responses

Client State (Zustand):
  - Authentication session
  - UI filter selections
  - Chat conversation history
  - App configuration
  - Theme preferences
  - Form draft state
```

### Auth Store Detail

The auth store uses Zustand's `persist` middleware to survive page refreshes:

```javascript
export const useAuthStore = create(
    persist(
        (set, get) => ({
            user: null,
            token: null,
            isAuthenticated: false,
            isLoading: false,
            error: null,

            initAuth: () => {
                set({ isLoading: true })
                const unsubscribe = subscribeToAuthChanges(
                    ({ user, token }) => set({ user, token, isAuthenticated: true, isLoading: false }),
                    () => set({ user: null, token: null, isAuthenticated: false, isLoading: false })
                )
                // 5-second safety timeout
                setTimeout(() => { if (get().isLoading) set({ isLoading: false }) }, 5000)
            },

            login: async (email, password) => { /* ... */ },
            register: async (email, password, name) => { /* ... */ },
            logout: async () => { /* ... */ },
        }),
        {
            name: 'auth-storage',
            partialize: (state) => ({
                user: state.user,
                token: state.token,
                isAuthenticated: state.isAuthenticated,
            }),
        }
    )
)
```

---

## 7. Authentication Flow

### Complete Auth Lifecycle

```
┌──────────────────────────────────────────────────────────────────┐
│                     AUTHENTICATION FLOW                          │
│                                                                  │
│  1. APP MOUNT (App.jsx)                                         │
│     └── initAuth() called                                       │
│         ├── subscribeToAuthChanges() sets up Supabase listener   │
│         ├── onAuthStateChange fires with current session        │
│         ├── If session exists: fetch profile, set user in store │
│         └── 5s safety timeout prevents infinite loading         │
│                                                                  │
│  2. LOGIN / SIGNUP                                              │
│     └── User submits credentials                                │
│         ├── auth.api.js: supabase.auth.signInWithPassword()     │
│         ├── Fetch profile from 'profiles' table                 │
│         ├── Map auth user + profile to app user shape           │
│         └── Set in useAuthStore (persisted to localStorage)     │
│                                                                  │
│  3. ROUTE PROTECTION (AppRouter.jsx)                            │
│     ├── RequireAuth: checks isAuthenticated                     │
│     │   └── If false, redirects to /login                       │
│     ├── RequireAdmin: checks user.role === 'admin'              │
│     │   └── If not admin, redirects to /dashboard               │
│     └── AuthRedirect: if authenticated on public page           │
│         └── Redirects to /dashboard or /admin                   │
│                                                                  │
│  4. SESSION MANAGEMENT                                          │
│     └── Supabase onAuthStateChange listener                     │
│         ├── SIGNED_IN  -> update store                          │
│         ├── SIGNED_OUT -> clear store                           │
│         ├── TOKEN_REFRESHED -> update token                     │
│         └── Tab sync across browser windows                     │
│                                                                  │
│  5. ROLE RESOLUTION                                             │
│     └── Priority order:                                         │
│         1. profiles.role (from DB)                              │
│         2. ADMIN_EMAILS list fallback                           │
│         3. Default: 'user'                                      │
└──────────────────────────────────────────────────────────────────┘
```

### Protected Route Implementation

```javascript
// src/app/router/AppRouter.jsx

const RequireAuth = () => {
    const { isAuthenticated, isLoading } = useAuthStore()
    if (isLoading) return <AuthLoader />
    if (!isAuthenticated) return <Navigate to="/login" replace />
    return <Outlet />
}

const RequireAdmin = () => {
    const { user, isAuthenticated, isLoading } = useAuthStore()
    if (isLoading) return <AuthLoader />
    if (!isAuthenticated) return <Navigate to="/login" replace />
    if (user?.role !== 'admin') return <Navigate to="/dashboard" replace />
    return <Outlet />
}
```

### Email-Based Admin Detection

```javascript
const ADMIN_EMAILS = ['admin@gastromap.com', 'alik2191@gmail.com']

function _mapUser(authUser, profile) {
    return {
        id: authUser.id,
        name: profile?.name || authUser.user_metadata?.name || authUser.email.split('@')[0],
        email: authUser.email,
        role: profile?.role || (ADMIN_EMAILS.includes(authUser.email) ? 'admin' : 'user'),
        avatar: profile?.avatar_url || null,
        createdAt: authUser.created_at,
    }
}
```

---

## 8. AI System

### GastroGuide AI Architecture

The AI system uses an **agentic pattern** with function calling (tool use). The LLM decides which tools to call, tools are executed locally, and the model generates a response based on the results.

```
┌──────────────────────────────────────────────────────────────────┐
│                        AI SYSTEM ARCHITECTURE                     │
│                                                                  │
│  User types: "Find me a romantic Italian restaurant in Krakow"   │
│       │                                                          │
│       ▼                                                          │
│  ┌────────────────────────────────────┐                          │
│  │ 1. Intent Detection                │                          │
│  │    detectIntent()                  │                          │
│  │    → 'recommendation'              │                          │
│  └──────────────┬─────────────────────┘                          │
│                 │                                                │
│                 ▼                                                │
│  ┌────────────────────────────────────┐                          │
│  │ 2. Build Messages                  │                          │
│  │    System prompt + user prefs      │                          │
│  │    + conversation history (last 8) │                          │
│  │    + user message                  │                          │
│  └──────────────┬─────────────────────┘                          │
│                 │                                                │
│                 ▼                                                │
│  ┌────────────────────────────────────┐                          │
│  │ 3. OpenRouter API Call             │                          │
│  │    With tool definitions:           │                          │
│  │    - search_locations              │                          │
│  │    - get_location_details          │                          │
│  │                                    │                          │
│  │    MODEL CASCADE (8 models):       │                          │
│  │    1. llama-3.3-70b-instruct:free  │                          │
│  │    2. qwen3-coder:free             │                          │
│  │    3. glm-4.5-air:free             │                          │
│  │    4. minimax-m2.5:free            │                          │
│  │    5. gemma-3-27b-it:free          │                          │
│  │    6. gemma-3-12b-it:free          │                          │
│  │    7. gpt-oss-20b:free             │                          │
│  │    8. nemotron-nano-9b-v2:free     │                          │
│  └──────────────┬─────────────────────┘                          │
│                 │                                                │
│                 ▼                                                │
│  ┌────────────────────────────────────┐                          │
│  │ 4. Tool Call Response              │                          │
│  │    Model returns:                   │                          │
│  │    { tool_calls: [                  │                          │
│  │      { name: 'search_locations',    │                          │
│  │        args: {                      │                          │
│  │          city: 'Krakow',            │                          │
│  │          cuisine: ['Italian'],      │                          │
│  │          vibe: ['Romantic'],        │                          │
│  │          limit: 5                   │                          │
│  │        }                            │                          │
│  │      }                              │                          │
│  │    ]}                               │                          │
│  └──────────────┬─────────────────────┘                          │
│                 │                                                │
│                 ▼                                                │
│  ┌────────────────────────────────────┐                          │
│  │ 5. Local Tool Execution            │                          │
│  │    executeTool() runs against      │                          │
│  │    Zustand locations store         │                          │
│  │    (NO extra network request!)     │                          │
│  │    → Returns filtered location     │                          │
│  │      objects with full details     │                          │
│  └──────────────┬─────────────────────┘                          │
│                 │                                                │
│                 ▼                                                │
│  ┌────────────────────────────────────┐                          │
│  │ 6. Second OpenRouter Call          │                          │
│  │    Messages + tool results         │                          │
│  │    Model generates natural text    │                          │
│  │    response with recommendations   │                          │
│  └──────────────┬─────────────────────┘                          │
│                 │                                                │
│                 ▼                                                │
│  ┌────────────────────────────────────┐                          │
│  │ 7. Response to User                │                          │
│  │    {                               │                          │
│  │      content: "I found 3 amazing   │                          │
│  │        Italian spots in Krakow...",│                          │
│  │      matches: [loc1, loc2, loc3],  │                          │
│  │      intent: 'recommendation'      │                          │
│  │    }                               │                          │
│  └────────────────────────────────────┘                          │
└──────────────────────────────────────────────────────────────────┘
```

### Two Operating Modes

#### Mode 1: Direct OpenRouter (Development)

When `VITE_OPENROUTER_API_KEY` is set, the client calls OpenRouter directly. The 8-model cascade runs client-side.

#### Mode 2: Vercel Serverless Proxy (Production)

In production, the API key is absent from the client bundle. Requests are proxied through `/api/ai/chat` where the server-side `OPENROUTER_API_KEY` environment variable is used.

```javascript
// src/shared/config/env.js
ai: {
    get useProxy() {
        return !this.openRouterKey && import.meta.env.PROD
    }
}

// When useProxy is true:
const url = useProxy ? config.ai.proxyUrl : OPENROUTER_URL
// proxyUrl = '/api/ai/chat'
```

### Vercel Serverless Function

```javascript
// api/ai/chat.js
export default async function handler(req, res) {
    const apiKey = process.env.OPENROUTER_API_KEY
    const MODEL_CASCADE = [
        'meta-llama/llama-3.3-70b-instruct:free',
        'qwen/qwen3-coder:free',
        'z-ai/glm-4.5-air:free',
        'minimax/minimax-m2.5:free',
        'google/gemma-3-27b-it:free',
        'google/gemma-3-12b-it:free',
        'openai/gpt-oss-20b:free',
        'nvidia/nemotron-nano-9b-v2:free',
    ]
    // Cascade: try each model, retry on 429/5xx/400/404
    for (let i = startIdx; i < MODEL_CASCADE.length; i++) {
        const response = await fetch(OPENROUTER_URL, { /* ... */ })
        if (response.ok) return res.status(200).json({ ...data, _model_used: currentModel })
    }
}
```

### Runtime AI Configuration

Admins can override AI settings at runtime without redeploying via `useAppConfigStore`:

```javascript
// Admin changes model in AdminAIPage
useAppConfigStore.getState().updateSettings({
    aiPrimaryModel: 'qwen/qwen3-coder:free',
    aiApiKey: 'sk-or-v1-...',
})

// ai.api.js reads this at request time:
function getActiveAIConfig() {
    const appCfg = useAppConfigStore.getState()
    return {
        apiKey:        appCfg.aiApiKey        || config.ai.openRouterKey,
        model:         appCfg.aiPrimaryModel  || config.ai.model,
        fallbackModel: appCfg.aiFallbackModel || config.ai.modelFallback,
    }
}
```

### System Prompt

The AI receives a compact system prompt with user preferences:

```
You are GastroGuide — a warm, knowledgeable dining assistant for GastroMap.

CORE RULES:
- NEVER invent or guess restaurant names. ALWAYS use the search_locations tool.
- When the user asks for recommendations, call search_locations with appropriate filters.
- Use the insider_tip and what_to_try fields to make responses personal.
- Respond in the same language the user writes in.
- Be concise and friendly. Max 3-4 sentences.

USER PREFERENCES:
Favourite cuisines: Italian, Japanese
Preferred vibes: Romantic
Budget: $$
```

### Local Fallback Engine

When no AI key is configured, `gastroIntelligence.js` provides a local scoring engine that filters and ranks locations based on keyword matching -- full offline functionality at zero cost.

---

## 9. Routing

### Route Structure

```
AppRouter (BrowserRouter)
├── Standalone (no layout)
│   ├── /login                      → LoginPage
│   └── /auth/signup                → SignUpPage
│
├── PublicLayout
│   ├── /                           → LandingPage (NOT lazy-loaded)
│   ├── /features                   → FeaturesPage (lazy)
│   ├── /pricing                    → PricingPage (lazy)
│   ├── /about                      → AboutPage (lazy)
│   ├── /contact                    → ContactPage (lazy)
│   ├── /api, /showcase, /careers   → PublicPage (generic)
│   ├── /blog, /status, /community  → PublicPage (generic)
│   ├── /privacy                    → PrivacyPage
│   ├── /terms                      → TermsPage
│   ├── /security                   → SecurityPrivacyPage
│   ├── /cookies                    → CookiePolicyPage
│   └── /help                       → HelpCenterPage
│
├── MainLayout (+ MaintenanceGuard)
│   ├── /explore                    → ExploreWrapper (public, no auth)
│   ├── /explore/:country           → ExploreWrapper
│   ├── /explore/:country/:city     → ExploreWrapper
│   ├── /location/:id               → LocationDetailsPage
│   │
│   └── RequireAuth (protected)
│       ├── /dashboard              → DashboardPage
│       ├── /dashboard/add-place    → AddPlacePage
│       ├── /dashboard/leaderboard  → LeaderboardPage
│       ├── /profile                → ProfilePage
│       ├── /profile/edit           → ProfileEditPage
│       ├── /profile/language       → LanguageSettingsPage
│       ├── /profile/security       → SecurityPrivacyPage
│       ├── /privacy/delete-request → DeleteDataPage
│       ├── /ai-guide               → AIGuidePage (with error boundary)
│       ├── /saved                  → SavedPage
│       ├── /visited                → VisitedPage
│       └── /map                    → Redirect to /explore
│
├── RequireAdmin (protected, role === 'admin')
│   └── AdminLayout
│       ├── /admin                  → AdminDashboardPage
│       ├── /admin/locations        → AdminLocationsPage
│       ├── /admin/users            → AdminUsersPage
│       ├── /admin/subscriptions    → AdminSubscriptionsPage
│       ├── /admin/moderation       → AdminModerationPage
│       ├── /admin/ai               → AdminAIPage
│       ├── /admin/stats            → AdminStatsPage
│       └── /admin/settings         → AdminSettingsPage
│
└── Fallback
    └── *                           → Redirect to /
```

### Route Protection Matrix

| Route Pattern | Auth Required | Role Required | Layout |
|---|---|---|---|
| `/` | No | No | PublicLayout |
| `/login`, `/auth/signup` | No | No | None (standalone) |
| `/explore`, `/location/:id` | No | No | MainLayout |
| `/dashboard/*`, `/profile/*` | Yes | Any | MainLayout |
| `/admin/*` | Yes | `admin` | AdminLayout |

### Lazy Loading Strategy

All pages except `LandingPage` are lazy-loaded with `React.lazy()`:

```javascript
// CRITICAL: Landing page is NOT lazy-loaded for instant first paint
import LandingPage from '@/features/public/pages/LandingPage'

// Everything else is lazy-loaded
const DashboardPage = lazy(() => import('@/features/dashboard/pages/DashboardPage'))
const AdminLocationsPage = lazy(() => import('@/features/admin/pages/AdminLocationsPage'))
```

### Code Splitting (Vite manualChunks)

```javascript
// vite.config.js
manualChunks: {
    'react-core': ['react', 'react-dom'],
    'react-router': ['react-router-dom'],
    'framer-motion': ['framer-motion'],
    'lucide': ['lucide-react'],
    'leaflet': ['leaflet', 'react-leaflet'],
    'i18n': ['i18next', 'react-i18next', 'i18next-browser-languagedetector'],
    'tanstack': ['@tanstack/react-query', '@tanstack/react-virtual'],
    'admin': [/* admin pages -- never loaded on public routes */],
}
```

### SPA Rewrites (Vercel)

```json
// vercel.json
{
  "rewrites": [
    { "source": "/((?!api/).*)", "destination": "/index.html" }
  ]
}
```

This ensures all non-API routes serve `index.html`, letting React Router handle client-side routing.

---

## 10. Internationalization

### Supported Languages

| Code | Language | Direction |
|---|---|---|
| `en` | English | Default / fallback |
| `pl` | Polish | -- |
| `ru` | Russian | -- |
| `ua` | Ukrainian | -- |

### i18next Configuration

```javascript
// src/i18n/config.js
import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import LanguageDetector from 'i18next-browser-languagedetector'

i18n
    .use(LanguageDetector)
    .use(initReactI18next)
    .init({
        resources: {
            en: { translation: enTranslation },
            ru: { translation: ruTranslation },
            pl: { translation: plTranslation },
            ua: { translation: uaTranslation },
        },
        fallbackLng: 'en',
        supportedLngs: ['en', 'ru', 'pl', 'ua'],
        detection: {
            order: ['localStorage', 'navigator'],  // Check localStorage first
            caches: ['localStorage'],               // Persist choice
        },
        interpolation: {
            escapeValue: false,  // React handles XSS escaping
        },
    })
```

### Translation File Structure

Translations are organized by namespace:

```
locales/
  en/
    translation.json          # Root-level translations
    common/
      navigation.json         # Nav labels
      buttons.json            # Button text
      status.json             # Status messages
    features/
      explore.json            # Explore page
      reviews.json            # Reviews feature
      location_card.json      # Location card component
  pl/
    ... (same structure)
  ru/
    ... (same structure)
    admin/
      locations.json          # Admin-specific
      users.json
      dashboard.json
  ua/
    ... (same structure)
```

### Usage in Components

```javascript
import { useTranslation } from 'react-i18next'

function DashboardPage() {
    const { t } = useTranslation()

    return (
        <h1>{t('dashboard.greeting_morning', { name: user.name })}</h1>
        <input placeholder={t('dashboard.search_placeholder')} />
    )
}
```

### Language Detection Priority

1. **localStorage** -- previously selected language (cached by LanguageDetector)
2. **navigator** -- browser/OS language preference
3. **fallback** -- English (`en`)

### Changing Language

```javascript
import { changeLanguage } from '@/i18n/config'
changeLanguage('pl')  // Switches to Polish, persists to localStorage
```

---

## 11. Deployment

### Vercel Configuration

```json
{
  "buildCommand": "npm run build",
  "outputDirectory": "dist",
  "devCommand": "npm run dev",
  "installCommand": "npm install",
  "framework": "vite"
}
```

### Environment Variables

#### Client-Side (prefixed with `VITE_`)

| Variable | Required | Description |
|---|---|---|
| `VITE_SUPABASE_URL` | Yes (production) | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Yes (production) | Supabase anonymous key |
| `VITE_OPENROUTER_API_KEY` | No | OpenRouter API key (dev only; production uses proxy) |
| `VITE_AI_MODEL` | No | Primary AI model (default: `mistralai/devstral-2512:free`) |
| `VITE_AI_MODEL_FALLBACK` | No | Fallback model (default: `mistralai/mistral-small-3.1:free`) |
| `VITE_APP_VERSION` | No | App version string (default: `2.0.0`) |

#### Server-Side (Vercel Serverless Functions)

| Variable | Required | Description |
|---|---|---|
| `OPENROUTER_API_KEY` | Yes (production) | OpenRouter API key for the AI proxy |

> **Security Note:** In production, `VITE_OPENROUTER_API_KEY` should NOT be set in the client bundle. The `/api/ai/chat` proxy function uses the server-side `OPENROUTER_API_KEY` instead.

### Security Headers

```json
{
  "headers": [
    {
      "source": "/assets/(.*)",
      "headers": [
        { "key": "Cache-Control", "value": "public, max-age=31536000, immutable" }
      ]
    },
    {
      "source": "/(.*)",
      "headers": [
        { "key": "X-Content-Type-Options", "value": "nosniff" },
        { "key": "X-Frame-Options", "value": "DENY" },
        { "key": "Referrer-Policy", "value": "strict-origin-when-cross-origin" },
        { "key": "Permissions-Policy", "value": "geolocation=(self), camera=(), microphone=()" }
      ]
    }
  ]
}
```

### PWA Configuration

Generated by `vite-plugin-pwa`:

```javascript
VitePWA({
    registerType: 'autoUpdate',
    manifest: {
        name: 'GastroMap -- Smart AI Dining Guide',
        short_name: 'GastroMap',
        description: 'Discover the best restaurants with AI.',
        theme_color: '#0f172a',
        display: 'standalone',
        icons: [
            { src: 'pwa-icon-192.png', sizes: '192x192', type: 'image/png' },
            { src: 'pwa-icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' }
        ]
    },
    workbox: {
        navigateFallback: 'index.html',
        runtimeCaching: [
            // Google Fonts (1 year cache)
            // Unsplash images (30 days cache)
            // Avatar images (7 days cache)
        ]
    }
})
```

### Caching Strategy

| Resource | Strategy | Duration |
|---|---|---|
| Build assets (`/assets/*`) | Immutable | 1 year |
| Google Fonts | CacheFirst | 1 year |
| Unsplash images | CacheFirst | 30 days |
| Avatar images | CacheFirst | 7 days |
| SPA navigation | NetworkFirst | -- |
| React Query data | staleTime + gcTime | 5 min stale / 10 min cache |

### Build Process

```bash
npm install       # Install dependencies
npm run build     # Vite production build → dist/
npm run preview   # Preview production build locally
```

The build outputs:
- `dist/index.html` -- Entry HTML
- `dist/assets/` -- Hashed JS/CSS bundles (code-split by manualChunks)
- `dist/pwa-*.png` -- PWA icons
- `dist/manifest.webmanifest` -- PWA manifest

### Development Workflow

```bash
npm run dev           # Start Vite dev server (HMR)
npm run test          # Run Vitest tests
npm run test:coverage # Run tests with coverage
npm run lint          # ESLint
npm run i18n:check    # Check for missing translations
npm run i18n:add      # Add new translation keys
```

---

## Appendix A: Supabase Database Schema (Key Tables)

### `locations`

| Column | Type | Description |
|---|---|---|
| `id` | uuid | Primary key |
| `title` | text | Restaurant name |
| `description` | text | Description |
| `address` | text | Full address |
| `city` | text | City name |
| `country` | text | Country name |
| `lat` | float | Latitude |
| `lng` | float | Longitude |
| `category` | text | Restaurant, Cafe, Bar, Fine Dining, Street Food |
| `cuisine` | text | Cuisine type(s) |
| `image` | text | Cover image URL |
| `photos` | jsonb | Array of photo URLs |
| `rating` | float | Rating (1-5) |
| `price_level` | text | $, $$, $$$, $$$$ |
| `opening_hours` | text | Operating hours |
| `tags` | jsonb | Array of tags |
| `vibe` | jsonb | Array of vibes (Romantic, Casual, etc.) |
| `features` | jsonb | Array of features |
| `best_for` | jsonb | Array of occasions (date, family, etc.) |
| `dietary` | jsonb | Array of dietary options |
| `has_wifi` | boolean | WiFi availability |
| `has_outdoor_seating` | boolean | Outdoor seating |
| `reservations_required` | boolean | Reservation needed |
| `michelin_stars` | integer | Michelin star count |
| `michelin_bib` | boolean | Bib Gourmand |
| `insider_tip` | text | Expert insider tip |
| `what_to_try` | jsonb | Array of recommended dishes |
| `ai_keywords` | jsonb | AI-generated keywords for search |
| `ai_context` | text | AI-generated context |
| `status` | text | active, pending, archived |
| `created_at` | timestamp | Creation time |
| `updated_at` | timestamp | Last update time |

### `profiles`

| Column | Type | Description |
|---|---|---|
| `id` | uuid | Primary key (matches auth.users.id) |
| `name` | text | Display name |
| `avatar_url` | text | Profile picture URL |
| `role` | text | user, admin |

### `favorites`, `visits`, `reviews`, `preferences`

Additional tables for user engagement tracking, each linked to `profiles.id`.

---

## Appendix B: Key File Reference

| File | Purpose |
|---|---|
| `src/main.jsx` | Entry point, renders `<App />` |
| `src/app/App.jsx` | Root component, initializes auth + locations |
| `src/app/router/AppRouter.jsx` | All route definitions, guards, lazy imports |
| `src/app/providers/AppProviders.jsx` | BrowserRouter, QueryClient, ErrorBoundary, SmoothScroll |
| `src/shared/api/queries.js` | All React Query hooks (single source of truth) |
| `src/shared/api/locations.api.js` | Locations CRUD with Supabase + mock fallback + auto-translation |
| `src/shared/api/ai.api.js` | AI system: intent detection, tool calling, cascade models |
| `src/shared/api/auth.api.js` | Auth operations with Supabase + mock fallback |
| `src/shared/config/env.js` | Centralized env var access (never use `import.meta.env` elsewhere) |
| `src/shared/config/queryClient.js` | React Query configuration |
| `src/features/auth/hooks/useAuthStore.js` | Auth Zustand store with persistence |
| `src/features/public/hooks/useLocationsStore.js` | Location filter state management |
| `src/store/useAppConfigStore.js` | Global app config (status, AI settings) |
| `src/i18n/config.js` | i18next setup |
| `api/ai/chat.js` | Vercel serverless AI proxy |
| `vercel.json` | Vercel deployment config |
| `vite.config.js` | Vite build config, PWA, code splitting |
