import { describe, it, expect, beforeEach } from 'vitest'
import { screen, fireEvent } from '@testing-library/react'
import { renderWithProviders } from '@/test/helpers'
import App from '@/app/App'
import { useAuthStore } from './hooks/useAuthStore'

vi.mock('@/components/auth/SubscriptionGate', () => ({
    default: ({ children }) => children,
}))

// Prevent onboarding overlay from appearing in auth tests
vi.mock('@/features/auth/components/OnboardingGate', () => ({
    OnboardingGate: ({ children }) => children,
}))

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
            // No-op initAuth so App mount doesn't flip isLoading back to true
            initAuth: () => {},
        })
    })

    it('renders login form after lazy load', async () => {
        renderWithProviders(<App includeRouter={false} />, {
            initialEntries: ['/login'],
        })

        const emailInput = await screen.findByLabelText(/Email/i, {}, { timeout: 4000 })
        expect(emailInput).toBeInTheDocument()
        expect(screen.getByLabelText(/Password/i)).toBeInTheDocument()
    })

    it('allows user login and redirects to dashboard', async () => {
        renderWithProviders(<App includeRouter={false} />, {
            initialEntries: ['/login'],
        })

        const emailInput = await screen.findByLabelText(/Email/i, {}, { timeout: 4000 })

        fireEvent.change(emailInput, { target: { value: 'user@example.com' } })
        fireEvent.change(screen.getByLabelText(/Password/i), { target: { value: 'password' } })
        const signInBtn = await screen.findByRole('button', { name: /sign in/i }, { timeout: 4000 })
        fireEvent.click(signInBtn)

        // After login, the auth store sets isAuthenticated=true and
        // LoginPage navigates to /dashboard. The DashboardPage is lazy-loaded.
        // Check that the login form is gone and dashboard content appears.
        expect(
            await screen.findByTestId('dashboard-page', {}, { timeout: 8000 })
        ).toBeInTheDocument()
    }, 12000)

    it('allows admin login and redirects to admin panel', async () => {
        renderWithProviders(<App includeRouter={false} />, {
            initialEntries: ['/login'],
        })

        const emailInput = await screen.findByLabelText(/Email/i, {}, { timeout: 4000 })

        fireEvent.change(emailInput, { target: { value: 'admin@gastromap.com' } })
        fireEvent.change(screen.getByLabelText(/Password/i), { target: { value: 'adminpass' } })
        const signInBtn = await screen.findByRole('button', { name: /sign in/i }, { timeout: 4000 })
        fireEvent.click(signInBtn)

        // After admin login, redirects to /admin which renders AdminDashboardPage
        // with the heading "Панель управления"
        expect(
            await screen.findByRole('heading', { name: /Панель управления/i }, { timeout: 8000 })
        ).toBeInTheDocument()
    }, 12000)
})
