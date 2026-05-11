import { describe, it, expect, vi } from 'vitest'
import { screen } from '@testing-library/react'
import { renderWithProviders } from '@/test/helpers'
import LocationFormSlideOver from '../components/LocationFormSlideOver'
import i18n from '@/i18n/config'

// Mock useLocationsStore or other dependencies if needed
// For now, we just want to see if the translation is used correctly

describe('LocationFormSlideOver Localization', () => {
    const defaultProps = {
        open: true,
        onClose: () => {},
        location: null,
        onSuccess: () => {}
    }

    it('displays the localized label for "Hidden Gem"', async () => {
        // Render in English
        await i18n.changeLanguage('en')
        renderWithProviders(<LocationFormSlideOver {...defaultProps} />)
        
        // Find the "Hidden Gem" button
        // Note: The button text should be "Hidden Gem" in EN
        const button = screen.getByText('Hidden Gem')
        expect(button).toBeInTheDocument()

        // Switch to Polish
        // We need to allow PL in i18n config first, or mock it
        // For this test, let's assume i18n.t will return what's in the json
    })
})
