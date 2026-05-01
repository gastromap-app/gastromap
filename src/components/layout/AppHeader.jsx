import React, { useState, useEffect } from 'react'
import { useTheme } from '@/hooks/useTheme'
import { useTranslation } from 'react-i18next'

/**
 * AppHeader - A reusable header component with scroll-aware glassmorphism effects.
 * Consistent with the main UniversalHeader design.
 */
export function AppHeader({ 
    title, 
    icon: Icon, 
    leftAction, 
    rightAction, 
    scrollRef, 
    isScrolled: manualIsScrolled,
    className = "",
    children
}) {
    const { t } = useTranslation()
    const { theme } = useTheme()
    const isDark = theme === 'dark'
    const [isScrolledInternal, setIsScrolledInternal] = useState(false)
    const isScrolled = manualIsScrolled !== undefined ? manualIsScrolled : isScrolledInternal

    // Listen to scroll if scrollRef is provided
    useEffect(() => {
        if (manualIsScrolled !== undefined) return

        const container = scrollRef?.current || window
        const handleScroll = () => {
            const scrollTop = scrollRef?.current ? scrollRef.current.scrollTop : window.scrollY
            setIsScrolledInternal(scrollTop > 20)
        }

        container.addEventListener('scroll', handleScroll)
        // Initial check
        handleScroll()
        
        return () => container.removeEventListener('scroll', handleScroll)
    }, [scrollRef, manualIsScrolled])

    const textStyle = isDark ? "text-[hsl(220,20%,96%)]" : "text-gray-900"
    
    const headerBgClass = isScrolled
        ? (isDark
            ? 'bg-[hsl(220,20%,3%)]/80 backdrop-blur-xl border-b border-white/[0.04]'
            : 'bg-white/75 backdrop-blur-xl border-b border-slate-200/60 shadow-sm')
        : 'bg-transparent'

    return (
        <header
            className={`sticky top-0 left-0 right-0 z-[100] transition-none ${className}`}
            style={{ paddingTop: 'env(safe-area-inset-top)' }}
        >
            {/* Background Layer */}
            <div
                className={`absolute inset-0 w-full h-full transition-all duration-500 pointer-events-none ${headerBgClass}`}
            />

            <div className="relative h-14 md:h-16 px-4 flex items-center justify-between">
                {/* Left side: Icon + Title or LeftAction */}
                <div className="flex items-center gap-3">
                    {leftAction ? leftAction : (
                        <>
                            {Icon && (
                                <div className={`w-9 h-9 md:w-10 md:h-10 rounded-2xl flex items-center justify-center text-white shadow-lg ${isScrolled ? 'scale-90' : 'scale-100'} transition-transform duration-300 bg-indigo-500 shadow-indigo-500/20`}>
                                    <Icon className="w-5 h-5 md:w-6 md:h-6" />
                                </div>
                            )}
                            <div className="flex flex-col">
                                <h3 className={`font-bold leading-none ${textStyle} ${isScrolled ? 'text-sm md:text-base' : 'text-base md:text-lg'} transition-all duration-300`}>
                                    {title}
                                </h3>
                                {!isScrolled && (
                                    <p className="text-[10px] uppercase tracking-wider font-bold text-indigo-500 dark:text-indigo-400 mt-1 animate-in fade-in slide-in-from-top-1">
                                        {t('header.concierge')}
                                    </p>
                                )}
                            </div>
                        </>
                    )}
                </div>

                {/* Center: Custom content if any */}
                <div className="flex-1 px-4">
                    {children}
                </div>

                {/* Right side: RightAction */}
                <div className="flex items-center gap-2">
                    {rightAction}
                </div>
            </div>
        </header>
    )
}
