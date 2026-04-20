import { renderHook, act } from '@testing-library/react'

const mockChangeLanguage = vi.fn()
const mockI18nInstance = {
    language: 'en',
    options: { supportedLngs: ['en', 'ru', 'pl', 'ua'] },
    changeLanguage: mockChangeLanguage,
}

vi.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (key) => key,
        i18n: mockI18nInstance,
    }),
}))

vi.mock('@/i18n/config', () => ({
    changeLanguage: (...args) => mockChangeLanguage(...args),
}))

import { useI18n, useAppLanguage, useAdminLanguage } from './useI18n'

describe('useI18n', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mockI18nInstance.language = 'en'
    })

    it('returns the current language', () => {
        const { result } = renderHook(() => useI18n())
        expect(result.current.language).toBe('en')
    })

    it('returns the t function', () => {
        const { result } = renderHook(() => useI18n())
        expect(typeof result.current.t).toBe('function')
        expect(result.current.t('hello')).toBe('hello')
    })

    it('returns isAdminMode flag based on argument', () => {
        const { result: userResult } = renderHook(() => useI18n('common', false))
        expect(userResult.current.isAdminMode).toBe(false)

        const { result: adminResult } = renderHook(() => useI18n('admin', true))
        expect(adminResult.current.isAdminMode).toBe(true)
    })

    it('switches to Russian when isAdmin=true and current language is English', () => {
        mockI18nInstance.language = 'en'
        renderHook(() => useI18n('admin', true))
        expect(mockChangeLanguage).toHaveBeenCalledWith('ru')
    })

    it('switches to English when isAdmin=false and current language is Russian', () => {
        mockI18nInstance.language = 'ru'
        renderHook(() => useI18n('common', false))
        expect(mockChangeLanguage).toHaveBeenCalledWith('en')
    })

    it('does not switch language when already on the target language', () => {
        mockI18nInstance.language = 'en'
        renderHook(() => useI18n('common', false))
        // changeLanguage should NOT be called since we're already on 'en'
        expect(mockChangeLanguage).not.toHaveBeenCalled()
    })

    it('setLanguage calls changeLanguage with the given code', () => {
        const { result } = renderHook(() => useI18n())
        act(() => {
            result.current.setLanguage('pl')
        })
        expect(mockChangeLanguage).toHaveBeenCalledWith('pl')
    })

    it('setUserLanguage calls changeLanguage with "en"', () => {
        const { result } = renderHook(() => useI18n())
        act(() => {
            result.current.setUserLanguage()
        })
        expect(mockChangeLanguage).toHaveBeenCalledWith('en')
    })

    it('setAdminLanguage calls changeLanguage with "ru"', () => {
        const { result } = renderHook(() => useI18n())
        act(() => {
            result.current.setAdminLanguage()
        })
        expect(mockChangeLanguage).toHaveBeenCalledWith('ru')
    })

    it('getAvailableLanguages returns supported languages', () => {
        const { result } = renderHook(() => useI18n())
        expect(result.current.getAvailableLanguages()).toEqual(['en', 'ru', 'pl', 'ua'])
    })

    it('getAvailableLanguages falls back when supportedLngs missing', () => {
        mockI18nInstance.options = {}
        const { result } = renderHook(() => useI18n())
        expect(result.current.getAvailableLanguages()).toEqual(['en', 'ru', 'pl', 'ua'])
    })

    it('useAppLanguage calls useI18n with "features" namespace and isAdmin=false', () => {
        const { result } = renderHook(() => useAppLanguage())
        expect(result.current.isAdminMode).toBe(false)
    })

    it('useAdminLanguage calls useI18n with "admin" namespace and isAdmin=true', () => {
        const { result } = renderHook(() => useAdminLanguage())
        expect(result.current.isAdminMode).toBe(true)
    })
})
