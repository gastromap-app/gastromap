import React from 'react'
import { motion } from 'framer-motion'
import { Coffee, Wine, Utensils, Star, Sparkles } from 'lucide-react'
import { useLocationsStore } from '@/shared/store/useLocationsStore'
import { useTranslation } from 'react-i18next'

const QUICK_FILTERS = [
    { id: 'Cafe', label: 'category.cafe', icon: Coffee, color: 'text-orange-500', activeBorder: 'border-orange-500/50', activeBg: 'bg-orange-500/10' },
    { id: 'Restaurant', label: 'category.restaurant', icon: Utensils, color: 'text-emerald-500', activeBorder: 'border-emerald-500/50', activeBg: 'bg-emerald-500/10' },
    { id: 'Bar', label: 'category.bar', icon: Wine, color: 'text-purple-500', activeBorder: 'border-purple-500/50', activeBg: 'bg-purple-500/10' },
    { id: 'Fine Dining', label: 'category.fine_dining', icon: Star, color: 'text-amber-500', activeBorder: 'border-amber-500/50', activeBg: 'bg-amber-500/10' },
]

const CategoryFilters = ({ isDark }) => {
    const { t } = useTranslation()
    const { activeCategories, toggleCategory } = useLocationsStore()

    const handleToggle = (id) => {
        toggleCategory(id)
    }

    const container = {
        hidden: { opacity: 0 },
        show: {
            opacity: 1,
            transition: { staggerChildren: 0.05 }
        }
    }

    const item = {
        hidden: { opacity: 0, y: 10 },
        show: { opacity: 1, y: 0 }
    }

    return (
        <div className="w-full">
            {/* Quick Filters - Multi-select Categories */}
            <motion.div 
                variants={container}
                initial="hidden"
                animate="show"
                className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide px-5 -mx-5"
            >
                {QUICK_FILTERS.map((filter) => {
                    const isActive = activeCategories.includes(filter.id)
                    return (
                        <motion.button
                            key={filter.id}
                            variants={item}
                            onClick={() => handleToggle(filter.id)}
                            className={`flex-shrink-0 flex items-center gap-2 px-5 py-2.5 rounded-full text-[14px] font-medium transition-all duration-300 active:scale-95 border ${
                                isActive
                                    ? isDark
                                        ? `${filter.activeBg} ${filter.activeBorder} text-white shadow-lg`
                                        : `${filter.activeBg} ${filter.activeBorder} text-gray-900 shadow-md`
                                    : isDark
                                        ? 'bg-white/[0.03] text-white/70 border-white/[0.06] hover:bg-white/[0.08] hover:text-white'
                                        : 'bg-white text-gray-600 border-slate-200 shadow-[0_1px_2px_rgba(15,23,42,0.04)] hover:border-slate-300 hover:text-gray-900'
                            }`}
                        >
                            <filter.icon 
                                size={16} 
                                className={isActive ? (isDark ? 'text-white' : filter.color) : filter.color} 
                            />
                            <span>{t(filter.label)}</span>
                        </motion.button>
                    )
                })}
            </motion.div>
        </div>
    )
}

export default CategoryFilters
