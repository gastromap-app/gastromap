import React, { Fragment } from 'react'
import { Building2, MapPin, Star, MoreHorizontal, Edit, Trash2, CheckCircle, X } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { motion } from 'framer-motion'
import { Menu, Transition } from '@headlessui/react'
import { cn } from '@/lib/utils'
import { useTranslation } from 'react-i18next'
import { getCategoryLabel } from '@/shared/config/filterOptions'

/**
 * LocationListItem.jsx
 * Компонент отображения отдельного элемента локации в списке
 */

// ── Helpers (pure, no hooks) ──────────────────────────────────────────────────

function statusBadgeClass(status) {
    if (status === 'approved' || status === 'active') return 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600'
    if (status === 'pending') return 'bg-amber-50 dark:bg-amber-500/10 text-amber-600'
    if (status === 'revision_requested') return 'bg-orange-50 dark:bg-orange-500/10 text-orange-700'
    if (status === 'hidden') return 'bg-slate-100 dark:bg-slate-800 text-slate-500'
    return 'bg-rose-50 dark:bg-rose-500/10 text-rose-500'
}

function statusDotClass(status) {
    if (status === 'approved' || status === 'active') return 'bg-emerald-500'
    if (status === 'pending') return 'bg-amber-500'
    if (status === 'revision_requested') return 'bg-orange-500'
    if (status === 'hidden') return 'bg-slate-400'
    return 'bg-rose-500'
}

// ── Sub-components (defined at module level, not inside render) ───────────────

function StatusBadge({ status }) {
    return (
        <div className={cn(
            "inline-flex items-center p-1.5 px-2 rounded-lg text-[9px] font-bold uppercase tracking-wider",
            statusBadgeClass(status)
        )}>
            <div className={cn("w-1.5 h-1.5 rounded-full mr-2", statusDotClass(status))} />
            {(status === 'approved' || status === 'active')
                ? 'Активен'
                : status === 'pending'
                    ? 'Ожидает'
                    : status === 'revision_requested'
                        ? 'На доработку'
                        : status === 'hidden'
                            ? 'Скрыт'
                            : 'Отклонён'}
        </div>
    )
}

function VisibilityToggle({ locId, locStatus, onToggleVisibility }) {
    const isVisible = locStatus === 'active' || locStatus === 'approved'
    return (
        <button
            onClick={(e) => { e.stopPropagation(); onToggleVisibility(locId, locStatus) }}
            className={cn(
                "relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none",
                isVisible ? "bg-indigo-500" : "bg-slate-200 dark:bg-slate-700"
            )}
            title={isVisible ? "Скрыть локацию" : "Опубликовать локацию"}
        >
            <span className="sr-only">Toggle visibility</span>
            <span
                className={cn(
                    "pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out",
                    isVisible ? "translate-x-4" : "translate-x-0"
                )}
            />
        </button>
    )
}

