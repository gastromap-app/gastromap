import React, { useState, useMemo, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
    Brain, UtensilsCrossed, Plus, Search,
    Edit2, Trash2, X, Save, Leaf,
    Globe, Sparkles, RefreshCw, Zap, Download,
    Info, Filter, Database, ChevronRight,
    CheckCircle2, AlertCircle, Carrot
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useQueryClient } from '@tanstack/react-query'
import {
    useCuisines, useCreateCuisineMutation, useUpdateCuisineMutation, useDeleteCuisineMutation,
    useDishes, useCreateDishMutation, useUpdateDishMutation, useDeleteDishMutation,
    useIngredients, useCreateIngredientMutation, useUpdateIngredientMutation, useDeleteIngredientMutation,
    useKnowledgeStats, useSyncKGToLocationsMutation,
    useSpoonacularSearchMutation
} from '@/shared/api/queries'
import { 
    createCuisine as createCuisineApi, 
    createDish as createDishApi, 
    createIngredient as createIngredientApi,
    mergeEntities
} from '@/shared/api/knowledge-graph.api'
import { invalidateCacheGroup } from '@/shared/lib/cache'
import KGAIAgent from '../components/KGAIAgent'
import KGEnrichmentAgent from '../components/KGEnrichmentAgent'

// ─── LIST ITEM ────────────────────────────────────────────────────────────────

const ListItem = React.forwardRef(({ type, item, onEdit, onDelete, idx }, ref) => {
    const isCuisine = type === 'cuisines'
    const isDish    = type === 'dishes'

    const Icon     = isCuisine ? Globe : isDish ? UtensilsCrossed : Leaf
    const accent   = isCuisine ? 'text-indigo-500 bg-indigo-50 dark:bg-indigo-500/10'
                   : isDish    ? 'text-emerald-500 bg-emerald-50 dark:bg-emerald-500/10'
                               : 'text-amber-500 bg-amber-50 dark:bg-amber-500/10'
    const badge    = isCuisine ? 'bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-400'
                   : isDish    ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400'
                               : 'bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-400'

    const meta = isCuisine ? item.region
               : isDish    ? (item.preparation_style || item.flavor_notes)
                           : (item.category || item.description)

    return (
        <motion.div
            ref={ref}
            layout
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97 }}
            transition={{ delay: (idx % 15) * 0.03 }}
            className="group flex items-center gap-4 px-5 py-3.5 bg-white dark:bg-slate-900/50 border border-slate-100 dark:border-slate-800/60 rounded-2xl hover:border-slate-200 dark:hover:border-slate-700 hover:shadow-sm transition-all"
        >
            {/* Icon */}
            <div className={cn('w-9 h-9 rounded-xl flex-shrink-0 flex items-center justify-center', accent)}>
                <Icon size={16} />
            </div>

            {/* Name + description */}
            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                    <span className="font-semibold text-sm text-slate-900 dark:text-white truncate">{item.name}</span>
                    {meta && (
                        <span className={cn('hidden sm:inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide flex-shrink-0', badge)}>
                            {meta}
                        </span>
                    )}
                </div>
                {item.description && (
                    <p className="text-xs text-slate-400 truncate mt-0.5 max-w-lg">{item.description}</p>
                )}
            </div>

            {/* Tags preview */}
            <div className="hidden lg:flex items-center gap-1.5 flex-shrink-0">
                {isCuisine && (item.typical_dishes || []).slice(0, 3).map((d, i) => (
                    <span key={i} className="px-2 py-1 bg-slate-50 dark:bg-slate-800 rounded-lg text-[10px] font-medium text-slate-500 dark:text-slate-400 border border-slate-100 dark:border-slate-700/50">
                        {d}
                    </span>
                ))}
                {isDish && (item.dietary_tags || []).slice(0, 2).map((t, i) => (
                    <span key={i} className="px-2 py-1 bg-slate-50 dark:bg-slate-800 rounded-lg text-[10px] font-medium text-slate-500 dark:text-slate-400 border border-slate-100 dark:border-slate-700/50">
                        {t}
                    </span>
                ))}
                {!isCuisine && !isDish && item.flavor_profile && (
                    <span className="px-2 py-1 bg-slate-50 dark:bg-slate-800 rounded-lg text-[10px] font-medium text-slate-500 dark:text-slate-400 border border-slate-100 dark:border-slate-700/50">
                        {item.flavor_profile}
                    </span>
                )}
            </div>

            {/* Actions */}
            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                <button
                    onClick={() => onEdit(item)}
                    className="p-2 rounded-xl text-slate-400 hover:text-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-500/10 transition-all"
                    title="Edit"
                >
                    <Edit2 size={14} />
                </button>
                <button
                    onClick={() => onDelete(item.id)}
                    className="p-2 rounded-xl text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10 transition-all"
                    title="Delete"
                >
                    <Trash2 size={14} />
                </button>
            </div>
        </motion.div>
    )
})

// ─── MODAL BASE ───────────────────────────────────────────────────────────────

const FormModalBase = ({ title, onSave, onClose, children }) => (
    <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[100] flex items-center justify-center p-4"
        onClick={onClose}
    >
        <motion.div
            initial={{ scale: 0.96, y: 12 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.96, y: 12 }}
            onClick={e => e.stopPropagation()}
            className="bg-white dark:bg-slate-950 w-full max-w-xl rounded-[32px] shadow-xl border border-slate-100 dark:border-slate-800 max-h-[90vh] overflow-hidden flex flex-col"
        >
            {/* Header */}
            <div className="px-7 py-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                <div>
                    <h2 className="text-base font-bold text-slate-900 dark:text-white">{title}</h2>
                    <p className="text-xs text-slate-400 mt-0.5">Knowledge Graph</p>
                </div>
                <button onClick={onClose} className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 transition-all">
                    <X size={18} />
                </button>
            </div>

            {/* Body */}
            <div className="px-7 py-6 space-y-5 overflow-y-auto flex-1 custom-scrollbar">
                {children}
            </div>

            {/* Footer */}
            <div className="px-7 py-5 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-3 bg-slate-50/50 dark:bg-slate-900/30">
                <button
                    onClick={onClose}
                    className="px-5 py-2.5 rounded-xl text-sm font-semibold text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all"
                >
                    Cancel
                </button>
                <button
                    onClick={onSave}
                    className="px-5 py-2.5 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-xl text-sm font-semibold flex items-center gap-2 hover:opacity-90 transition-all"
                >
                    <Save size={15} />
                    Save
                </button>
            </div>
        </motion.div>
    </motion.div>
)

// ─── INFO MODAL ───────────────────────────────────────────────────────────────

