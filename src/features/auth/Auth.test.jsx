import { describe, it, expect, beforeEach, vi } from 'vitest'
import { screen, fireEvent, waitFor } from '@testing-library/react'
import { renderWithProviders } from '@/test/helpers'
import App from '@/app/App'
import { useAuthStore } from '@/shared/store/useAuthStore'

vi.mock('@/components/auth/SubscriptionGate', () => ({
    default: ({ children }) => children,
}))

// Prevent onboarding overlay from appearing in auth tests
vi.mock('@/features/auth/components/OnboardingGate', () => ({
    OnboardingGate: ({ children }) => children,
}))

// Mock locations store — must handle zustand-style selectors and getState/setState
vi.mock('@/shared/store/useLocationsStore', () => {
    const store = {
        initialize: vi.fn(),
        reinitialize: vi.fn(),
        isInitialized: true,
        initError: null,
        locations: [],
        filteredLocations: [],
        mapMarkers: [],
        isLoading: false,
        isLoadingMore: false,
        currentPage: 0,
        pageSize: 200,
        hasMore: true,
        activeCategories: [],
        activeCategory: 'All',
        searchQuery: '',
        activePriceLevels: [],
        minRating: null,
        activeVibes: [],
        activeBestTime: null,
        radius: 0,
        userLocation: null,
        sortBy: 'google_rating',
        activeCity: 'All',
        activeCountry: 'All',
        isOpenNow: false,
        setSearchQuery: vi.fn(),
        setUserLocation: vi.fn(),
        setCountry: vi.fn(),
        setRadius: vi.fn(),
        setIsOpenNow: vi.fn(),
        setCategory: vi.fn(),
        toggleCategory: vi.fn(),
        toggleVibe: vi.fn(),
        setVibes: vi.fn(),
        setPriceLevels: vi.fn(),
        setMinRating: vi.fn(),
        setSortBy: vi.fn(),
        setCity: vi.fn(),
        setBestTime: vi.fn(),
        getActiveFiltersCount: vi.fn(() => 0),
        applyFilters: vi.fn(),
        resetFilters: vi.fn(),
        updateUserLocation: vi.fn(),
        setLocations: vi.fn(),
        addLocation: vi.fn(),
        updateLocation: vi.fn(),
        deleteLocation: vi.fn(),
        setBounds: vi.fn(),
        fetchInBounds: vi.fn(),
        loadMore: vi.fn(),
    }
    const getState = () => store
    const setState = (updater) => {
        Object.assign(store, typeof updater === 'function' ? updater(store) : updater)
    }
    const useLocationsStore = vi.fn((selector) => selector ? selector(store) : store)
    useLocationsStore.getState = getState
    useLocationsStore.setState = setState
    return { useLocationsStore }
})

// Mock app config store to prevent loadFromDB side effects
vi.mock('@/shared/store/useAppConfigStore', () => {
    const store = {
        loadFromDB: vi.fn(),
        aiApiKey: null,
        aiPrimaryModel: '',
        aiFallbackModel: '',
        appStatus: 'active',
        maintenanceMessage: '',
        downMessage: '',
    }
    const useAppConfigStore = vi.fn((selector) => selector ? selector(store) : store)
    useAppConfigStore.getState = () => store
    useAppConfigStore.setState = vi.fn()
    return { useAppConfigStore }
})

