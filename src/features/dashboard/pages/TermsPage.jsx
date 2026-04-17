import React from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, FileText, Globe, Clock } from 'lucide-react'
import { useTheme } from '@/hooks/useTheme'

const TermsPage = () => {
    const { theme } = useTheme()
    const isDark = theme === 'dark'
    const navigate = useNavigate()

    const textStyle = isDark ? "text-white" : "text-gray-900"
    const subTextStyle = isDark ? "text-gray-500 dark:text-gray-400" : "text-gray-500"
    const cardBg = isDark ? "bg-[#1f2128]/80 border-white/5" : "bg-white border-gray-100"

    const sections = [
        {
            title: "1. Agreement to Terms",
            content: "By using GastroMap, you agree to these Terms. If you don't agree, please do not use the service. We may update these terms from time to time, and your continued use of the app signifies acceptance of those changes."
        },
        {
            title: "2. Your Account",
            content: "You are responsible for your account and any activity on it. You must provide accurate information and keep your password secure. We reserve the right to suspend accounts that violate our community guidelines."
        },
        {
            title: "3. User Content",
            content: "You own the reviews and photos you post. However, by posting, you grant GastroMap a non-exclusive license to use, display, and distribute that content within our platform."
        },
        {
            title: "4. Prohibited Conduct",
            content: "You agree not to use GastroMap for any illegal purposes, to post fraudulent reviews, or to interfere with the service's performance. Harassment of other users or businesses is strictly prohibited."
        },
        {
            title: "5. Limitation of Liability",
            content: "GastroMap provides information about businesses but does not guarantee its accuracy. We are not liable for any experiences you have at the locations listed in the app."
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
                <h1 className={`text-2xl font-black ${textStyle}`}>Terms of Service</h1>
            </div>

            <div className="px-5 space-y-6">
                {/* Meta Info */}
                <div className={`p-6 rounded-[32px] border ${cardBg} flex items-center gap-4`}>
                    <div className="w-12 h-12 bg-blue-500/10 text-blue-500 rounded-2xl flex items-center justify-center">
                        <FileText size={24} />
                    </div>
                    <div>
                        <p className={`text-[11px] font-black uppercase tracking-widest ${subTextStyle}`}>Legal Document</p>
                        <p className={`text-[15px] font-bold ${textStyle}`}>Effective Jan 2026</p>
                    </div>
                </div>

                {/* Content */}
                <div className="space-y-4">
                    {sections.map((section, i) => (
                        <div key={i} className={`p-8 rounded-[40px] border ${cardBg}`}>
                            <h2 className={`text-lg font-black mb-3 ${textStyle}`}>{section.title}</h2>
                            <p className={`text-[14px] leading-relaxed ${subTextStyle}`}>{section.content}</p>
                        </div>
                    ))}
                </div>

                <div className="text-center p-6 italic opacity-50 text-[12px]">
                    For legal inquiries: legal@gastromap.com
                </div>
            </div>
        </div>
    )
}

export default TermsPage
