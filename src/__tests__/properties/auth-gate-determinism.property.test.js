/**
 * Property test: Auth_Gate_Determinism (P3)
 *
 * Validates: Requirements R3.2, R3.3, R20.3
 * Feature: data-loading-architecture
 * Phase: 1 — Auth Gate Consolidation
 *
 * For any sequence of `subscribeToAuthChanges` callbacks ending in a single
 * `pending → anon|authed` transition, every consumer wired through
 * `useSession()` fires its enabled `queryFn` exactly once for that
 * transition.
 *
 * NOTE: This is a test-first property test. `useSession()` does NOT yet
 * exist (it lands in task 1.2). This test is expected to FAIL at module
 * resolution until that hook is implemented.
 */

import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import fc from 'fast-check'
import { renderHook, act, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query'

// ─── Hoisted controllable handle for the auth-callbacks mock ──────────────
// `vi.hoisted` lets us share a mutable handle between the (hoisted)
// `vi.mock` factory and the test body. The test drives `onAuth()` /
// `onAnon()` directly via this handle.
const authMock = vi.hoisted(() => ({
    onAuth: null,
    onAnon: null,
    subscribeCalls: 0,
}))

// Mock the auth API surface so `useSession` subscribes against a
// controllable double instead of real Supabase.
vi.mock('@/shared/api/auth.api', () => ({
    subscribeToAuthChanges: (onSession, onSignOut) => {
        authMock.onAuth = onSession
        authMock.onAnon = onSignOut
        authMock.subscribeCalls += 1
        return () => {
            authMock.onAuth = null
            authMock.onAnon = null
        }
    },
}))

// Some implementations of `useSession` short-circuit to `'anon'` when the
// Supabase client is null (env not configured). In jsdom there are no
// Vite env vars, so we provide a truthy stub to ensure the subscription
// path is taken.
vi.mock('@/shared/api/client', () => ({
    supabase: {
        auth: {
            onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
            getSession: vi.fn(async () => ({ data: { session: null }, error: null })),
        },
    },
    ApiError: class ApiError extends Error {},
    handlePGRSTError: () => null,
    safeQuery: async () => null,
    safeRpc: async () => null,
    simulateDelay: () => Promise.resolve(),
}))

// Reusable wrapper factory — fresh QueryClient per render to keep cache
// state isolated between fast-check runs.
function makeWrapper(queryClient) {
    return function Wrapper({ children }) {
        return React.createElement(QueryClientProvider, { client: queryClient }, children)
    }
}

describe('Auth_Gate_Determinism (P3)', () => {
    beforeEach(() => {
        authMock.onAuth = null
        authMock.onAnon = null
        authMock.subscribeCalls = 0
        vi.resetModules()
    })

    it('Feature: data-loading-architecture, Property 3: Auth_Gate_Determinism — consumer fires its enabled fetch exactly once per pending → anon|authed transition', async () => {
        await fc.assert(
            fc.asyncProperty(
                // Random "noise" sequence of callbacks fired before the
                // final deterministic transition. `noop` represents a
                // tick where neither callback fires.
                fc.array(fc.constantFrom('authed', 'anon', 'noop'), {
                    minLength: 0,
                    maxLength: 9,
                }),
                // The terminal entry guarantees the sequence ends in a
                // single `pending → anon|authed` resolution.
                fc.constantFrom('authed', 'anon'),
                async (noise, terminal) => {
                    // 1. Reset the useSession module so each run starts
                    //    from a fresh module-level singleton.
                    vi.resetModules()
                    authMock.onAuth = null
                    authMock.onAnon = null
                    authMock.subscribeCalls = 0

                    // 2. Re-import the (not-yet-existing) hook under test.
                    const { useSession } = await import('@/shared/auth/useSession')

                    // 3. Fresh QueryClient per run keeps cache isolated.
                    const queryClient = new QueryClient({
                        defaultOptions: {
                            queries: { retry: false, gcTime: 0, staleTime: 0 },
                        },
                    })
                    const Wrapper = makeWrapper(queryClient)

                    // 4. Mock queryFn we will assert against.
                    const queryFn = vi.fn(async () => 'OK')

                    // 5. Consumer hook: read auth gate, run a query gated
                    //    on `status !== 'pending'`.
                    const useConsumer = () => {
                        const session = useSession()
                        const status = session?.status
                        useQuery({
                            queryKey: ['auth-gate-determinism', 'test-consumer'],
                            queryFn,
                            enabled: status !== 'pending',
                        })
                        return session
                    }

                    const { unmount } = renderHook(useConsumer, { wrapper: Wrapper })

                    // 6. Drive the generated sequence through the mocked
                    //    auth callbacks. After each step, flush React.
                    const sequence = [...noise, terminal]
                    for (const step of sequence) {
                        // eslint-disable-next-line no-await-in-loop
                        await act(async () => {
                            if (step === 'authed' && typeof authMock.onAuth === 'function') {
                                authMock.onAuth({
                                    user: { id: 'u-1', email: 'u@example.com', role: 'user' },
                                    token: 'tok-1',
                                })
                            } else if (step === 'anon' && typeof authMock.onAnon === 'function') {
                                authMock.onAnon()
                            }
                            // noop: neither callback fires.
                            await Promise.resolve()
                        })
                    }

                    // 7. Allow React Query's enabled-flip to resolve, then
                    //    assert the queryFn fired exactly once for the
                    //    pending → anon|authed resolution.
                    await waitFor(() =>
                        expect(queryFn).toHaveBeenCalledTimes(1),
                    )

                    // 8. Cleanup — unmount and clear cache for the next run.
                    unmount()
                    queryClient.clear()
                },
            ),
            { numRuns: 100 },
        )
    })
})
