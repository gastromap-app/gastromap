import React from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Shield, Eye, Lock, Database } from 'lucide-react'
import { useTheme } from '@/hooks/useTheme'

const PrivacyPage = () => {
    const { theme } = useTheme()
    const isDark = theme === 'dark'
    const navigate = useNavigate()

    const textStyle = isDark ? "text-white" : "text-gray-900"
    const subTextStyle = isDark ? "text-gray-400" : "text-gray-500"
    const cardBg = isDark ? "bg-[#1f2128]/80 border-white/5" : "bg-white border-gray-100"

    const sections = [
        {
            title: "Information We Collect",
            content: "We collect information you provide directly to us, such as when you create an account, update your profile, or post reviews. This includes your name, email address, bio, and profile picture. We also collect location data to help you find restaurants and cafes near you."
        },
        {
            title: "How We Use Your Information",
            content: "We use the information we collect to provide and improve our services, communicate with you, and personalize your experience. Your location data is used exclusively for neighborhood discovery and map features. We never sell your personal data to third parties."
        },
        {
            title: "Sharing of Information",
            content: "We may share your information with service providers who perform services on our behalf, but only to the extent necessary for them to provide those services. We also display your public profile information (name, bio, reviews) to other GastroMap users."
        },
        {
            title: "Data Security",
            content: "We implement robust security measures to protect your personal information from unauthorized access, alteration, disclosure, or destruction. This includes encryption, secure servers, and regular security audits."
        },
        {
            title: "Your Rights (GDPR)",
            content: "If you are in the European Economic Area, you have certain rights under the GDPR, including the right to access, rectify, or delete your personal data. You can exercise these rights through your profile settings or by contacting our data protection officer."
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
                <h1 className={`text-2xl font-black ${textStyle}`}>Privacy Policy</h1>
            </div>

            <div className="px-5 space-y-6">
                {/* Intro Card */}
                <div className={`p-8 rounded-[40px] border ${cardBg} bg-gradient-to-br from-blue-500/5 to-indigo-500/5`}>
                    <Shield size={40} className="text-blue-500 mb-6" />
                    <h2 className={`text-xl font-black mb-4 ${textStyle}`}>Your Privacy is our Priority</h2>
                    <p className={`text-sm leading-relaxed ${subTextStyle}`}>
                        This Privacy Policy describes how GastroMap collects, uses, and shares your personal information. We believe in transparency and giving you control over your data.
                    </p>
                </div>

                {/* Content Sections */}
                <div className="space-y-4">
                    {sections.map((section, i) => (
                        <div key={i} className={`p-8 rounded-[40px] border ${cardBg}`}>
                            <h2 className={`text-lg font-black mb-4 ${textStyle}`}>{section.title}</h2>
                            <p className={`text-[14px] leading-relaxed ${subTextStyle}`}>{section.content}</p>
                        </div>
                    ))}
                </div>

                {/* Rights Card */}
                <div className={`p-8 rounded-[40px] border ${cardBg}`}>
                    <h2 className={`text-lg font-black mb-4 ${textStyle}`}>Data Control Center</h2>
                    <p className={`text-[14px] leading-relaxed mb-6 ${subTextStyle}`}>
                        Take charge of your information. You can request a full export of your data or permanently delete your account at any time.
                    </p>
                    <div className="flex gap-3">
                        <button
                            className={`flex-1 py-4 rounded-2xl border font-bold text-sm ${isDark ? 'border-white/10 text-white hover:bg-white/5' : 'border-gray-200 text-gray-700 hover:bg-gray-50'}`}
                        >
                            Export Data
                        </button>
                        <button
                            onClick={() => navigate('/privacy/delete-request')}
                            className="flex-1 py-4 rounded-2xl border border-red-500/20 text-red-500 font-bold text-sm hover:bg-red-500/5"
                        >
                            Delete Account
                        </button>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default PrivacyPage
