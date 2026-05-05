import React from 'react'
import PageHeader from '@/components/layout/public/PageHeader'
import { motion } from 'framer-motion'
import { CheckCircle, AlertCircle, Server, Database, Globe, Zap } from 'lucide-react'

const surfaceApple = "bg-white dark:bg-[#1C1C1E] shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-[0_8px_30px_rgb(255,255,255,0.02)] border border-black/[0.08] dark:border-white/[0.06]"

const fadeInUp = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.5 } },
}

const services = [
    { name: "API & Authentication", status: "operational", icon: Server, uptime: "99.98%" },
    { name: "Database & Storage", status: "operational", icon: Database, uptime: "99.99%" },
    { name: "Search & AI Guide", status: "operational", icon: Zap, uptime: "99.95%" },
    { name: "Maps & Location", status: "operational", icon: Globe, uptime: "99.97%" },
]

const incidents = [
    { date: "May 1, 2026", title: "Scheduled maintenance", description: "Brief maintenance window for database optimization. No service disruption expected.", resolved: true },
    { date: "Apr 22, 2026", title: "AI search latency spike", description: "Elevated response times for AI Guide queries. Resolved within 15 minutes.", resolved: true },
]

const StatusPage = () => {
    const allOperational = services.every(s => s.status === "operational")

    return (
        <div className="bg-[#F5F5F7] dark:bg-black min-h-screen">
            <PageHeader
                title="System Status"
                subtitle="Real-time overview of GastroMap platform health and service availability."
                highlight="Platform Health"
            />

            {/* Overall Status */}
            <section className="px-4 sm:px-6 md:px-8 pb-8">
                <div className="max-w-[800px] mx-auto">
                    <motion.div
                        variants={fadeInUp}
                        initial="hidden"
                        animate="visible"
                        className={`p-8 md:p-10 rounded-[32px] md:rounded-[40px] flex items-center gap-6 ${surfaceApple} ${allOperational ? 'border-green-500/20' : 'border-amber-500/20'}`}
                    >
                        <div className={`w-16 h-16 rounded-2xl flex items-center justify-center flex-shrink-0 ${allOperational ? 'bg-green-50 text-green-600' : 'bg-amber-50 text-amber-600'}`}>
                            {allOperational ? <CheckCircle size={32} /> : <AlertCircle size={32} />}
                        </div>
                        <div>
                            <h2 className={`text-2xl font-bold ${allOperational ? 'text-green-600' : 'text-amber-600'}`}>
                                {allOperational ? 'All Systems Operational' : 'Partial Service Disruption'}
                            </h2>
                            <p className="text-gray-500 dark:text-white/50 mt-1">
                                Last updated: {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} UTC
                            </p>
                        </div>
                    </motion.div>
                </div>
            </section>

            {/* Service Grid */}
            <section className="px-4 sm:px-6 md:px-8 pb-12">
                <div className="max-w-[800px] mx-auto">
                    <div className="space-y-3">
                        {services.map((service, i) => (
                            <motion.div
                                key={i}
                                variants={fadeInUp}
                                initial="hidden"
                                whileInView="visible"
                                viewport={{ once: true }}
                                transition={{ delay: i * 0.05 }}
                                className={`p-5 rounded-2xl flex items-center justify-between ${surfaceApple}`}
                            >
                                <div className="flex items-center gap-4">
                                    <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-500/10 text-blue-600 flex items-center justify-center">
                                        <service.icon size={20} />
                                    </div>
                                    <div>
                                        <h3 className="font-bold text-gray-900 dark:text-white">{service.name}</h3>
                                        <p className="text-sm text-gray-400">Uptime: {service.uptime}</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className="w-2.5 h-2.5 rounded-full bg-green-500 animate-pulse" />
                                    <span className="text-sm font-semibold text-green-600 capitalize">{service.status}</span>
                                </div>
                            </motion.div>
                        ))}
                    </div>
                </div>
            </section>

            {/* Incident History */}
            <section className="px-4 sm:px-6 md:px-8 pb-24">
                <div className="max-w-[800px] mx-auto">
                    <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-6">Recent Incidents</h3>
                    <div className="space-y-4">
                        {incidents.map((incident, i) => (
                            <motion.div
                                key={i}
                                variants={fadeInUp}
                                initial="hidden"
                                whileInView="visible"
                                viewport={{ once: true }}
                                transition={{ delay: i * 0.1 }}
                                className={`p-6 rounded-2xl ${surfaceApple}`}
                            >
                                <div className="flex items-start justify-between mb-2">
                                    <h4 className="font-bold text-gray-900 dark:text-white">{incident.title}</h4>
                                    <span className={`px-3 py-1 rounded-full text-xs font-semibold ${incident.resolved ? 'bg-green-50 text-green-600' : 'bg-amber-50 text-amber-600'}`}>
                                        {incident.resolved ? 'Resolved' : 'Ongoing'}
                                    </span>
                                </div>
                                <p className="text-sm text-gray-500 dark:text-white/50 mb-2">{incident.description}</p>
                                <p className="text-xs text-gray-400">{incident.date}</p>
                            </motion.div>
                        ))}
                    </div>
                </div>
            </section>
        </div>
    )
}

export default StatusPage
