import React from 'react'
import { cn } from '@/lib/utils'
import { motion } from 'framer-motion'

const GlassCard = React.forwardRef(({ className, children, hoverEffect = true, ...props }, ref) => {
    const Component = props.onClick ? motion.div : 'div'

    return (
        <Component
            ref={ref}
            className={cn(
                "backdrop-blur-md border shadow-sm rounded-2xl relative overflow-hidden transition-all duration-200",
                // Light mode: white background with good contrast
                "bg-white/80 border-gray-200/50",
                // Dark mode: darker background
                "dark:bg-black/40 dark:border-white/10",
                hoverEffect && "hover:bg-white/90 dark:hover:bg-black/60 cursor-pointer hover:shadow-md",
                className
            )}
            whileHover={props.onClick && hoverEffect ? { y: -4 } : {}}
            transition={{ type: "spring", stiffness: 400, damping: 25 }}
            {...props}
        >
            {/* Subtle shine for light mode */}
            <div className="absolute inset-0 bg-gradient-to-br from-white/40 to-transparent opacity-0 hover:opacity-100 transition-opacity duration-200 pointer-events-none" />

            {children}
        </Component>
    )
})
GlassCard.displayName = "GlassCard"

export { GlassCard }
