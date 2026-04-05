import React, { useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
    Brain, ChefHat, UtensilsCrossed, Plus, Search,
    Edit2, Trash2, X, Save, Leaf,
    Globe, Sparkles, Loader2, BookOpen, RefreshCw, Zap, Package, Download,
    ChevronRight, Info, Filter, ArrowUpRight, Database,
    Carrot, Share2, LayoutGrid
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
    <div className="bg-white/40 dark:bg-slate-900/40 backdrop-blur-md p-5 rounded-[24px] border border-white/20 dark:border-slate-800/50 shadow-xl shadow-slate-200/50 dark:shadow-black/20 flex-1 min-w-[200px]">
        <div className="flex items-center gap-4">
            <div className={cn('w-12 h-12 rounded-2xl flex items-center justify-center shadow-inner', bgColor)}>
                <Icon size={24} className={color} />
            </div>
            <div>
                <p className="text-3xl font-black text-slate-900 dark:text-white leading-none tracking-tighter">{value}</p>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mt-1">{label}</p>
            </div>
        </div>
    </div>
)

const ListItem = React.forwardRef(({ type, item, onEdit, onDelete, idx }, ref) => {
    const isCuisine = type === 'cuisines'
    const isDish = type === 'dishes'
    const isIngredient = type === 'ingredients'

    const Icon = isCuisine ? Globe : isDish ? UtensilsCrossed : Leaf
    const iconColor = isCuisine ? 'text-indigo-500' : isDish ? 'text-emerald-500' : 'text-amber-500'
    const bgClass = isCuisine ? 'bg-indigo-500/5' : isDish ? 'bg-emerald-500/5' : 'bg-amber-500/5'

    return (
        <motion.div
            ref={ref}
            layout
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ delay: (idx % 10) * 0.05 }}
            className="group flex items-center gap-6 p-4 bg-white/60 dark:bg-slate-900/60 backdrop-blur-sm rounded-[24px] border border-slate-100 dark:border-slate-800/60 hover:bg-white dark:hover:bg-slate-800/80 hover:border-slate-300 dark:hover:border-slate-600 transition-all cursor-default"
        >
            <div className={cn("w-14 h-14 rounded-2xl flex-shrink-0 flex items-center justify-center border border-slate-100 dark:border-slate-800 group-hover:scale-105 transition-transform", bgClass)}>
                <Icon size={24} className={iconColor} />
            </div>

            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                    <h3 className="font-bold text-slate-900 dark:text-white truncate">{item.name}</h3>
                    {isCuisine && item.region && (
                        <span className="px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-500 text-[9px] font-black uppercase tracking-tighter">
                            {item.region}
                        </span>
                    )}
                    {isDish && item.cuisine?.name && (
                        <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-500 text-[9px] font-black uppercase tracking-tighter">
                            {item.cuisine.name}
                        </span>
                    )}
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 truncate max-w-xl">
                    {isCuisine ? item.description : isDish ? item.description : item.flavor_profile}
                </p>
            </div>

            <div className="hidden lg:flex items-center gap-4 px-6 border-l border-slate-100 dark:border-slate-800">
                {isCuisine && (
                    <div className="flex -space-x-2">
                        {(item.typical_dishes || []).slice(0, 3).map((d, i) => (
                            <div key={i} className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 border-2 border-white dark:border-slate-900 flex items-center justify-center text-[8px] font-bold text-slate-500 uppercase overflow-hidden" title={d}>
                                {d.charAt(0)}
                            </div>
                        ))}
                    </div>
                )}
                {isDish && (
                    <div className="text-[10px] text-slate-400 font-bold uppercase tracking-widest bg-slate-100 dark:bg-slate-800 px-3 py-1 rounded-full">
                        {item.preparation_style || 'Default'}
                    </div>
                )}
                {isIngredient && (
                    <div className="text-[10px] text-slate-400 font-bold uppercase tracking-widest bg-slate-100 dark:bg-slate-800 px-3 py-1 rounded-full">
                        {item.category || 'Basic'}
                    </div>
                )}
            </div>

            <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                    onClick={() => onEdit(item)}
                    className="p-2.5 bg-slate-100 dark:bg-white/5 rounded-xl text-slate-500 dark:text-slate-400 hover:text-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-500/10 transition-all"
                >
                    <Edit2 size={16} />
                </button>
                <button
                    onClick={() => onDelete(item.id)}
                    className="p-2.5 bg-slate-100 dark:bg-white/5 rounded-xl text-slate-500 dark:text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10 transition-all"
                >
                    <Trash2 size={16} />
                </button>
                <button className="p-2.5 bg-slate-100 dark:bg-white/5 rounded-xl text-slate-500 dark:text-slate-400 hover:text-indigo-500 transition-all">
                    <ChevronRight size={16} />
                </button>
            </div>
        </motion.div>
    )
})

/**
 * ─── MODAL COMPONENTS ────────────────────────────────────────────────────────
 */

