import React, { useRef, useState, useEffect } from 'react'
import { cn } from '@/lib/utils'
import { ImageOff } from 'lucide-react'

/**
 * LazyImage — IntersectionObserver-based lazy image loader.
 *
 * Shows an animated skeleton placeholder until the image enters the viewport,
 * then loads and fades it in. Displays a fallback icon on error.
 *
 * @param {string}  src        – image URL
 * @param {string}  alt        – alt text
 * @param {string}  className  – classes applied to the <img> element
 * @param {string}  wrapperClassName – classes applied to the wrapper div
 * @param {number}  rootMargin – px ahead-of-viewport to start loading (default 200px)
 */
export default function LazyImage({
    src,
    alt,
    className,
    wrapperClassName,
    rootMargin = '200px',
    ...rest
}) {
    const wrapperRef = useRef(null)
    const [isVisible, setIsVisible] = useState(false)
    const [isLoaded, setIsLoaded] = useState(false)
    const [hasError, setHasError] = useState(false)

    useEffect(() => {
        const el = wrapperRef.current
        if (!el) return

        const observer = new IntersectionObserver(
            ([entry]) => {
                if (entry.isIntersecting) {
                    setIsVisible(true)
                    observer.disconnect()
                }
            },
            { rootMargin }
        )

        observer.observe(el)
        return () => observer.disconnect()
    }, [rootMargin])

    return (
        <div ref={wrapperRef} className={cn('relative w-full h-full', wrapperClassName)}>
            {/* Skeleton shown while image hasn't loaded */}
            {!isLoaded && !hasError && (
                <div className="absolute inset-0 bg-slate-200 dark:bg-[hsl(220,20%,9%)] animate-pulse" />
            )}

            {/* Error fallback */}
            {hasError && (
                <div className="absolute inset-0 flex items-center justify-center bg-slate-100 dark:bg-[hsl(220,20%,9%)]/60">
                    <ImageOff className="text-slate-400 dark:text-[hsl(220,10%,55%)]" size={28} />
                </div>
            )}

            {/* Image — only rendered once in viewport */}
            {isVisible && !hasError && (
                <img
                    src={src}
                    alt={alt}
                    onLoad={() => setIsLoaded(true)}
                    onError={() => setHasError(true)}
                    className={cn(
                        'transition-opacity duration-300',
                        isLoaded ? 'opacity-100' : 'opacity-0',
                        className
                    )}
                    {...rest}
                />
            )}
        </div>
    )
}
