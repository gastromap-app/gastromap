import React from 'react'
import { cn } from '@/lib/utils'

/**
 * AuroraBackground Component (Optimized)
 * Uses native CSS animations via Tailwind for GPU acceleration.
 * 
 * @param {string} theme - 'light' (Day/Sun) or 'dark' (Sunset/Night)
 * @param {React.ReactNode} children - Content to render on top
 * @param {React.ReactNode} className 
 */
const AuroraBackground = ({ theme = 'light', children, className }) => {
    const isLight = theme === 'light'
    const bgClass = isLight ? 'bg-[#f7f7fb]' : 'bg-[#06080a]'

    React.useEffect(() => {
        document.body.style.backgroundColor = isLight ? '#f7f7fb' : '#06080a'
    }, [isLight])

    return (
        <div className={cn(`relative w-full h-full min-h-dvh ${bgClass} transition-colors duration-1000`, className)}>
            {children}
        </div>
    )
}

export default AuroraBackground