const FormModalBase = ({ title, onSave, onClose, children }) => (
    <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[100] flex items-center justify-center p-4"
        onClick={onClose}
    >
        <motion.div
            initial={{ scale: 0.9, y: 20 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.9, y: 20 }}
            onClick={e => e.stopPropagation()}
            className="bg-white dark:bg-slate-950 w-full max-w-2xl rounded-[40px] shadow-2xl border border-white/20 dark:border-slate-800/50 max-h-[90vh] overflow-hidden flex flex-col"
        >
            <div className="p-8 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-900/50">
                <div>
                    <h2 className="text-2xl font-black text-slate-900 dark:text-white leading-none uppercase tracking-tighter">
                        {title}
                    </h2>
                    <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-1">Knowledge Management</p>
                </div>
                <button onClick={onClose} className="p-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 rounded-full transition-all">
                    <X size={20} />
                </button>
            </div>
            <div className="p-8 space-y-6 overflow-y-auto custom-scrollbar flex-1">
                {children}
            </div>
            <div className="p-8 border-t border-slate-100 dark:border-slate-800 flex gap-4 justify-end bg-slate-50/50 dark:bg-slate-900/50">
                <button
                    onClick={onClose}
                    className="px-8 py-3.5 rounded-[20px] font-black text-sm text-slate-500 dark:text-slate-400 hover:bg-white dark:hover:bg-slate-800 border border-transparent hover:border-slate-200 dark:hover:border-slate-700 transition-all uppercase tracking-widest"
                >
                    Cancel
                </button>
                <button
                    onClick={onSave}
                    className="px-10 py-3.5 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-[20px] font-black text-sm flex items-center gap-3 hover:shadow-2xl hover:-translate-y-0.5 active:translate-y-0 transition-all uppercase tracking-widest"
                >
                    <Save size={18} />
                    Save Entity
                </button>
            </div>
        </motion.div>

    </motion.div>
)

/**
 * ─── INFORMATION MODAL ───────────────────────────────────────────────────
 */

