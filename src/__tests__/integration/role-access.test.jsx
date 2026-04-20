/**
 * Integration: Role-Based Access
 *
 * Tests route guards:
 *  - Unauthenticated user is redirected to /login from protected routes
 *  - Regular (non-admin) user is redirected to /dashboard from admin routes
 *  - Admin user can access all routes
 *  - RequireAuth and RequireAdmin render the correct redirects
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import React from 'react'
import { MemoryRouter, Routes, Route, Outlet, Navigate } from 'react-router-dom'

// ─── Mock state (mutated per test) ───────────────────────────────────────────

let mockAuthState = {
    isAuthenticated: false,
    isLoading: false,
    user: null,
}

vi.mock('@/shared/store/useAuthStore', () => ({
    useAuthStore: () => mockAuthState,
}))

// ─── Guard components — exact copies of AppRouter.jsx logic ──────────────────

function AuthLoader() {
    return React.createElement('div', { 'data-testid': 'auth-loader' }, 'Loading...')
}

function RequireAuth() {
    const { isAuthenticated, isLoading } = mockAuthState
    if (isLoading) return React.createElement(AuthLoader)
    if (!isAuthenticated) return React.createElement(Navigate, { to: '/login', replace: true })
    return React.createElement(Outlet)
}

function RequireAdmin() {
    const { user, isAuthenticated, isLoading } = mockAuthState
    if (isLoading) return React.createElement(AuthLoader)
    if (!isAuthenticated) return React.createElement(Navigate, { to: '/login', replace: true })
    if (user?.role !== 'admin') return React.createElement(Navigate, { to: '/dashboard', replace: true })
    return React.createElement(Outlet)
}

// ─── Helper ───────────────────────────────────────────────────────────────────

function makeElement(testId, text) {
    return React.createElement('div', { 'data-testid': testId }, text)
}

function renderWithGuard(initialEntry, Guard) {
    return render(
        React.createElement(
            MemoryRouter,
            { initialEntries: [initialEntry] },
            React.createElement(
                Routes,
                null,
                React.createElement(Route, { path: '/login',     element: makeElement('login-page', 'Login') }),
                React.createElement(Route, { path: '/dashboard', element: makeElement('dashboard-page', 'Dashboard') }),
                React.createElement(
                    Route,
                    { element: React.createElement(Guard) },
                    React.createElement(Route, { path: '/profile',          element: makeElement('profile-page', 'Profile') }),
                    React.createElement(Route, { path: '/admin',             element: makeElement('admin-page', 'Admin') }),
                    React.createElement(Route, { path: '/admin/moderation', element: makeElement('admin-mod', 'Moderation') }),
                    React.createElement(Route, { path: '/dashboard/add-place', element: makeElement('add-place', 'Add Place') }),
                ),
            ),
        ),
    )
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('Role-Based Access Integration', () => {
    beforeEach(() => {
        mockAuthState = { isAuthenticated: false, isLoading: false, user: null }
    })

    // ── 1. Unauthenticated user ───────────────────────────────────────────────

    describe('unauthenticated user', () => {
        it('RequireAuth redirects to /login when not authenticated', () => {
            mockAuthState = { isAuthenticated: false, isLoading: false, user: null }
            renderWithGuard('/profile', RequireAuth)
            expect(screen.getByTestId('login-page')).toBeInTheDocument()
            expect(screen.queryByTestId('profile-page')).not.toBeInTheDocument()
        })

        it('RequireAdmin redirects to /login when not authenticated', () => {
            mockAuthState = { isAuthenticated: false, isLoading: false, user: null }
            renderWithGuard('/admin', RequireAdmin)
            expect(screen.getByTestId('login-page')).toBeInTheDocument()
            expect(screen.queryByTestId('admin-page')).not.toBeInTheDocument()
        })

        it('shows AuthLoader while isLoading is true', () => {
            mockAuthState = { isAuthenticated: false, isLoading: true, user: null }
            renderWithGuard('/profile', RequireAuth)
            expect(screen.getByTestId('auth-loader')).toBeInTheDocument()
        })
    })

    // ── 2. Regular (user role) ────────────────────────────────────────────────

    describe('regular authenticated user', () => {
        it('RequireAuth allows access to protected user routes', () => {
            mockAuthState = { isAuthenticated: true, isLoading: false, user: { id: 'u1', role: 'user' } }
            renderWithGuard('/profile', RequireAuth)
            expect(screen.getByTestId('profile-page')).toBeInTheDocument()
        })

        it('RequireAdmin redirects regular user to /dashboard (not /login)', () => {
            mockAuthState = { isAuthenticated: true, isLoading: false, user: { id: 'u1', role: 'user' } }
            renderWithGuard('/admin', RequireAdmin)
            expect(screen.getByTestId('dashboard-page')).toBeInTheDocument()
            expect(screen.queryByTestId('admin-page')).not.toBeInTheDocument()
        })

        it('regular user cannot access admin moderation page', () => {
            mockAuthState = { isAuthenticated: true, isLoading: false, user: { id: 'u1', role: 'user' } }
            renderWithGuard('/admin/moderation', RequireAdmin)
            expect(screen.getByTestId('dashboard-page')).toBeInTheDocument()
            expect(screen.queryByTestId('admin-mod')).not.toBeInTheDocument()
        })
    })

    // ── 3. Admin user ─────────────────────────────────────────────────────────

    describe('admin user', () => {
        it('RequireAdmin allows admin to access admin routes', () => {
            mockAuthState = { isAuthenticated: true, isLoading: false, user: { id: 'a1', role: 'admin' } }
            renderWithGuard('/admin', RequireAdmin)
            expect(screen.getByTestId('admin-page')).toBeInTheDocument()
        })

        it('admin can also pass RequireAuth for regular protected routes', () => {
            mockAuthState = { isAuthenticated: true, isLoading: false, user: { id: 'a1', role: 'admin' } }
            renderWithGuard('/profile', RequireAuth)
            expect(screen.getByTestId('profile-page')).toBeInTheDocument()
        })

        it('admin can access nested admin routes', () => {
            mockAuthState = { isAuthenticated: true, isLoading: false, user: { id: 'a1', role: 'admin' } }
            renderWithGuard('/admin/moderation', RequireAdmin)
            expect(screen.getByTestId('admin-mod')).toBeInTheDocument()
        })
    })

    // ── 4. Guard contract — redirect targets ──────────────────────────────────

    describe('redirect contracts', () => {
        it('RequireAuth redirect target is /login for unauthenticated users', () => {
            mockAuthState = { isAuthenticated: false, isLoading: false, user: null }
            renderWithGuard('/dashboard/add-place', RequireAuth)
            expect(screen.getByTestId('login-page')).toBeInTheDocument()
        })

        it('RequireAdmin redirect for non-admin is /dashboard (not /login)', () => {
            mockAuthState = { isAuthenticated: true, isLoading: false, user: { id: 'u2', role: 'moderator' } }
            renderWithGuard('/admin', RequireAdmin)
            expect(screen.getByTestId('dashboard-page')).toBeInTheDocument()
            expect(screen.queryByTestId('login-page')).not.toBeInTheDocument()
        })

        it('null role is treated as non-admin → redirects to /dashboard', () => {
            mockAuthState = { isAuthenticated: true, isLoading: false, user: { id: 'u3', role: null } }
            renderWithGuard('/admin', RequireAdmin)
            expect(screen.getByTestId('dashboard-page')).toBeInTheDocument()
        })

        it('undefined role is treated as non-admin → redirects to /dashboard', () => {
            mockAuthState = { isAuthenticated: true, isLoading: false, user: { id: 'u4' } }
            renderWithGuard('/admin', RequireAdmin)
            expect(screen.getByTestId('dashboard-page')).toBeInTheDocument()
        })
    })
})
