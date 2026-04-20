import { describe, it, expect } from 'vitest'
import { screen } from '@testing-library/react'
import { renderWithProviders } from '@/test/helpers'
import AdminUsersPage from '../pages/AdminUsersPage'

describe('AdminUsersPage', () => {
    it('renders Users page header', () => {
        renderWithProviders(<AdminUsersPage />)
        expect(screen.getByRole('heading', { name: /Users/i })).toBeInTheDocument()
    })

    it('renders user stats section', () => {
        renderWithProviders(<AdminUsersPage />)
        expect(screen.getByText(/Total Users/i)).toBeInTheDocument()
    })

    it('renders search input', () => {
        renderWithProviders(<AdminUsersPage />)
        expect(screen.getByLabelText(/Search users/i)).toBeInTheDocument()
    })

    it('renders filters button', () => {
        renderWithProviders(<AdminUsersPage />)
        expect(screen.getByRole('button', { name: /Filters/i })).toBeInTheDocument()
    })
})
