import React, { useRef, useEffect } from 'react'
import { motion, useScroll, useTransform, useMotionValue } from 'framer-motion'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { Plus, Heart, Instagram, ArrowUpRight } from 'lucide-react'

const ManifestoSection = ({ isDark }) => {
    const { t } = useTranslation()
    const navigate = useNavigate()
    const containerRef = useRef(null)

    // Mouse parallax - very subtle
    const mouseX = useMotionValue(0)
    const mouseY = useMotionValue(0)



    useEffect(() => {
        const handleMouseMove = (e) => {
            const { clientX, clientY } = e
            const { innerWidth, innerHeight } = window
            mouseX.set((clientX / innerWidth - 0.5) * 25)
            mouseY.set((clientY / innerHeight - 0.5) * 25)
        }
        if (window.innerWidth > 768) {
            window.addEventListener('mousemove', handleMouseMove)
        }
        return () => window.removeEventListener('mousemove', handleMouseMove)
    }, [mouseX, mouseY])

    const { scrollYProgress } = useScroll({
        target: containerRef,
        offset: ["start end", "end start"]
    })

    const titleY = useTransform(scrollYProgress, [0, 1], [10, -10])
    
    const containerVariants = {
        hidden: { opacity: 0 },
        visible: {
            opacity: 1,
            transition: { staggerChildren: 0.04, delayChildren: 0.1 }
        }
    }

    const wordVariants = {
        hidden: { y: "30%", opacity: 0 },
        visible: {
            y: 0,
            opacity: 1,
            transition: { duration: 0.8, ease: [0.16, 1, 0.3, 1] }
        }
    }

    const itemVariants = {
        hidden: { opacity: 0, y: 15 },
        visible: {
            opacity: 1,
            y: 0,
            transition: { duration: 0.8, ease: [0.16, 1, 0.3, 1] }
        }
    }

    return (
        <section 
            ref={containerRef}
            className={`relative py-8 md:py-24 ${
                isDark ? 'text-white' : 'text-slate-900'
            }`}
        >
            <motion.div 
                variants={containerVariants}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true, margin: "-50px" }}
                className="max-w-6xl mx-auto relative z-10 px-5 md:px-10"
            >
                {/* Minimalist Title */}
                <motion.div style={{ y: titleY }} className="mb-8 md:mb-12">
                    <motion.p 
                        variants={itemVariants}
                        className={`text-[9px] md:text-[10px] font-black tracking-[0.3em] uppercase mb-4 flex items-center gap-3 ${
                            isDark ? 'text-blue-400/60' : 'text-blue-600/60'
                        }`}
                    >
                        <span className="w-6 md:w-8 h-px bg-current opacity-20" />
                        {t('manifesto.title_eyebrow') || 'MANIFESTO'}
                    </motion.p>
                    
                    <div className="overflow-hidden">
                        <motion.h2 className="text-2xl sm:text-3xl md:text-5xl font-black tracking-tighter leading-[1.1] md:leading-[1.1] flex flex-wrap gap-x-3 md:gap-x-6">
                            {t('manifesto.title').split(' ').map((word, i) => (
                                <span key={i} className="inline-block overflow-hidden">
                                    <motion.span 
                                        variants={wordVariants}
                                        className="inline-block"
                                    >
                                        {word}
                                    </motion.span>
                                </span>
                            ))}
                        </motion.h2>
                    </div>
                </motion.div>

                {/* Content Grid */}
                <div className="grid lg:grid-cols-[1.2fr_0.8fr] gap-6 md:gap-20 items-start mb-10 md:mb-16">
                    <motion.div variants={itemVariants} className="space-y-4 md:space-y-8">
                        <p className={`text-xl sm:text-2xl md:text-5xl leading-tight font-light tracking-tight ${
                            isDark ? 'text-white/80' : 'text-slate-800'
                        }`}>
                            {t('manifesto.description')}
                        </p>
                        
                        <div className={`h-px w-12 ${isDark ? 'bg-white/10' : 'bg-slate-200'}`} />
                    </motion.div>

                    <motion.div variants={itemVariants} className="space-y-4 md:space-y-6">
                        <p className={`text-base md:text-2xl leading-relaxed font-normal italic font-serif opacity-60`}>
                            "{t('manifesto.creator_story')}"
                        </p>
                        
                        <motion.a 
                            href="https://instagram.com/Alikovit" 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="group flex items-center gap-4 py-1 opacity-60 hover:opacity-100 transition-opacity"
                        >
                            <Instagram size={18} className="group-hover:text-blue-500 transition-colors" />
                            <span className="text-sm md:text-xl font-bold tracking-tight">@Alikovit</span>
                            <ArrowUpRight size={14} className="opacity-0 group-hover:opacity-100 transition-all -translate-x-2 group-hover:translate-x-0" />
                        </motion.a>
                    </motion.div>
                </div>

                {/* Minimalist CTA - Integrated Directly */}
                <motion.div 
                    variants={itemVariants}
                    className="flex flex-col lg:flex-row items-center justify-between gap-6 md:gap-12 pt-8 md:pt-12 border-t border-current/5"
                >
                    <div className="text-center lg:text-left max-w-lg">
                        <h3 className="text-2xl md:text-4xl font-black mb-2 md:mb-4 tracking-tighter">
                            {t('manifesto.join_title')}
                        </h3>
                        <p className={`text-sm md:text-lg font-light leading-relaxed ${
                            isDark ? 'text-white/40' : 'text-slate-500'
                        }`}>
                            {t('manifesto.join_description')}
                        </p>
                    </div>

                    <div className="flex flex-col sm:flex-row items-center gap-3 md:gap-5 w-full lg:w-auto">
                        <motion.button 
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                            onClick={() => navigate('/dashboard/add-place')}
                            className={`h-12 md:h-16 px-6 md:px-8 rounded-xl md:rounded-2xl font-black text-sm md:text-base flex items-center justify-center gap-3 transition-all cursor-pointer w-full sm:w-auto ${
                                isDark 
                                    ? 'bg-white text-black' 
                                    : 'bg-slate-950 text-white shadow-md shadow-slate-200'
                            }`}
                        >
                            {t('manifesto.add_place')}
                            <Plus size={16} />
                        </motion.button>
                        
                        <motion.button 
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                            className={`h-12 md:h-16 px-6 md:px-8 rounded-xl md:rounded-2xl font-black text-sm md:text-base flex items-center justify-center gap-3 transition-all border cursor-pointer w-full sm:w-auto ${
                                isDark 
                                    ? 'bg-transparent border-white/20 text-white hover:bg-white/5' 
                                    : 'bg-white border-slate-200 text-slate-950 hover:border-slate-400'
                            }`}
                        >
                            {t('manifesto.donate')}
                            <Heart size={16} className="text-red-500" />
                        </motion.button>
                    </div>
                </motion.div>
            </motion.div>
        </section>
    )
}

export default ManifestoSection
