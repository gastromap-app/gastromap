import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Search, HelpCircle, MessageSquare, ChevronRight, BookOpen, Star, Zap } from 'lucide-react'
import { useTheme } from '@/hooks/useTheme'

const HelpCenterPage = () => {
    const { theme } = useTheme()
    const isDark = theme === 'dark'
    const navigate = useNavigate()
    const [searchQuery, setSearchQuery] = useState('')

    const textStyle = isDark ? "text-white" : "text-gray-900"
    const subTextStyle = isDark ? "text-gray-400" : "text-gray-500"
    const cardBg = isDark ? "bg-[#1f2128]/80 border-white/5" : "bg-white border-gray-100"
    const inputBg = isDark ? "bg-white/5 border-white/10" : "bg-gray-50 border-gray-200"

    const faqs = [
        { q: "How do I save a location?", a: "Tap the bookmark icon on any location card to save it to your 'Saved' list." },
        { q: "Can I use GastroMap offline?", a: "Currently, you need an internet connection to explore new places, but your saved locations are available offline." },
        { q: "How do I contribute a review?", a: "Navigate to a location details page and scroll down to the reviews section to leave your feedback." },
    ]

    const categories = [
        { icon: Star, label: "Getting Started", count: 12 },
        { icon: Zap, label: "App Features", count: 8 },
        { icon: BookOpen, label: "Account & Billing", count: 5 },
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
                <h1 className={`text-2xl font-black ${textStyle}`}>Help Center</h1>
            </div>

            <div className="px-5 space-y-8">
                {/* Search Bar */}
                <div className="relative">
                    <Search className={`absolute left-4 top-1/2 -translate-y-1/2 ${isDark ? 'text-white/20' : 'text-gray-400'}`} size={18} />
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Search for answers..."
                        className={`w-full pl-12 pr-4 py-4 rounded-2xl text-sm font-bold outline-none border transition-all focus:border-blue-500 ${inputBg} ${textStyle}`}
                    />
                </div>

                {/* Categories */}
                <div className="grid grid-cols-3 gap-3">
                    {categories.map((cat, i) => (
                        <div key={i} className={`p-4 rounded-2xl border flex flex-col items-center text-center gap-2 ${cardBg}`}>
                            <div className={`p-3 rounded-xl bg-blue-500/10 text-blue-500`}>
                                <cat.icon size={20} />
                            </div>
                            <span className={`text-[10px] font-black leading-tight ${textStyle}`}>{cat.label}</span>
                        </div>
                    ))}
                </div>

                {/* FAQ Section */}
                <div>
                    <h3 className={`text-[11px] font-black uppercase tracking-widest px-2 mb-4 ${subTextStyle}`}>Frequently Asked Questions</h3>
                    <div className="space-y-3">
                        {faqs.map((faq, i) => (
                            <div key={i} className={`p-5 rounded-[24px] border ${cardBg}`}>
                                <h4 className={`text-[15px] font-black mb-2 ${textStyle}`}>{faq.q}</h4>
                                <p className={`text-[13px] leading-relaxed ${subTextStyle}`}>{faq.a}</p>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Support Action */}
                <div className={`p-6 rounded-[32px] bg-gradient-to-br from-blue-600 to-blue-700 text-white shadow-xl shadow-blue-500/20`}>
                    <div className="flex items-center gap-4 mb-4">
                        <div className="p-3 bg-white/20 rounded-2xl backdrop-blur-md">
                            <MessageSquare size={24} />
                        </div>
                        <div>
                            <h4 className="text-lg font-black leading-none">Still need help?</h4>
                            <p className="text-white/70 text-xs mt-1">Our support team is here for you 24/7</p>
                        </div>
                    </div>
                    <button className="w-full py-4 bg-white text-blue-600 rounded-2xl font-black text-sm active:scale-[0.98] transition-all">
                        Contact Support
                    </button>
                </div>
            </div>
        </div>
    )
}

export default HelpCenterPage
