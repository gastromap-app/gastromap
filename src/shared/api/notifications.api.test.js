import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
    NOTIFICATION_TYPES,
    sendNotificationToUser,
    getNotificationHistory,
    markNotificationRead,
    markAllNotificationsRead,
    getUnreadCount,
    getPermissionStatus,
    isSupported,
} from './notifications.api'

// ─── Supabase mock (thenable chainable) ─────────────────────────────────────

const mockGetUser = vi.fn()

/** Create a thenable chain that supports `await chain` and method chaining */
function createChain(resolveWith = { data: [], error: null }) {
    const chain = {}
    const methods = ['insert', 'select', 'update', 'delete', 'eq', 'order', 'limit', 'single']
    methods.forEach(m => {
        chain[m] = vi.fn().mockReturnValue(chain)
    })
    // Make chain thenable so `await chain` works
    chain.then = (resolve) => resolve(resolveWith)
    return chain
}

let _chain = createChain()

vi.mock('./client', () => ({
    supabase: {
        from: vi.fn(() => _chain),
        auth: { getUser: () => mockGetUser() },
    },
}))

describe('notifications.api', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mockGetUser.mockResolvedValue({ data: { user: { id: 'current-user-id' } } })
        // Reset chain for each test
        _chain = createChain()
    })

    // ─── NOTIFICATION_TYPES ──────────────────────────────────────────────

    describe('NOTIFICATION_TYPES', () => {
        it('has LOCATION_APPROVED type', () => {
            expect(NOTIFICATION_TYPES.LOCATION_APPROVED).toBeDefined()
            expect(NOTIFICATION_TYPES.LOCATION_APPROVED.id).toBe('location_approved')
        })

        it('has LOCATION_REJECTED type', () => {
            expect(NOTIFICATION_TYPES.LOCATION_REJECTED).toBeDefined()
            expect(NOTIFICATION_TYPES.LOCATION_REJECTED.id).toBe('location_rejected')
        })

        it('has MODERATION_PENDING type with adminOnly flag', () => {
            expect(NOTIFICATION_TYPES.MODERATION_PENDING.adminOnly).toBe(true)
        })
    })

    // ─── sendNotificationToUser ──────────────────────────────────────────

    describe('sendNotificationToUser', () => {
        it('inserts notification for a specific user', async () => {
            _chain = createChain({ error: null })
            const result = await sendNotificationToUser({
                userId: 'user-123',
                type: 'location_approved',
                title: 'Location approved!',
                body: 'Your location "Test" has been approved.',
            })
            expect(result).toBe(true)
            expect(_chain.insert).toHaveBeenCalledWith(expect.objectContaining({
                user_id: 'user-123',
                type: 'location_approved',
                title: 'Location approved!',
                body: 'Your location "Test" has been approved.',
                read: false,
            }))
        })

        it('passes data field when provided', async () => {
            _chain = createChain({ error: null })
            await sendNotificationToUser({
                userId: 'user-456',
                type: 'location_rejected',
                title: 'Rejected',
                body: 'Reason: spam',
                data: { reason: 'spam' },
            })
            expect(_chain.insert).toHaveBeenCalledWith(expect.objectContaining({
                data: { reason: 'spam' },
            }))
        })

        it('defaults data to empty object', async () => {
            _chain = createChain({ error: null })
            await sendNotificationToUser({
                userId: 'user-789',
                type: 'new_feature',
                title: 'New!',
                body: 'Check it out',
            })
            expect(_chain.insert).toHaveBeenCalledWith(expect.objectContaining({
                data: {},
            }))
        })

        it('returns false on insert error without throwing', async () => {
            _chain = createChain({ error: { message: 'table not found', code: '42P01' } })
            const result = await sendNotificationToUser({
                userId: 'user-1',
                type: 'test',
                title: 'T',
                body: 'B',
            })
            expect(result).toBe(false)
        })

        it('returns false on unexpected error', async () => {
            // Make insert throw
            const brokenChain = createChain()
            brokenChain.insert = vi.fn().mockImplementation(() => { throw new Error('network') })
            _chain = brokenChain
            const result = await sendNotificationToUser({
                userId: 'user-1',
                type: 'test',
                title: 'T',
                body: 'B',
            })
            expect(result).toBe(false)
        })
    })

    // ─── getNotificationHistory ──────────────────────────────────────────

    describe('getNotificationHistory', () => {
        it('returns user notifications ordered by date', async () => {
            const mockData = [
                { id: 'n1', user_id: 'current-user-id', title: 'First', read: false },
                { id: 'n2', user_id: 'current-user-id', title: 'Second', read: true },
            ]
            _chain = createChain({ data: mockData, error: null })
            const result = await getNotificationHistory(20, false)
            expect(result).toEqual(mockData)
        })

        it('filters unread only when flag is set', async () => {
            const mockData = [{ id: 'n1', read: false }]
            _chain = createChain({ data: mockData, error: null })
            const result = await getNotificationHistory(10, true)
            expect(result).toEqual(mockData)
            // eq was called with 'read', false for unread filter
            expect(_chain.eq).toHaveBeenCalledWith('read', false)
        })

        it('returns empty array when user is not authenticated', async () => {
            mockGetUser.mockResolvedValue({ data: { user: null } })
            const result = await getNotificationHistory()
            expect(result).toEqual([])
        })

        it('returns empty array on query error', async () => {
            _chain = createChain({ data: null, error: { message: 'fail' } })
            const result = await getNotificationHistory()
            expect(result).toEqual([])
        })
    })

    // ─── markNotificationRead ────────────────────────────────────────────

    describe('markNotificationRead', () => {
        it('marks a notification as read', async () => {
            _chain = createChain({ error: null })
            const result = await markNotificationRead('notif-1')
            expect(result).toBe(true)
            expect(_chain.update).toHaveBeenCalledWith({ read: true })
        })

        it('returns false on error', async () => {
            _chain = createChain({ error: { message: 'not found' } })
            const result = await markNotificationRead('nonexistent')
            expect(result).toBe(false)
        })
    })

    // ─── markAllNotificationsRead ────────────────────────────────────────

    describe('markAllNotificationsRead', () => {
        it('marks all notifications as read for current user', async () => {
            _chain = createChain({ error: null })
            const result = await markAllNotificationsRead()
            expect(result).toBe(true)
            // Should filter by user_id and read=false
            expect(_chain.eq).toHaveBeenCalledWith('user_id', 'current-user-id')
            expect(_chain.eq).toHaveBeenCalledWith('read', false)
        })

        it('returns false when user is not authenticated', async () => {
            mockGetUser.mockResolvedValue({ data: { user: null } })
            const result = await markAllNotificationsRead()
            expect(result).toBe(false)
        })

        it('returns false on error', async () => {
            _chain = createChain({ error: { message: 'fail' } })
            const result = await markAllNotificationsRead()
            expect(result).toBe(false)
        })
    })

    // ─── getUnreadCount ──────────────────────────────────────────────────

    describe('getUnreadCount', () => {
        it('returns unread notification count', async () => {
            _chain = createChain({ count: 5, error: null })
            const result = await getUnreadCount()
            expect(result).toBe(5)
        })

        it('returns 0 when user is not authenticated', async () => {
            mockGetUser.mockResolvedValue({ data: { user: null } })
            const result = await getUnreadCount()
            expect(result).toBe(0)
        })

        it('returns 0 on error', async () => {
            _chain = createChain({ count: null, error: { message: 'fail' } })
            const result = await getUnreadCount()
            expect(result).toBe(0)
        })
    })

    // ─── getPermissionStatus / isSupported ───────────────────────────────

    describe('getPermissionStatus', () => {
        it('returns granted when Notification is available and permission is granted', () => {
            vi.stubGlobal('Notification', { permission: 'granted' })
            expect(getPermissionStatus()).toBe('granted')
        })

        it('returns unsupported when Notification is not available', () => {
            vi.stubGlobal('Notification', undefined)
            expect(getPermissionStatus()).toBe('unsupported')
        })
    })

    describe('isSupported', () => {
        it('returns true when Notification is available', () => {
            vi.stubGlobal('Notification', { permission: 'granted' })
            expect(isSupported()).toBe(true)
        })

        it('returns false when Notification is not available', () => {
            vi.stubGlobal('Notification', undefined)
            expect(isSupported()).toBe(false)
        })
    })
})
