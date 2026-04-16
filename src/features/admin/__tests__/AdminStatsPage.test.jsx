import { describe, it, expect } from 'vitest'
import { screen } from '@testing-library/react'
import { renderWithProviders } from '@/test/helpers'
import AdminStatsPage from '../pages/AdminStatsPage'

describe('AdminStatsPage', () => {
    it('renders analytics page header', () => {
        renderWithProviders(<AdminStatsPage />)
        expect(screen.getByText(/Аналитика/i)).toBeInTheDocument()
    })

    it('renders period selector buttons', () => {
        renderWithProviders(<AdminStatsPage />)
        expect(screen.getByRole('button', { name: /7д/i })).toBeInTheDocument()
        expect(screen.getByRole('button', { name: /30д/i })).toBeInTheDocument()
        expect(screen.getByRole('button', { name: /90д/i })).toBeInTheDocument()
    })

    it('renders top locations section', () => {
        renderWithProviders(<AdminStatsPage />)
        expect(screen.getByText(/Топ локаций/i)).toBeInTheDocument()
    })
})
