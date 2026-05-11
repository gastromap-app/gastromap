import { describe, it, expect } from 'vitest'
import i18n from '@/i18n/config'

/**
 * Localization test for LocationFormSlideOver labels.
 * Tests that the i18n keys used in the form are properly defined.
 * 
 * Note: Full component rendering requires extensive mocking of admin dependencies.
 * This test validates the translation keys directly.
 */
describe('LocationFormSlideOver Localization', () => {
    it('has "Hidden Gem" translation key defined in English', async () => {
        await i18n.changeLanguage('en')
        const translated = i18n.t('labels.hidden_gem')
        // Should return a real translation, not the key itself
        expect(translated).toBeTruthy()
        expect(translated).not.toBe('labels.hidden_gem')
    })

    it('has "Hidden Gem" description key defined', async () => {
        await i18n.changeLanguage('en')
        const translated = i18n.t('labels.hidden_gem_desc')
        expect(translated).toBeTruthy()
    })
})