// Mock auth store — lightweight zustand store, no persistence side effects, fast initAuth
vi.mock('@/shared/store/useAuthStore', async () => {
    const { create } = await vi.importActual('zustand')
    const store = create((set) => ({
        user: null,
        token: null,
        isAuthenticated: false,
        isLoading: false,
        error: null,
        _unsubscribeAuth: null,

        initAuth: () => set({ isLoading: false }),

        login: async (email, _password) => {
            const ADMIN_EMAILS = ['admin@gastromap.com', 'alik2191@gmail.com']
            const isAdmin = ADMIN_EMAILS.includes(email)
            const name = isAdmin
                ? 'Admin User'
                : email.split('@')[0].replace(/[._-]/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
            const user = {
                id: isAdmin ? 'admin1' : 'user_test123',
                name,
                email,
                role: isAdmin ? 'admin' : 'user',
                avatar: null,
                createdAt: isAdmin ? '2024-01-01T00:00:00Z' : new Date().toISOString(),
            }
            set({ user, token: isAdmin ? 'mock-admin-jwt' : 'mock-user-jwt', isAuthenticated: true, isLoading: false })
            return { success: true, user }
        },

        logout: async () => {
            set({ user: null, token: null, isAuthenticated: false, isLoading: false })
        },

        clearError: () => set({ error: null }),
        register: async () => ({ success: true }),
        updateUserProfile: async () => {},
        requestPasswordReset: async () => ({ success: true }),
        setNewPassword: async () => ({ success: true }),
        resendVerificationEmail: async () => ({ success: true }),
        uploadAvatar: async () => ({ success: true }),
    }))
    return { useAuthStore: store }
})

// Mock the auth API so login always uses mock data (avoids real Supabase calls)
vi.mock('@/shared/api/auth.api', () => ({
    signIn: vi.fn(async (email) => {
        const ADMIN_EMAILS = ['admin@gastromap.com', 'alik2191@gmail.com']
        if (ADMIN_EMAILS.includes(email)) {
            return {
                user: { id: 'admin1', name: 'Admin User', email, role: 'admin', avatar: null, createdAt: '2024-01-01T00:00:00Z' },
                token: 'mock-admin-jwt',
            }
        }
        const name = email.split('@')[0].replace(/[._-]/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
        return {
            user: { id: 'user_test123', name, email, role: 'user', avatar: null, createdAt: new Date().toISOString() },
            token: 'mock-user-jwt',
        }
    }),
    signUp: vi.fn(async () => ({})),
    signOut: vi.fn(async () => {}),
    updateProfile: vi.fn(async () => ({})),
    subscribeToAuthChanges: vi.fn(() => vi.fn()),
    resetPassword: vi.fn(async () => ({ message: 'ok' })),
    updatePassword: vi.fn(async () => ({ message: 'ok' })),
    resendVerification: vi.fn(async () => ({ message: 'ok' })),
    uploadAvatar: vi.fn(async () => ({ url: 'test' })),
}))

describe('Auth Features Integration', () => {
    beforeEach(() => {
        useAuthStore.setState({
            user: null,
            token: null,
            isAuthenticated: false,
            isLoading: false,
            error: null,
        })
    })

    it('renders login form after lazy load', async () => {
        renderWithProviders(<App includeRouter={false} />, {
            initialEntries: ['/login'],
        })

        const emailInput = await screen.findByLabelText(/Email/i, {}, { timeout: 5000 })
        expect(emailInput).toBeInTheDocument()
        expect(screen.getByLabelText(/Password/i)).toBeInTheDocument()
    }, 10000)

    it('allows user login and redirects to dashboard', async () => {
        renderWithProviders(<App includeRouter={false} />, {
            initialEntries: ['/login'],
        })

        const emailInput = await screen.findByLabelText(/Email/i, {}, { timeout: 5000 })
        fireEvent.change(emailInput, { target: { value: 'user@example.com' } })
        fireEvent.change(screen.getByLabelText(/Password/i), { target: { value: 'password' } })
        const signInBtn = await screen.findByRole('button', { name: /sign in/i }, { timeout: 5000 })
        fireEvent.click(signInBtn)

        await waitFor(() => {
            expect(screen.getByTestId('dashboard-page')).toBeInTheDocument()
        }, { timeout: 10000 })
    }, 15000)

    it('allows admin login and redirects to admin panel', async () => {
        renderWithProviders(<App includeRouter={false} />, {
            initialEntries: ['/login'],
        })

        const emailInput = await screen.findByLabelText(/Email/i, {}, { timeout: 5000 })
        fireEvent.change(emailInput, { target: { value: 'admin@gastromap.com' } })
        fireEvent.change(screen.getByLabelText(/Password/i), { target: { value: 'adminpass' } })
        const signInBtn = await screen.findByRole('button', { name: /sign in/i }, { timeout: 5000 })
        fireEvent.click(signInBtn)

        await waitFor(() => {
            expect(screen.getByRole('heading', { name: /Dashboard/i })).toBeInTheDocument()
        }, { timeout: 10000 })
    }, 15000)
})
