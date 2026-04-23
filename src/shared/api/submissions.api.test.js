import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createSubmission, getMySubmissions, getPendingSubmissions, approveSubmission, rejectSubmission, uploadSubmissionPhoto } from './submissions.api'
import { ApiError } from './client'

// ─── Hoisted mocks (vi.mock factories are hoisted above imports) ────────────

const { chainable, mockInsert, mockOrder, mockSingle, mockUpload, mockGetPublicUrl, mockSendNotificationToUser } = vi.hoisted(() => {
    const _mockInsert = vi.fn()
    const _mockSelect = vi.fn()
    const _mockUpdate = vi.fn()
    const _mockEq = vi.fn()
    const _mockOrder = vi.fn()
    const _mockSingle = vi.fn()
    const _mockUpload = vi.fn()
    const _mockGetPublicUrl = vi.fn()
    const _mockSendNotificationToUser = vi.fn().mockResolvedValue(true)

    // Queue for resolved values when `await chainable` is used
    // (for chains that don't end with .single())
    const _resolveQueue = []

    const _chainable = {
        insert: _mockInsert,
        select: _mockSelect,
        update: _mockUpdate,
        eq: _mockEq,
        order: _mockOrder,
        single: _mockSingle,
        // Enqueue a resolved value for the next `await chainable`
        __enqueue(val) { _resolveQueue.push(val); return _chainable },
        // Reset the queue
        __clearQueue() { _resolveQueue.length = 0 },
    }

    // All methods return chainable for chaining
    Object.entries(_chainable).forEach(([key, fn]) => {
        if (typeof fn === 'function' && key !== '__enqueue' && key !== '__clearQueue') {
            fn.mockReturnValue(_chainable)
        }
    })

    // Make chainable thenable so `await chainable` works
    _chainable.then = (resolve) => {
        if (_resolveQueue.length > 0) {
            return resolve(_resolveQueue.shift())
        }
        return resolve({ data: null, error: null })
    }

    return {
        chainable: _chainable,
        mockInsert: _mockInsert,
        mockSelect: _mockSelect,
        mockUpdate: _mockUpdate,
        mockEq: _mockEq,
        mockOrder: _mockOrder,
        mockSingle: _mockSingle,
        mockUpload: _mockUpload,
        mockGetPublicUrl: _mockGetPublicUrl,
        mockSendNotificationToUser: _mockSendNotificationToUser,
    }
})

vi.mock('./client', () => ({
    supabase: {
        from: vi.fn(() => chainable),
        storage: { from: vi.fn(() => ({ upload: mockUpload, getPublicUrl: mockGetPublicUrl })) },
    },
    ApiError: class ApiError extends Error {
        constructor(message, status, code) { super(message); this.name = 'ApiError'; this.status = status; this.code = code }
    },
}))

vi.mock('@/shared/config/env', () => ({
    config: { supabase: { isConfigured: true } },
}))

vi.mock('./notifications.api', () => ({
    sendNotificationToUser: mockSendNotificationToUser,
    NOTIFICATION_TYPES: {
        LOCATION_APPROVED: { id: 'location_approved' },
        LOCATION_REJECTED: { id: 'location_rejected' },
    },
}))