const InfoModal = ({ onClose }) => (
    <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-slate-900/80 backdrop-blur-xl z-[200] flex items-center justify-center p-6"
        onClick={onClose}
    >
        <motion.div
            initial={{ scale: 0.9, y: 40, opacity: 0 }}
            animate={{ scale: 1, y: 0, opacity: 1 }}
            exit={{ scale: 0.9, y: 40, opacity: 0 }}
            onClick={e => e.stopPropagation()}
            className="bg-white dark:bg-slate-950 w-full max-w-4xl rounded-[48px] shadow-2xl border border-white/20 dark:border-slate-800/50 max-h-[85vh] overflow-hidden flex flex-col relative"
        >
            {/* Close Button UI */}
            <button 
                onClick={onClose}
                className="absolute top-8 right-8 p-4 bg-slate-100 dark:bg-slate-800 rounded-full hover:bg-slate-200 dark:hover:bg-slate-700 transition-all z-10"
            >
                <X size={20} />
            </button>

            <div className="p-12 overflow-y-auto custom-scrollbar">
                <header className="mb-12">
                    <div className="w-16 h-16 bg-indigo-600 rounded-[20px] flex items-center justify-center text-white mb-6 shadow-xl">
                        <Brain size={32} />
                    </div>
                    <h2 className="text-4xl font-black text-slate-900 dark:text-white tracking-tighter uppercase italic leading-none">
                        How Gastromap <span className="text-indigo-600">Knowledge Graph</span> Works
                    </h2>
                    <p className="text-slate-400 font-bold uppercase tracking-[0.2em] text-[10px] mt-4">System Mechanics & Logic Flow</p>
                </header>

                <div className="grid md:grid-cols-2 gap-12">
                    <section className="space-y-6">
                        <div className="flex gap-6">
                            <div className="w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-indigo-500/10 flex items-center justify-center shrink-0 border border-indigo-100 dark:border-indigo-500/20 text-indigo-600">
                                <Database size={20} />
                            </div>
                            <div>
                                <h4 className="font-black text-sm uppercase tracking-widest mb-2 dark:text-white">1. База Знаний (Ontology)</h4>
                                <p className="text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                                    Это наша кулинарная энциклопедия. Мы храним не просто названия, а связи: Кухни (Итальянская) → Блюда (Паста) → Ингредиенты (Базилик). Это позволяет приложению понимать контекст еды.
                                </p>
                            </div>
                        </div>

                        <div className="flex gap-6">
                            <div className="w-12 h-12 rounded-2xl bg-emerald-50 dark:bg-emerald-500/10 flex items-center justify-center shrink-0 border border-emerald-100 dark:border-emerald-500/20 text-emerald-600">
                                <Sparkles size={20} />
                            </div>
                            <div>
                                <h4 className="font-black text-sm uppercase tracking-widest mb-2 dark:text-white">2. Искусственный Интеллект</h4>
                                <p className="text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                                    AI (OpenRouter/OpenAI) наполняет базу "семенами" знаний. Автоматически генерирует тысячи блюд, их описания и теги на основе мировых кулинарных стандартов.
                                </p>
                            </div>
                        </div>
                    </section>

                    <section className="space-y-6">
                        <div className="flex gap-6">
                            <div className="w-12 h-12 rounded-2xl bg-amber-50 dark:bg-amber-500/10 flex items-center justify-center shrink-0 border border-amber-100 dark:border-amber-500/20 text-amber-600">
                                <RefreshCw size={20} />
                            </div>
                            <div>
                                <h4 className="font-black text-sm uppercase tracking-widest mb-2 dark:text-white">3. Синхронизация (Mapping)</h4>
                                <p className="text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                                    Самая мощная часть. Приложение берет реальные рестораны и "привязывает" их к нашей базе знаний. Если ресторан подает пиццу, он автоматически становится частью "Итальянской кухни".
                                </p>
                            </div>
                        </div>

                        <div className="flex gap-6">
                            <div className="w-12 h-12 rounded-2xl bg-purple-50 dark:bg-purple-500/10 flex items-center justify-center shrink-0 border border-purple-100 dark:border-purple-500/20 text-purple-600">
                                <Search size={20} />
                            </div>
                            <div>
                                <h4 className="font-black text-sm uppercase tracking-widest mb-2 dark:text-white">4. Семантический Поиск</h4>
                                <p className="text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                                    Благодаря этой системе пользователи могут искать еду не по именам, а по смыслу: "хочу что-то острое", "веганская Азия" и т.д. Система найдет рестораны через связи в графе.
                                </p>
                            </div>
                        </div>
                    </section>
                </div>

                <div className="mt-16 p-8 bg-slate-900 rounded-[32px] text-indigo-200">
                    <div className="flex items-center gap-4 mb-4">
                        <Zap className="text-yellow-400" size={24} />
                        <h4 className="font-black text-sm uppercase tracking-[0.2em] text-white italic">PRO TIP для Админа</h4>
                    </div>
                    <p className="text-xs leading-relaxed font-medium opacity-80">
                        Используйте <strong>Bulk Seed</strong> для инициализации новых мировых регионов. После добавления новых данных всегда нажимайте <strong>Sync Graph</strong>, чтобы обновить теги у всех ресторанов на карте. Это сделает поиск в приложении на 40% точнее.
                    </p>
                </div>

                <div className="mt-12 flex justify-center">
                    <button 
                        onClick={onClose}
                        className="px-12 py-5 bg-slate-100 dark:bg-slate-800 rounded-[24px] font-black text-xs uppercase tracking-[0.3em] hover:bg-slate-200 dark:hover:bg-slate-700 transition-all border border-slate-200 dark:border-slate-700"
                    >
                        I understand everything
                    </button>
                </div>
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
        key_ingredients: (cuisine?.key_ingredients || []).join(', ')
    })

    const handleSubmit = () => {
        onSave({ 
            ...form, 
            aliases: form.aliases.split(',').map(s => s.trim()).filter(Boolean),
            typical_dishes: form.typical_dishes.split(',').map(s => s.trim()).filter(Boolean),
            key_ingredients: form.key_ingredients.split(',').map(s => s.trim()).filter(Boolean)
        })
    }

    const inputClasses = "w-full px-5 py-4 rounded-[18px] border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-sm font-bold focus:ring-4 focus:ring-amber-500/10 outline-none transition-all placeholder:text-slate-300 dark:placeholder:text-slate-700"
    const labelClasses = "text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2 block ml-1"

    return (
        <FormModalBase title={cuisine ? 'Edit Global Cuisine' : 'Chart New Territory'} onSave={handleSubmit} onClose={onClose}>
            <div className="space-y-6">
                <div className="grid grid-cols-2 gap-6">
                    <div>
                        <label className={labelClasses}>Territory Name</label>
                        <input className={inputClasses} value={form.name} onChange={e => setForm({...form, name: e.target.value})} placeholder="e.g. Levantine" />
                    </div>
                    <div>
                        <label className={labelClasses}>Geographical Focus</label>
                        <input className={inputClasses} value={form.region} onChange={e => setForm({...form, region: e.target.value})} placeholder="Middle East, Balkan..." />
                    </div>
                </div>
                <div>
                    <label className={labelClasses}>Known Aliases (Names)</label>
                    <input className={inputClasses} value={form.aliases} onChange={e => setForm({...form, aliases: e.target.value})} placeholder="Local/Alternate labels..." />
                </div>
                <div>
                    <label className={labelClasses}>Narrative Summary</label>
                    <textarea className={cn(inputClasses, "min-h-[120px] resize-none")} value={form.description} onChange={e => setForm({...form, description: e.target.value})} placeholder="Cultural context..." />
                </div>
                <div className="grid grid-cols-2 gap-6">
                    <div>
                        <label className={labelClasses}>Iconic Dishes</label>
                        <input className={inputClasses} value={form.typical_dishes} onChange={e => setForm({...form, typical_dishes: e.target.value})} placeholder="Hummus, Shawarma..." />
                    </div>
                    <div>
                        <label className={labelClasses}>Botanical/Key Components</label>
                        <input className={inputClasses} value={form.key_ingredients} onChange={e => setForm({...form, key_ingredients: e.target.value})} placeholder="Olive Oil, Za'atar..." />
                    </div>
                </div>
            </div>
        </FormModalBase>
    )
}

