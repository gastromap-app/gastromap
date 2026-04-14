import React, { useState, useRef } from 'react'
import { Plus, Download, Upload, Sparkles, ChevronDown } from 'lucide-react'

/**
 * AdminLocationsHeader
 * Compact header matching the style of other admin pages.
 * On mobile: action buttons collapse into a "More" dropdown.
 */
const AdminLocationsHeader = ({
    onCreateNew,
    onImport,
    onExport,
    onBulkReindex,
    isBulkReindexPending,
    isExporting,
}) => {
    const [menuOpen, setMenuOpen] = useState(false)
    const menuRef = useRef(null)

    // Close on outside click
    const handleBlur = (e) => {
        if (!menuRef.current?.contains(e.relatedTarget)) setMenuOpen(false)
    }

    const btnBase = "flex items-center gap-1.5 h-9 px-3.5 rounded-[14px] font-bold text-[10px] uppercase tracking-widest transition-all active:scale-95 shrink-0"
    const btnSecondary = `${btnBase} bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700/50 text-slate-700 dark:text-slate-300 hover:border-slate-300 dark:hover:border-slate-600 shadow-sm`

    return (
        <div className="flex justify-between items-center p-5 lg:p-8 border-b border-slate-100 dark:border-slate-800/50 gap-3">
            {/* Title */}
            <div>
                <p className="text-[9px] font-bold uppercase text-slate-400 dark:text-slate-500 tracking-widest mb-0.5">Admin</p>
                <h1 className="text-xl lg:text-2xl font-bold text-slate-900 dark:text-white leading-none tracking-tight">
                    Locations
                </h1>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2">
                {/* Primary CTA — always visible */}
                <button
                    onClick={onCreateNew}
                    className={`${btnBase} bg-indigo-600 hover:bg-indigo-500 text-white shadow-sm shadow-indigo-500/20`}
                >
                    <Plus size={13} />
                    <span className="hidden sm:inline">Новый</span>
                </button>

                {/* Desktop: individual buttons */}
                <div className="hidden sm:flex items-center gap-2">
                    <button onClick={onImport} className={btnSecondary}>
                        <Upload size={13} /> Импорт
                    </button>
                    <button onClick={onExport} disabled={isExporting} className={`${btnSecondary} disabled:opacity-40`}>
                        <Download size={13} /> {isExporting ? '...' : 'Экспорт'}
                    </button>
                    <button
                        onClick={onBulkReindex}
                        disabled={isBulkReindexPending}
                        title="AI Bulk Reindex"
                        className={`${btnSecondary} disabled:opacity-40`}
                    >
                        {isBulkReindexPending
                            ? <span className="animate-spin inline-block w-3 h-3 border-2 border-indigo-400 border-t-transparent rounded-full" />
                            : <Sparkles size={13} className="text-indigo-500" />}
                        <span>AI</span>
                    </button>
                </div>

                {/* Mobile: dropdown "More" */}
                <div className="relative sm:hidden" ref={menuRef} onBlur={handleBlur}>
                    <button
                        onClick={() => setMenuOpen(v => !v)}
                        className={btnSecondary}
                    >
                        <ChevronDown size={13} className={`transition-transform ${menuOpen ? 'rotate-180' : ''}`} />
                        Ещё
                    </button>

                    {menuOpen && (
                        <div className="absolute right-0 top-full mt-2 z-50 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-700 rounded-[18px] shadow-xl overflow-hidden min-w-[160px]">
                            {[
                                { label: 'Импорт', icon: Upload, action: onImport },
                                { label: isExporting ? 'Экспорт...' : 'Экспорт', icon: Download, action: onExport, disabled: isExporting },
                                { label: isBulkReindexPending ? 'AI...' : 'AI Reindex', icon: Sparkles, action: onBulkReindex, disabled: isBulkReindexPending },
                            ].map(({ label, icon: Icon, action, disabled }) => (
                                <button
                                    key={label}
                                    onClick={() => { action?.(); setMenuOpen(false) }}
                                    disabled={disabled}
                                    className="w-full flex items-center gap-3 px-4 py-3 text-[12px] font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors disabled:opacity-40 first:pt-3.5 last:pb-3.5"
                                >
                                    <Icon size={14} className="text-slate-400" />
                                    {label}
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}

export default AdminLocationsHeader
