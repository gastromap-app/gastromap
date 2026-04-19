import React from 'react'
import { Heart } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * Shared heart-toggle button for location cards.
 *
 * Always renders a 44×44 hit-area (Apple HIG / WCAG touch target),
 * while the visible glyph scales via `size` (default 20). Callers pass
 * their own `isFavorite` / `onToggle` because the source of truth
 * varies (local store, hybrid local+DB, etc.).
 *
 * @param {object}   props
 * @param {boolean}  props.isFavorite  Current saved state
 * @param {Function} props.onToggle    Called with no args; caller handles id
 * @param {number}   [props.size=20]   Heart icon size in px
 * @param {string}   [props.variant]   'bare' | 'chip'  (chip adds bg + blur)
 * @param {string}   [props.className] Extra classes on the outer button
 */
export default function FavoriteButton({
    isFavorite,
    onToggle,
    size = 20,
    variant = 'bare',
    className,
}) {
    const chip = variant === 'chip'
    return (
        <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onToggle() }}
            aria-label={isFavorite ? 'Remove from saved' : 'Save place'}
            aria-pressed={isFavorite}
            className={cn(
                'w-11 h-11 flex items-center justify-center active:scale-90 transition-transform shrink-0',
                chip && 'rounded-full bg-background/80 backdrop-blur-sm hover:bg-background/90',
                !chip && '-m-2',
                className,
            )}
        >
            <Heart
                size={size}
                className={cn(
                    isFavorite
                        ? 'text-red-500 fill-red-500'
                        : 'text-gray-300 stroke-[2.2]',
                )}
            />
        </button>
    )
}
