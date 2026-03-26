import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useNavigate, useParams, Link } from 'react-router-dom'
import { MapPin, ChevronRight, Search, SlidersHorizontal, ShieldCheck, Moon, Sun, ChevronLeft, Home } from 'lucide-react'
import { useTheme } from '@/hooks/useTheme'
import { useAuthStore } from '@/features/auth/hooks/useAuthStore'
import MapTab from '../components/MapTab'

const CITIES_DATA = {
    poland: [
        { name: 'Krakow', places: 142, image: 'https://images.unsplash.com/photo-1519197924294-4ba991a11128?q=80&w=2069&auto=format&fit=crop' },
        { name: 'Warsaw', places: 89, image: 'https://images.unsplash.com/photo-1519197924294-4ba991a11128?q=80&w=2069&auto=format&fit=crop' },
        { name: 'Gdansk', places: 56, image: 'https://images.unsplash.com/photo-1519197924294-4ba991a11128?q=80&w=2069&auto=format&fit=crop' },
    ],
    france: [
        { name: 'Paris', places: 245, image: 'https://images.unsplash.com/photo-1502602898657-3e91760cbb34?q=80&w=2073&auto=format&fit=crop' },
        { name: 'Lyon', places: 112, image: 'https://images.unsplash.com/photo-1502602898657-3e91760cbb34?q=80&w=2073&auto=format&fit=crop' },
    ]
}

