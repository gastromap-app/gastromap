import React, { useRef, useState, useEffect, useMemo } from 'react'
import { motion, useInView, AnimatePresence } from 'framer-motion'
import { Link } from 'react-router-dom'
import { getLocationsCount } from '@/shared/api/locations.api'
import { ArrowUpRight, Check, ChevronDown, Heart, Instagram, List, User, Globe, Search, Sparkles, CheckCircle, MapPin } from 'lucide-react'
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

gsap.registerPlugin(ScrollTrigger)

// ════════════════════════════════════════════════════════════════════════════
// DESIGN TOKENS — Evasion-inspired monochrome palette
// ════════════════════════════════════════════════════════════════════════════
const C = {
    bg:       'bg-white dark:bg-[#0A0A0A]',
    surface:  'bg-[#F5F5F5] dark:bg-white/5',
    fg:       'text-[#0A0A0A] dark:text-white',
    muted:    'text-[#737373] dark:text-white/50',
    border:   'border-[#E5E5E5] dark:border-white/10',
    card:     'bg-white dark:bg-[#141414] border border-[#E5E5E5] dark:border-white/10',
    dark:     'bg-[#0A0A0A] dark:bg-[#050505] text-white',
}

const CUBIC = [0.86, 0, 0.07, 1] // Evasion's signature easing

// ════════════════════════════════════════════════════════════════════════════
// SHARED ANIMATION VARIANTS
// ════════════════════════════════════════════════════════════════════════════
const fadeUp = {
    hidden: { opacity: 0, y: 40 },
    visible: (d = 0) => ({ opacity: 1, y: 0, transition: { duration: 0.8, delay: d, ease: CUBIC } }),
}

const stagger = {
    hidden: {},
    visible: { transition: { staggerChildren: 0.1, delayChildren: 0.15 } },
}

// ════════════════════════════════════════════════════════════════════════════
// 1. HERO — Full viewport, letter-by-letter animation
// ════════════════════════════════════════════════════════════════════════════
const HeroSection = () => {
    const line1 = 'GASTRO'
    const line2 = 'MAP'
    const [locationCount, setLocationCount] = useState(null)

    useEffect(() => {
        getLocationsCount().then(n => setLocationCount(n)).catch(() => setLocationCount(0))
    }, [])

    const formatCount = (n) => {
        if (n == null) return '—'
        if (n >= 1000) return `${(n / 1000).toFixed(n >= 10000 ? 0 : 1).replace(/\.0$/, '')}k+`
        return String(n)
    }

    return (
        <section className="relative h-screen w-full overflow-hidden">
            {/* Background image with dark overlay */}
            <img
                src="https://images.unsplash.com/photo-1514362545857-3bc16c4c7d1b?q=80&w=2000&auto=format&fit=crop"
                alt=""
                className="absolute inset-0 w-full h-full object-cover"
                fetchPriority="high"
            />
            <div className="absolute inset-0 bg-[#0A0A0A]/60" />

            {/* Content */}
            <div className="relative z-10 flex flex-col items-center justify-center h-full px-6 text-center">
                {/* Two-line letter-by-letter title */}
                <motion.h1
                    className="text-[18vw] md:text-[11vw] lg:text-[9vw] font-medium tracking-tighter leading-[0.85] text-white select-none"
                    aria-label="GastroMap"
                >
                    <span className="block">
                        {line1.split('').map((char, i) => (
                            <motion.span
                                key={`l1-${i}`}
                                className="inline-block"
                                initial={{ opacity: 0, y: '100%' }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ duration: 0.8, delay: i * 0.08, ease: CUBIC }}
                            >
                                {char}
                            </motion.span>
                        ))}
                    </span>
                    <span className="block">
                        {line2.split('').map((char, i) => (
                            <motion.span
                                key={`l2-${i}`}
                                className="inline-block"
                                initial={{ opacity: 0, y: '100%' }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ duration: 0.8, delay: 0.5 + i * 0.08, ease: CUBIC }}
                            >
                                {char}
                            </motion.span>
                        ))}
                    </span>
                </motion.h1>

                {/* Tagline */}
                <motion.p
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.8, delay: 1, ease: CUBIC }}
                    className="mt-6 md:mt-8 text-lg md:text-2xl text-white/70 font-normal max-w-xl leading-relaxed"
                >
                    Discover places. Share with friends.
                </motion.p>

                {/* CTA */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.8, delay: 1.3, ease: CUBIC }}
                    className="mt-8 md:mt-10 flex flex-col sm:flex-row gap-3 sm:gap-4"
                >
                    <Link
                        to="/auth/signup"
                        className="h-12 md:h-14 px-8 md:px-10 rounded-full bg-white text-[#0A0A0A] text-sm md:text-base font-medium flex items-center justify-center gap-2 hover:bg-white/90 transition-colors"
                    >
                        Get Started
                        <ArrowUpRight size={16} />
                    </Link>
                    <Link
                        to="/explore"
                        className="h-12 md:h-14 px-8 md:px-10 rounded-full border border-white/20 text-white text-sm md:text-base font-medium flex items-center justify-center gap-2 backdrop-blur-sm hover:bg-white/10 transition-colors"
                    >
                        Explore Map
                    </Link>
                </motion.div>

                {/* Stats pill */}
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 1.8, duration: 1 }}
                    className="mt-12 md:mt-16 px-5 py-2.5 rounded-full bg-white/10 backdrop-blur-md border border-white/20 text-white/80 text-sm font-medium"
                >
                    {formatCount(locationCount)}+ curated locations worldwide
                </motion.div>
            </div>

            {/* Scroll indicator */}
            <motion.div
                className="absolute bottom-8 left-1/2 -translate-x-1/2"
                animate={{ y: [0, 8, 0] }}
                transition={{ repeat: Infinity, duration: 1.5, ease: 'easeInOut' }}
            >
                <div className="w-6 h-10 rounded-full border-2 border-white/30 flex items-start justify-center pt-2">
                    <div className="w-1 h-2 rounded-full bg-white/60" />
                </div>
            </motion.div>
        </section>
    )
}

