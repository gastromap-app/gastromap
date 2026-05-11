import React from 'react'
import { motion } from 'framer-motion'

const PageHeader = ({ title, subtitle, highlight }) => (
    <section className="pt-32 pb-16 px-6 bg-white dark:bg-[#0F1115] relative overflow-hidden border-b border-gray-100 dark:border-white/5">
        {/* Анимированный фон */}
        <div className="absolute top-0 left-0 w-full h-full pointer-events-none">
            <div className="absolute -top-24 -left-24 w-[500px] h-[500px] bg-blue-500/10 dark:bg-blue-600/20 rounded-full blur-[120px] animate-pulse" />
            <div className="absolute -bottom-24 -right-24 w-[500px] h-[500px] bg-purple-500/10 dark:bg-purple-600/20 rounded-full blur-[120px] animate-pulse" style={{ animationDelay: '2s' }} />
        </div>
        
        <div className="container mx-auto max-w-7xl text-center relative z-10">
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, ease: "easeOut" }}
            >
                {highlight && (
                    <div className="inline-flex items-center px-4 py-1.5 rounded-full bg-blue-50 dark:bg-blue-500/10 border border-blue-100 dark:border-blue-500/20 text-[10px] font-bold text-blue-600 dark:text-blue-400 uppercase tracking-[0.2em] mb-8 shadow-sm">
                        {highlight}
                    </div>
                )}
                <h1 className="text-5xl md:text-8xl font-extrabold mb-8 tracking-tight text-gray-900 dark:text-white max-w-5xl mx-auto leading-[0.95]">
                    {title}
                </h1>
                {subtitle && (
                    <p className="text-lg md:text-2xl text-gray-500 dark:text-white/40 max-w-2xl mx-auto leading-relaxed font-medium">
                        {subtitle}
                    </p>
                )}
            </motion.div>
        </div>
    </section>
)

export default PageHeader
