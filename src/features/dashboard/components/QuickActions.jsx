import React from 'react'
import { Plus, Map, MessageSquare, Heart, Sparkles, Navigation } from 'lucide-react'
import { motion } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'

const QuickActions = ({ isDark }) => {
    const { t } = useTranslation()
    const navigate = useNavigate()

    const actions = [
        {
            id: 'add',
            label: t('dashboard.action_add_place', 'Добавить место'),
            icon: Plus,
            color: 'bg-blue-500',
            path: '/dashboard/add-place',
            gradient: 'from-blue-500 to-indigo-600'
        },
        {
            id: 'map',
            label: t('dashboard.action_my_map', 'Моя карта'),
            icon: Map,
            color: 'bg-emerald-500',
            path: '/map',
            gradient: 'from-emerald-500 to-teal-600'
        },
        {
            id: 'guide',
            label: t('dashboard.action_ai_guide', 'Gastro Guide'),
            icon: Sparkles,
            color: 'bg-purple-500',
            path: '/guide',
            gradient: 'from-purple-500 to-pink-600'
        },
        {
            id: 'feedback',
            label: t('dashboard.action_feedback', 'Отзывы'),
            icon: MessageSquare,
            color: 'bg-orange-500',
            path: '/reviews',
            gradient: 'from-orange-500 to-amber-600'
        }
    ]

    return (
        <div className="w-full">
            <div className="flex gap-3 overflow-x-auto pb-2 -mx-5 px-5 scrollbar-hide snap-x snap-mandatory md:grid md:grid-cols-4 md:mx-0 md:px-0">
                {actions.map((action, i) => (
                    <motion.button
                        key={action.id}
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: i * 0.05 }}
                        onClick={() => navigate(action.path)}
                        className={`flex-shrink-0 w-[140px] md:w-full h-[100px] rounded-[24px] p-4 flex flex-col justify-between items-start snap-center relative overflow-hidden group transition-all active:scale-[0.95] ${
                            isDark 
                                ? 'bg-white/[0.04] border border-white/[0.08] hover:bg-white/[0.08]' 
                                : 'bg-white border border-slate-200/60 shadow-sm hover:shadow-md'
                        }`}
                    >
                        {/* Background Gradient on Hover */}
                        <div className={`absolute inset-0 opacity-0 group-hover:opacity-10 bg-gradient-to-br ${action.gradient} transition-opacity`} />
                        
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                            isDark ? 'bg-white/[0.06]' : 'bg-slate-50'
                        }`}>
                            <action.icon size={20} className={isDark ? 'text-white' : 'text-slate-700'} />
                        </div>
                        
                        <span className={`text-[13px] font-bold tracking-tight ${isDark ? 'text-white/90' : 'text-slate-900'}`}>
                            {action.label}
                        </span>
                    </motion.button>
                ))}
            </div>
        </div>
    )
}

export default QuickActions