function ActionMenu({ loc, onEdit, onApprove, onReject, onDelete, isOpenActionMenu, viewMode }) {
    return (
        <Menu as="div" className="relative">
            <Menu.Button
                onClick={(e) => e.stopPropagation()}
                className={cn(
                    "p-2 rounded-xl transition-all active:scale-95",
                    isOpenActionMenu
                        ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-lg shadow-slate-200 dark:shadow-none"
                        : "text-slate-300 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800"
                )}
            >
                <MoreHorizontal size={16} className="stroke-[2.5]" />
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
                <Menu.Items
                    className={cn(
                        "z-[101] bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 shadow-2xl overflow-hidden focus:outline-none",
                        viewMode === 'card'
                            ? "fixed bottom-0 left-0 right-0 rounded-t-[32px] p-6 pb-[calc(2rem+env(safe-area-inset-bottom))] animate-in fade-in slide-in-from-bottom duration-300"
                            : "absolute right-0 mt-2 min-w-[220px] rounded-2xl p-2"
                    )}
                >
                    {viewMode === 'card' && (
                        <div className="w-12 h-1.5 bg-slate-200 dark:bg-slate-800 rounded-full mx-auto mb-6" />
                    )}

                    <div className="text-[10px] font-black uppercase tracking-[0.15em] text-slate-400 px-4 py-4 border-b border-slate-50 dark:border-slate-800/50 mb-2">
                        Управление объектом
                    </div>

                    <div className="space-y-1">
                        <Menu.Item>
                            {({ active }) => (
                                <button
                                    onClick={() => onEdit(loc)}
                                    className={cn(
                                        "w-full flex items-center gap-4 px-3 py-3 text-[13px] font-bold rounded-2xl transition-all",
                                        active ? "bg-slate-50 dark:bg-slate-800/50 text-slate-900 dark:text-white" : "text-slate-600 dark:text-slate-400"
                                    )}
                                >
                                    <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-colors", active ? "bg-white dark:bg-slate-800 shadow-sm" : "bg-slate-50 dark:bg-slate-800/50")}>
                                        <Edit size={16} className="stroke-[2.5]" />
                                    </div>
                                    <span>Редактировать</span>
                                </button>
                            )}
                        </Menu.Item>

                        {loc.status === 'pending' && (
                            <Menu.Item>
                                {({ active }) => (
                                    <button
                                        onClick={() => onApprove(loc.id)}
                                        className={cn(
                                            "w-full flex items-center gap-4 px-3 py-3 text-[13px] font-bold rounded-2xl transition-all",
                                            active ? "bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600" : "text-emerald-600/80"
                                        )}
                                    >
                                        <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-colors", active ? "bg-white dark:bg-emerald-500/20 shadow-sm" : "bg-emerald-50/50 dark:bg-emerald-500/5")}>
                                            <CheckCircle size={16} className="stroke-[2.5]" />
                                        </div>
                                        <span>Одобрить</span>
                                    </button>
                                )}
                            </Menu.Item>
                        )}

                        {loc.status !== 'rejected' && (
                            <Menu.Item>
                                {({ active }) => (
                                    <button
                                        onClick={() => onReject(loc.id)}
                                        className={cn(
                                            "w-full flex items-center gap-4 px-3 py-3 text-[13px] font-bold rounded-2xl transition-all",
                                            active ? "bg-amber-50 dark:bg-amber-500/10 text-amber-600" : "text-amber-600/80"
                                        )}
                                    >
                                        <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-colors", active ? "bg-white dark:bg-amber-500/20 shadow-sm" : "bg-amber-50/50 dark:bg-amber-500/5")}>
                                            <X size={16} className="stroke-[2.5]" />
                                        </div>
                                        <span>Отклонить</span>
                                    </button>
                                )}
                            </Menu.Item>
                        )}

                        <div className="h-px bg-slate-50 dark:bg-slate-800/50 my-2 mx-2" />

                        <Menu.Item>
                            {({ active }) => (
                                <button
                                    onClick={() => onDelete(loc.id)}
                                    className={cn(
                                        "w-full flex items-center gap-4 px-3 py-3 text-[13px] font-bold rounded-2xl transition-all",
                                        active ? "bg-rose-50 dark:bg-rose-500/10 text-rose-600" : "text-rose-600/80"
                                    )}
                                >
                                    <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-colors", active ? "bg-white dark:bg-rose-500/20 shadow-sm" : "bg-rose-50/50 dark:bg-rose-500/5")}>
                                        <Trash2 size={16} className="stroke-[2.5]" />
                                    </div>
                                    <span>Удалить</span>
                                </button>
                            )}
                        </Menu.Item>

                        {viewMode === 'card' && (
                            <div className="pt-4">
                                <Menu.Item>
                                    <button
                                        className="w-full py-4 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-500 font-black text-[10px] uppercase tracking-[0.2em] active:scale-95 transition-transform"
                                    >
                                        Закрыть
                                    </button>
                                </Menu.Item>
                            </div>
                        )}
                    </div>
                </Menu.Items>
            </Transition>
        </Menu>
    )
}

// ── Main component ─────────────────────────────────────────────────────────────

