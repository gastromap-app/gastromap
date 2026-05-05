import React from 'react'
import PageHeader from '@/components/layout/public/PageHeader'
import { motion } from 'framer-motion'
import { Shield, Lock, Server, Eye, FileCheck, RefreshCw } from 'lucide-react'

const surfaceApple = "bg-white dark:bg-[#1C1C1E] shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-[0_8px_30px_rgb(255,255,255,0.02)] border border-black/[0.08] dark:border-white/[0.06]"

const fadeInUp = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.5 } },
}

const practices = [
    {
        icon: Lock,
        title: "End-to-End Encryption",
        desc: "All data in transit is protected with TLS 1.3. Sensitive fields like authentication tokens are encrypted at rest using industry-standard AES-256."
    },
    {
        icon: Server,
        title: "Secure Infrastructure",
        desc: "Our infrastructure runs on SOC 2 compliant cloud providers with automated vulnerability scanning, intrusion detection, and DDoS protection."
    },
    {
        icon: Eye,
        title: "Privacy by Design",
        desc: "We collect only what's necessary. Location data is used solely for map features and is never sold to third parties or used for targeted advertising."
    },
    {
        icon: FileCheck,
        title: "Regular Audits",
        desc: "We conduct quarterly security audits and penetration tests. Our code undergoes automated security scanning before every deployment."
    },
    {
        icon: RefreshCw,
        title: "Incident Response",
        desc: "Our team maintains a 24-hour incident response plan. In the unlikely event of a breach, affected users will be notified within 72 hours."
    },
    {
        icon: Shield,
        title: "GDPR Compliant",
        desc: "We fully comply with GDPR and similar regulations worldwide. Users can export or delete their data at any time from their profile settings."
    }
]

const SecurityPage = () => {
    return (
        <div className="bg-[#F5F5F7] dark:bg-black min-h-screen">
            <PageHeader
                title="Security at GastroMap"
                subtitle="Your data and privacy are foundational to everything we build. Here's how we protect them."
                highlight="Trust & Safety"
            />

            {/* Hero Statement */}
            <section className="px-4 sm:px-6 md:px-8 pb-12">
                <div className="max-w-[800px] mx-auto">
                    <motion.div
                        variants={fadeInUp}
                        initial="hidden"
                        animate="visible"
                        className={`p-8 md:p-10 rounded-[32px] md:rounded-[40px] text-center ${surfaceApple}`}
                    >
                        <div className="w-16 h-16 rounded-2xl bg-blue-50 dark:bg-blue-500/10 text-blue-600 flex items-center justify-center mx-auto mb-6">
                            <Shield size={32} />
                        </div>
                        <h2 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white mb-4">
                            Built with security in mind
                        </h2>
                        <p className="text-gray-500 dark:text-white/50 max-w-lg mx-auto leading-relaxed">
                            GastroMap was designed from the ground up with privacy and security as core principles.
                            We never sell your data, we minimize what we collect, and we give you full control over your information.
                        </p>
                    </motion.div>
                </div>
            </section>

            {/* Practices Grid */}
            <section className="px-4 sm:px-6 md:px-8 pb-24">
                <div className="max-w-[1000px] mx-auto">
                    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
                        {practices.map((p, i) => (
                            <motion.div
                                key={i}
                                variants={fadeInUp}
                                initial="hidden"
                                whileInView="visible"
                                viewport={{ once: true }}
                                transition={{ delay: i * 0.05 }}
                                className={`p-6 rounded-2xl ${surfaceApple}`}
                            >
                                <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-500/10 text-blue-600 flex items-center justify-center mb-4">
                                    <p.icon size={20} />
                                </div>
                                <h3 className="font-bold text-gray-900 dark:text-white mb-2">{p.title}</h3>
                                <p className="text-sm text-gray-500 dark:text-white/50 leading-relaxed">{p.desc}</p>
                            </motion.div>
                        ))}
                    </div>
                </div>
            </section>

            {/* Report Section */}
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
                        <h2 className="text-2xl font-bold mb-4 relative z-10">Found a vulnerability?</h2>
                        <p className="text-white/60 mb-8 max-w-md mx-auto relative z-10">
                            We welcome responsible disclosure. If you've discovered a security issue, please report it to us directly.
                        </p>
                        <a
                            href="mailto:gastromap1@gmail.com?subject=Security%20Report"
                            className="inline-block h-12 px-8 rounded-full bg-white text-blue-900 font-bold text-sm hover:bg-blue-50 transition-colors relative z-10"
                        >
                            Report a Security Issue
                        </a>
                    </motion.div>
                </div>
            </section>
        </div>
    )
}

export default SecurityPage
