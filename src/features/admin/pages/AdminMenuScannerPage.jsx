import React, { useState, useCallback } from 'react'
import {
    Search, Loader2, UtensilsCrossed, Trash2, Star,
    CheckSquare, Square, ChevronDown, X, AlertCircle,
    CheckCircle, Sparkles
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/shared/store/useAuthStore'
import { useTheme } from '@/hooks/useTheme'
import AdminPageHeader from '../components/AdminPageHeader'
import { MenuScanner } from '@/features/public/components/MenuScanner'
import {
    getLocations, getLocationMenu, saveScannedMenu,
    deleteLocationDish, updateLocationDish
} from '@/shared/api/locations.api'

const DISH_CATEGORIES = [
    'appetizer', 'main', 'dessert', 'drink', 'snack', 'soup', 'salad', 'side', 'other'
]

const AdminMenuScannerPage = () => {
    const { user } = useAuthStore()
    const { theme } = useTheme()
    const isDark = theme === 'dark'

    // ─── State ──────────────────────────────────────────────────────────────
    const [searchTerm, setSearchTerm] = useState('')
    const [searchResults, setSearchResults] = useState([])
    const [isSearching, setIsSearching] = useState(false)
    const [showDropdown, setShowDropdown] = useState(false)

    const [selectedLocation, setSelectedLocation] = useState(null)
    const [menu, setMenu] = useState([])
    const [isLoadingMenu, setIsLoadingMenu] = useState(false)
    const [isSavingScan, setIsSavingScan] = useState(false)
    const [toast, setToast] = useState(null)

    // ─── Role guard ─────────────────────────────────────────────────────────
    if (!user || user.role !== 'admin') {
        return (
            <div className="p-8 text-center text-red-500">
                Access Denied. Admins only.
            </div>
        )
    }

    // ─── Location search ────────────────────────────────────────────────────
    let searchTimeout = null

    const handleSearchChange = (e) => {
        const value = e.target.value
        setSearchTerm(value)

        if (searchTimeout) clearTimeout(searchTimeout)
        if (!value.trim()) {
            setSearchResults([])
            setShowDropdown(false)
            return
        }

        setIsSearching(true)
        searchTimeout = setTimeout(async () => {
            try {
                const result = await getLocations({ query: value.trim(), limit: 10, all: true })
                setSearchResults(result.data || [])
                setShowDropdown(true)
            } catch (err) {
                console.error('[AdminMenuScanner] Search failed:', err)
                setSearchResults([])
            } finally {
                setIsSearching(false)
            }
        }, 300)
    }

    const handleSelectLocation = async (location) => {
        setSelectedLocation(location)
        setSearchTerm(location.title || location.name || '')
        setShowDropdown(false)
        setSearchResults([])

        // Fetch menu
        setIsLoadingMenu(true)
        try {
            const dishes = await getLocationMenu(location.id)
            setMenu(dishes)
        } catch (err) {
            console.error('[AdminMenuScanner] Failed to load menu:', err)
            setMenu([])
        } finally {
            setIsLoadingMenu(false)
        }
    }

    const clearLocation = () => {
        setSelectedLocation(null)
        setSearchTerm('')
        setMenu([])
    }

    // ─── Scanner callback ───────────────────────────────────────────────────
    const handleDishesExtracted = useCallback(async (dishes) => {
        if (!selectedLocation || !dishes?.length) return

        setIsSavingScan(true)
        try {
            const result = await saveScannedMenu(selectedLocation.id, dishes)
            setToast({
                type: 'success',
                message: `Saved ${result.saved} new dishes (${result.duplicates} duplicates)`
            })
            // Refresh menu
            const updated = await getLocationMenu(selectedLocation.id)
            setMenu(updated)
        } catch (err) {
            console.error('[AdminMenuScanner] Save failed:', err)
            setToast({ type: 'error', message: 'Failed to save scanned menu' })
        } finally {
            setIsSavingScan(false)
            setTimeout(() => setToast(null), 4000)
        }
    }, [selectedLocation])

    // ─── Dish actions ───────────────────────────────────────────────────────
    const handleDeleteDish = async (dishId) => {
        if (!confirm('Delete this dish from the location menu?')) return

        try {
            await deleteLocationDish(selectedLocation.id, dishId)
            setMenu(prev => prev.filter(d => d.id !== dishId))
            setToast({ type: 'success', message: 'Dish removed' })
        } catch (err) {
            console.error('[AdminMenuScanner] Delete failed:', err)
            setToast({ type: 'error', message: 'Failed to delete dish' })
        }
        setTimeout(() => setToast(null), 3000)
    }

    const handleUpdateDish = async (dishId, updates) => {
        try {
            await updateLocationDish(selectedLocation.id, dishId, updates)
            setMenu(prev => prev.map(d =>
                d.id === dishId ? { ...d, ...updates } : d
            ))
        } catch (err) {
            console.error('[AdminMenuScanner] Update failed:', err)
            setToast({ type: 'error', message: 'Failed to update dish' })
            setTimeout(() => setToast(null), 3000)
        }
    }

    const handleToggleSignature = (dish) => {
        handleUpdateDish(dish.id, { is_signature: !dish.is_signature })
    }

    const handleToggleAvailable = (dish) => {
        handleUpdateDish(dish.id, { available: !dish.available })
    }

    const handlePriceChange = (dishId, newPrice) => {
        handleUpdateDish(dishId, { price: newPrice })
    }

    const handleCategoryChange = (dishId, newCategory) => {
        // Category lives on the `dishes` table, not `location_dishes`.
        // updateLocationDish only updates location_dishes fields, but we
        // still update local state for immediate feedback.
        setMenu(prev => prev.map(d =>
            d.id === dishId ? { ...d, category: newCategory } : d
        ))
    }

    // ─── Render helpers ─────────────────────────────────────────────────────
    const cardBg = isDark ? 'bg-white/5 border-white/10' : 'bg-gray-50 border-gray-100'
    const textStyle = isDark ? 'text-white' : 'text-gray-900'
    const subText = isDark ? 'text-white/50' : 'text-gray-500'

    return (
        <div className="space-y-6 lg:space-y-10 pb-12 font-sans">
            <AdminPageHeader
                eyebrow="Admin"
                title="Menu Scanner"
                subtitle="Scan restaurant menus with AI, edit and manage dishes."
                icon={UtensilsCrossed}
            />

            {/* Location Selector */}
            <div className="bg-white dark:bg-slate-900/50 rounded-[32px] lg:rounded-[48px] border border-slate-100 dark:border-slate-800/50 shadow-sm p-6 lg:p-8">
                <h2 className={cn('text-sm font-black uppercase tracking-widest mb-4', subText)}>
                    Select Location
                </h2>
                <div className="relative">
                    <div className="flex items-center gap-3">
                        <div className="relative flex-1">
                            <Search size={16} className={cn('absolute left-4 top-1/2 -translate-y-1/2', subText)} />
                            <input
                                type="text"
                                value={searchTerm}
                                onChange={handleSearchChange}
                                onFocus={() => searchResults.length > 0 && setShowDropdown(true)}
                                placeholder="Search locations by name or city..."
                                className={cn(
                                    'w-full h-12 pl-11 pr-10 rounded-2xl border text-sm font-medium transition-all',
                                    'focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-500/40',
                                    isDark
                                        ? 'bg-slate-800/50 border-slate-700/50 text-white placeholder:text-slate-500'
                                        : 'bg-white border-slate-200 text-slate-900 placeholder:text-slate-400'
                                )}
                            />
                            {isSearching && (
                                <Loader2 size={16} className="absolute right-4 top-1/2 -translate-y-1/2 animate-spin text-indigo-500" />
                            )}
                            {selectedLocation && (
                                <button
                                    onClick={clearLocation}
                                    className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-red-500 transition-colors"
                                >
                                    <X size={16} />
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Search results dropdown */}
                    {showDropdown && searchResults.length > 0 && (
                        <div className={cn(
                            'absolute z-50 w-full mt-2 rounded-2xl border shadow-xl max-h-64 overflow-y-auto',
                            isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'
                        )}>
                            {searchResults.map(loc => (
                                <button
                                    key={loc.id}
                                    onClick={() => handleSelectLocation(loc)}
                                    className={cn(
                                        'w-full text-left px-4 py-3 flex items-center gap-3 transition-colors',
                                        isDark
                                            ? 'hover:bg-slate-700/50 text-white'
                                            : 'hover:bg-slate-50 text-slate-900'
                                    )}
                                >
                                    <UtensilsCrossed size={14} className="text-indigo-500 shrink-0" />
                                    <div className="min-w-0 flex-1">
                                        <p className="text-sm font-bold truncate">{loc.title || loc.name}</p>
                                        <p className={cn('text-xs truncate', subText)}>
                                            {loc.city}{loc.city && loc.country ? ', ' : ''}{loc.country}
                                        </p>
                                    </div>
                                    <ChevronDown size={14} className={cn('shrink-0 rotate-[-90deg]', subText)} />
                                </button>
                            ))}
                        </div>
                    )}

                    {/* No results */}
                    {showDropdown && !isSearching && searchTerm.trim() && searchResults.length === 0 && (
                        <div className={cn(
                            'absolute z-50 w-full mt-2 rounded-2xl border shadow-xl p-6 text-center',
                            isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'
                        )}>
                            <p className={cn('text-sm', subText)}>No locations found</p>
                        </div>
                    )}
                </div>

                {/* Selected location badge */}
                {selectedLocation && (
                    <div className={cn(
                        'mt-4 flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold',
                        isDark ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20' : 'bg-indigo-50 text-indigo-600 border border-indigo-100'
                    )}>
                        <UtensilsCrossed size={12} />
                        <span className="truncate">{selectedLocation.title || selectedLocation.name}</span>
                        <span className={cn('truncate', subText)}>
                            — {selectedLocation.city}{selectedLocation.city && selectedLocation.country ? ', ' : ''}{selectedLocation.country}
                        </span>
                    </div>
                )}
            </div>

            {/* Menu Scanner (shown when location selected) */}
            {selectedLocation && (
                <div className="bg-white dark:bg-slate-900/50 rounded-[32px] lg:rounded-[48px] border border-slate-100 dark:border-slate-800/50 shadow-sm p-6 lg:p-8">
                    <h2 className={cn('text-sm font-black uppercase tracking-widest mb-4', subText)}>
                        Scan Menu
                    </h2>
                    {isSavingScan && (
                        <div className="flex items-center gap-3 mb-4 px-4 py-3 rounded-2xl bg-blue-500/10 border border-blue-500/20">
                            <Loader2 size={16} className="animate-spin text-blue-500" />
                            <span className="text-sm font-bold text-blue-600 dark:text-blue-400">Saving scanned dishes...</span>
                        </div>
                    )}
                    <MenuScanner onDishesExtracted={handleDishesExtracted} />
                </div>
            )}

            {/* Menu Table (shown when location selected) */}
            {selectedLocation && (
                <div className="bg-white dark:bg-slate-900/50 rounded-[32px] lg:rounded-[48px] border border-slate-100 dark:border-slate-800/50 shadow-sm overflow-hidden">
                    {/* Stats line */}
                    <div className={cn(
                        'px-6 lg:px-8 py-4 border-b flex items-center justify-between flex-wrap gap-2',
                        isDark ? 'border-slate-800/50' : 'border-slate-100'
                    )}>
                        <div className="flex items-center gap-3">
                            <span className={cn('text-sm font-black', textStyle)}>
                                Total: {menu.length} {menu.length === 1 ? 'dish' : 'dishes'}
                            </span>
                            {menu.filter(d => d.is_signature).length > 0 && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-bold uppercase tracking-wider bg-amber-100 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400">
                                    <Star size={10} /> {menu.filter(d => d.is_signature).length} signature
                                </span>
                            )}
                        </div>
                    </div>

                    {/* Loading state */}
                    {isLoadingMenu && (
                        <div className="flex items-center justify-center py-16">
                            <Loader2 size={24} className="animate-spin text-indigo-500" />
                            <span className={cn('ml-3 text-sm font-bold', subText)}>Loading menu...</span>
                        </div>
                    )}

                    {/* Empty state */}
                    {!isLoadingMenu && menu.length === 0 && (
                        <div className="py-16 text-center">
                            <UtensilsCrossed size={40} className={cn('mx-auto mb-3', subText)} />
                            <p className={cn('font-black', textStyle)}>No dishes yet</p>
                            <p className={cn('text-xs mt-1', subText)}>
                                Scan a menu above to add dishes, or they may not have been saved yet.
                            </p>
                        </div>
                    )}

                    {/* Table */}
                    {!isLoadingMenu && menu.length > 0 && (
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead>
                                    <tr className={cn(
                                        'text-[10px] font-black uppercase tracking-widest',
                                        isDark ? 'text-slate-500 border-b border-slate-800/50' : 'text-slate-400 border-b border-slate-100'
                                    )}>
                                        <th className="text-left px-6 py-3">Name</th>
                                        <th className="text-left px-4 py-3">Category</th>
                                        <th className="text-left px-4 py-3">Price</th>
                                        <th className="text-center px-4 py-3">Signature</th>
                                        <th className="text-center px-4 py-3">Available</th>
                                        <th className="text-right px-6 py-3">Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {menu.map((dish) => (
                                        <tr
                                            key={dish.id}
                                            className={cn(
                                                'transition-colors',
                                                isDark
                                                    ? 'border-b border-slate-800/30 hover:bg-slate-800/20'
                                                    : 'border-b border-slate-50 hover:bg-slate-50/50'
                                            )}
                                        >
                                            {/* Name */}
                                            <td className="px-6 py-3">
                                                <p className={cn('text-sm font-bold truncate max-w-[200px]', textStyle)}>
                                                    {dish.name}
                                                </p>
                                                {dish.description && (
                                                    <p className={cn('text-xs truncate max-w-[200px] mt-0.5', subText)}>
                                                        {dish.description}
                                                    </p>
                                                )}
                                            </td>

                                            {/* Category (editable select) */}
                                            <td className="px-4 py-3">
                                                <select
                                                    value={dish.category || 'other'}
                                                    onChange={(e) => handleCategoryChange(dish.id, e.target.value)}
                                                    className={cn(
                                                        'h-8 px-2 rounded-lg border text-xs font-bold transition-all',
                                                        'focus:outline-none focus:ring-2 focus:ring-indigo-500/30',
                                                        isDark
                                                            ? 'bg-slate-800 border-slate-700 text-slate-300'
                                                            : 'bg-white border-slate-200 text-slate-700'
                                                    )}
                                                >
                                                    {DISH_CATEGORIES.map(cat => (
                                                        <option key={cat} value={cat}>
                                                            {cat.charAt(0).toUpperCase() + cat.slice(1)}
                                                        </option>
                                                    ))}
                                                </select>
                                            </td>

                                            {/* Price (editable input) */}
                                            <td className="px-4 py-3">
                                                <input
                                                    type="text"
                                                    defaultValue={dish.price || ''}
                                                    onBlur={(e) => {
                                                        if (e.target.value !== (dish.price || '')) {
                                                            handlePriceChange(dish.id, e.target.value)
                                                        }
                                                    }}
                                                    onKeyDown={(e) => {
                                                        if (e.key === 'Enter') e.target.blur()
                                                    }}
                                                    className={cn(
                                                        'h-8 w-24 px-2 rounded-lg border text-xs font-bold transition-all',
                                                        'focus:outline-none focus:ring-2 focus:ring-indigo-500/30',
                                                        isDark
                                                            ? 'bg-slate-800 border-slate-700 text-slate-300'
                                                            : 'bg-white border-slate-200 text-slate-700'
                                                    )}
                                                    placeholder="—"
                                                />
                                            </td>

                                            {/* Signature toggle */}
                                            <td className="px-4 py-3 text-center">
                                                <button
                                                    onClick={() => handleToggleSignature(dish)}
                                                    className="inline-flex items-center justify-center transition-transform active:scale-90"
                                                >
                                                    {dish.is_signature ? (
                                                        <Star size={18} className="text-amber-500 fill-amber-500" />
                                                    ) : (
                                                        <Star size={18} className={cn(subText, 'hover:text-amber-400')} />
                                                    )}
                                                </button>
                                            </td>

                                            {/* Available toggle */}
                                            <td className="px-4 py-3 text-center">
                                                <button
                                                    onClick={() => handleToggleAvailable(dish)}
                                                    className="inline-flex items-center justify-center transition-transform active:scale-90"
                                                >
                                                    {dish.available !== false ? (
                                                        <CheckSquare size={18} className="text-emerald-500" />
                                                    ) : (
                                                        <Square size={18} className={cn(subText, 'hover:text-emerald-400')} />
                                                    )}
                                                </button>
                                            </td>

                                            {/* Delete */}
                                            <td className="px-6 py-3 text-right">
                                                <button
                                                    onClick={() => handleDeleteDish(dish.id)}
                                                    className="p-2 rounded-xl text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-all"
                                                    title="Remove dish"
                                                >
                                                    <Trash2 size={14} />
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            )}

            {/* Toast */}
            {toast && (
                <div className="fixed bottom-6 right-6 z-[9999]">
                    <div className={cn(
                        'flex items-center gap-3 px-5 py-4 rounded-2xl shadow-2xl border backdrop-blur-xl',
                        toast.type === 'success' ? 'bg-emerald-500/90 border-emerald-400 text-white' :
                        toast.type === 'error' ? 'bg-rose-500/90 border-rose-400 text-white' :
                        'bg-indigo-600/90 border-indigo-400 text-white'
                    )}>
                        {toast.type === 'success' ? <CheckCircle size={18} /> :
                         toast.type === 'error' ? <AlertCircle size={18} /> :
                         <Sparkles size={18} className="animate-pulse" />}
                        <span className="text-sm font-semibold tracking-wide">{toast.message}</span>
                        <button
                            onClick={() => setToast(null)}
                            className="ml-2 p-1 hover:bg-white/20 rounded-lg transition-colors"
                        >
                            <X size={14} />
                        </button>
                    </div>
                </div>
            )}
        </div>
    )
}

export default AdminMenuScannerPage
