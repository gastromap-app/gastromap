import React, { useState } from 'react'
import PageHeader from '@/components/layout/public/PageHeader'
import { motion } from 'framer-motion'
import { Check, Heart, Coffee, Users, Globe, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Link, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { supabase } from '@/shared/api/client'
import { useAuthStore } from '@/shared/store/useAuthStore'
import DonationModal from '@/components/ui/DonationModal'

const fadeInUp = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.5 } },
}

const PricingPage = () => {
    const { t } = useTranslation()
    const navigate = useNavigate()
    const { isAuthenticated, user } = useAuthStore()
    const [isLoadingPayment, setIsLoadingPayment] = useState(false)
    const [isDonationModalOpen, setIsDonationModalOpen] = useState(false)
    const [selectedAmount, setSelectedAmount] = useState('5')

    const handleDonationClick = (amount = '5') => {
        if (!isAuthenticated) {
            navigate('/auth/login', { state: { from: '/pricing' } })
            return
        }
        setSelectedAmount(amount.replace('$', ''))
        setIsDonationModalOpen(true)
    }

    const processDonation = async (amount) => {
        try {
            setIsLoadingPayment(true)
            
            const { data, error } = await supabase.functions.invoke('create-checkout-session', {
                body: {
                    amount: amount * 100,
                    currency: 'usd',
                    name: 'Support GastroMap',
                    mode: 'payment',
                    userId: user?.id
                }
            })

            if (error) throw error

            if (data?.url) {
                window.location.href = data.url
            } else {
                throw new Error('No checkout URL returned')
            }
        } catch (error) {
            console.error('Error starting checkout:', error)
            alert(t('common.error_occurred') || 'An error occurred while initiating payment.')
        } finally {
            setIsLoadingPayment(false)
        }
    }

    return (
        <div className="bg-white dark:bg-[#0F1115] min-h-screen transition-colors duration-300">
            <PageHeader
                title={t('pages.pricing.title')}
                subtitle={t('pages.pricing.subtitle')}
                highlight={t('pages.pricing.highlight')}
            />

            {/* Free Tier + Supporter */}
            <section className="py-24 px-6 relative overflow-hidden bg-white dark:bg-[#0F1115]">
                {/* Background glow for the section */}
                <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-blue-600/10 rounded-full blur-[120px] pointer-events-none" />
                <div className="absolute bottom-0 left-0 w-[600px] h-[600px] bg-purple-600/10 rounded-full blur-[120px] pointer-events-none" />
                
                <div className="container mx-auto max-w-5xl relative z-10">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-stretch">
                        {/* Explorer (Free) */}
                        <motion.div
                            initial="hidden"
                            whileInView="visible"
                            viewport={{ once: true }}
                            variants={fadeInUp}
                            className="p-10 rounded-[40px] flex flex-col bg-gray-50/50 dark:bg-[#1C1C1E] border border-gray-200 dark:border-white/5 shadow-sm hover:shadow-xl transition-all duration-500"
                        >
                            <div className="text-[10px] font-bold text-gray-400 dark:text-white/30 uppercase tracking-[0.2em] mb-8">Basic Access</div>
                            <div className="text-6xl font-black tracking-tighter mb-4 text-gray-900 dark:text-white">Free</div>
                            <p className="text-base font-medium text-gray-500 dark:text-white/50 mb-12">Everything you need to discover great local food.</p>
                            <ul className="space-y-5 mb-12 text-[15px] font-medium text-gray-600 dark:text-white/70 flex-1">
                                <li className="flex items-center gap-4"><div className="w-6 h-6 rounded-full bg-blue-500/10 flex items-center justify-center"><Check className="w-4 h-4 text-blue-500" /></div> Explore 10,000+ locations</li>
                                <li className="flex items-center gap-4"><div className="w-6 h-6 rounded-full bg-blue-500/10 flex items-center justify-center"><Check className="w-4 h-4 text-blue-500" /></div> AI-powered GastroGuide</li>
                                <li className="flex items-center gap-4"><div className="w-6 h-6 rounded-full bg-blue-500/10 flex items-center justify-center"><Check className="w-4 h-4 text-blue-500" /></div> Save favorites & track visits</li>
                                <li className="flex items-center gap-4"><div className="w-6 h-6 rounded-full bg-blue-500/10 flex items-center justify-center"><Check className="w-4 h-4 text-blue-500" /></div> Community reviews</li>
                                <li className="flex items-center gap-4"><div className="w-6 h-6 rounded-full bg-blue-500/10 flex items-center justify-center"><Check className="w-4 h-4 text-blue-500" /></div> 4 languages support</li>
                            </ul>
                            <Link to="/auth/signup">
                                <Button className="w-full bg-white dark:bg-white/5 hover:bg-gray-100 dark:hover:bg-white/10 text-gray-900 dark:text-white border border-gray-200 dark:border-white/10 rounded-2xl h-16 text-base font-bold transition-all shadow-sm">
                                    Create Free Account
                                </Button>
                            </Link>
                        </motion.div>

                        {/* Supporter (Optional Donation) */}
                        <motion.div
                            initial="hidden"
                            whileInView="visible"
                            viewport={{ once: true }}
                            variants={{ ...fadeInUp, visible: { ...fadeInUp.visible, transition: { duration: 0.5, delay: 0.1 } } }}
                            className="bg-[#0A0A0B] text-white p-10 rounded-[40px] shadow-2xl flex flex-col relative overflow-hidden border border-white/10 group"
                        >
                            {/* Premium Glow */}
                            <div className="absolute -top-24 -right-24 w-80 h-80 bg-blue-600 rounded-full blur-[120px] opacity-30 group-hover:opacity-50 transition-opacity duration-700 pointer-events-none" />
                            
                            <div className="flex justify-between items-start mb-8 relative z-10">
                                <div className="text-[10px] font-bold text-blue-400 uppercase tracking-[0.2em]">Community</div>
                                <div className="bg-blue-500/20 border border-blue-500/30 px-4 py-1 rounded-full text-[10px] font-bold tracking-widest uppercase text-blue-400 backdrop-blur-md">Recommended</div>
                            </div>

                            <div className="text-[10px] font-bold text-white/30 uppercase tracking-[0.2em] mb-2 relative z-10">Supporter</div>
                            <div className="text-7xl font-black tracking-tighter mb-4 text-white relative z-10">$5<span className="text-xl text-white/30 font-medium ml-2">/mo</span></div>
                            <p className="text-base font-medium text-white/50 mb-12 relative z-10">Your support directly funds server costs and feature development.</p>
                            
                            <ul className="space-y-5 mb-12 text-[15px] font-medium text-white/80 flex-1 relative z-10">
                                <li className="flex items-center gap-4"><div className="w-6 h-6 rounded-full bg-blue-500/20 flex items-center justify-center"><Check className="w-4 h-4 text-blue-400" /></div> Exclusive "Supporter" badge</li>
                                <li className="flex items-center gap-4"><div className="w-6 h-6 rounded-full bg-blue-500/20 flex items-center justify-center"><Check className="w-4 h-4 text-blue-400" /></div> Early access to new features</li>
                                <li className="flex items-center gap-4"><div className="w-6 h-6 rounded-full bg-blue-500/20 flex items-center justify-center"><Check className="w-4 h-4 text-blue-400" /></div> Advanced GastroAI analytics</li>
                                <li className="flex items-center gap-4"><div className="w-6 h-6 rounded-full bg-blue-500/20 flex items-center justify-center"><Heart className="w-4 h-4 text-rose-500" /></div> Direct support of the project</li>
                            </ul>

                            <Button 
                                onClick={() => handleDonationClick('5')}
                                disabled={isLoadingPayment}
                                className="w-full bg-blue-600 text-white hover:bg-blue-500 hover:scale-[1.02] active:scale-[0.98] shadow-2xl shadow-blue-600/40 rounded-2xl h-16 text-base font-bold transition-all relative z-10 flex items-center justify-center gap-2"
                            >
                                {isLoadingPayment ? <Loader2 className="w-5 h-5 animate-spin" /> : <Heart className="w-5 h-5 fill-white/20" />}
                                Become a Supporter
                            </Button>
                        </motion.div>
                    </div>
                </div>
            </section>

            {/* One-time Donations */}
            <section className="py-24 px-6 bg-gray-50/50 dark:bg-white/[0.02]">
                <div className="container mx-auto max-w-5xl">
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        transition={{ delay: 0.2 }}
                        className="text-center mb-16"
                    >
                        <h2 className="text-3xl md:text-5xl font-bold text-gray-900 dark:text-white mb-6 tracking-tight">
                            Or buy us a coffee
                        </h2>
                        <p className="text-lg text-gray-500 dark:text-white/40 max-w-lg mx-auto font-medium">
                            Every donation helps us add new cities, improve the AI, and keep GastroMap running for everyone.
                        </p>
                    </motion.div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 max-w-3xl mx-auto">
                        {[
                            { icon: Coffee, label: 'Coffee', amount: '3', desc: 'A small thank you' },
                            { icon: Heart, label: 'Lunch', amount: '10', desc: 'Fuel the team' },
                            { icon: Users, label: 'Champion', amount: '25', desc: 'You are amazing' },
                        ].map((tier, i) => (
                            <motion.button
                                key={tier.label}
                                initial={{ opacity: 0, y: 20 }}
                                whileInView={{ opacity: 1, y: 0 }}
                                viewport={{ once: true }}
                                transition={{ delay: 0.3 + i * 0.1 }}
                                onClick={() => handleDonationClick(tier.amount)}
                                className="p-8 rounded-[32px] bg-white dark:bg-[#1C1C1E] border border-gray-100 dark:border-white/5 hover:border-blue-500/50 dark:hover:border-blue-500/50 transition-all text-center group shadow-sm hover:shadow-xl hover:shadow-blue-500/5"
                            >
                                <div className="w-16 h-16 bg-blue-50 dark:bg-blue-900/20 rounded-2xl flex items-center justify-center mx-auto mb-6 group-hover:scale-110 transition-transform duration-500">
                                    <tier.icon className="w-8 h-8 text-blue-500" />
                                </div>
                                <div className="text-3xl font-bold text-gray-900 dark:text-white mb-2">${tier.amount}</div>
                                <div className="text-[10px] font-bold text-gray-400 dark:text-white/30 uppercase tracking-[0.2em] mb-2">{tier.label}</div>
                                <div className="text-sm text-gray-500 dark:text-white/40 font-medium">{tier.desc}</div>
                            </motion.button>
                        ))}
                    </div>
                </div>
            </section>

            {/* Why Free */}
            <section className="py-24 px-6 relative">
                <div className="container mx-auto max-w-3xl text-center">
                    <motion.div
                        initial={{ opacity: 0 }}
                        whileInView={{ opacity: 1 }}
                        viewport={{ once: true }}
                        transition={{ delay: 0.4 }}
                    >
                        <div className="w-20 h-20 bg-blue-50 dark:bg-blue-900/20 rounded-3xl flex items-center justify-center mx-auto mb-10">
                            <Globe className="w-10 h-10 text-blue-500" />
                        </div>
                        <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-8 tracking-tight">
                            Why is GastroMap free?
                        </h2>
                        <p className="text-lg text-gray-500 dark:text-white/40 leading-relaxed font-medium">
                            We believe finding great food should never be behind a paywall.
                            GastroMap is an open community project built by locals who love sharing their favorite spots.
                            We keep the lights on through voluntary donations and community support.
                            No ads, no hidden fees, no premium walls.
                        </p>
                    </motion.div>
                </div>
            </section>

            <DonationModal 
                isOpen={isDonationModalOpen}
                onClose={() => setIsDonationModalOpen(false)}
                onSubmit={processDonation}
                isLoading={isLoadingPayment}
                initialAmount={selectedAmount}
            />
        </div>
    )
}

export default PricingPage
