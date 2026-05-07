import { describe, it, expect } from 'vitest'
import { screen } from '@testing-library/react'
import { renderWithProviders } from '@/test/helpers'
import AdminStatsPage from '../pages/AdminStatsPage'

describe('AdminStatsPage', () => {
    it('renders analytics page header', () => {
        renderWithProviders(<AdminStatsPage />)
        expect(screen.getByText(/analytics/i)).toBeInTheDocument()
    })

    it('renders without errors', () => {
        const { container } = renderWithProviders(<AdminStatsPage />)
        expect(container.querySelector('.space-y-6')).toBeInTheDocument()
    })
})
