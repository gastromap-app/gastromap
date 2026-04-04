import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
    Brain, ChefHat, UtensilsCrossed, Plus, Search,
    Edit2, Trash2, X, Save, Leaf,
    Globe, Sparkles, Loader2, BookOpen, RefreshCw, Zap, Package, Download
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { 
    useCuisines, useCreateCuisineMutation, useUpdateCuisineMutation, useDeleteCuisineMutation,
    useDishes, useCreateDishMutation, useUpdateDishMutation, useDeleteDishMutation,
    useIngredients, useCreateIngredientMutation, useUpdateIngredientMutation, useDeleteIngredientMutation,
    useKnowledgeStats, useSyncKGToLocationsMutation,
    useSpoonacularSearchMutation
} from '@/shared/api/queries'

/**
 * ─── HELPER COMPONENTS ───────────────────────────────────────────────────────
 */

const StatsCard = ({ icon: Icon, label, value, color, bgColor }) => (
    <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800">
        <div className="flex items-center gap-3">
            <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center', bgColor)}>
                <Icon size={20} className={color} />
            </div>
            <div>
                <p className="text-2xl font-black text-slate-900 dark:text-white">{value}</p>
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">{label}</p>
            </div>
        </div>
    </div>
)

const CuisineCard = ({ cuisine, onEdit, onDelete }) => (
    <motion.div
        layout
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, x: -20 }}
        className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 hover:border-indigo-500/30 transition-all group"
    >
        <div className="flex items-start justify-between mb-3">
            <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-500/10 flex items-center justify-center text-indigo-500">
                    <Globe size={20} />
                </div>
                <div>
                    <h3 className="font-bold text-slate-900 dark:text-white">{cuisine.name}</h3>
                    <p className="text-[10px] text-slate-500 uppercase tracking-wider">{cuisine.region || 'Global'}</p>
                </div>
            </div>
            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button onClick={() => onEdit(cuisine)} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg">
                    <Edit2 size={14} className="text-slate-400" />
                </button>
                <button onClick={() => onDelete(cuisine.id)} className="p-2 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg">
                    <Trash2 size={14} className="text-red-400" />
                </button>
            </div>
        </div>
        <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 mb-3">{cuisine.description}</p>
        <div className="flex flex-wrap gap-1">
            {(cuisine.typical_dishes || []).slice(0, 4).map(dish => (
                <span key={dish} className="px-2 py-0.5 bg-slate-100 dark:bg-slate-800 rounded text-[10px] text-slate-600 dark:text-slate-400">
                    {dish}
                </span>
            ))}
            {(cuisine.typical_dishes || []).length > 4 && (
                <span className="text-[10px] text-slate-400">+{(cuisine.typical_dishes || []).length - 4} more</span>
            )}
        </div>
    </motion.div>
)

const DishCard = ({ dish, onEdit, onDelete }) => (
    <motion.div
        layout
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, x: -20 }}
        className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 hover:border-emerald-500/30 transition-all group"
    >
        <div className="flex items-start justify-between mb-3">
            <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-500">
                    <UtensilsCrossed size={20} />
                </div>
                <div>
                    <h3 className="font-bold text-slate-900 dark:text-white">{dish.name}</h3>
                    <p className="text-[10px] text-slate-500 uppercase tracking-wider">{dish.cuisine?.name || 'Unknown'}</p>
                </div>
            </div>
            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button onClick={() => onEdit(dish)} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg">
                    <Edit2 size={14} className="text-slate-400" />
                </button>
                <button onClick={() => onDelete(dish.id)} className="p-2 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg">
                    <Trash2 size={14} className="text-red-400" />
                </button>
            </div>
        </div>
        <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 mb-3">{dish.description}</p>
        <div className="flex items-center gap-2">
            <span className="text-[10px] text-slate-500 uppercase tracking-widest font-black">Flavor:</span>
            <span className="text-xs font-medium text-slate-700 dark:text-slate-300 capitalize">{dish.flavor_notes}</span>
        </div>
    </motion.div>
)