// ════════════════════════════════════════════════════════════════════════════
// 2. ABOUT - GSAP ScrollReveal (ReactBits pattern)
// ════════════════════════════════════════════════════════════════════════════
const AboutSection = () => {
    const containerRef = useRef(null)

    const text = 'A community-driven map to find the best local spots or add your own discoveries. Built by locals, for travelers who seek authenticity over algorithms.'

    const splitText = useMemo(() => {
        return text.split(/(\s+)/).map((word, index) => {
            if (word.match(/^\s+$/)) return word
            return (
                <span className="scroll-word" key={index}>
                    {word}
                </span>
            )
        })
    }, [text])

    useEffect(() => {
        const el = containerRef.current
        if (!el) return

        const wordElements = el.querySelectorAll('.scroll-word')

        gsap.fromTo(
            wordElements,
            { opacity: 0.1, willChange: 'opacity' },
            {
                ease: 'none',
                opacity: 1,
                stagger: 0.02,
                scrollTrigger: {
                    trigger: el,
                    start: 'top 80%',
                    end: 'bottom 40%',
                    scrub: true,
                },
            }
        )

        return () => {
            ScrollTrigger.getAll().forEach(trigger => trigger.kill())
        }
    }, [])

    return (
        <section className={`py-20 md:py-32 lg:py-40 ${C.bg}`}>
            <div className="max-w-6xl mx-auto px-6 md:px-10 lg:px-20">
                <p className="text-xs font-normal tracking-widest uppercase text-[#737373] dark:text-white/40 mb-6">
                    About the project
                </p>
                <h2 ref={containerRef} className="text-3xl md:text-4xl lg:text-[2.5rem] font-medium tracking-tight leading-tight text-[#0A0A0A] dark:text-white">
                    {splitText}
                </h2>
                <div className="h-px w-12 bg-[#E5E5E5] dark:bg-white/10 mt-8" />
                <p className="mt-6 text-lg md:text-xl italic font-normal opacity-60 text-[#0A0A0A] dark:text-white max-w-lg leading-relaxed">
                    "Every great meal starts with a recommendation from someone who cares."
                </p>
                <a
                    href="https://instagram.com/Alikovit"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-4 inline-flex items-center gap-3 opacity-60 hover:opacity-100 transition-opacity text-[#0A0A0A] dark:text-white"
                >
                    <Instagram size={16} />
                    <span className="text-base font-medium tracking-tight">@Alikovit</span>
                    <ArrowUpRight size={14} />
                </a>
            </div>
        </section>
    )
}

// ════════════════════════════════════════════════════════════════════════════
// 3. FEATURES — Aceternity-style divide-x grid with skeleton animations
// ════════════════════════════════════════════════════════════════════════════

// --- Bio-Sync AI: Chat bubbles with pop-in + Coming Soon badge ---
const BioSyncDemo = () => {
    const ref = useRef(null)
    const isInView = useInView(ref, { once: true, margin: '-50px' })

    const messages = [
        { from: 'ai', text: 'You walked 10k steps today', delay: 0 },
        { from: 'ai', text: 'How about a healthy lunch?', delay: 0.5 },
        { from: 'ai', text: 'Try Green Bowl, 5 min away', delay: 1 },
    ]

    return (
        <div ref={ref} className="h-48 md:h-56 w-full overflow-visible rounded-lg bg-gradient-to-b from-blue-50/80 to-white dark:from-blue-950/20 dark:to-[#141414] p-3 relative">
            {/* Coming Soon badge */}
            <div className="absolute top-2 right-2 z-10">
                <motion.div
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={isInView ? { opacity: 1, scale: 1 } : {}}
                    transition={{ delay: 1.5, duration: 0.4, ease: CUBIC }}
                    className="flex items-center gap-1 bg-blue-500/10 dark:bg-blue-500/20 rounded-full px-2 py-0.5"
                >
                    <motion.div
                        animate={{ scale: [1, 1.2, 1] }}
                        transition={{ repeat: Infinity, duration: 2, ease: 'easeInOut' }}
                        className="w-1.5 h-1.5 rounded-full bg-blue-500"
                    />
                    <span className="text-[8px] font-bold tracking-wider uppercase text-blue-600 dark:text-blue-400">Soon</span>
                </motion.div>
            </div>

            {/* Top bar */}
            <div className="flex items-center gap-2 mb-3">
                <div className="w-5 h-5 rounded-full bg-blue-500/20 flex items-center justify-center">
                    <Sparkles size={10} className="text-blue-600 dark:text-blue-400" />
                </div>
                <span className="text-[10px] font-semibold tracking-widest uppercase text-blue-500/60 dark:text-blue-400/60">Bio-Sync AI</span>
            </div>

            {/* Chat messages with pop-in */}
            <div className="space-y-2">
                {messages.map((msg, i) => (
                    <motion.div
                        key={i}
                        initial={{ opacity: 0, y: 12, scale: 0.9 }}
                        animate={isInView ? { opacity: 1, y: 0, scale: 1 } : {}}
                        transition={{ duration: 0.5, delay: msg.delay, ease: [0.34, 1.56, 0.64, 1] }}
                        className="flex items-start gap-2"
                    >
                        <div className="w-5 h-5 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex-shrink-0 mt-0.5 flex items-center justify-center">
                            <Sparkles size={8} className="text-white" />
                        </div>
                        <div className="bg-white dark:bg-white/10 rounded-lg rounded-tl-none px-2.5 py-1.5 shadow-sm ring-1 ring-black/5 dark:ring-white/10">
                            <p className={`text-[11px] leading-snug font-medium ${
                                i === 2
                                    ? 'text-blue-600 dark:text-blue-400'
                                    : 'text-[#0A0A0A]/70 dark:text-white/70'
                            }`}>
                                {msg.text}
                                {i === 2 && (
                                    <motion.span
                                        animate={{ opacity: [0, 1, 0] }}
                                        transition={{ repeat: Infinity, duration: 0.8 }}
                                        className="inline-block w-[1.5px] h-2.5 bg-blue-500 ml-0.5 align-middle rounded-full"
                                    />
                                )}
                            </p>
                        </div>
                    </motion.div>
                ))}
            </div>

            {/* Typing indicator */}
            <motion.div
                initial={{ opacity: 0 }}
                animate={isInView ? { opacity: 1 } : {}}
                transition={{ delay: 1.6, duration: 0.5 }}
                className="absolute bottom-3 left-3 flex gap-1"
            >
                {[0, 0.15, 0.3].map((d, i) => (
                    <motion.div
                        key={i}
                        animate={{ y: [0, -3, 0] }}
                        transition={{ repeat: Infinity, duration: 0.6, delay: d }}
                        className="w-1 h-1 rounded-full bg-blue-400/50"
                    />
                ))}
            </motion.div>
        </div>
    )
}

// --- Smart Lists: Heart + checkmark icons fly into list, looped ---
const CollectionsDemo = () => {
    const ref = useRef(null)
    const isInView = useInView(ref, { once: true, margin: '-50px' })

    // List items that accumulate as icons fly in
    const listItems = [
        { icon: Heart, color: 'text-rose-500 fill-rose-500', label: 'Green Bowl' },
        { icon: CheckCircle, color: 'text-green-500', label: 'Sushi Zen' },
        { icon: Heart, color: 'text-rose-500 fill-rose-500', label: 'Bistro Noir' },
        { icon: CheckCircle, color: 'text-green-500', label: 'Cafe Luna' },
    ]

    // Flying icon sequence: heart -> list, check -> list, looping
    const flyCycleDuration = 4 // seconds per full heart+check cycle

    return (
        <div ref={ref} className="h-48 md:h-56 w-full overflow-visible rounded-lg bg-gradient-to-b from-amber-50/80 to-white dark:from-amber-950/20 dark:to-[#141414] p-3 relative">
            <div className="flex items-center justify-center h-full gap-6">
                {/* Left: flying icons zone */}
                <div className="relative w-14 h-14 flex-shrink-0">
                    {/* Heart - flies from top-left to right */}
                    <motion.div
                        animate={isInView ? {
                            x: [0, 40, 40, 0],
                            y: [0, 0, 20, 0],
                            scale: [1, 1.3, 1, 0],
                            opacity: [0, 1, 1, 0],
                        } : {}}
                        transition={{
                            duration: flyCycleDuration,
                            times: [0, 0.2, 0.35, 0.45],
                            repeat: Infinity,
                            repeatDelay: flyCycleDuration * 0.1,
                            ease: 'easeInOut',
                        }}
                        className="absolute top-0 left-0 z-20"
                    >
                        <div className="w-7 h-7 rounded-full bg-white dark:bg-[#141414] shadow-md ring-1 ring-black/5 dark:ring-white/10 flex items-center justify-center">
                            <Heart size={14} className="text-rose-500 fill-rose-500" />
                        </div>
                    </motion.div>

                    {/* Check - flies from bottom-left to right */}
                    <motion.div
                        animate={isInView ? {
                            x: [0, 40, 40, 0],
                            y: [30, 30, 10, 30],
                            scale: [1, 1.3, 1, 0],
                            opacity: [0, 1, 1, 0],
                        } : {}}
                        transition={{
                            duration: flyCycleDuration,
                            times: [0.5, 0.7, 0.85, 0.95],
                            repeat: Infinity,
                            repeatDelay: flyCycleDuration * 0.1,
                            ease: 'easeInOut',
                        }}
                        className="absolute bottom-0 left-0 z-20"
                    >
                        <div className="w-7 h-7 rounded-full bg-white dark:bg-[#141414] shadow-md ring-1 ring-black/5 dark:ring-white/10 flex items-center justify-center">
                            <CheckCircle size={14} className="text-green-500" />
                        </div>
                    </motion.div>
                </div>

                {/* Data transfer lines */}
                <div className="flex flex-col gap-1.5 w-12 overflow-hidden">
                    {[0, 1, 2, 3].map((i) => (
                        <div key={i} className="h-px bg-neutral-200 dark:bg-white/10 relative overflow-hidden">
                            <motion.div
                                initial={{ x: '-100%' }}
                                animate={isInView ? { x: '200%' } : {}}
                                transition={{
                                    repeat: Infinity,
                                    duration: 1.8,
                                    delay: i * 0.25,
                                    ease: 'linear',
                                }}
                                className="absolute inset-y-0 w-1/3 bg-gradient-to-r from-transparent via-amber-500 to-transparent opacity-60"
                            />
                        </div>
                    ))}
                </div>

                {/* Right: List that grows */}
                <motion.div
                    initial={{ opacity: 0, x: 10 }}
                    animate={isInView ? { opacity: 1, x: 0 } : {}}
                    transition={{ duration: 0.5, delay: 0.2, ease: CUBIC }}
                    className="w-28 rounded-lg bg-white dark:bg-white/10 shadow-sm ring-1 ring-black/5 dark:ring-white/10 overflow-hidden"
                >
                    {/* List header */}
                    <div className="px-2 py-1.5 bg-amber-50 dark:bg-amber-500/10 border-b border-neutral-100 dark:border-white/5">
                        <span className="text-[9px] font-bold tracking-wider uppercase text-amber-600 dark:text-amber-400">My Lists</span>
                    </div>
                    {/* List items */}
                    <div className="px-2 py-1.5 space-y-1.5">
                        {listItems.map((item, i) => (
                            <motion.div
                                key={i}
                                initial={{ opacity: 0, x: 10 }}
                                animate={isInView ? { opacity: 1, x: 0 } : {}}
                                transition={{
                                    delay: 0.5 + i * 0.4,
                                    duration: 0.3,
                                    ease: [0.34, 1.56, 0.64, 1],
                                }}
                                className="flex items-center gap-1.5"
                            >
                                <item.icon size={8} className={item.color} />
                                <span className="text-[9px] font-medium text-[#0A0A0A]/70 dark:text-white/70 truncate">{item.label}</span>
                            </motion.div>
                        ))}
                    </div>
                </motion.div>
            </div>
        </div>
    )
}

// --- Dine With Me: City map background + people icons + Coming Soon ---
const DineWithMeDemo = () => {
    const ref = useRef(null)
    const isInView = useInView(ref, { once: true, margin: '-50px' })

    const people = [
        { name: 'Anna', x: '25%', y: '35%', img: 'https://i.pravatar.cc/40?img=5', color: 'bg-blue-500', delay: 0.3, pingOffset: 0 },
        { name: 'Tyler', x: '60%', y: '25%', img: 'https://i.pravatar.cc/40?img=8', color: 'bg-emerald-500', delay: 0.6, pingOffset: 0.33 },
        { name: 'Sarah', x: '45%', y: '60%', img: 'https://i.pravatar.cc/40?img=9', color: 'bg-rose-500', delay: 0.9, pingOffset: 0.66 },
    ]

    // Each ping has a different phase offset within the 3s cycle
    // offset=0: ping at 0%, offset=0.33: ping at 33%, offset=0.66: ping at 66%
    const getPingKeyframes = (offset) => {
        const t1 = offset
        const t2 = Math.min(offset + 0.15, 1)
        const t3 = Math.min(offset + 0.3, 1)
        return {
            scale: [1, 1, 1.8, 1, 1],
            opacity: [0.3, 0.3, 0.5, 0, 0.3],
            times: [0, t1, t2, t3, 1],
        }
    }

    return (
        <div ref={ref} className="h-48 md:h-56 w-full overflow-hidden rounded-lg bg-gradient-to-b from-emerald-50/80 to-white dark:from-emerald-950/20 dark:to-[#141414] p-3 relative">
            {/* Coming Soon badge */}
            <div className="absolute top-2 right-2 z-10">
                <motion.div
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={isInView ? { opacity: 1, scale: 1 } : {}}
                    transition={{ delay: 1.2, duration: 0.4, ease: CUBIC }}
                    className="flex items-center gap-1 bg-emerald-500/10 dark:bg-emerald-500/20 rounded-full px-2 py-0.5"
                >
                    <motion.div
                        animate={{ scale: [1, 1.2, 1] }}
                        transition={{ repeat: Infinity, duration: 2, ease: 'easeInOut' }}
                        className="w-1.5 h-1.5 rounded-full bg-emerald-500"
                    />
                    <span className="text-[8px] font-bold tracking-wider uppercase text-emerald-600 dark:text-emerald-400">Soon</span>
                </motion.div>
            </div>

            {/* City map background */}
            <svg className="absolute inset-0 w-full h-full opacity-[0.08] dark:opacity-[0.04]" xmlns="http://www.w3.org/2000/svg">
                {/* Grid streets */}
                <line x1="10%" y1="20%" x2="90%" y2="20%" stroke="currentColor" strokeWidth="0.5" />
                <line x1="10%" y1="40%" x2="90%" y2="40%" stroke="currentColor" strokeWidth="0.5" />
                <line x1="10%" y1="60%" x2="90%" y2="60%" stroke="currentColor" strokeWidth="0.5" />
                <line x1="10%" y1="80%" x2="90%" y2="80%" stroke="currentColor" strokeWidth="0.5" />
                <line x1="20%" y1="10%" x2="20%" y2="90%" stroke="currentColor" strokeWidth="0.5" />
                <line x1="40%" y1="10%" x2="40%" y2="90%" stroke="currentColor" strokeWidth="0.5" />
                <line x1="60%" y1="10%" x2="60%" y2="90%" stroke="currentColor" strokeWidth="0.5" />
                <line x1="80%" y1="10%" x2="80%" y2="90%" stroke="currentColor" strokeWidth="0.5" />
                {/* Blocks */}
                <rect x="22%" y="22%" width="16%" height="16%" rx="2" fill="currentColor" opacity="0.3" />
                <rect x="42%" y="22%" width="16%" height="16%" rx="2" fill="currentColor" opacity="0.3" />
                <rect x="22%" y="42%" width="16%" height="16%" rx="2" fill="currentColor" opacity="0.3" />
                <rect x="62%" y="42%" width="16%" height="16%" rx="2" fill="currentColor" opacity="0.3" />
                <rect x="42%" y="62%" width="16%" height="16%" rx="2" fill="currentColor" opacity="0.3" />
                {/* Main road */}
                <line x1="50%" y1="5%" x2="50%" y2="95%" stroke="currentColor" strokeWidth="1.5" opacity="0.4" />
            </svg>

            {/* People icons appearing on map */}
            {people.map((p) => {
                const kf = getPingKeyframes(p.pingOffset)
                return (
                    <motion.div
                        key={p.name}
                        initial={{ opacity: 0, scale: 0 }}
                        animate={isInView ? { opacity: 1, scale: 1 } : {}}
                        transition={{ delay: p.delay, duration: 0.5, ease: [0.34, 1.56, 0.64, 1] }}
                        className="absolute z-10"
                        style={{ left: p.x, top: p.y }}
                    >
                        {/* Ping ring - desynchronized via keyframe phase offset */}
                        <motion.div
                            animate={{ scale: kf.scale, opacity: kf.opacity }}
                            transition={{ repeat: Infinity, duration: 3, times: kf.times, ease: 'easeOut' }}
                            className={`absolute rounded-full ${p.color}`}
                            style={{ width: 32, height: 32, marginLeft: -4, marginTop: -4 }}
                        />
                        <img src={p.img} alt="" className="w-6 h-6 rounded-full border-2 border-white dark:border-[#141414] shadow-sm relative z-10" />
                        <span className="absolute -bottom-3 left-1/2 -translate-x-1/2 text-[7px] font-bold text-[#0A0A0A]/60 dark:text-white/60 whitespace-nowrap">{p.name}</span>
                    </motion.div>
                )
            })}

            {/* Center label */}
            <motion.div
                initial={{ opacity: 0 }}
                animate={isInView ? { opacity: 1 } : {}}
                transition={{ delay: 1.2, duration: 0.5 }}
                className="absolute bottom-3 left-3 flex items-center gap-1.5 z-10"
            >
                <MapPin size={10} className="text-emerald-500" />
                <span className="text-[9px] font-semibold text-emerald-600/60 dark:text-emerald-400/60">Dining nearby</span>
            </motion.div>
        </div>
    )
}

// --- Worldwide Map: Typing animation + smart autocomplete ---
const WorldwideMapDemo = () => {
    const ref = useRef(null)
    const isInView = useInView(ref, { once: true, margin: '-50px' })

    const searchSteps = [
        { typed: 'K', results: [] },
        { typed: 'Kr', results: [
            { name: 'Kraków', country: 'Poland', flag: '🇵🇱' },
        ]},
        { typed: 'Kra', results: [
            { name: 'Kraków', country: 'Poland', flag: '🇵🇱' },
            { name: 'Krabi', country: 'Thailand', flag: '🇹🇭' },
        ]},
        { typed: 'Krak', results: [
            { name: 'Kraków', country: 'Poland', flag: '🇵🇱' },
            { name: 'Krakatau', country: 'Indonesia', flag: '🇮🇩' },
            { name: 'Krabi', country: 'Thailand', flag: '🇹🇭' },
        ]},
    ]

    const [step, setStep] = useState(0)

    useEffect(() => {
        if (!isInView) return
        const interval = setInterval(() => {
            setStep(prev => (prev + 1) % searchSteps.length)
        }, 1200)
        return () => clearInterval(interval)
    }, [isInView, searchSteps.length])

    const currentStep = searchSteps[step]
    const showMatch = step === searchSteps.length - 1

    return (
        <div ref={ref} className="h-48 md:h-56 w-full overflow-visible rounded-lg bg-gradient-to-b from-rose-50/80 to-white dark:from-rose-950/20 dark:to-[#141414] p-3 relative">
            {/* Coming Soon badge */}
            <div className="absolute top-2 right-2 z-10">
                <motion.div
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={isInView ? { opacity: 1, scale: 1 } : {}}
                    transition={{ delay: 1.5, duration: 0.4, ease: CUBIC }}
                    className="flex items-center gap-1 bg-rose-500/10 dark:bg-rose-500/20 rounded-full px-2 py-0.5"
                >
                    <motion.div
                        animate={{ scale: [1, 1.2, 1] }}
                        transition={{ repeat: Infinity, duration: 2, ease: 'easeInOut' }}
                        className="w-1.5 h-1.5 rounded-full bg-rose-500"
                    />
                    <span className="text-[8px] font-bold tracking-wider uppercase text-rose-600 dark:text-rose-400">Soon</span>
                </motion.div>
            </div>

            {/* Search bar with typing animation */}
            <motion.div
                initial={{ opacity: 0, y: -5 }}
                animate={isInView ? { opacity: 1, y: 0 } : {}}
                transition={{ duration: 0.4, ease: CUBIC }}
                className="flex items-center gap-2 bg-white dark:bg-white/10 rounded-lg px-2.5 py-1.5 pr-14 shadow-sm ring-1 ring-black/5 dark:ring-white/10 mb-3"
            >
                <Search size={12} className="text-rose-400 flex-shrink-0" />
                <span className="text-[11px] font-medium text-[#0A0A0A]/70 dark:text-white/70">
                    {currentStep.typed}
                    <motion.span
                        animate={{ opacity: [1, 0] }}
                        transition={{ repeat: Infinity, duration: 0.6 }}
                        className="inline-block w-[1.5px] h-2.5 bg-rose-400 ml-px align-middle rounded-full"
                    />
                </span>
                <span className="text-[11px] text-[#737373]/40 dark:text-white/20">raków</span>
            </motion.div>

            {/* Autocomplete results */}
            <div className="space-y-1.5">
                <AnimatePresence mode="popLayout">
                    {currentStep.results.map((city, i) => (
                        <motion.div
                            key={city.name}
                            initial={{ opacity: 0, y: -8, scale: 0.95 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            transition={{ duration: 0.3, delay: i * 0.08, ease: [0.34, 1.56, 0.64, 1] }}
                            className={`flex items-center gap-2 rounded-md px-2 py-1.5 ${
                                showMatch && i === 0
                                    ? 'bg-rose-50 dark:bg-rose-500/10 ring-1 ring-rose-200 dark:ring-rose-500/20'
                                    : 'bg-white/60 dark:bg-white/5'
                            }`}
                        >
                            <span className="text-xs">{city.flag}</span>
                            <span className={`text-[11px] font-semibold ${
                                showMatch && i === 0
                                    ? 'text-rose-600 dark:text-rose-400'
                                    : 'text-[#0A0A0A]/80 dark:text-white/80'
                            }`}>{city.name}</span>
                            <span className="text-[10px] text-[#737373] dark:text-white/40">{city.country}</span>
                            {showMatch && i === 0 && (
                                <motion.span
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    className="ml-auto text-[8px] font-bold tracking-wider uppercase text-rose-500 bg-rose-100 dark:bg-rose-500/20 rounded-full px-1.5 py-0.5"
                                >
                                    Best match
                                </motion.span>
                            )}
                            {!showMatch && <ArrowUpRight size={10} className="ml-auto text-rose-400/40" />}
                        </motion.div>
                    ))}
                </AnimatePresence>
            </div>
        </div>
    )
}

const FEATURES = [
    { label: 'AI POWERED',  title: 'Bio-Sync AI',   desc: 'Health-aware dining recommendations based on your activity and preferences.', icon: Sparkles, iconColor: 'text-blue-600 dark:text-blue-400',   iconBg: 'bg-blue-500/10 dark:bg-blue-500/20',     demo: BioSyncDemo },
    { label: 'COLLECTIONS', title: 'Smart Lists',    desc: 'Wishlists, visited history, and AI-curated collections tailored to your taste.', icon: List,      iconColor: 'text-amber-600 dark:text-amber-400',  iconBg: 'bg-amber-500/10 dark:bg-amber-500/20',   demo: CollectionsDemo },
    { label: 'SOCIAL',      title: 'Dine With Me',   desc: 'See where friends are dining and connect over shared culinary interests.',      icon: User,     iconColor: 'text-emerald-600 dark:text-emerald-400', iconBg: 'bg-emerald-500/10 dark:bg-emerald-500/20', demo: DineWithMeDemo },
    { label: 'GLOBAL',      title: 'Worldwide Map',  desc: 'Search any city, any country. Find hidden gems wherever your journey takes you.', icon: Globe,  iconColor: 'text-rose-600 dark:text-rose-400',    iconBg: 'bg-rose-500/10 dark:bg-rose-500/20',     demo: WorldwideMapDemo },
]

const FeaturesSection = () => (
    <section className={`py-20 md:py-32 ${C.bg}`}>
        <div className="max-w-6xl mx-auto px-6 md:px-10 lg:px-20">
            <motion.div
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true, margin: '-80px' }}
                variants={stagger}
            >
                <motion.p variants={fadeUp} className="text-xs tracking-widest uppercase text-[#737373] dark:text-white/40 mb-4">
                    Features
                </motion.p>
                <motion.h2 variants={fadeUp} className="text-3xl md:text-4xl lg:text-5xl font-medium tracking-tight text-[#0A0A0A] dark:text-white mb-12 md:mb-16">
                    Engineered for food lovers.
                </motion.h2>
            </motion.div>

            {/* Aceternity-style divide-x grid */}
            <motion.div
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true, margin: '-50px' }}
                variants={stagger}
                className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 divide-y md:divide-y-0 md:divide-x divide-[#E5E5E5] dark:divide-white/10 rounded-2xl shadow-sm ring-1 ring-black/5 dark:ring-white/10 overflow-hidden bg-white dark:bg-[#141414]"
            >
                {FEATURES.map((f) => {
                    const Icon = f.icon
                    const Demo = f.demo
                    return (
                        <motion.div key={f.label} variants={fadeUp} className="flex h-full flex-col justify-between p-8 md:p-10 bg-white dark:bg-[#141414]">
                            <div>
                                <div className={`w-9 h-9 rounded-lg flex items-center justify-center mb-4 ${f.iconBg}`}>
                                    <Icon size={18} className={f.iconColor} />
                                </div>
                                <p className="text-[10px] tracking-widest uppercase text-[#737373] dark:text-white/40 mb-1.5">
                                    {f.label}
                                </p>
                                <h3 className="text-base font-bold tracking-tight text-[#0A0A0A] dark:text-white mb-2">
                                    {f.title}
                                </h3>
                                <p className="text-sm text-[#737373] dark:text-white/50 leading-relaxed mb-6">
                                    {f.desc}
                                </p>
                            </div>
                            <Demo />
                        </motion.div>
                    )
                })}
            </motion.div>
        </div>
    </section>
)

