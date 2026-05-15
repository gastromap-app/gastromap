import React from 'react'
import { cn } from '@/lib/utils'

/**
 * AuroraBackground — Simple gradient background.
 * Light: olive-green to white gradient.
 * Dark: adapted dark variant.
 */
const AuroraBackground = ({ theme = 'light', children, className }) => {
    const isDark = theme === 'dark'

    const bgStyle = isDark
        ? { background: 'linear-gradient(to bottom, #0d1117 0%, #1c3a4f 100%)' }
        : { background: 'linear-gradient(to bottom, #f1f1f1 0%, #4d98bd 100%)' }

    return (
        <div
            className={cn('relative w-full h-full min-h-dvh', className)}
            style={bgStyle}
        >
            {children}
        </div>
    )
}

export default AuroraBackground
