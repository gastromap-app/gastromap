import React, { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence, useDragControls } from 'framer-motion'
import { useNavigate, useParams, Link } from 'react-router-dom'
import {
    MapPin, Search, SlidersHorizontal, Star, Clock,
    Heart, Share2, ChevronRight, Home, Utensils,
    Coffee, Wine, Store, Navigation, List, ChevronUp, X
} from 'lucide-react'
import { useTheme } from '@/hooks/useTheme'
import FilterModal from '@/features/dashboard/components/FilterModal'
import MapTab from '@/features/dashboard/components/MapTab'
import { PageTransition } from '@/components/ui/PageTransition'

// Mock Data for establishments in a specific city
const ESTABLISHMENTS_DATA = [
    {
        id: 1,
        title: "La Mammola",
        category: "Dining",
        cuisine: "Italian",
        rating: 4.9,
        reviews: 245,
        price: "$$$",
        image: "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?q=80&w=800&auto=format&fit=crop",
        status: "Open Now",
        distance: "0.8 km",
        isNew: true,
        special_labels: ['Signature Cuisine', 'Michelin Guide'],
        best_time: ['evening']
    },
    {
        id: 2,
        title: "Coffee & Art",
        category: "Café",
        cuisine: "French",
        rating: 4.7,
        reviews: 128,
        price: "$",
        image: "https://images.unsplash.com/photo-1554118811-1e0d58224f24?q=80&w=800&auto=format&fit=crop",
        status: "Closing Soon",
        distance: "1.2 km",
        isNew: false,
        special_labels: ['Specialty Coffee', 'Delicious Desserts'],
        best_time: ['morning', 'day']
    },
    {
        id: 3,
        title: "Hamsa Hummus",
        category: "Dining",
        cuisine: "Israeli",
        rating: 4.8,
        reviews: 512,
        price: "$$",
        image: "https://images.unsplash.com/photo-1514362545857-3bc16c4c7d1b?q=80&w=800&auto=format&fit=crop",
        status: "Open Now",
        distance: "2.4 km",
        isNew: false,
        special_labels: ['Vegan Menu', 'Local Favorite'],
        best_time: ['day', 'evening']
    },
    {
        id: 4,
        title: "The Golden Crust",
        category: "Bakery",
        cuisine: "French",
        rating: 4.6,
        reviews: 89,
        price: "$$",
        image: "https://images.unsplash.com/photo-1509440159596-0249088772ff?q=80&w=800&auto=format&fit=crop",
        status: "Open Now",
        distance: "0.5 km",
        isNew: true,
        special_labels: ['Bakery', 'Local Products'],
        best_time: ['morning']
    }
]

