import React from 'react'
import PageHeader from '@/components/layout/public/PageHeader'
import { FileText } from 'lucide-react'
import { useTheme } from '@/hooks/useTheme'

const TermsPage = () => {
    const { theme } = useTheme()
    const isDark = theme === 'dark'

    const textStyle = isDark ? "text-white" : "text-gray-900"
    const subTextStyle = isDark ? "text-gray-400" : "text-gray-600"
    const cardBg = isDark ? "bg-[#1f2128]/80 border-white/5" : "bg-white border-slate-200/50"

    const sections = [
        {
            title: "1. Agreement to Terms",
            content: `By accessing or using GastroMap (available at gastromap.app), you agree to be bound by these Terms of Service. If you do not agree to these Terms, you may not access or use the Service. GastroMap reserves the right to update or modify these Terms at any time. We will notify users of significant changes via email or in-app notification. Your continued use of the Service after any changes constitutes acceptance of the updated Terms.`
        },
        {
            title: "2. Eligibility",
            content: `You must be at least 13 years of age to use GastroMap. By using the Service, you represent and warrant that you meet this age requirement. If you are under 18, you confirm that you have obtained parental or guardian consent to use the Service.`
        },
        {
            title: "3. Description of Service",
            content: `GastroMap is a free community-driven platform for discovering restaurants, cafes, and other food establishments. The Service includes interactive maps, AI-powered recommendations, user reviews, community-contributed places, and personalized suggestions. GastroMap is provided free of charge and is supported by voluntary donations. There are no paid subscriptions or premium tiers.`
        },
        {
            title: "4. User Accounts",
            content: `To access certain features, you must create an account. You are responsible for maintaining the confidentiality of your login credentials and for all activities that occur under your account. You agree to provide accurate, current, and complete information during registration and to update such information as necessary. GastroMap reserves the right to suspend or terminate accounts that violate these Terms or our community guidelines.`
        },
        {
            title: "5. User-Generated Content",
            content: `Users may contribute content to GastroMap, including but not limited to: adding new places, writing reviews, uploading photos, and rating establishments. By submitting content, you grant GastroMap a non-exclusive, worldwide, royalty-free, perpetual license to use, display, reproduce, modify, and distribute your content within the platform and for promotional purposes. You retain ownership of your content and may delete it at any time. You represent that you have the right to post any content you submit and that it does not infringe on any third party's rights.`
        },
        {
            title: "6. AI Features",
            content: `GastroMap offers AI-powered chat and recommendation features. By using these features, you acknowledge that your conversations and interactions with the AI may be analyzed to improve the quality and accuracy of recommendations. AI-generated suggestions are provided for informational purposes only and should not be considered professional advice. GastroMap does not guarantee the accuracy or completeness of AI-generated content.`
        },
        {
            title: "7. Prohibited Conduct",
            items: [
                "Post false, misleading, or fraudulent reviews",
                "Upload content that is illegal, harmful, threatening, abusive, or defamatory",
                "Impersonate any person or entity",
                "Interfere with or disrupt the Service or its infrastructure",
                "Use automated systems (bots, scrapers) to access the Service without permission",
                "Harass, bully, or intimidate other users or business owners",
                "Attempt to gain unauthorized access to other users' accounts",
                "Use the Service for any commercial purpose without prior written consent"
            ]
        },
        {
            title: "8. Intellectual Property",
            content: `The GastroMap name, logo, design, and all associated intellectual property are owned by GastroMap. You may not use, reproduce, or distribute any GastroMap branding without prior written permission. The Service's source code, algorithms, and underlying technology are proprietary and protected by applicable intellectual property laws.`
        },
        {
            title: "9. Third-Party Services",
            content: `GastroMap integrates with third-party services including Google Places API for location data, Supabase for data storage, OpenRouter for AI capabilities, and Vercel for hosting. Your use of these integrated services is subject to their respective terms and privacy policies. GastroMap is not responsible for the practices or content of third-party services.`
        },
        {
            title: "10. Disclaimer of Warranties",
            content: `GastroMap is provided "as is" and "as available" without warranties of any kind, either express or implied. We do not guarantee that the Service will be uninterrupted, error-free, or secure. Information about establishments (including hours, menus, prices, and availability) is provided by the community and third-party sources and may not always be accurate or up to date. GastroMap is not responsible for your experiences at any listed establishment.`
        },
        {
            title: "11. Limitation of Liability",
            content: `To the maximum extent permitted by applicable law, GastroMap and its operators shall not be liable for any indirect, incidental, special, consequential, or punitive damages arising from your use of or inability to use the Service. This includes, but is not limited to, damages for loss of data, goodwill, or other intangible losses.`
        },
        {
            title: "12. Termination",
            content: `GastroMap may terminate or suspend your access to the Service at any time, with or without cause, and with or without notice. Upon termination, your right to use the Service ceases immediately. You may also delete your account at any time through your account settings or by contacting us.`
        },
        {
            title: "13. Governing Law",
            content: `These Terms shall be governed by and construed in accordance with the laws of the European Union and the Republic of Poland, without regard to conflict of law principles. Any disputes arising from these Terms or the Service shall be resolved in the competent courts of Poland.`
        },
        {
            title: "14. Contact",
            content: `If you have any questions about these Terms of Service, please contact us at gastromap1@gmail.com.`
        }
    ]

    return (
        <div className="bg-[#F5F5F7] dark:bg-black min-h-screen">
            <PageHeader
                title="Terms of Service"
                subtitle="The rules and guidelines for using the GastroMap platform."
                highlight="Legal"
            />

            <div className="px-4 sm:px-6 md:px-8 pt-8 max-w-[800px] mx-auto space-y-6 pb-12">
                {/* Meta Info */}
                <div className={`p-6 rounded-[32px] border ${cardBg} flex items-center gap-4`}>
                    <div className="w-12 h-12 bg-blue-500/10 text-blue-500 rounded-2xl flex items-center justify-center">
                        <FileText size={24} />
                    </div>
                    <div>
                        <p className={`text-[11px] font-black uppercase tracking-widest ${subTextStyle}`}>Legal Document</p>
                        <p className={`text-[15px] font-bold ${textStyle}`}>Effective January 1, 2025</p>
                    </div>
                </div>

                {/* Content */}
                <div className="space-y-4">
                    {sections.map((section, i) => (
                        <div key={i} className={`p-8 rounded-[40px] border ${cardBg}`}>
                            <h2 className={`text-lg font-black mb-3 ${textStyle}`}>{section.title}</h2>
                            {section.content && (
                                <p className={`text-[14px] leading-relaxed ${subTextStyle}`}>{section.content}</p>
                            )}
                            {section.items && (
                                <>
                                    <p className={`text-[14px] leading-relaxed mb-3 ${subTextStyle}`}>
                                        You agree not to:
                                    </p>
                                    <ul className={`text-[14px] leading-relaxed space-y-2 ${subTextStyle} list-disc list-inside`}>
                                        {section.items.map((item, j) => (
                                            <li key={j}>{item}</li>
                                        ))}
                                    </ul>
                                </>
                            )}
                        </div>
                    ))}
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

export default TermsPage
