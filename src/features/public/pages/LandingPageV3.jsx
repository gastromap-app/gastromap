import React, { useRef, useEffect, useState, useMemo } from 'react'
import { motion, useScroll, useTransform, useInView, useMotionValue, useSpring, useAnimationFrame } from 'framer-motion'
import { Link } from 'react-router-dom'
import { getLocationsCount } from '@/shared/api/locations.api'
import { ArrowUpRight, Heart, MapPin, Sparkles, Search, Globe, Star, ChevronDown } from 'lucide-react'
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

gsap.registerPlugin(ScrollTrigger)

// ════════════════════════════════════════════════════════════════════════════
// DESIGN TOKENS
// ════════════════════════════════════════════════════════════════════════════
const CUBIC = [0.86, 0, 0.07, 1]

// ════════════════════════════════════════════════════════════════════════════
// MARQUEE COMPONENT (adapted from fancy-components)
// ════════════════════════════════════════════════════════════════════════════
function Marquee({ children, direction = 'left', speed = 30, className = '' }) {
    const baseX = useMotionValue(0)
    const dirMultiplier = direction === 'left' ? -1 : 1

    useAnimationFrame((_, delta) => {
        baseX.set(baseX.get() + dirMultiplier * speed * (delta / 1000))
    })

    const x = useTransform(baseX, (v) => {
        const wrapped = ((v % 100) + 100) % 100
        return `${direction === 'left' ? -wrapped : wrapped - 100}%`
    })

    return (
        <div className={`flex overflow-hidden ${className}`}>
            {[0, 1, 2].map((i) => (
                <motion.div key={i} className="flex shrink-0" style={{ x }} aria-hidden={i > 0}>
                    {children}
                </motion.div>
            ))}
        </div>
    )
}

// ════════════════════════════════════════════════════════════════════════════
// PARALLAX IMAGE (adapted from fancy-components)
// ════════════════════════════════════════════════════════════════════════════
function ParallaxImage({ src, alt, className = '', speed = 0.3 }) {
    const ref = useRef(null)
    const { scrollYProgress } = useScroll({ target: ref, offset: ['start end', 'end start'] })
    const y = useTransform(scrollYProgress, [0, 1], [`${-speed * 100}%`, `${speed * 100}%`])

    return (
        <div ref={ref} className={`overflow-hidden ${className}`}>
            <motion.img src={src} alt={alt} style={{ y }} className="w-full h-[120%] object-cover" />
        </div>
    )
}

// ════════════════════════════════════════════════════════════════════════════
// SCROLL REVEAL TEXT (GSAP word-by-word)
// ════════════════════════════════════════════════════════════════════════════
function ScrollRevealText({ text, className = '' }) {
    const ref = useRef(null)

    const words = useMemo(() => text.split(/(\s+)/).map((word, i) => {
        if (word.match(/^\s+$/)) return <span key={i}>{word}</span>
        return <span className="scroll-word inline-block" key={i}>{word}</span>
    }), [text])

    useEffect(() => {
        const el = ref.current
        if (!el) return
        const wordEls = el.querySelectorAll('.scroll-word')
        gsap.fromTo(wordEls, { opacity: 0.15 }, {
            opacity: 1, stagger: 0.03, ease: 'none',
            scrollTrigger: { trigger: el, start: 'top 80%', end: 'bottom 40%', scrub: true }
        })
        return () => ScrollTrigger.getAll().forEach(t => t.kill())
    }, [])

    return <p ref={ref} className={className}>{words}</p>
}

// ════════════════════════════════════════════════════════════════════════════
// ANIMATED COUNTER
// ════════════════════════════════════════════════════════════════════════════
function AnimatedCounter({ target, suffix = '', duration = 2 }) {
    const ref = useRef(null)
    const isInView = useInView(ref, { once: true })
    const [count, setCount] = useState(0)

    useEffect(() => {
        if (!isInView) return
        let start = 0
        const step = target / (duration * 60)
        const timer = setInterval(() => {
            start += step
            if (start >= target) { setCount(target); clearInterval(timer) }
            else setCount(Math.floor(start))
        }, 1000 / 60)
        return () => clearInterval(timer)
    }, [isInView, target, duration])

    return <span ref={ref}>{count}{suffix}</span>
}

