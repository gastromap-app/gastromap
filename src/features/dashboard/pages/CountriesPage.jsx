import React, { useState, useMemo } from 'react'
import { motion } from 'framer-motion'
import { useNavigate, Link } from 'react-router-dom'
import { MapPin, ChevronRight, Search, Home, AlertCircle, Globe } from 'lucide-react'
import { useTheme } from '@/hooks/useTheme'
import { useLocationsStore } from '@/shared/store/useLocationsStore'
import { useGeoCovers } from '@/shared/api/queries'
import { CityCardSkeleton } from '@/components/ui/Skeleton'
import { useTranslation } from 'react-i18next'

// ─── Country Images Fallback ──────────────────────────────────────────────────

const COUNTRY_IMAGES = {
    poland:      'https://images.unsplash.com/photo-1519197924294-4ba991a11128?q=80&w=2069&auto=format&fit=crop',
    france:      'https://images.unsplash.com/photo-1502602898657-3e91760cbb34?q=80&w=2073&auto=format&fit=crop',
    spain:       'https://images.unsplash.com/photo-1543783207-ec64e4d95325?q=80&w=2070&auto=format&fit=crop',
    italy:       'https://images.unsplash.com/photo-1529543544282-ea669407fca3?q=80&w=2048&auto=format&fit=crop',
    germany:     'https://images.unsplash.com/photo-1467269204594-9661b134dd2b?q=80&w=2070&auto=format&fit=crop',
    portugal:    'https://images.unsplash.com/photo-1555881400-74d7acaacd8b?q=80&w=2070&auto=format&fit=crop',
    netherlands: 'https://images.unsplash.com/photo-1534351590666-13e3e96b5017?q=80&w=2070&auto=format&fit=crop',
    czechia:     'https://images.unsplash.com/photo-1541849546-216549ae216d?q=80&w=2070&auto=format&fit=crop',
}

// ─── Animation Variants ───────────────────────────────────────────────────────

const itemVariants = {
    hidden:   { opacity: 0, y: 20 },
    visible:  { opacity: 1, y: 0 },
}

// ─── Country Card ─────────────────────────────────────────────────────────────

function CountryCard({ country, navigate, desktop = false }) {
    return (
        <motion.button
            variants={itemVariants}
            onClick={() => navigate(`/explore/${country.slug}`)}
            whileHover={desktop ? { y: -8, scale: 1.02 } : undefined}
            className={`relative w-full overflow-hidden group shadow-lg active:scale-[0.98] transition-transform text-left ${
                desktop ? 'h-64 rounded-[32px] cursor-pointer' : 'h-48 rounded-[28px]'
            }`}
            aria-label={`Explore ${country.name}`}
        >
            <img
                src={country.image}
                alt={country.name}
                className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
            <div className={`absolute left-6 text-white ${desktop ? 'bottom-6' : 'bottom-5'}`}>
                <h4 className={`font-bold text-white leading-none capitalize ${desktop ? 'text-3xl mb-1' : 'text-2xl'}`}>
                    {country.name}
                </h4>
                <div className="flex items-center gap-1.5 mt-2 text-white/90">
                    <MapPin size={desktop ? 16 : 14} className="text-blue-400" />
                    <span className={`font-bold ${desktop ? 'text-sm' : 'text-[13px]'}`}>
                        {country.count} {country.count === 1 ? 'location' : 'locations'}
                    </span>
                </div>
            </div>
            <div className={`absolute right-6 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center border border-white/20 ${
                desktop
                    ? 'bottom-6 w-12 h-12 opacity-0 group-hover:opacity-100 transition-all'
                    : 'bottom-5 w-10 h-10'
            }`}>
                <ChevronRight className="text-white" size={desktop ? 24 : 20} />
            </div>
            {/* Badge with location count */}
            <div className={`absolute top-4 right-4 bg-blue-600 text-white text-[10px] font-bold px-2.5 py-1 rounded-full ${desktop ? 'hidden' : ''}`}>
                {country.count}
            </div>
        </motion.button>
    )
}

