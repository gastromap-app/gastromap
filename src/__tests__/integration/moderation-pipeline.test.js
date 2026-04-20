/**
 * Integration: Moderation Pipeline
 *
 * Tests the unified moderation queue that combines submissions and reviews.
 * Covers: listing pending items, approve/reject actions, timestamp updates,
 * and valid status transitions.
 *
 * External services (Supabase) are fully mocked.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

// ─── Hoisted mocks (vi.mock factories are hoisted above imports) ────────────

const { chain, mockSingle, mockSelect, mockInsert, mockUpdate, mockDelete, mockEq, mockIn, mockOrder, mockSendNotificationToUser } = vi.hoisted(() => {
    const _mockSingle = vi.fn()
    const _mockSelect = vi.fn()
    const _mockInsert = vi.fn()
    const _mockUpdate = vi.fn()
    const _mockDelete = vi.fn()
    const _mockEq     = vi.fn()
    const _mockIn     = vi.fn()
    const _mockOrder  = vi.fn()
    const _mockSendNotificationToUser = vi.fn().mockResolvedValue(true)

    const _resolveQueue = []

    const _chain = {
        insert: _mockInsert,
        select: _mockSelect,
        update: _mockUpdate,
        delete: _mockDelete,
        eq:     _mockEq,
        in:     _mockIn,
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
        mockDelete: _mockDelete,
        mockEq: _mockEq,
        mockIn: _mockIn,
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
    getPendingSubmissions,
    approveSubmission,
    rejectSubmission,
} from '@/shared/api/submissions.api'

import {
    getLocationReviews,
    createReview,
    updateReview,
} from '@/shared/api/reviews.api'

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('Moderation Pipeline Integration', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        Object.entries(chain).forEach(([key, fn]) => {
            if (typeof fn === 'function' && !['then', '__enqueue', '__clearQueue'].includes(key)) {
                fn.mockReturnValue(chain)
            }
        })
        chain.__clearQueue()
    })

    // ── 1. List pending submissions ───────────────────────────────────────────

    describe('pending submissions queue', () => {
        it('returns all pending submissions with profile data', async () => {
            const items = [
                { id: 's1', status: 'pending', title: 'Cafe Pronto', profiles: { name: 'John' } },
                { id: 's2', status: 'pending', title: 'Noodle House', profiles: { name: 'Jane' } },
                { id: 's3', status: 'pending', title: 'Sushi Den',   profiles: { name: 'Ana'  } },
            ]
            mockOrder.mockResolvedValueOnce({ data: items, error: null })

            const result = await getPendingSubmissions()

            expect(result).toHaveLength(3)
            expect(result.every(r => r.status === 'pending')).toBe(true)
        })

        it('filters: only status=pending items appear in the queue', async () => {
            mockOrder.mockResolvedValueOnce({ data: [], error: null })
            await getPendingSubmissions()
            expect(mockEq).toHaveBeenCalledWith('status', 'pending')
        })

        it('returns empty array when queue is empty', async () => {
            mockOrder.mockResolvedValueOnce({ data: [], error: null })
            const result = await getPendingSubmissions()
            expect(result).toEqual([])
        })
    })

    // ── 2. Approve action — updates status + sets timestamps ─────────────────

    describe('approve action', () => {
        it('creates location record and marks submission as approved', async () => {
            const locationPayload = { title: 'Cafe Pronto', city: 'Krakow' }
            const newLocation     = { id: 'loc-10', ...locationPayload }
            const approvedSub     = { id: 's1', status: 'approved', location_id: 'loc-10', reviewed_at: expect.any(String) }

            mockSingle
                .mockResolvedValueOnce({ data: { user_id: 'u1', title: 'Cafe Pronto' }, error: null })
                .mockResolvedValueOnce({ data: newLocation, error: null })
                .mockResolvedValueOnce({ data: approvedSub, error: null })

            const result = await approveSubmission('s1', locationPayload)

            expect(result.status).toBe('approved')
            expect(result.location_id).toBe('loc-10')
        })

        it('sets reviewed_at timestamp during approval', async () => {
            const locationPayload = { title: 'Noodle House', city: 'Warsaw' }
            mockSingle
                .mockResolvedValueOnce({ data: { user_id: 'u1', title: 'Noodle House' }, error: null })
                .mockResolvedValueOnce({ data: { id: 'loc-11', ...locationPayload }, error: null })
                .mockResolvedValueOnce({ data: { id: 's2', status: 'approved' }, error: null })

            await approveSubmission('s2', locationPayload)

            expect(mockUpdate).toHaveBeenCalledWith(
                expect.objectContaining({ status: 'approved', reviewed_at: expect.any(String) }),
            )
        })
    })

    // ── 3. Reject action — includes reason text ───────────────────────────────

    describe('reject action', () => {
        it('marks submission as rejected with reason', async () => {
            const rejectedSub = { id: 's3', status: 'rejected', rejection_reason: 'Address is wrong' }

            mockSingle.mockResolvedValueOnce({ data: { user_id: 'u1', title: 'Place' }, error: null })
            chain.__enqueue({ data: rejectedSub, error: null })

            const result = await rejectSubmission('s3', 'Address is wrong')

            expect(result.status).toBe('rejected')
            expect(result.rejection_reason).toBe('Address is wrong')
        })

        it('sets rejection_reason and reviewed_at in the update payload', async () => {
            mockSingle.mockResolvedValueOnce({ data: { user_id: 'u1', title: 'Place' }, error: null })
            chain.__enqueue({ data: { id: 's4', status: 'rejected' }, error: null })

            await rejectSubmission('s4', 'Duplicate')

            expect(mockUpdate).toHaveBeenCalledWith(
                expect.objectContaining({
                    status:           'rejected',
                    rejection_reason: 'Duplicate',
                    reviewed_at:      expect.any(String),
                }),
            )
        })
    })

    // ── 4. Reviews moderation ─────────────────────────────────────────────────

    describe('reviews moderation', () => {
        it('getLocationReviews returns only approved and published reviews', async () => {
            const reviews = [
                { id: 'r1', status: 'approved',  rating: 5, profiles: { full_name: 'Alice' } },
                { id: 'r2', status: 'published', rating: 4, profiles: { full_name: 'Bob'   } },
            ]
            mockOrder.mockResolvedValueOnce({ data: reviews, error: null })

            const result = await getLocationReviews('loc-10')

            expect(result).toHaveLength(2)
            result.forEach(r => {
                expect(['approved', 'published']).toContain(r.status)
            })
        })

        it('createReview stores review with status=pending', async () => {
            const stored = { id: 'r10', user_id: 'u1', location_id: 'loc-1', rating: 5, status: 'pending' }
            mockSingle.mockResolvedValueOnce({ data: stored, error: null })

            const result = await createReview('u1', 'loc-1', 5, 'Excellent!')

            expect(result.status).toBe('pending')
            expect(mockInsert).toHaveBeenCalledWith(
                expect.objectContaining({ status: 'pending', rating: 5 }),
            )
        })

        it('updateReview — approve sets status to approved with updated_at', async () => {
            const updated = { id: 'r10', status: 'approved', updated_at: new Date().toISOString() }
            mockSingle.mockResolvedValueOnce({ data: updated, error: null })

            const result = await updateReview('r10', { status: 'approved' })

            expect(result.status).toBe('approved')
            expect(mockUpdate).toHaveBeenCalledWith(
                expect.objectContaining({ status: 'approved', updated_at: expect.any(String) }),
            )
        })
    })

    // ── 5. Status transition validity ─────────────────────────────────────────

    describe('status transitions', () => {
        it('pending → approved is a valid transition', async () => {
            const locationData = { title: 'Test', city: 'Krakow' }
            mockSingle
                .mockResolvedValueOnce({ data: { user_id: 'u1', title: 'Test' }, error: null })
                .mockResolvedValueOnce({ data: { id: 'l1', ...locationData }, error: null })
                .mockResolvedValueOnce({ data: { id: 's-pending', status: 'approved' }, error: null })

            const result = await approveSubmission('s-pending', locationData)
            expect(result.status).toBe('approved')
        })

        it('pending → rejected is a valid transition', async () => {
            mockSingle.mockResolvedValueOnce({ data: { user_id: 'u1', title: 'Place' }, error: null })
            chain.__enqueue({ data: { id: 's-pending', status: 'rejected' }, error: null })

            const result = await rejectSubmission('s-pending', 'Off-topic')
            expect(result.status).toBe('rejected')
        })

        it('update call is made with correct status field for each transition', async () => {
            // Approve
            mockSingle
                .mockResolvedValueOnce({ data: { user_id: 'u1', title: 'T' }, error: null })
                .mockResolvedValueOnce({ data: { id: 'loc-x' }, error: null })
                .mockResolvedValueOnce({ data: {}, error: null })
            await approveSubmission('sub-x', { title: 'T' })
            expect(mockUpdate).toHaveBeenCalledWith(expect.objectContaining({ status: 'approved' }))

            vi.clearAllMocks()
            Object.entries(chain).forEach(([key, fn]) => {
                if (typeof fn === 'function' && !['then', '__enqueue', '__clearQueue'].includes(key)) {
                    fn.mockReturnValue(chain)
                }
            })
            chain.__clearQueue()

            // Reject
            mockSingle.mockResolvedValueOnce({ data: { user_id: 'u1', title: 'Place' }, error: null })
            chain.__enqueue({ data: {}, error: null })
            await rejectSubmission('sub-y', 'reason')
            expect(mockUpdate).toHaveBeenCalledWith(expect.objectContaining({ status: 'rejected' }))
        })
    })
})