const IngredientCard = ({ ingredient, onEdit, onDelete }) => (
    <motion.div
        layout
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, x: -20 }}
        className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 hover:border-amber-500/30 transition-all group"
    >
        <div className="flex items-start justify-between mb-3">
            <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-500">
                    <Leaf size={20} />
                </div>
                <div>
                    <h3 className="font-bold text-slate-900 dark:text-white capitalize">{ingredient.name}</h3>
                    <p className="text-[10px] text-slate-500 uppercase tracking-wider">{ingredient.category}</p>
                </div>
            </div>
            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button onClick={() => onEdit(ingredient)} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg">
                    <Edit2 size={14} className="text-slate-400" />
                </button>
                <button onClick={() => onDelete(ingredient.id)} className="p-2 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg">
                    <Trash2 size={14} className="text-red-400" />
                </button>
            </div>
        </div>
        <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 mb-3">{ingredient.flavor_profile}</p>
        <div className="flex flex-wrap gap-1">
            {(ingredient.dietary_info || []).map(tag => (
                <span key={tag} className="px-2 py-0.5 bg-green-100 dark:bg-green-500/10 rounded text-[10px] text-green-600 dark:text-green-400 font-bold uppercase tracking-tighter">
                    {tag}
                </span>
            ))}
        </div>
    </motion.div>
)

/**
 * ─── MODAL COMPONENTS ────────────────────────────────────────────────────────
 */

const FormModalBase = ({ title, onSave, onClose, children }) => (
    <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
        onClick={onClose}
    >
        <motion.div
            initial={{ scale: 0.95, y: 20 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.95, y: 20 }}
            onClick={e => e.stopPropagation()}
            className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-[32px] shadow-2xl border border-slate-200 dark:border-slate-800 max-h-[90vh] overflow-hidden flex flex-col"
        >
            <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                <h2 className="text-xl font-black text-slate-900 dark:text-white uppercase tracking-tight">{title}</h2>
                <button onClick={onClose} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg">
                    <X size={18} />
                </button>
            </div>
            <div className="p-6 space-y-4 overflow-y-auto">
                {children}
            </div>
            <div className="p-6 border-t border-slate-100 dark:border-slate-800 flex gap-3 justify-end">
                <button
                    onClick={onClose}
                    className="px-6 py-2.5 rounded-xl font-bold text-sm text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                    Cancel
                </button>
                <button
                    onClick={onSave}
                    className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-sm flex items-center gap-2"
                >
                    <Save size={16} />
                    Save Changes
                </button>
            </div>
        </motion.div>
    </motion.div>
)

const CuisineFormModal = ({ cuisine, onSave, onClose }) => {
    const [form, setForm] = useState({
        name: cuisine?.name || '',
        description: cuisine?.description || '',
        region: cuisine?.region || '',
        aliases: (cuisine?.aliases || []).join(', '),
        typical_dishes: (cuisine?.typical_dishes || []).join(', '),
        key_ingredients: (cuisine?.key_ingredients || []).join(', '),
        flavor_profile: cuisine?.flavor_profile || '',
    })

    const handleSubmit = () => {
        onSave({
            ...form,
            aliases: form.aliases.split(',').map(s => s.trim()).filter(Boolean),
            typical_dishes: form.typical_dishes.split(',').map(s => s.trim()).filter(Boolean),
            key_ingredients: form.key_ingredients.split(',').map(s => s.trim()).filter(Boolean),
        })
    }

    return (
        <FormModalBase title={cuisine ? 'Edit Cuisine' : 'New Cuisine'} onSave={handleSubmit} onClose={onClose}>
            <div className="space-y-4">
                <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 block">Name</label>
                    <input className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-sm font-medium focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all" value={form.name} onChange={e => setForm({...form, name: e.target.value})} placeholder="e.g. Italian" />
                </div>
                <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 block">Description</label>
                    <textarea className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-sm font-medium h-24 focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all" value={form.description} onChange={e => setForm({...form, description: e.target.value})} placeholder="Cultural context..." />
                </div>
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 block">Region</label>
                        <input className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-sm font-medium focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all" value={form.region} onChange={e => setForm({...form, region: e.target.value})} placeholder="e.g. Mediterranean" />
                    </div>
                    <div>
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 block">Flavor Profile</label>
                        <input className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-sm font-medium focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all" value={form.flavor_profile} onChange={e => setForm({...form, flavor_profile: e.target.value})} placeholder="e.g. savory, herbal" />
                    </div>
                </div>
                <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 block">Typical Dishes (Comma separated)</label>
                    <input className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-sm font-medium focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all" value={form.typical_dishes} onChange={e => setForm({...form, typical_dishes: e.target.value})} placeholder="pasta, pizza, risotto..." />
                </div>
            </div>
        </FormModalBase>
    )
}

