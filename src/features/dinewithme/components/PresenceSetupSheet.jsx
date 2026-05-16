/**
 * PresenceSetupSheet — bottom sheet for setting your dining presence.
 *
 * Fields:
 * - Venue picker (search existing GastroMap locations)
 * - Status radio (looking / eating / heading_to)
 * - Arriving time (optional)
 * - Party size stepper
 * - Message (free text, max 200 chars)
 * - Contact info (free text, max 200 chars)
 * - Visibility toggle
 * - "Go Visible" button
 */
import React, { useState, useMemo, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Search, Minus, Plus, Eye, EyeOff, Loader2, MapPin, Trash2, AlertCircle } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useTheme } from '@/hooks/useTheme'
import { useLocations } from '@/shared/api/queries/location.queries'
import { useDiningPresence } from '../hooks/useDiningPresence'

const STATUSES = ['looking', 'eating', 'heading_to']

const STATUS_COLORS = {
    looking: 'border-emerald-500 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
    eating: 'border-blue-500 bg-blue-500/10 text-blue-600 dark:text-blue-400',
    heading_to: 'border-amber-500 bg-amber-500/10 text-amber-600 dark:text-amber-400',
}

const STATUS_DOTS = {
    looking: 'bg-emerald-500',
    eating: 'bg-blue-500',
    heading_to: 'bg-amber-500',
}

