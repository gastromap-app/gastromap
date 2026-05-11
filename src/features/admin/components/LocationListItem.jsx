import React, { Fragment } from 'react'
import { MapPin, Star, MoreHorizontal, Edit, Trash2, CheckCircle, X } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { motion } from 'framer-motion'
import { Menu, Transition } from '@headlessui/react'
import { cn } from '@/lib/utils'
import { useTranslation } from 'react-i18next'
import { getCategoryLabel } from '@/shared/config/filterOptions'
import { getStatusDisplay, LOCATION_STATUSES } from '@/shared/constants/statuses'

/**
 * LocationListItem.jsx
 * Компонент отображения отдельного элемента локации в списке
 */

// ── Helpers (pure, no hooks) ──────────────────────────────────────────────────

const getStatusBadge = (status) => getStatusDisplay(status).badge
const getStatusDot = (status) => getStatusDisplay(status).dot
const getStatusLabel = (status) => getStatusDisplay(status).label

// ── Sub-components (defined at module level, not inside render) ───────────────

function StatusBadge({ status }) {
    return (
        <div className={cn(
            "inline-flex items-center p-1.5 px-2 rounded-image text-micro font-bold uppercase tracking-wider",
            getStatusBadge(status)
        )}>
            <div className={cn("w-1.5 h-1.5 rounded-pill mr-2", getStatusDot(status))} />
            {getStatusLabel(status)}
        </div>
    )
}

function VisibilityToggle({ locId, locStatus, onToggleVisibility }) {
    const { t } = useTranslation()
    const isVisible = locStatus === LOCATION_STATUSES.ACTIVE || locStatus === LOCATION_STATUSES.APPROVED
    return (
        <button
            onClick={(e) => { e.stopPropagation(); onToggleVisibility(locId, locStatus) }}
            className={cn(
                "relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-pill border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none",
                isVisible ? "bg-primary" : "bg-secondary"
            )}
            title={isVisible ? t('admin.hide_location') : t('admin.publish_location')}
        >
            <span className="sr-only">Toggle visibility</span>
            <span
                className={cn(
                    "pointer-events-none inline-block h-4 w-4 transform rounded-pill bg-white shadow ring-0 transition duration-200 ease-in-out",
                    isVisible ? "translate-x-4" : "translate-x-0"
                )}
            />
        </button>
    )
}

function HiddenGemBadge() {
    const { t } = useTranslation()
    return (
        <div 
            title={t('labels.hidden_gem_desc')}
            className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-image bg-primary/5 border border-primary/10 text-micro font-black uppercase tracking-widest text-primary"
        >
            <span>💎</span>
            <span>{t('labels.hidden_gem')}</span>
        </div>
    )
}