describe('submissions.api', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        chainable.__clearQueue()
    })

    describe('createSubmission', () => {
        it('creates submission with pending status', async () => {
            const mockData = { id: 'sub-1', title: 'My Place', status: 'pending' }
            mockSingle.mockResolvedValue({ data: mockData, error: null })
            const payload = { title: 'My Place', city: 'Krakow' }
            const result = await createSubmission(payload)
            expect(result).toEqual(mockData)
            expect(mockInsert).toHaveBeenCalledWith(expect.objectContaining({ ...payload, status: 'pending', submitter_confirmed: true }))
        })

        it('throws ApiError on insert failure', async () => {
            mockSingle.mockResolvedValue({ data: null, error: { message: 'insert failed', code: '23505' } })
            await expect(createSubmission({ title: 'X' })).rejects.toThrow()
        })
    })

    describe('getMySubmissions', () => {
        it('returns user submissions ordered by created_at desc', async () => {
            const mockData = [{ id: '1', user_id: 'u1' }]
            mockOrder.mockResolvedValue({ data: mockData, error: null })
            const result = await getMySubmissions('u1')
            expect(result).toEqual(mockData)
        })

        it('throws ApiError on query failure', async () => {
            mockOrder.mockResolvedValue({ data: null, error: { message: 'fail', code: '42501' } })
            await expect(getMySubmissions('u1')).rejects.toThrow()
        })
    })

    describe('getPendingSubmissions', () => {
        it('returns pending submissions with profile join', async () => {
            const mockData = [{ id: '1', status: 'pending', profiles: { name: 'Admin' } }]
            mockOrder.mockResolvedValue({ data: mockData, error: null })
            const result = await getPendingSubmissions()
            expect(result).toEqual(mockData)
        })
    })

    describe('approveSubmission', () => {
        it('creates location and updates submission status', async () => {
            const locationData = { title: 'New Place', city: 'Krakow' }
            const createdLocation = { id: 'loc-1', ...locationData }
            mockSingle
                .mockResolvedValueOnce({ data: { user_id: 'user-1', title: 'New Place' }, error: null }) // fetch submission
                .mockResolvedValueOnce({ data: createdLocation, error: null }) // insert location
                .mockResolvedValueOnce({ data: { id: 'sub-1', status: 'approved' }, error: null }) // update submission
            const result = await approveSubmission('sub-1', locationData)
            expect(result.id).toBe('sub-1')
        })

        it('sends notification to submitter on approval', async () => {
            const locationData = { title: 'Tasty Bistro', city: 'Krakow' }
            mockSingle
                .mockResolvedValueOnce({ data: { user_id: 'user-42', title: 'Tasty Bistro' }, error: null })
                .mockResolvedValueOnce({ data: { id: 'loc-1', ...locationData }, error: null })
                .mockResolvedValueOnce({ data: { id: 'sub-1', status: 'approved' }, error: null })
            await approveSubmission('sub-1', locationData)
            expect(mockSendNotificationToUser).toHaveBeenCalledWith({
                userId: 'user-42',
                type: 'location_approved',
                title: 'Location approved!',
                body: 'Your location "Tasty Bistro" has been approved and is now visible to users.',
            })
        })

        it('throws if fetch submission fails', async () => {
            mockSingle.mockResolvedValueOnce({ data: null, error: { message: 'not found', code: 'PGRST116' } })
            await expect(approveSubmission('sub-1', {})).rejects.toThrow()
        })

        it('throws if location insert fails', async () => {
            mockSingle
                .mockResolvedValueOnce({ data: { user_id: 'user-1', title: 'Place' }, error: null })
                .mockResolvedValueOnce({ data: null, error: { message: 'loc fail', code: '23505' } })
            await expect(approveSubmission('sub-1', {})).rejects.toThrow()
        })
    })

    describe('rejectSubmission', () => {
        it('updates submission with rejected status and reason', async () => {
            mockSingle.mockResolvedValueOnce({ data: { user_id: 'user-1', title: 'Old Place' }, error: null })
            // Second chain: from().update().eq() — no .single(), so await resolves via thenable queue
            chainable.__enqueue({ data: { id: 'sub-1', status: 'rejected' }, error: null })
            const result = await rejectSubmission('sub-1', 'Duplicate')
            expect(result.id).toBe('sub-1')
        })

        it('sends notification to submitter on rejection', async () => {
            mockSingle.mockResolvedValueOnce({ data: { user_id: 'user-99', title: 'Bad Place' }, error: null })
            chainable.__enqueue({ data: { id: 'sub-2', status: 'rejected' }, error: null })
            await rejectSubmission('sub-2', 'Spam content')
            expect(mockSendNotificationToUser).toHaveBeenCalledWith({
                userId: 'user-99',
                type: 'location_rejected',
                title: 'Location needs changes',
                body: '"Bad Place" was not approved. Reason: Spam content',
                data: { reason: 'Spam content' },
            })
        })

        it('throws on fetch submission failure', async () => {
            mockSingle.mockResolvedValueOnce({ data: null, error: { message: 'not found', code: 'PGRST116' } })
            await expect(rejectSubmission('sub-1', 'Bad')).rejects.toThrow()
        })

        it('throws on update failure', async () => {
            mockSingle.mockResolvedValueOnce({ data: { user_id: 'user-1', title: 'Place' }, error: null })
            chainable.__enqueue({ data: null, error: { message: 'fail', code: '42501' } })
            await expect(rejectSubmission('sub-1', 'Bad')).rejects.toThrow()
        })
    })

    describe('uploadSubmissionPhoto', () => {
        it('uploads file and returns public URL', async () => {
            mockUpload.mockResolvedValue({ error: null })
            mockGetPublicUrl.mockReturnValue({ data: { publicUrl: 'https://cdn.example.com/photo.jpg' } })
            const file = new File(['photo'], 'photo.jpg', { type: 'image/jpeg' })
            const result = await uploadSubmissionPhoto(file, 'user-1')
            expect(result).toBe('https://cdn.example.com/photo.jpg')
        })

        it('throws ApiError on upload failure', async () => {
            mockUpload.mockResolvedValue({ error: { message: 'bucket not found' } })
            const file = new File(['photo'], 'photo.jpg', { type: 'image/jpeg' })
            await expect(uploadSubmissionPhoto(file, 'user-1')).rejects.toThrow()
        })
    })
})
