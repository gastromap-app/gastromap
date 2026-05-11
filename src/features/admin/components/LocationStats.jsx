import React from 'react'
import { MapPin, Clock, Zap } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useTranslation } from 'react-i18next'

/**
 * Компонент статистики локаций для AdminLocationsPage
 */
const LocationStats = ({ locationsList = [], pendingLocations = [] }) => {
    const { t } = useTranslation()

    const stats = [
        { 
            label: t('admin.stats.total_objects'), 
            val: locationsList.length.toLocaleString(), 
            icon: MapPin, 
            color: 'text-orange-500', 
            bg: 'bg-orange-50 dark:bg-orange-500/10' 
        },
        { 
            label: t('admin.stats.pending_moderation'), 
            val: pendingLocations.length.toLocaleString(), 
            icon: Clock, 
            color: 'text-amber-500', 
            bg: 'bg-amber-50 dark:bg-amber-500/10' 
        },
        { 
            label: t('admin.stats.active_points'), 
            val: locationsList.filter(l => l.status === 'approved' || l.status === 'active').length.toLocaleString(), 
            icon: Zap, 
            color: 'text-emerald-500', 
            bg: 'bg-emerald-50 dark:bg-emerald-500/10' 
        },
    ]

    return (
        <div className="grid grid-cols-3 gap-3 lg:gap-4">
            {stats.map((s, i) => (
                <div 
                    key={i} 
                    className="bg-white dark:bg-white/[0.03] p-3 lg:p-5 rounded-2xl border border-slate-100 dark:border-white/[0.04] flex items-center gap-3 lg:gap-4 hover:border-slate-200 dark:hover:border-white/[0.08] transition-all"
                >
                    <div className={cn(
                        "w-10 h-10 lg:w-12 lg:h-12 rounded-xl flex items-center justify-center shrink-0", 
                        s.bg, s.color
                    )}>
                        <s.icon size={18} className="lg:w-5 lg:h-5" strokeWidth={1.5} />
                    </div>
                    <div className="min-w-0">
                        <p className="text-[10px] font-medium uppercase text-slate-400 tracking-wider mb-1 leading-none">{s.label}</p>
                        <p className="text-xl lg:text-2xl font-light text-slate-900 dark:text-white leading-none tracking-tight truncate">{s.val}</p>
                    </div>
                </div>
            ))}
        </div>
    )
}

export default LocationStats
