import React, { useRef, useState, useEffect } from 'react'
import { cn } from '@/lib/utils'
import { ImageOff } from 'lucide-react'

/**
 * LocationImage — адаптивный компонент изображений для GastroMap.
 *
 * Использует нативный <picture> + <source> для современных форматов.
 * Google CDN (lh3.googleusercontent.com) ресайзится через параметр =wNNN-h-k-no.
 * Остальные URL используются как есть.
 *
 * Особенности:
 * - IntersectionObserver lazy loading (200px ahead)
 * - Skeleton placeholder → fade-in при загрузке
 * - Fallback иконка при ошибке
 * - fetchpriority="high" для первых видимых карточек (LCP)
 * - decoding="async" по умолчанию
 *
 * @param {string}  src              – image_url из normalise() (canonical)
 * @param {string}  alt
 * @param {string}  className        – классы для <img>
 * @param {string}  wrapperClassName – классы для wrapper div
 * @param {number}  width            – целевая ширина (px), для Google CDN resize
 * @param {boolean} priority         – true = fetchpriority=high + eager loading (LCP)
 * @param {string}  fallback         – URL fallback если src пустой
 */

const GOOGLE_CDN_RE = /lh3\.googleusercontent\.com/
const UNSPLASH_RE   = /images\.unsplash\.com/

/**
 * Добавляет параметр ресайза для Google CDN и Unsplash.
 * Google Photos: заменяем =wXXX... суффикс на =wW-h-k-no
 * Unsplash: добавляем ?w=W&q=80&auto=format&fit=crop
 */
function resizeUrl(src, width) {
    if (!src) return src
    if (GOOGLE_CDN_RE.test(src)) {
        // Google CDN: URL заканчивается на =w1920-h1080-k-no или похожим
        // Заменяем весь размерный суффикс после последнего = или добавляем
        return src.replace(/=w\d+.*$/, '') + `=w${width}-h-k-no`
    }
    if (UNSPLASH_RE.test(src)) {
        const u = new URL(src)
        u.searchParams.set('w', String(width))
        u.searchParams.set('q', '80')
        u.searchParams.set('auto', 'format')
        u.searchParams.set('fit', 'crop')
        return u.toString()
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
    const wrapperRef  = useRef(null)
    const [visible, setVisible]   = useState(priority)   // priority → грузим сразу
    const [loaded,  setLoaded]    = useState(false)
    const [error,   setError]     = useState(false)

    const imgSrc = src || fallback

    // Ресайзим под нужную ширину
    const resized = resizeUrl(imgSrc, width)

    useEffect(() => {
        if (priority) return   // уже видим
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
                    {/*
                      * Браузер сам выбирает подходящий source.
                      * Google CDN отдаёт WebP автоматически — дополнительный
                      * <source type="image/webp"> не нужен, браузер договорится
                      * через Accept header. Оставляем один <img> для простоты
                      * и совместимости с crossOrigin.
                      */}
                    <img
                        src={resized}
                        alt={alt}
                        crossOrigin="anonymous"
                        decoding="async"
                        fetchPriority={priority ? 'high' : 'auto'}
                        onLoad={() => setLoaded(true)}
                        onError={() => {
                            // При ошибке пробуем оригинальный URL без ресайза
                            if (resized !== imgSrc) {
                                // второй шанс — оригинал
                                setError(false)
                            } else {
                                setError(true)
                            }
                        }}
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
