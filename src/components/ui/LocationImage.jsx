import React, { useRef, useState, useEffect } from 'react'
import { cn } from '@/lib/utils'
import { ImageOff } from 'lucide-react'

/**
 * LocationImage — адаптивный компонент изображений для GastroMap.
 *
 * Google CDN (lh3.googleusercontent.com) ресайзится через параметр =wNNN-h-k-no.
 * Unsplash: через query params w/q/auto/fit.
 * Остальные URL используются как есть.
 *
 * Особенности:
 * - IntersectionObserver lazy loading (200px ahead)
 * - Skeleton placeholder → fade-in при загрузке
 * - 2-уровневый fallback: resized → original → fallback icon
 * - fetchpriority="high" для первых видимых карточек (LCP)
 * - decoding="async" по умолчанию
 *
 * @param {string}  src              – image_url из normalise() (canonical, RAW без ресайза)
 * @param {string}  alt
 * @param {string}  className        – классы для <img>
 * @param {string}  wrapperClassName – классы для wrapper div
 * @param {number}  width            – целевая ширина (px), для Google CDN resize
 * @param {boolean} priority         – true = fetchpriority=high + eager loading (LCP)
 * @param {string}  fallback         – URL fallback если src пустой
 */

const GOOGLE_CDN_RE = /lh3\.googleusercontent\.com/
const UNSPLASH_RE   = /images\.unsplash\.com/

function resizeUrl(src, width) {
    if (!src) return src
    if (GOOGLE_CDN_RE.test(src)) {
        return src.replace(/=w\d+.*$/, '') + `=w${width}-h-k-no`
    }
    if (UNSPLASH_RE.test(src)) {
        try {
            const u = new URL(src)
            u.searchParams.set('w', String(width))
            u.searchParams.set('q', '80')
            u.searchParams.set('auto', 'format')
            u.searchParams.set('fit', 'crop')
            return u.toString()
        } catch {
            return src
        }
    }
    return src
}

const DEFAULT_FALLBACK =
    'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?q=80&w=800&auto=format&fit=crop'

export default function LocationImage({
    src,
    alt = '',
    className,
    wrapperClassName,
    width = 800,
    priority = false,
    fallback = DEFAULT_FALLBACK,
}) {
    const wrapperRef = useRef(null)
    const [visible, setVisible]         = useState(priority)
    const [loaded, setLoaded]           = useState(false)
    const [error, setError]             = useState(false)
    // useOriginal: true = второй шанс с оригинальным URL без ресайза
    const [useOriginal, setUseOriginal] = useState(false)

    const rawSrc  = src || fallback
    const resized = useOriginal ? rawSrc : resizeUrl(rawSrc, width)

    // Если resized === rawSrc (URL не поддерживает ресайз), пропускаем второй шанс
    const canFallbackToOriginal = !useOriginal && resized !== rawSrc

    useEffect(() => {
        if (priority) return
        const el = wrapperRef.current
        if (!el) return

        const observer = new IntersectionObserver(
            ([entry]) => {
                if (entry.isIntersecting) {
                    setVisible(true)
                    observer.disconnect()
                }
            },
            { rootMargin: '200px' }
        )
        observer.observe(el)
        return () => observer.disconnect()
    }, [priority])

    // Сброс состояния при смене src
    useEffect(() => {
        setLoaded(false)
        setError(false)
        setUseOriginal(false)
    }, [src])

    function handleError() {
        if (canFallbackToOriginal) {
            // Первая ошибка: пробуем оригинальный URL без ресайза
            setUseOriginal(true)
            setLoaded(false)
        } else {
            // Вторая ошибка или нет резервного — показываем иконку
            setError(true)
        }
    }

    return (
        <div
            ref={wrapperRef}
            className={cn('relative w-full h-full overflow-hidden', wrapperClassName)}
        >
            {/* Skeleton */}
            {!loaded && !error && (
                <div className="absolute inset-0 bg-slate-200 dark:bg-slate-800 animate-pulse" />
            )}

            {/* Error fallback */}
            {error && (
                <div className="absolute inset-0 flex items-center justify-center bg-slate-100 dark:bg-slate-800/60">
                    <ImageOff className="text-slate-400 dark:text-slate-600" size={28} />
                </div>
            )}

            {/* Основное изображение */}
            {visible && !error && (
                <picture>
                    <img
                        src={resized}
                        alt={alt}
                        crossOrigin="anonymous"
                        decoding="async"
                        fetchPriority={priority ? 'high' : 'auto'}
                        onLoad={() => setLoaded(true)}
                        onError={handleError}
                        className={cn(
                            'w-full h-full object-cover transition-opacity duration-300',
                            loaded ? 'opacity-100' : 'opacity-0',
                            className
                        )}
                    />
                </picture>
            )}
        </div>
    )
}
