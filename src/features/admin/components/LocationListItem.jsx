import React from 'react'
import { Building2, MapPin, Star, MoreHorizontal, Edit, Trash2, CheckCircle, X } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '@/lib/utils'

/**
 * LocationListItem.jsx
 * Компонент отображения отдельного элемента локации в списке
 * Лимит: 150 строк
 */

const LocationListItem = ({ 
    loc, 
    onEdit, 
    onApprove, 
    onReject, 
    onDelete,
    isOpenActionMenu,
    onToggleActionMenu 
}) => {
    return (
        <tr 
            onClick={() => onEdit(loc)} 
            className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-all group cursor-pointer border-none leading-none"
        >
            <td className="px-6 py-4 pl-8 lg:pl-10">
                <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400 group-hover:bg-indigo-600 group-hover:text-white transition-all shadow-inner shrink-0">
                        <Building2 size={18} />
                    </div>
                    <div className="min-w-0">
                        <p className="text-[13px] font-bold text-slate-900 dark:text-white truncate leading-tight">{loc.title}</p>
                        <div className="flex items-center gap-2 mt-1">
                            <p className="text-[10px] text-slate-400 dark:text-slate-500 uppercase tracking-widest font-black shrink-0">{loc.category}</p>
                            {/* WRONG FIELD FIX: cuisine_types → kg_cuisines (DB field name) */}
                            {(loc.kg_cuisines?.length > 0 || loc.cuisine) && (
                                <Badge variant="secondary" className="bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 text-[8px] h-4 px-1.5 font-black border-none uppercase tracking-widest shrink-0">
                                    {loc.kg_cuisines?.length > 0
                                        ? loc.kg_cuisines.slice(0,2).join(', ')
                                        : loc.cuisine}
                                </Badge>
                            )}
                        </div>
                    </div>
                </div>
            </td>
            <td className="px-6 py-4">
                <div className="text-[11px] font-bold flex items-center gap-1.5 text-slate-600 dark:text-slate-400">
                    <MapPin size={12} className="text-slate-300 dark:text-slate-600" />
                    <span>{loc.city}</span>
                    <span className="opacity-30">/</span>
                    <span className="opacity-60">{loc.country}</span>
                </div>
            </td>
            <td className="px-6 py-4">
                <div className="flex items-center gap-1">
                    <Star size={12} className={cn("fill-current", loc.rating > 0 ? "text-yellow-500" : "text-slate-200 dark:text-slate-800")} />
                    <span className="text-[11px] font-bold">{loc.rating > 0 ? loc.rating : '—'}</span>
                </div>
            </td>
            <td className="px-6 py-4">
                <div className={cn(
                    "inline-flex items-center p-1.5 rounded-lg text-[9px] font-bold uppercase tracking-wider",
                    (loc.status === 'approved' || loc.status === 'active') ? 'bg-green-50 dark:bg-green-500/5 text-green-600' :
                        loc.status === 'pending' ? 'bg-orange-50 dark:bg-orange-500/5 text-orange-600' : 'bg-rose-50 dark:bg-rose-500/5 text-rose-500'
                )}>
                    <div className={cn("w-1.5 h-1.5 rounded-full mr-2", 
                    (loc.status === 'approved' || loc.status === 'active') ? 'bg-green-50 dark:bg-green-500/5 text-green-600' :
                        loc.status === 'pending' ? 'bg-orange-500' : 'bg-rose-400')} 
                    />
                    {(loc.status === 'approved' || loc.status === 'active') ? 'Активен' : loc.status === 'pending' ? 'Ожидает' : 'Отклонён'}
                </div>
            </td>
            <td className="px-6 py-4 text-right pr-8 lg:pr-10 relative">
                <div className="flex items-center justify-end gap-2">
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            onToggleActionMenu(loc.id);
                        }}
                        className={cn(
                            "p-2 rounded-xl transition-all",
                            isOpenActionMenu ? "bg-indigo-600 text-white shadow-lg shadow-indigo-500/30" : "bg-slate-50 dark:bg-slate-800 text-slate-400 hover:text-indigo-600"
                        )}
                    >
                        <MoreHorizontal size={14} className="stroke-[2.5]" />
                    </button>

                    <AnimatePresence>
                        {isOpenActionMenu && (
                            <>
                                <div 
                                    className="fixed inset-0 z-40" 
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onToggleActionMenu(null);
                                    }}
                                />
                                <motion.div
                                    initial={{ opacity: 0, scale: 0.95, y: -10 }}
                                    animate={{ opacity: 1, scale: 1, y: 0 }}
                                    exit={{ opacity: 0, scale: 0.95, y: -10 }}
                                    onClick={(e) => e.stopPropagation()}
                                    className="absolute right-full mr-2 top-1/2 -translate-y-1/2 z-50 min-w-[200px] bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-100 dark:border-slate-800 p-2 overflow-hidden"
                                >
                                    <div className="text-[9px] font-black uppercase tracking-widest text-slate-400 px-3 py-2 border-b border-slate-50 dark:border-slate-800/50 mb-1 text-left">Действия</div>
                                    
                                    <button
                                        onClick={() => {
                                            onEdit(loc);
                                            onToggleActionMenu(null);
                                        }}
                                        className="w-full flex items-center gap-3 px-3 py-2.5 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-xl transition-colors group"
                                    >
                                        <div className="w-8 h-8 rounded-lg bg-indigo-50 dark:bg-indigo-500/10 flex items-center justify-center text-indigo-600 group-hover:scale-110 transition-transform">
                                            <Edit size={12} />
                                        </div>
                                        <span>Редактировать</span>
                                    </button>

                                    {loc.status === 'pending' && (
                                        <button
                                            onClick={() => {
                                                onApprove(loc.id);
                                                onToggleActionMenu(null);
                                            }}
                                            className="w-full flex items-center gap-3 px-3 py-2.5 text-xs font-bold text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-500/5 rounded-xl transition-colors group"
                                        >
                                            <div className="w-8 h-8 rounded-lg bg-emerald-50 dark:bg-emerald-500/10 flex items-center justify-center group-hover:scale-110 transition-transform">
                                                <CheckCircle size={12} />
                                            </div>
                                            <span>Одобрить</span>
                                        </button>
                                    )}

                                    {loc.status !== 'rejected' && (
                                        <button
                                            onClick={() => {
                                                onReject(loc.id);
                                                onToggleActionMenu(null);
                                            }}
                                            className="w-full flex items-center gap-3 px-3 py-2.5 text-xs font-bold text-orange-600 hover:bg-orange-50 dark:hover:bg-orange-500/5 rounded-xl transition-colors group"
                                        >
                                            <div className="w-8 h-8 rounded-lg bg-orange-50 dark:bg-orange-500/10 flex items-center justify-center group-hover:scale-110 transition-transform">
                                                <X size={12} />
                                            </div>
                                            <span>Отклонить</span>
                                        </button>
                                    )}

                                    <div className="h-px bg-slate-50 dark:bg-slate-800 my-1" />

                                    <button
                                        onClick={() => {
                                            onDelete(loc.id);
                                            onToggleActionMenu(null);
                                        }}
                                        className="w-full flex items-center gap-3 px-3 py-2.5 text-xs font-bold text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-500/5 rounded-xl transition-colors group"
                                    >
                                        <div className="w-8 h-8 rounded-lg bg-rose-50 dark:bg-rose-500/10 flex items-center justify-center group-hover:scale-110 transition-transform">
                                            <Trash2 size={12} />
                                        </div>
                                        <span>Удалить</span>
                                    </button>
                                </motion.div>
                            </>
                        )}
                    </AnimatePresence>
                </div>
            </td>
        </tr>
    )
}

export default LocationListItem
