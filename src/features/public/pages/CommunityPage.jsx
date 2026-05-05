import React from 'react'
import PageHeader from '@/components/layout/public/PageHeader'
import { motion } from 'framer-motion'
import { Heart, MessageCircle, Star, Users, Award, MapPin, ArrowUpRight, Globe } from 'lucide-react'
import { Link } from 'react-router-dom'

const surfaceApple = "bg-white dark:bg-[#1C1C1E] shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-[0_8px_30px_rgb(255,255,255,0.02)] border border-black/[0.08] dark:border-white/[0.06]"

const fadeInUp = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.5 } },
}

const stats = [
    { label: "Contributors", value: "2,400+", icon: Users },
    { label: "Reviews", value: "18,000+", icon: MessageCircle },
    { label: "Cities", value: "120+", icon: MapPin },
    { label: "Countries", value: "35+", icon: Globe },
]

const guidelines = [
    {
        title: "Be Authentic",
        desc: "Share your genuine experiences. Reviews should reflect your real visit, not hearsay or promotional content.",
        icon: Heart
    },
    {
        title: "Be Constructive",
        desc: "Critique is welcome when it's helpful. Focus on what could improve rather than tearing things down.",
        icon: MessageCircle
    },
    {
        title: "Be Respectful",
        desc: "Treat fellow community members, business owners, and staff with courtesy. No harassment, hate speech, or personal attacks.",
        icon: Users
    },
    {
        title: "Be Accurate",
        desc: "Ensure details like hours, prices, and locations are correct. Update your contributions when things change.",
        icon: Star
    }
]

const topContributors = [
    { name: "Anna K.", role: "Top Reviewer", city: "Warsaw", contributions: 342, img: "https://i.pravatar.cc/100?img=5" },
    { name: "James L.", role: "Location Scout", city: "London", contributions: 278, img: "https://i.pravatar.cc/100?img=3" },
    { name: "Sarah M.", role: "Photographer", city: "NYC", contributions: 195, img: "https://i.pravatar.cc/100?img=9" },
]

