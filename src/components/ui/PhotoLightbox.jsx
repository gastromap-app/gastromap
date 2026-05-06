import React, { useEffect, useCallback, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { X, ChevronLeft, ChevronRight } from 'lucide-react'

/**
 * PhotoLightbox — fullscreen photo viewer rendered into document.body via Portal.
 *
 * Props:
 *   photos       string[]          Array of image URLs.
 *   open         boolean           Controls visibility.
 *   initialIndex number            Index to open at (default 0).
 *   onClose      () => void        Close handler (Esc / backdrop / close button / swipe-down).
 *
 * Features:
 *   - Keyboard nav: Esc, ArrowLeft, ArrowRight.
 *   - Touch swipe: horizontal to navigate, vertical-down to close.
 *   - Neighbor preloading for instant next/prev.
 *   - Body scroll lock while open.
 *   - Spring transitions via Framer Motion.
 */
const PhotoLightbox = ({ photos = [], open = false, initialIndex = 0, onClose }) => {
    const [index, setIndex] = useState(initialIndex)
    const [direction, setDirection] = useState(0) // -1 prev, 1 next
    const touchStart = useRef(null)

    // Sync internal index when reopened at different initialIndex
    useEffect(() => {
        if (open) {
            setIndex(initialIndex)
            setDirection(0)
        }
    }, [open, initialIndex])

    const total = photos.length
    const canNavigate = total > 1

    const goNext = useCallback(() => {
        if (!canNavigate) return
        setDirection(1)
        setIndex(i => (i + 1) % total)
    }, [canNavigate, total])

    const goPrev = useCallback(() => {
        if (!canNavigate) return
        setDirection(-1)
        setIndex(i => (i - 1 + total) % total)
    }, [canNavigate, total])

    // Keyboard nav + body scroll lock
    useEffect(() => {
        if (!open) return
        const prevOverflow = document.body.style.overflow
        document.body.style.overflow = 'hidden'

        const onKey = (e) => {
            if (e.key === 'Escape') onClose?.()
            else if (e.key === 'ArrowRight') goNext()
            else if (e.key === 'ArrowLeft') goPrev()
        }
        window.addEventListener('keydown', onKey)
        return () => {
            window.removeEventListener('keydown', onKey)
            document.body.style.overflow = prevOverflow
        }
    }, [open, onClose, goNext, goPrev])

    // Preload neighbors for instant nav
    useEffect(() => {
        if (!open || !total) return
        const preload = (idx) => {
            const url = photos[((idx % total) + total) % total]
            if (!url) return
            const img = new Image()
            img.src = url
        }
        preload(index + 1)
        preload(index - 1)
    }, [open, index, photos, total])

    // Touch handlers
    const handleTouchStart = (e) => {
        const t = e.touches[0]
        touchStart.current = { x: t.clientX, y: t.clientY, time: Date.now() }
    }
    const handleTouchEnd = (e) => {
        if (!touchStart.current) return
        const t = e.changedTouches[0]
        const dx = t.clientX - touchStart.current.x
        const dy = t.clientY - touchStart.current.y
        const absX = Math.abs(dx)
        const absY = Math.abs(dy)
        const THRESHOLD = 50

        if (absX > absY && absX > THRESHOLD) {
            if (dx < 0) goNext()
            else goPrev()
        } else if (absY > THRESHOLD && dy > 0) {
            // swipe down to close
            onClose?.()
        }
        touchStart.current = null
    }

    // Slide variants
    const variants = {
        enter: (dir) => ({ x: dir > 0 ? 80 : dir < 0 ? -80 : 0, opacity: 0, scale: 0.98 }),
        center: { x: 0, opacity: 1, scale: 1 },
        exit: (dir) => ({ x: dir > 0 ? -80 : dir < 0 ? 80 : 0, opacity: 0, scale: 0.98 }),
    }

    if (typeof document === 'undefined') return null

    const currentUrl = photos[index]

    return createPortal(
        <AnimatePresence>
            {open && currentUrl && (
                <motion.div
                    key="lightbox-root"
                    className="fixed inset-0 z-[9999] bg-black/95 backdrop-blur-xl flex items-center justify-center select-none"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    onClick={onClose}
                    onTouchStart={handleTouchStart}
                    onTouchEnd={handleTouchEnd}
                    role="dialog"
                    aria-modal="true"
                    aria-label="Photo viewer"
                >
                    {/* Counter */}
                    {total > 1 && (
                        <div className="absolute top-4 left-4 z-10 px-3 py-1.5 rounded-full bg-white/10 backdrop-blur-md text-white text-xs font-semibold tracking-wide tabular-nums">
                            {index + 1} / {total}
                        </div>
                    )}

                    {/* Close button */}
                    <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); onClose?.() }}
                        aria-label="Close"
                        className="absolute top-4 right-4 z-10 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 backdrop-blur-md flex items-center justify-center text-white transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
                    >
                        <X size={20} strokeWidth={2.2} />
                    </button>

                    {/* Prev */}
                    {canNavigate && (
                        <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); goPrev() }}
                            aria-label="Previous photo"
                            className="hidden md:flex absolute left-4 top-1/2 -translate-y-1/2 z-10 w-12 h-12 rounded-full bg-white/10 hover:bg-white/20 backdrop-blur-md items-center justify-center text-white transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
                        >
                            <ChevronLeft size={24} strokeWidth={2.2} />
                        </button>
                    )}

                    {/* Next */}
                    {canNavigate && (
                        <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); goNext() }}
                            aria-label="Next photo"
                            className="hidden md:flex absolute right-4 top-1/2 -translate-y-1/2 z-10 w-12 h-12 rounded-full bg-white/10 hover:bg-white/20 backdrop-blur-md items-center justify-center text-white transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
                        >
                            <ChevronRight size={24} strokeWidth={2.2} />
                        </button>
                    )}

                    {/* Image stage */}
                    <div
                        className="relative w-full h-full flex items-center justify-center px-4 md:px-20"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <AnimatePresence initial={false} mode="wait" custom={direction}>
                            <motion.img
                                key={currentUrl}
                                src={currentUrl}
                                alt={`photo-${index + 1}`}
                                custom={direction}
                                variants={variants}
                                initial="enter"
                                animate="center"
                                exit="exit"
                                transition={{ type: 'spring', stiffness: 260, damping: 28, mass: 0.9 }}
                                decoding="async"
                                draggable={false}
                                referrerPolicy="no-referrer"
                                className="max-w-full max-h-full object-contain rounded-lg shadow-2xl pointer-events-auto"
                            />
                        </AnimatePresence>
                    </div>

                    {/* Mobile swipe hint (first open only) */}
                    {canNavigate && (
                        <div className="md:hidden absolute bottom-6 left-0 right-0 flex justify-center pointer-events-none">
                            <div className="px-3 py-1.5 rounded-full bg-white/10 backdrop-blur-md text-white/80 text-[11px] font-medium tracking-wide">
                                Swipe to browse · Swipe down to close
                            </div>
                        </div>
                    )}
                </motion.div>
            )}
        </AnimatePresence>,
        document.body
    )
}

export default PhotoLightbox
