import React, { useRef, useState, useEffect } from 'react'
import { cn } from '@/lib/utils'
import { ImageOff } from 'lucide-react'

const ALLOWED_IMAGE_DOMAINS = [
    'lh3.googleusercontent.com',
    'lh5.googleusercontent.com',
    'maps.googleapis.com',
    '.supabase.co',
    'images.unsplash.com',
    'cloudflare-ipfs.com',
]

function isAllowedImageDomain(url) {
    try {
        const parsed = new URL(url)
        return ALLOWED_IMAGE_DOMAINS.some(domain =>
            domain.startsWith('.') ? parsed.hostname.endsWith(domain) : parsed.hostname === domain
        )
    } catch { return false }
}

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
    transform = { width: 800, quality: 80, format: 'webp' }, // Default: WebP ~25-35% smaller than JPEG
    priority = false,
    sizes = null, // Responsive sizes hint, e.g. "(max-width: 768px) 50vw, 25vw"
    ...rest
}) {
    const wrapperRef = useRef(null)
    // Start visible immediately if priority is set (LCP images)
    const [isVisible, setIsVisible] = useState(priority)
    const [isLoaded, setIsLoaded] = useState(false)
    const [hasError, setHasError] = useState(false)
    // useOriginal: true = second chance with the raw src (no transform params)
    const [useOriginal, setUseOriginal] = useState(false)

    // Helper to apply transformations
    const getOptimizedSrc = (originalSrc) => {
        if (!originalSrc || typeof originalSrc !== 'string' || originalSrc.trim() === '') return null
        
        const cleanSrc = originalSrc.trim()

        // Allow data: URLs and relative paths
        if (cleanSrc.startsWith('data:') || cleanSrc.startsWith('/')) return cleanSrc
        // Validate external URLs — pass through unknown domains without optimization
        if (cleanSrc.startsWith('http') && !isAllowedImageDomain(cleanSrc)) return cleanSrc
        
        // 1. Google Photos CDN
        if (cleanSrc.includes('lh3.googleusercontent.com')) {
            return cleanSrc.replace(/=w\d+.*$/, '') + `=w${transform.width || 800}-h${transform.height || ''}-k-no`
        }

        // 2. Supabase Storage Transformation (if enabled on the bucket)
        // WebP format saves ~25-35% vs JPEG without visible quality loss
        if (cleanSrc.includes('.supabase.co/storage/v1/object/public/')) {
            const baseUrl = cleanSrc.split('?')[0]
            const params = new URLSearchParams()
            if (transform.width) params.set('width', String(transform.width))
            if (transform.height) params.set('height', String(transform.height))
            if (transform.quality) params.set('quality', String(transform.quality))
            if (transform.format) params.set('format', transform.format)
            if (transform.resize) params.set('resize', transform.resize)
            else params.set('resize', 'cover')

            return `${baseUrl}?${params.toString()}`
        }

        return cleanSrc
    }

    const rawSrc = src?.trim() || null
    const optimizedSrc = useOriginal ? rawSrc : getOptimizedSrc(src)

    // If optimized === raw (no transformation was applied), skip the fallback attempt
    const canFallbackToOriginal = !useOriginal && optimizedSrc !== rawSrc

    // Generate responsive srcSet for supported CDNs
    const srcSet = (() => {
        if (useOriginal || !rawSrc || !sizes) return undefined
        const cleanSrc = rawSrc.trim()

        // Supabase Storage — generate multiple widths
        if (cleanSrc.includes('.supabase.co/storage/v1/object/public/')) {
            const baseUrl = cleanSrc.split('?')[0]
            const widths = [400, 600, 800, 1200]
            return widths.map(w => {
                const params = new URLSearchParams()
                params.set('width', String(w))
                if (transform.quality) params.set('quality', String(transform.quality))
                if (transform.format) params.set('format', transform.format)
                params.set('resize', 'cover')
                return `${baseUrl}?${params.toString()} ${w}w`
            }).join(', ')
        }

        // Google Photos CDN — generate multiple widths
        if (cleanSrc.includes('lh3.googleusercontent.com')) {
            const base = cleanSrc.replace(/=w\d+.*$/, '')
            const widths = [400, 600, 800, 1200]
            return widths.map(w => `${base}=w${w}-k-no ${w}w`).join(', ')
        }

        return undefined
    })()

    useEffect(() => {
        if (!src) {
            // eslint-disable-next-line react-hooks/set-state-in-effect
            setHasError(true)
            return
        }

        if (priority) return
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
    }, [rootMargin, src, priority])

    // Reset state when src changes
    useEffect(() => {
        setIsLoaded(false)
        setHasError(false)
        setUseOriginal(false)
    }, [src])

    function handleError() {
        if (canFallbackToOriginal) {
            // First failure: retry with the original URL (no transform params)
            setUseOriginal(true)
            setIsLoaded(false)
        } else {
            // Second failure or no fallback available — show error icon
            setHasError(true)
        }
    }

    return (
        <div ref={wrapperRef} className={cn('relative w-full h-full overflow-hidden', wrapperClassName)}>
            {/* Shimmer skeleton with gradient base (blur-up feel) */}
            {!isLoaded && !hasError && (
                <div className="absolute inset-0 overflow-hidden">
                    <div className="absolute inset-0 bg-gradient-to-br from-slate-100 via-slate-200 to-slate-300 dark:from-[hsl(220,20%,8%)] dark:via-[hsl(220,20%,11%)] dark:to-[hsl(220,20%,8%)]" />
                    <div className="absolute inset-0 -translate-x-full animate-[shimmer_1.5s_infinite] bg-gradient-to-r from-transparent via-white/40 dark:via-white/[0.06] to-transparent" />
                </div>
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
                    src={optimizedSrc}
                    srcSet={srcSet}
                    sizes={sizes || undefined}
                    alt={alt}
                    onLoad={() => setIsLoaded(true)}
                    onError={handleError}
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