const InfoModal = ({ onClose }) => (
    <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[200] flex items-center justify-center p-6"
        onClick={onClose}
    >
        <motion.div
            initial={{ scale: 0.95, y: 20, opacity: 0 }}
            animate={{ scale: 1, y: 0, opacity: 1 }}
            exit={{ scale: 0.95, y: 20, opacity: 0 }}
            onClick={e => e.stopPropagation()}
            className="bg-white dark:bg-slate-950 w-full max-w-2xl rounded-[32px] shadow-xl border border-slate-100 dark:border-slate-800 max-h-[85vh] overflow-hidden flex flex-col"
        >
            <div className="px-8 py-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="w-9 h-9 bg-indigo-600 rounded-xl flex items-center justify-center text-white">
                        <Brain size={18} />
                    </div>
                    <div>
                        <h2 className="font-bold text-slate-900 dark:text-white">How Knowledge Graph works</h2>
                        <p className="text-xs text-slate-400">System mechanics & logic flow</p>
                    </div>
                </div>
                <button onClick={onClose} className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 transition-all">
                    <X size={18} />
                </button>
            </div>

            <div className="p-8 overflow-y-auto custom-scrollbar space-y-5">
                {[
                    { icon: Database, color: 'text-indigo-600 bg-indigo-50 dark:bg-indigo-500/10', title: '1. База Знаний (Ontology)', text: 'Кулинарная энциклопедия со связями: Кухни (Итальянская) → Блюда (Паста) → Ингредиенты (Базилик). Приложение понимает контекст еды.' },
                    { icon: Sparkles, color: 'text-emerald-600 bg-emerald-50 dark:bg-emerald-500/10', title: '2. Искусственный Интеллект', text: 'AI наполняет базу "семенами" знаний — автоматически генерирует блюда, описания и теги по мировым кулинарным стандартам.' },
                    { icon: RefreshCw, color: 'text-amber-600 bg-amber-50 dark:bg-amber-500/10', title: '3. Синхронизация (Mapping)', text: 'Рестораны привязываются к базе знаний. Если ресторан подаёт пиццу — он становится частью "Итальянской кухни" автоматически.' },
                    { icon: Search, color: 'text-indigo-600 bg-indigo-50 dark:bg-indigo-500/10', title: '4. Семантический поиск', text: 'Пользователи ищут не по именам, а по смыслу: "хочу что-то острое", "веганская Азия". Система находит рестораны через связи в графе.' },
                ].map(({ icon: Icon, color, title, text }) => (
                    <div key={title} className="flex gap-4">
                        <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0', color)}>
                            <Icon size={18} />
                        </div>
                        <div>
                            <h4 className="font-semibold text-sm text-slate-900 dark:text-white mb-1">{title}</h4>
                            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">{text}</p>
                        </div>
                    </div>
                ))}

                <div className="p-5 bg-slate-50 dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800">
                    <div className="flex items-center gap-2 mb-2">
                        <Zap size={16} className="text-yellow-500" />
                        <span className="text-sm font-semibold text-slate-900 dark:text-white">Pro Tip</span>
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                        Используйте <strong className="text-slate-700 dark:text-slate-300">Seed Engine</strong> для инициализации новых регионов. После добавления данных нажмите <strong className="text-slate-700 dark:text-slate-300">Sync Graph</strong> — это обновит теги всех ресторанов и сделает поиск точнее.
                    </p>
                </div>
            </div>

            <div className="px-8 py-5 border-t border-slate-100 dark:border-slate-800 flex justify-end">
                <button onClick={onClose} className="px-5 py-2.5 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-xl text-sm font-semibold hover:opacity-90 transition-all">
                    Got it
                </button>
            </div>
        </motion.div>
    </motion.div>
)

// ─── CUISINE FORM ─────────────────────────────────────────────────────────────

const CuisineFormModal = ({ cuisine, onSave, onClose }) => {
    const [form, setForm] = useState({
        name:           cuisine?.name || '',
        description:    cuisine?.description || '',
        region:         cuisine?.region || '',
        aliases:        (cuisine?.aliases || []).join(', '),
        typical_dishes: (cuisine?.typical_dishes || []).join(', '),
        key_ingredients:(cuisine?.key_ingredients || []).join(', ')
    })

    const handleSubmit = () => onSave({
        ...form,
        aliases:         form.aliases.split(',').map(s => s.trim()).filter(Boolean),
        typical_dishes:  form.typical_dishes.split(',').map(s => s.trim()).filter(Boolean),
        key_ingredients: form.key_ingredients.split(',').map(s => s.trim()).filter(Boolean),
    })

    const inp = "w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-sm font-medium focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all placeholder:text-slate-300 dark:placeholder:text-slate-600"
    const lbl = "text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1.5 block"

    return (
        <FormModalBase title={cuisine ? 'Edit Cuisine' : 'New Cuisine'} onSave={handleSubmit} onClose={onClose}>
            <div className="grid grid-cols-2 gap-4">
                <div>
                    <label className={lbl}>Name</label>
                    <input className={inp} value={form.name} onChange={e => setForm({...form, name: e.target.value})} placeholder="e.g. Italian" />
                </div>
                <div>
                    <label className={lbl}>Region</label>
                    <input className={inp} value={form.region} onChange={e => setForm({...form, region: e.target.value})} placeholder="e.g. Southern Europe" />
                </div>
            </div>
            <div>
                <label className={lbl}>Aliases</label>
                <input className={inp} value={form.aliases} onChange={e => setForm({...form, aliases: e.target.value})} placeholder="Comma separated alternate names..." />
            </div>
            <div>
                <label className={lbl}>Description</label>
                <textarea className={cn(inp, "min-h-[90px] resize-none")} value={form.description} onChange={e => setForm({...form, description: e.target.value})} placeholder="Cultural context and characteristics..." />
            </div>
            <div className="grid grid-cols-2 gap-4">
                <div>
                    <label className={lbl}>Typical Dishes</label>
                    <input className={inp} value={form.typical_dishes} onChange={e => setForm({...form, typical_dishes: e.target.value})} placeholder="Pizza, Pasta, Risotto..." />
                </div>
                <div>
                    <label className={lbl}>Key Ingredients</label>
                    <input className={inp} value={form.key_ingredients} onChange={e => setForm({...form, key_ingredients: e.target.value})} placeholder="Olive Oil, Basil..." />
                </div>
            </div>
        </FormModalBase>
    )
}

// ─── DISH FORM ────────────────────────────────────────────────────────────────

