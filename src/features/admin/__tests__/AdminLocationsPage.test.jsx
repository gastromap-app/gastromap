import { describe, it, expect } from 'vitest'
import { screen } from '@testing-library/react'
import { renderWithProviders } from '@/test/helpers'
import AdminLocationsPage from '../pages/AdminLocationsPage'

describe('AdminLocationsPage', () => {
    it('renders locations page header', () => {
        renderWithProviders(<AdminLocationsPage />)
        expect(screen.getByRole('heading', { name: /Locations/i })).toBeInTheDocument()
    })

    it('renders primary actions', () => {
        renderWithProviders(<AdminLocationsPage />)
        expect(screen.getByRole('button', { name: /Новый/i })).toBeInTheDocument()
    })

    it('renders desktop import/export actions', () => {
        renderWithProviders(<AdminLocationsPage />)
        expect(screen.getByRole('button', { name: /Импорт/i })).toBeInTheDocument()
        expect(screen.getByRole('button', { name: /Экспорт/i })).toBeInTheDocument()
    })
})
