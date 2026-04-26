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

    // Background base color — matches --background tokens from index.css
    const bgClass = isLight ? 'bg-[#f7f7fb]' : 'bg-[#06080a]'

    // Blob colors — muted on light so text stays readable, vivid on dark
    const blob1Class = isLight ? 'bg-blue-300' : 'bg-blue-600'
    const blob2Class = isLight ? 'bg-indigo-300' : 'bg-blue-500'
    const blob3Class = isLight ? 'bg-sky-200' : 'bg-cyan-600'

    // Fix: Sync body background with theme to prevent "white corners" on mobile overscroll
    React.useEffect(() => {
        document.body.style.backgroundColor = isLight ? '#f7f7fb' : '#06080a'
    }, [isLight])

    return (
        <div className={cn(`relative w-full h-full min-h-screen ${bgClass} transition-colors duration-1000`, className)}>
            {/* Ambient Background Blobs */}
            <div className="fixed inset-0 pointer-events-none transform-gpu overflow-hidden">
                {/* Blob 1 (Top Left) */}
                <div
                    className={cn(
                        "absolute top-[-20%] left-[-10%] w-[70%] h-[70%] rounded-full blur-[60px] md:blur-[100px] mix-blend-normal filter will-change-transform animate-aurora-1",
                        isLight ? "opacity-10 md:opacity-25" : "opacity-40 md:opacity-60",
                        blob1Class
                    )}
                />
                <div
                    className={cn(
                        "absolute top-[20%] right-[-10%] w-[60%] h-[60%] rounded-full blur-[60px] md:blur-[100px] mix-blend-normal filter will-change-transform animate-aurora-2 animation-delay-2000",
                        isLight ? "opacity-10 md:opacity-20" : "opacity-30 md:opacity-50",
                        blob2Class
                    )}
                />
                <div
                    className={cn(
                        "absolute bottom-[-10%] left-[10%] w-[80%] h-[50%] rounded-full blur-[80px] md:blur-[120px] mix-blend-normal filter will-change-transform animate-aurora-3 animation-delay-5000",
                        isLight ? "opacity-10 md:opacity-25" : "opacity-35 md:opacity-55",
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
