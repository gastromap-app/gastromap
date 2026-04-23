import React, { useState, useRef, useEffect } from 'react'
import { useI18n } from '@/hooks/useI18n'
import { Globe, Check, ChevronDown, RefreshCw } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

/**
 * LanguageSelector - Supports dropdown and menu-item (cyclic) styles.
 */
export function LanguageSelector({ 
    isAdminMode = false, 
    className = '', 
    isDark: propIsDark, 
    onLanguageChange,
    variant = 'dropdown' // 'dropdown' | 'menuItem'
}) {
    const { 
        language, 
        setLanguage, 
        getAvailableLanguages 
    } = useI18n('common', isAdminMode)

    const [isOpen, setIsOpen] = useState(false)
    const containerRef = useRef(null)

    const languages = [
        { code: 'en', label: 'English', flag: '🇬🇧' },
        { code: 'ru', label: 'Русский', flag: '🇷🇺' },
        { code: 'pl', label: 'Polski', flag: '🇵🇱' },
        { code: 'ua', label: 'Українська', flag: '🇺🇦' }
    ].filter(lang => getAvailableLanguages().includes(lang.code))

    const currentIdx = languages.findIndex(l => l.code === language)
    const currentLang = languages[currentIdx] || languages[0]

    // Determine theme context
    const isDark = propIsDark ?? (typeof document !== 'undefined' && document.documentElement.getAttribute('data-theme') === 'dark')

    useEffect(() => {
        if (variant !== 'dropdown') return
        const handleClickOutside = (event) => {
            if (containerRef.current && !containerRef.current.contains(event.target)) {
                setIsOpen(false)
            }
        }
        document.addEventListener('mousedown', handleClickOutside)
        return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [variant])

    const handleSelect = (code) => {
        setLanguage(code)
        setIsOpen(false)
        if (onLanguageChange) {
            onLanguageChange(code)
        }
    }

    const handleCycle = () => {
        const nextIdx = (currentIdx + 1) % languages.length
        const nextLang = languages[nextIdx]
        setLanguage(nextLang.code)
        if (onLanguageChange) {
            onLanguageChange(nextLang.code)
        }
    }

    if (isAdminMode) {
        return (
            <div className={`flex items-center gap-3 px-4 py-3 ${className}`}>
                <span className="text-lg">🇷🇺</span>
                <span className={`text-sm font-semibold ${isDark ? 'text-white/80' : 'text-gray-900'}`}>Русский</span>
            </div>
        )
    }

    // --- MENU ITEM VARIANT (Cyclic) ---
    if (variant === 'menuItem') {
        return (
            <button
                onClick={handleCycle}
                className={`w-full min-h-11 flex items-center gap-3 px-4 py-3 text-sm font-semibold transition-all active:scale-[0.98] group relative ${
                    isDark ? 'text-white hover:bg-white/10' : 'text-gray-900 hover:bg-gray-100'
                } ${className}`}
            >
                <div className="w-5 h-5 flex items-center justify-center text-lg">
                    <AnimatePresence mode="wait">
                        <motion.span
                            key={currentLang.code}
                            initial={{ y: 5, opacity: 0 }}
                            animate={{ y: 0, opacity: 1 }}
                            exit={{ y: -5, opacity: 0 }}
                            transition={{ duration: 0.15 }}
                        >
                            {currentLang.flag}
                        </motion.span>
                    </AnimatePresence>
                </div>

                <div className="flex-1 text-left">
                    <AnimatePresence mode="wait">
                        <motion.span
                            key={currentLang.code}
                            initial={{ x: 5, opacity: 0 }}
                            animate={{ x: 0, opacity: 1 }}
                            exit={{ x: -5, opacity: 0 }}
                            transition={{ duration: 0.15 }}
                            className="block"
                        >
                            {currentLang.label}
                        </motion.span>
                    </AnimatePresence>
                </div>

                <RefreshCw 
                    size={16} 
                    className={`transition-all duration-500 group-hover:rotate-180 ${
                        isDark ? 'text-white/20 group-hover:text-blue-400' : 'text-gray-400 group-hover:text-blue-600'
                    }`} 
                />
            </button>
        )
    }

    // --- DROPDOWN VARIANT ---
    return (
        <div className={`relative ${className}`} ref={containerRef}>
            <button
                onClick={() => setIsOpen(!isOpen)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-full border transition-all active:scale-95 ${
                    isDark 
                        ? 'bg-white/5 border-white/10 text-white hover:bg-white/10' 
                        : 'bg-gray-100 border-gray-200 text-gray-900 hover:bg-gray-200'
                }`}
            >
                <span className="text-base">{currentLang.flag}</span>
                <span className="text-xs font-bold uppercase tracking-tight">{currentLang.code}</span>
                <ChevronDown size={14} className={`transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
            </button>

            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ opacity: 0, y: 10, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 10, scale: 0.95 }}
                        transition={{ duration: 0.2 }}
                        className="absolute right-0 mt-2 w-56 z-[110] language-container shadow-2xl"
                    >
                        <div className="py-1">
                            {languages.map((lang) => (
                                <div
                                    key={lang.code}
                                    onClick={() => handleSelect(lang.code)}
                                    className="language-item"
                                >
                                    <div className="flex items-center gap-3">
                                        <span className="text-lg">{lang.flag}</span>
                                        <span className={`language-name ${isDark ? 'text-white' : 'text-gray-900'}`}>
                                            {lang.label}
                                        </span>
                                    </div>
                                    {language === lang.code && (
                                        <div className="active-check">
                                            <Check size={14} strokeWidth={3} />
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    )
}

export default LanguageSelector
