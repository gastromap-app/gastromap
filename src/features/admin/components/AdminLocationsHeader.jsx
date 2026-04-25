import { Menu, Transition } from '@headlessui/react'
import { Plus, Download, Upload, Sparkles, ChevronDown, Search, X, MoreVertical } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { useState, useEffect, useRef, Fragment } from 'react'
import { cn } from '@/lib/utils'

/**
 * AdminLocationsHeader
 * Compact header matching the style of other admin pages.
 * On mobile: action buttons collapse into a "More" dropdown.
 * Includes an expanding search bar for mobile-friendly search experience.
 */
const AdminLocationsHeader = ({
    onCreateNew,
    onImport,
    onExport,
    onBulkReindex,
    isBulkReindexPending,
    isExporting,
    searchQuery = '',
    onSearchChange
}) => {
    const [isSearchExpanded, setIsSearchExpanded] = useState(false)
    const searchInputRef = useRef(null)

    useEffect(() => {
        if (isSearchExpanded && searchInputRef.current) {
            searchInputRef.current.focus()
        }
    }, [isSearchExpanded])

    const btnBase = "flex items-center gap-2 h-11 px-4 rounded-2xl font-bold text-xs uppercase tracking-widest transition-all active:scale-95 shrink-0"
    const btnSecondary = `${btnBase} bg-white dark:bg-[hsl(220,20%,6%)]/50 border border-slate-200 dark:border-white/[0.08]/50 text-slate-700 dark:text-[hsl(220,10%,55%)] hover:border-slate-300 dark:hover:border-slate-600 shadow-sm backdrop-blur-md`

    const actions = [
        { label: 'Импорт данных', icon: Upload, onClick: onImport },
        { label: isExporting ? 'Экспорт...' : 'Экспорт данных', icon: Download, onClick: onExport, disabled: isExporting },
        { label: isBulkReindexPending ? 'AI...' : 'AI Reindex', icon: Sparkles, onClick: onBulkReindex, disabled: isBulkReindexPending },
    ]

    return (
        <div className="flex justify-between items-center p-4 lg:p-8 border-b border-slate-100 dark:border-white/[0.06]/50 gap-3 relative min-h-[80px] lg:min-h-[auto]">
            <AnimatePresence>
                {isSearchExpanded ? (
                    <motion.div 
                        initial={{ width: 40, opacity: 0 }}
                        animate={{ width: '100%', opacity: 1 }}
                        exit={{ width: 40, opacity: 0 }}
                        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                        className="absolute inset-y-0 left-0 right-0 z-50 bg-white dark:bg-[hsl(220,20%,3%)] flex items-center px-4 lg:px-8 gap-3"
                    >
                        <div className="flex-1 relative">
                            <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                            <input 
                                ref={searchInputRef}
                                type="text"
                                value={searchQuery}
                                onChange={(e) => onSearchChange?.(e.target.value)}
                                placeholder="Поиск объектов..."
                                className="w-full h-11 pl-12 pr-10 bg-slate-100 dark:bg-[hsl(220,20%,6%)] border-none rounded-2xl text-sm font-bold outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all dark:text-white"
                            />
                            {searchQuery && (
                                <button 
                                    onClick={() => onSearchChange?.('')}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 text-slate-400 hover:text-slate-600"
                                >
                                    <X size={16} />
                                </button>
                            )}
                        </div>
                        <button 
                            onClick={() => setIsSearchExpanded(false)}
                            className="h-11 px-4 text-xs font-black uppercase tracking-widest text-slate-500 hover:text-indigo-600 transition-colors"
                        >
                            Отмена
                        </button>
                    </motion.div>
                ) : (
                    <>
                        {/* Title */}
                        <motion.div 
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            className="flex flex-col"
                        >
                            <p className="text-[11px] font-black uppercase text-indigo-500/80 dark:text-indigo-400/80 tracking-[0.25em] mb-1 leading-none">Admin</p>
                            <h1 className="text-2xl lg:text-3xl font-black text-slate-900 dark:text-white leading-none tracking-tighter">
                                Locations
                            </h1>
                        </motion.div>

                        {/* Actions */}
                        <div className="flex items-center gap-2">
                            {/* Search Toggle (Mobile/Desktop) */}
                            <button 
                                onClick={() => setIsSearchExpanded(true)}
                                className={cn(btnSecondary, "flex items-center justify-center !p-0 w-11 h-11")}
                                aria-label="Search"
                            >
                                <Search size={18} />
                            </button>

                            {/* Primary CTA — always visible */}
                            <button
                                onClick={onCreateNew}
                                className={`${btnBase} bg-indigo-600 hover:bg-indigo-500 text-white shadow-xl shadow-indigo-500/20 border border-indigo-500/50`}
                            >
                                <Plus size={18} />
                                <span className="hidden sm:inline ml-1">Новый</span>
                            </button>

                            {/* Desktop Actions */}
                            <div className="hidden sm:flex items-center gap-2">
                                {actions.map((action, idx) => (
                                    <button 
                                        key={idx}
                                        onClick={action.onClick}
                                        disabled={action.disabled}
                                        className={`${btnSecondary} disabled:opacity-40`}
                                    >
                                        <action.icon size={16} className={cn(action.icon === Sparkles && "text-indigo-500")} />
                                        <span className="hidden lg:inline ml-1">
                                            {action.icon === Sparkles && action.disabled ? '...' : action.label.split(' ')[0]}
                                        </span>
                                    </button>
                                ))}
                            </div>

                            {/* Mobile: Headless UI Menu */}
                            <Menu as="div" className="relative sm:hidden">
                                <Menu.Button className={btnSecondary}>
                                    <MoreVertical size={16} />
                                </Menu.Button>

                                <Transition
                                    as={Fragment}
                                    enter="transition ease-out duration-100"
                                    enterFrom="transform opacity-0 scale-95"
                                    enterTo="transform opacity-100 scale-100"
                                    leave="transition ease-in duration-75"
                                    leaveFrom="transform opacity-100 scale-100"
                                    leaveTo="transform opacity-0 scale-95"
                                >
                                    <Menu.Items className="absolute right-0 top-full mt-3 z-50 bg-white/95 dark:bg-[hsl(220,20%,6%)]/95 backdrop-blur-2xl border border-slate-100 dark:border-white/[0.06] rounded-[32px] shadow-2xl overflow-hidden min-w-[240px] p-2.5 focus:outline-none">
                                        <div className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-400 px-5 py-4 border-b border-slate-50 dark:border-white/[0.06]/50 mb-1.5">Действия</div>
                                        {actions.map((action, idx) => (
                                            <Menu.Item key={idx}>
                                                {({ active }) => (
                                                    <button
                                                        onClick={action.onClick}
                                                        disabled={action.disabled}
                                                        className={cn(
                                                            "w-full flex items-center gap-3.5 px-4 py-3.5 text-xs font-bold rounded-2xl transition-all active:scale-[0.98] disabled:opacity-40",
                                                            active ? "bg-indigo-600 text-white shadow-lg shadow-indigo-500/20" : "text-slate-700 dark:text-[hsl(220,10%,55%)] hover:bg-slate-50 dark:hover:bg-[hsl(220,20%,12%)]"
                                                        )}
                                                    >
                                                        <div className={cn(
                                                            "w-9 h-9 rounded-xl flex items-center justify-center shrink-0 transition-colors",
                                                            active ? "bg-white/20" : "bg-slate-100 dark:bg-[hsl(220,20%,9%)]"
                                                        )}>
                                                            <action.icon size={16} className={cn(active ? "text-white" : "text-slate-500")} />
                                                        </div>
                                                        <span className="flex-1 text-left tracking-tight">{action.label}</span>
                                                    </button>
                                                )}
                                            </Menu.Item>
                                        ))}
                                    </Menu.Items>
                                </Transition>
                            </Menu>
                        </div>
                    </>
                )}
            </AnimatePresence>
        </div>
    )
}

export default AdminLocationsHeader
