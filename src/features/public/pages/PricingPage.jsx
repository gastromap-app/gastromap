import React from 'react'
import PageHeader from '@/components/layout/public/PageHeader'
import { motion } from 'framer-motion'
import { Check, Heart, Coffee, Users, Globe } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'

const fadeInUp = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.5 } },
}

const PricingPage = () => {
    const { t } = useTranslation()
    return (
        <div className="bg-white dark:bg-[#0F1115]">
            <PageHeader
                title={t('pages.pricing.title')}
                subtitle={t('pages.pricing.subtitle')}
                highlight={t('pages.pricing.highlight')}
            />

            {/* Free Tier + Supporter */}
            <section className="py-16 px-6">
                <div className="container mx-auto max-w-5xl">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-stretch">
                        {/* Explorer (Free) */}
                        <motion.div
                            initial="hidden"
                            animate="visible"
                            variants={fadeInUp}
                            className="p-8 md:p-10 rounded-[40px] flex flex-col bg-[#F5F5F7] dark:bg-[#1C1C1E]"
                        >
                            <div className="text-xs font-semibold text-gray-500 dark:text-gray-400 dark:text-white/40 uppercase tracking-widest mb-6">Explorer</div>
                            <div className="text-5xl font-bold tracking-tight mb-2 text-gray-900 dark:text-white">Free</div>
                            <p className="text-sm font-medium text-gray-500 dark:text-white/50 mb-10">Everything you need to discover great food.</p>
                            <ul className="space-y-5 mb-12 text-sm font-medium text-gray-700 dark:text-white/70 flex-1">
                                <li className="flex items-center gap-3"><Check className="w-5 h-5 text-blue-500" /> Explore 10,000+ locations</li>
                                <li className="flex items-center gap-3"><Check className="w-5 h-5 text-blue-500" /> AI-powered GastroGuide</li>
                                <li className="flex items-center gap-3"><Check className="w-5 h-5 text-blue-500" /> Save favorites & track visits</li>
                                <li className="flex items-center gap-3"><Check className="w-5 h-5 text-blue-500" /> Add & review places</li>
                                <li className="flex items-center gap-3"><Check className="w-5 h-5 text-blue-500" /> Offline maps (PWA)</li>
                                <li className="flex items-center gap-3"><Check className="w-5 h-5 text-blue-500" /> 4 languages (EN/PL/RU/UA)</li>
                            </ul>
                            <Link to="/auth/signup">
                                <Button className="w-full bg-white hover:bg-blue-50 text-blue-600 dark:bg-white/10 dark:text-white dark:hover:bg-white/20 rounded-full h-14 font-medium transition-colors shadow-sm">
                                    Join for Free
                                </Button>
                            </Link>
                        </motion.div>

                        {/* Supporter (Optional Donation) */}
                        <motion.div
                            initial="hidden"
                            animate="visible"
                            variants={{ ...fadeInUp, visible: { ...fadeInUp.visible, transition: { duration: 0.5, delay: 0.1 } } }}
                            className="bg-gradient-to-br from-blue-900 to-black text-white p-8 md:p-10 rounded-[40px] shadow-2xl flex flex-col relative overflow-hidden"
                        >
                            <div className="absolute top-0 right-0 w-64 h-64 bg-blue-600 rounded-full blur-[100px] opacity-20 pointer-events-none" />
                            <div className="absolute top-8 right-8 bg-white/10 px-3 py-1 rounded-full text-[10px] font-bold tracking-widest uppercase text-white backdrop-blur-md">Optional</div>
                            <div className="text-xs font-semibold text-blue-400 uppercase tracking-widest mb-6">Supporter</div>
                            <div className="text-5xl font-bold tracking-tight mb-2">$5<span className="text-lg text-white/40 font-medium">/mo</span></div>
                            <p className="text-sm font-medium text-white/50 mb-10">Help keep the servers running & the project alive.</p>
                            <ul className="space-y-5 mb-12 text-sm font-medium text-white/90 flex-1 relative z-10">
                                <li className="flex items-center gap-3"><Check className="w-5 h-5 text-blue-400" /> Exclusive "Supporter" badge</li>
                                <li className="flex items-center gap-3"><Check className="w-5 h-5 text-blue-400" /> Early access to new features</li>
                                <li className="flex items-center gap-3"><Check className="w-5 h-5 text-blue-400" /> Skip the moderation queue</li>
                                <li className="flex items-center gap-3"><Heart className="w-5 h-5 text-rose-400" /> Developer gratitude</li>
                            </ul>
                            <Button className="w-full bg-blue-600 text-white hover:bg-blue-500 shadow-lg shadow-blue-500/20 rounded-full h-14 font-medium transition-all relative z-10">
                                Become a Supporter
                            </Button>
                        </motion.div>
                    </div>
                </div>
            </section>

            {/* One-time Donations */}
            <section className="py-16 px-6">
                <div className="container mx-auto max-w-5xl">
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.2 }}
                        className="text-center mb-12"
                    >
                        <h2 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white mb-4">
                            Or buy us a coffee
                        </h2>
                        <p className="text-gray-500 dark:text-white/50 max-w-lg mx-auto">
                            Every donation helps us add new cities, improve the AI, and keep GastroMap running for everyone.
                        </p>
                    </motion.div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 max-w-3xl mx-auto">
                        {[
                            { icon: Coffee, label: 'Coffee', amount: '$3', desc: 'A small thank you' },
                            { icon: Heart, label: 'Lunch', amount: '$10', desc: 'Fuel the team' },
                            { icon: Users, label: 'Champion', amount: '$25', desc: 'You are amazing' },
                        ].map((tier, i) => (
                            <motion.button
                                key={tier.label}
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.3 + i * 0.1 }}
                                className="p-6 rounded-3xl bg-[#F5F5F7] dark:bg-[#1C1C1E] hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors text-center group"
                            >
                                <tier.icon className="w-8 h-8 mx-auto mb-3 text-blue-500 group-hover:scale-110 transition-transform" />
                                <div className="text-2xl font-bold text-gray-900 dark:text-white mb-1">{tier.amount}</div>
                                <div className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-widest mb-1">{tier.label}</div>
                                <div className="text-xs text-gray-500 dark:text-white/50">{tier.desc}</div>
                            </motion.button>
                        ))}
                    </div>
                </div>
            </section>

            {/* Why Free */}
            <section className="py-16 px-6">
                <div className="container mx-auto max-w-3xl text-center">
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.4 }}
                    >
                        <Globe className="w-10 h-10 mx-auto mb-6 text-blue-500" />
                        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
                            Why is GastroMap free?
                        </h2>
                        <p className="text-gray-500 dark:text-white/50 leading-relaxed">
                            We believe finding great food should never be behind a paywall.
                            GastroMap is an open community project built by locals who love sharing their favorite spots.
                            We keep the lights on through voluntary donations and community support.
                            No ads, no hidden fees, no premium walls.
                        </p>
                    </motion.div>
                </div>
            </section>
        </div>
    )
}

export default PricingPage