const LocationListItem = ({
    loc,
    onEdit,
    onApprove,
    onReject,
    onToggleVisibility,
    onDelete,
    isOpenActionMenu,
    _onToggleActionMenu,
    viewMode = 'table',
}) => {
    const { i18n } = useTranslation()
    if (viewMode === 'card') {
        return (
            <motion.div
                layout
                onClick={() => onEdit(loc)}
                className="w-full text-left bg-white dark:bg-slate-900/40 rounded-2xl p-4 active:scale-[0.99] transition-transform border border-slate-100 dark:border-slate-800 shadow-sm group"
            >
                <div className="flex items-start gap-4">
                    <div className="w-12 h-12 rounded-[18px] bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-800 dark:to-slate-700 flex items-center justify-center text-slate-400 group-hover:text-indigo-600 group-hover:scale-110 transition-all shadow-inner shrink-0">
                        <Building2 size={22} className="stroke-[2]" />
                    </div>
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                            <p className="text-[14px] font-bold text-slate-900 dark:text-white truncate">{loc.title}</p>
                            <div className="flex items-center gap-1 bg-amber-50 dark:bg-amber-500/10 px-1.5 py-0.5 rounded-md">
                                <Star size={10} className="fill-amber-500 text-amber-500" />
                                <span className="text-[10px] font-black text-amber-600">{(loc.rating ?? loc.google_rating) > 0 ? (loc.rating ?? loc.google_rating) : '—'}</span>
                            </div>
                        </div>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 truncate flex items-center gap-1.5 font-medium">
                            <MapPin size={10} className="opacity-50" />{loc.city}, {loc.country}
                        </p>
                        <div className="flex items-center gap-2 mt-3 flex-wrap">
                            <Badge variant="outline" className="bg-transparent border border-slate-100 dark:border-slate-800 px-2 py-0.5 rounded-lg text-[9px] font-black uppercase tracking-widest text-slate-400">
                                {getCategoryLabel(loc.category, i18n.language)}
                            </Badge>
                            <StatusBadge status={loc.status} />
                        </div>
                    </div>
                    <div className="flex flex-col items-center justify-between self-stretch shrink-0">
                        <VisibilityToggle locId={loc.id} locStatus={loc.status} onToggleVisibility={onToggleVisibility} />
                        <ActionMenu
                            loc={loc}
                            onEdit={onEdit}
                            onApprove={onApprove}
                            onReject={onReject}
                            onDelete={onDelete}
                            isOpenActionMenu={isOpenActionMenu}
                            viewMode={viewMode}
                        />
                    </div>
                </div>
            </motion.div>
        )
    }

    return (
        <tr
            onClick={() => onEdit(loc)}
            className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-all group cursor-pointer border-none leading-none"
        >
            <td className="px-6 py-5 pl-10 lg:pl-12">
                <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-[14px] bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-800 dark:to-slate-700 flex items-center justify-center text-slate-400 group-hover:text-indigo-600 group-hover:scale-110 transition-all shadow-inner shrink-0">
                        <Building2 size={18} className="stroke-[2.5]" />
                    </div>
                    <div className="min-w-0">
                        <p className="text-[13px] font-bold text-slate-900 dark:text-white truncate leading-tight">{loc.title}</p>
                        <div className="flex items-center gap-2 mt-1.5">
                            <p className="text-[10px] text-slate-400 dark:text-slate-500 uppercase tracking-widest font-black shrink-0 leading-none">{getCategoryLabel(loc.category, i18n.language)}</p>
                            {(loc.kg_cuisines?.length > 0 || loc.cuisine) && (
                                <Badge variant="secondary" className="bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 text-[8px] h-3.5 px-1.5 font-black border-none uppercase tracking-[0.1em] shrink-0">
                                    {loc.kg_cuisines?.length > 0
                                        ? loc.kg_cuisines.slice(0, 1).join(', ')
                                        : loc.cuisine}
                                </Badge>
                            )}
                        </div>
                    </div>
                </div>
            </td>
            <td className="px-6 py-5">
                <div className="text-[11px] font-bold flex items-center gap-2 text-slate-500 dark:text-slate-400">
                    <MapPin size={10} className="text-slate-300 dark:text-slate-600 stroke-[2.5]" />
                    <span className="truncate">{loc.city}</span>
                    <span className="text-[10px] opacity-30 font-black">/</span>
                    <span className="opacity-60 truncate">{loc.country}</span>
                </div>
            </td>
            <td className="px-6 py-5">
                <div className="flex items-center gap-1.5">
                    <Star size={12} className={cn("fill-current stroke-[2]", (loc.rating ?? loc.google_rating) > 0 ? "text-amber-500" : "text-slate-100 dark:text-slate-800")} />
                    <span className="text-[11px] font-black text-slate-500">{(loc.rating ?? loc.google_rating) > 0 ? (loc.rating ?? loc.google_rating) : '—'}</span>
                </div>
            </td>
            <td className="px-6 py-5">
                <div className="flex items-center gap-3">
                    <VisibilityToggle locId={loc.id} locStatus={loc.status} onToggleVisibility={onToggleVisibility} />
                    <StatusBadge status={loc.status} />
                </div>
            </td>
            <td className="px-6 py-5 text-right pr-10 lg:pr-12">
                <ActionMenu
                    loc={loc}
                    onEdit={onEdit}
                    onApprove={onApprove}
                    onReject={onReject}
                    onDelete={onDelete}
                    isOpenActionMenu={isOpenActionMenu}
                    viewMode={viewMode}
                />
            </td>
        </tr>
    )
}

export default LocationListItem
