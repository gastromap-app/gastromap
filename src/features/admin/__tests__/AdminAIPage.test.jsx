import { describe, it, expect } from 'vitest'
import { screen } from '@testing-library/react'
import { renderWithProviders } from '@/test/helpers'

// Mock the AI API utils so useEffect validation doesn't fire real requests
vi.mock('@/shared/api/ai/utils', () => ({
    testAIConnection: vi.fn(() => Promise.resolve({ ok: true, text: 'pong', latency: 50, modelUsed: 'test' })),
}))

import AdminAIPage from '../pages/AdminAIPage'

describe('AdminAIPage', () => {
    it('renders AI Agents page header', () => {
        renderWithProviders(<AdminAIPage />)
        expect(screen.getByRole('heading', { name: /AI Agents/i })).toBeInTheDocument()
    })

    it('renders active agents section', () => {
        renderWithProviders(<AdminAIPage />)
        expect(screen.getByRole('heading', { level: 2, name: /Active Agents/i })).toBeInTheDocument()
        expect(screen.getAllByText(/GastroGuide/i).length).toBeGreaterThanOrEqual(1)
        expect(screen.getAllByText(/GastroAssistant/i).length).toBeGreaterThanOrEqual(1)
    })

    it('renders AI models section', () => {
        renderWithProviders(<AdminAIPage />)
        expect(screen.getByText(/AI Models \(OpenRouter Free\)/i)).toBeInTheDocument()
    })

    it('renders system prompts section', () => {
        renderWithProviders(<AdminAIPage />)
        // "System Prompts" appears as a section heading (h2)
        const promptsHeadings = screen.getAllByRole('heading', { level: 2 }).filter(h => /System Prompts/i.test(h.textContent))
        expect(promptsHeadings.length).toBeGreaterThanOrEqual(1)
    })

    it('renders save button', () => {
        renderWithProviders(<AdminAIPage />)
        expect(screen.getByRole('button', { name: /Save Settings/i })).toBeInTheDocument()
    })
})
