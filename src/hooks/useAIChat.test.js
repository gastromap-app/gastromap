import { renderHook, act } from '@testing-library/react'

// ─── Mock all dependencies ─────────────────────────────────────────────────

// AI Chat Store
const mockAddMessage = vi.fn()
const mockUpdateLastMessage = vi.fn()
const mockSetTyping = vi.fn()
const mockSetError = vi.fn()
const mockClearError = vi.fn()
const mockClearHistory = vi.fn()
const mockTrimHistory = vi.fn()

vi.mock('@/shared/hooks/useAIChatStore', () => ({
    useAIChatStore: () => ({
        messages: [],
        isTyping: false,
        error: null,
        addMessage: mockAddMessage,
        updateLastMessage: mockUpdateLastMessage,
        setTyping: mockSetTyping,
        setError: mockSetError,
        clearError: mockClearError,
        clearHistory: mockClearHistory,
        trimHistory: mockTrimHistory,
    }),
}))

// User Prefs Store
vi.mock('@/shared/store/useUserPrefsStore', () => ({
    useUserPrefsStore: () => ({
        prefs: {
            lastVisited: ['loc-1'],
            frequentSearches: ['pizza'],
            foodieDNA: 'Italian lover',
        },
    }),
}))

// Favorites Store
vi.mock('@/shared/store/useFavoritesStore', () => ({
    useFavoritesStore: () => ({
        favoriteIds: ['loc-2'],
    }),
}))

// Auth Store
vi.mock('@/shared/store/useAuthStore', () => ({
    useAuthStore: () => ({
        user: null,
    }),
}))

// Locations Store
vi.mock('@/shared/store/useLocationsStore', () => ({
    useLocationsStore: () => ({
        locations: [
            { id: 'loc-1', title: 'Pizza Place' },
            { id: 'loc-2', title: 'Sushi Bar' },
        ],
    }),
}))

// AI API
const mockAnalyzeQueryStream = vi.fn()
const mockAnalyzeQuery = vi.fn()
const mockGetActiveAIConfig = vi.fn()
vi.mock('@/shared/api', () => ({
    analyzeQueryStream: (...args) => mockAnalyzeQueryStream(...args),
    analyzeQuery: (...args) => mockAnalyzeQuery(...args),
    getActiveAIConfig: () => mockGetActiveAIConfig(),
}))

// Reviews API
vi.mock('@/shared/api/reviews.api', () => ({
    getUserReviews: vi.fn().mockResolvedValue([]),
}))

// Env config
vi.mock('@/shared/config/env', () => ({
    config: {
        ai: { useProxy: false },
        supabase: { isConfigured: false, url: '', anonKey: '' },
    },
}))

// Supabase client — prevent real initialization
vi.mock('@/shared/api/client', () => ({
    supabase: {
        from: vi.fn().mockReturnValue({ select: vi.fn().mockReturnValue({ data: [], error: null }) }),
        auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null } }) },
        functions: { invoke: vi.fn().mockResolvedValue({ data: null, error: null }) },
    },
}))

// App config
vi.mock('@/shared/config/appConfig', () => ({
    config: {
        supabase: { isConfigured: false, url: '', anonKey: '' },
        ai: { useProxy: false },
    },
}))

// Chat API
vi.mock('@/shared/api/chat.api', () => ({
    fetchChatHistory: vi.fn().mockResolvedValue([]),
    createChatSession: vi.fn().mockResolvedValue({ id: 'session-1' }),
    saveChatMessage: vi.fn().mockResolvedValue({}),
}))

// Summarize session
vi.mock('@/shared/api/ai/summarize-session', () => ({
    summarizeSession: vi.fn().mockResolvedValue('Summary'),
}))

// User geo hook
vi.mock('@/shared/hooks/useUserGeo', () => ({
    useUserGeo: () => ({ lat: 50.06, lng: 19.94, city: 'Krakow', country: 'Poland' }),
}))

// Safe console
vi.mock('@/shared/lib/safe-console.js', () => ({
    log: vi.fn(),
    warn: vi.fn(),
}))

// react-i18next
vi.mock('react-i18next', () => ({
    useTranslation: () => ({ t: (key) => key }),
}))

// Geo store
vi.mock('@/shared/store/useGeoStore', () => ({
    useGeoStore: () => ({ city: 'Krakow', country: 'Poland' }),
}))

// User API
vi.mock('@/shared/api/user.api', () => ({
    getUserLocationHistory: vi.fn().mockResolvedValue([]),
}))

import { useAIChat } from './useAIChat'

describe('useAIChat', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        // Default: no AI access → local engine path
        mockGetActiveAIConfig.mockReturnValue({
            apiKey: '',
            model: 'test-model',
            fallbackModel: 'test-fallback',
            isConfigured: false,
            useProxy: false,
        })
    })

    it('returns initial state', () => {
        const { result } = renderHook(() => useAIChat())
        expect(result.current.messages).toEqual([])
        expect(result.current.isTyping).toBe(false)
        expect(result.current.error).toBeNull()
        expect(result.current.isStreaming).toBe(false)
        expect(typeof result.current.sendMessage).toBe('function')
        expect(typeof result.current.clearHistory).toBe('function')
    })

    it('does nothing when sending empty text', async () => {
        const { result } = renderHook(() => useAIChat())
        await act(async () => {
            await result.current.sendMessage('')
        })
        expect(mockAddMessage).not.toHaveBeenCalled()
    })

    it('does nothing when sending whitespace-only text', async () => {
        const { result } = renderHook(() => useAIChat())
        await act(async () => {
            await result.current.sendMessage('   ')
        })
        expect(mockAddMessage).not.toHaveBeenCalled()
    })

    // TODO: The following tests need to be updated to match the refactored useAIChat hook
    // which now includes session management, geo context, and different message flow.
})
