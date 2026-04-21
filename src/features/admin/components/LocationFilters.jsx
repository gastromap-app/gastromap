import React from 'react'
import { Search, List as ListIcon, Map as MapIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * Компонент фильтров и переключателей вида для AdminLocationsPage
 * @param {Object} props
 * @param {string} props.view - Текущий вид ('list')
 * @param {Function} props.onViewChange - Callback при смене вида
 * @param {string} props.viewMode - Режим отображения ('list' | 'map')
 * @param {Function} props.onViewModeChange - Callback при смене режима
 * @param {string} props.searchQuery - Поисковый запрос
 * @param {Function} props.onSearchChange - Callback при изменении поискового запроса
 */
const LocationFilters = ({
    view,
    onViewChange,
    viewMode,
    onViewModeChange,
    searchQuery,
    onSearchChange
}) => {
    return (
        <div className="p-4 lg:p-10 border-b border-slate-50 dark:border-slate-800/50 flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
            <div className="flex gap-1.5 p-1 bg-slate-50 dark:bg-slate-950/50 rounded-2xl w-full lg:w-fit overflow-x-auto no-scrollbar border border-slate-100/50 dark:border-slate-800/50">
                {[
                    { id: 'list', label: 'Все объекты', icon: ListIcon }
                ].map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => onViewChange(tab.id)}
                        className={cn(
                            "flex items-center gap-2 px-5 py-2.5 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all whitespace-nowrap",
                            view === tab.id
                                ? 'bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-sm'
                                : 'text-slate-400 hover:text-slate-900 dark:hover:text-white'
                        )}
                    >
                        <tab.icon size={14} />{tab.label}
                    </button>
                ))}
            </div>

            <div className="flex items-center gap-4 w-full lg:w-auto">
                <div className="flex gap-1.5 p-1 bg-slate-50 dark:bg-slate-950/30 rounded-2xl border border-slate-100/50 dark:border-slate-800/50">
                    <button
                        onClick={() => onViewModeChange('list')}
                        className={cn(
                            "px-4 py-2 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all",
                            viewMode === 'list' 
                                ? 'bg-white dark:bg-slate-800 text-indigo-600 shadow-sm' 
                                : 'text-slate-400'
                        )}
                    >
                        <ListIcon size={14} className="inline mr-1" />
                        Список
                    </button>
                    <button
                        onClick={() => onViewModeChange('map')}
                        className={cn(
                            "px-4 py-2 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all",
                            viewMode === 'map' 
                                ? 'bg-white dark:bg-slate-800 text-indigo-600 shadow-sm' 
                                : 'text-slate-400'
                        )}
                    >
                        <MapIcon size={14} className="inline mr-1" />
                        Карта
                    </button>
                </div>

                <div className="relative flex-1 lg:w-80 group">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-indigo-500 transition-colors" size={16} />
                    <input 
                        type="text" 
                        value={searchQuery} 
                        onChange={e => onSearchChange(e.target.value)} 
                        placeholder="Поиск объектов..." 
                        className="w-full pl-10 pr-4 py-2.5 bg-slate-50 dark:bg-slate-950/30 border-none rounded-2xl text-[13px] font-medium outline-none focus:ring-2 ring-indigo-500/10 transition-all font-black leading-none" 
                    />
                </div>
            </div>
        </div>
    )
}

export default LocationFilters
