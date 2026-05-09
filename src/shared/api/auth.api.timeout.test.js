import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('./client', () => {
    const mockFn = vi.fn
    const MOCK_SUPABASE = {
        auth: {
            signInWithPassword: mockFn(),
            signUp: mockFn(),
            signOut: mockFn(),
            resetPasswordForEmail: mockFn(),
            updateUser: mockFn(),
            resend: mockFn(),
            onAuthStateChange: mockFn(() => ({ data: { subscription: { unsubscribe: mockFn() } } })),
        },
        from: mockFn(() => ({
            select: mockFn(() => ({ eq: mockFn(() => ({ single: mockFn(() => Promise.resolve({ data: null, error: null })) })) })),
        })),
        storage: {
            from: mockFn(() => ({
                upload: mockFn(() => Promise.resolve({ error: null })),
                getPublicUrl: mockFn(() => ({ data: { publicUrl: 'http://test' } })),
            })),
        },
    }
    return {
        supabase: MOCK_SUPABASE,
        ApiError: class extends Error {
            constructor(message, status, code) {
                super(message)
                this.status = status
                this.code = code
            }
        },
        simulateDelay: (ms) => new Promise(r => setTimeout(r, ms)),
    }
})

vi.mock('@/shared/config/env', () => ({
    config: { supabase: { isConfigured: true } }
}))

import { signIn, resetPassword, updatePassword, resendVerification } from './auth.api'
import { supabase } from './client'

describe('auth.api timeouts', () => {
    beforeEach(() => {
        vi.useFakeTimers({ shouldAdvanceTime: true })
    })
    afterEach(() => {
        vi.useRealTimers()
        vi.clearAllMocks()
    })

    it('signIn rejects with TIMEOUT after 15s if supabase hangs', async () => {
        supabase.auth.signInWithPassword.mockReturnValue(new Promise(() => {}))
        const promise = signIn('test@test.com', 'password')
        vi.advanceTimersByTime(15000)
        await expect(promise).rejects.toMatchObject({
            code: 'TIMEOUT',
            status: 408,
        })
    })

    it('resetPassword rejects with TIMEOUT after 15s if supabase hangs', async () => {
        supabase.auth.resetPasswordForEmail.mockReturnValue(new Promise(() => {}))
        const promise = resetPassword('test@test.com')
        vi.advanceTimersByTime(15000)
        await expect(promise).rejects.toMatchObject({
            code: 'TIMEOUT',
            status: 408,
        })
    })

    it('updatePassword rejects with TIMEOUT after 15s if supabase hangs', async () => {
        supabase.auth.updateUser.mockReturnValue(new Promise(() => {}))
        const promise = updatePassword('newpassword123')
        vi.advanceTimersByTime(15000)
        await expect(promise).rejects.toMatchObject({
            code: 'TIMEOUT',
            status: 408,
        })
    })

    it('resendVerification rejects with TIMEOUT after 15s if supabase hangs', async () => {
        supabase.auth.resend.mockReturnValue(new Promise(() => {}))
        const promise = resendVerification('test@test.com')
        vi.advanceTimersByTime(15000)
        await expect(promise).rejects.toMatchObject({
            code: 'TIMEOUT',
            status: 408,
        })
    })

    it('signIn resolves normally if supabase responds before timeout', async () => {
        supabase.auth.signInWithPassword.mockResolvedValue({
            data: { user: { id: 'u1', email: 'test@test.com', user_metadata: {} }, session: { access_token: 'tok' } },
            error: null,
        })
        const result = await signIn('test@test.com', 'password')
        expect(result.token).toBe('tok')
    })
})
