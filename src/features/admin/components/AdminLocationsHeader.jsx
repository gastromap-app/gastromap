import React from 'react'
import { Plus, Download, Upload, Sparkles } from 'lucide-react'

/**
 * AdminLocationsHeader
 *
 * Toolbar/header section for the admin locations page.
 * Contains action buttons for creating, importing, exporting locations,
 * and bulk AI operations.
 */
const AdminLocationsHeader = ({
    onCreateNew,
    onImport,
    onExport,
    onBulkReindex,
    isBulkReindexPending,
    isExporting,
}) => {
    return (
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 p-6 lg:p-10 border-b border-slate-100 dark:border-slate-800/50">
            <h1 className="text-2xl lg:text-4xl font-black text-slate-900 dark:text-white leading-none">
                Locations
            </h1>

            <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
                <button
                    onClick={onCreateNew}
                    className="flex items-center justify-center gap-2 px-6 py-3.5 bg-indigo-600 text-white rounded-[20px] font-bold text-[10px] uppercase tracking-widest active:scale-95 transition-all shrink-0"
                >
                    <Plus size={14} /> Новый объект
                </button>

                <button
                    onClick={onImport}
                    className="flex items-center justify-center gap-2 px-6 py-3.5 bg-white dark:bg-slate-800 text-slate-900 dark:text-white rounded-[20px] font-bold text-[10px] uppercase tracking-widest border border-slate-100 dark:border-slate-700 active:scale-95 transition-all shrink-0"
                >
                    <Upload size={14} /> Импорт
                </button>

                <button
                    onClick={onExport}
                    disabled={isExporting}
                    className="flex items-center justify-center gap-2 px-6 py-3.5 bg-white dark:bg-slate-800 text-slate-900 dark:text-white rounded-[20px] font-bold text-[10px] uppercase tracking-widest border border-slate-100 dark:border-slate-700 active:scale-95 transition-all shrink-0 disabled:opacity-50"
                >
                    <Download size={14} /> {isExporting ? 'Экспорт...' : 'Экспорт'}
                </button>

                <button
                    onClick={onBulkReindex}
                    disabled={isBulkReindexPending}
                    className="flex items-center justify-center gap-2 px-6 py-3.5 bg-white dark:bg-slate-800 text-slate-900 dark:text-white rounded-[20px] font-bold text-[10px] uppercase tracking-widest border border-slate-100 dark:border-slate-700 active:scale-95 transition-all shrink-0 disabled:opacity-50"
                >
                    {isBulkReindexPending ? 'AI...' : <Sparkles size={14} />}
                </button>
            </div>
        </div>
    )
}

export default AdminLocationsHeader
