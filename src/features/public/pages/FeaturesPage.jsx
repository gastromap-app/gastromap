import React from 'react'
import PageHeader from '@/components/layout/public/PageHeader'
import { motion } from 'framer-motion'
import { Award, Zap, Shield, Utensils, Coffee, Heart, User, Map, Globe } from 'lucide-react'

import { useTranslation } from 'react-i18next'

const features = [
    { icon: Award, title: "AI Rank", desc: "Grades locations based on your preferences." },
    { icon: Zap, title: "Instant Book", desc: "Reserve a table in seconds." },
    { icon: Shield, title: "Best Practices", desc: "Only verified, high-quality spots." },
    { icon: Utensils, title: "Local Gems", desc: "Discover places locals love." },
    { icon: Coffee, title: "Perfect Vibe", desc: "Filter by noise level, lighting, spacing." },
    { icon: Heart, title: "Health First", desc: "Detailed allergen and diet info." },
    { icon: User, title: "Made for You", desc: "The more you use it, the smarter it gets." },
    { icon: Map, title: "Multi-level", desc: "Floor plans and seat selection." },
    { icon: Globe, title: "Global Access", desc: "Works intl. with auto-translation." },
]

const FeaturesPage = () => {
    const { t } = useTranslation()
    return (
        <div className="bg-white">
            <PageHeader
                title={t('pages.features.title')}
                subtitle={t('pages.features.subtitle')}
                highlight={t('pages.features.highlight')}
            />

            <section className="py-20 px-6">
                <div className="container mx-auto max-w-7xl">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                        {features.map((f, i) => (
                            <motion.div
                                key={i}
                                initial={{ opacity: 0, y: 20 }}
                                whileInView={{ opacity: 1, y: 0 }}
                                transition={{ delay: i * 0.1 }}
                                className="bg-white p-8 rounded-[32px] shadow-sm hover:shadow-xl transition-all border border-gray-100 group"
                            >
                                <div className="w-12 h-12 bg-blue-50 rounded-2xl flex items-center justify-center text-blue-600 mb-6 group-hover:scale-110 transition-transform duration-300">
                                    <f.icon size={24} />
                                </div>
                                <h3 className="font-bold text-xl mb-3 text-gray-900">{f.title}</h3>
                                <p className="text-gray-500 leading-relaxed">{f.desc}</p>
                            </motion.div>
                        ))}
                    </div>
                </div>
            </section>
        </div>
    )
}

export default FeaturesPage
