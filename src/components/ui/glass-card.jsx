import React from 'react'
import { cn } from '@/lib/utils'
import { motion, useReducedMotion } from 'framer-motion'

const GlassCard = React.forwardRef(({ className, children, hoverEffect = true, ...props }, ref) => {
    const shouldReduceMotion = useReducedMotion()
    const Component = props.onClick ? motion.div : 'div'

    // GPU-accelerated: layout prop delegates to compositor thread
    // useReducedMotion respects OS accessibility settings
    const hoverAnim = props.onClick && hoverEffect && !shouldReduceMotion
        ? { y: -4, scale: 1.01 }
        : {}

    return (
        <Component
            ref={ref}
            layout
            className={cn(
                "backdrop-blur-md border shadow-sm rounded-2xl relative overflow-hidden",
                // Light mode
                "bg-white/80 border-gray-200/50",
                // Dark mode
                "dark:bg-black/40 dark:border-white/10",
                hoverEffect && "hover:bg-white/90 dark:hover:bg-black/60 cursor-pointer hover:shadow-md",
                className
            )}
            whileHover={hoverAnim}
            whileTap={props.onClick ? { scale: 0.98 } : {}}
            transition={{
                type: "spring",
                stiffness: 500,
                damping: 30,
                mass: 0.8,
            }}
            {...props}
        >
            {/* Subtle shine — light mode only */}
            <div className="absolute inset-0 bg-gradient-to-br from-white/40 to-transparent opacity-0 hover:opacity-100 transition-opacity duration-200 pointer-events-none" />
            {children}
        </Component>
    )
})
GlassCard.displayName = "GlassCard"

export { GlassCard }
