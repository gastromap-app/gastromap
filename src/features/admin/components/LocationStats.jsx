import React from 'react'
import { MapPin, Clock, Zap } from 'lucide-react'
import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'

/**
 * Компонент статистики локаций для AdminLocationsPage
 * @param {Object} props
 * @param {Array} props.locationsList - Список всех локаций
 * @param {Array} props.pendingLocations - Список локаций в очереди
 */
const LocationStats = ({ locationsList = [], pendingLocations = [] }) => {
    const stats = [
        { 
            label: 'Всего объектов', 
            val: locationsList.length.toLocaleString(), 
            icon: MapPin, 
            color: 'text-indigo-600', 
            bg: 'bg-indigo-50 dark:bg-indigo-500/10' 
        },
        { 
            label: 'На модерации', 
            val: pendingLocations.length.toLocaleString(), 
            icon: Clock, 
            color: 'text-amber-500', 
            bg: 'bg-amber-50 dark:bg-amber-500/10' 
        },
        { 
            label: 'Активные точки', 
            val: locationsList.filter(l => l.status === 'approved' || l.status === 'active').length.toLocaleString(), 
            icon: Zap, 
            color: 'text-emerald-500', 
            bg: 'bg-emerald-50 dark:bg-emerald-500/10' 
        },
    ]

    return (
        <div className="grid grid-cols-3 gap-3 lg:gap-6">
            {stats.map((s, i) => (
                <motion.div 
                    initial={{ opacity: 0, y: 10 }} 
                    animate={{ opacity: 1, y: 0 }} 
                    transition={{ delay: i * 0.1, duration: 0.4 }} 
                    key={i} 
                    className="bg-white dark:bg-[hsl(220,20%,6%)]/40 p-4 lg:p-6 rounded-[32px] border border-slate-100 dark:border-white/[0.06]/50 shadow-sm flex flex-col sm:flex-row items-center gap-3 lg:gap-5 group hover:border-indigo-500/20 transition-all relative overflow-hidden"
                >
                    <div className={cn(
                        "w-10 h-10 lg:w-14 lg:h-14 rounded-2xl flex items-center justify-center shrink-0 shadow-inner overflow-hidden relative transition-transform group-hover:scale-105", 
                        s.bg, s.color
                    )}>
                        <s.icon size={20} className="lg:w-6 lg:h-6 stroke-[2.5]" />
                    </div>
                    <div className="text-center sm:text-left min-w-0">
                        <p className="text-[9px] lg:text-[10px] font-black uppercase text-slate-400 dark:text-[hsl(220,10%,55%)] tracking-[0.15em] mb-1 leading-none">{s.label}</p>
                        <p className="text-lg lg:text-2xl font-black text-slate-900 dark:text-white leading-none tracking-tight truncate">{s.val}</p>
                    </div>
                    <div className="absolute top-0 right-0 p-2 opacity-5">
                        <s.icon size={48} className={s.color} />
                    </div>
                </motion.div>
            ))}
        </div>
    )
}

export default LocationStats
