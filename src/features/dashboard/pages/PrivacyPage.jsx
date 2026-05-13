import React, { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Shield, ArrowUpRight } from 'lucide-react'
import { useTheme } from '@/hooks/useTheme'

const PrivacyPage = () => {
    const { theme } = useTheme()
    const isDark = theme === 'dark'
    const navigate = useNavigate()
    const [scrolled, setScrolled] = useState(false)

    useEffect(() => {
        const onScroll = () => setScrolled(window.scrollY > 50)
        window.addEventListener('scroll', onScroll, { passive: true })
        return () => window.removeEventListener('scroll', onScroll)
    }, [])

    const textStyle = isDark ? "text-white" : "text-gray-900"
    const subTextStyle = isDark ? "text-gray-400" : "text-gray-600"
    const cardBg = isDark ? "bg-[#1f2128]/80 border-white/5" : "bg-white border-slate-200/50"

    const sections = [
        {
            title: "1. Information We Collect",
            content: `GastroMap collects the following types of personal data:`,
            items: [
                "Account information: email address, display name, profile picture",
                "Location data: geolocation (when you grant permission) to show nearby places and provide map features",
                "User activity: favorite places, visited places, search history",
                "User-generated content: reviews, ratings, photos, and places you add to the platform",
                "AI interactions: messages and conversations with our AI chat assistant",
                "Technical data: device type, browser, IP address, and usage analytics"
            ]
        },
        {
            title: "2. How We Use Your Information",
            content: null,
            items: [
                "Provide and personalize the Service, including restaurant recommendations and map features",
                "Display your reviews, ratings, and contributed places to the community",
                "Power AI-driven recommendations based on your preferences and history",
                "Analyze AI chat conversations to improve recommendation quality and accuracy",
                "Send important service notifications (account security, policy updates)",
                "Maintain and improve the platform's performance and reliability",
                "Detect and prevent fraud, abuse, or violations of our Terms of Service"
            ]
        },
        {
            title: "3. Third-Party Services",
            content: `GastroMap uses the following third-party services to operate:`,
            items: [
                "Supabase — database hosting and user authentication (data stored in EU)",
                "Google Places API — location and place data for map features",
                "OpenRouter — AI language model provider for chat and recommendations",
                "Vercel — application hosting and deployment"
            ],
            extra: `These providers process data on our behalf and are bound by their own privacy policies and data processing agreements. We do not sell your personal data to any third party.`
        },
        {
            title: "4. Data Sharing",
            content: `Your public profile information (display name, reviews, ratings, contributed places) is visible to other GastroMap users. We may share data with third parties only in the following circumstances:`,
            items: [
                "With service providers who help us operate the platform (listed above)",
                "When required by law, regulation, or legal process",
                "To protect the rights, safety, or property of GastroMap or its users",
                "In connection with a merger, acquisition, or sale of assets (with prior notice)"
            ]
        },
        {
            title: "5. Cookies and Tracking",
            content: `GastroMap uses minimal cookies strictly necessary for the Service to function. We use an authentication session cookie to keep you logged in. We do not use advertising cookies, tracking pixels, or third-party analytics cookies. No cross-site tracking is performed.`
        },
        {
            title: "6. Data Retention",
            content: `We retain your personal data for as long as your account is active. If you request account deletion, we will permanently remove your personal data within 30 days, except where retention is required by law. Anonymized, aggregated data (which cannot identify you) may be retained indefinitely for analytical purposes.`
        },
        {
            title: "7. Your Rights (GDPR)",
            content: `As GastroMap operates from Poland/EU, you have the following rights under the General Data Protection Regulation (GDPR):`,
            items: [
                "Right to access — request a copy of all personal data we hold about you",
                "Right to rectification — correct inaccurate or incomplete personal data",
                "Right to erasure — request permanent deletion of your personal data",
                "Right to restriction — limit how we process your data in certain circumstances",
                "Right to data portability — receive your data in a structured, machine-readable format",
                "Right to object — object to processing based on legitimate interests",
                "Right to withdraw consent — withdraw consent at any time where processing is based on consent"
            ],
            extra: `To exercise any of these rights, contact us at gastromap1@gmail.com. We will respond within 30 days.`
        },
        {
            title: "8. Data Security",
            content: `We implement appropriate technical and organizational measures to protect your personal data, including encryption in transit (TLS/SSL), secure authentication, access controls, and regular security reviews. However, no method of transmission over the Internet is 100% secure, and we cannot guarantee absolute security.`
        },
        {
            title: "9. Children's Privacy",
            content: `GastroMap is not intended for children under 13 years of age. We do not knowingly collect personal data from children under 13. If we become aware that we have collected data from a child under 13, we will take steps to delete that information promptly. If you believe a child under 13 has provided us with personal data, please contact us at gastromap1@gmail.com.`
        },
        {
            title: "10. International Data Transfers",
            content: `GastroMap is operated from Poland within the European Union. If you access the Service from outside the EU, your data may be transferred to and processed in the EU. We ensure that any data transfers comply with applicable data protection laws and that appropriate safeguards are in place.`
        },
        {
            title: "11. Changes to This Policy",
            content: `We may update this Privacy Policy from time to time. We will notify you of significant changes via email or in-app notification. The "Effective date" at the top of this page indicates when the policy was last revised. Your continued use of the Service after changes constitutes acceptance of the updated policy.`
        },
        {
            title: "12. Contact Us",
            content: `If you have any questions about this Privacy Policy or wish to exercise your data rights, please contact us at: gastromap1@gmail.com`
        }
    ]

    return (
        <div className={`min-h-screen ${isDark ? 'bg-black' : 'bg-[#F5F5F7]'}`}>
            {/* Navbar — same as LandingPageV3 */}
            <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ${scrolled ? (isDark ? 'bg-black/80 backdrop-blur-xl border-b border-white/5' : 'bg-white/80 backdrop-blur-xl border-b border-gray-200/60 shadow-sm') : ''}`} style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}>
                <div className="max-w-7xl mx-auto px-6 md:px-10 h-14 md:h-20 flex items-center justify-between">
                    <Link to="/" className={`${isDark ? 'text-white' : scrolled ? 'text-gray-900' : 'text-gray-900'} text-lg font-medium tracking-tight`}>GastroMap</Link>
                    <Link to="/auth/signup" className={`h-9 px-5 rounded-full ${isDark ? 'bg-white text-black hover:bg-white/90' : 'bg-gray-900 text-white hover:bg-gray-800'} text-sm font-medium flex items-center gap-1.5 transition-colors`}>
                        Get Started <ArrowUpRight size={14} />
                    </Link>
                </div>
            </nav>

            {/* Page Title */}
            <div className="pt-24 md:pt-32 pb-8 px-6 max-w-[800px] mx-auto">
                <p className={`text-xs font-light tracking-[0.3em] uppercase mb-3 ${isDark ? 'text-white/30' : 'text-gray-400'}`}>Legal</p>
                <h1 className={`text-3xl md:text-4xl font-light tracking-tight ${isDark ? 'text-white' : 'text-gray-900'}`}>Privacy Policy</h1>
                <p className={`mt-2 text-base ${isDark ? 'text-white/50' : 'text-gray-500'} font-light`}>How we collect, use, and protect your personal information.</p>
            </div>

            <div className="px-4 sm:px-6 md:px-8 pt-8 max-w-[800px] mx-auto space-y-6 pb-12">
                {/* Intro Card */}
                <div className={`p-8 rounded-[40px] border ${cardBg} bg-gradient-to-br from-blue-500/5 to-indigo-500/5`}>
                    <Shield size={40} className="text-blue-500 mb-6" />
                    <h2 className={`text-xl font-black mb-4 ${textStyle}`}>Your Privacy Matters</h2>
                    <p className={`text-sm leading-relaxed ${subTextStyle}`}>
                        This Privacy Policy explains how GastroMap ("we", "us", "our") collects, uses, stores, and protects your personal information when you use our service at gastromap.app. We are committed to transparency and to giving you control over your data.
                    </p>
                    <p className={`text-xs mt-4 ${subTextStyle} opacity-70`}>
                        Effective date: January 1, 2025 · Operated from Poland, EU
                    </p>
                </div>

                {/* Content Sections */}
                <div className="space-y-4">
                    {sections.map((section, i) => (
                        <div key={i} className={`p-8 rounded-[40px] border ${cardBg}`}>
                            <h2 className={`text-lg font-black mb-4 ${textStyle}`}>{section.title}</h2>
                            {section.content && (
                                <p className={`text-[14px] leading-relaxed ${subTextStyle} ${section.items ? 'mb-3' : ''}`}>
                                    {section.content}
                                </p>
                            )}
                            {section.items && (
                                <ul className={`text-[14px] leading-relaxed space-y-2 ${subTextStyle} list-disc list-inside`}>
                                    {section.items.map((item, j) => (
                                        <li key={j}>{item}</li>
                                    ))}
                                </ul>
                            )}
                            {section.extra && (
                                <p className={`text-[14px] leading-relaxed mt-4 ${subTextStyle}`}>
                                    {section.extra}
                                </p>
                            )}
                        </div>
                    ))}
                </div>

                {/* Data Control Card */}
                <div className={`p-8 rounded-[40px] border ${cardBg}`}>
                    <h2 className={`text-lg font-black mb-4 ${textStyle}`}>Data Control</h2>
                    <p className={`text-[14px] leading-relaxed mb-6 ${subTextStyle}`}>
                        You have full control over your data. You can request a complete export of your personal data or permanently delete your account and all associated information.
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

            {/* Footer */}
            <footer className="py-12 border-t border-gray-200 dark:border-white/5">
                <div className="max-w-4xl mx-auto px-6 text-center">
                    <p className="text-sm text-gray-400">© 2025 GastroMap. All rights reserved.</p>
                </div>
            </footer>
        </div>
    )
}

export default PrivacyPage
