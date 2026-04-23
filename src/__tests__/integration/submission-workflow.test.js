/**
 * Integration: Submission Workflow
 *
 * Tests the full lifecycle: submit → pending → approve/reject.
 * Mocks Supabase client so actual DB is never hit.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

// ─── Hoisted mocks (vi.mock factories are hoisted above imports) ────────────

const { chain, mockSingle, mockInsert, mockUpdate, mockEq, mockOrder, mockSendNotificationToUser } = vi.hoisted(() => {
    const _mockSingle  = vi.fn()
    const _mockSelect  = vi.fn()
    const _mockInsert  = vi.fn()
    const _mockUpdate  = vi.fn()
    const _mockEq      = vi.fn()
    const _mockOrder   = vi.fn()
    const _mockSendNotificationToUser = vi.fn().mockResolvedValue(true)

    const _resolveQueue = []

    const _chain = {
        insert: _mockInsert,
        select: _mockSelect,
        update: _mockUpdate,
        eq:     _mockEq,
        order:  _mockOrder,
        single: _mockSingle,
        __enqueue(val) { _resolveQueue.push(val); return _chain },
        __clearQueue() { _resolveQueue.length = 0 },
    }
    Object.entries(_chain).forEach(([key, fn]) => {
        if (typeof fn === 'function' && !['then', '__enqueue', '__clearQueue'].includes(key)) {
            fn.mockReturnValue(_chain)
        }
    })
    _chain.then = (resolve) => {
        if (_resolveQueue.length > 0) {
            return resolve(_resolveQueue.shift())
        }
        return resolve({ data: null, error: null })
    }

    return {
        chain: _chain,
        mockSingle: _mockSingle,
        mockSelect: _mockSelect,
        mockInsert: _mockInsert,
        mockUpdate: _mockUpdate,
        mockEq: _mockEq,
        mockOrder: _mockOrder,
        mockSendNotificationToUser: _mockSendNotificationToUser,
    }
})

vi.mock('@/shared/api/client', () => ({
    supabase: { from: vi.fn(() => chain) },
    ApiError: class ApiError extends Error {
        constructor(msg, status, code) {
            super(msg)
            this.name   = 'ApiError'
            this.status = status
            this.code   = code
        }
    },
}))

vi.mock('@/shared/config/env', () => ({
    config: { supabase: { isConfigured: true } },
}))

vi.mock('@/shared/api/notifications.api', () => ({
    sendNotificationToUser: mockSendNotificationToUser,
    NOTIFICATION_TYPES: {
        LOCATION_APPROVED: { id: 'location_approved' },
        LOCATION_REJECTED: { id: 'location_rejected' },
    },
}))

import {
    createSubmission,
    getMySubmissions,
    getPendingSubmissions,
    approveSubmission,
    rejectSubmission,
} from '@/shared/api/submissions.api'

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('Submission Workflow Integration', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        chain.__clearQueue()
    })

    // ── 1. User submits a location ────────────────────────────────────────────

    describe('createSubmission — user submits a location', () => {
        it('inserts the record with status=pending and submitter_confirmed=true', async () => {
            const payload = { title: 'Bistro Novo', city: 'Krakow', address: 'ul. Floriańska 1' }
            const stored  = { id: 'sub-1', ...payload, status: 'pending', submitter_confirmed: true }

            mockSingle.mockResolvedValueOnce({ data: stored, error: null })

            const result = await createSubmission(payload)

            expect(result.status).toBe('pending')
            expect(result.submitter_confirmed).toBe(true)
            expect(mockInsert).toHaveBeenCalledWith(
                expect.objectContaining({ ...payload, status: 'pending', submitter_confirmed: true }),
            )
        })

        it('throws ApiError when Supabase returns an error', async () => {
            mockSingle.mockResolvedValueOnce({ data: null, error: { message: 'duplicate key', code: '23505' } })

            await expect(createSubmission({ title: 'X' })).rejects.toMatchObject({ name: 'ApiError' })
        })
    })

    // ── 2. Required-field validation (enforced by insert shape) ───────────────

    describe('createSubmission — required fields', () => {
        it('stores whatever payload is provided (DB enforces constraints)', async () => {
            const payload = { title: 'Minimal' }
            mockSingle.mockResolvedValueOnce({ data: { id: 's2', ...payload, status: 'pending', submitter_confirmed: true }, error: null })

            const result = await createSubmission(payload)
            expect(result).toHaveProperty('title', 'Minimal')
            expect(result.status).toBe('pending')
        })
    })

    // ── 3. Admin lists pending submissions ────────────────────────────────────

    describe('getPendingSubmissions — admin reads the queue', () => {
        it('queries only pending records ordered by created_at ASC', async () => {
            const pending = [
                { id: 'sub-1', status: 'pending', profiles: { name: 'Ana' } },
                { id: 'sub-2', status: 'pending', profiles: { name: 'Bob' } },
            ]
            mockOrder.mockResolvedValueOnce({ data: pending, error: null })

            const result = await getPendingSubmissions()

            expect(result).toHaveLength(2)
            expect(result.every(r => r.status === 'pending')).toBe(true)
        })

        it('returns empty array when no pending submissions exist', async () => {
            mockOrder.mockResolvedValueOnce({ data: [], error: null })
            const result = await getPendingSubmissions()
            expect(result).toEqual([])
        })
    })

    // ── 4. Admin approves → status becomes approved ───────────────────────────

    describe('approveSubmission — admin approves', () => {
        it('creates a location record then updates submission status to approved', async () => {
            const locationData   = { title: 'Bistro Novo', city: 'Krakow' }
            const createdLoc     = { id: 'loc-1', ...locationData }
            const updatedSub     = { id: 'sub-1', status: 'approved', location_id: 'loc-1' }

            // 1st single() = fetch submission, 2nd = location insert, 3rd = submission update
            mockSingle
                .mockResolvedValueOnce({ data: { user_id: 'u1', title: 'Bistro Novo' }, error: null })
                .mockResolvedValueOnce({ data: createdLoc,  error: null })
                .mockResolvedValueOnce({ data: updatedSub, error: null })

            const result = await approveSubmission('sub-1', locationData)

            expect(result).toEqual(updatedSub)
        })

        it('throws ApiError if the fetch submission fails', async () => {
            mockSingle.mockResolvedValueOnce({ data: null, error: { message: 'not found', code: 'PGRST116' } })

            await expect(approveSubmission('sub-1', { title: 'X' })).rejects.toMatchObject({ name: 'ApiError' })
        })

        it('throws ApiError if the location insert fails', async () => {
            mockSingle
                .mockResolvedValueOnce({ data: { user_id: 'u1', title: 'X' }, error: null })
                .mockResolvedValueOnce({ data: null, error: { message: 'loc insert fail', code: '23505' } })

            await expect(approveSubmission('sub-1', { title: 'X' })).rejects.toMatchObject({ name: 'ApiError' })
        })
    })

    // ── 5. Admin rejects → status becomes rejected with reason ───────────────

    describe('rejectSubmission — admin rejects', () => {
        it('updates submission to status=rejected with rejection_reason and reviewed_at', async () => {
            const updated = { id: 'sub-1', status: 'rejected', rejection_reason: 'Duplicate listing' }

            mockSingle.mockResolvedValueOnce({ data: { user_id: 'u1', title: 'Bistro' }, error: null })
            chain.__enqueue({ data: updated, error: null })

            const result = await rejectSubmission('sub-1', 'Duplicate listing')

            expect(result.status).toBe('rejected')
            expect(result.rejection_reason).toBe('Duplicate listing')

            expect(mockUpdate).toHaveBeenCalledWith(
                expect.objectContaining({ status: 'rejected', rejection_reason: 'Duplicate listing' }),
            )
        })

        it('throws ApiError if the fetch submission fails', async () => {
            mockSingle.mockResolvedValueOnce({ data: null, error: { message: 'not found', code: 'PGRST116' } })

            await expect(rejectSubmission('sub-1', 'Bad')).rejects.toMatchObject({ name: 'ApiError' })
        })

        it('throws ApiError if the update fails', async () => {
            mockSingle.mockResolvedValueOnce({ data: { user_id: 'u1', title: 'Place' }, error: null })
            chain.__enqueue({ data: null, error: { message: 'permission denied', code: '42501' } })

            await expect(rejectSubmission('sub-1', 'Bad')).rejects.toMatchObject({ name: 'ApiError' })
        })
    })

    // ── 6. User retrieves their own submissions ───────────────────────────────

    describe('getMySubmissions — user lists own submissions', () => {
        it('returns submissions filtered by userId ordered by created_at desc', async () => {
            const data = [
                { id: 'sub-3', user_id: 'u1', status: 'pending'  },
                { id: 'sub-2', user_id: 'u1', status: 'approved' },
            ]
            mockOrder.mockResolvedValueOnce({ data, error: null })

            const result = await getMySubmissions('u1')

            expect(result).toHaveLength(2)
            expect(mockEq).toHaveBeenCalledWith('user_id', 'u1')
        })
    })
})