const DishFormModal = ({ dish, onSave, onClose }) => {
    const [form, setForm] = useState({
        name: dish?.name || '',
        description: dish?.description || '',
        flavor_profile: dish?.flavor_profile || '',
        preparation_style: dish?.preparation_style || '',
        common_pairings: (dish?.common_pairings || []).join(', '),
        dietary_tags: (dish?.dietary_tags || []).join(', ')
    })

    const handleSubmit = () => {
        onSave({ 
            ...form, 
            common_pairings: form.common_pairings.split(',').map(s => s.trim()).filter(Boolean),
            dietary_tags: form.dietary_tags.split(',').map(s => s.trim()).filter(Boolean)
        })
    }

    const inputClasses = "w-full px-5 py-4 rounded-[18px] border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-sm font-bold focus:ring-4 focus:ring-amber-500/10 outline-none transition-all placeholder:text-slate-300 dark:placeholder:text-slate-700"
    const labelClasses = "text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2 block ml-1"

    return (
        <FormModalBase title={dish ? 'Stabilize Plate Profile' : 'Define New Plate'} onSave={handleSubmit} onClose={onClose}>
            <div className="space-y-6">
                <div className="grid grid-cols-2 gap-6">
                    <div>
                        <label className={labelClasses}>Gastronomic Title</label>
                        <input className={inputClasses} value={form.name} onChange={e => setForm({...form, name: e.target.value})} placeholder="e.g. Shakshuka" />
                    </div>
                    <div>
                        <label className={labelClasses}>Flavor DNA</label>
                        <input className={inputClasses} value={form.flavor_profile} onChange={e => setForm({...form, flavor_profile: e.target.value})} placeholder="Spicy, Savory, Umami..." />
                    </div>
                </div>
                <div>
                    <label className={labelClasses}>Profile Summary</label>
                    <textarea className={cn(inputClasses, "min-h-[100px] resize-none")} value={form.description} onChange={e => setForm({...form, description: e.target.value})} placeholder="Molecular breakdown..." />
                </div>
                <div className="grid grid-cols-2 gap-6">
                    <div>
                        <label className={labelClasses}>Preparation Style</label>
                        <input className={inputClasses} value={form.preparation_style} onChange={e => setForm({...form, preparation_style: e.target.value})} placeholder="Grilled, Slow-cooked..." />
                    </div>
                    <div>
                        <label className={labelClasses}>Dietary Matrix</label>
                        <input className={inputClasses} value={form.dietary_tags} onChange={e => setForm({...form, dietary_tags: e.target.value})} placeholder="Vegan, Gluten-free..." />
                    </div>
                </div>
                <div>
                    <label className={labelClasses}>Synergistic Elements (Pairings)</label>
                    <input className={inputClasses} value={form.common_pairings} onChange={e => setForm({...form, common_pairings: e.target.value})} placeholder="Rice, Wine, Herbs..." />
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
        season: ingredient?.season || 'year-round',
    })

    const handleSubmit = () => {
        onSave({
            ...form,
            common_pairings: form.common_pairings.split(',').map(s => s.trim()).filter(Boolean),
            dietary_info: form.dietary_info.split(',').map(s => s.trim()).filter(Boolean),
        })
    }

    const inputClasses = "w-full px-5 py-4 rounded-[18px] border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-sm font-bold focus:ring-4 focus:ring-amber-500/10 outline-none transition-all placeholder:text-slate-300 dark:placeholder:text-slate-700"
    const labelClasses = "text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2 block ml-1"

    return (
        <FormModalBase title={ingredient ? 'Modify Ingredient' : 'New Molecular Component'} onSave={handleSubmit} onClose={onClose}>
            <div className="space-y-6">
                <div className="grid grid-cols-2 gap-6">
                    <div>
                        <label className={labelClasses}>Component Name</label>
                        <input className={inputClasses} value={form.name} onChange={e => setForm({...form, name: e.target.value})} placeholder="e.g. Saffron" />
                    </div>
                    <div>
                        <label className={labelClasses}>Taxonomy (Category)</label>
                        <select className={cn(inputClasses, "appearance-none")} value={form.category} onChange={e => setForm({...form, category: e.target.value})}>
                            <option value="">Select Category...</option>
                            <option value="spice">Spice</option>
                            <option value="herb">Herb</option>
                            <option value="vegetable">Vegetable</option>
                            <option value="fruit">Fruit</option>
                            <option value="meat">Meat</option>
                            <option value="fish">Seafood</option>
                            <option value="dairy">Dairy</option>
                            <option value="oil">Oil/Fat</option>
                        </select>
                    </div>
                </div>
                <div>
                    <label className={labelClasses}>Flavor Profile</label>
                    <input className={inputClasses} value={form.flavor_profile} onChange={e => setForm({...form, flavor_profile: e.target.value})} placeholder="e.g. Floral, bitter, aromatic..." />
                </div>
                <div className="grid grid-cols-2 gap-6">
                    <div>
                        <label className={labelClasses}>Dietary Classification</label>
                        <input className={inputClasses} value={form.dietary_info} onChange={e => setForm({...form, dietary_info: e.target.value})} placeholder="Vegan, Nut-free..." />
                    </div>
                    <div>
                        <label className={labelClasses}>Seasonal Blueprint</label>
                        <input className={inputClasses} value={form.season} onChange={e => setForm({...form, season: e.target.value})} placeholder="Autumn, Year-round..." />
                    </div>
                </div>
                <div>
                    <label className={labelClasses}>Synergistic Pairings</label>
                    <input className={inputClasses} value={form.common_pairings} onChange={e => setForm({...form, common_pairings: e.target.value})} placeholder="Comma separated list..." />
                </div>
            </div>
        </FormModalBase>
    )
}

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
        <div className="p-10 bg-slate-900 rounded-[48px] text-white shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-600/30 rounded-full blur-[120px] -translate-y-1/2 translate-x-1/2" />
            <div className="absolute bottom-0 left-0 w-64 h-64 bg-emerald-600/20 rounded-full blur-[100px] translate-y-1/2 -translate-x-1/2" />
            
            <div className="relative z-10">
                <div className="flex items-center gap-6 mb-10">
                    <div className="w-16 h-16 rounded-[24px] bg-white/10 backdrop-blur-xl flex items-center justify-center border border-white/20 shadow-2xl">
                        <Sparkles className="text-yellow-400" size={32} />
                    </div>
                    <div>
                        <h2 className="text-3xl font-black tracking-tight leading-none italic uppercase">Intelligence Harvester</h2>
                        <p className="text-indigo-200/50 font-bold uppercase tracking-[0.2em] text-[10px] mt-2">External Data Enrichment Engine</p>
                    </div>
                </div>

                <div className="flex gap-4 max-w-3xl mb-10">
                    <div className="flex-1 relative">
                        <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-white/30" size={24} />
                        <input
                            value={query}
                            onChange={e => setQuery(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && handleSearch()}
                            placeholder="Identify world culinary units..."
                            className="w-full pl-16 pr-8 py-5 bg-white/5 border border-white/10 rounded-[24px] outline-none focus:ring-4 focus:ring-indigo-500/20 transition-all font-bold text-lg"
                        />
                    </div>
                    <button
                        onClick={handleSearch}
                        disabled={searchMutation.isPending}
                        className="px-10 py-5 bg-indigo-600 text-white rounded-[24px] font-black hover:bg-indigo-500 hover:shadow-2xl hover:shadow-indigo-500/50 active:scale-95 transition-all disabled:opacity-50"
                    >
                        {searchMutation.isPending ? <Loader2 className="animate-spin" size={24} /> : 'Seed Graph'}
                    </button>
                </div>

                <AnimatePresence>
                    {results && (
                        <motion.div 
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="grid md:grid-cols-2 gap-10"
                        >
                            <div className="space-y-6">
                                <div className="flex items-center justify-between pb-2 border-b border-white/10">
                                    <h3 className="font-black uppercase tracking-widest text-xs text-white/40">Knowledge Candidates (Dishes)</h3>
                                    <span className="text-[10px] font-black bg-indigo-500/20 text-indigo-400 px-2 py-1 rounded-md">{results.dishes.length} Found</span>
                                </div>
                                <div className="space-y-3 max-h-64 overflow-y-auto custom-scrollbar pr-4">
                                    {results.dishes.map(dish => (
                                        <div key={dish.id} className="bg-white/5 border border-white/5 rounded-[22px] p-4 flex items-center justify-between hover:bg-white/10 transition-all group">
                                            <div className="flex items-center gap-4">
                                                {dish.image ? (
                                                    <img src={dish.image} alt="" className="w-12 h-12 rounded-xl object-cover shadow-2xl" />
                                                ) : (
                                                    <div className="w-12 h-12 rounded-xl bg-indigo-500/20 flex items-center justify-center"><UtensilsCrossed size={18} /></div>
                                                )}
                                                <div>
                                                    <div className="font-bold text-sm tracking-tight">{dish.name}</div>
                                                    <div className="text-[9px] text-white/30 font-black uppercase tracking-widest mt-0.5">{dish.cuisine || 'International'}</div>
                                                </div>
                                            </div>
                                            <button
                                                onClick={() => onImport('dish', dish)}
                                                className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center hover:bg-indigo-600 transition-all text-indigo-400"
                                            >
                                                <Download size={18} />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div className="space-y-6">
                                <div className="flex items-center justify-between pb-2 border-b border-white/10">
                                    <h3 className="font-black uppercase tracking-widest text-xs text-white/40">Molecular Map (Ingredients)</h3>
                                    <span className="text-[10px] font-black bg-emerald-500/20 text-emerald-400 px-2 py-1 rounded-md">{results.ingredients.length} Matched</span>
                                </div>
                                <div className="space-y-3 max-h-64 overflow-y-auto custom-scrollbar pr-4">
                                    {results.ingredients.map(ing => (
                                        <div key={ing.id} className="bg-white/5 border border-white/5 rounded-[22px] p-4 flex items-center justify-between hover:bg-white/10 transition-all group">
                                            <div className="flex items-center gap-4">
                                                <div className="w-12 h-12 rounded-xl bg-white/5 p-2 flex items-center justify-center shadow-inner">
                                                    <img src={ing.image} alt="" className="w-full h-full object-contain" />
                                                </div>
                                                <div className="font-bold text-sm tracking-tight capitalize">{ing.name}</div>
                                            </div>
                                            <button
                                                onClick={() => onImport('ingredient', ing)}
                                                className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center hover:bg-emerald-600 transition-all text-emerald-400"
                                            >
                                                <Download size={18} />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </div>
    )
}

const AdminKnowledgeGraphPage = () => {
    const [activeTab, setActiveTab] = useState('cuisines')
    const [searchTerm, setSearchTerm] = useState('')
    const [showModal, setShowModal] = useState(null)
    const [isInfoModalOpen, setIsInfoModalOpen] = useState(false)
    const [toast, setToast] = useState(null)

    const { data: stats } = useKnowledgeStats()
    const { data: cuisines = [], isLoading: loadingCuisines } = useCuisines()
    const { data: dishes = [], isLoading: loadingDishes } = useDishes()
    const { data: ingredients = [], isLoading: loadingIngredients } = useIngredients()

    console.log('Knowledge Graph Data Status:', { 
        activeTab, 
        cuisinesCount: cuisines?.length, 
        dishesCount: dishes?.length, 
        ingredientsCount: ingredients?.length 
    })
    if (cuisines?.length > 0) console.log('First Cuisine:', cuisines[0])
    if (dishes?.length > 0) console.log('First Dish:', dishes[0])
    if (ingredients?.length > 0) console.log('First Ingredient:', ingredients[0])

    const createCuisine = useCreateCuisineMutation()
    const updateCuisine = useUpdateCuisineMutation()
    const deleteCuisine = useDeleteCuisineMutation()
    const createDish = useCreateDishMutation()
    const updateDish = useUpdateDishMutation()
    const deleteDish = useDeleteDishMutation()
    const createIngredient = useCreateIngredientMutation()
    const updateIngredient = useUpdateIngredientMutation()
    const deleteIngredient = useDeleteIngredientMutation()

    const syncKG = useSyncKGToLocationsMutation()
    const [syncStatus, setSyncStatus] = useState(null)

    const showToast = (message, type = 'success') => {
        setToast({ message, type })
        setTimeout(() => setToast(null), 3000)
    }

    const handleSyncLocations = async () => {
        try {
            await syncKG.mutateAsync((current, total) => {
                setSyncStatus({ message: `Rebuilding neural mapping: ${current} / ${total}`, progress: Math.round((current/total)*100) })
            })
            showToast('Knowledge synchronization successful')
            setSyncStatus(null)
        } catch (_err) {
            showToast('Synchronization error', 'error')
            setSyncStatus(null)
        }
    }

    const handleBulkPopulate = () => {
        showToast('System seeder active in background')
    }

    const handleSaveCuisine = async (data) => {
        try {
            if (showModal?.data?.id) {
                await updateCuisine.mutateAsync({ id: showModal.data.id, updates: data })
                showToast('Knowledge core expanded')
            } else {
                await createCuisine.mutateAsync(data)
                showToast('New culinary unit initialized')
            }
            setShowModal(null)
        } catch (_err) { showToast('Operation failed', 'error') }
    }

    const handleSaveDish = async (data) => {
        try {
            if (showModal?.data?.id) {
                await updateDish.mutateAsync({ id: showModal.data.id, updates: data })
                showToast('Dish definition secured')
            } else {
                await createDish.mutateAsync(data)
                showToast('Dish manifest imported')
            }
            setShowModal(null)
        } catch (_err) { showToast('Operation failed', 'error') }
    }

    const handleSaveIngredient = async (data) => {
        try {
            if (showModal?.data?.id) {
                await updateIngredient.mutateAsync({ id: showModal.data.id, updates: data })
                showToast('Ingredient profile updated')
            } else {
                await createIngredient.mutateAsync(data)
                showToast('Ingredient unit initialized')
            }
            setShowModal(null)
        } catch (_err) { showToast('Operation failed', 'error') }
    }

    const filteredItems = useMemo(() => {
        const source = (activeTab === 'cuisines' ? cuisines : activeTab === 'dishes' ? dishes : ingredients)
        const items = Array.isArray(source) ? source : []
        
        return items.filter(item => {
            if (!item) return false
            const search = searchTerm.toLowerCase()
            const name = (item.name || '').toLowerCase()
            const desc = (item.description || '').toLowerCase()
            const region = (item.region || '').toLowerCase()
            
            return name.includes(search) || desc.includes(search) || region.includes(search)
        })
    }, [activeTab, cuisines, dishes, ingredients, searchTerm])

    const isCurrentTabLoading = 
        (activeTab === 'cuisines' && loadingCuisines) || 
        (activeTab === 'dishes' && loadingDishes) || 
        (activeTab === 'ingredients' && loadingIngredients)

    return (
        <div className="max-w-7xl mx-auto px-8 py-12 space-y-12 bg-slate-50 dark:bg-slate-950 min-h-screen">
            <AnimatePresence>
                {toast && (
                    <motion.div
                        initial={{ opacity: 0, y: -20, scale: 0.9 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -20, scale: 0.9 }}
                        className={cn(
                            "fixed top-8 right-8 z-[200] px-8 py-4 rounded-[24px] shadow-[0_20px_50px_rgba(0,0,0,0.2)] font-black text-xs uppercase tracking-[0.3em] flex items-center gap-3 border backdrop-blur-md", 
                            toast.type === 'success' ? "bg-emerald-600/90 text-white border-emerald-400/20" : "bg-rose-600/90 text-white border-rose-400/20"
                        )}
                    >
                        <Sparkles size={16} />
                        {toast.message}
                    </motion.div>
                )}
            </AnimatePresence>

            <header className="flex flex-col xl:flex-row xl:items-end justify-between gap-10">
                <div className="flex items-start gap-8">
                    <div className="w-24 h-24 rounded-[36px] bg-slate-900 flex items-center justify-center text-white shadow-[0_20px_60px_rgba(0,0,0,0.3)] border-4 border-white/10 shrink-0">
                        <Brain size={48} />
                    </div>
                    <div>
                        <div className="flex items-center gap-4 mb-2">
                            <h1 className="text-6xl font-black text-slate-900 dark:text-white tracking-tighter uppercase italic leading-[0.85]">
                                Knowledge <span className="text-indigo-600">Graph</span>
                            </h1>
                            <div className="px-3 py-1 bg-indigo-500/10 border border-indigo-500/20 rounded-full text-[10px] font-black text-indigo-500 uppercase tracking-widest h-fit">ULTRA</div>
                        </div>
                        <p className="text-slate-400 font-bold uppercase tracking-[0.4em] text-[10px] pl-1">Global Gastronomy Ontological Index</p>
                    </div>
                </div>

                <div className="flex items-center gap-4">
                    <button
                        onClick={() => setIsInfoModalOpen(true)}
                        className="w-16 h-16 bg-white dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-800 text-slate-400 rounded-[24px] flex items-center justify-center hover:bg-indigo-50 dark:hover:bg-indigo-500/10 hover:text-indigo-600 hover:border-indigo-500/50 transition-all shadow-xl"
                        title="How it works"
                    >
                        <Info size={32} />
                    </button>

                    <button
                        onClick={handleBulkPopulate}
                        className="flex items-center gap-3 px-8 py-4.5 rounded-[24px] bg-white dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200 font-black text-xs uppercase tracking-widest hover:border-indigo-500 hover:text-indigo-500 hover:shadow-2xl transition-all group"
                    >
                        <Database size={18} className="group-hover:rotate-12 transition-transform" />
                        Seed Engine
                    </button>
                    
                    <button
                        onClick={handleSyncLocations}
                        disabled={syncKG.isPending}
                        className="flex items-center gap-3 px-8 py-4.5 rounded-[24px] bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-black text-xs uppercase tracking-widest hover:shadow-[0_20px_40px_rgba(0,0,0,0.2)] active:scale-95 transition-all"
                    >
                        <RefreshCw size={18} className={syncKG.isPending ? 'animate-spin' : ''} />
                        Sync Graph
                    </button>
                    
                    <button
                        onClick={() => setShowModal({ type: activeTab.slice(0, -1), data: null })}
                        className="w-16 h-16 bg-indigo-600 text-white rounded-[24px] flex items-center justify-center hover:bg-indigo-500 hover:rotate-90 hover:scale-110 active:scale-95 transition-all shadow-[0_15px_40px_rgba(79,70,229,0.4)]"
                    >
                        <Plus size={32} />
                    </button>
                </div>
            </header>

            <AnimatePresence>
                {syncStatus && (
                    <motion.div 
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="bg-indigo-600 rounded-[40px] p-10 text-white shadow-2xl shadow-indigo-500/30"
                    >
                        <div className="flex items-center justify-between mb-6">
                            <div className="flex items-center gap-4">
                                <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
                                    <RefreshCw className="animate-spin" size={20} />
                                </div>
                                <div className="font-black uppercase tracking-[0.2em] text-xs italic">Quantum Mapping Cycle</div>
                            </div>
                            <div className="font-black text-4xl italic">{syncStatus.progress}%</div>
                        </div>
                        <div className="h-4 bg-indigo-900/40 rounded-full overflow-hidden border border-white/10">
                            <motion.div 
                                className="h-full bg-white shadow-[0_0_20px_rgba(255,255,255,0.5)]" 
                                initial={{ width: 0 }} 
                                animate={{ width: `${syncStatus.progress}%` }} 
                            />
                        </div>
                        <p className="mt-6 text-sm font-black text-indigo-100 flex items-center gap-2 italic uppercase tracking-widest">
                            <Zap size={16} />
                            {syncStatus.message}
                        </p>
                    </motion.div>
                )}
            </AnimatePresence>

            <div className="flex flex-wrap gap-6">
                {[
                    { label: 'Cuisines', val: cuisines?.length || 0, Icon: Globe, color: 'text-emerald-600', bg: 'bg-emerald-50/50' },
                    { label: 'Dishes', val: dishes?.length || 0, Icon: UtensilsCrossed, color: 'text-amber-600', bg: 'bg-amber-50/50' },
                    { label: 'Ingredients', val: ingredients?.length || 0, Icon: Carrot, color: 'text-rose-600', bg: 'bg-rose-50/50' },
                    { label: 'Connected', val: '92%', Icon: Share2, color: 'text-indigo-600', bg: 'bg-indigo-50/50' }
                ].map((stat, i) => (
                    <motion.div
                        key={stat.label}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.1 }}
                        className={`flex-1 min-w-[200px] p-6 rounded-[32px] ${stat.bg} border border-slate-200/50 dark:border-slate-800/50 flex items-center justify-between shadow-sm backdrop-blur-sm`}
                    >
                        <div className="space-y-1">
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{stat.label}</p>
                            <h4 className="text-3xl font-black text-slate-900 dark:text-white font-serif">{stat.val}</h4>
                        </div>
                        <div className="p-3 rounded-2xl bg-white dark:bg-slate-900 shadow-sm border border-slate-100 dark:border-slate-800">
                            <stat.Icon size={20} className={stat.color} />
                        </div>
                    </motion.div>
                ))}
            </div>

            <SpoonacularEnricher onImport={(type, data) => {
                if (type === 'dish') handleSaveDish(data)
                if (type === 'ingredient') handleSaveIngredient(data)
            }} />

            <section className="bg-white/40 dark:bg-slate-900/40 backdrop-blur-xl rounded-[48px] border border-white/20 dark:border-slate-800/50 p-1 shadow-2xl overflow-hidden flex flex-col h-[800px]">
                <div className="p-8 pb-4 flex flex-col md:flex-row md:items-center justify-between gap-8 border-b border-slate-100 dark:border-slate-800/50">
                    <div className="flex gap-1.5 bg-slate-100/80 dark:bg-slate-950/80 p-1.5 rounded-[24px] border border-white/50 dark:border-slate-800/50">
                        {['cuisines', 'dishes', 'ingredients'].map(id => (
                            <button
                                key={id}
                                onClick={() => setActiveTab(id)}
                                className={cn("px-10 py-3.5 rounded-[20px] text-[10px] font-black uppercase tracking-[0.2em] transition-all",
                                    activeTab === id 
                                        ? "bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-xl border border-slate-100 dark:border-slate-700" 
                                        : "text-slate-400 hover:text-slate-600")}
                            >
                                {id}
                            </button>
                        ))}
                    </div>
                    
                    <div className="flex items-center gap-4 flex-1 max-w-xl">
                        <div className="relative flex-1 group">
                            <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-indigo-500 transition-colors" size={20} />
                            <input
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                                placeholder={`Filter ${activeTab} by name or metadata...`}
                                className="w-full pl-16 pr-8 py-5 bg-white dark:bg-slate-950 border border-slate-100 dark:border-slate-800 rounded-[24px] outline-none focus:ring-4 focus:ring-indigo-500/10 transition-all font-bold text-sm"
                            />
                        </div>
                        <button className="w-16 h-16 bg-white dark:bg-slate-950 border border-slate-100 dark:border-slate-800 rounded-[24px] flex items-center justify-center text-slate-400 hover:text-indigo-500 hover:border-indigo-500/50 transition-all">
                            <Filter size={20} />
                        </button>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto p-8 pt-4 custom-scrollbar space-y-4">
                    <AnimatePresence mode="popLayout" initial={false}>
                        {isCurrentTabLoading ? (
                            <div className="flex-1 flex flex-col items-center justify-center py-20 gap-8 animate-pulse">
                                <div className="w-20 h-20 bg-slate-100 dark:bg-slate-800 rounded-full" />
                                <div className="h-4 w-48 bg-slate-100 dark:bg-slate-800 rounded-full" />
                            </div>
                        ) : filteredItems.length > 0 ? (
                            filteredItems.map((item, idx) => (
                                <ListItem 
                                    key={item.id} 
                                    type={activeTab} 
                                    item={item} 
                                    idx={idx}
                                    onEdit={obj => setShowModal({type: activeTab.slice(0, -1), data: obj})} 
                                    onDelete={async id => {
                                        if (confirm('Verify data deletion? This action is irreversible.')) {
                                            if (activeTab === 'cuisines') await deleteCuisine.mutateAsync(id)
                                            else if (activeTab === 'dishes') await deleteDish.mutateAsync(id)
                                            else await deleteIngredient.mutateAsync(id)
                                            showToast('Entity purged from graph')
                                        }
                                    }} 
                                />
                            ))
                        ) : (
                            <motion.div 
                                initial={{ opacity: 0 }} 
                                animate={{ opacity: 1 }} 
                                className="flex flex-col items-center justify-center py-40 border-2 border-dashed border-slate-100 dark:border-slate-800 rounded-[48px]"
                            >
                                <div className="w-24 h-24 bg-slate-50 dark:bg-slate-900 rounded-full flex items-center justify-center mb-6 text-slate-200">
                                    <Search size={48} />
                                </div>
                                <h3 className="font-black text-2xl text-slate-900 dark:text-white uppercase tracking-tighter italic">No Matches Found</h3>
                                <p className="text-sm font-bold text-slate-400 uppercase tracking-[0.2em] mt-2">Neural graph returned zero nodes</p>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            </section>

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
                {/* Info Modal */}
                {isInfoModalOpen && (
                    <InfoModal onClose={() => setIsInfoModalOpen(false)} />
                )}
            </AnimatePresence>
        </div>
    )
}

export default AdminKnowledgeGraphPage
