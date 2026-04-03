import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
    Brain, ChefHat, UtensilsCrossed, Apple, Plus, Search,
    Edit2, Trash2, X, Save, ChevronRight, AlertCircle, CheckCircle2,
    Globe, Sparkles, Leaf, Loader2
} from 'lucide-react'
import { cn } from '@/lib/utils'
import {
    useCuisines, useDishes, useIngredients,
    useCreateCuisineMutation, useUpdateCuisineMutation, useDeleteCuisineMutation,
    useCreateDishMutation, useUpdateDishMutation, useDeleteDishMutation,
    useCreateIngredientMutation, useUpdateIngredientMutation, useDeleteIngredientMutation,
    useKnowledgeStats,
} from '@/shared/api/queries'

// ─── Tab Configuration ──────────────────────────────────────────────────────

const TABS = [
    { id: 'cuisines', label: 'Cuisines', icon: Globe, color: 'text-indigo-500', bgColor: 'bg-indigo-500/10' },
    { id: 'dishes', label: 'Dishes', icon: UtensilsCrossed, color: 'text-emerald-500', bgColor: 'bg-emerald-500/10' },
    { id: 'ingredients', label: 'Ingredients', icon: Leaf, color: 'text-amber-500', bgColor: 'bg-amber-500/10' },
]

// ─── Stats Card ─────────────────────────────────────────────────────────────

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

// ─── Cuisine Card ────────────────────────────────────────────────────────────

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

// ─── Dish Card ───────────────────────────────────────────────────────────────

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
                    <p className="text-[10px] text-slate-500 uppercase tracking-wider">{dish.cuisine?.name || 'Unknown cuisine'}</p>
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
            <span className="text-[10px] text-slate-500">Flavor:</span>
            <span className="text-xs font-medium text-slate-700 dark:text-slate-300">{dish.flavor_notes}</span>
        </div>
    </motion.div>
)

// ─── Ingredient Card ─────────────────────────────────────────────────────────

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
                    <h3 className="font-bold text-slate-900 dark:text-white">{ingredient.name}</h3>
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
                <span key={tag} className="px-2 py-0.5 bg-green-100 dark:bg-green-500/10 rounded text-[10px] text-green-600 dark:text-green-400">
                    {tag}
                </span>
            ))}
        </div>
    </motion.div>
)

// ─── Cuisine Form Modal ──────────────────────────────────────────────────────

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

    const handleSubmit = (e) => {
        e.preventDefault()
        onSave({
            ...form,
            aliases: form.aliases.split(',').map(s => s.trim()).filter(Boolean),
            typical_dishes: form.typical_dishes.split(',').map(s => s.trim()).filter(Boolean),
            key_ingredients: form.key_ingredients.split(',').map(s => s.trim()).filter(Boolean),
        })
    }

    return (
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
                    <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                        {cuisine ? 'Edit Cuisine' : 'Add Cuisine'}
                    </h2>
                    <button onClick={onClose} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg">
                        <X size={18} />
                    </button>
                </div>
                <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto">
                    <div>
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1 block">Name</label>
                        <input
                            value={form.name}
                            onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                            className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm"
                            placeholder="e.g. Italian"
                            required
                        />
                    </div>
                    <div>
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1 block">Description</label>
                        <textarea
                            value={form.description}
                            onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                            className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm resize-none h-20"
                            placeholder="Brief description of this cuisine..."
                        />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1 block">Region</label>
                            <input
                                value={form.region}
                                onChange={e => setForm(f => ({ ...f, region: e.target.value }))}
                                className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm"
                                placeholder="e.g. Mediterranean"
                            />
                        </div>
                        <div>
                            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1 block">Flavor Profile</label>
                            <input
                                value={form.flavor_profile}
                                onChange={e => setForm(f => ({ ...f, flavor_profile: e.target.value }))}
                                className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm"
                                placeholder="e.g. herbal, savory"
                            />
                        </div>
                    </div>
                    <div>
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1 block">Aliases (comma-separated)</label>
                        <input
                            value={form.aliases}
                            onChange={e => setForm(f => ({ ...f, aliases: e.target.value }))}
                            className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm"
                            placeholder="e.g. Italiana, Italia"
                        />
                    </div>
                    <div>
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1 block">Typical Dishes (comma-separated)</label>
                        <input
                            value={form.typical_dishes}
                            onChange={e => setForm(f => ({ ...f, typical_dishes: e.target.value }))}
                            className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm"
                            placeholder="e.g. pasta, pizza, risotto"
                        />
                    </div>
                    <div>
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1 block">Key Ingredients (comma-separated)</label>
                        <input
                            value={form.key_ingredients}
                            onChange={e => setForm(f => ({ ...f, key_ingredients: e.target.value }))}
                            className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm"
                            placeholder="e.g. olive oil, tomatoes, garlic"
                        />
                    </div>
                </form>
                <div className="p-6 border-t border-slate-100 dark:border-slate-800 flex gap-3 justify-end">
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-6 py-2.5 rounded-xl font-bold text-sm text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleSubmit}
                        className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-sm flex items-center gap-2"
                    >
                        <Save size={16} />
                        Save
                    </button>
                </div>
            </motion.div>
        </motion.div>
    )
}

