/**
 * Test helpers — shared render utilities for all test files.
 *
 * Use renderWithProviders instead of plain render() whenever
 * the component under test uses:
 *   - React Router hooks (useLocation, useNavigate, useParams)
 *   - TanStack React Query (useQuery, useMutation)
 *   - Zustand stores (automatically available, no wrapper needed)
 */

import React from 'react'
import { render } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { I18nextProvider } from 'react-i18next'
import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import en from '../locales/en/translation.json'
import pl from '../locales/pl/translation.json'

// Initialise i18n once for the entire test suite
if (!i18n.isInitialized) {
    i18n.use(initReactI18next).init({
        lng: 'en',
        fallbackLng: 'en',
        resources: { en: { translation: en }, pl: { translation: pl } },
        interpolation: { escapeValue: false },
        initImmediate: false,
    })
}

/**
 * Create a fresh QueryClient for each test — avoids state leaking between tests.
 */
export function createTestQueryClient() {
    return new QueryClient({
        defaultOptions: {
            queries: { retry: false, staleTime: 0, gcTime: 0 },
            mutations: { retry: false },
        },
        // Silence React Query's console.error in tests
        logger: { log: () => {}, warn: () => {}, error: () => {} },
    })
}

/**
 * Render component with Router + QueryClient context.
 *
 * @param {React.ReactElement} ui
 * @param {{
 *   initialEntries?: string[],
 *   queryClient?: QueryClient,
 * }} options
 */
export function renderWithProviders(ui, options = {}) {
    const {
        initialEntries = ['/'],
        queryClient = createTestQueryClient(),
    } = options

    function Wrapper({ children }) {
        return (
            <I18nextProvider i18n={i18n}>
                <QueryClientProvider client={queryClient}>
                    <MemoryRouter initialEntries={initialEntries}>
                        {children}
                    </MemoryRouter>
                </QueryClientProvider>
            </I18nextProvider>
        )
    }

    return {
        ...render(ui, { wrapper: Wrapper }),
        queryClient,
    }
}

/**
 * Render with router only (no React Query).
 * Use for components that only need navigation context.
 */
export function renderWithRouter(ui, { initialEntries = ['/'] } = {}) {
    return render(
        <I18nextProvider i18n={i18n}>
            <MemoryRouter initialEntries={initialEntries}>{ui}</MemoryRouter>
        </I18nextProvider>
    )
}
