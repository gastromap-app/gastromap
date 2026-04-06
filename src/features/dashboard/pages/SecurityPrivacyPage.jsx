import React, { useState } from 'react'
import { motion } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Lock, Shield, Eye, Smartphone, LogOut, ChevronRight, UserX } from 'lucide-react'
import { useTheme } from '@/hooks/useTheme'

const SecurityPrivacyPage = () => {
    const { theme } = useTheme()
    const isDark = theme === 'dark'
    const navigate = useNavigate()

    const textStyle = isDark ? "text-white" : "text-gray-900"
    const subTextStyle = isDark ? "text-gray-400" : "text-gray-500"
    const cardBg = isDark ? "bg-[#1f2128]/80 border-white/5" : "bg-white border-gray-100"
    const itemHover = isDark ? "hover:bg-white/5" : "hover:bg-gray-50"

    const securityItems = [
        { icon: Lock, label: "Change Password", description: "Last changed 3 months ago" },
        { icon: Smartphone, label: "Two-Factor Authentication", description: "Currently disabled", toggle: true },
        { icon: Eye, label: "Login Activity", description: "Manage your active sessions" },
    ]

    const privacyItems = [
        { icon: Shield, label: "Profile Visibility", value: "Public" },
        { icon: UserX, label: "Request Data Deletion", description: "Permanent deletion of your account" },
    ]

    return (
        <div className="w-full min-h-screen relative z-10 pb-32">
            {/* Header */}
            <div className="pt-24 px-6 mb-8 flex items-center gap-4">
                <button
                    onClick={() => navigate('/profile')}
                    className={`p-2 rounded-xl transition-colors ${isDark ? 'bg-white/5 hover:bg-white/10 text-white' : 'bg-gray-100 hover:bg-gray-200 text-gray-700'}`}
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
                                className={`w-full flex items-center justify-between p-5 transition-colors ${itemHover} ${idx !== securityItems.length - 1 ? (isDark ? 'border-b border-white/5' : 'border-b border-gray-100') : ''}`}
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
                                className={`w-full flex items-center justify-between p-5 transition-colors ${itemHover} ${idx !== privacyItems.length - 1 ? (isDark ? 'border-b border-white/5' : 'border-b border-gray-100') : ''}`}
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

                {/* Connected Devices */}
                <div className={`p-6 rounded-[32px] border ${cardBg}`}>
                    <div className="flex items-center gap-3 mb-4">
                        <Smartphone size={18} className="text-green-500" />
                        <h4 className={`text-sm font-black ${textStyle}`}>Current Device</h4>
                    </div>
                    <div className="flex justify-between items-center">
                        <div>
                            <p className={`text-[13px] font-bold ${textStyle}`}>iPhone 15 Pro</p>
                            <p className={`text-[11px] ${subTextStyle}`}>Krakow, Poland • Active now</p>
                        </div>
                        <div className="px-3 py-1 bg-green-500/10 text-green-500 text-[10px] font-black rounded-full border border-green-500/20">
                            THIS DEVICE
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default SecurityPrivacyPage