const DishFormModal = ({ dish, onSave, onClose }) => {
    const [form, setForm] = useState({
        name:               dish?.name || '',
        description:        dish?.description || '',
        flavor_notes:       dish?.flavor_notes || '',
        preparation_style:  dish?.preparation_style || '',
        ingredients:        (dish?.ingredients || []).join(', '),
        best_pairing:       dish?.best_pairing || '',
        dietary_tags:       (dish?.dietary_tags || []).join(', ')
    })

    const handleSubmit = () => onSave({
        ...form,
        ingredients:     form.ingredients.split(',').map(s => s.trim()).filter(Boolean),
        dietary_tags:    form.dietary_tags.split(',').map(s => s.trim()).filter(Boolean),
    })

    const inp = "w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-sm font-medium focus:ring-2 focus:ring-emerald-500/20 outline-none transition-all placeholder:text-slate-300 dark:placeholder:text-slate-600"
    const lbl = "text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1.5 block"

    return (
        <FormModalBase title={dish ? 'Edit Dish' : 'New Dish'} onSave={handleSubmit} onClose={onClose}>
            <div>
                <label className={lbl}>Dish Name</label>
                <input className={inp} value={form.name} onChange={e => setForm({...form, name: e.target.value})} placeholder="e.g. Margherita Pizza" />
            </div>
            <div>
                <label className={lbl}>Description</label>
                <textarea className={cn(inp, "min-h-[90px] resize-none")} value={form.description} onChange={e => setForm({...form, description: e.target.value})} placeholder="Dish profile and origin..." />
            </div>
            <div className="grid grid-cols-2 gap-4">
                <div>
                    <label className={lbl}>Flavor Notes</label>
                    <input className={inp} value={form.flavor_notes} onChange={e => setForm({...form, flavor_notes: e.target.value})} placeholder="Savory, umami, rich..." />
                </div>
                <div>
                    <label className={lbl}>Preparation Style</label>
                    <input className={inp} value={form.preparation_style} onChange={e => setForm({...form, preparation_style: e.target.value})} placeholder="Baked, Grilled..." />
                </div>
            </div>
            <div>
                <label className={lbl}>Ingredients</label>
                <input className={inp} value={form.ingredients} onChange={e => setForm({...form, ingredients: e.target.value})} placeholder="Comma separated list..." />
            </div>
            <div className="grid grid-cols-2 gap-4">
                <div>
                    <label className={lbl}>Dietary Tags</label>
                    <input className={inp} value={form.dietary_tags} onChange={e => setForm({...form, dietary_tags: e.target.value})} placeholder="Vegan, Gluten-free..." />
                </div>
                <div>
                    <label className={lbl}>Best Pairing</label>
                    <input className={inp} value={form.best_pairing} onChange={e => setForm({...form, best_pairing: e.target.value})} placeholder="Wine, Salad..." />
                </div>
            </div>
        </FormModalBase>
    )
}

// ─── INGREDIENT FORM ──────────────────────────────────────────────────────────

const IngredientFormModal = ({ ingredient, onSave, onClose }) => {
    const [form, setForm] = useState({
        name:            ingredient?.name || '',
        category:        ingredient?.category || '',
        flavor_profile:  ingredient?.flavor_profile || '',
        common_pairings: (ingredient?.common_pairings || []).join(', '),
        dietary_info:    (ingredient?.dietary_info || []).join(', '),
        season:          ingredient?.season || 'year-round',
    })

    const handleSubmit = () => onSave({
        ...form,
        common_pairings: form.common_pairings.split(',').map(s => s.trim()).filter(Boolean),
        dietary_info:    form.dietary_info.split(',').map(s => s.trim()).filter(Boolean),
    })

    const inp = "w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-sm font-medium focus:ring-2 focus:ring-amber-500/20 outline-none transition-all placeholder:text-slate-300 dark:placeholder:text-slate-600"
    const lbl = "text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1.5 block"

    return (
        <FormModalBase title={ingredient ? 'Edit Ingredient' : 'New Ingredient'} onSave={handleSubmit} onClose={onClose}>
            <div className="grid grid-cols-2 gap-4">
                <div>
                    <label className={lbl}>Name</label>
                    <input className={inp} value={form.name} onChange={e => setForm({...form, name: e.target.value})} placeholder="e.g. Saffron" />
                </div>
                <div>
                    <label className={lbl}>Category</label>
                    <select className={cn(inp, "appearance-none cursor-pointer")} value={form.category} onChange={e => setForm({...form, category: e.target.value})}>
                        <option value="">Select category...</option>
                        <option value="spice">Spice</option>
                        <option value="herb">Herb</option>
                        <option value="vegetable">Vegetable</option>
                        <option value="fruit">Fruit</option>
                        <option value="meat">Meat</option>
                        <option value="fish">Seafood</option>
                        <option value="dairy">Dairy</option>
                        <option value="oil">Oil / Fat</option>
                    </select>
                </div>
            </div>
            <div>
                <label className={lbl}>Description</label>
                <textarea className={cn(inp, "min-h-[90px] resize-none")} value={form.description} onChange={e => setForm({...form, description: e.target.value})} placeholder="Cultural context and characteristics..." />
            </div>
            <div className="grid grid-cols-2 gap-4">
                <div>
                    <label className={lbl}>Dietary Classification</label>
                    <input className={inp} value={form.dietary_info} onChange={e => setForm({...form, dietary_info: e.target.value})} placeholder="Vegan, Nut-free..." />
                </div>
                <div>
                    <label className={lbl}>Season</label>
                    <input className={inp} value={form.season} onChange={e => setForm({...form, season: e.target.value})} placeholder="Autumn, Year-round..." />
                </div>
            </div>
            <div>
                <label className={lbl}>Common Pairings</label>
                <input className={inp} value={form.common_pairings} onChange={e => setForm({...form, common_pairings: e.target.value})} placeholder="Comma separated..." />
            </div>
        </FormModalBase>
    )
}

// ─── SPOONACULAR ENRICHER ─────────────────────────────────────────────────────