// ════════════════════════════════════════════════════════════════════════════
// NAVBAR
// ════════════════════════════════════════════════════════════════════════════
function Navbar() {
    const [scrolled, setScrolled] = useState(false)

    useEffect(() => {
        const onScroll = () => setScrolled(window.scrollY > 50)
        window.addEventListener('scroll', onScroll, { passive: true })
        return () => window.removeEventListener('scroll', onScroll)
    }, [])

    return (
        <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ${scrolled ? 'bg-black/80 backdrop-blur-xl border-b border-white/5' : ''}`} style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}>
            <div className="max-w-7xl mx-auto px-6 md:px-10 h-14 md:h-20 flex items-center justify-between">
                <span className="text-white text-lg font-medium tracking-tight">GastroMap</span>
                <Link to="/auth/signup" className="h-9 px-5 rounded-full bg-white text-black text-sm font-medium flex items-center gap-1.5 hover:bg-white/90 transition-colors">
                    Get Started <ArrowUpRight size={14} />
                </Link>
            </div>
        </nav>
    )
}

// ════════════════════════════════════════════════════════════════════════════
// 1. HERO
// ════════════════════════════════════════════════════════════════════════════
function HeroSection() {
    const [locationCount, setLocationCount] = useState(null)
    const containerRef = useRef(null)
    const { scrollYProgress } = useScroll({ target: containerRef, offset: ['start start', 'end start'] })
    const heroScale = useTransform(scrollYProgress, [0, 1], [1, 1.1])
    const heroOpacity = useTransform(scrollYProgress, [0, 0.8], [1, 0])

    useEffect(() => {
        getLocationsCount().then(n => setLocationCount(n)).catch(() => setLocationCount(0))
    }, [])

    const line1 = 'GASTRO'
    const line2 = 'MAP'

    return (
        <section ref={containerRef} className="relative h-screen w-full overflow-hidden">
            <motion.img
                src="https://images.unsplash.com/photo-1414235077428-338989a2e8c0?q=80&w=2000&auto=format&fit=crop"
                alt=""
                className="absolute inset-0 w-full h-full object-cover"
                style={{ scale: heroScale }}
                fetchPriority="high"
            />
            <motion.div className="absolute inset-0 bg-black/50" style={{ opacity: heroOpacity }} />

            <motion.div style={{ opacity: heroOpacity }} className="relative z-10 flex flex-col items-center justify-center h-full px-6 text-center">
                <motion.h1 className="text-[20vw] md:text-[12vw] lg:text-[10vw] font-light tracking-[-0.04em] leading-[0.85] text-white select-none" aria-label="GastroMap">
                    <span className="block overflow-hidden">
                        {line1.split('').map((char, i) => (
                            <motion.span key={i} className="inline-block" initial={{ y: '110%' }} animate={{ y: 0 }} transition={{ duration: 1, delay: i * 0.06, ease: CUBIC }}>{char}</motion.span>
                        ))}
                    </span>
                    <span className="block overflow-hidden">
                        {line2.split('').map((char, i) => (
                            <motion.span key={i} className="inline-block" initial={{ y: '110%' }} animate={{ y: 0 }} transition={{ duration: 1, delay: 0.4 + i * 0.06, ease: CUBIC }}>{char}</motion.span>
                        ))}
                    </span>
                </motion.h1>

                <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.2, duration: 1 }} className="mt-6 text-lg md:text-xl text-white/60 font-light max-w-md">
                    Your personal guide to the best dining experiences.
                </motion.p>

                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 1.5, duration: 0.8 }} className="mt-10 flex gap-4">
                    <Link to="/auth/signup" className="h-12 px-8 rounded-full bg-white text-black text-sm font-medium flex items-center gap-2 hover:bg-white/90 transition-colors">
                        Get Started <ArrowUpRight size={14} />
                    </Link>
                    <Link to="/explore" className="h-12 px-8 rounded-full border border-white/20 text-white text-sm font-medium flex items-center gap-2 hover:bg-white/10 transition-colors">
                        Explore
                    </Link>
                </motion.div>

                {locationCount > 0 && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 2, duration: 1 }} className="mt-14 text-white/40 text-sm font-light">
                        {locationCount}+ curated locations worldwide
                    </motion.div>
                )}
            </motion.div>

            <motion.div className="absolute bottom-8 left-1/2 -translate-x-1/2" animate={{ y: [0, 8, 0] }} transition={{ repeat: Infinity, duration: 2, ease: 'easeInOut' }}>
                <ChevronDown size={24} className="text-white/40" />
            </motion.div>
        </section>
    )
}


// ════════════════════════════════════════════════════════════════════════════
// 2. ABOUT — Scroll-reveal text
// ════════════════════════════════════════════════════════════════════════════
function AboutSection() {
    return (
        <section className="py-32 md:py-48 bg-[#0A0A0A]">
            <div className="max-w-5xl mx-auto px-6 md:px-10">
                <p className="text-xs font-light tracking-[0.3em] uppercase text-white/30 mb-8">About</p>
                <ScrollRevealText
                    text="A community-driven platform to discover the best local restaurants, cafes, and bars. Built by food lovers, for travelers who seek authenticity over algorithms."
                    className="text-2xl md:text-4xl lg:text-[2.75rem] font-light tracking-tight leading-[1.2] text-white"
                />
                <div className="h-px w-16 bg-white/10 mt-12" />
                <p className="mt-8 text-lg text-white/40 font-light italic max-w-lg">
                    "Every great meal starts with a recommendation from someone who cares."
                </p>
                <p className="mt-3 text-sm text-white/30 font-light">— Alikovit</p>
                <a
                    href="https://send.monobank.ua/jar/5tZhMJXSMQ"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-6 group relative inline-flex items-center gap-2 h-11 px-6 rounded-full bg-white text-black text-sm font-medium overflow-hidden transition-all hover:shadow-[0_0_20px_rgba(255,255,255,0.3)]"
                >
                    {/* Animated gradient border */}
                    <span className="absolute inset-0 rounded-full p-[1.5px] overflow-hidden">
                        <span className="absolute inset-[-200%] animate-[spin_3s_linear_infinite] bg-[conic-gradient(from_0deg,transparent_0_340deg,white_360deg)]" />
                    </span>
                    <span className="absolute inset-[1.5px] rounded-full bg-white" />
                    <span className="relative flex items-center gap-2">
                        Support the Project <Heart size={14} className="text-red-500" />
                    </span>
                </a>
            </div>
        </section>
    )
}

// ════════════════════════════════════════════════════════════════════════════
// 3. FEATURES — Large cards with parallax images
// ════════════════════════════════════════════════════════════════════════════
function FeaturesSection() {
    const features = [
        {
            title: 'GastroGuide AI',
            description: 'Your personal dining assistant. Ask anything about restaurants, get personalized recommendations based on your taste, location, and mood.',
            image: 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?q=80&w=1200&auto=format&fit=crop',
            tag: 'AI POWERED',
        },
        {
            title: 'Interactive Map',
            description: 'Explore curated locations on a beautiful map. Filter by cuisine, price, vibe, and distance. Find hidden gems near you.',
            image: 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?q=80&w=1200&auto=format&fit=crop',
            tag: 'DISCOVER',
        },
        {
            title: 'Community Driven',
            description: 'Add your own discoveries. Rate, review, and share places with friends. Build your personal food map across cities.',
            image: 'https://images.unsplash.com/photo-1414235077428-338989a2e8c0?q=80&w=1200&auto=format&fit=crop',
            tag: 'SHARE',
        },
    ]

    return (
        <section className="py-24 md:py-40 bg-[#0A0A0A]">
            <div className="max-w-7xl mx-auto px-6 md:px-10">
                <p className="text-xs font-light tracking-[0.3em] uppercase text-white/30 mb-4">Features</p>
                <h2 className="text-3xl md:text-5xl font-light tracking-tight text-white mb-16 md:mb-24">
                    Everything you need.<br />Nothing you don't.
                </h2>

                <div className="space-y-20 md:space-y-32">
                    {features.map((feature, i) => (
                        <FeatureCard key={i} feature={feature} index={i} />
                    ))}
                </div>
            </div>
        </section>
    )
}

function FeatureCard({ feature, index }) {
    const ref = useRef(null)
    const isInView = useInView(ref, { once: true, margin: '-100px' })
    const isEven = index % 2 === 0

    return (
        <motion.div
            ref={ref}
            initial={{ opacity: 0, y: 60 }}
            animate={isInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.8, ease: CUBIC }}
            className={`grid md:grid-cols-2 gap-8 md:gap-16 items-center ${isEven ? '' : 'md:[direction:rtl]'}`}
        >
            <div className={`space-y-6 ${isEven ? '' : 'md:[direction:ltr]'}`}>
                <span className="text-[10px] font-medium tracking-[0.3em] uppercase text-white/30">{feature.tag}</span>
                <h3 className="text-2xl md:text-4xl font-light tracking-tight text-white">{feature.title}</h3>
                <p className="text-base md:text-lg text-white/50 font-light leading-relaxed max-w-md">{feature.description}</p>
            </div>
            <div className={`${isEven ? '' : 'md:[direction:ltr]'}`}>
                <ParallaxImage src={feature.image} alt={feature.title} className="aspect-[4/3] rounded-2xl" speed={0.15} />
            </div>
        </motion.div>
    )
}

// ════════════════════════════════════════════════════════════════════════════
// 4. GALLERY — Horizontal scroll with parallax photos
// ════════════════════════════════════════════════════════════════════════════
function GallerySection() {
    const containerRef = useRef(null)
    const { scrollYProgress } = useScroll({ target: containerRef, offset: ['start end', 'end start'] })
    const x = useTransform(scrollYProgress, [0, 1], ['10%', '-30%'])

    const images = [
        'https://images.unsplash.com/photo-1559339352-11d035aa65de?q=80&w=800&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1551218808-94e220e084d2?q=80&w=800&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1600891964092-4316c288032e?q=80&w=800&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1504674900247-0877df9cc836?q=80&w=800&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1476224203421-9ac39bcb3327?q=80&w=800&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1540189549336-e6e99c3679fe?q=80&w=800&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?q=80&w=800&auto=format&fit=crop',
    ]

    return (
        <section ref={containerRef} className="py-24 md:py-32 bg-[#0A0A0A] overflow-hidden">
            <div className="max-w-7xl mx-auto px-6 md:px-10 mb-12">
                <p className="text-xs font-light tracking-[0.3em] uppercase text-white/30 mb-4">Gallery</p>
                <h2 className="text-3xl md:text-5xl font-light tracking-tight text-white">Culinary Moments.</h2>
            </div>
            <motion.div style={{ x }} className="flex gap-4 md:gap-6 pl-6">
                {images.map((img, i) => (
                    <div key={i} className="flex-shrink-0 w-[280px] md:w-[400px] aspect-[3/4] rounded-2xl overflow-hidden">
                        <img src={img} alt="" className="w-full h-full object-cover hover:scale-105 transition-transform duration-700" loading="lazy" />
                    </div>
                ))}
            </motion.div>
        </section>
    )
}

// ════════════════════════════════════════════════════════════════════════════
// 5. CITIES MARQUEE
// ════════════════════════════════════════════════════════════════════════════
function CitiesMarquee() {
    const cities = ['Kraków', 'Warsaw', 'Berlin', 'Paris', 'Rome', 'Barcelona', 'Lisbon', 'Prague', 'Amsterdam', 'Vienna']

    return (
        <section className="py-16 md:py-24 bg-[#0A0A0A] border-y border-white/5">
            <Marquee speed={15} className="text-white/10">
                <div className="flex items-center gap-8 md:gap-12 px-4 md:px-6">
                    {cities.map((city, i) => (
                        <span key={i} className="text-4xl md:text-6xl font-light tracking-tight whitespace-nowrap">{city}</span>
                    ))}
                </div>
            </Marquee>
        </section>
    )
}

// ════════════════════════════════════════════════════════════════════════════
// 6. STATS
// ════════════════════════════════════════════════════════════════════════════
function StatsSection() {
    const stats = [
        { value: 200, suffix: '+', label: 'Curated Locations' },
        { value: 8, suffix: '', label: 'Countries' },
        { value: 15, suffix: '+', label: 'Cities' },
        { value: 4.8, suffix: '', label: 'Avg Rating' },
    ]

    return (
        <section className="py-24 md:py-32 bg-[#0A0A0A]">
            <div className="max-w-5xl mx-auto px-6 md:px-10">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-8 md:gap-12">
                    {stats.map((stat, i) => (
                        <div key={i} className="text-center">
                            <p className="text-4xl md:text-6xl font-light text-white tracking-tight">
                                <AnimatedCounter target={stat.value} suffix={stat.suffix} />
                            </p>
                            <p className="mt-2 text-xs tracking-[0.2em] uppercase text-white/30 font-light">{stat.label}</p>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    )
}

// ════════════════════════════════════════════════════════════════════════════
// 7. MANIFESTO + SUPPORT
// ════════════════════════════════════════════════════════════════════════════
function ManifestoSection() {
    const ref = useRef(null)
    const isInView = useInView(ref, { once: true, margin: '-100px' })

    return (
        <section ref={ref} className="py-24 md:py-40 bg-[#0A0A0A]">
            <div className="max-w-4xl mx-auto px-6 md:px-10 text-center">
                <motion.div initial={{ opacity: 0, y: 40 }} animate={isInView ? { opacity: 1, y: 0 } : {}} transition={{ duration: 0.8, ease: CUBIC }}>
                    <p className="text-xs font-light tracking-[0.3em] uppercase text-white/30 mb-6">Manifesto</p>
                    <h2 className="text-3xl md:text-5xl font-light tracking-tight text-white leading-tight mb-8">
                        We believe every meal<br />is an adventure waiting<br />to happen.
                    </h2>
                    <p className="text-base md:text-lg text-white/40 font-light max-w-2xl mx-auto leading-relaxed mb-12">
                        GastroMap is more than an app — it's a movement. We connect food lovers with authentic local experiences, one recommendation at a time. No paid placements. No algorithms deciding your taste. Just real people sharing real discoveries.
                    </p>

                    <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                        <Link to="/auth/signup" className="h-12 px-8 rounded-full bg-white text-black text-sm font-medium flex items-center gap-2 hover:bg-white/90 transition-colors">
                            Join the Community <ArrowUpRight size={14} />
                        </Link>
                        <a
                            href="https://send.monobank.ua/jar/5tZhMJXSMQ"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="h-12 px-8 rounded-full border border-white/20 text-white text-sm font-medium flex items-center gap-2 hover:bg-white/10 transition-colors"
                        >
                            Support the Project <Heart size={14} className="text-red-400" />
                        </a>
                    </div>
                </motion.div>
            </div>
        </section>
    )
}

// ════════════════════════════════════════════════════════════════════════════
// 8. FOOTER
// ════════════════════════════════════════════════════════════════════════════
function Footer() {
    return (
        <footer className="py-16 md:py-20 bg-[#050505] border-t border-white/5">
            <div className="max-w-7xl mx-auto px-6 md:px-10">
                <div className="flex flex-col md:flex-row items-center justify-between gap-4">
                    <div>
                        <span className="text-white text-lg font-medium tracking-tight">GastroMap</span>
                        <p className="mt-2 text-sm text-white/30 font-light leading-relaxed max-w-sm">
                            Your personal AI-powered guide to the best dining experiences worldwide.
                        </p>
                    </div>
                    <a href="https://instagram.com/gastromap.app" target="_blank" rel="noopener noreferrer" className="text-xs text-white/20 hover:text-white/50 transition-colors flex items-center gap-1.5">
                        @gastromap.app <ArrowUpRight size={10} />
                    </a>
                </div>
                <div className="mt-8 pt-8 border-t border-white/5 text-center">
                    <p className="text-xs text-white/20">© 2026 GastroMap. All rights reserved.</p>
                </div>
            </div>
        </footer>
    )
}

// ════════════════════════════════════════════════════════════════════════════
// PAGE EXPORT
// ════════════════════════════════════════════════════════════════════════════
export default function LandingPageV3() {
    return (
        <div className="bg-[#0A0A0A] text-white min-h-screen">
            <Navbar />
            <HeroSection />
            <AboutSection />
            <FeaturesSection />
            <GallerySection />
            <CitiesMarquee />
            <StatsSection />
            <ManifestoSection />
            <Footer />
        </div>
    )
}
