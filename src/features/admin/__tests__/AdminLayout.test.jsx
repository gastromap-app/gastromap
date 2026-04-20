import { describe, it, expect } from 'vitest'
import { screen } from '@testing-library/react'
import { renderWithProviders } from '@/test/helpers'
import AdminLayout from '../layout/AdminLayout'

describe('AdminLayout', () => {
    it('renders sidebar navigation', () => {
        renderWithProviders(<AdminLayout />)
        // Sidebar and header both have <nav> elements
        const navs = screen.getAllByRole('navigation')
        expect(navs.length).toBeGreaterThanOrEqual(1)
    })

    it('renders admin panel brand', () => {
        renderWithProviders(<AdminLayout />)
        expect(screen.getByText(/GastroOS/i)).toBeInTheDocument()
    })

    it('renders overview nav item', () => {
        renderWithProviders(<AdminLayout />)
        expect(screen.getByText(/Overview/i)).toBeInTheDocument()
    })

    it('renders sign out button', () => {
        renderWithProviders(<AdminLayout />)
        expect(screen.getByRole('button', { name: /Sign Out/i })).toBeInTheDocument()
    })
})
