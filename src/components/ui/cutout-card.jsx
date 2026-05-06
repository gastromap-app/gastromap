import React from 'react'
import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'
import LazyImage from '@/components/ui/LazyImage'

// ============================================================================
// Surface — root container with rounded corners and overflow
// ============================================================================
export function CutoutCard({ className, children, as: Tag = 'div', ...props }) {
    return (
        <Tag
            className={cn(
                'relative overflow-hidden rounded-[20px]',
                'bg-white dark:bg-[hsl(220,20%,9%)]',
                'shadow-[0_4px_24px_rgba(0,0,0,0.08)] dark:shadow-[0_4px_24px_rgba(0,0,0,0.3)]',
                'ring-1 ring-black/[0.06] dark:ring-white/[0.08]',
                className
            )}
            {...props}
        >
            {children}
        </Tag>
    )
}

// ============================================================================
// Media — image container
// ============================================================================
export function CutoutCardMedia({ className, children }) {
    return (
        <div className={cn('relative overflow-hidden', className)}>
            {children}
        </div>
    )
}

// ============================================================================
// Image — wraps the actual image (uses LazyImage internally)
// ============================================================================
export function CutoutCardImage({ src, alt, className, wrapperClassName, ...props }) {
    return (
        <div className={cn('absolute inset-0', wrapperClassName)}>
            <LazyImage
                src={src}
                alt={alt}
                className={cn('w-full h-full object-cover', className)}
                wrapperClassName="w-full h-full"
                {...props}
            />
        </div>
    )
}

// ============================================================================
// Overlay — gradient fade over the media
// ============================================================================
export function CutoutCardOverlay({ className }) {
    return (
        <div
            className={cn(
                'absolute inset-0',
                'bg-gradient-to-t from-black/70 via-black/20 to-transparent',
                className
            )}
        />
    )
}

// ============================================================================
// Corner — the masked "bite" SVG that creates the cutout effect
// ============================================================================
export function CutoutCorner({ className, size = 32 }) {
    return (
        <svg
            width={size}
            height={size}
            viewBox={`0 0 ${size} ${size}`}
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className={className}
        >
            {/* Quarter-circle bite: fills top-left, curves out at bottom-right */}
            <path
                d={`M0 0 H${size} A ${size} ${size} 0 0 0 0 ${size} Z`}
                fill="currentColor"
            />
        </svg>
    )
}

// ============================================================================
// InsetLabel — floating label anchored to an edge of the media area
// ============================================================================
export function CutoutCardInsetLabel({ className, children }) {
    return (
        <div className={cn('absolute z-10', className)}>
            {children}
        </div>
    )
}

// ============================================================================
// Pin — badge anchored to a corner of the media area
// ============================================================================
export function CutoutCardPin({ className, children }) {
    return (
        <div className={cn('absolute z-10', className)}>
            {children}
        </div>
    )
}

// ============================================================================
// Content — body section below media
// ============================================================================
export function CutoutCardContent({ className, children }) {
    return (
        <div className={cn('p-5', className)}>
            {children}
        </div>
    )
}

// ============================================================================
// Footer — bottom section inside content
// ============================================================================
export function CutoutCardFooter({ className, children }) {
    return (
        <div className={cn('flex items-center justify-between pt-4 border-t border-black/[0.06] dark:border-white/[0.08]', className)}>
            {children}
        </div>
    )
}

// ============================================================================
// Action — floating action button (absolute positioned)
// ============================================================================
export function CutoutCardAction({ className, children }) {
    return (
        <div className={cn('absolute z-10', className)}>
            {children}
        </div>
    )
}

// ============================================================================
// Preset surface className (mirrors the cult-ui pattern)
// ============================================================================
export const cutoutCardSurfaceClassName = cn(
    'bg-white dark:bg-[hsl(220,20%,9%)]',
    'ring-1 ring-black/[0.06] dark:ring-white/[0.08]',
    'shadow-[0_4px_24px_rgba(0,0,0,0.08)] dark:shadow-[0_4px_24px_rgba(0,0,0,0.3)]'
)

// ============================================================================
// Stagger animation variants for content
// ============================================================================
export function useCutoutContentStaggerVariants() {
    return {
        container: {
            hidden: { opacity: 0 },
            show: {
                opacity: 1,
                transition: { staggerChildren: 0.08, delayChildren: 0.12 },
            },
        },
        item: {
            hidden: { opacity: 0, y: 12 },
            show: {
                opacity: 1,
                y: 0,
                transition: { type: 'spring', stiffness: 300, damping: 24 },
            },
        },
    }
}
