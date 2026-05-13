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

    React.useEffect(() => {
        document.body.style.backgroundColor = isLight ? '#f7f7fb' : '#06080a'
    }, [isLight])

    // Ambient gradient applied as background-image — no extra DOM layers,
    // no fixed positioning, no overflow-hidden, no transform-gpu.
    const bgStyle = isLight
        ? {
            backgroundColor: '#f7f7fb',
            backgroundImage: `
                radial-gradient(ellipse 80% 60% at 20% 40%, rgba(147,197,253,0.15), transparent),
                radial-gradient(ellipse 60% 50% at 80% 20%, rgba(165,180,252,0.12), transparent),
                radial-gradient(ellipse 70% 50% at 50% 90%, rgba(186,230,253,0.1), transparent)
            `,
            backgroundAttachment: 'fixed',
        }
        : {
            backgroundColor: '#06080a',
            backgroundImage: `
                radial-gradient(ellipse 80% 50% at 20% 40%, rgba(37,99,235,0.08), transparent),
                radial-gradient(ellipse 60% 40% at 80% 10%, rgba(59,130,246,0.06), transparent),
                radial-gradient(ellipse 70% 50% at 50% 100%, rgba(29,78,216,0.05), transparent)
            `,
            backgroundAttachment: 'fixed',
        }

    return (
        <div
            className={cn('relative w-full h-full min-h-dvh transition-colors duration-1000', className)}
            style={bgStyle}
        >
            {children}
        </div>
    )
}

export default AuroraBackground
