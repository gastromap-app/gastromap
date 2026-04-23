import { describe, it, expect } from 'vitest'
import { screen } from '@testing-library/react'
import { renderWithProviders } from '@/test/helpers'
import AdminSubscriptionsPage from '../pages/AdminSubscriptionsPage'

describe('AdminSubscriptionsPage', () => {
    it('renders Donations page header after loading', async () => {
        renderWithProviders(<AdminSubscriptionsPage />)
        // Component shows loading state first, then header appears
        const header = await screen.findByRole('heading', { name: /Donations/i }, { timeout: 5000 })
        expect(header).toBeInTheDocument()
    })

    it('renders donation plans after loading', async () => {
        renderWithProviders(<AdminSubscriptionsPage />)
        await screen.findByRole('heading', { name: /Donations/i }, { timeout: 5000 })
        // Default plans: Coffee, Supporter, Champion — appear as h3 headings in plan cards
        const planNames = screen.getAllByRole('heading', { level: 3 }).map(h => h.textContent)
        expect(planNames).toContain('Coffee')
        expect(planNames).toContain('Supporter')
        expect(planNames).toContain('Champion')
    })

    it('renders export CSV button', async () => {
        renderWithProviders(<AdminSubscriptionsPage />)
        await screen.findByRole('heading', { name: /Donations/i }, { timeout: 5000 })
        expect(screen.getByRole('button', { name: /Export CSV/i })).toBeInTheDocument()
    })
})