const DishFormModal = ({ dish, onSave, onClose }) => {
    const { data: cuisines = [] } = useCuisines()
    const [form, setForm] = useState({
        name: dish?.name || '',
        cuisine_id: dish?.cuisine_id || '',
        description: dish?.description || '',
        ingredients: (dish?.ingredients || []).join(', '),
        preparation_style: dish?.preparation_style || '',
        dietary_tags: (dish?.dietary_tags || []).join(', '),
        flavor_notes: dish?.flavor_notes || '',
        best_pairing: dish?.best_pairing || '',
    })

    const handleSubmit = () => {
        onSave({
            ...form,
            ingredients: form.ingredients.split(',').map(s => s.trim()).filter(Boolean),
            dietary_tags: form.dietary_tags.split(',').map(s => s.trim()).filter(Boolean),
        })
    }

    return (
        <FormModalBase title={dish ? 'Edit Dish' : 'New Dish'} onSave={handleSubmit} onClose={onClose}>
            <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 block">Name</label>
                        <input className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-sm font-medium focus:ring-2 focus:ring-emerald-500/20 outline-none transition-all" value={form.name} onChange={e => setForm({...form, name: e.target.value})} placeholder="e.g. Carbonara" />
                    </div>
                    <div>
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 block">Cuisine</label>
                        <select 
                            className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-sm font-medium focus:ring-2 focus:ring-emerald-500/20 outline-none transition-all"
                            value={form.cuisine_id}
                            onChange={e => setForm({...form, cuisine_id: e.target.value})}
                        >
                            <option value="">Select Cuisine</option>
                            {cuisines.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </select>
                    </div>
                </div>
                <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 block">Description</label>
                    <textarea className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-sm font-medium h-20 focus:ring-2 focus:ring-emerald-500/20 outline-none transition-all" value={form.description} onChange={e => setForm({...form, description: e.target.value})} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 block">Style</label>
                        <input className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-sm font-medium focus:ring-2 focus:ring-emerald-500/20 outline-none transition-all" value={form.preparation_style} onChange={e => setForm({...form, preparation_style: e.target.value})} placeholder="e.g. Grilled" />
                    </div>
                    <div>
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 block">Dietary (Comma sep.)</label>
                        <input className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-sm font-medium focus:ring-2 focus:ring-emerald-500/20 outline-none transition-all" value={form.dietary_tags} onChange={e => setForm({...form, dietary_tags: e.target.value})} placeholder="Vegan, GF..." />
                    </div>
                </div>
                <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 block">Ingredients (Comma separated)</label>
                    <input className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-sm font-medium focus:ring-2 focus:ring-emerald-500/20 outline-none transition-all" value={form.ingredients} onChange={e => setForm({...form, ingredients: e.target.value})} />
                </div>
            </div>
        </FormModalBase>
    )
}

const IngredientFormModal = ({ ingredient, onSave, onClose }) => {
    const [form, setForm] = useState({
        name: ingredient?.name || '',
        category: ingredient?.category || '',
        flavor_profile: ingredient?.flavor_profile || '',
        common_pairings: (ingredient?.common_pairings || []).join(', '),
        dietary_info: (ingredient?.dietary_info || []).join(', '),
        season: ingredient?.season || '',
    })

    const handleSubmit = () => {
        onSave({
            ...form,
            common_pairings: form.common_pairings.split(',').map(s => s.trim()).filter(Boolean),
            dietary_info: form.dietary_info.split(',').map(s => s.trim()).filter(Boolean),
        })
    }

    return (
        <FormModalBase title={ingredient ? 'Edit Ingredient' : 'New Ingredient'} onSave={handleSubmit} onClose={onClose}>
            <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 block">Name</label>
                        <input className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-sm font-medium focus:ring-2 focus:ring-amber-500/20 outline-none transition-all" value={form.name} onChange={e => setForm({...form, name: e.target.value})} />
                    </div>
                    <div>
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 block">Category</label>
                        <input className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-sm font-medium focus:ring-2 focus:ring-amber-500/20 outline-none transition-all" value={form.category} onChange={e => setForm({...form, category: e.target.value})} placeholder="e.g. spice, dairy" />
                    </div>
                </div>
                <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 block">Flavor Profile</label>
                    <input className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-sm font-medium focus:ring-2 focus:ring-amber-500/20 outline-none transition-all" value={form.flavor_profile} onChange={e => setForm({...form, flavor_profile: e.target.value})} placeholder="e.g. Earthy, pungent" />
                </div>
                <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 block">Common Pairings (Comma sep.)</label>
                    <input className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-sm font-medium focus:ring-2 focus:ring-amber-500/20 outline-none transition-all" value={form.common_pairings} onChange={e => setForm({...form, common_pairings: e.target.value})} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 block">Season</label>
                        <input className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-sm font-medium focus:ring-2 focus:ring-amber-500/20 outline-none transition-all" value={form.season} onChange={e => setForm({...form, season: e.target.value})} placeholder="e.g. Autumn" />
                    </div>
                    <div>
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 block">Dietary Info</label>
                        <input className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-sm font-medium focus:ring-2 focus:ring-amber-500/20 outline-none transition-all" value={form.dietary_info} onChange={e => setForm({...form, dietary_info: e.target.value})} placeholder="Vegan, GF..." />
                    </div>
                </div>
            </div>
        </FormModalBase>
    )
}

/**
 * ─── SPOONACULAR ENRICHER ──────────────────────────────────────────────────
 */

function SpoonacularEnricher({ onImport }) {
    const [query, setQuery] = useState('')
    const searchMutation = useSpoonacularSearchMutation()
    const [results, setResults] = useState(null)

    const handleSearch = async () => {
        if (!query.trim()) return
        const res = await searchMutation.mutateAsync({ query })
        setResults(res)
    }

    return (
        <div className="p-8 bg-black rounded-[40px] text-white shadow-2xl relative overflow-hidden group">
            {/* Background elements */}
            <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/20 rounded-full -translate-y-1/2 translate-x-1/2 blur-3xl" />
            
            <div className="relative z-10">
                <div className="flex items-center gap-4 mb-8">
                    <div className="w-14 h-14 rounded-2xl bg-white/10 backdrop-blur-md flex items-center justify-center border border-white/20">
                        <Sparkles className="text-yellow-400" size={28} />
                    </div>
                    <div>
                        <h2 className="text-2xl font-black tracking-tight">Culinary Deep Search</h2>
                        <p className="text-indigo-200/60 font-medium text-sm">Semantic AI Knowledge Extraction</p>
                    </div>
                </div>

                <div className="flex gap-3 max-w-2xl mb-8">
                    <div className="flex-1 relative">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30" size={20} />
                        <input
                            value={query}
                            onChange={e => setQuery(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && handleSearch()}
                            placeholder="Search dishes or ingredients..."
                            className="w-full pl-12 pr-6 py-4 bg-white/5 border border-white/10 rounded-[20px] outline-none focus:ring-4 focus:ring-indigo-500/20 transition-all font-medium"
                        />
                    </div>
                    <button
                        onClick={handleSearch}
                        disabled={searchMutation.isPending}
                        className="px-8 py-4 bg-indigo-600 text-white rounded-[20px] font-black hover:bg-indigo-500 transition-all disabled:opacity-50"
                    >
                        {searchMutation.isPending ? <Loader2 className="animate-spin" size={20} /> : 'Discover'}
                    </button>
                </div>

                <AnimatePresence>
                    {results && (
                        <motion.div 
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="grid md:grid-cols-2 gap-8"
                        >
                            {results.dishes.length > 0 && (
                                <div className="space-y-4">
                                    <h3 className="font-bold uppercase tracking-widest text-[10px] text-white/40">Suggested Dishes</h3>
                                    <div className="grid gap-2">
                                        {results.dishes.map(dish => (
                                            <div key={dish.id} className="bg-white/5 border border-white/5 rounded-2xl p-3 flex items-center justify-between group/item">
                                                <div className="flex items-center gap-3">
                                                    {dish.image && <img src={dish.image} alt="" className="w-8 h-8 rounded-lg object-cover" />}
                                                    <div>
                                                        <div className="font-bold text-sm tracking-tight">{dish.name}</div>
                                                        <div className="text-[10px] text-white/30 font-bold uppercase">{dish.cuisine || 'Global'}</div>
                                                    </div>
                                                </div>
                                                <button
                                                    onClick={() => onImport('dish', dish)}
                                                    className="p-2 rounded-xl hover:bg-indigo-600 transition-colors"
                                                >
                                                    <Download size={16} />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {results.ingredients.length > 0 && (
                                <div className="space-y-4">
                                    <h3 className="font-bold uppercase tracking-widest text-[10px] text-white/40">Suggested Ingredients</h3>
                                    <div className="grid gap-2">
                                        {results.ingredients.map(ing => (
                                            <div key={ing.id} className="bg-white/5 border border-white/5 rounded-2xl p-3 flex items-center justify-between group/item">
                                                <div className="flex items-center gap-3">
                                                    <img src={ing.image} alt="" className="w-8 h-8 rounded-lg object-contain bg-white/5" />
                                                    <div className="font-bold text-sm tracking-tight capitalize">{ing.name}</div>
                                                </div>
                                                <button
                                                    onClick={() => onImport('ingredient', ing)}
                                                    className="p-2 rounded-xl hover:bg-emerald-600 transition-colors"
                                                >
                                                    <Download size={16} />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </div>
    )
}

/**
 * ─── MAIN ADMIN PAGE ────────────────────────────────────────────────────────
 */

const AdminKnowledgeGraphPage = () => {
    const [activeTab, setActiveTab] = useState('cuisines')
    const [searchTerm, setSearchTerm] = useState('')
    const [showModal, setShowModal] = useState(null)
    const [toast, setToast] = useState(null)

    const { data: stats } = useKnowledgeStats()
    const { data: cuisines = [], isLoading: loadingCuisines } = useCuisines()
    const { data: dishes = [], isLoading: loadingDishes } = useDishes()
    const { data: ingredients = [], isLoading: loadingIngredients } = useIngredients()

    const createCuisine = useCreateCuisineMutation()
    const updateCuisine = useUpdateCuisineMutation()
    const deleteCuisine = useDeleteCuisineMutation()
    const createDish = useCreateDishMutation()
    const updateDish = useUpdateDishMutation()
    const deleteDish = useDeleteDishMutation()
    const createIngredient = useCreateIngredientMutation()
    const updateIngredient = useUpdateIngredientMutation()
    const deleteIngredient = useDeleteIngredientMutation()

    const showToast = (message, type = 'success') => {
        setToast({ message, type })
        setTimeout(() => setToast(null), 3000)
    }

    const syncKG = useSyncKGToLocationsMutation()
    const [syncStatus, setSyncStatus] = useState(null)

    const handleSyncLocations = async () => {
        try {
            await syncKG.mutateAsync((current, total) => {
                setSyncStatus({ message: `Processing ${current} of ${total}`, progress: Math.round((current/total)*100) })
            })
            showToast('Knowledge Graph synchronized with locations')
            setSyncStatus(null)
        } catch (_err) {
            showToast('Error during synchronization', 'error')
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
                showToast('Cuisine created')
            }
            setShowModal(null)
        } catch (_err) { showToast('Action failed', 'error') }
    }

    const handleSaveDish = async (data) => {
        try {
            if (showModal?.data?.id) {
                await updateDish.mutateAsync({ id: showModal.data.id, updates: data })
                showToast('Dish updated')
            } else {
                await createDish.mutateAsync(data)
                showToast('Dish imported')
            }
            setShowModal(null)
        } catch (_err) { showToast('Action failed', 'error') }
    }

    const handleSaveIngredient = async (data) => {
        try {
            if (showModal?.data?.id) {
                await updateIngredient.mutateAsync({ id: showModal.data.id, updates: data })
                showToast('Ingredient updated')
            } else {
                await createIngredient.mutateAsync(data)
                showToast('Ingredient imported')
            }
            setShowModal(null)
        } catch (_err) { showToast('Action failed', 'error') }
    }

    // Filters
    const filteredItems = (activeTab === 'cuisines' ? cuisines : activeTab === 'dishes' ? dishes : ingredients)
        .filter(item => item.name.toLowerCase().includes(searchTerm.toLowerCase()))

    const isLoading = loadingCuisines || loadingDishes || loadingIngredients

    return (
        <div className="max-w-6xl mx-auto px-6 py-10 space-y-12">
            {/* Toast System */}
            <AnimatePresence>
                {toast && (
                    <motion.div
                        initial={{ opacity: 0, y: -20, x: 20 }}
                        animate={{ opacity: 1, y: 0, x: 0 }}
                        exit={{ opacity: 0, y: -20, x: 20 }}
                        className={cn("fixed top-6 right-6 z-[100] px-6 py-4 rounded-2xl shadow-2xl font-bold text-sm", 
                            toast.type === 'success' ? "bg-emerald-600 text-white" : "bg-rose-600 text-white")}
                    >
                        {toast.message}
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Header */}
            <header className="flex flex-col md:flex-row md:items-center justify-between gap-8">
                <div className="flex items-center gap-5">
                    <div className="w-20 h-20 rounded-[32px] bg-slate-900 flex items-center justify-center text-white shadow-2xl">
                        <Brain size={40} />
                    </div>
                    <div>
                        <h1 className="text-5xl font-black text-slate-900 dark:text-white tracking-tighter uppercase italic">Knowledge Graph</h1>
                        <p className="text-slate-500 font-bold uppercase tracking-widest text-[10px]">Culinary Intelligence Layer v2.0</p>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    <button
                        onClick={handleSyncLocations}
                        disabled={syncKG.isPending}
                        className="flex items-center gap-3 px-6 py-4 rounded-2xl bg-indigo-600 text-white font-black hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-200"
                    >
                        <RefreshCw size={20} className={syncKG.isPending ? 'animate-spin' : ''} />
                        Sync All Locations
                    </button>
                    
                    <button
                        onClick={() => setShowModal({ type: activeTab.slice(0, -1), data: null })}
                        className="w-14 h-14 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-2xl flex items-center justify-center hover:scale-110 active:scale-95 transition-all shadow-lg"
                    >
                        <Plus size={28} />
                    </button>
                </div>
            </header>

            {syncStatus && (
                <div className="bg-indigo-600 rounded-[32px] p-8 text-white">
                    <div className="flex items-center justify-between mb-4">
                        <div className="font-black uppercase tracking-widest text-xs">Syncing World Knowledge</div>
                        <div className="font-black text-2xl">{syncStatus.progress}%</div>
                    </div>
                    <div className="h-4 bg-indigo-900/40 rounded-full overflow-hidden">
                        <motion.div className="h-full bg-white" initial={{ width: 0 }} animate={{ width: `${syncStatus.progress}%` }} />
                    </div>
                    <p className="mt-4 text-sm font-bold text-indigo-100">{syncStatus.message}</p>
                </div>
            )}

            {/* Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                {[
                    { label: 'Cuisines', val: stats?.cuisines || 0, icon: Globe, color: 'text-indigo-500', bg: 'bg-indigo-500/10' },
                    { label: 'Dishes', val: stats?.dishes || 0, icon: ChefHat, color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
                    { label: 'Ingredients', val: stats?.ingredients || 0, icon: Package, color: 'text-amber-500', bg: 'bg-amber-500/10' },
                    { label: 'Logic Sync', val: 'Active', icon: Zap, color: 'text-purple-500', bg: 'bg-purple-500/10' }
                ].map((s, i) => (
                    <StatsCard key={i} {...s} value={s.val} />
                ))}
            </div>

            {/* Spoonacular Tool */}
            <SpoonacularEnricher onImport={(type, data) => {
                if (type === 'dish') handleSaveDish(data)
                if (type === 'ingredient') handleSaveIngredient(data)
            }} />

            {/* Browser */}
            <section className="space-y-8">
                <div className="flex items-center justify-between gap-6">
                    <div className="flex bg-slate-100 dark:bg-slate-800 p-1.5 rounded-3xl shrink-0">
                        {['cuisines', 'dishes', 'ingredients'].map(id => (
                            <button
                                key={id}
                                onClick={() => setActiveTab(id)}
                                className={cn("px-8 py-3 rounded-2xl text-xs font-black uppercase tracking-widest transition-all",
                                    activeTab === id ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xl" : "text-slate-400")}
                            >
                                {id}
                            </button>
                        ))}
                    </div>
                    <div className="relative flex-1 max-w-sm">
                        <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                        <input
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            placeholder={`Filter ${activeTab}...`}
                            className="w-full pl-12 pr-6 py-4 bg-white dark:bg-slate-900 border-2 border-slate-100 dark:border-slate-800 rounded-3xl outline-none focus:border-indigo-500 transition-all font-bold text-sm"
                        />
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    <AnimatePresence mode="popLayout">
                        {isLoading ? (
                            <div className="col-span-full py-20 flex flex-col items-center gap-4 text-slate-400">
                                <Loader2 className="animate-spin" size={40} />
                                <span className="font-black uppercase tracking-widest text-xs">Accessing Digital Memory...</span>
                            </div>
                        ) : (
                            filteredItems.map(item => (
                                activeTab === 'cuisines' ? <CuisineCard key={item.id} cuisine={item} onEdit={c => setShowModal({type: 'cuisine', data: c})} onDelete={id => deleteCuisine.mutateAsync(id)} /> :
                                activeTab === 'dishes' ? <DishCard key={item.id} dish={item} onEdit={d => setShowModal({type: 'dish', data: d})} onDelete={id => deleteDish.mutateAsync(id)} /> :
                                <IngredientCard key={item.id} ingredient={item} onEdit={i => setShowModal({type: 'ingredient', data: i})} onDelete={id => deleteIngredient.mutateAsync(id)} />
                            ))
                        )}
                        {!isLoading && filteredItems.length === 0 && (
                            <div className="col-span-full py-20 text-center text-slate-300">
                                <Search size={48} className="mx-auto mb-4 opacity-20" />
                                <p className="font-black uppercase tracking-widest">No entries matching your search</p>
                            </div>
                        )}
                    </AnimatePresence>
                </div>
            </section>

            {/* Modals */}
            <AnimatePresence>
                {showModal?.type === 'cuisine' && (
                    <CuisineFormModal
                        cuisine={showModal.data}
                        onSave={handleSaveCuisine}
                        onClose={() => setShowModal(null)}
                    />
                )}
                {showModal?.type === 'dish' && (
                    <DishFormModal
                        dish={showModal.data}
                        onSave={handleSaveDish}
                        onClose={() => setShowModal(null)}
                    />
                )}
                {showModal?.type === 'ingredient' && (
                    <IngredientFormModal
                        ingredient={showModal.data}
                        onSave={handleSaveIngredient}
                        onClose={() => setShowModal(null)}
                    />
                )}
            </AnimatePresence>
        </div>
    )
}

export default AdminKnowledgeGraphPage