const LocationsPage = () => {
    const { country, city } = useParams()
    const navigate = useNavigate()
    const { theme } = useTheme()
    const isDark = theme === 'dark'

    const [activeTab, setActiveTab] = useState('overview')
    const [activeFilter, setActiveFilter] = useState('All')
    const [isFilterOpen, setIsFilterOpen] = useState(false)
    const [searchQuery, setSearchQuery] = useState('')

    // Mobile Sheet State
    const [sheetMode, setSheetMode] = useState('full') // 'mini', 'full'
    const dragControls = useDragControls()

    const textStyle = isDark ? "text-white" : "text-gray-900"
    const subTextStyle = isDark ? "text-gray-400" : "text-gray-500"

    const categories = [
        { name: 'All', icon: Store },
        { name: 'Dining', icon: Utensils },
        { name: 'Café', icon: Coffee },
        { name: 'Bar', icon: Wine }
    ]

    const itemVariants = {
        hidden: { opacity: 0, y: 20 },
        visible: { opacity: 1, y: 0 }
    }

    return (
        <PageTransition className="fixed inset-0 w-full h-[100dvh] bg-transparent overflow-hidden overscroll-none">
            <FilterModal isOpen={isFilterOpen} onClose={() => setIsFilterOpen(false)} theme={theme} />

            {/* --- MOBILE VIEW: HIDDEN LAYER (MAP) --- */}
            <div className="md:hidden fixed inset-0 z-0 pt-16">
                <div className="w-full h-full [&>div]:h-full [&>div]:w-full [&>div]:rounded-none [&>div]:border-none">
                    <MapTab activeFilter={activeFilter} />
                </div>

                {/* Floating Search in Mobile View - Style logic from concepts */}
                <div className="absolute top-24 left-[4vw] right-[4vw] z-40 transition-all duration-500">
                    <div className="flex gap-2">
                        <div className={`flex-1 relative flex items-center h-14 px-5 rounded-2xl transition-all border backdrop-blur-xl ${isDark ? 'bg-[#0a0a0a]/70 border-white/10' : 'bg-white/80 border-gray-100 shadow-xl shadow-blue-500/10'}`}>
                            <Search size={18} className="text-blue-500 mr-3" />
                            <input
                                type="text"
                                placeholder={`Find in ${city}...`}
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className={`bg-transparent flex-1 outline-none text-sm font-semibold placeholder:text-gray-400 ${isDark ? 'text-white' : 'text-gray-900'}`}
                            />
                        </div>
                        <button
                            onClick={() => setIsFilterOpen(true)}
                            className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-all active:scale-95 border backdrop-blur-xl ${isDark ? 'bg-blue-600/20 border-blue-500/20 text-blue-500' : 'bg-blue-600 text-white shadow-lg border-transparent'}`}
                        >
                            <SlidersHorizontal size={20} />
                        </button>
                    </div>
                </div>
            </div>

            <motion.div
                className="md:hidden fixed inset-x-0 bottom-0 z-[60] overflow-visible"
                initial={{ y: "100%" }}
                animate={{ y: sheetMode === 'mini' ? '84%' : '88px' }}
                transition={{ type: "spring", damping: 30, stiffness: 250 }}
                drag="y"
                dragControls={dragControls}
                dragListener={false}
                dragConstraints={{ top: 0, bottom: 0 }}
                dragElastic={{ top: 0, bottom: 0.2 }}
                onDragEnd={(e, info) => {
                    if (info.offset.y < -50) setSheetMode('full')
                    if (info.offset.y > 50) setSheetMode('mini')
                }}
            >
                <div className={`flex flex-col h-[100dvh] rounded-t-[48px] pb-32 border-t backdrop-blur-3xl shadow-[0_-20px_60px_-15px_rgba(0,0,0,0.4)] ${isDark ? 'bg-[#1a1c24]/95 border-white/10' : 'bg-white/98 border-gray-200'}`}>
                    {/* Drag Handle & Toggle */}
                    <div
                        onPointerDown={(e) => dragControls.start(e)}
                        className="flex flex-col items-center pt-0 pb-2 px-[4vw] cursor-grab active:cursor-grabbing group flex-shrink-0 touch-none"
                    >
                        <div className="w-12 h-1.5 bg-gray-400/30 rounded-full group-hover:bg-blue-500/50 transition-colors my-4" />

                        <div
                            className="relative flex items-center justify-center w-full px-2 py-2 cursor-pointer active:scale-95 transition-transform"
                            onClick={(e) => {
                                e.stopPropagation();
                                setSheetMode(sheetMode === 'full' ? 'mini' : 'full');
                            }}
                        >
                            <div className="flex items-center gap-2">
                                <ChevronUp size={14} className={`text-blue-500 transition-transform duration-500 ${sheetMode === 'full' ? 'rotate-180' : ''}`} />
                                <span className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-500 uppercase">{sheetMode === 'full' ? 'View Map' : 'View List'}</span>
                            </div>
                        </div>
                    </div>

                    {/* Scrollable List Content */}
                    <motion.div
                        className="flex-1 overflow-y-auto pt-2 pb-32 px-[4vw] scrollbar-hide overscroll-contain touch-pan-y"
                        animate={{
                            opacity: sheetMode === 'full' ? 1 : 0,
                            filter: sheetMode === 'full' ? 'blur(0px)' : 'blur(10px)'
                        }}
                        transition={{ duration: 0.3 }}
                    >
                        {/* Title inside sheet */}
                        <div className="space-y-1 mb-2.5">
                            <h2 className={`text-3xl font-black ${textStyle}`}>Discover {city}</h2>
                            <p className={`text-sm font-medium ${subTextStyle}`}>Curated restaurants and local bars</p>
                        </div>

                        {/* Category Chips inside sheet */}
                        <div className="flex gap-2.5 overflow-x-auto pb-6 -mx-[4vw] px-[4vw] scrollbar-hide">
                            {/* Filter Button (Replaces All) */}
                            <button
                                onClick={() => setIsFilterOpen(true)}
                                className={`flex-shrink-0 w-12 h-12 flex items-center justify-center rounded-2xl transition-all border ${isDark ? 'bg-blue-600/20 border-blue-500/20 text-blue-500' : 'bg-blue-600 text-white shadow-lg shadow-blue-600/20 border-transparent'}`}
                            >
                                <SlidersHorizontal size={20} />
                            </button>

                            {categories.filter(c => c.name !== 'All').map((cat) => (
                                <button
                                    key={cat.name}
                                    onClick={() => setActiveFilter(cat.name)}
                                    className={`flex items-center gap-2 px-6 py-3 rounded-2xl text-[13px] font-black whitespace-nowrap transition-all border ${activeFilter === cat.name
                                        ? 'bg-blue-600 border-blue-600 text-white shadow-xl'
                                        : isDark ? 'bg-white/5 border-white/10 text-white/50 hover:bg-white/10' : 'bg-gray-100 border-gray-100 text-gray-500'
                                        }`}
                                >
                                    <cat.icon size={14} className={activeFilter === cat.name ? "text-white" : "text-blue-500"} />
                                    {cat.name}
                                </button>
                            ))}
                        </div>

                        <motion.div
                            initial="hidden"
                            animate="visible"
                            variants={{ visible: { transition: { staggerChildren: 0.1 } } }}
                            className="space-y-5"
                        >
                            {ESTABLISHMENTS_DATA.map((item) => (
                                <motion.div
                                    key={item.id}
                                    variants={itemVariants}
                                    onClick={() => navigate(`/location/${item.id}`)}
                                    className={`relative flex flex-col p-3 rounded-[32px] overflow-hidden shadow-sm border transition-all duration-300 ${isDark ? 'bg-white/[0.03] border-white/5' : 'bg-white border-gray-100'}`}
                                >
                                    <div className="relative h-48 w-full rounded-[24px] overflow-hidden mb-3">
                                        <img src={item.image} alt={item.title} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" />
                                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />

                                        {/* Badges */}
                                        <div className="absolute top-3 left-3 flex gap-2">
                                            {item.isNew && (
                                                <div className="bg-blue-600 text-white px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-wider shadow-lg">New</div>
                                            )}
                                        </div>

                                        <button className="absolute top-3 right-3 w-10 h-10 rounded-xl bg-white/20 backdrop-blur-md flex items-center justify-center border border-white/30 text-white active:scale-95 transition-transform">
                                            <Heart size={18} />
                                        </button>

                                        <div className="absolute bottom-4 left-4 right-4 flex justify-between items-end">
                                            <div className="space-y-1">
                                                <span className="bg-white/20 backdrop-blur-md text-white px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase border border-white/40">{item.category}</span>
                                                <h4 className="text-xl font-black text-white leading-tight mt-1">{item.title}</h4>
                                            </div>
                                            <div className="bg-blue-600 p-2.5 rounded-xl text-white shadow-xl shadow-blue-600/30">
                                                <Navigation size={18} />
                                            </div>
                                        </div>
                                    </div>

                                    <div className="px-1 pb-1 space-y-2.5">
                                        <div className="flex justify-between items-center">
                                            <div className="flex items-center gap-1.5">
                                                <Star size={16} className="text-yellow-400 fill-yellow-400" />
                                                <span className={`text-sm font-black ${textStyle}`}>{item.rating}</span>
                                                <span className={`text-[11px] ${subTextStyle}`}>({item.reviews})</span>
                                            </div>
                                            <span className="text-blue-500 font-bold text-sm tracking-tight">{item.price}</span>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <div className="flex items-center gap-1.5 text-[10px] font-black text-green-500 uppercase tracking-tighter">
                                                <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                                                <span>{item.status}</span>
                                            </div>
                                            <span className={`text-[10px] font-bold ${subTextStyle}`}>• {item.distance} away</span>
                                        </div>
                                    </div>
                                </motion.div>
                            ))}
                        </motion.div>
                    </motion.div>
                </div>
            </motion.div>

            {/* --- DESKTOP VIEW: REMAINS CONSISTENT --- */}
            <div className="hidden md:block px-[10px] pt-24 pb-6 relative z-10">
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                >
                    {/* Hero Area */}
                    <div className="mt-[40px] space-y-6">
                        <div className="space-y-2">
                            <h1 className={`text-4xl md:text-5xl font-bold tracking-tight capitalize ${textStyle}`}>
                                Explore <span className="text-blue-600">{city}</span>
                            </h1>
                            <p className={`text-lg transition-colors ${subTextStyle}`}>Premium restaurants and hidden gems in the heart of {city}.</p>
                        </div>

                        <div className="flex flex-col md:flex-row gap-4 items-center mt-[20px]">
                            <div className="relative flex-1 group w-full">
                                <div className="absolute inset-y-0 left-5 flex items-center pointer-events-none">
                                    <Search size={22} className="text-blue-600" />
                                </div>
                                <input
                                    type="text"
                                    placeholder={`Search in ${city}, ${country}...`}
                                    className={`w-full h-16 pl-14 pr-6 rounded-[24px] border-2 border-transparent outline-none text-lg transition-all ${isDark ? 'bg-white/5 backdrop-blur-md text-white border-white/10 focus:border-blue-500' : 'bg-white shadow-xl focus:border-blue-500'}`}
                                />
                            </div>
                            <button className="h-16 px-10 rounded-[24px] bg-blue-600 text-white font-black text-lg shadow-xl shadow-blue-500/20 hover:bg-blue-700 active:scale-95 transition-all">
                                Search
                            </button>
                        </div>
                    </div>

                    {/* Control Bar */}
                    <div className="flex flex-col md:flex-row justify-between items-center gap-6 mt-[40px]">
                        <div className="bg-blue-600 p-1.5 rounded-full flex shadow-lg relative h-fit">
                            {['overview', 'map'].map((tab) => (
                                <button
                                    key={tab}
                                    onClick={() => setActiveTab(tab)}
                                    className={`relative px-10 py-3 rounded-full text-base font-bold capitalize transition-all duration-300 z-10 ${activeTab === tab ? 'text-blue-600' : 'text-white hover:bg-white/10'}`}
                                >
                                    {activeTab === tab && (
                                        <motion.div layoutId="activeTabLocations" className="absolute inset-0 bg-white rounded-full shadow-sm z-[-1]" />
                                    )}
                                    {tab}
                                </button>
                            ))}
                        </div>

                        {/* Breadcrumbs */}
                        <nav className={`hidden md:flex items-center px-5 py-2.5 rounded-full border backdrop-blur-md ml-[40px] transition-all duration-300 ${isDark ? 'bg-white/5 border-white/10' : 'bg-black/5 border-gray-100'}`}>
                            <Link to="/dashboard" className="flex items-center gap-2 text-[10px] font-bold tracking-widest uppercase text-gray-400 hover:text-blue-500 transition-colors group">
                                <Home size={12} className="group-hover:scale-110 transition-transform" />
                                <span>Dashboard</span>
                            </Link>
                            <ChevronRight size={14} className="mx-2 text-gray-500/50" />
                            <Link to={`/explore/${country}`} className="text-[10px] font-bold tracking-widest uppercase text-gray-400 hover:text-blue-500 transition-colors capitalize">{country}</Link>
                            <ChevronRight size={14} className="mx-2 text-gray-500/50" />
                            <div className="flex items-center gap-2 text-[10px] font-bold tracking-widest uppercase text-blue-600">
                                <MapPin size={12} className="fill-blue-600/20" />
                                <span className="capitalize">{city}</span>
                            </div>
                        </nav>

                        <div className="flex items-center gap-4 ml-auto">
                            <button
                                onClick={() => setIsFilterOpen(true)}
                                className={`p-4 h-14 w-14 flex items-center justify-center rounded-xl active:scale-95 transition-all ${isDark ? 'bg-white/5 border-white/10 text-white hover:bg-white/10' : 'bg-white border-gray-200 text-gray-600 shadow-sm hover:border-blue-500'}`}
                            >
                                <SlidersHorizontal size={20} />
                            </button>
                        </div>
                    </div>

                    {/* Content Section Desktop */}
                    <div className="mt-[30px] space-y-10 min-h-[600px]">
                        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
                            <h3 className={`text-2xl font-bold ${textStyle}`}>Recommended Establishments</h3>
                        </motion.div>

                        <motion.div
                            initial="hidden"
                            animate="visible"
                            variants={{ visible: { transition: { staggerChildren: 0.1, delayChildren: 0.2 } } }}
                            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6"
                        >
                            {ESTABLISHMENTS_DATA.map((item) => (
                                <motion.div
                                    key={item.id}
                                    variants={itemVariants}
                                    onClick={() => navigate(`/location/${item.id}`)}
                                    whileHover={{ y: -10 }}
                                    className={`relative flex flex-col p-4 rounded-[40px] overflow-hidden group cursor-pointer transition-all duration-500 border
                                        ${isDark ? 'bg-white/[0.03] border-white/5 shadow-2xl' : 'bg-white border-gray-100 shadow-xl shadow-gray-200/50'}
                                    `}
                                >
                                    <div className="relative h-56 mb-5 rounded-[28px] shadow-inner">
                                        <img src={item.image} alt={item.title} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" />
                                        <div className="absolute top-4 right-4 bg-white/90 backdrop-blur-md px-3 py-1.5 rounded-xl text-xs font-black text-gray-900 flex items-center gap-1 shadow-md">
                                            <Star size={14} className="text-yellow-500 fill-yellow-500" /> {item.rating}
                                        </div>
                                        <div className="absolute top-4 left-4 flex flex-col gap-2">
                                            {item.isNew && (
                                                <div className="bg-blue-600 text-white text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-tighter shadow-lg">New Arrival</div>
                                            )}
                                        </div>
                                    </div>
                                    <div className="space-y-3 px-2 flex-1">
                                        <div className="flex justify-between items-start">
                                            <h4 className={`text-xl font-black leading-tight group-hover:text-blue-600 transition-colors ${textStyle}`}>{item.title}</h4>
                                            <span className="text-blue-500 font-black text-sm">{item.price}</span>
                                        </div>
                                        <p className={`text-[13px] font-bold ${subTextStyle}`}>{item.cuisine} • {item.category}</p>

                                        <div className={`pt-4 flex justify-between items-center border-t ${isDark ? 'border-white/5' : 'border-gray-50'}`}>
                                            <div className="flex flex-col gap-0.5">
                                                <div className="flex items-center gap-1.5 text-[11px] font-black text-green-500 uppercase tracking-tighter">
                                                    <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                                                    {item.status}
                                                </div>
                                                <span className={`text-[11px] font-bold ${subTextStyle}`}>{item.distance} away</span>
                                            </div>
                                            <div className="flex gap-2.5">
                                                <button className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${isDark ? 'bg-white/5 hover:bg-white/10 text-white/50' : 'bg-gray-50 hover:bg-gray-100 text-gray-400'}`}>
                                                    <Heart size={18} />
                                                </button>
                                                <button className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${isDark ? 'bg-white/5 hover:bg-white/10 text-white/50' : 'bg-gray-50 hover:bg-gray-100 text-gray-400'}`}>
                                                    <Share2 size={18} />
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                </motion.div>
                            ))}
                        </motion.div>
                    </div>
                </motion.div>
            </div>
        </PageTransition >
    )
}

export default LocationsPage