// ════════════════════════════════════════════════════════════════════════════
// 4. GALLERY — Horizontal scroll carousel
// ════════════════════════════════════════════════════════════════════════════
const GALLERY_ITEMS = [
    { city: 'Venice',    venue: 'La Delicaze del Caffe',  img: 'https://images.unsplash.com/photo-1554118811-1e0d58224f24?q=80&w=1200&auto=format&fit=crop' },
    { city: 'New York',  venue: 'The Blind Tiger',        img: 'https://images.unsplash.com/photo-1514362545857-3bc16c4c7d1b?q=80&w=1200&auto=format&fit=crop' },
    { city: 'Madrid',    venue: 'Mercado San Miguel',     img: 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?q=80&w=1200&auto=format&fit=crop' },
    { city: 'Tokyo',     venue: 'Sushi Arai',             img: 'https://images.unsplash.com/photo-1579871494447-9811cf80d66c?q=80&w=1200&auto=format&fit=crop' },
    { city: 'Krakow',    venue: 'Hamsa',                  img: 'https://images.unsplash.com/photo-1559339352-11d035341408?q=80&w=1200&auto=format&fit=crop' },
    { city: 'Paris',     venue: 'Le Comptoir',            img: 'https://images.unsplash.com/photo-1502602898657-3e91760cbb34?q=80&w=1200&auto=format&fit=crop' },
]

const GallerySection = () => {
    const scrollRef = useRef(null)

    return (
        <section className={`py-20 md:py-32 ${C.bg}`}>
            <div className="max-w-6xl mx-auto px-6 md:px-10 lg:px-20 mb-10 md:mb-14">
                <motion.div
                    initial="hidden"
                    whileInView="visible"
                    viewport={{ once: true }}
                    variants={stagger}
                >
                    <motion.p variants={fadeUp} className="text-xs tracking-widest uppercase text-[#737373] dark:text-white/40 mb-4">
                        Collection
                    </motion.p>
                    <motion.h2 variants={fadeUp} className="text-3xl md:text-4xl lg:text-5xl font-medium tracking-tight text-[#0A0A0A] dark:text-white">
                        The Collection.
                    </motion.h2>
                </motion.div>
            </div>

            {/* Horizontal scroll carousel */}
            <div
                ref={scrollRef}
                className="flex gap-6 overflow-x-auto snap-x snap-mandatory scrollbar-hide px-6 md:px-10 lg:px-20 pb-4"
            >
                {GALLERY_ITEMS.map((item, i) => (
                    <motion.div
                        key={item.city}
                        initial={{ opacity: 0, y: 30 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        transition={{ delay: i * 0.1, duration: 0.6, ease: CUBIC }}
                        className="flex-shrink-0 w-[85vw] md:w-[45vw] lg:w-[30vw] snap-center group"
                    >
                        <div className="h-[52vh] md:h-[60vh] rounded-2xl overflow-hidden relative">
                            <img
                                src={item.img}
                                alt={item.venue}
                                className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 ease-out group-hover:scale-105 opacity-90"
                                loading="lazy"
                            />
                            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                            <div className="absolute bottom-6 left-6 right-6 text-white">
                                <p className="text-xs font-normal uppercase tracking-widest text-white/50 mb-1">
                                    {item.city}
                                </p>
                                <h3 className="text-xl md:text-2xl font-medium tracking-tight">
                                    {item.venue}
                                </h3>
                            </div>
                            {/* Glass badge */}
                            <div className="absolute bottom-6 right-6 w-10 h-10 rounded-full bg-white/20 backdrop-blur-md border border-white/20 flex items-center justify-center">
                                <ArrowUpRight size={16} className="text-white" />
                            </div>
                        </div>
                    </motion.div>
                ))}
            </div>
        </section>
    )
}

// ════════════════════════════════════════════════════════════════════════════
// 5. STATS — Bordered grid with metrics
// ════════════════════════════════════════════════════════════════════════════
const StatsSection = () => {
    const [locationCount, setLocationCount] = useState(0)

    useEffect(() => {
        getLocationsCount().then(n => setLocationCount(n)).catch(() => {})
    }, [])

    const stats = [
        { label: 'LOCATIONS', value: locationCount || '—' },
        { label: 'COUNTRIES', value: '8+' },
        { label: 'CITIES', value: '20+' },
        { label: 'COST', value: 'Free' },
    ]

    return (
        <section className={`py-20 md:py-32 ${C.bg}`}>
            <div className="max-w-6xl mx-auto px-6 md:px-10 lg:px-20">
                <motion.div
                    initial="hidden"
                    whileInView="visible"
                    viewport={{ once: true, margin: '-80px' }}
                    variants={stagger}
                    className="grid grid-cols-2 md:grid-cols-4 border-t border-l border-[#E5E5E5] dark:border-white/10"
                >
                    {stats.map((s, _i) => (
                        <motion.div
                            key={s.label}
                            variants={fadeUp}
                            className="p-6 md:p-8 border-b border-r border-[#E5E5E5] dark:border-white/10"
                        >
                            <p className="text-xs tracking-widest uppercase text-[#737373] dark:text-white/40 mb-2">
                                {s.label}
                            </p>
                            <p className="text-2xl md:text-4xl font-medium text-[#0A0A0A] dark:text-white tracking-tight">
                                {s.value}
                            </p>
                        </motion.div>
                    ))}
                </motion.div>
            </div>
        </section>
    )
}

// ════════════════════════════════════════════════════════════════════════════
// 6. DARK SHOWCASE — Full-width dark section
// ════════════════════════════════════════════════════════════════════════════
const DarkShowcase = () => {
    // Animated gradient background instead of broken image
    return (
        <section className="relative py-24 md:py-40 overflow-hidden bg-[#0A0A0A]">
            {/* Animated gradient mesh background */}
            <div className="absolute inset-0">
                <motion.div
                    animate={{
                        background: [
                            'radial-gradient(ellipse at 20% 50%, rgba(225,29,72,0.15) 0%, transparent 50%), radial-gradient(ellipse at 80% 20%, rgba(59,130,246,0.12) 0%, transparent 50%), radial-gradient(ellipse at 50% 80%, rgba(16,185,129,0.1) 0%, transparent 50%)',
                            'radial-gradient(ellipse at 60% 30%, rgba(225,29,72,0.18) 0%, transparent 50%), radial-gradient(ellipse at 30% 70%, rgba(59,130,246,0.15) 0%, transparent 50%), radial-gradient(ellipse at 80% 60%, rgba(16,185,129,0.12) 0%, transparent 50%)',
                            'radial-gradient(ellipse at 40% 60%, rgba(225,29,72,0.12) 0%, transparent 50%), radial-gradient(ellipse at 70% 40%, rgba(59,130,246,0.1) 0%, transparent 50%), radial-gradient(ellipse at 20% 30%, rgba(16,185,129,0.15) 0%, transparent 50%)',
                            'radial-gradient(ellipse at 20% 50%, rgba(225,29,72,0.15) 0%, transparent 50%), radial-gradient(ellipse at 80% 20%, rgba(59,130,246,0.12) 0%, transparent 50%), radial-gradient(ellipse at 50% 80%, rgba(16,185,129,0.1) 0%, transparent 50%)',
                        ],
                    }}
                    transition={{ repeat: Infinity, duration: 12, ease: 'easeInOut' }}
                    className="absolute inset-0"
                />
                {/* Grid overlay */}
                <div
                    className="absolute inset-0 opacity-[0.03]"
                    style={{
                        backgroundImage: 'linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)',
                        backgroundSize: '60px 60px',
                    }}
                />
            </div>

            <div className="relative z-10 max-w-6xl mx-auto px-6 md:px-10 lg:px-20 text-center">
                <motion.div
                    initial="hidden"
                    whileInView="visible"
                    viewport={{ once: true, margin: '-100px' }}
                    variants={stagger}
                >
                    <motion.p variants={fadeUp} className="text-xs tracking-widest uppercase text-white/40 mb-6">
                        Community first
                    </motion.p>
                    <motion.h2
                        variants={fadeUp}
                        className="text-3xl md:text-5xl lg:text-7xl font-medium tracking-tight text-white leading-[1.1] mb-8"
                    >
                        100% Free.
                        <br />
                        Support the community.
                    </motion.h2>
                    <motion.p variants={fadeUp} className="text-lg md:text-xl text-white/50 max-w-xl mx-auto leading-relaxed mb-10">
                        GastroMap is built by locals for travelers. Enjoy full access forever, or become a supporter.
                    </motion.p>
                    <motion.div variants={fadeUp} className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center">
                        <Link
                            to="/auth/signup"
                            className="h-12 md:h-14 px-8 md:px-10 rounded-full bg-white text-[#0A0A0A] text-sm md:text-base font-medium flex items-center justify-center gap-2 hover:bg-white/90 transition-colors"
                        >
                            Join for Free
                            <ArrowUpRight size={16} />
                        </Link>
                        <Link
                            to="/auth/signup?action=supporter"
                            className="h-12 md:h-14 px-8 md:px-10 rounded-full border border-white/20 text-white text-sm md:text-base font-medium flex items-center justify-center gap-2 hover:bg-white/10 transition-colors"
                        >
                            <Heart size={16} className="text-rose-400" />
                            Become a Supporter
                        </Link>
                    </motion.div>
                </motion.div>
            </div>
        </section>
    )
}

// ════════════════════════════════════════════════════════════════════════════
// 7. PRICING — Two-column Explorer / Supporter
// ════════════════════════════════════════════════════════════════════════════
const PricingSection = () => (
    <section className={`py-20 md:py-32 ${C.bg}`}>
        <div className="max-w-4xl mx-auto px-6 md:px-10 lg:px-20">
            <motion.div
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true, margin: '-80px' }}
                variants={stagger}
                className="text-center mb-12 md:mb-16"
            >
                <motion.h2 variants={fadeUp} className="text-3xl md:text-4xl lg:text-5xl font-medium tracking-tight text-[#0A0A0A] dark:text-white">
                    Simple pricing.
                </motion.h2>
            </motion.div>

            <motion.div
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true, margin: '-50px' }}
                variants={stagger}
                className="grid grid-cols-1 md:grid-cols-2 gap-4"
            >
                {/* Explorer */}
                <motion.div variants={fadeUp} className={`rounded-2xl p-8 md:p-10 flex flex-col ${C.card}`}>
                    <p className="text-xs tracking-widest uppercase text-[#737373] dark:text-white/40 mb-6">Explorer</p>
                    <p className="text-4xl md:text-5xl font-medium tracking-tight text-[#0A0A0A] dark:text-white mb-2">Free</p>
                    <p className="text-sm text-[#737373] dark:text-white/50 mb-8">Everything you need to discover and share.</p>
                    <ul className="space-y-4 mb-10 text-sm text-[#0A0A0A]/70 dark:text-white/70 flex-1">
                        {['Add & Review Places', 'Full AI Guidance', 'Earn Points & Badges', '"Dine With Me" Radar'].map(f => (
                            <li key={f} className="flex items-center gap-3">
                                <Check size={16} className="text-[#737373] dark:text-white/40 flex-shrink-0" />
                                {f}
                            </li>
                        ))}
                    </ul>
                    <Link
                        to="/auth/signup"
                        className="h-12 rounded-full bg-[#F5F5F5] dark:bg-white/10 text-[#0A0A0A] dark:text-white text-sm font-medium flex items-center justify-center hover:bg-[#E5E5E5] dark:hover:bg-white/15 transition-colors"
                    >
                        Join for Free
                    </Link>
                </motion.div>

                {/* Supporter (Blue gradient) */}
                <motion.div variants={fadeUp} className="bg-gradient-to-br from-blue-900 to-[#0A0A0A] text-white rounded-2xl p-8 md:p-10 flex flex-col relative overflow-hidden">
                    {/* Background glow */}
                    <div className="absolute top-0 right-0 w-64 h-64 bg-blue-600 rounded-full blur-[100px] opacity-20 pointer-events-none" />
                    <div className="absolute top-6 right-6 bg-white/10 backdrop-blur-md px-3 py-1 rounded-full text-[10px] font-bold tracking-widest uppercase text-white">Optional</div>
                    <p className="text-xs tracking-widest uppercase text-blue-400 mb-6">Supporter</p>
                    <p className="text-4xl md:text-5xl font-medium tracking-tight mb-2">$5<span className="text-lg text-white/40 font-normal">/mo</span></p>
                    <p className="text-sm text-white/50 mb-8">Help keep the servers running.</p>
                    <ul className="space-y-4 mb-10 text-sm text-white/90 flex-1 relative z-10">
                        {['Exclusive "Supporter" Badge', 'Early access to new features', 'Skip the moderation queue', 'Developer gratitude'].map((f, i) => (
                            <li key={f} className="flex items-center gap-3">
                                {i < 3 ? <Check size={16} className="text-blue-400 flex-shrink-0" /> : <Heart size={16} className="text-rose-400 flex-shrink-0" />}
                                {f}
                            </li>
                        ))}
                    </ul>
                    <Link
                        to="/auth/signup?action=supporter"
                        className="h-12 rounded-full bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium flex items-center justify-center transition-colors shadow-lg shadow-blue-500/20 relative z-10"
                    >
                        Become a Supporter
                    </Link>
                </motion.div>
            </motion.div>
        </div>
    </section>
)

