import React from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useTranslation } from 'react-i18next'
import MapTab from '@/features/dashboard/components/MapTab'
import LocationListItem from './LocationListItem'

/**
 * ListViewSection
 *
 * Renders the list or map view of locations.
 * Handles both table/list display modes and interactive map mode.
 */
const ListViewSection = ({ filteredLocations, viewMode, onEditLocation, onDelete, onApprove, onReject, onToggleVisibility, openActionMenuId, onToggleActionMenu }) => {
    const { t } = useTranslation()

    const renderTableView = (filtered) => (
        <div className="flex-1 flex flex-col">
            {/* Mobile Card List */}
            <div className="grid grid-cols-1 gap-3 lg:hidden p-4 pb-32">
                {filtered && filtered.length > 0 ? (
                    filtered.map((loc) => (
                        <LocationListItem
                            key={loc.id}
                            loc={loc}
                            onEdit={() => onEditLocation(loc)}
                            onApprove={onApprove}
                            onReject={onReject}
                            onToggleVisibility={onToggleVisibility}
                            onDelete={onDelete}
                            isOpenActionMenu={openActionMenuId === loc.id}
                            onToggleActionMenu={(id) => onToggleActionMenu(id)}
                            viewMode="card"
                        />
                    ))
                ) : (
                    <div className="text-center py-20 bg-slate-50/50 dark:bg-[hsl(220,20%,9%)]/20 rounded-[32px] border border-dashed border-slate-200 dark:border-white/[0.06]">
                        <p className="text-micro font-black text-t-tertiary uppercase tracking-[0.2em]">{t('admin.table.no_objects')}</p>
                    </div>
                )}
            </div>

            {/* Desktop Table View — compact Excel-style */}
            <div className="hidden lg:block overflow-x-auto custom-scrollbar">
                <table className="w-full text-left border-collapse min-w-[900px]">
                    <thead>
                        <tr className="bg-slate-50 dark:bg-[hsl(220,20%,6%)] border-b border-slate-200 dark:border-white/[0.06] sticky top-0 z-10">
                            <th className="px-4 py-3 text-[10px] font-bold uppercase text-slate-500 dark:text-slate-400 tracking-wider w-[30%]">{t('admin.table.object')}</th>
                            <th className="px-4 py-3 text-[10px] font-bold uppercase text-slate-500 dark:text-slate-400 tracking-wider w-[15%]">{t('admin.table.location')}</th>
                            <th className="px-4 py-3 text-[10px] font-bold uppercase text-slate-500 dark:text-slate-400 tracking-wider w-[10%]">{t('admin.table.rating')}</th>
                            <th className="px-4 py-3 text-[10px] font-bold uppercase text-slate-500 dark:text-slate-400 tracking-wider w-[10%]">Price</th>
                            <th className="px-4 py-3 text-[10px] font-bold uppercase text-slate-500 dark:text-slate-400 tracking-wider w-[15%]">{t('admin.table.status')}</th>
                            <th className="px-4 py-3 text-right w-[5%]"></th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-white/[0.04]">
                        {filtered && filtered.length > 0 ? (
                            filtered.map((loc) => (
                                <LocationListItem
                                    key={loc.id}
                                    loc={loc}
                                    onEdit={() => onEditLocation(loc)}
                                    onApprove={onApprove}
                                    onReject={onReject}
                                    onToggleVisibility={onToggleVisibility}
                                    onDelete={onDelete}
                                    isOpenActionMenu={openActionMenuId === loc.id}
                                    onToggleActionMenu={(id) => onToggleActionMenu(id)}
                                    viewMode="table"
                                />
                            ))
                        ) : (
                            <tr>
                                <td colSpan="6" className="text-center py-20">
                                    <p className="text-micro font-black text-t-quaternary uppercase tracking-[0.3em]">
                                        {t('admin.table.no_objects_to_display')}
                                    </p>
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    )

    return (
        <AnimatePresence mode="wait">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} key={viewMode}>
                {viewMode === 'list' ? (
                    renderTableView(filteredLocations)
                ) : (
                    <div className="h-[600px] w-full p-4 lg:p-10">
                        <MapTab />
                    </div>
                )}
            </motion.div>
        </AnimatePresence>
    )
}

export default ListViewSection
