import React from 'react'
import { MapPin, Globe, Star, TrendingUp } from 'lucide-react'
import { motion } from 'framer-motion'
import { useTranslation } from 'react-i18next'

const StatsWidget = ({ isDark, locationsCount, countriesCount, favoritesCount }) => {
    const { t } = useTranslation()

    const stats = [
        {
            label: t('dashboard.stats_locations', 'Места'),
            value: locationsCount,
            icon: MapPin,
            color: 'text-blue-500',
            bg: 'bg-blue-500/10'
        },
        {
            label: t('dashboard.stats_countries', 'Страны'),
            value: countriesCount,
            icon: Globe,
            color: 'text-emerald-500',
            bg: 'bg-emerald-500/10'
        },
        {
            label: t('dashboard.stats_favorites', 'Избранное'),
            value: favoritesCount,
            icon: Star,
            color: 'text-amber-500',
            bg: 'bg-amber-500/10'
        }
    ]

    return (
        <div className="grid grid-cols-3 gap-3">
            {stats.map((stat, i) => (
                <motion.div
                    key={i}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 + i * 0.1 }}
                    className={`p-3 rounded-[24px] flex flex-col items-center justify-center text-center border transition-all ${
                        isDark 
                            ? 'bg-white/[0.03] border-white/[0.06] hover:bg-white/[0.06]' 
                            : 'bg-slate-50/50 border-slate-100 hover:bg-slate-50'
                    }`}
                >
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center mb-1.5 ${stat.bg}`}>
                        <stat.icon size={14} className={stat.color} />
                    </div>
                    <span className="text-[16px] font-black leading-none block">
                        {stat.value}
                    </span>
                    <span className={`text-[9px] font-bold uppercase tracking-wider mt-1 ${
                        isDark ? 'text-white/40' : 'text-slate-400'
                    }`}>
                        {stat.label}
                    </span>
                </motion.div>
            ))}
        </div>
    )
}

export default StatsWidget
