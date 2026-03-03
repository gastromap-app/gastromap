import React from 'react'
import { BrowserRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import SmoothScroll from '@/components/ui/smooth-scroll'

const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            refetchOnWindowFocus: false,
            retry: 1,
        },
    },
})

export const AppProviders = ({ children, includeRouter = true }) => {
    const content = (
        <QueryClientProvider client={queryClient}>
            <SmoothScroll>
                {children}
            </SmoothScroll>
        </QueryClientProvider>
    )

    if (includeRouter) {
        return <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>{content}</BrowserRouter>
    }

    return content
}
