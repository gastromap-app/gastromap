import React, { useState, useMemo, useEffect, useRef } from 'react'
import { useParams, useNavigate, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { motion, AnimatePresence } from 'framer-motion'
import {
    Star, MapPin, Clock, Phone, Share2, Heart,
    MessageSquare, Navigation, ArrowLeft, ShieldCheck,
    Calendar, Users, Sparkles, Lightbulb,
    UtensilsCrossed, Camera, User, ChevronRight, CheckCircle2,
    FileText, Image as ImageIcon, Plus, Edit3, Send, Trash2,
    AlertCircle,
    Instagram, Facebook, Twitter, ExternalLink, Globe, X
} from 'lucide-react'
import { getDisplayRating } from '@/utils/ratingUtils'
import { useTheme } from '@/hooks/useTheme'
import { useLocationsStore } from '@/shared/store/useLocationsStore'
import { MOCK_LOCATIONS } from '@/mocks/locations'
import { PageTransition } from '@/components/ui/PageTransition'
import { translate } from '@/utils/translation'
import { useFavoritesStore } from '@/shared/store/useFavoritesStore'
import { useUserPrefsStore } from '@/features/auth/hooks/useUserPrefsStore'
import { useOpenStatus } from '@/hooks/useOpenStatus'
import LazyImage from '@/components/ui/LazyImage'
import { useAuthStore } from '@/shared/store/useAuthStore'
import LocationImage from '@/components/ui/LocationImage'
import { getLocationMenu, saveScannedMenu, incrementView } from '@/shared/api/locations.api'
import { useCreateReviewMutation, useLocationReviews, useAddFavoriteMutation, useRemoveFavoriteMutation, useUserFavorites, useAddVisitMutation, useLocation as useLocationQuery } from '@/shared/api/queries'
import { MenuScanner } from '@/features/public/components/MenuScanner'
import { LABEL_EMOJI_MAP } from '@/shared/constants/taxonomy'
import { REVIEW_STATUSES } from '@/shared/constants/statuses'

import { useAIChatStore } from '@/shared/hooks/useAIChatStore'

const LocationDetailsPage = () => {
    const { id } = useParams()
    const navigate = useNavigate()
    const routerLocation = useLocation()
    const cameFromChat = routerLocation.state?.from === 'chat'
    const { setIsChatOpen } = useAIChatStore()
    const { t } = useTranslation()
    const { theme } = useTheme()
    const isDark = theme === 'dark'

    // Find location: try store first (instant if already loaded), then Supabase query
    // Use String() coercion — URL params are always strings, DB ids may be numbers
    const storeLocations = useLocationsStore(s => s.locations)
    const storeIsLoading = useLocationsStore(s => s.isLoading)
    // FIX: Only use MOCK_LOCATIONS in development — never in production
    const locationFromStore = storeLocations.find(loc => String(loc.id) === id)
        ?? (import.meta.env.DEV ? MOCK_LOCATIONS.find(loc => String(loc.id) === id) : null)
        ?? null

    // BUG-5 FIX: if user lands directly on /location/:id, store may be empty.
    // Fall back to a direct Supabase query for this specific location.
    const { data: locationQuery, isLoading: queryLoading } = useLocationQuery(
        !locationFromStore ? id : null   // only fetch if store doesn't have it
    )

    const location = locationFromStore ?? locationQuery ?? null
    const isPageLoading = !locationFromStore && (storeIsLoading || queryLoading)

    // Also trigger store.initialize() if store is empty and we have no location yet
    useEffect(() => {
        if (storeLocations.length === 0 && !storeIsLoading) {
            useLocationsStore.getState().initialize()
        }
    }, [storeLocations.length, storeIsLoading])

    // PERF: Increment view count on load
    useEffect(() => {
        if (location?.id) {
            incrementView(location.id).catch(err => {
                console.warn('Failed to increment view:', err)
            })
        }
    }, [location?.id])

    // Connect to real stores
    // FIX: DB is the source of truth for authenticated users; localStorage only for guests
    const { isFavorite: isLocalFav, toggleFavorite: localToggle } = useFavoritesStore()
    const { prefs, addVisited: localAddVisited } = useUserPrefsStore()
    const { user } = useAuthStore()
    const canScanMenu = user?.role === 'admin' || user?.role === 'moderator'
    const addFavMut   = useAddFavoriteMutation()
    const removeFavMut = useRemoveFavoriteMutation()
    const addVisitMut = useAddVisitMutation()
    const { data: dbFavs = [] } = useUserFavorites(user?.id)
    const dbFavIds = dbFavs.map(f => f.location_id)
    // DB takes precedence for auth users; localStorage fallback for guests
    const isSaved   = user?.id ? dbFavIds.includes(location?.id) : isLocalFav(location?.id)
    const isVisited = prefs.lastVisited?.includes(location?.id)

    const toggleFavorite = async (id) => {
        if (!user?.id) {
            // Guest mode: only localStorage
            localToggle(id)
            return
        }
        // Auth user: DB is truth — toggle based on current DB state
        if (dbFavIds.includes(id)) {
            await removeFavMut.mutateAsync({ userId: user.id, locationId: id })
        } else {
            await addFavMut.mutateAsync({ userId: user.id, locationId: id })
        }
        // Sync localStorage to match DB state after toggle
        if (!dbFavIds.includes(id) !== isLocalFav(id)) {
            localToggle(id)
        }
    }

    const addVisited = async (id) => {
        localAddVisited(id)  // optimistic local
        if (user?.id) {
            await addVisitMut.mutateAsync({ userId: user.id, locationId: id })
        }
    }
    const { label: openLabel, isOpen } = useOpenStatus(location?.openingHours)

    // Reviews — Supabase
    const { data: allReviews = [] } = useLocationReviews(location?.id)
    const createReview = useCreateReviewMutation()
    const reviews = useMemo(
        () => allReviews.filter((r) => r.status === REVIEW_STATUSES.PUBLISHED),
        [allReviews]
    )

    // Compute aggregate using our Ground Truth utility
    const aggregate = useMemo(() => {
        const dr = getDisplayRating(location, reviews)
        
        // Distribution still calculated from real reviews only
        const dist = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 }
        reviews.forEach((r) => {
            const rating = Math.round(r.rating)
            if (dist[rating] !== undefined) dist[rating]++
        })

        return {
            average: dr.rating,
            count: dr.count,
            isInternal: dr.isInternal,
            distribution: dist,
        }
    }, [reviews, location])

    const [activeTab, setActiveTab] = useState('Overview')

    // Scroll-aware compact header — appears after user scrolls past the hero
    const [scrollY, setScrollY] = useState(0)
    useEffect(() => {
        const onScroll = () => setScrollY(window.scrollY)
        window.addEventListener('scroll', onScroll, { passive: true })
        return () => window.removeEventListener('scroll', onScroll)
    }, [])
    // hero is ~55vh mobile / 60vh desktop — threshold for morphing header
    const showCompactHeader = scrollY > 180

    // Share handler — native share sheet on mobile, clipboard fallback on desktop
    const [shareToast, setShareToast] = useState(null)
    const shareToastTimerRef = useRef(null)
    // Clear pending toast timer on unmount to avoid setState after unmount
    useEffect(() => () => { if (shareToastTimerRef.current) clearTimeout(shareToastTimerRef.current) }, [])
    const showShareToast = (msg) => {
        setShareToast(msg)
        if (shareToastTimerRef.current) clearTimeout(shareToastTimerRef.current)
        shareToastTimerRef.current = setTimeout(() => setShareToast(null), 2200)
    }
    const shareLocation = async () => {
        const url = window.location.href
        const shareData = {
            title: location?.title || 'GastroMap',
            text: location?.description?.slice(0, 120) || 'Check out this place on GastroMap',
            url,
        }
        // Try native share first (mobile & modern browsers); silently fall back otherwise
        if (typeof navigator !== 'undefined' && navigator.share && navigator.canShare?.(shareData) !== false) {
            try {
                await navigator.share(shareData)
                showShareToast(t('common.shared'))
                return
            } catch (err) {
                // User cancelled the share sheet — don't show error toast
                if (err?.name === 'AbortError') return
                // Other share failure → fall through to clipboard
            }
        }
        try {
            await navigator.clipboard.writeText(url)
            showShareToast(t('common.link_copied'))
        } catch {
            showShareToast(t('common.link_copy_failed'))
        }
    }

    // User interaction states
    const [userNote, setUserNote] = useState("")
    const [isWritingReview, setIsWritingReview] = useState(false)
    const [newReview, setNewReview] = useState({ rating: 5, text: "" })

    // Load persisted note per-location (localStorage is the private vault for MVP)
    useEffect(() => {
        if (!location?.id) return
        try {
            const saved = localStorage.getItem(`gm:note:${location.id}`)
            setUserNote(saved || "")
        } catch { /* storage unavailable */ }
    }, [location?.id])

    const handleSaveNote = () => {
        if (!location?.id) return
        try {
            if (userNote.trim()) {
                localStorage.setItem(`gm:note:${location.id}`, userNote)
            } else {
                localStorage.removeItem(`gm:note:${location.id}`)
            }
            showShareToast(t('location.note_saved'))
        } catch {
            showShareToast(t('common.error'))
        }
    }

    const handleClearNote = () => {
        setUserNote("")
        if (location?.id) {
            try { localStorage.removeItem(`gm:note:${location.id}`) } catch { /* ignore */ }
        }
        showShareToast(t('location.note_cleared'))
    }

    // Menu persistence state
    const [menuDishes, setMenuDishes] = useState([])
    const [menuLoading, setMenuLoading] = useState(false)
    const [menuSaving, setMenuSaving] = useState(false)
    const [menuToast, setMenuToast] = useState(null)

    useEffect(() => {
        if (location?.id) {
            setMenuLoading(true)
            getLocationMenu(location.id)
                .then(dishes => setMenuDishes(dishes))
                .catch(() => setMenuDishes([]))
                .finally(() => setMenuLoading(false))
        }
    }, [location?.id])

    // Show skeleton while loading — avoids premature "not found" flash
    if (isPageLoading) return (
        <div className="min-h-screen flex flex-col items-center justify-center gap-3">
            <div className="w-full max-w-lg px-6 space-y-4 animate-pulse">
                <div className={`h-56 rounded-3xl ${isDark ? 'bg-white/10' : 'bg-gray-200'}`} />
                <div className={`h-6 rounded-full w-2/3 ${isDark ? 'bg-white/10' : 'bg-gray-200'}`} />
                <div className={`h-4 rounded-full w-1/2 ${isDark ? 'bg-white/8' : 'bg-gray-100'}`} />
                <div className="flex gap-3">
                    {[1,2,3].map(n => <div key={n} className={`h-14 flex-1 rounded-2xl ${isDark ? 'bg-white/8' : 'bg-gray-100'}`} />)}
                </div>
            </div>
        </div>
    )

    if (!location) return (
        <div className="min-h-screen flex flex-col items-center justify-center gap-4 px-6 text-center">
            <MapPin size={48} className="text-gray-300" />
            <h2 className="text-xl font-black text-gray-700 dark:text-gray-200">{t('location.not_found')}</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">{t('location.not_found_desc')}</p>
            <button
                onClick={() => navigate('/explore')}
                className="mt-2 px-6 py-3 rounded-2xl bg-blue-600 text-white font-bold text-sm"
            >
                {t('location.browse_places')}
            </button>
        </div>
    )

    const handleScroll = (e) => {
        // reserved for future scroll-based effects inside the tab bar
        void e
    }

    const openInMaps = () => {
        const encodedAddress = encodeURIComponent(location.address)
        window.open(`https://www.google.com/maps/search/?api=1&query=${encodedAddress}`, '_blank')
    }

    const callNumber = () => {
        const phone = location?.phone
        if (!phone) return
        // Validate: must start with + or digits only — prevents open redirects via tel:
        if (!/^\+?[\d\s\-().]{7,20}$/.test(phone)) return
        window.location.href = `tel:${phone}`
    }

    const textStyle = isDark ? "text-white" : "text-gray-900"
    const subTextStyle = isDark ? "text-white/60" : "text-slate-600"
    const cardBg = isDark
        ? "bg-white/[0.05] border-white/10"
        : "bg-white border-slate-200/70 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_2px_10px_rgba(15,23,42,0.05)]"

    const fadeInUp = {
        hidden: { opacity: 0, y: 20 },
        visible: { opacity: 1, y: 0 }
    }

    // Render Helpers
    const renderOverview = () => (
        <div className="space-y-5">
            {/* ── Compact Info Grid ───────────────────────────────────────────── */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
                {[
                    { id: 'hours',     icon: Clock,         label: openLabel || t('location.hours_today'), value: location.openingHours || '—', color: isOpen ? "text-emerald-500" : isOpen === false ? "text-red-400" : "text-blue-500", bg: isOpen ? "bg-emerald-500/8" : isOpen === false ? "bg-red-500/8" : "bg-blue-500/8" },
                    { id: 'contact',   icon: Phone,         label: t('location.contact'),        value: location.phone || '—', color: "text-green-500", bg: "bg-green-500/8", hidden: !location.phone },
                    { id: 'reviews',   icon: MessageSquare, label: t('location.total_reviews'),  value: aggregate.count ? `${aggregate.count}` : '—', sub: aggregate.count ? t('location.review_count_short', { defaultValue: 'reviews' }) : t('location.no_reviews'), color: "text-indigo-500", bg: "bg-indigo-500/8" },
                    { id: 'directions',icon: Navigation,   label: t('location.get_directions'), value: location.address ? t('location.open_in_maps') : '—', color: "text-orange-500", bg: "bg-orange-500/8" }
                ].filter(info => !info.hidden).map((info, i) => (
                    <motion.div
                        key={info.id}
                        role="button"
                        tabIndex={0}
                        aria-label={info.label}
                        variants={fadeInUp}
                        initial="hidden"
                        animate="visible"
                        transition={{ delay: 0.05 * i }}
                        onClick={() => {
                            if (info.id === 'directions') openInMaps()
                            if (info.id === 'contact') callNumber()
                        }}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                                if (info.id === 'directions') openInMaps()
                                if (info.id === 'contact') callNumber()
                            }
                        }}
                        className={`flex items-center gap-2.5 p-3 rounded-2xl border transition-all duration-300 group cursor-pointer ${isDark ? 'bg-white/[0.03] border-white/5 hover:bg-white/[0.06]' : 'bg-white border-gray-100 hover:border-gray-200 hover:shadow-sm'}`}
                    >
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${info.bg}`}>
                            <info.icon size={15} className={info.color} />
                        </div>
                        <div className="min-w-0">
                            <p className={`text-[10px] font-semibold uppercase tracking-wider opacity-40 ${textStyle}`}>{info.label}</p>
                            <p className={`text-[12px] font-bold leading-tight truncate ${textStyle}`}>{info.value}</p>
                            {info.sub && <p className={`text-[10px] opacity-40 ${textStyle}`}>{info.sub}</p>}
                        </div>
                    </motion.div>
                ))}
            </div>

            {/* ── Cuisine & Menu (compact inline) ─────────────────────────────── */}
            {(location.cuisine || location.special_labels?.length > 0) && (
                <section className="space-y-2.5">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <UtensilsCrossed size={14} className="text-blue-500" />
                            <h3 className={`text-sm font-black ${textStyle}`}>Cuisine & Menu</h3>
                        </div>
                        {location.cuisine && (
                            <span className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border ${isDark ? 'bg-blue-500/10 border-blue-500/20 text-blue-300' : 'bg-blue-50 border-blue-100 text-blue-600'}`}>
                                {translate(location.cuisine)}
                            </span>
                        )}
                    </div>
                    {location.special_labels?.length > 0 && (
                        <div className="flex flex-wrap gap-1.5">
                            {location.special_labels.map(label => (
                                <span key={label} className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold border transition-all ${isDark ? 'bg-white/[0.04] border-white/8 text-white/60 hover:bg-white/[0.08]' : 'bg-gray-50 border-gray-100 text-gray-500 hover:border-gray-200'}`}>
                                    {LABEL_EMOJI_MAP[label] || ''} {translate(label)}
                                </span>
                            ))}
                        </div>
                    )}
                </section>
            )}

            <section className="space-y-2.5">
                <div className="flex items-center gap-2.5">
                    <div className="w-1 h-5 bg-blue-600 rounded-full" />
                    <h3 className={`text-lg font-black ${textStyle}`}>Experience {location.title}</h3>
                </div>
                <p className={`text-sm leading-relaxed font-medium ${subTextStyle}`}>
                    {location.description}
                </p>
                <div className="flex flex-wrap gap-1.5 pt-1">
                    {location.tags?.map(tag => (
                        <span key={tag} className={`px-3 py-1 rounded-full text-[11px] font-medium border cursor-default ${isDark ? 'bg-white/[0.04] border-white/8 text-gray-400' : 'bg-gray-50 border-gray-200 text-gray-500'}`}>
                            #{translate(tag)}
                        </span>
                    ))}
                </div>
            </section>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className={`p-5 rounded-[32px] border relative overflow-hidden ${isDark ? 'bg-orange-500/5 border-orange-500/10' : 'bg-orange-50 border-orange-100'}`}>
                    <Lightbulb className="absolute top-4 right-4 text-orange-500 opacity-20" size={32} />
                    <div className="flex items-center gap-2 mb-3">
                        <Sparkles size={16} className="text-orange-500" />
                        <h4 className="text-xs font-black uppercase tracking-[0.2em] text-orange-600">Curator's Tip</h4>
                    </div>
                    <p className={`text-sm font-bold italic leading-relaxed ${isDark ? 'text-orange-200/80' : 'text-orange-900/80'}`}>
                        "To experience the full magic, visit right before sunset. The lighting makes every photo look like a cinematic masterpiece."
                    </p>
                </div>
                <div className={`p-5 rounded-[32px] border relative overflow-hidden ${isDark ? 'bg-blue-500/5 border-blue-500/10' : 'bg-blue-50 border-blue-100'}`}>
                    <UtensilsCrossed className="absolute top-4 right-4 text-blue-500 opacity-20" size={32} />
                    <div className="flex items-center gap-2 mb-3">
                        <Star size={16} className="text-blue-500" />
                        <h4 className="text-xs font-black uppercase tracking-[0.2em] text-blue-600">Must Try</h4>
                    </div>
                    <p className={`text-sm font-bold leading-relaxed ${isDark ? 'text-blue-200/80' : 'text-blue-900/80'}`}>
                        Our signature truffle-infused specialty is a non-negotiable choice for first-timers.
                    </p>
                </div>
            </div>

            <section className="space-y-3">
                <div className="flex justify-between items-center">
                    <h3 className={`text-lg font-black ${textStyle}`}>Venue Gallery</h3>
                    <button onClick={() => setActiveTab('Photos')} className="text-blue-600 font-black text-xs hover:underline">Full Album</button>
                </div>

                {/* Bento Style Gallery Grid */}
                <div className="grid grid-cols-2 md:grid-cols-12 gap-2 h-[300px] md:h-[600px]">
                    <div className="col-span-2 md:col-span-6 rounded-[24px] md:rounded-[48px] overflow-hidden group cursor-pointer relative shadow-lg">
                        <LocationImage
                            src={location.image}
                            alt={location.title}
                            width={800}
                            className="transition-transform duration-500 group-hover:scale-105"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>

                    <div className="col-span-1 md:col-span-3 rounded-[24px] md:rounded-[40px] overflow-hidden group cursor-pointer relative shadow-lg">
                        <LazyImage src="https://images.unsplash.com/photo-1559339352-11d035aa65de?q=80&w=1000&auto=format&fit=crop" crossOrigin="anonymous" className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" alt="detail 1" />
                    </div>

                    <div className="col-span-1 md:col-span-3 rounded-[24px] md:rounded-[40px] overflow-hidden group cursor-pointer relative shadow-lg">
                        <LazyImage src="https://images.unsplash.com/photo-1552566626-52f8b828add9?q=80&w=1000&auto=format&fit=crop" crossOrigin="anonymous" className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" alt="detail 2" />
                    </div>

                    <div className="col-span-1 md:col-span-4 rounded-[24px] md:rounded-[40px] overflow-hidden group cursor-pointer relative shadow-lg">
                        <LazyImage src="https://images.unsplash.com/photo-1514362545857-3bc16c4c7d1b?q=80&w=1000&auto=format&fit=crop" crossOrigin="anonymous" className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" alt="detail 3" />
                    </div>

                    <div className="col-span-1 md:col-span-8 rounded-[24px] md:rounded-[40px] overflow-hidden relative group cursor-pointer shadow-lg">
                        <LazyImage src="https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?q=80&w=1000&auto=format&fit=crop" crossOrigin="anonymous" className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" alt="detail 4" />
                        <div className="absolute inset-0 bg-blue-600/80 backdrop-blur-md flex flex-col items-center justify-center text-white p-4 opacity-0 group-hover:opacity-100 transition-all duration-500">
                            <Camera size={24} className="mb-1" />
                            <span className="text-xl font-black">+24</span>
                            <span className="text-[9px] font-black uppercase tracking-widest">Explore</span>
                        </div>
                    </div>
                </div>
            </section>

            {/* 5. Connect & External Links */}
            <section className="pt-8 space-y-6">
                <div className="flex flex-col md:flex-row gap-6 items-center justify-between p-10 rounded-[48px] border overflow-hidden relative group transition-all duration-700 hover:border-blue-500/30 ${isDark ? 'bg-white/[0.02] border-white/5 shadow-2xl shadow-blue-500/5' : 'bg-gray-50 border-gray-100 shadow-xl shadow-gray-200/50'}">
                    <div className="absolute top-0 left-0 w-40 h-40 bg-blue-600/5 rounded-full -ml-20 -mt-20 blur-3xl opacity-0 group-hover:opacity-100 transition-opacity" />

                    <div className="space-y-4 text-center md:text-left relative z-10">
                        <h3 className={`text-2xl font-black ${textStyle}`}>Find them online</h3>
                        <div className="flex gap-3 justify-center md:justify-start">
                            {[
                                { icon: Instagram, color: "hover:bg-pink-500 hover:text-white", label: "Instagram" },
                                { icon: Facebook, color: "hover:bg-blue-600 hover:text-white", label: "Facebook" },
                                { icon: Twitter, color: "hover:bg-black hover:text-white", label: "Twitter / X" }
                            ].map((social, i) => (
                                <button key={i} aria-label={social.label} className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-all duration-300 border ${isDark ? 'bg-white/5 border-white/10 text-white' : 'bg-white border-gray-200 text-gray-500'} ${social.color}`}>
                                    <social.icon size={22} />
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto relative z-10">
                        <button className={`flex-1 sm:flex-none px-10 py-5 rounded-2xl flex items-center justify-center gap-3 font-black text-sm border transition-all ${isDark ? 'bg-white/5 border-white/10 text-white hover:bg-white/10' : 'bg-white border-gray-200 text-gray-900 hover:bg-gray-50'}`}>
                            <Globe size={18} className="text-blue-500" />
                            {t('location.visit_website')}
                        </button>
                        <button className="flex-1 sm:flex-none px-10 py-5 bg-blue-600 text-white rounded-2xl flex items-center justify-center gap-3 font-black text-sm shadow-xl shadow-blue-600/20 hover:scale-[1.02] active:scale-95 transition-all">
                            <ExternalLink size={18} />
                            {t('location.external_booking')}
                        </button>
                    </div>
                </div>
            </section>
        </div>
    )

    const renderMenu = () => {
        // Merge persisted menu dishes with KG dishes (deduplicate by name)
        const kgDishNames = new Set((location?.kg_dishes || []).map(d => typeof d === 'string' ? d.toLowerCase() : (d.name || '').toLowerCase()))
        const allDishes = [
            ...menuDishes.filter(d => !kgDishNames.has((d.name || '').toLowerCase())),
            ...(location?.kg_dishes || []).map(d =>
                typeof d === 'string'
                    ? { name: d, category: 'Other', vegetarian: false, vegan: false, gluten_free: false }
                    : { category: 'Other', vegetarian: false, vegan: false, gluten_free: false, ...d }
            ),
        ]

        // Group by category
        const grouped = allDishes.reduce((acc, dish) => {
            const cat = dish.category || 'Other'
            if (!acc[cat]) acc[cat] = []
            acc[cat].push(dish)
            return acc
        }, {})

        const hasRealMenu = allDishes.length > 0

        // Dietary badge helper
        const DietaryBadge = ({ label, active, colorClass }) => {
            if (!active) return null
            return (
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${colorClass}`}>
                    {label}
                </span>
            )
        }

        return (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-8">
                {/* ── Toast notification ──────────────────────────────────── */}
                {menuToast && (
                    <div className={`flex items-center gap-3 p-4 rounded-2xl border text-sm font-bold transition-all ${
                        menuToast.type === 'error'
                            ? 'bg-red-500/10 border-red-500/20 text-red-500'
                            : 'bg-green-500/10 border-green-500/20 text-green-500'
                    }`}>
                        {menuToast.type === 'error' ? <AlertCircle size={16} /> : <CheckCircle2 size={16} />}
                        {menuToast.msg}
                    </div>
                )}

                {/* ── AI Menu Scanner (admin/moderator only) ──────────────── */}
                {canScanMenu && (
                    <div className={`p-6 rounded-[32px] border ${isDark ? 'border-white/10 bg-white/5' : 'border-gray-100 bg-gray-50'}`}>
                        <div className="flex items-center gap-3 mb-4">
                            <div className="w-10 h-10 rounded-2xl bg-blue-600/10 flex items-center justify-center text-blue-500">
                                <Camera size={20} />
                            </div>
                            <div>
                                <p className={`font-black text-sm ${textStyle}`}>AI Menu Scanner</p>
                                <p className={`text-xs ${subTextStyle}`}>Photo a menu → AI extracts dishes &amp; prices</p>
                            </div>
                            {menuSaving && (
                                <span className={`ml-auto text-xs font-bold ${subTextStyle} animate-pulse`}>Saving…</span>
                            )}
                        </div>
                        <MenuScanner onDishesExtracted={async (dishes) => {
                            setMenuSaving(true)
                            try {
                                await saveScannedMenu(location.id, dishes)
                                const updated = await getLocationMenu(location.id)
                                setMenuDishes(updated)
                                setMenuToast({ msg: `Menu saved — ${dishes.length} item${dishes.length === 1 ? '' : 's'} added`, type: 'success' })
                            } catch (err) {
                                console.error('Failed to save menu:', err)
                                setMenuToast({ msg: 'Failed to save menu', type: 'error' })
                            } finally {
                                setMenuSaving(false)
                                setTimeout(() => setMenuToast(null), 4000)
                            }
                        }} />
                    </div>
                )}

                {/* ── Loading state ───────────────────────────────────────── */}
                {menuLoading && (
                    <div className="flex items-center justify-center gap-3 py-12">
                        <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                        <p className={`text-sm font-bold ${subTextStyle}`}>Loading menu…</p>
                    </div>
                )}

                {/* ── Real menu dishes (grouped by category) ──────────────── */}
                {!menuLoading && hasRealMenu && Object.entries(grouped).map(([category, items]) => (
                    <div key={category} className="space-y-4">
                        <div className="flex items-center gap-3">
                            <h4 className={`text-lg font-black ${isDark ? 'text-white' : 'text-gray-900'}`}>{category}</h4>
                            <span className={`px-3 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${isDark ? 'bg-white/10 text-white/50' : 'bg-gray-100 text-gray-500'}`}>
                                {items.length} {items.length === 1 ? 'item' : 'items'}
                            </span>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {items.map((dish, i) => (
                                <div key={dish.id || i} className={`p-6 rounded-3xl border ${cardBg} flex justify-between items-start group hover:border-blue-500/50 transition-colors`}>
                                    <div className="space-y-1.5 min-w-0 flex-1">
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <p className={`font-black group-hover:text-blue-500 transition-colors ${textStyle}`}>{dish.name}</p>
                                            {dish.is_signature && (
                                                <span className="px-2 py-0.5 rounded-full text-[9px] font-bold uppercase bg-amber-500/10 text-amber-500 border border-amber-500/20">Signature</span>
                                            )}
                                        </div>
                                        {dish.description && (
                                            <p className={`text-xs ${subTextStyle} line-clamp-2`}>{dish.description}</p>
                                        )}
                                        <div className="flex flex-wrap gap-1.5 pt-1">
                                            <DietaryBadge label="Vegetarian" active={dish.vegetarian} colorClass="bg-green-500/10 text-green-500 border border-green-500/20" />
                                            <DietaryBadge label="Vegan" active={dish.vegan} colorClass="bg-emerald-500/10 text-emerald-500 border border-emerald-500/20" />
                                            <DietaryBadge label="Gluten-free" active={dish.gluten_free} colorClass="bg-yellow-500/10 text-yellow-600 border border-yellow-500/20" />
                                        </div>
                                    </div>
                                    {dish.price && (
                                        <span className="text-blue-500 font-black ml-3 flex-shrink-0">{dish.price}</span>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                ))}

                {/* ── Empty state for non-admin users ────────────────────── */}
                {!menuLoading && !hasRealMenu && !canScanMenu && (
                    <div className={`p-10 rounded-[32px] border text-center ${cardBg}`}>
                        <UtensilsCrossed size={32} className={`mx-auto mb-3 ${subTextStyle}`} />
                        <p className={`font-bold ${textStyle}`}>No menu available</p>
                        <p className={`text-xs mt-1 ${subTextStyle}`}>Menu information has not been added yet.</p>
                    </div>
                )}

                {/* ── Static sample sections (fallback when no real menu) ── */}
                {!menuLoading && !hasRealMenu && canScanMenu && [
                    {
                        title: "Signature Mains", items: [
                            { name: "Truffle Pasta", desc: "Fresh house-made pasta with black truffle cream", price: "$28" },
                            { name: "Roasted Duck", desc: "Slow-cooked with cherry glaze", price: "$34" }
                        ]
                    },
                    {
                        title: "Small Plates", items: [
                            { name: "Burrata", desc: "Creamy cheese with basaltic pearls", price: "$16" }
                        ]
                    }
                ].map((section, idx) => (
                    <div key={idx} className="space-y-4">
                        <div className="flex items-center gap-2">
                            <h4 className={`text-lg font-black border-b pb-3 flex-1 ${isDark ? 'border-white/10 text-white' : 'border-gray-100 text-gray-900'}`}>{section.title}</h4>
                            <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${isDark ? 'bg-white/10 text-white/40' : 'bg-gray-100 text-gray-400'}`}>Sample</span>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {section.items.map((item, i) => (
                                <div key={i} className={`p-6 rounded-3xl border ${cardBg} flex justify-between items-start group hover:border-blue-500/50 transition-colors`}>
                                    <div className="space-y-1">
                                        <p className={`font-black group-hover:text-blue-500 transition-colors ${textStyle}`}>{item.name}</p>
                                        <p className={`text-xs ${subTextStyle}`}>{item.desc}</p>
                                    </div>
                                    <span className="text-blue-500 font-black">{item.price}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                ))}
            </motion.div>
        )
    }

    const handleSubmitReview = () => {
        if (!newReview.text.trim() || !user?.id) return
        createReview.mutate({
            userId: user.id,
            locationId: location.id,
            rating: newReview.rating,
            reviewText: newReview.text,
        }, {
            onSuccess: () => {
                setNewReview({ rating: 5, text: '' })
                setIsWritingReview(false)
                showShareToast(t('location.review_submitted'))
            },
            onError: () => {
                showShareToast(t('location.review_failed'))
            }
        })
    }

    const renderReviews = () => {
        return (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-8">
                {/* Aggregate score */}
                <div className="flex flex-col md:flex-row gap-8 items-center bg-blue-600/5 p-10 rounded-[40px] border border-blue-500/10">
                    <div className="text-center md:text-left space-y-1 flex-shrink-0">
                        <p className="text-6xl font-black text-blue-500">{aggregate.average || '—'}</p>
                        <div className="flex gap-1 justify-center md:justify-start">
                            {[1, 2, 3, 4, 5].map(s => (
                                <Star key={s} size={16} className={s <= Math.round(aggregate.average) ? 'text-yellow-400 fill-yellow-400' : 'text-gray-300 fill-gray-300'} />
                            ))}
                        </div>
                        <p className={`text-xs font-black uppercase tracking-widest ${subTextStyle}`}>
                            Based on {aggregate.count} {aggregate.count === 1 ? 'review' : 'reviews'}
                        </p>
                    </div>
                    {/* Distribution bars */}
                    <div className="flex-1 space-y-2 w-full">
                        {[5, 4, 3, 2, 1].map(lvl => {
                            const count = aggregate.distribution[lvl] ?? 0
                            const pct = aggregate.count > 0 ? Math.round((count / aggregate.count) * 100) : 0
                            return (
                                <div key={lvl} className="flex items-center gap-3 w-full">
                                    <span className={`text-[11px] font-black w-3 ${textStyle}`}>{lvl}</span>
                                    <div className="h-1.5 flex-1 bg-gray-200 dark:bg-white/10 rounded-full overflow-hidden">
                                        <motion.div
                                            className="h-full bg-blue-600 rounded-full"
                                            initial={{ width: 0 }}
                                            animate={{ width: `${pct}%` }}
                                            transition={{ duration: 0.6, ease: 'easeOut', delay: (5 - lvl) * 0.06 }}
                                        />
                                    </div>
                                    <span className={`text-[10px] font-bold w-6 text-right ${subTextStyle}`}>{count}</span>
                                </div>
                            )
                        })}
                    </div>
                </div>

                {/* Write review */}
                <div className={`p-8 rounded-[40px] border border-dashed transition-all ${isWritingReview ? 'border-blue-500 bg-blue-500/5' : 'border-gray-200 dark:border-white/10'}`}>
                    {!isWritingReview ? (
                        <button
                            onClick={() => setIsWritingReview(true)}
                            className="w-full flex items-center justify-center gap-3 py-4 text-blue-500 font-black hover:scale-[1.01] transition-transform"
                        >
                            <Plus size={20} /> Write your review
                        </button>
                    ) : (
                        <div className="space-y-6">
                            <div className="flex justify-between items-center">
                                <h4 className={`font-black ${textStyle}`}>Rate your experience</h4>
                                <button onClick={() => setIsWritingReview(false)} className="text-gray-500 dark:text-gray-400"><X size={20} /></button>
                            </div>
                            <div className="flex gap-2">
                                {[1, 2, 3, 4, 5].map(s => (
                                    <button
                                        key={s}
                                        onClick={() => setNewReview({ ...newReview, rating: s })}
                                        className={`transition-all active:scale-90 ${s <= newReview.rating ? 'text-yellow-400' : 'text-gray-300'}`}
                                    >
                                        <Star size={28} fill={s <= newReview.rating ? 'currentColor' : 'none'} />
                                    </button>
                                ))}
                            </div>
                            <textarea
                                value={newReview.text}
                                onChange={(e) => setNewReview({ ...newReview, text: e.target.value })}
                                placeholder={t('location.review_placeholder')}
                                className={`w-full p-6 rounded-3xl border bg-transparent outline-none focus:border-blue-500 transition-colors h-32 text-sm font-medium resize-none ${isDark ? 'border-white/10 text-white placeholder:text-white/30' : 'border-gray-100 text-gray-900'}`}
                            />
                            <button
                                onClick={handleSubmitReview}
                                disabled={!newReview.text.trim()}
                                className={`w-full py-4 font-black rounded-2xl flex items-center justify-center gap-2 transition-all active:scale-[0.98] ${newReview.text.trim() ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-500/20' : 'bg-gray-200 dark:bg-white/10 text-gray-500 dark:text-gray-400 cursor-not-allowed'}`}
                            >
                                <Send size={18} /> {t('location.submit_review')}
                            </button>
                        </div>
                    )}
                </div>

                {/* Review list */}
                <div className="space-y-4">
                    <AnimatePresence initial={false}>
                        {reviews.length === 0 ? (
                            <div className="text-center py-10">
                                <p className={`text-sm font-medium ${subTextStyle}`}>{t('reviews.no_reviews')}</p>
                            </div>
                        ) : reviews.map((rev, i) => (
                            <motion.div
                                key={rev.id}
                                initial={{ opacity: 0, y: 16 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -8 }}
                                transition={{ delay: i * 0.05 }}
                                className={`p-8 rounded-[40px] border ${cardBg}`}
                            >
                                <div className="flex justify-between items-start mb-4">
                                    <div className="flex items-center gap-4">
                                        <div className="w-12 h-12 rounded-full bg-blue-600/10 flex items-center justify-center text-blue-600">
                                            <User size={22} />
                                        </div>
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <p className={`font-black ${textStyle}`}>{rev.profiles?.name || rev.user_name || 'Anonymous'}</p>
                                            </div>
                                            <p className="text-[10px] text-gray-500 dark:text-gray-400 font-bold uppercase mt-0.5">
                                                {new Date(rev.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex gap-0.5">
                                        {[1, 2, 3, 4, 5].map(s => (
                                            <Star key={s} size={13} className={s <= rev.rating ? 'text-yellow-400 fill-yellow-400' : 'text-gray-200 fill-gray-200'} />
                                        ))}
                                    </div>
                                </div>
                                <p className={`leading-relaxed text-sm font-medium ${subTextStyle}`}>{rev.review_text}</p>
                            </motion.div>
                        ))}
                    </AnimatePresence>
                </div>
            </motion.div>
        )
    }

    const renderPhotos = () => (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[...Array(8)].map((_, i) => (
                <div key={i} className="aspect-square rounded-[32px] overflow-hidden group cursor-pointer relative bg-gray-100">
                    <LazyImage src={`https://images.unsplash.com/photo-${1517248135467 + i}-4c7edcad34c4?q=80&w=400&fit=crop`} crossOrigin="anonymous" className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" alt="gallery" />
                    <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
            ))}
        </motion.div>
    )

    const renderNotes = () => (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
            <div className={`p-10 rounded-[48px] border overflow-hidden relative ${isDark ? 'bg-blue-600/[0.03] border-blue-500/10' : 'bg-blue-50/50 border-blue-100'}`}>
                <div className="absolute top-0 right-0 w-32 h-32 bg-blue-600/10 rounded-full -mr-16 -mt-16 blur-3xl" />

                <div className="relative z-10 space-y-6">
                    <div className="flex items-center gap-4">
                        <img src="/pwa-icon-192.png" alt="GastroMap Logo" className="w-14 h-14 object-cover rounded-full shadow-lg shadow-blue-500/20" />
                        <div>
                            <h3 className={`text-2xl font-black ${textStyle}`}>{t('location.private_notes')}</h3>
                            <p className={`text-xs font-bold uppercase tracking-widest text-blue-500`}>{t('location.private_notes_desc')}</p>
                        </div>
                    </div>

                    <div className="space-y-4">
                        <textarea
                            value={userNote}
                            onChange={(e) => setUserNote(e.target.value)}
                            placeholder={t('location.note_placeholder')}
                            className={`w-full p-8 rounded-[32px] border bg-transparent outline-none focus:border-blue-500 transition-all min-h-[200px] text-lg font-medium leading-relaxed ${isDark ? 'border-white/10 text-white' : 'border-gray-200 text-gray-900 shadow-inner'}`}
                        />
                        <div className="flex gap-3">
                            <button
                                onClick={handleClearNote}
                                className={`flex-1 py-4 rounded-2xl font-black text-sm flex items-center justify-center gap-2 border transition-all ${isDark ? 'border-white/10 text-white hover:bg-white/5' : 'border-gray-200 text-gray-500 hover:bg-gray-100'}`}
                            >
                                <Trash2 size={18} /> {t('location.clear')}
                            </button>
                            <button
                                onClick={handleSaveNote}
                                className="flex-[2] py-4 bg-blue-600 text-white font-black rounded-2xl shadow-xl shadow-blue-600/20 hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-2"
                            >
                                <CheckCircle2 size={18} /> {t('location.save_note')}
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className={`p-6 rounded-3xl flex items-center gap-4 ${isDark ? 'bg-white/5' : 'bg-gray-50'}`}>
                    <ShieldCheck className="text-green-500" size={24} />
                    <div>
                        <p className={`text-sm font-black ${textStyle}`}>End-to-End Private</p>
                        <p className={`text-[10px] ${subTextStyle}`}>Notes are stored locally or in your private vault.</p>
                    </div>
                </div>
                <div className={`p-6 rounded-3xl flex items-center gap-4 ${isDark ? 'bg-white/5' : 'bg-gray-50'}`}>
                    <Sparkles className="text-blue-500" size={24} />
                    <div>
                        <p className={`text-sm font-black ${textStyle}`}>Auto-Sync</p>
                        <p className={`text-[10px] ${subTextStyle}`}>Accessible across all your devices.</p>
                    </div>
                </div>
            </div>
        </motion.div>
    )

    return (
        <PageTransition
            className="min-h-screen relative"
            style={{ paddingBottom: 'calc(8.5rem + env(safe-area-inset-bottom))' }}
        >
            {/* ── Fixed floating action bar (always accessible, above everything) ── */}
            <div
                className="fixed left-0 right-0 z-[120] pointer-events-none"
                style={{ top: 0, paddingTop: 'calc(env(safe-area-inset-top) + 10px)' }}
            >
                <div className="max-w-5xl mx-auto px-[4vw] flex justify-between items-center pointer-events-auto">
                    <button
                        onClick={() => {
                            if (cameFromChat) {
                                setIsChatOpen(true)
                                navigate(-1)
                            } else {
                                navigate(-1)
                            }
                        }}
                        aria-label={cameFromChat ? 'Back to chat' : 'Go back'}
                        className="w-11 h-11 rounded-full bg-black/45 backdrop-blur-xl border border-white/15 text-white flex items-center justify-center shadow-lg hover:bg-black/60 active:scale-95 transition-all"
                    >
                        <ArrowLeft size={20} />
                    </button>
                    <div className="flex gap-2">
                        <button
                            onClick={shareLocation}
                            aria-label="Share"
                            className="w-11 h-11 rounded-full bg-black/45 backdrop-blur-xl border border-white/15 text-white flex items-center justify-center shadow-lg hover:bg-black/60 active:scale-95 transition-all"
                        >
                            <Share2 size={18} />
                        </button>
                        <button
                            onClick={() => addVisited(location.id)}
                            aria-label={isVisited ? 'Visited' : 'Mark as visited'}
                            className={`w-11 h-11 rounded-full backdrop-blur-xl border flex items-center justify-center shadow-lg active:scale-95 transition-all ${isVisited ? 'bg-emerald-600 border-emerald-400/60 text-white shadow-emerald-600/30' : 'bg-black/45 border-white/15 text-white hover:bg-black/60'}`}
                        >
                            <CheckCircle2 size={20} className={isVisited ? 'fill-white' : ''} />
                        </button>
                        <button
                            onClick={() => toggleFavorite(location.id)}
                            aria-label={isSaved ? 'Remove from saved' : 'Save'}
                            className={`w-11 h-11 rounded-full backdrop-blur-xl border flex items-center justify-center shadow-lg active:scale-95 transition-all ${isSaved ? 'bg-red-500 border-red-300/60 text-white shadow-red-500/30' : 'bg-black/45 border-white/15 text-white hover:bg-black/60'}`}
                        >
                            <Heart size={18} fill={isSaved ? 'currentColor' : 'none'} />
                        </button>
                    </div>
                </div>
            </div>

            {/* ── Scroll-aware compact header (fades in after hero scrolls away) ── */}
            <motion.div
                initial={false}
                animate={{ opacity: showCompactHeader ? 1 : 0, y: showCompactHeader ? 0 : -8 }}
                transition={{ duration: 0.2, ease: 'easeOut' }}
                className={`fixed top-0 left-0 right-0 z-[110] pointer-events-none ${showCompactHeader ? '' : 'pointer-events-none'}`}
                style={{ paddingTop: 'env(safe-area-inset-top)' }}
            >
                <div className={`h-14 flex items-center px-16 md:px-20 border-b backdrop-blur-xl ${isDark ? 'bg-[hsl(220,20%,3%)]/85 border-white/10' : 'bg-white/85 border-black/5'}`}>
                    <h2 className={`text-sm font-bold truncate mx-auto max-w-[60%] ${textStyle}`}>
                        {location.title}
                    </h2>
                </div>
            </motion.div>

            {/* ── Share toast ────────────────────────────────────────────────────── */}
            <AnimatePresence>
                {shareToast && (
                    <motion.div
                        initial={{ opacity: 0, y: -8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -8 }}
                        className="fixed z-[130] left-1/2 -translate-x-1/2 px-4 py-2 rounded-full bg-black/80 backdrop-blur-md text-white text-xs font-semibold shadow-lg"
                        style={{ top: 'calc(env(safe-area-inset-top) + 70px)' }}
                    >
                        {shareToast}
                    </motion.div>
                )}
            </AnimatePresence>

            {/* ── Hero Image (full-bleed from top of viewport) ───────────────────── */}
            <div className="relative h-[55vh] md:h-[62vh] w-full overflow-hidden">
                <LocationImage
                    src={location.image}
                    alt={location.title}
                    width={1200}
                    priority={true}
                    className="object-cover"
                />
                {/* Top scrim to improve contrast for action bar */}
                <div className="absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-black/55 via-black/20 to-transparent z-10 pointer-events-none" />
                {/* Bottom scrim for title readability */}
                <div className="absolute inset-x-0 bottom-0 h-52 bg-gradient-to-t from-black/85 via-black/40 to-transparent z-10 pointer-events-none" />

                {/* Hero Info */}
                <div className="absolute bottom-7 left-[4vw] right-[4vw] z-20 space-y-3 max-w-5xl mx-auto">
                    <div className="flex items-center gap-2 flex-wrap">
                        <span className="bg-blue-600 text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full text-white shadow-lg">
                            {location.category}
                        </span>
                        <div className="flex items-center gap-1.5 bg-white/15 backdrop-blur-md px-2.5 py-1 rounded-full border border-white/25 text-white text-[11px] font-black">
                            <Star size={12} className="text-yellow-400 fill-yellow-400" />
                            {location.google_rating ?? location.rating ?? '—'}
                            {aggregate.count > 0 && (
                                <span className="text-white/70 font-semibold">· {aggregate.count}</span>
                            )}
                        </div>
                        {openLabel && (
                            <div className={`flex items-center gap-1.5 backdrop-blur-md px-2.5 py-1 rounded-full border text-[10px] font-black uppercase tracking-wider ${isOpen ? 'bg-emerald-500/20 border-emerald-400/40 text-emerald-100' : 'bg-red-500/20 border-red-400/40 text-red-100'}`}>
                                <span className={`w-1.5 h-1.5 rounded-full ${isOpen ? 'bg-emerald-400 animate-pulse' : 'bg-red-400'}`} />
                                {openLabel}
                            </div>
                        )}
                    </div>
                    <h1 className="text-[28px] leading-[1.05] md:text-5xl font-black text-white tracking-tight drop-shadow-md">
                        {location.title}
                    </h1>
                    <button
                        onClick={openInMaps}
                        className="flex items-center gap-1.5 text-white/85 font-semibold hover:text-white transition-all text-left group"
                    >
                        <MapPin size={14} className="text-blue-300 group-hover:scale-110 transition-transform" />
                        <span className="text-xs md:text-sm border-b border-white/0 group-hover:border-white/30 pb-0.5">{location.address}</span>
                    </button>
                </div>
            </div>

            {/* ── Main Content ───────────────────────────────────────────────────── */}
            <div className="max-w-5xl mx-auto px-[4vw] relative z-30">
                {/* Sticky tab bar */}
                <div
                    className="sticky z-40 -mx-[4vw] px-[4vw] py-3"
                    style={{ top: 'calc(env(safe-area-inset-top) + 56px)' }}
                >
                    <div className={`rounded-2xl backdrop-blur-xl border ${isDark ? 'bg-[hsl(220,20%,6%)]/85 border-white/[0.06]' : 'bg-white/85 border-black/5 shadow-sm'}`}>
                        <div
                            onScroll={handleScroll}
                            className="p-1.5 rounded-2xl flex gap-1 items-center overflow-x-auto scrollbar-hide w-full"
                        >
                            {['Overview', 'Menu', 'Reviews', 'Photos', 'Notes'].map((tab) => (
                                <button
                                    key={tab}
                                    onClick={() => setActiveTab(tab)}
                                    className={`relative flex-shrink-0 px-5 md:px-7 py-2.5 rounded-xl text-[13px] font-bold transition-all ${activeTab === tab ? 'text-white' : isDark ? 'text-white/60 hover:text-white' : 'text-gray-600 hover:text-gray-900'}`}
                                >
                                    {activeTab === tab && (
                                        <motion.span
                                            layoutId="activeTabPill"
                                            className="absolute inset-0 bg-blue-600 rounded-xl shadow-md shadow-blue-500/30"
                                            transition={{ type: 'spring', bounce: 0.2, duration: 0.5 }}
                                        />
                                    )}
                                    <span className="relative z-10">{tab}</span>
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                <div className="pt-6">
                    {activeTab === 'Overview' && renderOverview()}
                    {activeTab === 'Menu' && renderMenu()}
                    {activeTab === 'Reviews' && renderReviews()}
                    {activeTab === 'Photos' && renderPhotos()}
                    {activeTab === 'Notes' && renderNotes()}
                </div>
            </div>

            {/* ── Sticky bottom CTA bar (above BottomNav) ─────────────────────────── */}
            <div
                className="fixed left-0 right-0 z-[50] pointer-events-none px-4"
                style={{ bottom: 'calc(5.75rem + env(safe-area-inset-bottom))' }}
            >
                <div className="max-w-md mx-auto pointer-events-auto">
                    <div className={`flex gap-2 p-2 rounded-[22px] border backdrop-blur-2xl shadow-2xl ${isDark ? 'bg-black/70 border-white/10 shadow-black/50' : 'bg-white/95 border-slate-200/80 shadow-slate-900/15'}`}>
                        {location?.phone && (
                            <button
                                onClick={callNumber}
                                aria-label="Call"
                                className={`flex-1 min-h-[46px] flex items-center justify-center gap-1.5 rounded-[16px] font-bold text-xs transition-all active:scale-95 ${isDark ? 'bg-white/10 text-white hover:bg-white/15' : 'bg-slate-100 text-slate-800 hover:bg-slate-200'}`}
                            >
                                <Phone size={15} />
                                <span className="hidden xs:inline">Call</span>
                            </button>
                        )}
                        <button
                            onClick={openInMaps}
                            aria-label="Get directions"
                            className="flex-[1.3] min-h-[46px] flex items-center justify-center gap-1.5 rounded-[16px] bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-md shadow-blue-500/30 transition-all active:scale-95"
                        >
                            <Navigation size={15} />
                            Directions
                        </button>
                        <button
                            onClick={shareLocation}
                            aria-label="Share"
                            className={`flex-1 min-h-[46px] flex items-center justify-center gap-1.5 rounded-[16px] font-bold text-xs transition-all active:scale-95 ${isDark ? 'bg-white/10 text-white hover:bg-white/15' : 'bg-slate-100 text-slate-800 hover:bg-slate-200'}`}
                        >
                            <Share2 size={15} />
                            <span className="hidden xs:inline">Share</span>
                        </button>
                    </div>
                </div>
            </div>
        </PageTransition>
    )
}

export default LocationDetailsPage