export function PresenceSetupSheet({ isOpen, onClose, existingPresence, onDelete }) {
    const { t } = useTranslation()
    const { theme } = useTheme()
    const isDark = theme === 'dark'
    const { goVisible, isGoingVisible } = useDiningPresence()
    const [isDeleting, setIsDeleting] = useState(false)

    const { data: locationsResult = [], isLoading: isLoadingLocations } = useLocations()
    const locations = Array.isArray(locationsResult) ? locationsResult : (locationsResult?.data ?? [])

    // Form state
    const [venueSearch, setVenueSearch] = useState('')
    const [selectedVenue, setSelectedVenue] = useState(null)
    const [status, setStatus] = useState('looking')
    const [arrivingAt, setArrivingAt] = useState('')
    const [partySize, setPartySize] = useState(1)
    const [message, setMessage] = useState('')
    const [contactInfo, setContactInfo] = useState('')
    const [visibility, setVisibility] = useState('everyone')

    // Venue search results
    const venueResults = useMemo(() => {
        if (!venueSearch.trim()) return []
        const q = venueSearch.toLowerCase()
        return locations
            .filter(loc =>
                (loc.title || loc.name || '').toLowerCase().includes(q)
                && loc.lat && loc.lng
            )
            .slice(0, 8)
    }, [venueSearch, locations])

    const canSubmit = selectedVenue && status

    const handleSubmit = async () => {
        if (!canSubmit) return

        try {
            await goVisible({
                locationId: selectedVenue.id,
                lat: Number(selectedVenue.lat),
                lng: Number(selectedVenue.lng),
                status,
                message,
                contactInfo,
                partySize,
                arrivingAt: arrivingAt ? (() => {
                    const [h, m] = arrivingAt.split(':').map(Number)
                    const d = new Date()
                    d.setHours(h, m, 0, 0)
                    return d.toISOString()
                })() : undefined,
                visibility,
            })
            onClose()
        } catch (err) {
            console.error('[PresenceSetupSheet] goVisible error:', err)
        }
    }

    const handleDelete = useCallback(async () => {
        if (!onDelete) return
        setIsDeleting(true)
        try {
            await onDelete()
            onClose()
        } catch (err) {
            console.error('[PresenceSetupSheet] delete error:', err)
        } finally {
            setIsDeleting(false)
        }
    }, [onDelete, onClose])

    if (!isOpen) return null

    const inputCls = `
        w-full px-4 py-3 rounded-xl text-sm
        ${isDark
            ? 'bg-white/5 border border-white/10 text-white placeholder-gray-500 focus:border-emerald-500/50'
            : 'bg-gray-50 border border-gray-200 text-gray-900 placeholder-gray-400 focus:border-emerald-500'
        }
        outline-none transition-colors backdrop-blur-sm
    `

    return createPortal(
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-[200] flex items-center justify-center p-4"
            >
                {/* Backdrop */}
                <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

                {/* Center card */}
                <motion.div
                    initial={{ opacity: 0, scale: 0.95, y: 20 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: 20 }}
                    transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                    className={`
                        relative w-full max-w-lg
                        rounded-3xl overflow-hidden
                        ${isDark ? 'bg-[#1c1c1e] border-white/10' : 'bg-white border-gray-200'}
                        backdrop-blur-2xl border
                        text-gray-900 dark:text-white
                        shadow-2xl shadow-black/20
                        max-h-[85vh] overflow-y-auto
                    `}
                >
                    {/* Header */}
                    <div className="px-6 pb-4 flex items-center justify-between pt-5">
                        <h2 className="text-lg font-bold">{t('dine.setup_title')}</h2>
                        <button
                            onClick={onClose}
                            className={`p-2 rounded-xl ${isDark ? 'text-gray-400 hover:bg-white/5' : 'text-gray-400 hover:bg-gray-100'}`}
                        >
                            <X size={18} />
                        </button>
                    </div>

                    <div className="px-6 pb-8 space-y-5">
                        {existingPresence ? (
                            <div className={`rounded-2xl border p-5 space-y-4 ${isDark ? 'bg-amber-500/5 border-amber-500/20' : 'bg-amber-50 border-amber-200'}`}>
                                <div className="flex items-start gap-3">
                                    <AlertCircle size={20} className="text-amber-500 flex-shrink-0 mt-0.5" />
                                    <div>
                                        <h3 className={`text-sm font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                                            {t('dine.active_meetup_exists', 'You already have an active meetup')}
                                        </h3>
                                        <p className={`text-xs mt-1 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                                            {existingPresence.venueName || t('dine.venue_required')}
                                        </p>
                                    </div>
                                </div>
                                <motion.button
                                    whileTap={{ scale: 0.97 }}
                                    onClick={handleDelete}
                                    disabled={isDeleting}
                                    className="
                                        w-full py-3 rounded-2xl font-bold text-sm transition-all
                                        bg-red-500 hover:bg-red-600 text-white shadow-lg shadow-red-500/20
                                        disabled:opacity-50 disabled:cursor-not-allowed
                                        flex items-center justify-center gap-2
                                    "
                                >
                                    {isDeleting ? (
                                        <Loader2 size={16} className="animate-spin" />
                                    ) : (
                                        <Trash2 size={16} />
                                    )}
                                    {t('dine.delete_current_meetup', 'Delete Current Meetup')}
                                </motion.button>
                            </div>
                        ) : (
                            <>
                                {/* Venue picker */}
                        <div>
                            <label className={`text-[11px] font-bold uppercase tracking-wider mb-2 block ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                                {t('dine.venue_label')}
                            </label>

                            {selectedVenue ? (
                                <div className={`flex items-center gap-3 p-3 rounded-xl border ${isDark ? 'bg-emerald-500/5 border-emerald-500/20' : 'bg-emerald-50 border-emerald-200'}`}>
                                    <MapPin size={16} className="text-emerald-500 flex-shrink-0" />
                                    <span className="text-sm font-semibold flex-1 truncate">
                                        {selectedVenue.title || selectedVenue.name}
                                    </span>
                                    <button
                                        onClick={() => setSelectedVenue(null)}
                                        className={`text-xs ${isDark ? 'text-gray-400 hover:text-white' : 'text-gray-500 hover:text-gray-900'}`}
                                    >
                                        <X size={14} />
                                    </button>
                                </div>
                            ) : (
                                <>
                                    <div className="relative">
                                        <Search size={16} className={`absolute left-3 top-1/2 -translate-y-1/2 ${isDark ? 'text-gray-500' : 'text-gray-400'}`} />
                                        <input
                                            type="text"
                                            value={venueSearch}
                                            onChange={e => setVenueSearch(e.target.value)}
                                            placeholder={t('dine.venue_placeholder')}
                                            className={`${inputCls} pl-10`}
                                        />
                                    </div>

                                    {/* Search results */}
                                    {venueSearch.trim() && venueResults.length > 0 && (
                                        <div className={`mt-2 rounded-xl border overflow-hidden max-h-48 overflow-y-auto ${isDark ? 'bg-white/5 border-white/10' : 'bg-white border-gray-200'} backdrop-blur-sm`}>
                                            {venueResults.map(venue => (
                                                <button
                                                    key={venue.id}
                                                    onClick={() => {
                                                        setSelectedVenue(venue)
                                                        setVenueSearch('')
                                                    }}
                                                    className={`
                                                        w-full text-left px-4 py-3 text-sm
                                                        flex items-center gap-2
                                                        ${isDark ? 'hover:bg-white/5' : 'hover:bg-gray-50'}
                                                        border-b last:border-b-0
                                                        ${isDark ? 'border-white/5' : 'border-gray-100'}
                                                    `}
                                                >
                                                    <MapPin size={14} className="text-blue-500 flex-shrink-0" />
                                                    <div className="min-w-0">
                                                        <p className="truncate font-medium">{venue.title || venue.name}</p>
                                                        <p className={`text-[11px] truncate ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>
                                                            {venue.address || venue.city}
                                                        </p>
                                                    </div>
                                                </button>
                                            ))}
                                        </div>
                                    )}

                                    {/* No results hint */}
                                    {venueSearch.trim() && venueResults.length === 0 && !isLoadingLocations && (
                                        <p className={`mt-2 text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                                            {t('dine.venue_no_results', 'No venues found. Try a different name.')}
                                        </p>
                                    )}

                                    {/* Loading hint */}
                                    {isLoadingLocations && venueSearch.trim() && (
                                        <p className={`mt-2 text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                                            {t('dine.venue_loading', 'Loading venues...')}
                                        </p>
                                    )}
                                </>
                            )}
                        </div>

                        {/* Status */}
                        <div>
                            <label className={`text-[11px] font-bold uppercase tracking-wider mb-2 block ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                                {t('dine.status_label')}
                            </label>
                            <div className="flex gap-2">
                                {STATUSES.map(s => (
                                    <button
                                        key={s}
                                        onClick={() => setStatus(s)}
                                        className={`
                                            flex-1 py-2.5 rounded-xl text-xs font-bold
                                            border-2 transition-all
                                            ${status === s
                                                ? STATUS_COLORS[s]
                                                : isDark
                                                    ? 'border-white/10 text-gray-400 hover:border-white/20'
                                                    : 'border-gray-200 text-gray-400 hover:border-gray-300'
                                            }
                                        `}
                                    >
                                        <div className="flex items-center justify-center gap-1.5">
                                            <div className={`w-2 h-2 rounded-full ${status === s ? STATUS_DOTS[s] : isDark ? 'bg-gray-600' : 'bg-gray-300'}`} />
                                            {t(`dine.status_${s}`)}
                                        </div>
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Arriving at + Party size */}
                        <div className="flex gap-3 min-w-0">
                            <div className="flex-1 min-w-0">
                                <label className={`text-[11px] font-bold uppercase tracking-wider mb-2 block ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                                    {t('dine.arriving_at')}
                                </label>
                                <input
                                    type="time"
                                    value={arrivingAt}
                                    onChange={e => setArrivingAt(e.target.value)}
                                    className={`${inputCls} min-w-0 max-w-[140px] sm:max-w-full`}
                                />
                            </div>
                            <div className="w-32 shrink-0">
                                <label className={`text-[11px] font-bold uppercase tracking-wider mb-2 block ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                                    {t('dine.party_size')}
                                </label>
                                <div className="flex items-center gap-1">
                                    <button
                                        onClick={() => setPartySize(Math.max(1, partySize - 1))}
                                        className={`w-10 h-10 rounded-xl flex items-center justify-center ${isDark ? 'bg-white/5 hover:bg-white/10 text-white' : 'bg-gray-50 hover:bg-gray-100 text-gray-900'}`}
                                    >
                                        <Minus size={14} />
                                    </button>
                                    <span className="w-8 text-center text-sm font-bold">{partySize}</span>
                                    <button
                                        onClick={() => setPartySize(Math.min(10, partySize + 1))}
                                        className={`w-10 h-10 rounded-xl flex items-center justify-center ${isDark ? 'bg-white/5 hover:bg-white/10 text-white' : 'bg-gray-50 hover:bg-gray-100 text-gray-900'}`}
                                    >
                                        <Plus size={14} />
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* Message */}
                        <div>
                            <label className={`text-[11px] font-bold uppercase tracking-wider mb-2 block ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                                {t('dine.message_label')}
                            </label>
                            <textarea
                                value={message}
                                onChange={e => setMessage(e.target.value.slice(0, 200))}
                                placeholder={t('dine.message_placeholder')}
                                rows={2}
                                className={`${inputCls} resize-none`}
                            />
                            <p className={`text-[10px] mt-1 text-right ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                                {message.length}/200
                            </p>
                        </div>

                        {/* Contact info */}
                        <div>
                            <label className={`text-[11px] font-bold uppercase tracking-wider mb-2 block ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                                {t('dine.contact_label')}
                            </label>
                            <textarea
                                value={contactInfo}
                                onChange={e => setContactInfo(e.target.value.slice(0, 200))}
                                placeholder={t('dine.contact_placeholder')}
                                rows={2}
                                className={`${inputCls} resize-none`}
                            />
                            <p className={`text-[10px] mt-1 text-right ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                                {contactInfo.length}/200
                            </p>
                        </div>

                        {/* Visibility */}
                        <div className={`flex items-center justify-between p-3 rounded-xl ${isDark ? 'bg-white/5' : 'bg-gray-50'}`}>
                            <div className="flex items-center gap-2">
                                {visibility === 'everyone' ? (
                                    <Eye size={16} className="text-emerald-500" />
                                ) : (
                                    <EyeOff size={16} className="text-gray-400" />
                                )}
                                <span className="text-sm font-medium">
                                    {t(`dine.visibility_${visibility}`)}
                                </span>
                            </div>
                            <button
                                onClick={() => setVisibility(v => v === 'everyone' ? 'friends_only' : 'everyone')}
                                className={`
                                    w-11 h-6 rounded-full relative transition-colors
                                    ${visibility === 'everyone' ? 'bg-emerald-500' : isDark ? 'bg-gray-600' : 'bg-gray-300'}
                                `}
                            >
                                <motion.div
                                    animate={{ x: visibility === 'everyone' ? 20 : 2 }}
                                    className="w-5 h-5 rounded-full bg-white shadow-sm absolute top-0.5"
                                />
                            </button>
                        </div>

                        {/* Submit */}
                        <div>
                            <motion.button
                                whileTap={{ scale: 0.97 }}
                                onClick={handleSubmit}
                                disabled={!canSubmit || isGoingVisible}
                                className={`
                                    w-full py-4 rounded-2xl font-bold text-sm transition-all
                                    ${canSubmit && !isGoingVisible
                                        ? 'bg-emerald-500 hover:bg-emerald-600 text-white shadow-lg shadow-emerald-500/30'
                                        : isDark
                                            ? 'bg-white/5 text-gray-500 cursor-not-allowed'
                                            : 'bg-white/10 text-gray-400 cursor-not-allowed'
                                    }
                                `}
                            >
                                {isGoingVisible ? (
                                    <span className="flex items-center justify-center gap-2">
                                        <Loader2 size={16} className="animate-spin" />
                                        {t('dine.going_visible')}
                                    </span>
                                ) : (
                                    t('dine.go_visible')
                                )}
                            </motion.button>
                            {!canSubmit && !isGoingVisible && (
                                <p className={`text-center text-[11px] mt-2 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                                    {t('dine.venue_required')}
                                </p>
                            )}
                        </div>
                    </>
                )}
            </div>
                </motion.div>
            </motion.div>
        </AnimatePresence>,
        document.body
    )
}
