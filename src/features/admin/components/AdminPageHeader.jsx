import React from 'react'
import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'

/**
 * AdminPageHeader — универсальный заголовок для admin-вкладок.
 *
 * Props:
 *   eyebrow?    — маленький надписьный текст над title (напр. "Admin")
 *   title       — главный заголовок
 *   subtitle?   — вторая строка / описание
 *   badge?      — { label, color? } — плашка справа от title
 *   actions?    — ReactNode — кнопки / доп. элементы (правая часть)
 *   className?  — доп. классы для обёртки
 */
export default function AdminPageHeader({
    eyebrow,
    title,
    subtitle,
    badge,
    actions,
    className,
    icon: Icon,
}) {
    return (
        <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25, ease: [0.25, 0.1, 0.25, 1] }}
            className={cn(
                'flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-6 lg:pb-8',
                className
            )}
        >
            {/* Left: text */}
            <div className="min-w-0">
                {eyebrow && (
                    <p className="text-xs font-black uppercase tracking-[0.2em] text-indigo-500/80 dark:text-indigo-400/80 mb-2 leading-none">
                        {eyebrow}
                    </p>
                )}
                <div className="flex items-center gap-3 flex-wrap">
                    {Icon && <Icon className="w-7 h-7 text-indigo-400" />}
                    <h1 className="text-xl lg:text-[28px] font-bold text-slate-900 dark:text-white leading-none tracking-tight">
                        {title}
                    </h1>
                    {badge && (
                        <span className={cn(
                            'inline-flex items-center px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-widest leading-none',
                            badge.color ?? 'bg-slate-100 dark:bg-[hsl(220,20%,9%)] text-slate-500 dark:text-[hsl(220,10%,55%)]'
                        )}>
                            {badge.label}
                        </span>
                    )}
                </div>
                {subtitle && (
                    <p className="text-slate-400 dark:text-[hsl(220,10%,55%)] font-medium mt-1.5 text-xs lg:text-sm leading-snug truncate max-w-lg">
                        {subtitle}
                    </p>
                )}
            </div>

            {/* Right: actions */}
            {actions && (
                <div className="flex items-center gap-2 shrink-0 flex-wrap">
                    {actions}
                </div>
            )}
        </motion.div>
    )
}

/** Preset button styles для использования в actions */
export const adminBtnPrimary =
    'inline-flex items-center gap-2 h-11 px-5 rounded-2xl bg-indigo-600 hover:bg-indigo-500 active:scale-95 text-white font-bold text-xs uppercase tracking-widest shadow-xl shadow-indigo-500/20 transition-all'

export const adminBtnSecondary =
    'inline-flex items-center gap-2 h-11 px-4 rounded-2xl bg-white dark:bg-[hsl(220,20%,6%)]/60 border border-slate-200 dark:border-white/[0.04] text-slate-700 dark:text-[hsl(220,10%,55%)] hover:border-slate-300 dark:hover:border-slate-600 active:scale-95 font-bold text-xs uppercase tracking-widest shadow-sm backdrop-blur-md transition-all'
