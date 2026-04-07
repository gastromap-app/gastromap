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
const ListViewSection = ({ filteredLocations, viewMode, onEditLocation, onDelete, onApprove, onReject, openActionMenuId, onToggleActionMenu }) => {
    const renderTableView = (filtered) => (
        <div className="overflow-x-auto custom-scrollbar">
            <table className="w-full text-left border-collapse min-w-[800px]">
                <thead>
                    <tr className="bg-slate-50/50 dark:bg-slate-900/50">
                        <th className="px-6 py-4 text-[10px] font-bold uppercase text-slate-400 dark:text-slate-500 tracking-widest pl-8 lg:pl-10">Объект</th>
                        <th className="px-6 py-4 text-[10px] font-bold uppercase text-slate-400 dark:text-slate-500 tracking-widest">Локация</th>
                        <th className="px-6 py-4 text-[10px] font-bold uppercase text-slate-400 dark:text-slate-500 tracking-widest">Рейтинг</th>
                        <th className="px-6 py-4 text-[10px] font-bold uppercase text-slate-400 dark:text-slate-500 tracking-widest">Статус</th>
                        <th className="px-6 py-4 text-right pr-8 lg:pr-10"></th>
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
                                onDelete={onDelete}
                                isOpenActionMenu={openActionMenuId === loc.id}
                                onToggleActionMenu={(id) => onToggleActionMenu(id)}
                            />
                        ))
                    ) : (
                        <tr>
                            <td colSpan="5" className="text-center py-20">
                                <p className="text-lg font-bold text-slate-400">
                                    Нет объектов для отображения
                                </p>
                            </td>
                        </tr>
                    )}
                </tbody>
            </table>
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
