import React from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import MapTab from '@/features/dashboard/components/MapTab'
import LocationListItem from './LocationListItem'

/**
 * ListViewSection
 *
 * Renders the list or map view of locations.
 * Handles both table/list display modes and interactive map mode.
 */
const ListViewSection = ({ filteredLocations, viewMode, onEditLocation, onDelete, onApprove, onReject, onToggleVisibility, openActionMenuId, onToggleActionMenu }) => {
    const renderTableView = (filtered) => (
        <div className="flex-1 flex flex-col">
            {/* Mobile Card List */}
            <div className="grid grid-cols-1 gap-4 lg:hidden p-5 pb-32">
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
                        <p className="text-xs font-black text-slate-400 uppercase tracking-[0.2em]">Нет объектов</p>
                    </div>
                )}
            </div>

            {/* Desktop Table View */}
            <div className="hidden lg:block overflow-x-auto custom-scrollbar font-black leading-none">
                <table className="w-full text-left border-collapse min-w-[1000px]">
                    <thead>
                        <tr className="bg-slate-50/50 dark:bg-[hsl(220,20%,6%)]/50 border-b border-slate-50 dark:border-white/[0.06]/50">
                            <th className="px-6 py-5 text-[10px] font-black uppercase text-slate-400 dark:text-[hsl(220,10%,55%)] tracking-[0.2em] pl-10 lg:pl-12">Объект</th>
                            <th className="px-6 py-5 text-[10px] font-black uppercase text-slate-400 dark:text-[hsl(220,10%,55%)] tracking-[0.2em]">Локация</th>
                            <th className="px-6 py-5 text-[10px] font-black uppercase text-slate-400 dark:text-[hsl(220,10%,55%)] tracking-[0.2em]">Рейтинг</th>
                            <th className="px-6 py-5 text-[10px] font-black uppercase text-slate-400 dark:text-[hsl(220,10%,55%)] tracking-[0.2em]">Статус</th>
                            <th className="px-6 py-5 text-right pr-10 lg:pr-12"></th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50 dark:divide-slate-800/50">
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
                                <td colSpan="5" className="text-center py-32">
                                    <p className="text-[11px] font-black text-slate-300 dark:text-[hsl(220,10%,35%)] uppercase tracking-[0.3em]">
                                        Нет объектов для отображения
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
