import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Link, useNavigate } from 'react-router-dom'
import {
    Star, MapPin, Utensils, Coffee, ChevronRight, Award,
    Settings, LogOut, User, Lock, MessageSquare, FileText,
    HelpCircle, Mail, Shield, Globe, UserX, PlusCircle, CheckCircle2, Clock, Sparkles, Users, ShieldCheck
} from 'lucide-react'
import { useAuthStore } from '@/shared/store/useAuthStore'
import { useUserPrefsStore } from '@/shared/store/useUserPrefsStore'
import { useUserVisits, useUserFavorites, useUserReviews, useUserRank, useSendFeedbackMutation, useUserPreferences, useUserWaitlistStatus, useJoinWaitlistMutation } from '@/shared/api/queries'
import { useTheme } from '@/hooks/useTheme'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import { APP_CONFIG } from '@/shared/config/appConfig'

// Simple Feedback Modal Component nested for convenience
const FeedbackModal = ({ isOpen, onClose, theme, userId, onSuccess }) => {
    const { t } = useTranslation()
    const [message, setMessage] = useState('')
    const [type, setType] = useState('suggestion') // default type
    const sendFeedback = useSendFeedbackMutation()
    
    const isDark = theme === 'dark'
    if (!isOpen || typeof document === 'undefined') return null

    const handleSubmit = async () => {
        if (!message.trim()) return
        
        try {
            await sendFeedback.mutateAsync({
                userId,
                type,
                message,
                metadata: { timestamp: new Date().toISOString() }
            })
            setMessage('')
            onClose()
            onSuccess?.()
        } catch (error) {
            console.error('Failed to send feedback:', error)
        }
    }

    return createPortal(
        <AnimatePresence>
            <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
                <motion.div
                    initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                    onClick={onClose} className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                />
                <motion.div
                    initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
                    className={`relative w-full max-w-md p-6 rounded-[32px] overflow-hidden shadow-2xl border ${isDark ? 'bg-[#1a1a1a] border-white/10 text-white' : 'bg-white border-slate-200/50 text-gray-900'}`}
                >
                    <h3 className="text-2xl font-bold mb-2">{t('profile.feedback_title')}</h3>
                    <p className={`text-sm mb-4 ${isDark ? 'text-white/60' : 'text-slate-600'}`}>{t('profile.feedback_desc')}</p>

                    <div className="flex gap-2 mb-4">
                        {['suggestion', 'bug', 'other'].map(tKey => (
                            <button
                                key={tKey}
                                onClick={() => setType(tKey)}
                                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                                    type === tKey 
                                        ? 'bg-blue-600 text-white' 
                                        : (isDark ? 'bg-white/5 text-white/40' : 'bg-gray-100 text-gray-500')
                                }`}
                            >
                                {tKey.charAt(0).toUpperCase() + tKey.slice(1)}
                            </button>
                        ))}
                    </div>

                    <textarea
                        value={message}
                        onChange={(e) => setMessage(e.target.value)}
                        className={`w-full h-32 p-4 rounded-2xl resize-none text-sm outline-none border focus:border-blue-500 transition-colors ${isDark ? 'bg-white/5 border-white/10 text-white placeholder-white/30' : 'bg-gray-50 border-slate-200/50 text-gray-900'}`}
                        placeholder={t('profile.feedback_placeholder')}
                    />

                    <div className="flex gap-3 mt-6">
                        <button onClick={onClose} className={`flex-1 py-3.5 rounded-xl font-bold text-sm transition-colors ${isDark ? 'bg-white/5 hover:bg-white/10 text-white' : 'bg-gray-100 hover:bg-gray-200 text-gray-700'}`}>{t('common.cancel')}</button>
                        <button 
                            onClick={handleSubmit} 
                            disabled={!message.trim() || sendFeedback.isPending}
                            className={`flex-1 py-3.5 rounded-xl font-bold text-sm bg-blue-600 text-white shadow-lg shadow-blue-500/20 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2`}
                        >
                            {sendFeedback.isPending && <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
                            {t('profile.feedback_send')}
                        </button>
                    </div>
                </motion.div>
            </div>
        </AnimatePresence>,
        document.body
    )
}

const ProfilePage = () => {
    const { t } = useTranslation()
    const { user: authUser, logout } = useAuthStore()
    const navigate = useNavigate()

    // ── ALL hooks must be called unconditionally (Rules of Hooks) ──
    const { theme } = useTheme()
    const isDark = theme === 'dark'

    const [signingOut, setSigningOut] = useState(false)
    const [isFeedbackOpen, setIsFeedbackOpen] = useState(false)
    const [toast, setToast] = useState(null)

    // ── Dine With Me waitlist (Supabase-backed) ──
    const { data: waitlistData } = useUserWaitlistStatus(authUser?.id)
    const joinWaitlistMut = useJoinWaitlistMutation()
    const waitlistJoined = !!waitlistData || localStorage.getItem('gastromap_dine_waitlist') === 'true'

    const handleJoinWaitlist = async () => {
        try {
            await joinWaitlistMut.mutateAsync({ userId: authUser?.id, message: null })
        } catch {
            // Even if Supabase call fails, fall back to localStorage
        }
        localStorage.setItem('gastromap_dine_waitlist', 'true')
        setToast({ message: t('profile.dine_waitlist_toast', "You're on the list! We'll notify you when it's ready."), type: 'success' })
    }

    // Styling (derived from hooks, not hooks themselves)
    const textStyle = isDark ? "text-white" : "text-gray-900"
    const subTextStyle = isDark ? "text-white/55" : "text-slate-600"
    const cardBg = isDark
        ? "bg-[#1f2128]/80 border-white/5"
        : "bg-white border-slate-200/70 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_2px_10px_rgba(15,23,42,0.05)]"
    const itemHover = isDark ? "hover:bg-white/5" : "hover:bg-slate-50"

    // Real data from Supabase — safe with undefined userId (queries stay disabled)
    const { data: visits = [] }    = useUserVisits(authUser?.id)
    const { data: favorites = [] } = useUserFavorites(authUser?.id)
    const { data: reviews = [] }   = useUserReviews(authUser?.id)
    const { data: rankData }       = useUserRank(authUser?.id)

    // DNA profile from local store (synced from Supabase via onboarding)
    const { prefs: localPrefs } = useUserPrefsStore()
    const { data: remotePrefs } = useUserPreferences(authUser?.id)
    
    // Combine local and remote for the best experience (remote takes precedence)
    const prefs = {
        ...localPrefs,
        foodieDNA: remotePrefs?.longTerm?.foodieDNA || localPrefs.foodieDNA,
        atmospherePreference: remotePrefs?.longTerm?.atmospherePreference || localPrefs.atmospherePreference,
        features: remotePrefs?.longTerm?.features || localPrefs.features
    }

    // Redirect to login if not authenticated
    if (!authUser) {
        navigate('/login', { replace: true })
        return null
    }
    const user = authUser

    const handleSignOut = async () => {
        setSigningOut(true)
        try {
            await logout()
        } finally {
            // Hard redirect — clears all in-memory state, no auth-listener races
            window.location.href = '/login'
        }
    }

    const showToast = (msg) => {
        setToast(msg)
        setTimeout(() => setToast(null), 3500)
    }

    const stats = [
        { label: t('profile.level'), val: rankData?.points > 100 ? t('profile.rank_expert') : rankData?.points > 20 ? t('profile.rank_regular') : t('profile.rank_newbie'), icon: Star, color: 'text-yellow-500 bg-yellow-500/10', link: null },
        { label: t('profile.visited'), val: visits.length.toString(), icon: MapPin, color: 'text-blue-500 bg-blue-500/10', link: '/visited' },
        { label: t('profile.reviews'), val: reviews.length.toString(), icon: Utensils, color: 'text-green-500 bg-green-500/10', link: '/dashboard/my-submissions' },
        { label: t('profile.saved'), val: favorites.length.toString(), icon: Coffee, color: 'text-indigo-500 bg-indigo-500/10', link: '/saved' },
    ]

    const contributions = reviews.slice(0, 3).map(r => ({
        id: r.id,
        name: r.locations?.title || 'Location',
        isApproved: r.status === 'approved' || r.status === 'published',
        statusLabel: (r.status === 'approved' || r.status === 'published') ? t('profile.published') : t('profile.pending'),
        points: (r.status === 'approved' || r.status === 'published') ? '+5 XP' : t('profile.in_review'),
        date: r.created_at ? new Date(r.created_at).toLocaleDateString() : '—',
    }))

    const menuItems = [
        {
            section: t('profile.section_account'),
            items: [
                ...(authUser?.role === 'admin' ? [{ icon: ShieldCheck, label: t('profile.admin_panel'), link: "/admin", highlight: true }] : []),
                { icon: User, label: t('profile.personal_info'), link: "/profile/edit" },
                { icon: Globe, label: t('profile.language_region'), disabled: true, value: "Coming Soon" },
                { icon: Lock, label: t('profile.security'), link: "/profile/security" },
            ]
        },
        {
            section: t('profile.section_support'),
            items: [
                { icon: MessageSquare, label: t('profile.send_feedback'), action: () => setIsFeedbackOpen(true) },
                { icon: HelpCircle, label: t('profile.help_center'), link: "/help" },
            ]
        },
        {
            section: t('profile.section_legal'),
            items: [
                { icon: FileText, label: t('profile.terms'), link: "/terms" },
                { icon: Shield, label: t('profile.privacy_policy'), link: "/privacy" },
                { icon: UserX, label: t('profile.gdpr'), link: "/privacy/delete-request" },
            ]
        },
        {
            section: t('profile.section_app'),
            items: [
                {
                    icon: Shield,
                    label: t('profile.check_updates'),
                    action: async () => {
                        if (!('serviceWorker' in navigator)) {
                            showToast(t('profile.sw_unsupported') || 'Updates not supported in this browser');
                            return;
                        }
                        try {
                            const registration = await navigator.serviceWorker.getRegistration();
                            if (!registration) {
                                showToast(t('profile.sw_not_registered') || 'Service Worker not registered');
                                return;
                            }

                            // 1. If a new version is already waiting → apply immediately
                            if (registration.waiting) {
                                showToast(t('profile.sw_downloaded') || 'New version downloaded! Reloading...');
                                registration.waiting.postMessage({ type: 'SKIP_WAITING' });
                                setTimeout(() => window.location.reload(), 1500);
                                return;
                            }

                            showToast(t('profile.sw_checking') || 'Checking for updates...');

                            // 2. Listen for the new SW to be found / installed / activated
                            const updateResult = await new Promise((resolve) => {
                                let foundNew = false;

                                // When a new SW is found
                                registration.addEventListener('updatefound', () => {
                                    foundNew = true;
                                    const newWorker = registration.installing;

                                    newWorker.addEventListener('statechange', () => {
                                        if (newWorker.state === 'installed') {
                                            // New version downloaded and ready
                                            resolve('downloaded');
                                        } else if (newWorker.state === 'redundant') {
                                            // New SW failed to install
                                            resolve('error');
                                        }
                                    });
                                });

                                // Trigger the update check
                                registration.update().catch(() => {});

                                // Timeout: if no updatefound fires in 5s, assume up-to-date
                                setTimeout(() => {
                                    if (!foundNew) resolve('up-to-date');
                                }, 5000);
                            });

                            if (updateResult === 'downloaded') {
                                showToast(t('profile.sw_downloaded') || 'New version downloaded! Reloading...');
                                // With skipWaiting + clientsClaim, a reload activates it
                                setTimeout(() => window.location.reload(), 1500);
                            } else if (updateResult === 'up-to-date') {
                                showToast(t('profile.sw_latest') || 'You\'re using the latest version');
                            } else {
                                showToast(t('profile.sw_error') || 'Update check failed');
                            }
                        } catch (err) {
                            console.error('SW Update check failed:', err);
                            showToast(t('profile.sw_error') || 'Failed to check for updates');
                        }
                    }
                },
            ]
        }
    ];

    return (
        <div className="w-full min-h-screen relative z-10 pb-32">
            <div className="max-w-7xl mx-auto w-full px-6 lg:px-8">
            <FeedbackModal 
                isOpen={isFeedbackOpen} 
                onClose={() => setIsFeedbackOpen(false)} 
                theme={theme} 
                userId={authUser?.id}
                onSuccess={() => showToast(t('profile.feedback_success') || 'Feedback sent successfully!')}
            />

            {/* Inline toast */}
            <AnimatePresence>
                {toast && (
                    <motion.div
                        initial={{ opacity: 0, y: 24 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 24 }}
                        className={`fixed bottom-28 left-1/2 -translate-x-1/2 z-[9999] px-5 py-3 rounded-2xl shadow-xl text-sm font-semibold backdrop-blur-md border max-w-xs text-center ${isDark ? 'text-white bg-gray-900/95 border-white/10' : 'text-white bg-gray-900/95 border-gray-700/50'}`}
                    >
                        {typeof toast === 'string' ? toast : toast.message}
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Profile Header - Compact */}
            <div className="pt-24 md:pt-10 px-6 flex flex-col items-center text-center">
                <div className="relative mb-4">
                    <div className="w-24 h-24 rounded-[32px] bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white text-3xl font-black shadow-2xl shadow-blue-500/30">
                        {user.name.charAt(0)}
                    </div>
                    <div className={`absolute -bottom-1 -right-1 bg-yellow-400 p-1.5 rounded-full text-white shadow-lg border-[3px] ${isDark ? 'border-[#0F1115]' : 'border-white'}`}>
                        <Award size={14} />
                    </div>
                </div>
                <h1 className={`text-2xl font-black mb-1 ${textStyle}`}>{user.name}</h1>
                <p className={`text-sm font-medium ${subTextStyle}`}>{user.email}</p>

                <div className="flex flex-wrap justify-center gap-2 mt-4">
                    {user?.role === 'admin' && (
                        <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide border flex items-center gap-1 ${isDark ? 'bg-indigo-500/10 border-indigo-500/30 text-indigo-400' : 'bg-indigo-50 border-indigo-200 text-indigo-600'}`}>
                            <ShieldCheck size={10} />Admin
                        </span>
                    )}
                    {user?.role !== 'admin' && (
                        <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide border ${isDark ? 'bg-blue-500/10 border-blue-500/20 text-blue-400' : 'bg-blue-50 border-blue-200 text-blue-600'}`}>Member</span>
                    )}
                </div>
            </div>

            {/* Compact Stats Grid */}
            <div className="px-5 mt-8">
                <div className="grid grid-cols-2 gap-3">
                    {stats.map((stat, i) => {
                        const inner = (
                            <>
                                <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${stat.color}`}>
                                    <stat.icon size={18} />
                                </div>
                                <div className="flex flex-col items-start overflow-hidden">
                                    <span className={`text-[10px] font-bold uppercase opacity-50 truncate w-full text-left ${textStyle}`}>{stat.label}</span>
                                    <span className={`text-base font-black truncate w-full text-left ${textStyle}`}>{stat.val}</span>
                                </div>
                            </>
                        )
                        return stat.link ? (
                            <button key={i} onClick={() => navigate(stat.link)} className={`p-4 rounded-2xl border flex items-center gap-3 transition-all active:scale-[0.97] ${itemHover} ${cardBg}`}>
                                {inner}
                            </button>
                        ) : (
                            <div key={i} className={`p-4 rounded-2xl border flex items-center gap-3 ${cardBg}`}>
                                {inner}
                            </div>
                        )
                    })}
                </div>
            </div>

            {/* My Contributions Section */}
            <div className="px-5 mt-8">
                <div className="flex items-center justify-between mb-4 px-2">
                    <h3 className={`text-[15px] font-black uppercase tracking-tight ${textStyle}`}>{t('profile.contributions')}</h3>
                    <Link to="/dashboard/add-place" className="flex items-center gap-1 text-xs font-semibold text-blue-500 hover:text-blue-600">
                        <PlusCircle size={13} /> {t('profile.add_place')}
                    </Link>
                </div>
                <div className={`rounded-[24px] overflow-hidden border backdrop-blur-sm ${cardBg}`}>
                    {contributions.length > 0 ? (
                        contributions.map((item, idx) => (
                            <div
                                key={item.id}
                                className={`flex items-center justify-between p-4 ${idx !== contributions.length - 1 ? (isDark ? 'border-b border-white/5' : 'border-b border-slate-200/50') : ''}`}
                            >
                                <div className="flex items-center gap-3">
                                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${item.isApproved ? 'bg-emerald-500/10 text-emerald-500' : 'bg-amber-500/10 text-amber-500'
                                        }`}>
                                        {item.isApproved ? <CheckCircle2 size={18} /> : <Clock size={18} />}
                                    </div>
                                    <div>
                                        <h4 className={`text-sm font-bold ${textStyle}`}>{item.name}</h4>
                                        <p className={`text-xs font-medium ${subTextStyle}`}>{item.date}</p>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${item.isApproved ? 'bg-emerald-500/10 text-emerald-500' : 'bg-amber-500/10 text-amber-500'
                                        }`}>
                                        {item.statusLabel}
                                    </span>
                                    {item.isApproved && (
                                        <p className="text-[10px] font-black text-blue-500 mt-1">{item.points}</p>
                                    )}
                                </div>
                            </div>
                        ))
                    ) : (
                        <div className="p-6 text-center">
                            <p className={`text-sm ${subTextStyle}`}>{t('profile.no_contributions')}</p>
                        </div>
                    )}
                </div>
            </div>

            {/* Taste Preferences Section - "The Foodie DNA" */}
            <div className="px-5 mt-8">
                <div className={`p-6 rounded-[32px] border backdrop-blur-md ${cardBg}`}>
                    <div className="flex items-center justify-between mb-6">
                        <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center text-blue-500">
                                <Utensils size={18} />
                            </div>
                            <h3 className={`text-[15px] font-black uppercase tracking-tight ${textStyle}`}>{t('profile.taste_profile')}</h3>
                        </div>
                        <button
                            onClick={() => navigate('/profile/edit')}
                            className={`text-[11px] font-bold px-3 py-1.5 rounded-full transition-colors ${isDark ? 'bg-white/5 hover:bg-white/10 text-white/60' : 'bg-gray-100 hover:bg-gray-200 text-gray-500'}`}
                        >
                            {t('profile.edit')}
                        </button>
                    </div>

                    <div className="space-y-5">
                        {/* Cuisines */}
                        <div className="space-y-2">
                            <label className={`text-[10px] font-black uppercase tracking-widest opacity-40 ml-1 ${textStyle}`}>{t('profile.cuisines_label')}</label>
                            {prefs.favoriteCuisines?.length > 0 ? (
                                <div className="flex flex-wrap gap-2">
                                    {prefs.favoriteCuisines.map(c => (
                                        <span key={c} className={`px-3 py-1.5 rounded-full text-xs font-bold border ${isDark ? 'bg-blue-500/10 border-blue-500/20 text-blue-400' : 'bg-blue-50 border-blue-100 text-blue-600'}`}>
                                            {c}
                                        </span>
                                    ))}
                                </div>
                            ) : (
                                <p className={`text-xs italic ${subTextStyle} opacity-60`}>{t('profile.not_set')}</p>
                            )}
                        </div>

                        {/* Foodie DNA Description */}
                        <div className="space-y-2">
                            <label className={`text-[10px] font-black uppercase tracking-widest opacity-40 ml-1 ${textStyle}`}>{t('profile.dna_label') || 'Foodie DNA'}</label>
                            {prefs.foodieDNA ? (
                                <p className={`text-sm leading-relaxed p-4 rounded-2xl border ${isDark ? 'bg-white/5 border-white/5 text-white/80' : 'bg-slate-50 border-slate-100 text-slate-700'}`}>
                                    {prefs.foodieDNA}
                                </p>
                            ) : (
                                <p className={`text-xs italic ${subTextStyle} opacity-60`}>{t('profile.not_set')}</p>
                            )}
                        </div>

                        {/* Atmosphere Description */}
                        <div className="space-y-2">
                            <label className={`text-[10px] font-black uppercase tracking-widest opacity-40 ml-1 ${textStyle}`}>{t('profile.atm_label') || 'Atmosphere'}</label>
                            {prefs.atmospherePreference ? (
                                <p className={`text-sm leading-relaxed p-4 rounded-2xl border ${isDark ? 'bg-indigo-500/5 border-indigo-500/10 text-indigo-100/70' : 'bg-indigo-50/50 border-indigo-100/50 text-indigo-900/70'}`}>
                                    {prefs.atmospherePreference}
                                </p>
                            ) : (
                                <p className={`text-xs italic ${subTextStyle} opacity-60`}>{t('profile.not_set')}</p>
                            )}
                        </div>

                        {/* Vibe Tags */}
                        <div className="space-y-2">
                            <label className={`text-[10px] font-black uppercase tracking-widest opacity-40 ml-1 ${textStyle}`}>{t('profile.vibes_label') || 'Vibe Tags'}</label>
                            {prefs.vibePreference?.length > 0 ? (
                                <div className="flex flex-wrap gap-2">
                                    {prefs.vibePreference.map(v => (
                                        <span key={v} className={`px-3 py-1.5 rounded-full text-xs font-bold border ${isDark ? 'bg-indigo-500/10 border-indigo-500/20 text-indigo-400' : 'bg-indigo-50 border-indigo-100 text-indigo-600'}`}>
                                            {v}
                                        </span>
                                    ))}
                                </div>
                            ) : (
                                <p className={`text-xs italic ${subTextStyle} opacity-60`}>{t('profile.not_set')}</p>
                            )}
                        </div>

                        {/* Important Features */}
                        <div className="space-y-2">
                            <label className={`text-[10px] font-black uppercase tracking-widest opacity-40 ml-1 ${textStyle}`}>{t('profile.features_label') || 'Important Features'}</label>
                            {prefs.features?.length > 0 ? (
                                <div className="flex flex-wrap gap-2">
                                    {prefs.features.map(f => (
                                        <span key={f} className={`px-3 py-1.5 rounded-full text-xs font-bold border ${isDark ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' : 'bg-emerald-50 border-emerald-100 text-emerald-600'}`}>
                                            {f}
                                        </span>
                                    ))}
                                </div>
                            ) : (
                                <p className={`text-xs italic ${subTextStyle} opacity-60`}>{t('profile.not_set')}</p>
                            )}
                        </div>

                        {/* Budget */}
                        <div className="space-y-2">
                            <label className={`text-[10px] font-black uppercase tracking-widest opacity-40 ml-1 ${textStyle}`}>{t('profile.budget_label') || 'Budget'}</label>
                            {prefs.priceRange?.length > 0 ? (
                                <div className="flex flex-wrap gap-2">
                                    {prefs.priceRange.map(p => (
                                        <span key={p} className={`px-3 py-1.5 rounded-full text-xs font-black border ${isDark ? 'bg-amber-500/10 border-amber-500/20 text-amber-400' : 'bg-amber-50 border-amber-100 text-amber-600'}`}>
                                            {p}
                                        </span>
                                    ))}
                                </div>
                            ) : (
                                <p className={`text-xs italic ${subTextStyle} opacity-60`}>{t('profile.not_set')}</p>
                            )}
                        </div>

                        {/* Allergens / Dietary */}
                        <div className="space-y-2">
                            <label className={`text-[10px] font-black uppercase tracking-widest opacity-40 ml-1 ${textStyle}`}>{t('profile.dietary_label') || 'Dietary & Allergens'}</label>
                            {prefs.dietaryRestrictions?.length > 0 ? (
                                <div className="flex flex-wrap gap-2">
                                    {prefs.dietaryRestrictions.map(a => (
                                        <span key={a} className={`px-3 py-1.5 rounded-full text-xs font-bold border ${isDark ? 'bg-rose-500/10 border-rose-500/20 text-rose-400' : 'bg-rose-50 border-rose-100 text-rose-600'}`}>
                                            {a}
                                        </span>
                                    ))}
                                </div>
                            ) : (
                                <p className={`text-xs italic ${subTextStyle} opacity-60`}>{t('profile.no_restrictions')}</p>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Experimental Features - Bio-Sync & Social */}
            <div className="px-5 mt-8">
                <div className="flex items-center justify-between mb-4 px-2">
                    <h3 className={`text-[15px] font-black uppercase tracking-tight ${textStyle} flex items-center gap-2`}>
                        <Sparkles size={16} className="text-amber-500" /> {t('profile.labs')}
                    </h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Bio-Sync AI Placeholder */}
                    <div className={`p-5 rounded-[24px] border border-blue-500/30 bg-gradient-to-br from-blue-500/10 to-transparent relative overflow-hidden group`}>
                        <div className="flex items-center gap-3 mb-3 relative z-10">
                            <div className="w-10 h-10 rounded-xl bg-blue-500 flex items-center justify-center text-white shadow-lg shadow-blue-500/30">
                                <Sparkles size={20} />
                            </div>
                            <div>
                                <h4 className={`text-base font-bold ${textStyle}`}>{t('profile.biosync_title')}</h4>
                                <p className="text-xs text-blue-500 font-bold tracking-wide uppercase">{t('profile.biosync_coming')}</p>
                            </div>
                        </div>
                        <p className={`text-sm ${subTextStyle} relative z-10 leading-relaxed`}>
                            {t('profile.biosync_desc')}
                        </p>
                        <button
                            onClick={() => showToast('🧬 Bio-Sync AI is coming soon — you\'ll be first to know!')}
                            className="mt-4 px-4 py-2 rounded-xl bg-blue-500/20 text-blue-600 dark:text-blue-400 font-bold text-xs relative z-10 hover:bg-blue-500/30 transition-colors active:scale-95"
                        >
                            {t('profile.biosync_btn')}
                        </button>
                    </div>

                    {/* Dine With Me Card */}
                    {authUser?.role === 'admin' || authUser?.role === 'moderator' ? (
                        /* Admin/Mod: active link to Dine With Me */
                        <Link to="/map?dine=true" className="block">
                            <div className={`p-5 rounded-[24px] border border-indigo-500/30 bg-gradient-to-br from-indigo-500/10 to-transparent relative overflow-hidden group hover:border-indigo-500/50 transition-colors`}>
                                <div className="flex items-center gap-3 mb-3 relative z-10">
                                    <div className="w-10 h-10 rounded-xl bg-indigo-500 flex items-center justify-center text-white shadow-lg shadow-indigo-500/30">
                                        <Users size={20} />
                                    </div>
                                    <div>
                                        <h4 className={`text-base font-bold ${textStyle}`}>{t('profile.dine_title')}</h4>
                                        <p className="text-xs text-indigo-500 font-bold tracking-wide uppercase">{t('profile.dine_beta')}</p>
                                    </div>
                                </div>
                                <p className={`text-sm ${subTextStyle} relative z-10 leading-relaxed`}>
                                    {t('profile.dine_desc')}
                                </p>
                                <div className="mt-4 px-4 py-2 rounded-xl bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 font-bold text-xs relative z-10 text-center group-hover:bg-indigo-500/30 transition-colors">
                                    {t('profile.dine_btn')}
                                </div>
                            </div>
                        </Link>
                    ) : (
                        /* Regular user: waitlist card */
                        <div className={`p-5 rounded-[24px] border ${isDark ? 'border-white/5' : 'border-gray-200'} bg-gradient-to-br from-indigo-500/5 to-transparent relative overflow-hidden`}>
                            <div className="flex items-center gap-3 mb-3 relative z-10">
                                <div className={`w-10 h-10 rounded-xl flex items-center justify-center shadow-lg ${isDark ? 'bg-white/10' : 'bg-gray-100'}`}>
                                    <Users size={20} className="text-indigo-400" />
                                </div>
                                <div>
                                    <h4 className={`text-base font-bold ${textStyle}`}>{t('profile.dine_title')}</h4>
                                    <p className={`text-xs font-bold tracking-wide uppercase ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>{t('profile.dine_coming_soon')}</p>
                                </div>
                            </div>
                            <p className={`text-sm ${subTextStyle} relative z-10 leading-relaxed`}>
                                {t('profile.dine_waitlist_desc')}
                            </p>
                            <button
                                onClick={() => handleJoinWaitlist()}
                                className={`mt-4 w-full px-4 py-2 rounded-xl font-bold text-xs text-center transition-colors ${
                                    waitlistJoined
                                        ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400'
                                        : 'bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-500/30'
                                }`}
                            >
                                {waitlistJoined ? t('profile.dine_waitlist_joined') : t('profile.dine_waitlist_btn')}
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {/* Settings Menu Groups */}
            <div className="px-5 mt-8 space-y-6">
                {menuItems.map((group, groupIdx) => (
                    <div key={groupIdx}>
                        <h3 className={`text-[11px] font-black uppercase tracking-widest px-2 mb-3 ${subTextStyle}`}>{group.section}</h3>
                        <div className={`rounded-[24px] overflow-hidden border backdrop-blur-sm ${cardBg}`}>
                            {group.items.map((item, idx) => (
                                <button
                                    key={idx}
                                    onClick={() => {
                                        if (item.disabled) return;
                                        if (item.action) { item.action(); return; }
                                        navigate(item.link);
                                    }}
                                    disabled={item.disabled}
                                    className={`w-full flex items-center justify-between p-4 transition-colors ${item.disabled ? 'opacity-60 cursor-not-allowed' : ''} ${item.highlight ? (isDark ? 'hover:bg-indigo-500/10' : 'hover:bg-indigo-50') : (item.disabled ? '' : itemHover)} ${idx !== group.items.length - 1 ? (isDark ? 'border-b border-white/5' : 'border-b border-slate-200/50') : ''}`}
                                >
                                    <div className="flex items-center gap-3.5">
                                        <div className={`p-2 rounded-xl ${item.highlight ? (isDark ? 'bg-indigo-500/15 text-indigo-400' : 'bg-indigo-50 text-indigo-600') : (isDark ? 'bg-white/5 text-white' : 'bg-gray-100 text-gray-600')}`}>
                                            <item.icon size={18} />
                                        </div>
                                        <span className={`text-[15px] font-bold ${item.highlight ? (isDark ? 'text-indigo-400' : 'text-indigo-600') : textStyle}`}>{item.label}</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        {item.value && <span className={`text-xs font-medium ${subTextStyle}`}>{item.value}</span>}
                                        <ChevronRight size={16} className={item.highlight ? (isDark ? 'text-indigo-400/50' : 'text-indigo-300') : (isDark ? 'text-white/30' : 'text-gray-300')} />
                                    </div>
                                </button>
                            ))}
                        </div>
                    </div>
                ))}
            </div>

            {/* Sign Out Action */}
            <div className="px-5 mt-8">
                <button
                    onClick={handleSignOut}
                    disabled={signingOut}
                    className={`w-full p-4 rounded-[24px] border flex items-center justify-center gap-2 font-black text-red-500 transition-all active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed ${isDark ? 'bg-red-500/10 border-red-500/20 hover:bg-red-500/20' : 'bg-red-50 border-red-100 hover:bg-red-100'}`}
                >
                    {signingOut
                        ? <span className="w-4 h-4 rounded-full border-2 border-red-400 border-t-transparent animate-spin" />
                        : <LogOut size={18} />
                    }
                    {signingOut ? t('profile.signing_out') || 'Signing out…' : t('profile.sign_out')}
                </button>

                <div className="text-center mt-6">
                    <p className={`text-[10px] font-medium ${isDark ? 'text-white/30' : 'text-slate-400'}`}>
                        {APP_CONFIG.NAME} v{APP_CONFIG.VERSION} • {APP_CONFIG.YEAR}
                    </p>
                </div>
            </div>

            </div>
        </div>
    )
}

export default ProfilePage
