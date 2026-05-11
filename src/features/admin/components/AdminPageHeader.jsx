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
                    <p className="text-xs font-light uppercase tracking-[0.25em] text-primary/60 mb-2 leading-none">
                        {eyebrow}
                    </p>
                )}
                <div className="flex items-center gap-3 flex-wrap">
                    {Icon && <Icon className="w-6 h-6 text-primary/50" strokeWidth={1.5} />}
                    <h1 className="text-2xl md:text-3xl font-light tracking-tight text-t-primary leading-none">
                        {title}
                    </h1>
                    {badge && (
                        <span className={cn(
                            'inline-flex items-center px-2.5 py-1 rounded-image text-micro font-medium uppercase tracking-widest leading-none',
                            badge.color ?? 'bg-secondary text-t-tertiary'
                        )}>
                            {badge.label}
                        </span>
                    )}
                </div>
                {subtitle && (
                    <p className="text-body-sm text-t-tertiary mt-2 leading-relaxed font-light truncate max-w-lg">
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
    'inline-flex items-center gap-2 h-11 px-5 rounded-pill bg-primary hover:opacity-90 active:scale-95 text-white font-medium text-xs uppercase tracking-wider shadow-lg shadow-primary/15 transition-all'

export const adminBtnSecondary =
    'inline-flex items-center gap-2 h-11 px-4 rounded-pill bg-secondary border border-border text-t-secondary hover:opacity-80 active:scale-95 font-medium text-xs uppercase tracking-wider shadow-sm transition-all'
