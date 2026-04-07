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
            label: 'Всего', 
            val: locationsList.length.toString(), 
            icon: MapPin, 
            color: 'text-indigo-600', 
            bg: 'bg-indigo-50 dark:bg-indigo-500/10' 
        },
        { 
            label: 'В очереди', 
            val: pendingLocations.length.toString(), 
            icon: Clock, 
            color: 'text-orange-500', 
            bg: 'bg-orange-50 dark:bg-orange-500/10' 
        },
        { 
            label: 'Approved', 
            val: locationsList.filter(l => l.status === 'approved').length.toString(), 
            icon: Zap, 
            color: 'text-green-500', 
            bg: 'bg-green-50 dark:bg-green-500/10' 
        },
    ]

    return (
        <div className="grid grid-cols-3 gap-3 lg:gap-8">
            {stats.map((s, i) => (
                <motion.div 
                    initial={{ opacity: 0, scale: 0.95 }} 
                    animate={{ opacity: 1, scale: 1 }} 
                    transition={{ delay: i * 0.1 }} 
                    key={i} 
                    className="bg-white dark:bg-slate-900/50 p-4 lg:p-6 rounded-[28px] lg:rounded-[40px] border border-slate-100 dark:border-slate-800/50 shadow-sm flex flex-col sm:flex-row items-center gap-3 lg:gap-5 group hover:border-indigo-500/10 transition-all"
                >
                    <div className={cn("w-10 h-10 lg:w-14 lg:h-14 rounded-2xl flex items-center justify-center shrink-0 shadow-inner overflow-hidden relative", s.bg, s.color)}>
                        <s.icon size={20} className="lg:w-6 lg:h-6 group-hover:scale-110 transition-transform" />
                    </div>
                    <div className="text-center sm:text-left min-w-0">
                        <p className="text-[9px] lg:text-[10px] font-bold uppercase text-slate-400 dark:text-slate-500 tracking-widest mb-1">{s.label}</p>
                        <p className="text-sm lg:text-2xl font-bold text-slate-900 dark:text-white leading-none tracking-tight truncate">{s.val}</p>
                    </div>
                </motion.div>
            ))}
        </div>
    )
}

export default LocationStats
