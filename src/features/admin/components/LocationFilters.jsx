import React from 'react'
import { Search, Filter, List as ListIcon, Map as MapIcon, AlertCircle } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * Компонент фильтров и переключателей вида для AdminLocationsPage
 * @param {Object} props
 * @param {string} props.view - Текущий вид ('list' | 'moderation')
 * @param {Function} props.onViewChange - Callback при смене вида
 * @param {string} props.viewMode - Режим отображения ('list' | 'map')
 * @param {Function} props.onViewModeChange - Callback при смене режима
 * @param {string} props.statusFilter - Текущий фильтр статуса
 * @param {Function} props.onStatusFilterChange - Callback при изменении фильтра статуса
 * @param {string} props.searchQuery - Поисковый запрос
 * @param {Function} props.onSearchChange - Callback при изменении поискового запроса
 * @param {number} props.pendingCount - Количество локаций в очереди
 */
const LocationFilters = ({
    view,
    onViewChange,
    viewMode,
    onViewModeChange,
    statusFilter,
    onStatusFilterChange,
    searchQuery,
    onSearchChange,
    pendingCount = 0
}) => {
    return (
        <div className="p-4 lg:p-10 border-b border-slate-50 dark:border-slate-800/50 flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
            <div className="flex gap-1.5 p-1 bg-slate-50 dark:bg-slate-950/50 rounded-2xl w-full lg:w-fit overflow-x-auto no-scrollbar border border-slate-100/50 dark:border-slate-800/50">
                {[
                    { id: 'list', label: 'Все объекты', icon: ListIcon },
                    { id: 'moderation', label: 'В очереди', icon: AlertCircle, count: pendingCount }
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
                        {tab.count > 0 && (
                            <span className="w-5 h-5 flex items-center justify-center bg-indigo-500 text-white rounded-lg text-[9px] ml-1 shadow-lg shadow-indigo-500/20">
                                {tab.count}
                            </span>
                        )}
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

                <div className="flex items-center gap-2 px-1 bg-slate-50 dark:bg-slate-950/30 rounded-2xl border border-slate-100/50 dark:border-slate-800/50">
                    <Filter size={14} className="ml-3 text-slate-400" />
                    <select 
                        value={statusFilter} 
                        onChange={e => onStatusFilterChange(e.target.value)}
                        className="bg-transparent border-none py-2.5 pl-1 pr-8 text-[11px] font-bold uppercase tracking-widest outline-none appearance-none cursor-pointer text-slate-600 dark:text-slate-400"
                    >
                        <option value="all">Все статусы</option>
                        <option value="approved">Активен</option>
                        <option value="pending">Ожидает</option>
                        <option value="rejected">Отклонен</option>
                    </select>
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
