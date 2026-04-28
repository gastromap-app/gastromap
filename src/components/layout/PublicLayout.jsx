import React from 'react'
import { Outlet } from 'react-router-dom'
import PublicNavbar from './public/PublicNavbar'
import PublicFooter from './public/PublicFooter'

const PublicLayout = () => {
    return (
        <div className="min-h-screen bg-gray-50 dark:bg-glow font-sans selection:bg-blue-100 selection:text-blue-900 dark:selection:bg-blue-900/30 dark:selection:text-blue-200 flex flex-col">
            <PublicNavbar />
            <main className="flex-grow">
                <Outlet />
            </main>
            <PublicFooter />
        </div>
    )
}

export default PublicLayout