const CommunityPage = () => {
    return (
        <div className="bg-[#F5F5F7] dark:bg-black min-h-screen">
            <PageHeader
                title="Join the Conversation"
                subtitle="A global community of food lovers, travelers, and local experts sharing the world's best culinary discoveries."
                highlight="Community"
            />

            {/* Stats */}
            <section className="px-4 sm:px-6 md:px-8 pb-12">
                <div className="max-w-[1000px] mx-auto">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        {stats.map((stat, i) => (
                            <motion.div
                                key={i}
                                variants={fadeInUp}
                                initial="hidden"
                                whileInView="visible"
                                viewport={{ once: true }}
                                transition={{ delay: i * 0.05 }}
                                className={`p-6 rounded-2xl text-center ${surfaceApple}`}
                            >
                                <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-500/10 text-blue-600 flex items-center justify-center mx-auto mb-3">
                                    <stat.icon size={20} />
                                </div>
                                <div className="text-2xl font-bold text-gray-900 dark:text-white">{stat.value}</div>
                                <div className="text-xs text-gray-500 dark:text-white/50 font-medium mt-1">{stat.label}</div>
                            </motion.div>
                        ))}
                    </div>
                </div>
            </section>

            {/* Guidelines */}
            <section className="px-4 sm:px-6 md:px-8 pb-12">
                <div className="max-w-[1000px] mx-auto">
                    <motion.h2
                        variants={fadeInUp}
                        initial="hidden"
                        whileInView="visible"
                        viewport={{ once: true }}
                        className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white mb-8 text-center"
                    >
                        Community Guidelines
                    </motion.h2>
                    <div className="grid sm:grid-cols-2 gap-4">
                        {guidelines.map((g, i) => (
                            <motion.div
                                key={i}
                                variants={fadeInUp}
                                initial="hidden"
                                whileInView="visible"
                                viewport={{ once: true }}
                                transition={{ delay: i * 0.1 }}
                                className={`p-6 rounded-2xl ${surfaceApple}`}
                            >
                                <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-500/10 text-blue-600 flex items-center justify-center mb-4">
                                    <g.icon size={20} />
                                </div>
                                <h3 className="font-bold text-gray-900 dark:text-white mb-2">{g.title}</h3>
                                <p className="text-sm text-gray-500 dark:text-white/50 leading-relaxed">{g.desc}</p>
                            </motion.div>
                        ))}
                    </div>
                </div>
            </section>

            {/* Top Contributors */}
            <section className="px-4 sm:px-6 md:px-8 pb-12">
                <div className="max-w-[1000px] mx-auto">
                    <motion.h2
                        variants={fadeInUp}
                        initial="hidden"
                        whileInView="visible"
                        viewport={{ once: true }}
                        className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white mb-8 text-center"
                    >
                        Top Contributors
                    </motion.h2>
                    <div className="space-y-3">
                        {topContributors.map((c, i) => (
                            <motion.div
                                key={i}
                                variants={fadeInUp}
                                initial="hidden"
                                whileInView="visible"
                                viewport={{ once: true }}
                                transition={{ delay: i * 0.1 }}
                                className={`p-5 rounded-2xl flex items-center gap-4 ${surfaceApple}`}
                            >
                                <div className="relative">
                                    <img src={c.img} alt={c.name} className="w-12 h-12 rounded-full object-cover" />
                                    {i === 0 && (
                                        <div className="absolute -top-1 -right-1 w-5 h-5 bg-yellow-400 rounded-full flex items-center justify-center">
                                            <Award size={12} className="text-yellow-900" />
                                        </div>
                                    )}
                                </div>
                                <div className="flex-1">
                                    <h3 className="font-bold text-gray-900 dark:text-white">{c.name}</h3>
                                    <p className="text-sm text-gray-500 dark:text-white/50">{c.role} &middot; {c.city}</p>
                                </div>
                                <div className="text-right">
                                    <div className="text-lg font-bold text-gray-900 dark:text-white">{c.contributions}</div>
                                    <div className="text-xs text-gray-400">contributions</div>
                                </div>
                            </motion.div>
                        ))}
                    </div>
                    <div className="text-center mt-6">
                        <Link to="/dashboard/leaderboard" className="inline-flex items-center gap-2 text-blue-600 font-semibold hover:text-blue-700 transition-colors">
                            View Full Leaderboard <ArrowUpRight size={16} />
                        </Link>
                    </div>
                </div>
            </section>

            {/* CTA */}
            <section className="px-4 sm:px-6 md:px-8 pb-24">
                <div className="max-w-[800px] mx-auto">
                    <motion.div
                        variants={fadeInUp}
                        initial="hidden"
                        whileInView="visible"
                        viewport={{ once: true }}
                        className="bg-gradient-to-br from-blue-900 to-black text-white p-8 md:p-12 rounded-[40px] text-center relative overflow-hidden"
                    >
                        <div className="absolute top-0 right-0 w-64 h-64 bg-blue-600 rounded-full blur-[120px] opacity-20 pointer-events-none" />
                        <h2 className="text-2xl md:text-3xl font-bold mb-4 relative z-10">Ready to contribute?</h2>
                        <p className="text-white/60 mb-8 max-w-md mx-auto relative z-10">
                            Every review, photo, and location you add helps thousands of food lovers discover their next favorite spot.
                        </p>
                        <div className="flex flex-col sm:flex-row gap-3 justify-center relative z-10">
                            <Link to="/auth/signup">
                                <button className="h-12 px-8 rounded-full bg-white text-blue-900 font-bold text-sm hover:bg-blue-50 transition-colors">
                                    Join the Community
                                </button>
                            </Link>
                            <Link to="/auth/signup?action=add-place">
                                <button className="h-12 px-8 rounded-full bg-white/10 border border-white/10 text-white font-bold text-sm hover:bg-white/20 transition-colors">
                                    Add a Place
                                </button>
                            </Link>
                        </div>
                    </motion.div>
                </div>
            </section>
        </div>
    )
}

export default CommunityPage
