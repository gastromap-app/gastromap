import { describe, it, expect } from 'vitest'
import { screen } from '@testing-library/react'
import { renderWithProviders } from '@/test/helpers'
import AdminDashboardPage from '../pages/AdminDashboardPage'

describe('AdminDashboardPage', () => {
    it('renders dashboard page header', () => {
        renderWithProviders(<AdminDashboardPage />)
        expect(screen.getByRole('heading', { name: /Панель управления/i })).toBeInTheDocument()
    })

    it('renders analytics section', () => {
        renderWithProviders(<AdminDashboardPage />)
        expect(screen.getByText(/Аналитика/i)).toBeInTheDocument()
    })

    it('renders recent activity section', () => {
        renderWithProviders(<AdminDashboardPage />)
        expect(screen.getByText(/Последние действия/i)).toBeInTheDocument()
    })

    it('renders create button', () => {
        renderWithProviders(<AdminDashboardPage />)
        expect(screen.getByRole('button', { name: /Создать/i })).toBeInTheDocument()
    })
})
