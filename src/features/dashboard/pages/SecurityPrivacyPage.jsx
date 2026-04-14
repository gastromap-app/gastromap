import React, { useState } from 'react'
import { motion } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Lock, Shield, Eye, Smartphone, LogOut, ChevronRight, UserX } from 'lucide-react'
import { useTheme } from '@/hooks/useTheme'
import { useAuthStore } from '@/features/auth/hooks/useAuthStore'

const SecurityPrivacyPage = () => {
    const { theme } = useTheme()
    const isDark = theme === 'dark'
    const navigate = useNavigate()
    const { logout, requestPasswordReset, user } = useAuthStore()
    const [toastMsg, setToastMsg] = useState('')

    const textStyle = isDark ? "text-white" : "text-gray-900"
    const subTextStyle = isDark ? "text-gray-400" : "text-gray-500"
    const cardBg = isDark ? "bg-[#1f2128]/80 border-white/5" : "bg-white border-gray-100"
    const itemHover = isDark ? "hover:bg-white/5" : "hover:bg-gray-50"

    const showToast = (msg) => {
        setToastMsg(msg)
        setTimeout(() => setToastMsg(''), 3000)
    }

    const handleChangePassword = async () => {
        if (!user?.email) return
        await requestPasswordReset(user.email)
        showToast('Password reset link sent to ' + user.email)
    }

    const handleLogout = async () => {
        await logout()
        navigate('/login')
    }

    const securityItems = [
        { icon: Lock, label: "Change Password", description: "Send reset link to your email", action: handleChangePassword },
        { icon: Smartphone, label: "Two-Factor Authentication", description: "Currently disabled", toggle: true, action: () => showToast('2FA coming soon') },
        { icon: Eye, label: "Login Activity", description: "Manage your active sessions", action: () => showToast('Session management coming soon') },
    ]

    const privacyItems = [
        { icon: Shield, label: "Profile Visibility", value: "Public", action: () => showToast('Visibility settings coming soon') },
        { icon: UserX, label: "Request Data Deletion", description: "Permanent deletion of your account", action: () => navigate('/privacy/delete-request') },
    ]

    return (
        <div className="w-full min-h-screen relative z-10 pb-32">
            {/* Toast */}
            {toastMsg && (
                <motion.div
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className="fixed top-6 left-1/2 -translate-x-1/2 z-50 bg-slate-900 dark:bg-white text-white dark:text-slate-900 px-5 py-3 rounded-2xl text-sm font-bold shadow-xl"
                >
                    {toastMsg}
                </motion.div>
            )}

            {/* Header */}
            <div className="pt-24 px-6 mb-8 flex items-center gap-4">
                <button
                    onClick={() => navigate('/profile')}
                    className={`p-2 rounded-xl transition-colors ${isDark ? 'bg-white/5 hover:bg-white/10 text-white' : 'bg-gray-100 hover:bg-gray-200 text-gray-900'}`}
                >
                    <ArrowLeft size={20} />
                </button>
                <h1 className={`text-2xl font-black ${textStyle}`}>Security & Privacy</h1>
            </div>

            <div className="px-5 space-y-8">
                {/* Security Section */}
                <div>
                    <h3 className={`text-[11px] font-black uppercase tracking-widest px-2 mb-3 ${subTextStyle}`}>Security</h3>
                    <div className={`rounded-[32px] overflow-hidden border backdrop-blur-sm ${cardBg}`}>
                        {securityItems.map((item, idx) => (
                            <button
                                key={idx}
                                onClick={item.action}
                                className={`w-full flex items-center justify-between p-5 transition-colors ${itemHover} ${idx !== securityItems.length - 1 ? (isDark ? 'border-b border-white/5' : 'border-b border-gray-50') : ''}`}
                            >
                                <div className="flex items-center gap-4">
                                    <div className={`p-2 rounded-xl ${isDark ? 'bg-white/5 text-blue-400' : 'bg-blue-50 text-blue-600'}`}>
                                        <item.icon size={20} />
                                    </div>
                                    <div className="text-left">
                                        <div className={`text-[15px] font-bold ${textStyle}`}>{item.label}</div>
                                        <div className={`text-[12px] ${subTextStyle}`}>{item.description}</div>
                                    </div>
                                </div>
                                {item.toggle ? (
                                    <div className={`w-12 h-6 rounded-full relative transition-colors ${isDark ? 'bg-white/10' : 'bg-gray-200'}`}>
                                        <div className="absolute left-1 top-1 w-4 h-4 rounded-full bg-white shadow-sm" />
                                    </div>
                                ) : (
                                    <ChevronRight size={18} className="opacity-30" />
                                )}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Privacy Section */}
                <div>
                    <h3 className={`text-[11px] font-black uppercase tracking-widest px-2 mb-3 ${subTextStyle}`}>Privacy</h3>
                    <div className={`rounded-[32px] overflow-hidden border backdrop-blur-sm ${cardBg}`}>
                        {privacyItems.map((item, idx) => (
                            <button
                                key={idx}
                                onClick={item.action}
                                className={`w-full flex items-center justify-between p-5 transition-colors ${itemHover} ${idx !== privacyItems.length - 1 ? (isDark ? 'border-b border-white/5' : 'border-b border-gray-50') : ''}`}
                            >
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

                {/* Sign Out */}
                <button
                    onClick={handleLogout}
                    className={`w-full flex items-center justify-between p-5 rounded-[32px] border transition-colors ${isDark ? 'bg-red-500/5 border-red-500/20 hover:bg-red-500/10 text-red-400' : 'bg-red-50 border-red-100 hover:bg-red-100 text-red-600'}`}
                >
                    <div className="flex items-center gap-4">
                        <div className={`p-2 rounded-xl ${isDark ? 'bg-red-500/10' : 'bg-red-100'}`}>
                            <LogOut size={20} />
                        </div>
                        <span className="text-[15px] font-bold">Sign Out</span>
                    </div>
                    <ChevronRight size={18} className="opacity-30" />
                </button>
            </div>
        </div>
    )
}

export default SecurityPrivacyPage