// ─── Main Page ───────────────────────────────────────────────────────────────

const AdminKnowledgeGraphPage = () => {
    const [activeTab, setActiveTab] = useState('cuisines')
    const [searchTerm, setSearchTerm] = useState('')
    const [showModal, setShowModal] = useState(null) // { type: 'cuisine'|'dish'|'ingredient', data: obj|null }
    const [toast, setToast] = useState(null)

    // Queries
    const { data: stats } = useKnowledgeStats()
    const { data: cuisines = [], isLoading: loadingCuisines } = useCuisines()
    const { data: dishes = [], isLoading: loadingDishes } = useDishes()
    const { data: ingredients = [], isLoading: loadingIngredients } = useIngredients()

    // Mutations
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

    // Handlers
    const handleSaveCuisine = async (data) => {
        try {
            if (showModal?.data?.id) {
                await updateCuisine.mutateAsync({ id: showModal.data.id, updates: data })
                showToast('Cuisine updated successfully')
            } else {
                await createCuisine.mutateAsync(data)
                showToast('Cuisine created successfully')
            }
            setShowModal(null)
        } catch (err) {
            showToast('Error saving cuisine', 'error')
        }
    }

    const handleDeleteCuisine = async (id) => {
        if (!confirm('Delete this cuisine?')) return
        try {
            await deleteCuisine.mutateAsync(id)
            showToast('Cuisine deleted')
        } catch (err) {
            showToast('Error deleting cuisine', 'error')
        }
    }

    const handleSaveDish = async (data) => {
        try {
            if (showModal?.data?.id) {
                await updateDish.mutateAsync({ id: showModal.data.id, updates: data })
                showToast('Dish updated successfully')
            } else {
                await createDish.mutateAsync(data)
                showToast('Dish created successfully')
            }
            setShowModal(null)
        } catch (err) {
            showToast('Error saving dish', 'error')
        }
    }

    const handleDeleteDish = async (id) => {
        if (!confirm('Delete this dish?')) return
        try {
            await deleteDish.mutateAsync(id)
            showToast('Dish deleted')
        } catch (err) {
            showToast('Error deleting dish', 'error')
        }
    }

    const handleSaveIngredient = async (data) => {
        try {
            if (showModal?.data?.id) {
                await updateIngredient.mutateAsync({ id: showModal.data.id, updates: data })
                showToast('Ingredient updated successfully')
            } else {
                await createIngredient.mutateAsync(data)
                showToast('Ingredient created successfully')
            }
            setShowModal(null)
        } catch (err) {
            showToast('Error saving ingredient', 'error')
        }
    }

    const handleDeleteIngredient = async (id) => {
        if (!confirm('Delete this ingredient?')) return
        try {
            await deleteIngredient.mutateAsync(id)
            showToast('Ingredient deleted')
        } catch (err) {
            showToast('Error deleting ingredient', 'error')
        }
    }

    // Filtered data
    const filteredCuisines = cuisines.filter(c =>
        c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.description?.toLowerCase().includes(searchTerm.toLowerCase())
    )
    const filteredDishes = dishes.filter(d =>
        d.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        d.description?.toLowerCase().includes(searchTerm.toLowerCase())
    )
    const filteredIngredients = ingredients.filter(i =>
        i.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        i.flavor_profile?.toLowerCase().includes(searchTerm.toLowerCase())
    )

    const isLoading = loadingCuisines || loadingDishes || loadingIngredients

    return (
        <div className="max-w-6xl mx-auto px-6 py-10">
            {/* Toast */}
            <AnimatePresence>
                {toast && (
                    <motion.div
                        initial={{ opacity: 0, y: -20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -20 }}
                        className={cn(
                            "fixed top-4 right-4 z-[100] px-6 py-3 rounded-xl shadow-2xl font-semibold text-sm",
                            toast.type === 'success' ? "bg-emerald-500 text-white" : "bg-rose-500 text-white"
                        )}
                    >
                        {toast.message}
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Header */}
            <div className="mb-10">
                <div className="flex items-center gap-3 mb-3">
                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white shadow-lg shadow-indigo-500/20">
                        <Brain size={24} />
                    </div>
                    <div>
                        <h1 className="text-4xl font-black text-slate-900 dark:text-white tracking-tight">Knowledge Graph</h1>
                        <p className="text-slate-500 dark:text-slate-400">Manage culinary knowledge for AI recommendations</p>
                    </div>
                </div>
            </div>

            {/* Stats */}
            <section className="grid grid-cols-3 gap-4 mb-8">
                <StatsCard icon={Globe} label="Cuisines" value={stats?.cuisines || 0} color="text-indigo-500" bgColor="bg-indigo-500/10" />
                <StatsCard icon={UtensilsCrossed} label="Dishes" value={stats?.dishes || 0} color="text-emerald-500" bgColor="bg-emerald-500/10" />
                <StatsCard icon={Leaf} label="Ingredients" value={stats?.ingredients || 0} color="text-amber-500" bgColor="bg-amber-500/10" />
            </section>

            {/* Tabs */}
            <div className="flex items-center gap-4 mb-6">
                <div className="flex bg-slate-100 dark:bg-slate-800 rounded-xl p-1">
                    {TABS.map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={cn(
                                "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all",
                                activeTab === tab.id
                                    ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm"
                                    : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                            )}
                        >
                            <tab.icon size={16} className={activeTab === tab.id ? tab.color : ''} />
                            {tab.label}
                        </button>
                    ))}
                </div>

                <div className="flex-1 relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                    <input
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        placeholder="Search..."
                        className="w-full pl-10 pr-4 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm"
                    />
                </div>

                <button
                    onClick={() => setShowModal({ type: activeTab.slice(0, -1), data: null })}
                    className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-sm"
                >
                    <Plus size={16} />
                    Add {activeTab === 'cuisines' ? 'Cuisine' : activeTab === 'dishes' ? 'Dish' : 'Ingredient'}
                </button>
            </div>

            {/* Content */}
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                <AnimatePresence mode="popLayout">
                    {isLoading ? (
                        <div className="col-span-full flex items-center justify-center py-12">
                            <Loader2 className="animate-spin text-indigo-500" size={24} />
                        </div>
                    ) : activeTab === 'cuisines' ? (
                        filteredCuisines.map(cuisine => (
                            <CuisineCard
                                key={cuisine.id}
                                cuisine={cuisine}
                                onEdit={(c) => setShowModal({ type: 'cuisine', data: c })}
                                onDelete={handleDeleteCuisine}
                            />
                        ))
                    ) : activeTab === 'dishes' ? (
                        filteredDishes.map(dish => (
                            <DishCard
                                key={dish.id}
                                dish={dish}
                                onEdit={(d) => setShowModal({ type: 'dish', data: d })}
                                onDelete={handleDeleteDish}
                            />
                        ))
                    ) : (
                        filteredIngredients.map(ingredient => (
                            <IngredientCard
                                key={ingredient.id}
                                ingredient={ingredient}
                                onEdit={(i) => setShowModal({ type: 'ingredient', data: i })}
                                onDelete={handleDeleteIngredient}
                            />
                        ))
                    )}
                </AnimatePresence>

                {!isLoading && (
                    (activeTab === 'cuisines' && filteredCuisines.length === 0) ||
                    (activeTab === 'dishes' && filteredDishes.length === 0) ||
                    (activeTab === 'ingredients' && filteredIngredients.length === 0)
                ) && (
                    <div className="col-span-full text-center py-12 text-slate-500">
                        <ChefHat size={32} className="mx-auto mb-3 opacity-30" />
                        <p className="text-sm font-medium">No {activeTab} found</p>
                    </div>
                )}
            </div>

            {/* Modals */}
            <AnimatePresence>
                {showModal?.type === 'cuisine' && (
                    <CuisineFormModal
                        cuisine={showModal.data}
                        onSave={handleSaveCuisine}
                        onClose={() => setShowModal(null)}
                    />
                )}
                {/* Simplified modals for dishes and ingredients - using same pattern */}
            </AnimatePresence>

            {/* AI Context Note */}
            <div className="mt-10 p-6 bg-gradient-to-br from-indigo-500/5 to-purple-500/5 rounded-[32px] border border-indigo-500/10">
                <div className="flex items-start gap-4">
                    <div className="w-10 h-10 rounded-xl bg-indigo-500/10 flex items-center justify-center text-indigo-500 shrink-0">
                        <Sparkles size={20} />
                    </div>
                    <div>
                        <h3 className="font-bold text-slate-900 dark:text-white mb-1">AI Enhancement</h3>
                        <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                            The Knowledge Graph enhances GastroGuide AI recommendations by providing deep culinary context.
                            When users ask for recommendations, the AI uses this knowledge to understand cuisines,
                            suggest dishes based on preferences, and provide expert-level insights about ingredients and pairings.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default AdminKnowledgeGraphPage
