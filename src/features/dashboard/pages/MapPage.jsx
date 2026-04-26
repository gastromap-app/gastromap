import React, { useState, useEffect } from 'react'
import MapTab from '../components/MapTab'
import { SmartSearchBar } from '../components/SmartSearchBar'
import FilterModal from '../components/FilterModal'
import { useTheme } from '@/hooks/useTheme'
import { useLocationsStore } from '@/shared/store/useLocationsStore'
import { useDebounce } from '@/hooks/useDebounce'
import { useTranslation } from 'react-i18next'
import { Coffee, Utensils, Wine, Star } from 'lucide-react'

const MAP_CATEGORIES = [
    { name: 'All',         i18nKey: 'category.all',         icon: null,     emoji: '📍' },
    { name: 'Cafe',        i18nKey: 'category.cafe',        icon: Coffee,   emoji: '☕' },
    { name: 'Restaurant',  i18nKey: 'category.restaurant',  icon: Utensils, emoji: '🍽️' },
    { name: 'Bar',         i18nKey: 'category.bar',         icon: Wine,     emoji: '🍸' },
    { name: 'Fine Dining', i18nKey: 'category.fine_dining', icon: Star,     emoji: '🎩' },
]

/**
 * MapPage — fullscreen map experience with search & filters.
 *
 * The map uses fixed inset-0 so it fills the entire viewport.
 * UniversalHeader (z-100) and BottomNav (z-70) float on top of the map.
 * Map controls (locate-me button, place count) are positioned
 * to stay clear of both the header and the bottom nav.
 */
const MapPage = () => {
    const { theme } = useTheme()
    const isDark = theme === 'dark'
    const { t } = useTranslation()
    const { activeCategory, setCategory } = useLocationsStore()
    const [mapSearch, setMapSearch] = useState('')
    const [isFilterOpen, setIsFilterOpen] = useState(false)
    const debouncedMapSearch = useDebounce(mapSearch, 300)

    useEffect(() => {
        useLocationsStore.getState().setSearchQuery(debouncedMapSearch)
    }, [debouncedMapSearch])

    // Sync local search with store (e.g. if reset in modal)
    useEffect(() => {
        const storeSearch = useLocationsStore.getState().searchQuery
        if (storeSearch !== mapSearch && !debouncedMapSearch) {
            setMapSearch(storeSearch || '')
        }
    }, [useLocationsStore.getState().searchQuery])

    return (
        <div className="fixed inset-0 z-0">
            {/* Search + Categories Overlay */}
            <div
                className="absolute top-0 left-0 right-0 z-[600] px-4 pb-4 pointer-events-none"
                style={{ paddingTop: 'calc(env(safe-area-inset-top) + 4.5rem)' }}
            >
                <div className="max-w-md mx-auto pointer-events-auto flex flex-col gap-3">
                    <SmartSearchBar
                        value={mapSearch}
                        onChange={(e) => setMapSearch(e.target.value)}
                        onFilter={() => setIsFilterOpen(true)}
                        placeholder={t('dashboard.search_placeholder')}
                        className="w-full shadow-lg"
                    />

                    {/* Category chips */}
                    <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
                        {MAP_CATEGORIES.map((cat) => {
                            const active = activeCategory === cat.name
                            return (
                                <button
                                    key={cat.name}
                                    onClick={() => setCategory(active && cat.name !== 'All' ? 'All' : cat.name)}
                                    className={`flex-shrink-0 flex items-center gap-1.5 px-4 py-2.5 min-h-11 rounded-pill text-[12px] font-semibold whitespace-nowrap transition-all backdrop-blur-md ${
                                        active
                                            ? 'bg-[hsl(217,91%,60%)] text-white'
                                            : isDark
                                                ? 'bg-white/[0.04] text-[hsl(220,10%,55%)] border border-white/[0.06] hover:bg-white/[0.08] hover:text-[hsl(220,20%,96%)]'
                                                : 'bg-white/80 text-gray-700 border border-white/60 hover:bg-white'
                                    }`}
                                >
                                    <span>{cat.emoji}</span>
                                    {t(cat.i18nKey)}
                                </button>
                            )
                        })}
                    </div>
                </div>
            </div>

            <MapTab activeFilter={activeCategory} />

            <FilterModal isOpen={isFilterOpen} onClose={() => setIsFilterOpen(false)} theme={theme} />
        </div>
    )
}

export default MapPage
