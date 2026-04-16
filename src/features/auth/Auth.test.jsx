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

        // signIn has 400ms delay + lazy DashboardPage chunk load
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

        expect(
            await screen.findByText(/Панель управления/i, {}, { timeout: 8000 })
        ).toBeInTheDocument()
    }, 12000)
})
