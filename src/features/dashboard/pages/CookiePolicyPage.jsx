import React from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Cookie, Info, ShieldCheck, Settings } from 'lucide-react'
import { useTheme } from '@/hooks/useTheme'

const CookiePolicyPage = () => {
    const { theme } = useTheme()
    const isDark = theme === 'dark'
    const navigate = useNavigate()

    const textStyle = isDark ? "text-white" : "text-gray-900"
    const subTextStyle = isDark ? "text-gray-500 dark:text-gray-400" : "text-gray-500"
    const cardBg = isDark ? "bg-[#1f2128]/80 border-white/5" : "bg-white border-slate-200/50"

    const cookieTypes = [
        {
            title: "Essential Cookies",
            desc: "Necessary for the website to function properly. They enable basic features like page navigation and access to secure areas.",
            status: "Always Active"
        },
        {
            title: "Preference Cookies",
            desc: "Allow us to remember choices you make (like theme preference or language) to provide a more personalized experience.",
            status: "User-controlled"
        },
        {
            title: "Analytics Cookies",
            desc: "Help us understand how visitors interact with the app by collecting and reporting information anonymously.",
            status: "Optional"
        }
    ]

    return (
        <div className="w-full min-h-screen relative z-10 pb-32">
            {/* Header */}
            <div className="pt-24 px-6 mb-8 flex items-center gap-4">
                <button
                    onClick={() => navigate(-1)}
                    className={`p-2 rounded-xl transition-colors ${isDark ? 'bg-white/5 hover:bg-white/10 text-white' : 'bg-gray-100 hover:bg-gray-200 text-gray-700'}`}
                >
                    <ArrowLeft size={20} />
                </button>
                <h1 className={`text-2xl font-black ${textStyle}`}>Cookie Policy</h1>
            </div>

            <div className="px-5 space-y-6">
                {/* Intro Card */}
                <div className={`p-8 rounded-[40px] border ${cardBg} bg-gradient-to-br from-yellow-500/5 to-orange-500/5`}>
                    <Cookie size={40} className="text-yellow-500 mb-6" />
                    <h2 className={`text-xl font-black mb-4 ${textStyle}`}>How we use Cookies</h2>
                    <p className={`text-sm leading-relaxed ${subTextStyle}`}>
                        We use cookies and similar technologies to help provide, protect, and improve the GastroMap platform. This policy explains how and why we use these technologies.
                    </p>
                </div>

                {/* Detailed Types */}
                <div className="space-y-4">
                    {cookieTypes.map((type, i) => (
                        <div key={i} className={`p-6 rounded-[32px] border ${cardBg}`}>
                            <div className="flex justify-between items-start mb-3">
                                <h3 className={`text-lg font-black ${textStyle}`}>{type.title}</h3>
                                <span className="px-3 py-1 bg-blue-500/10 text-blue-500 text-[10px] font-black rounded-full border border-blue-500/20">
                                    {type.status}
                                </span>
                            </div>
                            <p className={`text-[13px] leading-relaxed ${subTextStyle}`}>{type.desc}</p>
                        </div>
                    ))}
                </div>

                {/* Management Card */}
                <div className={`p-8 rounded-[40px] border ${cardBg}`}>
                    <div className="flex items-center gap-3 mb-4">
                        <Settings size={20} className="text-blue-500" />
                        <h2 className={`text-lg font-black ${textStyle}`}>Managing Settings</h2>
                    </div>
                    <p className={`text-[14px] leading-relaxed mb-6 ${subTextStyle}`}>
                        Most web browsers allow some control of most cookies through the browser settings. You can also adjust your preferences within our app at any time.
                    </p>
                    <button className="w-full py-4 bg-blue-600 text-white rounded-2xl font-black text-sm active:scale-[0.98] transition-all shadow-lg shadow-blue-500/20">
                        Cookie Preferences
                    </button>
                </div>

                <div className="text-center p-6 italic opacity-50 text-[12px] flex items-center justify-center gap-2">
                    <ShieldCheck size={14} />
                    Last updated: January 2026
                </div>
            </div>
        </div>
    )
}

export default CookiePolicyPage
