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
                    <p className="text-micro font-black uppercase tracking-[0.2em] text-primary/80 mb-2 leading-none">
                        {eyebrow}
                    </p>
                )}
                <div className="flex items-center gap-3 flex-wrap">
                    {Icon && <Icon className="w-7 h-7 text-primary/60" />}
                    <h1 className="text-h1 text-t-primary leading-none tracking-tight">
                        {title}
                    </h1>
                    {badge && (
                        <span className={cn(
                            'inline-flex items-center px-2.5 py-1 rounded-image text-micro font-bold uppercase tracking-widest leading-none',
                            badge.color ?? 'bg-secondary text-t-tertiary'
                        )}>
                            {badge.label}
                        </span>
                    )}
                </div>
                {subtitle && (
                    <p className="text-body-sm text-t-tertiary mt-1.5 leading-snug truncate max-w-lg">
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
    'inline-flex items-center gap-2 h-11 px-5 rounded-pill bg-primary hover:opacity-90 active:scale-95 text-white font-bold text-micro uppercase tracking-widest shadow-xl shadow-primary/20 transition-all'

export const adminBtnSecondary =
    'inline-flex items-center gap-2 h-11 px-4 rounded-pill bg-secondary border border-border text-t-secondary hover:opacity-80 active:scale-95 font-bold text-micro uppercase tracking-widest shadow-sm transition-all'
