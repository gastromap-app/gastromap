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
export function LazyImage({
    src,
    alt,
    className,
    wrapperClassName,
    rootMargin = '200px',
    transform = { width: 800, quality: 80 }, // Default transformations
    ...rest
}) {
    const wrapperRef = useRef(null)
    const [isVisible, setIsVisible] = useState(false)
    const [isLoaded, setIsLoaded] = useState(false)
    const [hasError, setHasError] = useState(false)

    // Helper to apply transformations
    const getOptimizedSrc = (originalSrc) => {
        if (!originalSrc || typeof originalSrc !== 'string' || originalSrc.trim() === '') return null
        
        const cleanSrc = originalSrc.trim()
        
        // 1. Google Photos CDN
        if (cleanSrc.includes('lh3.googleusercontent.com')) {
            return cleanSrc.replace(/=w\d+.*$/, '') + `=w${transform.width || 800}-h${transform.height || ''}-k-no`
        }

        // 2. Supabase Storage Transformation (if enabled on the bucket)
        // Check if it's a supabase storage URL
        if (cleanSrc.includes('.supabase.co/storage/v1/object/public/')) {
            const baseUrl = cleanSrc.split('?')[0]
            const params = new URLSearchParams()
            if (transform.width) params.set('width', transform.width)
            if (transform.height) params.set('height', transform.height)
            if (transform.quality) params.set('quality', transform.quality)
            if (transform.resize) params.set('resize', transform.resize)
            else params.set('resize', 'cover')
            
            return `${baseUrl}?${params.toString()}`
        }

        return cleanSrc
    }

    const optimizedSrc = getOptimizedSrc(src)

    useEffect(() => {
        if (!src) {
            // eslint-disable-next-line react-hooks/set-state-in-effect
            setHasError(true)
            return
        }

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
    }, [rootMargin, src])

    return (
        <div ref={wrapperRef} className={cn('relative w-full h-full overflow-hidden', wrapperClassName)}>
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

            {/* Image — only rendered once in viewport and if src is valid */}
            {isVisible && !hasError && typeof optimizedSrc === 'string' && optimizedSrc.length > 0 && (
                <img
                    src={optimizedSrc || null}
                    alt={alt}
                    onLoad={() => setIsLoaded(true)}
                    onError={() => setHasError(true)}
                    className={cn(
                        'transition-all duration-500 ease-out',
                        isLoaded ? 'opacity-100 scale-100' : 'opacity-0 scale-105',
                        className
                    )}
                    {...rest}
                />
            )}
        </div>
    )
}

export default LazyImage