// ════════════════════════════════════════════════════════════════════════════
// 8. FAQ — Minimal accordion
// ════════════════════════════════════════════════════════════════════════════
const FAQ_ITEMS = [
    { q: 'Is GastroMap really free?', a: 'Yes! Access to the global map, AI features, and community tools is 100% free. We believe finding great food should not be behind a paywall.' },
    { q: 'How does the Bio-Sync AI work?', a: 'It utilizes machine learning combined with optional health data to recommend meals based on your real-time activity and preferences.' },
    { q: 'How does the "Dine With Me" radar work?', a: 'It securely highlights nearby friends who have opted in, allowing you to connect and share restaurant preferences.' },
    { q: 'Can I use GastroMap while traveling abroad?', a: 'Yes! The app is built for a global community. We welcome contributions from everywhere.' },
    { q: 'How do I add a new place?', a: 'Register for a free account, click "Add a Place", and fill out the details. Community moderators will review it, and you earn reputation points when it goes live.' },
    { q: 'Why is there a Supporter tier?', a: 'GastroMap is built by a small independent team. The optional Supporter tier helps us keep servers running and remain independent from intrusive ads.' },
]

const FAQSection = () => {
    const [openIndex, setOpenIndex] = useState(null)

    return (
        <section className={`py-20 md:py-32 ${C.bg} border-t ${C.border}`}>
            <div className="max-w-3xl mx-auto px-6 md:px-10 lg:px-20">
                <motion.div
                    initial="hidden"
                    whileInView="visible"
                    viewport={{ once: true }}
                    variants={fadeUp}
                >
                    <p className="text-xs tracking-widest uppercase text-[#737373] dark:text-white/40 mb-4">FAQ</p>
                    <h2 className="text-3xl md:text-4xl font-medium tracking-tight text-[#0A0A0A] dark:text-white mb-12">
                        Common questions.
                    </h2>
                </motion.div>

                <div className="space-y-0">
                    {FAQ_ITEMS.map((item, i) => {
                        const isOpen = openIndex === i
                        return (
                            <div key={i} className={`border-b ${C.border}`}>
                                <button
                                    onClick={() => setOpenIndex(isOpen ? null : i)}
                                    className="w-full text-left py-5 flex justify-between items-center gap-4 cursor-pointer"
                                >
                                    <span className={`text-base font-medium transition-colors ${isOpen ? 'text-[#0A0A0A] dark:text-white' : 'text-[#0A0A0A]/70 dark:text-white/70'}`}>
                                        {item.q}
                                    </span>
                                    <ChevronDown
                                        size={18}
                                        className={`text-[#737373] dark:text-white/30 flex-shrink-0 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`}
                                    />
                                </button>
                                <AnimatePresence>
                                    {isOpen && (
                                        <motion.div
                                            initial={{ height: 0, opacity: 0 }}
                                            animate={{ height: 'auto', opacity: 1 }}
                                            exit={{ height: 0, opacity: 0 }}
                                            transition={{ duration: 0.3, ease: CUBIC }}
                                        >
                                            <p className="text-sm text-[#737373] dark:text-white/50 leading-relaxed pb-5">
                                                {item.a}
                                            </p>
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </div>
                        )
                    })}
                </div>
            </div>
        </section>
    )
}

// ════════════════════════════════════════════════════════════════════════════
// 9. FINAL CTA — Full-width image with gradient overlay
// ════════════════════════════════════════════════════════════════════════════
const FinalCTA = () => (
    <section className="relative py-24 md:py-40 overflow-hidden">
        <img
            src="https://images.unsplash.com/photo-1502602898657-3e91760cbb34?q=80&w=2000&auto=format&fit=crop"
            alt=""
            className="absolute inset-0 w-full h-full object-cover"
            loading="lazy"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-white via-white/60 to-transparent dark:from-[#0A0A0A] dark:via-[#0A0A0A]/60 dark:to-transparent" />

        <div className="relative z-10 max-w-3xl mx-auto px-6 md:px-10 lg:px-20 text-center">
            <motion.div
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true, margin: '-100px' }}
                variants={stagger}
            >
                <motion.h2
                    variants={fadeUp}
                    className="text-3xl md:text-4xl lg:text-5xl font-medium tracking-tight text-[#0A0A0A] dark:text-white mb-6"
                >
                    Ready to explore?
                </motion.h2>
                <motion.p
                    variants={fadeUp}
                    className="text-lg md:text-xl text-[#737373] dark:text-white/50 mb-10 max-w-xl mx-auto leading-relaxed"
                >
                    Join thousands of food lovers discovering hidden gems around the world.
                </motion.p>
                <motion.div variants={fadeUp} className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center">
                    <Link
                        to="/auth/signup"
                        className="h-12 md:h-14 px-8 md:px-10 rounded-full bg-[#0A0A0A] dark:bg-white text-white dark:text-[#0A0A0A] text-sm md:text-base font-medium flex items-center justify-center gap-2 hover:opacity-90 transition-opacity"
                    >
                        Get Started Free
                        <ArrowUpRight size={16} />
                    </Link>
                    <Link
                        to="/explore"
                        className="h-12 md:h-14 px-8 md:px-10 rounded-full border border-[#E5E5E5] dark:border-white/20 text-[#0A0A0A] dark:text-white text-sm md:text-base font-medium flex items-center justify-center hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
                    >
                        Explore Map
                    </Link>
                </motion.div>
            </motion.div>
        </div>
    </section>
)

// ════════════════════════════════════════════════════════════════════════════
// 10. FOOTER — Minimal
// ════════════════════════════════════════════════════════════════════════════
const Footer = () => (
    <footer className={`border-t ${C.border} py-12 md:py-16 ${C.bg}`}>
        <div className="max-w-6xl mx-auto px-6 md:px-10 lg:px-20">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-8">
                <div>
                    <h3 className="text-lg font-medium tracking-tight text-[#0A0A0A] dark:text-white mb-1">GastroMap</h3>
                    <p className="text-xs text-[#737373] dark:text-white/40">Community-driven culinary discovery.</p>
                </div>
                <div className="flex flex-wrap gap-6 md:gap-10">
                    {[
                        { label: 'Features', to: '/features' },
                        { label: 'Pricing', to: '/pricing' },
                        { label: 'About', to: '/about' },
                        { label: 'Contact', to: '/contact' },
                        { label: 'Blog', to: '/blog' },
                    ].map(link => (
                        <Link key={link.to} to={link.to} className="text-sm text-[#737373] dark:text-white/40 hover:text-[#0A0A0A] dark:hover:text-white transition-colors">
                            {link.label}
                        </Link>
                    ))}
                </div>
            </div>
            <div className="mt-10 pt-6 border-t border-[#E5E5E5] dark:border-white/10 flex flex-col md:flex-row justify-between items-center gap-4">
                <p className="text-xs text-[#737373] dark:text-white/30">&copy; {new Date().getFullYear()} GastroMap. All rights reserved.</p>
                <div className="flex gap-4">
                    <a href="https://instagram.com/Alikovit" target="_blank" rel="noopener noreferrer" className="text-xs text-[#737373] dark:text-white/30 hover:text-[#0A0A0A] dark:hover:text-white transition-colors">Instagram</a>
                </div>
            </div>
        </div>
    </footer>
)

// ════════════════════════════════════════════════════════════════════════════
// MAIN PAGE
// ════════════════════════════════════════════════════════════════════════════
export default function LandingPageV2() {
    return (
        <div className="bg-white dark:bg-[#0A0A0A] min-h-screen">
            
            <HeroSection />
            <AboutSection />
            <FeaturesSection />
            <GallerySection />
            <StatsSection />
            <DarkShowcase />
            <PricingSection />
            <FAQSection />
            <FinalCTA />
            <Footer />
        </div>
    )
}