function ActionMenu({ loc, onEdit, onApprove, onReject, onDelete, isOpenActionMenu, viewMode }) {
    const { t } = useTranslation()
    return (
        <Menu as="div" className="relative">
            <Menu.Button
                onClick={(e) => e.stopPropagation()}
                className={cn(
                    "p-2 rounded-image transition-all active:scale-95",
                    isOpenActionMenu
                        ? "bg-primary text-white shadow-lg shadow-primary/20"
                        : "text-t-quaternary hover:text-t-primary hover:bg-secondary"
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
                        "z-[101] bg-card border border-border shadow-2xl overflow-hidden focus:outline-none",
                        viewMode === 'card'
                            ? "fixed bottom-0 left-0 right-0 rounded-t-sheet p-6 pb-[calc(2rem+env(safe-area-inset-bottom))] animate-in fade-in slide-in-from-bottom duration-300"
                            : "absolute right-0 mt-2 min-w-[220px] rounded-card p-2"
                    )}
                >
                    {viewMode === 'card' && (
                        <div className="w-12 h-1.5 bg-secondary rounded-pill mx-auto mb-6" />
                    )}

                    <div className="text-micro font-black uppercase tracking-[0.15em] text-t-tertiary px-4 py-4 border-b border-border mb-2">
                        {t('admin.manage_object')}
                    </div>

                    <div className="space-y-1">
                        <Menu.Item>
                            {({ active }) => (
                                <button
                                    onClick={() => onEdit(loc)}
                                    className={cn(
                                        "w-full flex items-center gap-4 px-3 py-3 text-body-sm font-bold rounded-image transition-all",
                                        active ? "bg-secondary text-t-primary" : "text-t-secondary"
                                    )}
                                >
                                    <div className={cn("w-10 h-10 rounded-input flex items-center justify-center shrink-0 transition-colors", active ? "bg-card shadow-sm" : "bg-secondary/50")}>
                                        <Edit size={16} className="stroke-[2.5]" />
                                    </div>
                                    <span>{t('admin.actions.edit')}</span>
                                </button>
                            )}
                        </Menu.Item>

                        {loc.status === LOCATION_STATUSES.PENDING && (
                            <Menu.Item>
                                {({ active }) => (
                                    <button
                                        onClick={() => onApprove(loc.id)}
                                        className={cn(
                                            "w-full flex items-center gap-4 px-3 py-3 text-body-sm font-bold rounded-image transition-all",
                                            active ? "bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600" : "text-emerald-600/80"
                                        )}
                                    >
                                        <div className={cn("w-10 h-10 rounded-input flex items-center justify-center shrink-0 transition-colors", active ? "bg-white dark:bg-emerald-500/20 shadow-sm" : "bg-emerald-50/50 dark:bg-emerald-500/5")}>
                                            <CheckCircle size={16} className="stroke-[2.5]" />
                                        </div>
                                        <span>{t('admin.actions.approve')}</span>
                                    </button>
                                )}
                            </Menu.Item>
                        )}

                        {loc.status !== LOCATION_STATUSES.REJECTED && (
                            <Menu.Item>
                                {({ active }) => (
                                    <button
                                        onClick={() => onReject(loc.id)}
                                        className={cn(
                                            "w-full flex items-center gap-4 px-3 py-3 text-body-sm font-bold rounded-image transition-all",
                                            active ? "bg-amber-50 dark:bg-amber-500/10 text-amber-600" : "text-amber-600/80"
                                        )}
                                    >
                                        <div className={cn("w-10 h-10 rounded-input flex items-center justify-center shrink-0 transition-colors", active ? "bg-white dark:bg-amber-500/20 shadow-sm" : "bg-amber-50/50 dark:bg-amber-500/5")}>
                                            <X size={16} className="stroke-[2.5]" />
                                        </div>
                                        <span>{t('admin.actions.reject')}</span>
                                    </button>
                                )}
                            </Menu.Item>
                        )}

                        <div className="h-px bg-border my-2 mx-2" />

                        <Menu.Item>
                            {({ active }) => (
                                <button
                                    onClick={() => onDelete(loc.id)}
                                    className={cn(
                                        "w-full flex items-center gap-4 px-3 py-3 text-body-sm font-bold rounded-image transition-all",
                                        active ? "bg-destructive/10 text-destructive" : "text-destructive/80"
                                    )}
                                >
                                    <div className={cn("w-10 h-10 rounded-input flex items-center justify-center shrink-0 transition-colors", active ? "bg-card shadow-sm" : "bg-destructive/5")}>
                                        <Trash2 size={16} className="stroke-[2.5]" />
                                    </div>
                                    <span>{t('admin.actions.delete')}</span>
                                </button>
                            )}
                        </Menu.Item>

                        {viewMode === 'card' && (
                            <div className="pt-4">
                                <Menu.Item>
                                    <button
                                        className="w-full py-4 rounded-card bg-secondary text-t-tertiary font-black text-micro uppercase tracking-[0.2em] active:scale-95 transition-transform"
                                    >
                                        {t('admin.actions.close')}
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
    const { t, i18n } = useTranslation()
    if (viewMode === 'card') {
        return (
            <motion.div
                layout
                onClick={() => onEdit(loc)}
                className="w-full text-left bg-card rounded-card p-4 active:scale-[0.99] transition-transform border border-border shadow-sm group"
            >
                <div className="flex items-start gap-4">
                    <div className="w-12 h-12 rounded-image bg-secondary flex items-center justify-center text-t-quaternary group-hover:text-primary group-hover:scale-110 transition-all shadow-inner shrink-0">
                        <Building2 size={22} className="stroke-[2]" />
                    </div>
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                             <p className="text-body-sm font-bold text-t-primary truncate">{loc.title}</p>
                            <div className="flex items-center gap-1 bg-amber-500/10 px-1.5 py-0.5 rounded-image">
                                <Star size={10} className="fill-amber-500 text-amber-500" />
                                 <span className="text-micro font-black text-amber-600">{(loc.rating ?? loc.google_rating) > 0 ? (loc.rating ?? loc.google_rating) : '—'}</span>
                            </div>
                        </div>
                         <p className="text-micro text-t-tertiary mt-1 truncate flex items-center gap-1.5 font-medium">
                            <MapPin size={10} className="opacity-50" />{loc.city}, {loc.country}
                        </p>
                        <div className="flex items-center gap-2 mt-3 flex-wrap">
                             <Badge variant="outline" className="bg-transparent border border-border px-2 py-0.5 rounded-image text-micro font-black uppercase tracking-widest text-t-tertiary">
                                {getCategoryLabel(loc.category, i18n.language)}
                            </Badge>
                            {loc.special_labels?.includes('Hidden Gem') && <HiddenGemBadge />}
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
            className="hover:bg-slate-50 dark:hover:bg-white/[0.02] transition-colors group cursor-pointer h-[44px]"
        >
            <td className="px-4 py-2">
                <div className="min-w-0">
                    <p className="text-[13px] font-semibold text-slate-900 dark:text-white truncate leading-tight">{loc.title}</p>
                    <p className="text-[10px] text-slate-400 font-medium mt-0.5 uppercase tracking-wide">
                        {getCategoryLabel(loc.category, i18n.language)}
                        {(loc.kg_cuisines?.length > 0 || loc.cuisine) && (
                            <span className="text-blue-500 ml-1.5">{loc.kg_cuisines?.[0] || loc.cuisine}</span>
                        )}
                    </p>
                </div>
            </td>
            <td className="px-4 py-2">
                <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium truncate block">
                    {loc.city}{loc.country ? ` / ${loc.country}` : ''}
                </span>
            </td>
            <td className="px-4 py-2">
                <div className="flex items-center gap-1">
                    <Star size={11} className={cn("fill-current", (loc.rating ?? loc.google_rating) > 0 ? "text-amber-500" : "text-slate-300 dark:text-slate-600")} />
                    <span className="text-[11px] font-semibold text-slate-600 dark:text-slate-400">{(loc.rating ?? loc.google_rating) > 0 ? (loc.rating ?? loc.google_rating) : '—'}</span>
                </div>
            </td>
            <td className="px-4 py-2">
                <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">{loc.price_range || '—'}</span>
            </td>
            <td className="px-4 py-2">
                <div className="flex items-center gap-2">
                    <VisibilityToggle locId={loc.id} locStatus={loc.status} onToggleVisibility={onToggleVisibility} />
                    <StatusBadge status={loc.status} />
                </div>
            </td>
            <td className="px-4 py-2 text-right">
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