// ─── Empty / No-results state ───────────────────────────────────────────────

function NoResults({ searchQuery, textStyle, navigate }) {
    return (
        <div className="py-20 flex flex-col items-center gap-4 text-center">
            <AlertCircle size={36} className="text-gray-500 dark:text-gray-400" />
            <p className={`text-xl font-bold ${textStyle}`}>
                {searchQuery ? `No countries match "${searchQuery}"` : 'No countries found'}
            </p>
            <button
                onClick={() => navigate('/dashboard')}
                className="text-blue-500 text-sm font-semibold hover:underline"
            >
                Back to Dashboard
            </button>
        </div>
    )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

const CountriesPage = () => {
    const navigate = useNavigate()
    const { theme } = useTheme()
    const isDark = theme === 'dark'
    const { t } = useTranslation()
    const { locations, isLoading } = useLocationsStore()

    // Geo cover images from DB (admin-uploaded)
    const { data: geoCoversData = [] } = useGeoCovers('country')
    const dbCoverMap = Object.fromEntries(geoCoversData.map(c => [c.slug, c.image_url]))

    const [searchQuery, setSearchQuery] = useState('')

    // Build countries list from locations (same logic as DashboardPage)
    const countries = useMemo(() => {
        const countryMap = {}
        locations.forEach(loc => {
            const raw = loc.country ?? ''
            if (!raw) return
            const slug = raw.toLowerCase().replace(/\s+/g, '-')
            const name = raw.charAt(0).toUpperCase() + raw.slice(1)
            if (!countryMap[slug]) {
                countryMap[slug] = { name, slug, count: 0 }
            }
            countryMap[slug].count++
        })
        const dynamic = Object.values(countryMap).sort((a, b) => b.count - a.count)
        // Priority: 1) admin-uploaded DB image  2) static map  3) first location photo  4) Poland default
        return dynamic.map(c => ({
            ...c,
            image: dbCoverMap[c.slug]
                ?? COUNTRY_IMAGES[c.slug]
                ?? locations.find(l => l.country?.toLowerCase() === c.name.toLowerCase())?.photos?.[0]
                ?? COUNTRY_IMAGES.poland,
        }))
    }, [locations, dbCoverMap])

    const filtered = countries.filter(c =>
        !searchQuery || c.name.toLowerCase().includes(searchQuery.toLowerCase())
    )

    const textStyle    = isDark ? 'text-white'   : 'text-gray-900'
    const subTextStyle = isDark ? 'text-gray-500 dark:text-gray-400' : 'text-gray-500'

    return (
        <div data-lenis-prevent className="bg-transparent relative overscroll-none overflow-y-auto scrollbar-hide">
            {/* ── MOBILE ───────────────────────────────────────────────────── */}
            <motion.div
                className="md:hidden space-y-5 px-[2.5vw] pt-24 pb-12"
                onPanEnd={(_, info) => {
                    if (info.offset.x > 100 && info.velocity.x > 10) navigate(-1)
                }}
            >
                {/* Title */}
                <div>
                    <h2 className={`text-2xl font-bold tracking-tight leading-tight ${textStyle}`}>
                        {t('dashboard.explore_countries', 'Explore Countries')}
                    </h2>
                    <p className="text-[12px] text-gray-500 font-normal">Select a country to continue</p>
                </div>

                {/* Search */}
                <div className={`flex items-center h-14 px-5 rounded-2xl border ${isDark ? 'bg-white/5 border-white/10' : 'bg-white border-gray-100 shadow-xl shadow-blue-500/5'}`}>
                    <Search size={20} className="text-blue-500 mr-3" />
                    <input
                        type="text"
                        placeholder="Find a country..."
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        aria-label="Search countries"
                        className={`bg-transparent flex-1 outline-none text-sm font-semibold placeholder:text-gray-400 ${isDark ? 'text-white' : 'text-gray-900'}`}
                    />
                </div>

                {/* Cards */}
                {isLoading ? (
                    <div className="space-y-4">
                        {Array.from({ length: 4 }).map((_, i) => <CityCardSkeleton key={i} />)}
                    </div>
                ) : filtered.length === 0 ? (
                    <NoResults searchQuery={searchQuery} textStyle={textStyle} navigate={navigate} />
                ) : (
                    <motion.div
                        initial="hidden"
                        animate="visible"
                        variants={{ visible: { transition: { staggerChildren: 0.08 } } }}
                        className="space-y-4"
                    >
                        {filtered.map(country => (
                            <CountryCard key={country.slug} country={country} navigate={navigate} />
                        ))}
                    </motion.div>
                )}
            </motion.div>

            {/* ── DESKTOP ──────────────────────────────────────────────────── */}
            <div className="hidden md:block max-w-7xl mx-auto px-8 pt-24 pb-10">
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>

                    {/* Hero */}
                    <div className="mt-10 space-y-6">
                        <div className="space-y-2">
                            <h1 className={`text-5xl font-black tracking-tight ${textStyle}`}>
                                {t('dashboard.explore_countries', 'Explore Countries')}
                            </h1>
                            <p className={`text-lg ${subTextStyle}`}>Discover culinary destinations around the world.</p>
                        </div>

                        <div className="relative max-w-xl">
                            <div className="absolute inset-y-0 left-5 flex items-center pointer-events-none">
                                <Search size={20} className="text-blue-600" />
                            </div>
                            <input
                                type="text"
                                placeholder="Search countries..."
                                value={searchQuery}
                                onChange={e => setSearchQuery(e.target.value)}
                                aria-label="Search countries"
                                className={`w-full h-16 pl-14 pr-6 rounded-[24px] border-2 border-transparent outline-none text-lg transition-all ${isDark ? 'bg-white/5 text-white border-white/10 focus:border-blue-500' : 'bg-white shadow-xl focus:border-blue-500'}`}
                            />
                        </div>
                    </div>

                    {/* Breadcrumb */}
                    <div className="flex items-center gap-6 mt-8">
                        <nav className={`flex items-center px-4 py-2 rounded-full border backdrop-blur-md ${isDark ? 'bg-white/5 border-white/10' : 'bg-black/5 border-gray-100'}`}>
                            <Link to="/dashboard" className="flex items-center gap-2 text-[10px] font-bold tracking-widest uppercase text-gray-500 dark:text-gray-400 hover:text-blue-500 transition-colors">
                                <Home size={12} /><span>Dashboard</span>
                            </Link>
                            <ChevronRight size={14} className="mx-2 text-gray-500/50" />
                            <div className="flex items-center gap-2 text-[10px] font-bold tracking-widest uppercase text-blue-600">
                                <Globe size={12} className="fill-blue-600/20" />
                                <span>Explore Countries</span>
                            </div>
                        </nav>
                    </div>

                    {/* Content */}
                    <div className="mt-8 min-h-[400px]">
                        {isLoading ? (
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                                {Array.from({ length: 6 }).map((_, i) => <CityCardSkeleton key={i} desktop />)}
                            </div>
                        ) : filtered.length === 0 ? (
                            <NoResults searchQuery={searchQuery} textStyle={textStyle} navigate={navigate} />
                        ) : (
                            <motion.div
                                initial="hidden"
                                animate="visible"
                                variants={{ visible: { transition: { staggerChildren: 0.08, delayChildren: 0.1 } } }}
                                className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5"
                            >
                                {filtered.map(country => (
                                    <CountryCard key={country.slug} country={country} navigate={navigate} desktop />
                                ))}
                            </motion.div>
                        )}
                    </div>

                </motion.div>
            </div>
        </div>
    )
}

export default CountriesPage
