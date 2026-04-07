import React, { useState } from 'react'
import { motion } from 'framer-motion'
import { X, Building2, Sparkles, Wand2, Activity, Zap, Search, Plus, Clock } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

const LocationFormSlideOver = ({ 
    isOpen, 
    onClose, 
    selectedLocation, 
    formData, 
    setFormData, 
    onSave, 
    extractMutation,
    aiQueryMutation,
    reindexMutation,
    spoonacularMutation,
    culinarySearchQuery,
    setCulinarySearchQuery,
    culinaryResults,
    handleAIMagic,
    handleCulinarySearch,
    addCulinaryItem,
    isImproving,
    setIsImproving
}) => {
    const [aiSearchQuery, setAiSearchQuery] = useState('')

    if (!isOpen || !formData) return null

    const handleImproveText = async (field) => {
        const text = formData[field];
        if (!text || text.length < 5) {
            alert('Сначала введите хотя бы немного текста для улучшения');
            return;
        }
        
        setIsImproving(field);
        try {
            const prompt = `Improve this Gastronomic location ${field}. Make it engaging, evocative and professional, while keeping the original intent. Length should be proportional. Here is the text: "${text}"`;
            const result = await aiQueryMutation.mutateAsync({ message: prompt });
            let improvedText = "";
            if (typeof result === 'string') {
                improvedText = result;
            } else if (result && typeof result === 'object') {
                improvedText = result.text || result.content || result.result || result.output || JSON.stringify(result);
            }
            
            improvedText = improvedText.replace(/^["']|["']$/g, '').trim();
            setFormData(prev => ({ ...prev, [field]: improvedText }));
        } catch (error) {
            console.error('AI improvement failed:', error);
        } finally {
            setIsImproving(null);
        }
    };

    const addImageUrl = (url) => {
        if (!url) return;
        setFormData(prev => {
            if (!prev) return prev;
            return {
                ...prev,
                images: [...(prev.images || []), url],
                image_url: prev.image_url || url
            }
        })
    }

    const removeImage = (index) => {
        setFormData(prev => {
            if (!prev || !prev.images) return prev;
            const newImages = prev.images.filter((_, i) => i !== index);
            return {
                ...prev,
                images: newImages,
                image_url: prev.image_url === prev.images[index] ? (newImages[0] || '') : prev.image_url
            }
        })
    }

    const categories = [
        'Cafe', 'Restaurant', 'Street Food', 'Bar', 'Market',
        'Bakery', 'Winery', 'Store', 'Coffee Shop', 'Pastry Shop'
    ]

    const LABEL_GROUPS = {
        "Кухня и Меню": [
            "Авторская кухня", "Веганское меню", "Вкусные десерты", "Завтраки целый день",
            "Импортные продукты", "Местные продукты", "Меню завтраков", "Меню ланча", "Фьюжен",
            "Итальянская", "Французская", "Японская", "Китайская", "Греческая", "Испанская",
            "Мексиканская", "Тайская", "Грузинская", "Польская", "Израильская", "Американская",
            "Средиземноморская", "Индийская", "Вьетнамская", "Турецкая"
        ].sort(),
        "Бар и Напитки": [
            "Авторские коктейли", "Винная карта", "Гостевые смены", "Дегустация вин",
            "DJ сеты", "Крафтовое пиво", "Миксология (без меню)", "Спешиалти кофе", "Широкий выбор джина"
        ].sort(),
        "Атмосфера": [
            "Живописный вид", "Живая музыка", "Коворкинг", "Настольные игры",
            "Оживленная атмосфера", "Романтическая атмосфера", "Скрытый вход (Speakeasy)",
            "Счастливые часы", "Тематический интерьер", "Тихая атмосфера", "Уютно"
        ].sort(),
        "Удобства и Сервис": [
            "Балкончики", "Детская игровая зона", "Детские стульчики", "Доставка",
            "Инклюзивность", "Любимое у местных", "Парковка", "Pet friendly",
            "Самовывоз", "Терраса во дворе", "Терраса на крыше", "WiFi"
        ].sort(),
        "Награды и Особое": [
            "Гид Мишлен", "Звезда Мишлен", "Кальян", "Поздний ужин"
        ].sort()
    }

    const BEST_TIMES = [
        { id: 'morning', label: 'Утро', icon: Clock },
        { id: 'day', label: 'День', icon: Clock },
        { id: 'evening', label: 'Вечер', icon: Clock },
        { id: 'late_night', label: 'Поздняя ночь', icon: Clock }
    ]

    const toggleLabel = (label) => {
        setFormData(prev => {
            const current = prev.special_labels || []
            return {
                ...prev,
                special_labels: current.includes(label)
                    ? current.filter(l => l !== label)
                    : [...current, label]
            }
        })
    }

    const toggleBestTime = (timeId) => {
        setFormData(prev => {
            const current = prev.best_for || []
            return {
                ...prev,
                best_for: current.includes(timeId)
                    ? current.filter(t => t !== timeId)
                    : [...current, timeId]
            }
        })
    }

    return (
        <>
            <motion.div 
                initial={{ opacity: 0 }} 
                animate={{ opacity: 1 }} 
                exit={{ opacity: 0 }} 
                onClick={onClose} 
                className="fixed inset-0 z-[100] bg-slate-900/10 backdrop-blur-md" 
            />
            <motion.div 
                initial={{ x: '100%' }} 
                animate={{ x: 0 }} 
                exit={{ x: '100%' }} 
                transition={{ type: 'spring', damping: 30, stiffness: 250 }} 
                className="fixed top-0 right-0 w-full sm:w-[600px] bg-white dark:bg-slate-900 h-full z-[110] flex flex-col shadow-2xl overflow-hidden font-sans"
            >
                {/* Header */}
                <div className="p-6 lg:p-10 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border-b border-slate-100 dark:border-slate-800/50 flex justify-between items-center shrink-0">
                    <div className="flex items-center gap-4 lg:gap-5">
                        <div className="w-10 h-10 lg:w-12 lg:h-12 rounded-xl lg:rounded-2xl bg-indigo-500 flex items-center justify-center text-white shadow-lg shadow-indigo-500/20">
                            <Building2 size={20} className="lg:w-6 lg:h-6" />
                        </div>
                        <div>
                            <h2 className="text-lg lg:text-2xl font-bold text-slate-900 dark:text-white leading-none mb-1.5">
                                {selectedLocation.id === 'NEW' ? 'Новый объект' : 'Редактирование'}
                            </h2>
                            <p className="text-[9px] lg:text-[10px] font-bold text-indigo-500 uppercase tracking-[0.2em] leading-none">
                                {selectedLocation.id === 'NEW' ? 'Черновик Gastro AI' : `ID: #${selectedLocation.id}`}
                            </p>
                        </div>
                    </div>
                    <button onClick={onClose} aria-label="close-panel" className="p-2.5 lg:p-3 bg-slate-50 dark:bg-slate-800 text-slate-400 rounded-xl lg:rounded-2xl hover:rotate-90 transition-all">
                        <X size={18} className="lg:w-5 lg:h-5" />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6 lg:p-10 space-y-10 lg:space-y-12 custom-scrollbar relative">
                    
                    {/* Section: Gastro AI Smart Fill */}
                    <div className="p-6 rounded-[28px] bg-gradient-to-br from-indigo-600 to-indigo-700 text-white relative overflow-hidden shadow-lg shadow-indigo-500/20 group border border-white/10 transition-all hover:shadow-indigo-500/30">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -translate-y-16 translate-x-16 blur-2xl group-hover:bg-white/20 transition-all duration-700" />
                        <div className="relative z-10 flex flex-col sm:flex-row items-center gap-6">
                            <div className="flex items-center gap-3 shrink-0">
                                <div className="p-2.5 bg-white/10 rounded-xl backdrop-blur-md border border-white/10 group-hover:bg-white/20 transition-all">
                                    <Sparkles size={18} className="text-amber-300 animate-pulse" />
                                </div>
                                <div>
                                    <h4 className="text-[10px] font-black uppercase tracking-[0.2em] leading-none mb-1">Gastro AI</h4>
                                    <p className="text-[8px] font-bold text-white/50 whitespace-nowrap">Умное заполнение</p>
                                </div>
                            </div>

                            <div className="flex-1 w-full flex gap-3">
                                <div className="relative flex-1 group/input">
                                    <input
                                        type="text"
                                        value={aiSearchQuery}
                                        onChange={e => setAiSearchQuery(e.target.value)}
                                        onKeyDown={e => e.key === 'Enter' && handleAIMagic()}
                                        className="w-full pl-5 pr-10 py-3 bg-white/5 border border-white/10 rounded-xl text-xs font-bold placeholder:text-white/30 outline-none focus:bg-white/10 focus:border-white/20 transition-all"
                                        placeholder="Название и город..."
                                    />
                                    <Wand2 size={12} className="absolute right-4 top-1/2 -translate-y-1/2 text-white/20 group-focus-within/input:text-white/60 group-focus-within/input:scale-110 transition-all" />
                                </div>
                                <button 
                                    onClick={handleAIMagic}
                                    disabled={extractMutation.isPending}
                                    className="px-6 py-3 bg-white text-indigo-600 rounded-xl font-black text-[9px] uppercase tracking-widest shadow-lg active:scale-[0.96] hover:bg-indigo-50 transition-all shrink-0 disabled:opacity-50"
                                >
                                    {extractMutation.isPending ? 'Запрос...' : 'Заполнить'}
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Section: AI Semantic Identity */}
                    {selectedLocation.id !== 'NEW' && (
                        <div className="p-6 rounded-[28px] bg-slate-50 dark:bg-slate-800/30 border border-slate-100 dark:border-slate-800/50 space-y-6">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-indigo-500/10 rounded-lg">
                                        <Activity size={16} className="text-indigo-600 dark:text-indigo-400" />
                                    </div>
                                    <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-900 dark:text-white">AI Semantic Identity</h4>
                                </div>
                                <Badge variant="secondary" className={cn(
                                    "text-[8px] font-black uppercase tracking-widest px-2 py-0.5",
                                    formData.has_embedding ? "bg-emerald-500/10 text-emerald-600" : "bg-slate-100 text-slate-400"
                                )}>
                                    {formData.has_embedding ? 'Indexed' : 'Not Indexed'}
                                </Badge>
                            </div>

                            {formData.ai_context && (
                                <div className="space-y-2">
                                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest ml-1">AI Semantic Summary</p>
                                    <div className="p-4 bg-white dark:bg-slate-950/50 rounded-2xl text-[11px] font-medium leading-relaxed text-slate-600 dark:text-slate-400 border border-slate-100/50 dark:border-slate-800/50 italic">
                                        {formData.ai_context}
                                    </div>
                                </div>
                            )}

                            {formData.ai_keywords && formData.ai_keywords.length > 0 && (
                                <div className="space-y-3">
                                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest ml-1">AI Keywords</p>
                                    <div className="flex flex-wrap gap-1.5">
                                        {formData.ai_keywords.map((kw, idx) => (
                                            <Badge key={idx} variant="outline" className="bg-white/50 dark:bg-slate-900/50 border-slate-200/50 dark:border-slate-700/50 text-[9px] font-bold text-indigo-600 dark:text-indigo-400 px-2 py-0.5 rounded-lg">
                                                {kw}
                                            </Badge>
                                        ))}
                                    </div>
                                </div>
                            )}

                            <div className="pt-2">
                                <button 
                                    onClick={() => {
                                        reindexMutation.mutate(selectedLocation.id, {
                                            onSuccess: (updated) => {
                                                setFormData(prev => ({ ...prev, ...updated }));
                                                alert('Semantic indexing complete!');
                                            }
                                        })
                                    }}
                                    disabled={reindexMutation.isPending}
                                    className="w-full py-3 bg-indigo-600/5 hover:bg-indigo-600 text-indigo-600 hover:text-white rounded-xl font-black text-[9px] uppercase tracking-widest border border-indigo-600/20 transition-all flex items-center justify-center gap-2 group disabled:opacity-50"
                                >
                                    <Zap size={14} className={cn("group-hover:scale-110", reindexMutation.isPending && "animate-pulse")} />
                                    {reindexMutation.isPending ? 'Процесс AI индексации...' : 'Переиндексировать семантику (Deep AI)'}
                                </button>
                                <p className="text-[8px] font-bold text-slate-400 text-center mt-3 uppercase tracking-widest opacity-60">
                                    Это обновит векторные данные, AI-теги и детальное описание для рекомендаций.
                                </p>
                            </div>
                        </div>
                    )}

                    {/* Section: Culinary Enrichment */}
                    {selectedLocation.id !== 'NEW' && (
                        <div className="p-6 rounded-[28px] bg-slate-50 dark:bg-slate-800/30 border border-slate-100 dark:border-slate-800/50 space-y-6">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-amber-500/10 rounded-lg">
                                        <Sparkles size={16} className="text-amber-600 dark:text-amber-400" />
                                    </div>
                                    <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-900 dark:text-white">Culinary Enrichment</h4>
                                </div>
                            </div>

                            <div className="flex gap-2">
                                <div className="relative flex-1 group/input">
                                    <input
                                        type="text"
                                        value={culinarySearchQuery}
                                        onChange={e => setCulinarySearchQuery(e.target.value)}
                                        onKeyDown={e => e.key === 'Enter' && handleCulinarySearch()}
                                        className="w-full pl-5 pr-10 py-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-bold placeholder:text-slate-400 outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all"
                                        placeholder="Поиск блюд или ингредиентов..."
                                    />
                                    <Search size={12} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-300" />
                                </div>
                                <button 
                                    onClick={handleCulinarySearch}
                                    disabled={spoonacularMutation.isPending}
                                    className="px-4 py-3 bg-slate-950 text-white dark:bg-white dark:text-slate-950 rounded-xl font-bold text-[10px] uppercase tracking-widest disabled:opacity-50"
                                >
                                    {spoonacularMutation.isPending ? '...' : 'Найти'}
                                </button>
                            </div>

                            {culinaryResults && (
                                <div className="space-y-4">
                                    {culinaryResults.dishes?.length > 0 && (
                                        <div className="space-y-2">
                                            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Блюда (Spoonacular)</p>
                                            <div className="grid grid-cols-1 gap-2">
                                                {culinaryResults.dishes.map(dish => (
                                                    <div key={dish.id} className="flex items-center justify-between p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-800 group hover:border-indigo-500/30 transition-all">
                                                        <div className="flex items-center gap-3">
                                                            {dish.image && <img src={dish.image} className="w-8 h-8 rounded-lg object-cover" alt="" />}
                                                            <div className="flex-1 min-w-0">
                                                                <p className="text-[11px] font-bold text-slate-900 dark:text-white truncate">{dish.name}</p>
                                                                <p className="text-[9px] text-slate-400 line-clamp-1">{dish.description}</p>
                                                            </div>
                                                        </div>
                                                        <button 
                                                            onClick={() => addCulinaryItem(dish, 'dish')}
                                                            className="p-1.5 bg-indigo-50 text-indigo-600 rounded-lg opacity-0 group-hover:opacity-100 transition-all"
                                                        >
                                                            <Plus size={14} />
                                                        </button>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {culinaryResults.ingredients?.length > 0 && (
                                        <div className="space-y-2">
                                            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Ингредиенты</p>
                                            <div className="flex flex-wrap gap-2">
                                                {culinaryResults.ingredients.map(ing => (
                                                    <Badge 
                                                        key={ing.id} 
                                                        variant="outline" 
                                                        className="cursor-pointer hover:bg-emerald-50 hover:text-emerald-600 hover:border-emerald-200 transition-all flex items-center gap-1.5 px-3 py-1"
                                                        onClick={() => addCulinaryItem(ing, 'ingredient')}
                                                    >
                                                        {ing.image && <img src={ing.image} className="w-3 h-3 rounded-full" alt="" />}
                                                        {ing.name}
                                                    </Badge>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    )}

                    {/* Section: General */}
                    <div className="space-y-8">
                        <div className="flex items-center gap-3 border-l-4 border-indigo-500 pl-4">
                            <h3 className="text-xs font-bold uppercase tracking-widest text-slate-900 dark:text-white">Основная информация</h3>
                        </div>

                        <div className="space-y-6">
                            <div className="space-y-3">
                                <label className="text-[10px] font-black uppercase text-slate-400 dark:text-slate-500 tracking-[0.2em] ml-1">Название объекта *</label>
                                <div className="relative group">
                                    <input
                                        type="text"
                                        value={formData.title}
                                        onChange={e => setFormData({ ...formData, title: e.target.value })}
                                        className="w-full px-6 py-4.5 bg-slate-50/50 dark:bg-slate-800/50 rounded-2xl border-2 border-transparent focus:border-indigo-500/20 focus:bg-white dark:focus:bg-slate-800 font-bold text-sm outline-none transition-all"
                                        placeholder="Напр. Zen Garden"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-6">
                                <div className="space-y-3">
                                    <label className="text-[10px] font-black uppercase text-slate-400 dark:text-slate-500 tracking-[0.2em] ml-1">Тип / Категория</label>
                                    <div className="relative">
                                        <select
                                            value={formData.category}
                                            onChange={e => setFormData({ ...formData, category: e.target.value })}
                                            className="w-full px-6 py-4 bg-slate-50/40 dark:bg-slate-800/40 rounded-2xl border-none font-bold text-xs outline-none focus:ring-4 ring-indigo-500/5 transition-all appearance-none"
                                        >
                                            {categories.map(cat => (
                                                <option key={cat} value={cat}>{cat}</option>
                                            ))}
                                        </select>
                                        <ChevronDown size={14} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                                    </div>
                                </div>

                                <div className="space-y-3">
                                    <label className="text-[10px] font-black uppercase text-slate-400 dark:text-slate-500 tracking-[0.2em] ml-1">Ценовой диапазон</label>
                                    <div className="relative">
                                        <select
                                            value={formData.price_level}
                                            onChange={e => setFormData({ ...formData, price_level: e.target.value })}
                                            className="w-full px-6 py-4 bg-slate-50/40 dark:bg-slate-800/40 rounded-2xl border-none font-bold text-xs outline-none focus:ring-4 ring-indigo-500/5 transition-all appearance-none"
                                        >
                                            {['$', '$$', '$$$', '$$$$'].map(price => (
                                                <option key={price} value={price}>{price}</option>
                                            ))}
                                        </select>
                                        <ChevronDown size={14} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-3">
                                <label className="text-[10px] font-black uppercase text-slate-400 dark:text-slate-500 tracking-[0.2em] ml-1">Описание</label>
                                <div className="relative">
                                    <textarea
                                        value={formData.description}
                                        onChange={e => setFormData({ ...formData, description: e.target.value })}
                                        rows={4}
                                        className="w-full px-6 py-4 bg-slate-50/50 dark:bg-slate-800/50 rounded-2xl border-2 border-transparent focus:border-indigo-500/20 focus:bg-white dark:focus:bg-slate-800 font-medium text-sm outline-none transition-all resize-none"
                                        placeholder="Расскажите об атмосфере, кухне и особенностях..."
                                    />
                                    <button
                                        onClick={() => handleImproveText('description')}
                                        disabled={isImproving === 'description'}
                                        className="absolute top-3 right-3 p-2 bg-indigo-50 text-indigo-600 rounded-lg hover:bg-indigo-100 transition-all disabled:opacity-50"
                                        title="Улучшить с AI"
                                    >
                                        <Sparkles size={14} className={isImproving === 'description' ? 'animate-spin' : ''} />
                                    </button>
                                </div>
                            </div>

                            <div className="space-y-3">
                                <label className="text-[10px] font-black uppercase text-slate-400 dark:text-slate-500 tracking-[0.2em] ml-1">Что попробовать (must try)</label>
                                <input
                                    type="text"
                                    value={formData.must_try}
                                    onChange={e => setFormData({ ...formData, must_try: e.target.value })}
                                    className="w-full px-6 py-4 bg-slate-50/50 dark:bg-slate-800/50 rounded-2xl border-2 border-transparent focus:border-indigo-500/20 focus:bg-white dark:focus:bg-slate-800 font-medium text-sm outline-none transition-all"
                                    placeholder="Через запятую: Тирамису, Ризотто, Панна котта"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Section: Location & Contact */}
                    <div className="space-y-8">
                        <div className="flex items-center gap-3 border-l-4 border-indigo-500 pl-4">
                            <h3 className="text-xs font-bold uppercase tracking-widest text-slate-900 dark:text-white">Локация и Контакты</h3>
                        </div>

                        <div className="space-y-6">
                            <div className="grid grid-cols-2 gap-6">
                                <div className="space-y-3">
                                    <label className="text-[10px] font-black uppercase text-slate-400 dark:text-slate-500 tracking-[0.2em] ml-1">Город *</label>
                                    <input
                                        type="text"
                                        value={formData.city}
                                        onChange={e => setFormData({ ...formData, city: e.target.value })}
                                        className="w-full px-6 py-4 bg-slate-50/50 dark:bg-slate-800/50 rounded-2xl border-2 border-transparent focus:border-indigo-500/20 focus:bg-white dark:focus:bg-slate-800 font-bold text-sm outline-none transition-all"
                                        placeholder="Напр. Krakow"
                                    />
                                </div>
                                <div className="space-y-3">
                                    <label className="text-[10px] font-black uppercase text-slate-400 dark:text-slate-500 tracking-[0.2em] ml-1">Страна</label>
                                    <input
                                        type="text"
                                        value={formData.country}
                                        onChange={e => setFormData({ ...formData, country: e.target.value })}
                                        className="w-full px-6 py-4 bg-slate-50/50 dark:bg-slate-800/50 rounded-2xl border-2 border-transparent focus:border-indigo-500/20 focus:bg-white dark:focus:bg-slate-800 font-medium text-sm outline-none transition-all"
                                        placeholder="Напр. Poland"
                                    />
                                </div>
                            </div>

                            <div className="space-y-3">
                                <label className="text-[10px] font-black uppercase text-slate-400 dark:text-slate-500 tracking-[0.2em] ml-1">Адрес</label>
                                <input
                                    type="text"
                                    value={formData.address}
                                    onChange={e => setFormData({ ...formData, address: e.target.value })}
                                    className="w-full px-6 py-4 bg-slate-50/50 dark:bg-slate-800/50 rounded-2xl border-2 border-transparent focus:border-indigo-500/20 focus:bg-white dark:focus:bg-slate-800 font-medium text-sm outline-none transition-all"
                                    placeholder="Улица, дом"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-6">
                                <div className="space-y-3">
                                    <label className="text-[10px] font-black uppercase text-slate-400 dark:text-slate-500 tracking-[0.2em] ml-1">Website</label>
                                    <input
                                        type="text"
                                        value={formData.website}
                                        onChange={e => setFormData({ ...formData, website: e.target.value })}
                                        className="w-full px-6 py-4 bg-slate-50/50 dark:bg-slate-800/50 rounded-2xl border-2 border-transparent focus:border-indigo-500/20 focus:bg-white dark:focus:bg-slate-800 font-medium text-sm outline-none transition-all"
                                        placeholder="https://..."
                                    />
                                </div>
                                <div className="space-y-3">
                                    <label className="text-[10px] font-black uppercase text-slate-400 dark:text-slate-500 tracking-[0.2em] ml-1">Phone</label>
                                    <input
                                        type="text"
                                        value={formData.phone}
                                        onChange={e => setFormData({ ...formData, phone: e.target.value })}
                                        className="w-full px-6 py-4 bg-slate-50/50 dark:bg-slate-800/50 rounded-2xl border-2 border-transparent focus:border-indigo-500/20 focus:bg-white dark:focus:bg-slate-800 font-medium text-sm outline-none transition-all"
                                        placeholder="+48 ..."
                                    />
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Section: Labels & Tags */}
                    <div className="space-y-8">
                        <div className="flex items-center gap-3 border-l-4 border-indigo-500 pl-4">
                            <h3 className="text-xs font-bold uppercase tracking-widest text-slate-900 dark:text-white">Лейблы и Теги</h3>
                        </div>

                        <div className="space-y-6">
                            {Object.entries(LABEL_GROUPS).map(([group, labels]) => (
                                <div key={group} className="space-y-3">
                                    <label className="text-[9px] font-black uppercase text-slate-400 dark:text-slate-500 tracking-[0.2em] ml-1">{group}</label>
                                    <div className="flex flex-wrap gap-2">
                                        {labels.map(label => {
                                            const isActive = (formData.special_labels || []).includes(label)
                                            return (
                                                <button
                                                    key={label}
                                                    onClick={() => toggleLabel(label)}
                                                    className={cn(
                                                        "px-3 py-1.5 rounded-xl text-[9px] font-bold uppercase tracking-widest transition-all border",
                                                        isActive
                                                            ? "bg-indigo-600 text-white border-indigo-600 shadow-lg shadow-indigo-500/20"
                                                            : "bg-slate-50 dark:bg-slate-800/50 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:border-indigo-300"
                                                    )}
                                                >
                                                    {label}
                                                </button>
                                            )
                                        })}
                                    </div>
                                </div>
                            ))}

                            <div className="space-y-3">
                                <label className="text-[9px] font-black uppercase text-slate-400 dark:text-slate-500 tracking-[0.2em] ml-1">Лучшее время для посещения</label>
                                <div className="grid grid-cols-4 gap-2">
                                    {BEST_TIMES.map(time => {
                                        const isActive = (formData.best_for || []).includes(time.id)
                                        return (
                                            <button
                                                key={time.id}
                                                onClick={() => toggleBestTime(time.id)}
                                                className={cn(
                                                    "flex flex-col items-center gap-2 p-3 rounded-xl border transition-all",
                                                    isActive
                                                        ? "bg-indigo-600 text-white border-indigo-600"
                                                        : "bg-slate-50 dark:bg-slate-800/50 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:border-indigo-300"
                                                )}
                                            >
                                                <time.icon size={16} />
                                                <span className="text-[8px] font-bold uppercase tracking-wider">{time.label}</span>
                                            </button>
                                        )
                                    })}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="sticky bottom-0 pt-6 pb-2 bg-gradient-to-t from-white dark:from-slate-900 to-transparent">
                        <button
                            onClick={onSave}
                            className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-lg shadow-indigo-500/30 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
                        >
                            <Building2 size={16} />
                            {selectedLocation.id === 'NEW' ? 'Создать объект' : 'Сохранить изменения'}
                        </button>
                    </div>
                </div>
            </motion.div>
        </>
    )
}

export default LocationFormSlideOver