function SpoonacularEnricher({ onImport, existingDishes = [], existingIngredients = [] }) {
    const [query, setQuery] = useState('')
    const searchMutation = useSpoonacularSearchMutation()
    const [results, setResults] = useState(null)
    const [open, setOpen] = useState(false)

    // Normalization for case-insensitive comparison
    const existingDishNames = new Set(existingDishes.map(d => d.name?.toLowerCase().trim()))
    const existingIngNames  = new Set(existingIngredients.map(i => i.name?.toLowerCase().trim()))

    const isDuplicate = (name, type) => {
        const normalized = name?.toLowerCase().trim()
        return type === 'dish' ? existingDishNames.has(normalized) : existingIngNames.has(normalized)
    }

    const handleSearch = async () => {
        if (!query.trim()) return
        const res = await searchMutation.mutateAsync({ query })
        setResults(res)
    }

    return (
        <div className="bg-white dark:bg-slate-900/50 rounded-[32px] lg:rounded-[40px] border border-slate-100 dark:border-slate-800/50 shadow-sm overflow-hidden">
            {/* Header row */}
            <button
                onClick={() => setOpen(v => !v)}
                className="w-full flex items-center justify-between px-6 py-5 hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-all"
            >
                <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-amber-50 dark:bg-amber-500/10 flex items-center justify-center">
                        <Sparkles size={16} className="text-amber-500" />
                    </div>
                    <div className="text-left">
                        <p className="font-semibold text-sm text-slate-900 dark:text-white">Spoonacular Enricher</p>
                        <p className="text-xs text-slate-400">Import dishes &amp; ingredients from external food database</p>
                    </div>
                </div>
                <ChevronRight size={16} className={cn('text-slate-400 transition-transform duration-200', open && 'rotate-90')} />
            </button>

            {/* Collapsible body */}
            <AnimatePresence>
                {open && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="overflow-hidden"
                    >
                        <div className="px-6 pb-6 space-y-5 border-t border-slate-100 dark:border-slate-800 pt-5">
                            {/* Search */}
                            <div className="flex gap-3">
                                <div className="relative flex-1">
                                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={16} />
                                    <input
                                        value={query}
                                        onChange={e => setQuery(e.target.value)}
                                        onKeyDown={e => e.key === 'Enter' && handleSearch()}
                                        placeholder="Search Spoonacular database..."
                                        className="w-full pl-10 pr-4 py-2.5 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-medium outline-none focus:ring-2 focus:ring-amber-500/20 transition-all"
                                    />
                                </div>
                                <button
                                    onClick={handleSearch}
                                    disabled={searchMutation.isPending}
                                    className="px-4 py-2.5 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-sm font-semibold flex items-center gap-2 transition-all disabled:opacity-60"
                                >
                                    {searchMutation.isPending ? <RefreshCw size={14} className="animate-spin" /> : <Search size={14} />}
                                    Search
                                </button>
                            </div>

                            {/* Results */}
                            {results && (
                                <div className="space-y-4">
                                    {/* Dishes */}
                                    {results.dishes?.length > 0 && (
                                        <div>
                                            <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide mb-2">
                                                Dishes ({results.dishes.length})
                                            </p>
                                            <div className="space-y-2 max-h-48 overflow-y-auto custom-scrollbar pr-1">
                                                {results.dishes.map(dish => {
                                                    const already = isDuplicate(dish.name, 'dish')
                                                    return (
                                                        <div key={dish.id} className={cn('flex items-center justify-between py-2 px-3 rounded-xl border', already ? 'bg-slate-50/50 dark:bg-slate-800/20 border-slate-100 dark:border-slate-700/30 opacity-60' : 'bg-slate-50 dark:bg-slate-800/50 border-slate-100 dark:border-slate-700/50')}>
                                                            <div className="flex items-center gap-3">
                                                                {dish.image && <img src={dish.image} alt="" className="w-8 h-8 rounded-lg object-cover" />}
                                                                <div>
                                                                    <span className="text-sm font-medium text-slate-800 dark:text-slate-200">{dish.name}</span>
                                                                    {already && <span className="ml-2 text-[10px] font-semibold text-slate-400 bg-slate-100 dark:bg-slate-700 px-1.5 py-0.5 rounded-full">Already in KG</span>}
                                                                </div>
                                                            </div>
                                                            {!already && (
                                                                <button
                                                                    onClick={() => onImport('dish', dish)}
                                                                    className="p-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 hover:bg-emerald-100 transition-all"
                                                                    title="Import to Knowledge Graph"
                                                                >
                                                                    <Download size={13} />
                                                                </button>
                                                            )}
                                                        </div>
                                                    )
                                                })}
                                            </div>
                                        </div>
                                    )}

                                    {/* Ingredients */}
                                    {results.ingredients?.length > 0 && (
                                        <div>
                                            <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide mb-2">
                                                Ingredients ({results.ingredients.length})
                                            </p>
                                            <div className="space-y-2 max-h-48 overflow-y-auto custom-scrollbar pr-1">
                                                {results.ingredients.map(ing => {
                                                    const already = isDuplicate(ing.name, 'ingredient')
                                                    return (
                                                        <div key={ing.id} className={cn('flex items-center justify-between py-2 px-3 rounded-xl border', already ? 'bg-slate-50/50 dark:bg-slate-800/20 border-slate-100 dark:border-slate-700/30 opacity-60' : 'bg-slate-50 dark:bg-slate-800/50 border-slate-100 dark:border-slate-700/50')}>
                                                            <div className="flex items-center gap-3">
                                                                {ing.image && <img src={ing.image} alt="" className="w-8 h-8 rounded-lg object-cover" />}
                                                                <div>
                                                                    <span className="text-sm font-medium text-slate-800 dark:text-slate-200">{ing.name}</span>
                                                                    {already && <span className="ml-2 text-[10px] font-semibold text-slate-400 bg-slate-100 dark:bg-slate-700 px-1.5 py-0.5 rounded-full">Already in KG</span>}
                                                                </div>
                                                            </div>
                                                            {!already && (
                                                                <button
                                                                    onClick={() => onImport('ingredient', ing)}
                                                                    className="p-1.5 rounded-lg bg-amber-50 dark:bg-amber-500/10 text-amber-600 hover:bg-amber-100 transition-all"
                                                                    title="Import to Knowledge Graph"
                                                                >
                                                                    <Download size={13} />
                                                                </button>
                                                            )}
                                                        </div>
                                                    )
                                                })}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    )
}

// ─── MERGE MODAL ──────────────────────────────────────────────────────────────
/**
 * UI for merging duplicates.
 * Shows groups of similar items, allows keeping one and deleting others.
 */
const MergeModal = ({ groups, type, onMerge, onClose }) => {
    const [selectedGroupIdx, setSelectedGroupIdx] = useState(0)
    const [masterId, setMasterId] = useState('')
    
    const activeGroup = groups[selectedGroupIdx] || []
    
    return (
        <FormModalBase title={`Merge Duplicate ${type}`} onClose={onClose} onSave={() => onMerge(activeGroup, masterId)}>
            <div className="space-y-6">
                {/* Group Selector */}
                <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-hide">
                    {groups.map((group, idx) => (
                        <button
                            key={idx}
                            onClick={() => {
                                setSelectedGroupIdx(idx)
                                setMasterId('')
                            }}
                            className={cn(
                                "px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-all border",
                                selectedGroupIdx === idx 
                                    ? "bg-indigo-600 border-indigo-600 text-white shadow-md shadow-indigo-500/20"
                                    : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400"
                            )}
                        >
                            Group {idx + 1} ({group[0]?.name})
                        </button>
                    ))}
                </div>

                <div className="p-4 bg-slate-50 dark:bg-slate-900/50 rounded-2xl border border-slate-100 dark:border-slate-800">
                    <p className="text-xs text-slate-500 mb-4">
                        Select WHICH entry to keep. Others in this group will be <span className="text-rose-500 font-bold uppercase">deleted</span>.
                    </p>
                    
                    <div className="space-y-3">
                        {activeGroup.map((item) => (
                            <div 
                                key={item.id}
                                onClick={() => setMasterId(item.id)}
                                className={cn(
                                    "p-4 rounded-xl border-2 cursor-pointer transition-all flex items-center justify-between",
                                    masterId === item.id 
                                        ? "border-indigo-500 bg-white dark:bg-slate-900 shadow-sm"
                                        : "border-transparent bg-white/50 dark:bg-slate-900/30 hover:border-slate-200 dark:hover:border-slate-700"
                                )}
                            >
                                <div className="flex-1 min-w-0">
                                    <h4 className="text-sm font-bold text-slate-900 dark:text-white truncate">{item.name}</h4>
                                    <p className="text-[10px] text-slate-400 mt-0.5 truncate uppercase">ID: {item.id.slice(0, 8)}...</p>
                                    <p className="text-xs text-slate-500 mt-1 line-clamp-1">{item.description || 'No description'}</p>
                                </div>
                                <div className={cn(
                                    "w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all",
                                    masterId === item.id ? "bg-indigo-600 border-indigo-600" : "border-slate-300 dark:border-slate-700"
                                )}>
                                    {masterId === item.id && <CheckCircle2 size={12} className="text-white" />}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="flex items-center gap-2 p-3 bg-indigo-50 dark:bg-indigo-500/10 rounded-xl text-indigo-700 dark:text-indigo-300">
                    <Info size={14} className="flex-shrink-0" />
                    <p className="text-[10px] font-medium leading-relaxed">
                        Currently, only simple merging is supported. Relationships registered via ID won't be updated. Use this primarily for cleaning name collisions.
                    </p>
                </div>
            </div>
        </FormModalBase>
    )
}

// ─── MAIN PAGE ────────────────────────────────────────────────────────────────

const TABS = [
    { id: 'cuisines',    label: 'Cuisines',    icon: Globe,          accent: 'indigo' },
    { id: 'dishes',      label: 'Dishes',      icon: UtensilsCrossed, accent: 'emerald' },
    { id: 'ingredients', label: 'Ingredients', icon: Carrot,          accent: 'amber' },
]

const AdminKnowledgeGraphPage = () => {
    const queryClient = useQueryClient()

    const [activeTab, setActiveTab]   = useState('cuisines')
    const [searchTerm, setSearchTerm] = useState('')
    const [showModal, setShowModal]   = useState(null)
    const [isInfoOpen, setIsInfoOpen] = useState(false)
    const [toast, setToast]           = useState(null)
    const [syncStatus, setSyncStatus] = useState(null)
    const [showMergeModal, setShowMergeModal] = useState(false)
    const [duplicateGroups, setDuplicateGroups] = useState([])

    const { data: cuisines     = [], isLoading: loadingCuisines,    error: cuisinesError,    refetch: refetchCuisines    } = useCuisines()
    const { data: dishes       = [], isLoading: loadingDishes,      error: dishesError,      refetch: refetchDishes      } = useDishes()
    const { data: ingredients  = [], isLoading: loadingIngredients, error: ingredientsError, refetch: refetchIngredients } = useIngredients()

    const combinedError = cuisinesError || dishesError || ingredientsError

    const createCuisine    = useCreateCuisineMutation()
    const updateCuisine    = useUpdateCuisineMutation()
    const deleteCuisine    = useDeleteCuisineMutation()
    const createDish       = useCreateDishMutation()
    const updateDish       = useUpdateDishMutation()
    const deleteDish       = useDeleteDishMutation()
    const createIngredient = useCreateIngredientMutation()
    const updateIngredient = useUpdateIngredientMutation()
    const deleteIngredient = useDeleteIngredientMutation()
    const syncKG           = useSyncKGToLocationsMutation()

    const handleMerge = async (group, keepId) => {
        if (!keepId) {
            alert('Select which record to keep first')
            return
        }

        const toDeleteIds = group.filter(i => i.id !== keepId).map(i => i.id)
        try {
            await mergeEntities(activeTab, keepId, toDeleteIds)
            
            showToast(`Merged ${toDeleteIds.length} duplicates into master record`)
            setShowMergeModal(false)
            setDuplicateGroups([])
            
            // Refetch to sync UI
            handleBatchComplete()
        } catch (e) {
            showToast('Merge failed: ' + e.message, 'error')
        }
    }

    const checkForDuplicates = () => {
        const source = activeTab === 'cuisines' ? cuisines : activeTab === 'dishes' ? dishes : ingredients
        if (!source || source.length === 0) return

        // Simple normalization for grouping
        const norm = (str) => (str || '')
            .toLowerCase()
            .replace(/^(the|a|an|le|la|el|los|las|de|di|of|для|этот|эта)\s+/i, '')
            .replace(/\s+(cuisine|food|cooking|kitchen|dish|dishes|style|traditions|tradition|recipes|recipe|кухня|блюда|ингредиент|ингредиенты)$/i, '')
            .replace(/[^a-z0-9а-яё]/gi, '')
            .replace(/e?s$/, '') 
            .trim()
        
        const groups = {}
        source.forEach(item => {
            const n = norm(item.name)
            if (!groups[n]) groups[n] = []
            groups[n].push(item)
        })

        const duplicates = Object.values(groups).filter(g => g.length > 1)
        if (duplicates.length === 0) {
            showToast('No duplicates found in ' + activeTab, 'info')
            return
        }

        setDuplicateGroups(duplicates)
        setShowMergeModal(true)
    }

    const showToast = (message, type = 'success') => {
        setToast({ message, type })
        setTimeout(() => setToast(null), 3000)
    }

    const handleSyncLocations = async () => {
        try {
            await syncKG.mutateAsync((current, total) => {
                setSyncStatus({ current, total, progress: Math.round((current / total) * 100) })
            })
            showToast('Knowledge Graph synced successfully')
            setSyncStatus(null)
        } catch {
            showToast('Sync failed', 'error')
            setSyncStatus(null)
        }
    }

    const handleSaveCuisine = async (data) => {
        try {
            if (showModal?.data?.id) {
                await updateCuisine.mutateAsync({ id: showModal.data.id, updates: data })
                showToast('Cuisine updated')
            } else {
                await createCuisine.mutateAsync(data)
                showToast('Cuisine added')
            }
            setShowModal(null)
        } catch { showToast('Operation failed', 'error') }
    }

    const handleSaveDish = async (data) => {
        try {
            if (showModal?.data?.id) {
                await updateDish.mutateAsync({ id: showModal.data.id, updates: data })
                showToast('Dish updated')
            } else {
                await createDish.mutateAsync(data)
                showToast('Dish added')
            }
            setShowModal(null)
        } catch { showToast('Operation failed', 'error') }
    }

    const handleSaveIngredient = async (data) => {
        try {
            if (showModal?.data?.id) {
                await updateIngredient.mutateAsync({ id: showModal.data.id, updates: data })
                showToast('Ingredient updated')
            } else {
                await createIngredient.mutateAsync(data)
                showToast('Ingredient added')
            }
            setShowModal(null)
        } catch { showToast('Operation failed', 'error') }
    }

    // ── AI Agent save handler ─────────────────────────────────────────────────
    const handleAgentSave = async (type, data) => {
        // Используем прямые API функции вместо мутаций React Query
        // чтобы избежать side effects (invalidateQueries, onError toast и т.д.)
        // которые могут прерывать batch save.
        // NOTE: НЕ рефетчим после каждого сохранения — это делает handleBatchComplete
        // после завершения всего batch (экономит сетевые запросы).
        if (type === 'cuisine')         return await createCuisineApi(data)
        else if (type === 'dish')       return await createDishApi(data)
        else if (type === 'ingredient') return await createIngredientApi(data)
        else throw new Error(`Unknown type: ${type}`)
    }

    // ── KG Enrichment: update single cuisine with AI-filled fields ─────────────
    const updateCuisineMutation = useUpdateCuisineMutation()
    const handleCuisineEnriched = useCallback(async (id, updates) => {
        await updateCuisineMutation.mutateAsync({ id, updates })
        // Invalidate cache so list refreshes
        invalidateCacheGroup('cuisines')
        await queryClient.invalidateQueries({ queryKey: ['knowledge-cuisines'] })
    }, [updateCuisineMutation, queryClient])

    // ── After batch save: flush ALL caches so UI shows new data ────────────────
    const handleBatchComplete = (savedCount, errors) => {
        // 1. Wipe localStorage L2 cache for all KG entities
        invalidateCacheGroup('cuisines')
        invalidateCacheGroup('dishes')
        invalidateCacheGroup('ingredients')
        // 2. Force React Query to re-fetch from Supabase (not from cache)
        queryClient.removeQueries({ queryKey: ['knowledge-cuisines'] })
        queryClient.removeQueries({ queryKey: ['knowledge-dishes'] })
        queryClient.removeQueries({ queryKey: ['knowledge-ingredients'] })
        queryClient.removeQueries({ queryKey: ['knowledge-stats'] })
        // 3. Trigger immediate refetch
        setTimeout(() => {
            refetchCuisines()
            refetchDishes()
            refetchIngredients()
        }, 300)
    }

    const filteredItems = useMemo(() => {
        const source = activeTab === 'cuisines' ? cuisines : activeTab === 'dishes' ? dishes : ingredients
        const items  = Array.isArray(source) ? source : []
        const q      = searchTerm.toLowerCase()
        return items.filter(item => {
            if (!item) return false
            return (item.name || '').toLowerCase().includes(q)
                || (item.description || '').toLowerCase().includes(q)
                || (item.region || '').toLowerCase().includes(q)
                || (item.origin_country || '').toLowerCase().includes(q)
        })
    }, [activeTab, cuisines, dishes, ingredients, searchTerm])

    const isCurrentTabLoading =
        (activeTab === 'cuisines'     && loadingCuisines)     ||
        (activeTab === 'dishes'       && loadingDishes)       ||
        (activeTab === 'ingredients'  && loadingIngredients)

    const counts = { cuisines: cuisines.length, dishes: dishes.length, ingredients: ingredients.length }

    const stats = [
        { label: 'Cuisines',     val: cuisines.length,     Icon: Globe,           bg: 'bg-indigo-50 dark:bg-indigo-500/10',  color: 'text-indigo-600' },
        { label: 'Dishes',       val: dishes.length,       Icon: UtensilsCrossed, bg: 'bg-emerald-50 dark:bg-emerald-500/10', color: 'text-emerald-600' },
        { label: 'Ingredients',  val: ingredients.length,  Icon: Carrot,          bg: 'bg-amber-50 dark:bg-amber-500/10',    color: 'text-amber-600' },
        { label: 'Total Nodes',  val: cuisines.length + dishes.length + ingredients.length,
          Icon: Brain,  bg: 'bg-slate-100 dark:bg-slate-800', color: 'text-slate-600 dark:text-slate-400' },
    ]

    return (
        <div className="space-y-6 lg:space-y-8 pb-12 font-sans">

            {/* ── Toast ── */}
            <AnimatePresence>
                {toast && (
                    <motion.div
                        initial={{ opacity: 0, y: -16 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -16 }}
                        className={cn(
                            "fixed top-24 right-8 z-[9999] px-5 py-3 rounded-2xl text-white text-sm font-semibold shadow-xl flex items-center gap-2 border backdrop-blur-md",
                            toast.type === 'success'
                                ? "bg-slate-900/95 border-white/10"
                                : "bg-rose-600/95 border-rose-400/20"
                        )}
                    >
                        {toast.type === 'success'
                            ? <CheckCircle2 size={15} className="text-emerald-400" />
                            : <AlertCircle  size={15} className="text-rose-200"    />
                        }
                        {toast.message}
                    </motion.div>
                )}
            </AnimatePresence>

            {/* ── Header ── */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4">
                <div>
                    <h1 className="text-xl lg:text-3xl font-bold text-slate-900 dark:text-white leading-none tracking-tight">
                        Knowledge Graph
                    </h1>
                    <p className="text-slate-500 dark:text-slate-400 font-medium mt-1.5 text-xs lg:text-base">
                        Culinary ontology — cuisines, dishes &amp; ingredients.
                    </p>
                </div>

                <div className="flex items-center gap-2">
                    <button
                        onClick={() => setIsInfoOpen(true)}
                        className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-400 hover:text-indigo-600 hover:border-indigo-200 transition-all shadow-sm"
                    >
                        <Info size={15} />
                        <span className="hidden sm:inline">How it works</span>
                    </button>

                    <button
                        onClick={handleSyncLocations}
                        disabled={syncKG.isPending}
                        className="h-10 px-4 flex items-center gap-2 rounded-2xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-indigo-300 hover:text-indigo-600 text-sm font-medium transition-all disabled:opacity-50"
                    >
                        <RefreshCw size={15} className={syncKG.isPending ? 'animate-spin' : ''} />
                        <span className="hidden sm:inline">Sync Graph</span>
                    </button>

                    <button
                        onClick={() => setShowModal({ type: activeTab.slice(0, -1), data: null })}
                        className="h-10 px-4 flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl text-sm font-semibold transition-all shadow-sm"
                    >
                        <Plus size={16} />
                        <span className="hidden sm:inline">Add {activeTab.slice(0, -1)}</span>
                    </button>
                </div>
            </div>

            {/* ── Stats ── */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-5">
                {stats.map((s, i) => (
                    <motion.div
                        key={s.label}
                        initial={{ opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.06 }}
                        className="bg-white dark:bg-slate-900/50 p-4 lg:p-6 rounded-[24px] lg:rounded-[32px] border border-slate-100 dark:border-slate-800/50 shadow-sm flex items-center gap-4"
                    >
                        <div className={cn('w-10 h-10 lg:w-12 lg:h-12 rounded-2xl flex items-center justify-center flex-shrink-0', s.bg)}>
                            <s.Icon size={18} className={s.color} />
                        </div>
                        <div>
                            <p className="text-[10px] font-bold uppercase text-slate-400 dark:text-slate-500 tracking-widest">{s.label}</p>
                            <p className="text-lg lg:text-2xl font-bold text-slate-900 dark:text-white leading-none mt-0.5">{s.val}</p>
                        </div>
                    </motion.div>
                ))}
            </div>

            {/* ── Sync progress ── */}
            <AnimatePresence>
                {syncStatus && (
                    <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-100 dark:border-indigo-500/20 rounded-2xl p-5"
                    >
                        <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-2 text-sm font-semibold text-indigo-700 dark:text-indigo-400">
                                <RefreshCw size={14} className="animate-spin" />
                                Syncing locations… {syncStatus.current}/{syncStatus.total}
                            </div>
                            <span className="text-sm font-bold text-indigo-600">{syncStatus.progress}%</span>
                        </div>
                        <div className="h-2 bg-indigo-100 dark:bg-indigo-900/40 rounded-full overflow-hidden">
                            <motion.div
                                className="h-full bg-indigo-500 rounded-full"
                                initial={{ width: 0 }}
                                animate={{ width: `${syncStatus.progress}%` }}
                            />
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* ── Error UI ── */}
            {combinedError && (
                <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mb-8 p-6 bg-red-50/50 dark:bg-red-900/10 border border-red-100 dark:border-red-900/20 rounded-[32px] flex items-start gap-4"
                >
                    <div className="w-12 h-12 rounded-2xl bg-red-100/50 dark:bg-red-900/20 flex items-center justify-center text-red-600 flex-shrink-0">
                        <AlertCircle size={24} />
                    </div>
                    <div className="flex-1 pt-1">
                        <h3 className="text-sm font-bold text-red-900 dark:text-red-300 mb-1">
                            Failed to Load Knowledge Graph Data
                        </h3>
                        <p className="text-xs font-medium text-red-600/80 leading-relaxed max-w-2xl">
                            {combinedError.message || 'An unexpected error occurred while fetching data from Supabase. Please check your connection or RLS policies.'}
                        </p>
                        <div className="mt-4 flex gap-2">
                            <button
                                onClick={() => window.location.reload()}
                                className="px-4 py-2 bg-red-100/50 hover:bg-red-200/50 dark:bg-red-900/20 dark:hover:bg-red-800/20 text-red-700 dark:text-red-400 text-[11px] font-bold rounded-xl transition-all"
                            >
                                Retry Connection
                            </button>
                        </div>
                    </div>
                </motion.div>
            )}

            {/* ── AI Agent ── */}
            <KGAIAgent
                cuisines={cuisines}
                dishes={dishes}
                ingredients={ingredients}
                onSaved={handleAgentSave}
                onBatchComplete={handleBatchComplete}
            />

            {/* ── KG Enrichment ── */}
            <KGEnrichmentAgent
                cuisines={cuisines}
                onEnriched={handleCuisineEnriched}
            />

            {/* ── Spoonacular ── */}
            <SpoonacularEnricher
                existingDishes={dishes}
                existingIngredients={ingredients}
                onImport={(type, data) => {
                    if (type === 'dish') {
                        // Check if dish already exists — if so, offer missing ingredients only
                        const existingDish = dishes.find(d =>
                            d.name?.toLowerCase().trim() === data.name?.toLowerCase().trim()
                        )
                        if (existingDish) {
                            const existingIngNames = new Set(ingredients.map(i => i.name?.toLowerCase().trim()))
                            const dishIngNames = new Set((existingDish.ingredients || []).map(n => n?.toLowerCase().trim()))
                            const incomingIngs = (data.ingredients || []).filter(ing =>
                                !existingIngNames.has(ing?.toLowerCase?.().trim()) &&
                                !dishIngNames.has(ing?.toLowerCase?.().trim())
                            )
                            if (incomingIngs.length > 0) {
                                showToast(`Dish exists. ${incomingIngs.length} new ingredient(s) ready to add`, 'info')
                                incomingIngs.forEach(ingName => handleSaveIngredient({ name: ingName }))
                            } else {
                                showToast(`"${data.name}" and all its ingredients already exist in KG`, 'info')
                            }
                        } else {
                            handleSaveDish(data)
                        }
                    }
                    if (type === 'ingredient') handleSaveIngredient(data)
                }}
            />

            {/* ── Main list card ── */}
            <div className="bg-white dark:bg-slate-900/50 rounded-[32px] lg:rounded-[40px] border border-slate-100 dark:border-slate-800/50 shadow-sm overflow-hidden flex flex-col">

                {/* Toolbar */}
                <div className="p-4 lg:p-6 border-b border-slate-50 dark:border-slate-800/50 flex flex-col sm:flex-row sm:items-center gap-4">
                    {/* Tabs */}
                    <div className="flex gap-1 bg-slate-50 dark:bg-slate-950/50 p-1 rounded-2xl border border-slate-100 dark:border-slate-800/50 flex-shrink-0">
                        {TABS.map(tab => {
                            const active = activeTab === tab.id
                            return (
                                <button
                                    key={tab.id}
                                    onClick={() => { setActiveTab(tab.id); setSearchTerm('') }}
                                    className={cn(
                                        "flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all",
                                        active
                                            ? "bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm border border-slate-100 dark:border-slate-700"
                                            : "text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                                    )}
                                >
                                    <tab.icon size={13} />
                                    {tab.label}
                                    <span className={cn(
                                        "px-1.5 py-0.5 rounded-full text-[10px] font-bold",
                                        active ? "bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400" : "bg-slate-100 dark:bg-slate-800 text-slate-400"
                                    )}>
                                        {counts[tab.id]}
                                    </span>
                                </button>
                            )
                        })}
                    </div>

                    {/* Duplicate Finder */}
                    <button
                        onClick={checkForDuplicates}
                        className="h-9 px-3 flex items-center gap-2 rounded-xl text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-500/10 text-[11px] font-bold uppercase tracking-wider transition-all border border-transparent hover:border-indigo-100"
                        title="Scan current tab for duplicate names"
                    >
                        <Zap size={14} className="text-amber-500" />
                        Clean Duplicates
                    </button>

                    {/* Search */}
                    <div className="relative flex-1 group">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-indigo-500 transition-colors" size={15} />
                        <input
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            placeholder={`Search ${activeTab}…`}
                            className="w-full pl-10 pr-4 py-2.5 bg-slate-50 dark:bg-slate-950/30 border-none rounded-2xl text-[13px] font-medium outline-none focus:ring-2 ring-indigo-500/10 transition-all shadow-inner"
                        />
                    </div>

                    <button
                        onClick={() => {
                            import('@/shared/lib/cache').then(({ invalidateCacheGroup }) => {
                                invalidateCacheGroup('cuisines')
                                invalidateCacheGroup('dishes')
                                invalidateCacheGroup('ingredients')
                            })
                            queryClient.removeQueries({ queryKey: ['knowledge-cuisines'] })
                            queryClient.removeQueries({ queryKey: ['knowledge-dishes'] })
                            queryClient.removeQueries({ queryKey: ['knowledge-ingredients'] })
                            setTimeout(() => { refetchCuisines(); refetchDishes(); refetchIngredients() }, 100)
                        }}
                        className="h-10 px-3 flex items-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:border-indigo-300 dark:hover:border-indigo-600 transition-colors text-xs font-medium"
                        title="Clear cache and reload from database"
                    >
                        ↺
                    </button>
                    <button className="h-10 px-3 flex items-center gap-2 rounded-2xl border border-slate-200 dark:border-slate-700 text-slate-400 hover:text-indigo-500 hover:border-indigo-300 transition-all flex-shrink-0">
                        <Filter size={14} />
                        <span className="text-xs font-medium hidden sm:inline">Filter</span>
                    </button>
                </div>

                {/* List */}
                <div className="p-4 lg:p-6 space-y-2 min-h-[320px]">
                    <AnimatePresence mode="popLayout" initial={false}>
                        {isCurrentTabLoading ? (
                            <div className="flex flex-col items-center justify-center py-16 gap-4">
                                <div className="w-10 h-10 rounded-2xl bg-slate-100 dark:bg-slate-800 animate-pulse" />
                                <div className="h-3 w-32 bg-slate-100 dark:bg-slate-800 rounded-full animate-pulse" />
                            </div>
                        ) : filteredItems.length > 0 ? (
                            filteredItems.map((item, idx) => (
                                <ListItem
                                    key={item.id}
                                    type={activeTab}
                                    item={item}
                                    idx={idx}
                                    onEdit={obj => setShowModal({ type: activeTab.slice(0, -1), data: obj })}
                                    onDelete={async id => {
                                        if (confirm('Delete this entry? This cannot be undone.')) {
                                            if (activeTab === 'cuisines')     await deleteCuisine.mutateAsync(id)
                                            else if (activeTab === 'dishes')  await deleteDish.mutateAsync(id)
                                            else                              await deleteIngredient.mutateAsync(id)
                                            showToast('Entry deleted')
                                        }
                                    }}
                                />
                            ))
                        ) : (
                            <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                className="flex flex-col items-center justify-center py-16 border-2 border-dashed border-slate-100 dark:border-slate-800 rounded-2xl"
                            >
                                <div className="w-12 h-12 bg-slate-50 dark:bg-slate-800 rounded-2xl flex items-center justify-center mb-3 text-slate-300">
                                    <Search size={22} />
                                </div>
                                <p className="font-semibold text-slate-500 dark:text-slate-400">
                                    {searchTerm ? 'No matches found' : `No ${activeTab} yet`}
                                </p>
                                <p className="text-xs text-slate-400 mt-1">
                                    {searchTerm ? 'Try a different search term' : `Click "Add ${activeTab.slice(0,-1)}" to get started`}
                                </p>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>

                {/* Footer count */}
                {filteredItems.length > 0 && (
                    <div className="px-6 py-3 border-t border-slate-50 dark:border-slate-800/50 flex items-center justify-between">
                        <p className="text-xs text-slate-400 font-medium">
                            Showing {filteredItems.length} of {counts[activeTab]} {activeTab}
                        </p>
                        <button
                            onClick={() => setShowModal({ type: activeTab.slice(0, -1), data: null })}
                            className="flex items-center gap-1.5 text-xs font-semibold text-indigo-500 hover:text-indigo-600 transition-colors"
                        >
                            <Plus size={13} />
                            Add {activeTab.slice(0, -1)}
                        </button>
                    </div>
                )}
            </div>

            {/* ── Modals ── */}
            <AnimatePresence>
                {showModal?.type === 'cuisine' && (
                    <CuisineFormModal cuisine={showModal.data} onSave={handleSaveCuisine} onClose={() => setShowModal(null)} />
                )}
                {showModal?.type === 'dish' && (
                    <DishFormModal dish={showModal.data} onSave={handleSaveDish} onClose={() => setShowModal(null)} />
                )}
                {showModal?.type === 'ingredient' && (
                    <IngredientFormModal ingredient={showModal.data} onSave={handleSaveIngredient} onClose={() => setShowModal(null)} />
                )}
                {isInfoOpen && (
                    <InfoModal onClose={() => setIsInfoOpen(false)} />
                )}
                {showMergeModal && (
                    <MergeModal 
                        groups={duplicateGroups} 
                        type={activeTab.slice(0, -1)} 
                        onMerge={handleMerge}
                        onClose={() => setShowMergeModal(false)} 
                    />
                )}
            </AnimatePresence>
        </div>
    )
}

export default AdminKnowledgeGraphPage