const CitiesPage = () => {
    const { country } = useParams()
    const navigate = useNavigate()
    const { theme, toggleTheme } = useTheme()
    const { user: authUser } = useAuthStore()
    const user = authUser || { name: 'Alex Johnson' }
    const isDark = theme === 'dark'

    const [activeTab, setActiveTab] = useState('overview')
    const [searchQuery, setSearchQuery] = useState('')
    const [showFilterNotice, setShowFilterNotice] = useState(false)
    const cities = CITIES_DATA[country?.toLowerCase()] || []

    const glassStyle = isDark
        ? "bg-black/30 border-white/10 text-white shadow-lg hover:bg-black/40"
        : "bg-white/40 border-white/40 text-gray-900 shadow-sm hover:bg-white/60"

    const textStyle = isDark ? "text-white" : "text-gray-900"
    const subTextStyle = isDark ? "text-gray-400" : "text-gray-500"

    const itemVariants = {
        hidden: { opacity: 0, y: 20 },
        visible: { opacity: 1, y: 0 }
    }

    const triggerNotice = () => {
        setShowFilterNotice(true)
        setTimeout(() => setShowFilterNotice(false), 3000)
    }

    return (
        <div className="h-[100dvh] bg-transparent relative overscroll-none overflow-y-auto scrollbar-hide">
            {/* --- MOBILE VIEW --- */}
            <motion.div
                className="md:hidden space-y-5 px-[2.5vw] pt-24 pb-12"
                onPanEnd={(e, info) => {
                    // Detect left-to-right swipe (back gesture)
                    if (info.offset.x > 100 && info.velocity.x > 10) {
                        navigate(-1)
                    }
                }}
            >
                {/* 1. Mobile Title Block */}
                <div className="">
                    <h2 className={`text-2xl font-bold tracking-tight leading-tight ${textStyle}`}>
                        Explore <span className="text-blue-600 capitalize">{country}</span>
                    </h2>
                    <p className="text-[12px] text-gray-500 font-normal">
                        Select a city to continue
                    </p>
                </div>

                {/* 2. Search & Filter Bar */}
                <div className="relative">
                    <div className="flex gap-2">
                        <div className={`flex-1 relative flex items-center h-14 px-5 rounded-2xl transition-all border ${isDark ? 'bg-white/5 border-white/10 shadow-none' : 'bg-white border-gray-100 shadow-xl shadow-blue-500/5'}`}>
                            <Search size={20} className="text-blue-500 mr-3" />
                            <input
                                type="text"
                                placeholder="Find a city..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className={`bg-transparent flex-1 outline-none text-sm font-semibold placeholder:text-gray-400 ${isDark ? 'text-white' : 'text-gray-900'}`}
                            />
                        </div>
                        <button
                            onClick={triggerNotice}
                            className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-all active:scale-95 border ${isDark ? 'bg-blue-600/10 border-blue-500/20 text-blue-500' : 'bg-blue-600 text-white shadow-lg shadow-blue-600/20 border-transparent'}`}
                        >
                            <SlidersHorizontal size={20} />
                        </button>
                    </div>

                    {/* Mobile Notice Toast - Absolute under the bar */}
                    <AnimatePresence>
                        {showFilterNotice && (
                            <motion.div
                                initial={{ opacity: 0, y: -10 }}
                                animate={{ opacity: 1, y: 12 }}
                                exit={{ opacity: 0, y: -10 }}
                                className="absolute left-0 right-0 z-50 px-4 py-2 rounded-xl bg-blue-600/90 backdrop-blur-md text-white font-bold shadow-xl flex items-center gap-2 border border-blue-400/30"
                            >
                                <SlidersHorizontal size={14} />
                                <span className="text-[12px] whitespace-nowrap">на данной странице фильтры не работают</span>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>

                {/* 3. Content Mobile - Only List as requested */}
                <motion.div
                    initial="hidden"
                    animate="visible"
                    variants={{ visible: { transition: { staggerChildren: 0.1 } } }}
                    className="space-y-4"
                >
                    {cities.map((city, i) => (
                        <motion.div
                            key={i}
                            variants={itemVariants}
                            onClick={() => navigate(`/explore/${country}/${city.name.toLowerCase()}`)}
                            className="relative h-48 rounded-[28px] overflow-hidden group shadow-lg active:scale-[0.98] transition-transform"
                        >
                            <img src={city.image} alt={city.name} className="w-full h-full object-cover" />
                            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
                            <div className="absolute bottom-5 left-6">
                                <h4 className="text-2xl font-bold text-white leading-none">{city.name}</h4>
                                <div className="flex items-center gap-1.5 mt-2 text-white/90">
                                    <MapPin size={14} className="text-blue-400" />
                                    <span className="text-[13px] font-bold">{city.places} Places</span>
                                </div>
                            </div>
                            <div className="absolute bottom-5 right-6 w-10 h-10 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center border border-white/20">
                                <ChevronRight className="text-white" size={20} />
                            </div>
                        </motion.div>
                    ))}

                    {cities.length === 0 && (
                        <div className="py-20 text-center space-y-4">
                            <p className={`text-xl font-bold ${textStyle}`}>Soon more cities in {country}!</p>
                            <button onClick={() => navigate('/dashboard')} className="text-blue-500 hover:underline">Go back to countries</button>
                        </div>
                    )}
                </motion.div>
            </motion.div>

            {/* --- DESKTOP VIEW --- */}
            <div className="hidden md:block max-w-7xl mx-auto px-8 pt-24 pb-10">
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                >
                    {/* Hero Area */}
                    <div className="mt-[40px] space-y-6">
                        <div className="space-y-2">
                            <h1 className={`text-4xl md:text-5xl font-bold tracking-tight capitalize ${textStyle}`}>
                                Welcome to <span className="text-blue-600">{country}</span>
                            </h1>
                            <p className={`text-lg ${subTextStyle}`}>Explore the finest culinary cities in this region.</p>
                        </div>

                        <div className="flex flex-col md:flex-row gap-4 items-center mt-[20px]">
                            <div className="relative flex-1 group w-full">
                                <div className="absolute inset-y-0 left-5 flex items-center pointer-events-none">
                                    <Search size={20} className="text-blue-600" />
                                </div>
                                <input
                                    type="text"
                                    placeholder={`Search cities in ${country}...`}
                                    className={`w-full h-16 pl-14 pr-6 rounded-[24px] border-2 border-transparent outline-none text-lg transition-all ${isDark ? 'bg-white/10 backdrop-blur-md text-white border-white/10 focus:border-blue-500' : 'bg-white shadow-xl focus:border-blue-500'}`}
                                />
                            </div>
                        </div>
                    </div>

                    {/* Control Bar */}
                    <div className="flex flex-col md:flex-row justify-between items-center gap-6 mt-[20px]">
                        <div className="bg-blue-600 p-1.5 rounded-full flex shadow-lg relative h-fit">
                            {['overview', 'map'].map((tab) => (
                                <button
                                    key={tab}
                                    onClick={() => setActiveTab(tab)}
                                    className={`relative px-8 py-3 rounded-full text-base font-bold capitalize transition-all duration-300 z-10 ${activeTab === tab ? 'text-blue-600' : 'text-white hover:bg-white/10'}`}
                                >
                                    {activeTab === tab && (
                                        <motion.div layoutId="activeTabCities" className="absolute inset-0 bg-white rounded-full shadow-sm z-[-1]" />
                                    )}
                                    {tab}
                                </button>
                            ))}
                        </div>

                        {/* Premium Breadcrumbs Capsule */}
                        <nav className={`hidden md:flex items-center px-4 py-2 rounded-full border backdrop-blur-md ml-[40px] transition-all duration-300 ${isDark ? 'bg-white/5 border-white/10' : 'bg-black/5 border-gray-100'}`}>
                            <Link
                                to="/dashboard"
                                className="flex items-center gap-2 text-[10px] font-bold tracking-widest uppercase text-gray-400 hover:text-blue-500 transition-colors group"
                            >
                                <Home size={12} className="group-hover:scale-110 transition-transform" />
                                <span>Dashboard</span>
                            </Link>

                            <ChevronRight size={14} className="mx-2 text-gray-500/50" />

                            <div className="flex items-center gap-2 text-[10px] font-bold tracking-widest uppercase text-blue-600">
                                <MapPin size={12} className="fill-blue-600/20" />
                                <span>{country}</span>
                            </div>
                        </nav>

                        <div className="flex items-center gap-4 ml-auto relative">
                            {/* PC Notice Toast - Sliding left from the button */}
                            <AnimatePresence>
                                {showFilterNotice && (
                                    <motion.div
                                        initial={{ opacity: 0, x: 20 }}
                                        animate={{ opacity: 1, x: -12 }}
                                        exit={{ opacity: 0, x: 20 }}
                                        className="absolute right-full mr-4 px-6 py-3 rounded-2xl bg-blue-600 text-white font-bold shadow-2xl flex items-center gap-3 backdrop-blur-md border border-white/10 whitespace-nowrap z-50"
                                    >
                                        <SlidersHorizontal size={18} />
                                        <span className="text-sm italic">на данной странице фильтры не работают</span>
                                    </motion.div>
                                )}
                            </AnimatePresence>

                            <button
                                onClick={triggerNotice}
                                className={`p-4 h-14 w-14 flex items-center justify-center rounded-xl active:scale-95 transition-all ${glassStyle}`}
                            >
                                <SlidersHorizontal size={20} />
                            </button>
                        </div>
                    </div>

                    {/* Content Section Desktop */}
                    {activeTab === 'map' ? (
                        <div className="h-[600px] rounded-[32px] overflow-hidden shadow-2xl mt-[20px]">
                            <MapTab activeFilter="All" />
                        </div>
                    ) : (
                        <div className="mt-[20px] space-y-10">
                            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
                                <div className="flex justify-between items-end px-1">
                                    <div className="space-y-1">
                                        <h3 className={`text-2xl font-bold ${textStyle}`}>Explore by City</h3>
                                        <p className={`text-sm ${subTextStyle}`}>Choose your destination in {country}</p>
                                    </div>
                                </div>
                            </motion.div>

                            <motion.div
                                initial="hidden"
                                animate="visible"
                                variants={{ visible: { transition: { staggerChildren: 0.1, delayChildren: 0.2 } } }}
                                className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5"
                            >
                                {cities.map((city, i) => (
                                    <motion.div
                                        key={i}
                                        variants={itemVariants}
                                        onClick={() => navigate(`/explore/${country}/${city.name.toLowerCase()}`)}
                                        whileHover={{ y: -8, scale: 1.02 }}
                                        className="relative h-64 rounded-[32px] overflow-hidden group cursor-pointer shadow-lg"
                                    >
                                        <img src={city.image} alt={city.name} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" />
                                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                                        <div className="absolute bottom-6 left-6 text-white">
                                            <h4 className="text-3xl font-bold mb-1">{city.name}</h4>
                                            <div className="flex items-center gap-1.5 text-sm opacity-90">
                                                <MapPin size={16} className="text-blue-400" />
                                                <span>{city.places} establishments</span>
                                            </div>
                                        </div>
                                        <div className="absolute bottom-6 right-6 w-12 h-12 rounded-full bg-white/20 backdrop-blur-md border border-white/30 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all">
                                            <ChevronRight className="text-white" size={24} />
                                        </div>
                                    </motion.div>
                                ))}
                            </motion.div>
                        </div>
                    )}
                </motion.div>
            </div>
        </div >
    )
}

export default CitiesPage
