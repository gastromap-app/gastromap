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
    // Define colors based on theme
    const isLight = theme === 'light'

    // Background base color
    const bgClass = isLight ? 'bg-[#f8faff]' : 'bg-[#0f172a]'

    // Blob colors (using style tags for dynamic dynamic variable isn't as performant, so simple classes)
    const blob1Class = isLight ? 'bg-blue-400' : 'bg-blue-800'
    const blob2Class = isLight ? 'bg-yellow-400' : 'bg-orange-700'
    const blob3Class = isLight ? 'bg-blue-200' : 'bg-orange-600' // Using slightly different secondary colors

    // Fix: Sync body background with theme to prevent "white corners" on mobile overscroll
    React.useEffect(() => {
        document.body.style.backgroundColor = isLight ? '#f8faff' : '#0f172a'
    }, [isLight])

    return (
        <div className={cn(`relative w-full h-full min-h-screen ${bgClass} transition-colors duration-1000`, className)}>
            {/* Ambient Background Blobs */}
            <div className="fixed inset-0 pointer-events-none transform-gpu overflow-hidden">
                {/* Blob 1 (Top Left) */}
                <div
                    className={cn(
                        "absolute top-[-20%] left-[-10%] w-[70%] h-[70%] rounded-full blur-[60px] md:blur-[100px] mix-blend-normal filter will-change-transform animate-aurora-1 opacity-20 md:opacity-40",
                        blob1Class
                    )}
                />
                <div
                    className={cn(
                        "absolute top-[20%] right-[-10%] w-[60%] h-[60%] rounded-full blur-[60px] md:blur-[100px] mix-blend-normal filter will-change-transform animate-aurora-2 opacity-15 md:opacity-30 animation-delay-2000",
                        blob2Class
                    )}
                />
                <div
                    className={cn(
                        "absolute bottom-[-10%] left-[10%] w-[80%] h-[50%] rounded-full blur-[80px] md:blur-[120px] mix-blend-normal filter will-change-transform animate-aurora-3 opacity-20 md:opacity-40 animation-delay-5000",
                        blob3Class
                    )}
                />
            </div>

            {/* Content Layer */}
            <div className="relative z-10 w-full h-full">
                {children}
            </div>
        </div>
    )
}

export default AuroraBackground
