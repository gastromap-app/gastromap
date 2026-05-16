import React, { useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Lock, Shield, Eye, Smartphone, LogOut, ChevronRight, UserX, Trash2, HardDrive, Monitor, Globe, Clock, MapPin } from 'lucide-react'
import { useTheme } from '@/hooks/useTheme'
import { useAuthStore } from '@/shared/store/useAuthStore'
import { useStorageQuota } from '@/hooks/useStorageQuota'

const SecurityPrivacyPage = () => {
    const { theme } = useTheme()
    const isDark = theme === 'dark'
    const navigate = useNavigate()
    const { logout, requestPasswordReset, user } = useAuthStore()
    const [toastMsg, setToastMsg] = useState('')
    const { usage, quota, percent, isWarning, clearCache, formatBytes } = useStorageQuota()

    const textStyle = isDark ? "text-white" : "text-gray-900"
    const subTextStyle = isDark ? "text-gray-500 dark:text-gray-400" : "text-gray-500"
    const cardBg = isDark ? "bg-[#1f2128]/80 border-white/5" : "bg-white border-slate-200/50"
    const itemHover = isDark ? "hover:bg-white/5" : "hover:bg-gray-50"

    const showToast = (msg) => { setToastMsg(msg); setTimeout(() => setToastMsg(''), 3000) }

    // ── Profile Visibility (localStorage-backed until DB column is added) ──
    const [profileVisibility, setProfileVisibility] = useState(() => {
        try { return localStorage.getItem('gastromap_profile_visibility') || 'Public' } catch { return 'Public' }
    })
    const toggleVisibility = useCallback(() => {
        const next = profileVisibility === 'Public' ? 'Private' : 'Public'
        setProfileVisibility(next)
        try { localStorage.setItem('gastromap_profile_visibility', next) } catch { /* storage unavailable */ }
        showToast(`Profile is now ${next.toLowerCase()}`)
    }, [profileVisibility])

    // ── Login Activity (derived from current session + browser info) ──
    const [showSessions, setShowSessions] = useState(false)
    const getDeviceInfo = () => {
        const ua = navigator.userAgent
        let device = 'Unknown Device'
        let browser = 'Unknown Browser'
        if (/iPhone|iPad|iPod/.test(ua)) device = 'Apple Mobile'
        else if (/Android/.test(ua)) device = 'Android'
        else if (/Mac/.test(ua)) device = 'Mac'
        else if (/Windows/.test(ua)) device = 'Windows'
        else if (/Linux/.test(ua)) device = 'Linux'
        if (/Chrome/.test(ua) && !/Edg/.test(ua)) browser = 'Chrome'
        else if (/Safari/.test(ua) && !/Chrome/.test(ua)) browser = 'Safari'
        else if (/Firefox/.test(ua)) browser = 'Firefox'
        else if (/Edg/.test(ua)) browser = 'Edge'
        return { device, browser }
    }
    const { device, browser } = getDeviceInfo()
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone
    const sessionTime = user?.createdAt
        ? new Date(user.createdAt).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })
        : 'Current session'

    const handleClearCache = async () => {
        try {
            await clearCache()
        } catch {
            showToast('Failed to clear cache. Please try again.')
        }
    }

    const handleChangePassword = async () => {
        if (!user?.email) return
        try {
            await requestPasswordReset(user.email)
            showToast('Password reset link sent to ' + user.email)
        } catch {
            showToast('Failed to send reset link. Please try again.')
        }
    }

    const handleLogout = async () => {
        await logout()
        window.location.href = '/login'
    }

    const securityItems = [
        { icon: Lock, label: "Change Password", description: "Send reset link to your email", action: handleChangePassword },
        { icon: Smartphone, label: "Two-Factor Authentication", description: "Coming soon", badge: 'Soon', action: () => {} },
        { icon: Eye, label: "Login Activity", description: showSessions ? "Hide session details" : "View active sessions", action: () => setShowSessions(s => !s) },
    ]

    const privacyItems = [
        { icon: Shield, label: "Profile Visibility", value: profileVisibility, action: toggleVisibility, toggle: true },
        { icon: UserX, label: "Request Data Deletion", description: "Permanent deletion of your account", action: () => navigate('/privacy/delete-request') },
    ]

    return (
        <div className="w-full min-h-[100dvh] relative z-10 pb-32">
            {toastMsg && (
                <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }}
                    className="fixed top-6 left-1/2 -translate-x-1/2 z-50 bg-slate-900 text-white px-5 py-3 rounded-2xl text-sm font-bold shadow-xl">
                    {toastMsg}
                </motion.div>
            )}
            <div
                className="sticky top-0 z-20 backdrop-blur-xl px-4 sm:px-6 mb-8 flex items-center gap-3"
                style={{ paddingTop: 'calc(env(safe-area-inset-top) + 1.5rem)', paddingBottom: '0.75rem' }}
            >
                <button onClick={() => navigate('/profile')}
                    className={`min-w-[44px] min-h-[44px] flex items-center justify-center p-2.5 rounded-xl transition-colors ${isDark ? 'bg-white/5 hover:bg-white/10 text-white' : 'bg-gray-100 hover:bg-gray-200 text-gray-900'}`}>
                    <ArrowLeft size={20} />
                </button>
                <h1 className={`text-xl sm:text-2xl font-black truncate ${textStyle}`}>Security & Privacy</h1>
            </div>
            <div className="px-4 sm:px-5 space-y-8">
                <div>
                    <h3 className={`text-[11px] font-black uppercase tracking-widest px-2 mb-3 ${subTextStyle}`}>Security</h3>
                    <div className={`rounded-[32px] overflow-hidden border ${cardBg}`}>
                        {securityItems.map((item, idx) => (
                            <button key={idx} onClick={item.action}
                                className={`w-full flex items-center justify-between p-4 sm:p-5 transition-colors ${itemHover} ${idx !== securityItems.length - 1 ? (isDark ? 'border-b border-white/5' : 'border-b border-gray-50') : ''}`}>
                                <div className="flex items-center gap-4">
                                    <div className={`p-2 rounded-xl ${isDark ? 'bg-white/5 text-blue-400' : 'bg-blue-50 text-blue-600'}`}>
                                        <item.icon size={20} />
                                    </div>
                                    <div className="text-left">
                                        <div className={`text-[15px] font-bold ${textStyle}`}>{item.label}</div>
                                        <div className={`text-[12px] ${subTextStyle}`}>{item.description}</div>
                                    </div>
                                </div>
                                {item.badge ? (
                                    <span className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full ${isDark ? 'bg-white/10 text-white/60' : 'bg-gray-100 text-gray-500'}`}>{item.badge}</span>
                                ) : item.toggle ? (
                                    <div className={`min-w-[44px] min-h-[44px] flex items-center justify-center`}>
                                        <div className={`w-12 h-6 rounded-full relative transition-colors ${profileVisibility === 'Private' ? 'bg-emerald-500' : (isDark ? 'bg-white/10' : 'bg-gray-200')}`}>
                                            <div className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow-sm transition-all ${profileVisibility === 'Private' ? 'left-7' : 'left-1'}`} />
                                        </div>
                                    </div>
                                ) : (
                                    <ChevronRight size={18} className="opacity-30" />
                                )}
                            </button>
                        ))}
                    </div>
                    {/* ── Login Activity expanded panel ── */}
                    <AnimatePresence>
                        {showSessions && (
                            <motion.div
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: 'auto' }}
                                exit={{ opacity: 0, height: 0 }}
                                className="overflow-hidden"
                            >
                                <div className={`mt-3 rounded-[24px] border p-4 sm:p-5 space-y-4 ${cardBg}`}>
                                    <div className={`text-[13px] font-bold ${textStyle} mb-1`}>Current Session</div>
                                    <div className="space-y-3">
                                        <div className="flex items-center gap-3">
                                            <Monitor size={16} className={`shrink-0 ${isDark ? 'text-blue-400' : 'text-blue-600'}`} />
                                            <div className="min-w-0">
                                                <div className={`text-[13px] font-bold truncate ${textStyle}`}>{device} · {browser}</div>
                                                <div className={`text-[11px] ${subTextStyle}`}>Device & Browser</div>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <Clock size={16} className={`shrink-0 ${isDark ? 'text-amber-400' : 'text-amber-600'}`} />
                                            <div className="min-w-0">
                                                <div className={`text-[13px] font-bold truncate ${textStyle}`}>{sessionTime}</div>
                                                <div className={`text-[11px] ${subTextStyle}`}>Session started</div>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <Globe size={16} className={`shrink-0 ${isDark ? 'text-emerald-400' : 'text-emerald-600'}`} />
                                            <div className="min-w-0">
                                                <div className={`text-[13px] font-bold truncate ${textStyle}`}>{timezone}</div>
                                                <div className={`text-[11px] ${subTextStyle}`}>Timezone</div>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <MapPin size={16} className={`shrink-0 ${isDark ? 'text-rose-400' : 'text-rose-600'}`} />
                                            <div className="min-w-0">
                                                <div className={`text-[13px] font-bold truncate ${textStyle}`}>Approximate</div>
                                                <div className={`text-[11px] ${subTextStyle}`}>Location (derived from timezone)</div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
                <div>
                    <h3 className={`text-[11px] font-black uppercase tracking-widest px-2 mb-3 ${subTextStyle}`}>Privacy</h3>
                    <div className={`rounded-[32px] overflow-hidden border ${cardBg}`}>
                        {privacyItems.map((item, idx) => (
                            <button key={idx} onClick={item.action}
                                className={`w-full flex items-center justify-between p-4 sm:p-5 transition-colors ${itemHover} ${idx !== privacyItems.length - 1 ? (isDark ? 'border-b border-white/5' : 'border-b border-gray-50') : ''}`}>
                                <div className="flex items-center gap-4">
                                    <div className={`p-2 rounded-xl ${isDark ? 'bg-white/5 text-indigo-400' : 'bg-indigo-50 text-indigo-600'}`}>
                                        <item.icon size={20} />
                                    </div>
                                    <div className="text-left">
                                        <div className={`text-[15px] font-bold ${textStyle}`}>{item.label}</div>
                                        {item.description && <div className={`text-[12px] ${subTextStyle}`}>{item.description}</div>}
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    {item.value && <span className={`text-xs font-bold ${subTextStyle}`}>{item.value}</span>}
                                    <ChevronRight size={18} className="opacity-30" />
                                </div>
                            </button>
                        ))}
                    </div>
                </div>
                <div>
                    <h3 className={`text-[11px] font-black uppercase tracking-widest px-2 mb-3 ${subTextStyle}`}>Storage</h3>
                    <div className={`rounded-[32px] overflow-hidden border ${cardBg}`}>
                        <div className={`w-full flex items-center justify-between p-4 sm:p-5 transition-colors ${itemHover}`}>
                            <div className="flex items-center gap-4">
                                <div className={`p-2 rounded-xl ${isDark ? 'bg-white/5 text-emerald-400' : 'bg-emerald-50 text-emerald-600'}`}>
                                    <HardDrive size={20} />
                                </div>
                                <div className="text-left flex-1 min-w-0">
                                    <div className={`text-[15px] font-bold ${textStyle}`}>App Cache</div>
                                    <div className={`text-[12px] ${subTextStyle}`}>
                                        {formatBytes(usage)} used of {formatBytes(quota)}
                                    </div>
                                    {/* Progress bar */}
                                    <div className="mt-2 w-full h-1.5 bg-gray-200 dark:bg-white/10 rounded-full overflow-hidden">
                                        <div
                                            className={`h-full rounded-full transition-all duration-500 ${isWarning ? 'bg-red-500' : 'bg-emerald-500'}`}
                                            style={{ width: `${Math.min(percent, 100)}%` }}
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>
                        <button onClick={handleClearCache}
                            className={`w-full flex items-center justify-between p-4 sm:p-5 transition-colors ${itemHover} ${isDark ? 'border-t border-white/5' : 'border-t border-gray-50'}`}>
                            <div className="flex items-center gap-4">
                                <div className={`p-2 rounded-xl ${isDark ? 'bg-white/5 text-rose-400' : 'bg-rose-50 text-rose-600'}`}>
                                    <Trash2 size={20} />
                                </div>
                                <div className="text-left">
                                    <div className={`text-[15px] font-bold ${textStyle}`}>Clear Cache</div>
                                    <div className={`text-[12px] ${subTextStyle}`}>Free up space and reload the app</div>
                                </div>
                            </div>
                            <ChevronRight size={18} className="opacity-30" />
                        </button>
                    </div>
                </div>
                <button onClick={handleLogout}
                    className={`w-full flex items-center justify-between p-4 sm:p-5 rounded-[32px] border transition-colors ${isDark ? 'bg-red-500/5 border-red-500/20 hover:bg-red-500/10 text-red-400' : 'bg-red-50 border-red-100 hover:bg-red-100 text-red-600'}`}>
                    <div className="flex items-center gap-4">
                        <div className={`p-2 rounded-xl ${isDark ? 'bg-red-500/10' : 'bg-red-100'}`}><LogOut size={20} /></div>
                        <span className="text-[15px] font-bold">Sign Out</span>
                    </div>
                    <ChevronRight size={18} className="opacity-30" />
                </button>
            </div>
        </div>
    )
}

export default SecurityPrivacyPage
