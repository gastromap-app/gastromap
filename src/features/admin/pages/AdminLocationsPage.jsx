import React, { useState, useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import {
    Plus, Search, Filter, MoreHorizontal, Edit, Trash2,
    Download, Upload, ChevronRight, Globe, Building2, MapPin,
    CheckCircle, Clock, AlertCircle, Star, ChevronDown, ArrowRight,
    X, LayoutGrid, List as ListIcon, Activity, Zap, Phone, Link as LinkIcon, Tag, Sparkles,
    Instagram, Facebook, Wand2, Image as ImageIcon, Map, CalendarCheck, Save
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { motion, AnimatePresence } from 'framer-motion'
import { MapContainer, TileLayer, Marker, useMapEvents } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import L from 'leaflet'
import { cn } from '@/lib/utils'
import LocationHierarchyExplorer from '../components/LocationHierarchyExplorer'
import ImportWizard from '../components/ImportWizard'
import MapTab from '@/features/dashboard/components/MapTab'
import { 
    useLocations, useCreateLocationMutation, useUpdateLocationMutation, useDeleteLocationMutation, 
    useUpdateLocationStatusMutation, usePendingLocations, useExtractLocationMutation, 
    useReindexLocationSemanticMutation, useBulkReindexLocationsMutation, useSpoonacularSearchMutation,
    useAIQueryMutation, useCulinaryContextMutation 
} from '@/shared/api/queries'

// Fix for default marker icon issue with Leaflet
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
    iconRetinaUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon-2x.png',
    iconUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon.png',
    shadowUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png',
});

function LocationPicker({ position, onLocationSelect }) {
    const map = useMapEvents({
        click(e) {
            onLocationSelect(e.latlng);
        },
    });

    // Validate position has valid numbers
    const isValidPosition = position &&
        typeof position[0] === 'number' && !isNaN(position[0]) &&
        typeof position[1] === 'number' && !isNaN(position[1]);

    useEffect(() => {
        if (isValidPosition) {
            // Only update view if the position is significantly different to prevent jumping
            const currentCenter = map.getCenter();
            const dist = Math.sqrt(Math.pow(currentCenter.lat - position[0], 2) + Math.pow(currentCenter.lng - position[1], 2));
            if (dist > 0.0001) {
                map.setView(position, map.getZoom());
            }
        }
    }, [position?.[0], position?.[1], map, isValidPosition]);

    // Only render marker if position is valid
    return isValidPosition ? (
        <Marker position={position}></Marker>
    ) : null;
}

import LocationListItem from '../components/LocationListItem'
import LocationFormSlideOver from '../components/LocationFormSlideOver'
import LocationFilters from '../components/LocationFilters'
import LocationStats from '../components/LocationStats'

const AdminLocationsPage = () => {
    const [view, setView] = useState('list')
    const [searchQuery, setSearchQuery] = useState('')
    const [statusFilter, setStatusFilter] = useState('all') // 'all' | 'active' | 'pending' | 'rejected'
    const [selectedLocation, setSelectedLocation] = useState(null)
    const [isSlideOverOpen, setIsSlideOverOpen] = useState(false)
    const [isImportWizardOpen, setIsImportWizardOpen] = useState(false)
    const [viewMode, setViewMode] = useState('list') // 'list' | 'map'
    const [formData, setFormData] = useState(null)
    const [aiSearchQuery, setAiSearchQuery] = useState('')
    const [culinarySearchQuery, setCulinarySearchQuery] = useState('')
    const [culinaryResults, setCulinaryResults] = useState(null)
    const location = useLocation()
    const navigate = useNavigate()
    const [openActionMenuId, setOpenActionMenuId] = useState(null)
    const [isImproving, setIsImproving] = useState(null) // Field name currently being improved

    // useLocations returns { data: [], total, hasMore } — not a plain array
    const { data: locsData, isLoading: loadingLocations, error: loadError } = useLocations({ all: true, limit: 500 })
    const locationsList = locsData?.data ?? []
    
    useEffect(() => {
        console.log('[Admin] locsData:', locsData)
        if (loadError) console.error('[Admin] Load Error:', loadError)
    }, [locsData, loadError])
    const createLocMutation = useCreateLocationMutation()
    const updateLocMutation = useUpdateLocationMutation()
    const deleteLocMutation = useDeleteLocationMutation()
    const updateLocStatusMutation = useUpdateLocationStatusMutation()
    const { data: pendingLocations = [] } = usePendingLocations()
    const extractMutation = useExtractLocationMutation()
    const reindexMutation = useReindexLocationSemanticMutation()
    const bulkReindexMutation = useBulkReindexLocationsMutation()
    const spoonacularMutation = useSpoonacularSearchMutation()
    const aiQueryMutation = useAIQueryMutation()
    const culinaryContextMutation = useCulinaryContextMutation()

    const handleCreateNew = () => {
        const emptyLocation = {
            id: 'NEW',
            title: '',
            category: 'Cafe',
            city: '',
            country: '',
            address: '',
            description: '',
            insider_tip: '',
            must_try: '',
            price_level: '$$',
            website: '',
            phone: '',
            opening_hours: '',
            booking_url: '',
            social_instagram: '',
            social_facebook: '',
            image: '',
            images: [],
            lat: 50.0647,
            lng: 19.9450,
            tags: [],
            vibe: [],
            special_labels: [],
            cuisine: '',
            status: 'pending'
        }
        setSelectedLocation(emptyLocation)
        setFormData(emptyLocation)
        setIsSlideOverOpen(true)
    }

    const handleEdit = (loc) => {
        if (!loc) return
        setSelectedLocation(loc)
        
        // Prepare formData with aliases for UI compatibility
        const prepared = { ...loc };
        
        // Handle must_try alias for the UI string input
        if (Array.isArray(loc.what_to_try)) {
            prepared.must_try = loc.what_to_try.join(', ');
        } else {
            prepared.must_try = loc.what_to_try || '';
        }
        
        // Map canonical fields to UI field names for editing
        // cuisine_types → cuisine (string for input)
        if (loc.cuisine_types?.length) {
            prepared.cuisine = loc.cuisine_types.join(', ');
        }
        
        // price_range → price_level
        if (loc.price_range) {
            prepared.price_level = loc.price_range;
        }
        
        // Keep tags as-is, but ensure vibe is also populated for backwards compatibility
        if (loc.tags?.length) {
            prepared.vibe = [...loc.tags];
        }

        setFormData(prepared)
        setIsSlideOverOpen(true)
    }

    const handleAIMagic = async () => {
        if (!aiSearchQuery.trim()) return

        try {
            const data = await extractMutation.mutateAsync(aiSearchQuery)
            if (data) {
                setFormData(prev => ({
                    ...prev,
                    ...data,
                    must_try: Array.isArray(data.must_try) ? data.must_try.join(', ') : (data.must_try || prev.must_try || ''),
                    ...(data.what_to_try ? { must_try: data.what_to_try.join(', ') } : {})
                }))
                setAiSearchQuery('')
            }
        } catch (error) {
            console.error('[Admin] AI Magic failed:', error)
            alert('Failed to extract data. Check AI settings or connection.')
        }
    }

    const handleCulinarySearch = async () => {
        if (!culinarySearchQuery.trim()) return
        try {
            const results = await spoonacularMutation.mutateAsync({ query: culinarySearchQuery })
            setCulinaryResults(results)
        } catch (error) {
            console.error('[Admin] Culinary Search failed:', error)
        }
    }

    const addCulinaryItem = (item, type) => {
        if (type === 'dish') {
            const currentTry = formData.must_try ? formData.must_try.split(',').map(s => s.trim()) : []
            if (!currentTry.includes(item.name)) {
                setFormData({
                    ...formData,
                    must_try: [...currentTry, item.name].join(', '),
                    description: formData.description + `\n\nSignature dish: ${item.description}`
                })
            }
        } else if (type === 'ingredient') {
            const currentTags = formData.tags || []
            if (!currentTags.includes(item.name)) {
                setFormData({
                    ...formData,
                    tags: [...currentTags, item.name]
                })
            }
        }
    }

    useEffect(() => {
        const params = new URLSearchParams(location.search)
        if (params.get('create') === 'true') {
            const timer = setTimeout(() => {
                handleCreateNew()
                navigate(location.pathname, { replace: true })
            }, 0)
            return () => clearTimeout(timer)
        } else if (params.get('import') === 'true') {
            const timer = setTimeout(() => {
                setIsImportWizardOpen(true)
                navigate(location.pathname, { replace: true })
            }, 0)
            return () => clearTimeout(timer)
        }
    }, [location.search])

    const handleApprove = async (id) => {
        try {
            await updateLocStatusMutation.mutateAsync({ id, status: 'approved' })
        } catch (error) {
            console.error('Approve failed:', error)
        }
    }

    const handleReject = async (id) => {
        try {
            await updateLocStatusMutation.mutateAsync({ id, status: 'rejected' })
        } catch (error) {
            console.error('Reject failed:', error)
        }
    }

    const handleDelete = (id) => {
        if (confirm('Вы уверены, что хотите удалить этот объект? Это действие нельзя отменить.')) {
            deleteLocMutation.mutate(id)
        }
    }

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
            // Advanced extraction for varied AI responses
            let improvedText = "";
            if (typeof result === 'string') {
                improvedText = result;
            } else if (result && typeof result === 'object') {
                improvedText = result.text || result.content || result.result || result.output || JSON.stringify(result);
            }
            
            // Cleanup: remove surrounding quotes if AI added them
            improvedText = improvedText.replace(/^["']|["']$/g, '').trim();
            
            setFormData(prev => ({ ...prev, [field]: improvedText }));
        } catch (error) {
            console.error('AI improvement failed:', error);
        } finally {
            setIsImproving(null);
        }
    };

    const handleSave = () => {
        // Validation
        if (!formData.title?.trim()) return alert('Название обязательно');
        if (!formData.category) return alert('Категория обязательна');
        if (!formData.city) return alert('Город обязателен');

        // Basic URL Validation
        const urlFields = ['website', 'booking_url', 'social_instagram', 'social_facebook'];
        for (const field of urlFields) {
            const val = formData[field]?.trim();
            if (val && !val.startsWith('http') && !val.startsWith('www')) {
                return alert(`Поле ${field} должно быть ссылкой (напр. https://...)`);
            }
        }

        const submissionData = { ...formData };
        
        // Map old field names to canonical Supabase schema
        // cuisine → cuisine_types
        if (submissionData.cuisine) {
            submissionData.cuisine_types = typeof submissionData.cuisine === 'string' 
                ? submissionData.cuisine.split(',').map(s => s.trim()).filter(Boolean)
                : submissionData.cuisine;
            delete submissionData.cuisine;
        }
        
        // price_level → price_range
        if (submissionData.price_level) {
            submissionData.price_range = submissionData.price_level;
            delete submissionData.price_level;
        }
        
        // vibe → tags (merge if both exist)
        if (submissionData.vibe?.length) {
            const existingTags = submissionData.tags || [];
            submissionData.tags = [...new Set([...existingTags, ...submissionData.vibe])];
            delete submissionData.vibe;
        }
        
        // Handle must_try alias for the UI string input
        if (typeof submissionData.must_try === 'string') {
            submissionData.what_to_try = submissionData.must_try
                .split(',')
                .map(s => s.trim())
                .filter(Boolean);
        }

        if (selectedLocation.id === 'NEW') {
            // New items are pending by default
            submissionData.status = 'pending'
            createLocMutation.mutate(submissionData, { 
                onSuccess: () => {
                    setIsSlideOverOpen(false)
                    setFormData(null)
                    setSelectedLocation(null)
                } 
            })
        } else {
            updateLocMutation.mutate({ 
                id: selectedLocation.id, 
                updates: submissionData 
            }, { 
                onSuccess: () => {
                    setIsSlideOverOpen(false)
                    setFormData(null)
                    setSelectedLocation(null)
                } 
            })
        }
    }

    const filteredLocations = locationsList.filter(loc => {
        const matchesSearch = !searchQuery ||
            loc.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            loc.city?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            loc.category?.toLowerCase().includes(searchQuery.toLowerCase())
        
        const matchesStatus = statusFilter === 'all' || loc.status === statusFilter
        
        return matchesSearch && matchesStatus
    })

    useEffect(() => {
        console.log('[Admin] locationsList.length:', locationsList.length)
        console.log('[Admin] filteredLocations.length:', filteredLocations.length)
        console.log('[Admin] pendingLocations.length:', pendingLocations.length)
    }, [locationsList.length, filteredLocations.length, pendingLocations.length])

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

    const addImageUrl = (url) => {
        if (!url) return;
        setFormData(prev => {
            if (!prev) return prev;
            return {
                ...prev,
                images: [...(prev.images || []), url],
                image_url: prev.image_url || url // Set as main if it's the first one
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

    const renderListView = (filtered) => (
        <div className="overflow-x-auto custom-scrollbar">
            <table className="w-full text-left border-collapse min-w-[800px]">
                <thead>
                    <tr className="bg-slate-50/50 dark:bg-slate-900/50">
                        <th className="px-6 py-4 text-[10px] font-bold uppercase text-slate-400 dark:text-slate-500 tracking-widest pl-8 lg:pl-10">Объект</th>
                        <th className="px-6 py-4 text-[10px] font-bold uppercase text-slate-400 dark:text-slate-500 tracking-widest">Локация</th>
                        <th className="px-6 py-4 text-[10px] font-bold uppercase text-slate-400 dark:text-slate-500 tracking-widest">Рейтинг</th>
                        <th className="px-6 py-4 text-[10px] font-bold uppercase text-slate-400 dark:text-slate-500 tracking-widest">Статус</th>
                        <th className="px-6 py-4 text-right pr-8 lg:pr-10"></th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-50 dark:divide-slate-800/50">
                    {filtered.map((loc) => (
                        <LocationListItem
                            key={loc.id}
                            loc={loc}
                            onEdit={handleEdit}
                            onApprove={handleApprove}
                            onReject={handleReject}
                            onDelete={handleDelete}
                            isOpenActionMenu={openActionMenuId === loc.id}
                            onToggleActionMenu={(id) => setOpenActionMenuId(openActionMenuId === id ? null : id)}
                        />
                    ))}
                </tbody>
            </table>
        </div>
    )

    return (
        <div className="space-y-6 lg:space-y-8 pb-10">
            {/* Error Message Display */}
            {loadError && (
                <div className="bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 p-6 rounded-3xl mb-6">
                    <div className="flex items-start gap-4">
                        <div className="w-10 h-10 rounded-2xl bg-red-100 dark:bg-red-500/20 flex items-center justify-center text-red-600 dark:text-red-400 shrink-0">
                            <AlertCircle size={20} />
                        </div>
                        <div>
                            <h3 className="text-sm font-bold text-red-900 dark:text-red-200 uppercase tracking-widest leading-none mt-1">Data Load Failure</h3>
                            <p className="text-[11px] text-red-600 dark:text-red-400 font-medium mt-2 leading-relaxed">
                                {loadError.message || 'Could not fetch data from database. Please check your Supabase configuration or network connection.'}
                            </p>
                        </div>
                    </div>
                </div>
            )}

            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-6">
                <div>
                    <h1 className="text-xl lg:text-3xl font-bold text-slate-900 dark:text-white leading-none tracking-tight">Локации</h1>
                    <p className="text-slate-500 dark:text-slate-400 font-medium mt-1.5 text-xs lg:text-base">База объектов и инструменты модерации.</p>
                </div>
                <div className="flex gap-2 w-full sm:w-auto p-1 bg-slate-100/50 dark:bg-slate-900/50 rounded-2xl border border-slate-200/20 dark:border-slate-800/50">
                    <button
                        onClick={() => setIsImportWizardOpen(true)}
                        className="flex-1 sm:px-6 py-2.5 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl font-bold text-[10px] uppercase tracking-widest shadow-sm active:scale-95 transition-all"
                    >
                        Импорт
                    </button>
                    <button
                        onClick={handleCreateNew}
                        className="flex-1 sm:px-8 py-2.5 bg-indigo-600 text-white rounded-xl font-bold text-[10px] uppercase tracking-widest shadow-lg shadow-indigo-500/20 active:scale-95 transition-all"
                    >
                        Создать
                    </button>
                    <button
                        onClick={() => {
                            if (confirm('Запустить фоновое индексирование всех объектов без векторного поиска?')) {
                                bulkReindexMutation.mutate({ limit: 50, onlyMissing: true }, {
                                    onSuccess: (data) => alert(`Обработано ${data.processed} объектов`)
                                })
                            }
                        }}
                        disabled={bulkReindexMutation.isPending}
                        className="px-4 py-2.5 bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400 rounded-xl font-bold text-[10px] uppercase tracking-widest border border-amber-200/50 dark:border-amber-500/20 active:scale-95 transition-all hover:bg-amber-100 disabled:opacity-50"
                        title="AI Bulk Indexing"
                    >
                        {bulkReindexMutation.isPending ? 'AI...' : <Sparkles size={14} />}
                    </button>
                </div>
            </div>

            <LocationStats locationsList={locationsList} pendingLocations={pendingLocations} />

            <div className="bg-white dark:bg-slate-900/50 rounded-[32px] lg:rounded-[48px] border border-slate-100 dark:border-slate-800/50 shadow-sm overflow-hidden flex flex-col min-h-[500px]">
                <LocationFilters
                    view={view}
                    onViewChange={setView}
                    viewMode={viewMode}
                    onViewModeChange={setViewMode}
                    statusFilter={statusFilter}
                    onStatusFilterChange={setStatusFilter}
                    searchQuery={searchQuery}
                    onSearchChange={setSearchQuery}
                    pendingCount={pendingLocations.length}
                />

                <div className="flex-1 flex flex-col pt-2 font-black leading-none">
                    <AnimatePresence mode="wait">
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} key={view}>
                            {view === 'list' && (
                                viewMode === 'list' ? renderListView(filteredLocations) : (
                                    <div className="h-[600px] w-full p-4 lg:p-10">
                                        <MapTab />
                                    </div>
                                )
                            )}
                            {view === 'moderation' && (
                                <div className="p-8 lg:p-14 space-y-6">
                                    {pendingLocations.length > 0 ? pendingLocations.map(loc => (
                                        <div key={loc.id} className="bg-slate-50/50 dark:bg-slate-800/30 rounded-[32px] border border-slate-100 dark:border-slate-800/50 p-6 flex flex-col sm:flex-row items-center justify-between gap-6 group hover:border-indigo-500/10 transition-all">
                                            <div className="flex items-center gap-6">
                                                <div className="w-16 h-16 rounded-[24px] bg-white dark:bg-slate-800 flex items-center justify-center text-slate-300 shadow-sm group-hover:scale-105 transition-transform"><Building2 size={24} /></div>
                                                <div>
                                                    <h3 className="text-lg lg:text-xl font-bold text-slate-900 dark:text-white leading-none mb-2">{loc.title}</h3>
                                                    <p className="text-xs font-medium text-slate-400 flex items-center gap-1.5"><MapPin size={12} /> {loc.city}, {loc.country}</p>
                                                </div>
                                            </div>
                                            <div className="flex gap-2 w-full sm:w-auto">
                                                <button onClick={() => handleEdit(loc)} className="flex-1 sm:px-6 py-3.5 bg-white dark:bg-slate-800 text-slate-900 dark:text-white rounded-[20px] font-bold text-[10px] uppercase tracking-widest border border-slate-100 dark:border-slate-700 active:scale-95 transition-all">Проверить</button>
                                                <button onClick={() => handleApprove(loc.id)} className="flex-1 sm:px-6 py-3.5 bg-indigo-600 text-white rounded-[20px] font-bold text-[10px] uppercase tracking-widest active:scale-95 transition-all">Одобрить</button>
                                                <button onClick={() => handleReject(loc.id)} className="flex-1 sm:px-6 py-3.5 bg-white dark:bg-slate-800 text-orange-500 rounded-[20px] font-bold text-[10px] uppercase tracking-widest border border-slate-100 dark:border-slate-700 active:scale-95 transition-all">Отклонить</button>
                                            </div>
                                        </div>
                                    )) : (
                                        <div className="text-center py-20">
                                            <AlertCircle size={48} className="mx-auto text-slate-300 dark:text-slate-700 mb-4" />
                                            <p className="text-lg font-bold text-slate-400">Очередь пуста</p>
                                            <p className="text-sm text-slate-400 mt-1">Нет объектов на модерации</p>
                                        </div>
                                    )}
                                </div>
                            )}
                        </motion.div>
                    </AnimatePresence>
                </div>
            </div>

            <AnimatePresence>
                {isSlideOverOpen && formData && (
                    <>
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsSlideOverOpen(false)} className="fixed inset-0 z-[100] bg-slate-900/10 backdrop-blur-md" />
                        <motion.div initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }} transition={{ type: 'spring', damping: 30, stiffness: 250 }} className="fixed top-0 right-0 w-full sm:w-[600px] bg-white dark:bg-slate-900 h-full z-[110] flex flex-col shadow-2xl overflow-hidden font-sans">

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
                                <button onClick={() => setIsSlideOverOpen(false)} aria-label="close-panel" className="p-2.5 lg:p-3 bg-slate-50 dark:bg-slate-800 text-slate-400 rounded-xl lg:rounded-2xl hover:rotate-90 transition-all"><X size={18} className="lg:w-5 lg:h-5" /></button>
                            </div>

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
                                                    <ChevronDown className="absolute right-5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={14} />
                                                </div>
                                            </div>
                                            <div className="space-y-3">
                                                <label className="text-[10px] font-black uppercase text-slate-400 dark:text-slate-500 tracking-[0.2em] ml-1">Основная кухня</label>
                                                <div className="relative">
                                                    <select
                                                        value={formData.cuisine}
                                                        onChange={e => setFormData({ ...formData, cuisine: e.target.value })}
                                                        className="w-full px-6 py-4 bg-slate-50/40 dark:bg-slate-800/40 rounded-2xl border-none font-bold text-xs outline-none focus:ring-4 ring-indigo-500/5 transition-all appearance-none"
                                                    >
                                                        <option value="">Не выбрано</option>
                                                        {[
                                                            "Итальянская", "Французская", "Японская", "Китайская", "Греческая", "Испанская",
                                                            "Мексиканская", "Тайская", "Грузинская", "Польская", "Израильская", "Американская",
                                                            "Средиземноморская", "Индийская", "Вьетнамская", "Турецкая"
                                                        ].sort().map(cuisine => (
                                                            <option key={cuisine} value={cuisine}>{cuisine}</option>
                                                        ))}
                                                    </select>
                                                    <ChevronDown className="absolute right-5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={14} />
                                                </div>
                                            </div>
                                        </div>

                                        <div className="space-y-3">
                                            <label className="text-[10px] font-black uppercase text-slate-400 dark:text-slate-500 tracking-[0.2em] ml-1">Диапазон цен</label>
                                            <div className="relative">
                                                <select
                                                    value={formData.price_level}
                                                    onChange={e => setFormData({ ...formData, price_level: e.target.value })}
                                                    className="w-full px-6 py-4 bg-slate-50/40 dark:bg-slate-800/40 rounded-2xl border-none font-bold text-xs outline-none focus:ring-4 ring-indigo-500/5 transition-all appearance-none"
                                                >
                                                    <option value="$">$ (Дешево)</option>
                                                    <option value="$$">$$ (Средне)</option>
                                                    <option value="$$$">$$$ (Дорого)</option>
                                                    <option value="$$$$">$$$$ (Люкс)</option>
                                                </select>
                                                <ChevronDown className="absolute right-5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={14} />
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Section: Location */}
                                <div className="space-y-8">
                                    <div className="flex items-center gap-3 border-l-4 border-indigo-500 pl-4">
                                        <h3 className="text-xs font-bold uppercase tracking-widest text-slate-900 dark:text-white">Геопозиция и Адрес</h3>
                                    </div>

                                    <div className="space-y-6">
                                        <div className="grid grid-cols-2 gap-6">
                                            <div className="space-y-3">
                                                <label className="text-[10px] font-black uppercase text-slate-400 dark:text-slate-500 tracking-[0.2em] ml-1">Страна</label>
                                                <input
                                                    type="text"
                                                    value={formData.country}
                                                    onChange={e => setFormData({ ...formData, country: e.target.value })}
                                                    className="w-full px-6 py-4 bg-slate-50/40 dark:bg-slate-800/40 rounded-2xl border-none font-bold text-xs outline-none focus:ring-4 ring-indigo-500/5 transition-all"
                                                />
                                            </div>
                                            <div className="space-y-3">
                                                <label className="text-[10px] font-black uppercase text-slate-400 dark:text-slate-500 tracking-[0.2em] ml-1">Город</label>
                                                <input
                                                    type="text"
                                                    value={formData.city}
                                                    onChange={e => setFormData({ ...formData, city: e.target.value })}
                                                    className="w-full px-6 py-4 bg-slate-50/40 dark:bg-slate-800/40 rounded-2xl border-none font-bold text-xs outline-none focus:ring-4 ring-indigo-500/5 transition-all"
                                                />
                                            </div>
                                        </div>

                                        <div className="space-y-3">
                                            <label className="text-[10px] font-black uppercase text-slate-400 dark:text-slate-500 tracking-[0.2em] ml-1">Полный адрес</label>
                                            <div className="relative group">
                                                <MapPin className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-indigo-500 transition-colors w-4 h-4" />
                                                <input
                                                    type="text"
                                                    value={formData.address}
                                                    onChange={e => setFormData({ ...formData, address: e.target.value })}
                                                    className="w-full pl-14 pr-6 py-4.5 bg-slate-50/40 dark:bg-slate-800/40 rounded-2xl border-none font-bold text-xs outline-none focus:ring-4 ring-indigo-500/5 transition-all"
                                                    placeholder="Улица, дом, район..."
                                                />
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-2 gap-6">
                                            <div className="space-y-3">
                                                <label className="text-[10px] font-black uppercase text-slate-400 dark:text-slate-500 tracking-[0.2em] ml-1 text-emerald-500/80">Широта (Lat)</label>
                                                <input
                                                    type="number"
                                                    step="0.000001"
                                                    value={formData.lat}
                                                    onChange={e => setFormData({ ...formData, lat: parseFloat(e.target.value) })}
                                                    className="w-full px-6 py-4 bg-emerald-500/5 dark:bg-emerald-500/10 rounded-2xl border-none font-bold text-xs outline-none focus:ring-4 ring-emerald-500/10 transition-all font-mono"
                                                />
                                            </div>
                                            <div className="space-y-3">
                                                <label className="text-[10px] font-black uppercase text-slate-400 dark:text-slate-500 tracking-[0.2em] ml-1 text-emerald-500/80">Долгота (Lng)</label>
                                                <input
                                                    type="number"
                                                    step="0.000001"
                                                    value={formData.lng}
                                                    onChange={e => setFormData({ ...formData, lng: parseFloat(e.target.value) })}
                                                    className="w-full px-6 py-4 bg-emerald-500/5 dark:bg-emerald-500/10 rounded-2xl border-none font-bold text-xs outline-none focus:ring-4 ring-emerald-500/10 transition-all font-mono"
                                                />
                                            </div>
                                        </div>

                                        {/* Mini Map */}
                                        <div className="space-y-3">
                                            <label className="text-[10px] font-black uppercase text-slate-400 dark:text-slate-500 tracking-[0.2em] ml-1">Предпросмотр на карте</label>
                                            <div className="h-[220px] w-full rounded-[32px] border-4 border-slate-50 dark:border-slate-800/50 relative z-0 overflow-hidden shadow-inner">
                                                <MapContainer
                                                    center={[formData.lat || 50.0647, formData.lng || 19.9450]}
                                                    zoom={15}
                                                    style={{ height: '100%', width: '100%' }}
                                                >
                                                    <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                                                    <LocationPicker
                                                        position={[formData.lat, formData.lng]}
                                                        onLocationSelect={(latlng) => setFormData({ ...formData, lat: latlng.lat, lng: latlng.lng })}
                                                    />
                                                </MapContainer>
                                            </div>
                                            <p className="text-[9px] font-bold text-slate-400 text-center uppercase tracking-[0.2em] italic mt-2 opacity-60">Кликните по карте, чтобы изменить координаты</p>
                                        </div>
                                    </div>
                                </div>

                                {/* Section: Contacts & Socials */}
                                <div className="space-y-8">
                                    <div className="flex items-center gap-3 border-l-4 border-indigo-500 pl-4">
                                        <h3 className="text-xs font-bold uppercase tracking-widest text-slate-900 dark:text-white">Контакты и Сети</h3>
                                    </div>

                                    <div className="space-y-6">
                                        <div className="grid grid-cols-2 gap-6">
                                            <div className="space-y-3">
                                                <label className="text-[10px] font-black uppercase text-slate-400 dark:text-slate-500 tracking-[0.2em] ml-1">Сайт</label>
                                                <div className="relative group">
                                                    <Globe className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-indigo-500 transition-colors w-4 h-4" />
                                                    <input
                                                        type="url"
                                                        value={formData.website}
                                                        onChange={e => setFormData({ ...formData, website: e.target.value })}
                                                        className="w-full pl-14 pr-6 py-4.5 bg-slate-50/40 dark:bg-slate-800/40 rounded-2xl border-none font-bold text-xs outline-none focus:ring-4 ring-indigo-500/5 transition-all"
                                                        placeholder="Website URL"
                                                    />
                                                </div>
                                            </div>
                                            <div className="space-y-3">
                                                <label className="text-[10px] font-black uppercase text-slate-400 dark:text-slate-500 tracking-[0.2em] ml-1">Телефон</label>
                                                <div className="relative group">
                                                    <Phone className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-indigo-500 transition-colors w-4 h-4" />
                                                    <input
                                                        type="tel"
                                                        value={formData.phone}
                                                        onChange={e => setFormData({ ...formData, phone: e.target.value })}
                                                        className="w-full pl-14 pr-6 py-4.5 bg-slate-50/40 dark:bg-slate-800/40 rounded-2xl border-none font-bold text-xs outline-none focus:ring-4 ring-indigo-500/5 transition-all"
                                                        placeholder="Телефон"
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                        <div className="space-y-3">
                                            <label className="text-[10px] font-black uppercase text-indigo-500 tracking-[0.2em] ml-1">Забронировать столик (URL / API)</label>
                                            <div className="relative group">
                                                <CalendarCheck className="absolute left-6 top-1/2 -translate-y-1/2 text-indigo-400 group-focus-within:scale-110 transition-all w-4 h-4" />
                                                <input
                                                    type="url"
                                                    value={formData.booking_url}
                                                    onChange={e => setFormData({ ...formData, booking_url: e.target.value })}
                                                    className="w-full pl-14 pr-6 py-5 bg-indigo-500/5 dark:bg-indigo-500/10 rounded-[28px] border-2 border-indigo-500/10 font-bold text-xs outline-none focus:ring-4 ring-indigo-500/20 transition-all text-indigo-900 dark:text-indigo-200"
                                                    placeholder="Ссылка на бронирование..."
                                                />
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-2 gap-6">
                                            <div className="space-y-3">
                                                <label className="text-[10px] font-black uppercase text-slate-400 dark:text-slate-500 tracking-[0.2em] ml-1">Instagram</label>
                                                <div className="relative group">
                                                    <Instagram className="absolute left-6 top-1/2 -translate-y-1/2 text-pink-500 group-focus-within:scale-110 transition-all w-4 h-4" />
                                                    <input
                                                        type="text"
                                                        value={formData.social_instagram}
                                                        onChange={e => setFormData({ ...formData, social_instagram: e.target.value })}
                                                        className="w-full pl-14 pr-6 py-4 bg-slate-50/40 dark:bg-slate-800/40 rounded-2xl border-none font-bold text-xs outline-none focus:ring-4 ring-pink-500/10 transition-all"
                                                        placeholder="@username"
                                                    />
                                                </div>
                                            </div>
                                            <div className="space-y-3">
                                                <label className="text-[10px] font-black uppercase text-slate-400 dark:text-slate-500 tracking-[0.2em] ml-1">Facebook</label>
                                                <div className="relative group">
                                                    <Facebook className="absolute left-6 top-1/2 -translate-y-1/2 text-blue-500 group-focus-within:scale-110 transition-all w-4 h-4" />
                                                    <input
                                                        type="text"
                                                        value={formData.social_facebook}
                                                        onChange={e => setFormData({ ...formData, social_facebook: e.target.value })}
                                                        className="w-full pl-14 pr-6 py-4 bg-slate-50/40 dark:bg-slate-800/40 rounded-2xl border-none font-bold text-xs outline-none focus:ring-4 ring-blue-500/10 transition-all"
                                                        placeholder="facebook.com/..."
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Section: Media Gallery */}
                                <div className="space-y-8">
                                    <div className="flex items-center gap-3 border-l-4 border-indigo-500 pl-4">
                                        <h3 className="text-xs font-bold uppercase tracking-widest text-slate-900 dark:text-white">Медиа-галерея</h3>
                                    </div>

                                    <div className="space-y-6">
                                        <div className="space-y-4">

                                            <div className="space-y-4">
                                                <label className="text-[10px] font-bold uppercase text-slate-400 tracking-[0.2em] ml-1">Фотографии ({formData.images.length})</label>

                                                <div className="grid grid-cols-4 gap-4">
                                                    {formData.images.map((img, idx) => (
                                                        <div key={idx} className={cn(
                                                            "relative aspect-square rounded-2xl overflow-hidden group border-2 transition-all",
                                                            formData.image_url === img ? "border-indigo-500 shadow-lg shadow-indigo-500/10" : "border-transparent"
                                                        )}>
                                                            <img src={img} alt="Location photo option" className="w-full h-full object-cover" />
                                                            <div className="absolute inset-0 bg-slate-900/60 opacity-0 group-hover:opacity-100 transition-all flex flex-col items-center justify-center gap-2">
                                                                <button
                                                                    onClick={() => setFormData({ ...formData, image_url: img })}
                                                                    className="p-2 bg-indigo-500 text-white rounded-lg hover:scale-110 transition-transform"
                                                                >
                                                                    <Star size={12} fill={formData.image_url === img ? "white" : "none"} />
                                                                </button>
                                                                <button
                                                                    onClick={() => removeImage(idx)}
                                                                    className="p-2 bg-red-500 text-white rounded-lg hover:scale-110 transition-transform"
                                                                >
                                                                    <Trash2 size={12} />
                                                                </button>
                                                            </div>
                                                            {formData.image_url === img && (
                                                                <div className="absolute top-2 left-2 bg-indigo-500 text-white text-[8px] font-black uppercase px-2 py-0.5 rounded-md">Main</div>
                                                            )}
                                                        </div>
                                                    ))}

                                                    <button
                                                        onClick={() => {
                                                            const url = prompt('Введите URL изображения:');
                                                            if (url) addImageUrl(url);
                                                        }}
                                                        className="aspect-square rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-800 flex flex-col items-center justify-center text-slate-400 hover:text-indigo-500 hover:border-indigo-500 transition-all"
                                                    >
                                                        <Plus size={20} />
                                                        <span className="text-[8px] font-black uppercase mt-1">Добавить</span>
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>


                                {/* Section: Content & AI */}
                                <div className="space-y-8 pb-10">
                                    <div className="flex items-center gap-3 border-l-4 border-indigo-500 pl-4">
                                        <h3 className="text-xs font-bold uppercase tracking-widest text-slate-900 dark:text-white">Описание и контент</h3>
                                    </div>

                                    <div className="space-y-6">
                                        <div className="space-y-2.5">
                                            <div className="flex justify-between items-center mb-1">
                                                <label className="text-[10px] font-bold uppercase text-slate-400 tracking-[0.2em] ml-1">Описание</label>
                                                <button 
                                                    onClick={() => handleImproveText('description')}
                                                    disabled={isImproving === 'description'}
                                                    className={cn(
                                                        "flex items-center gap-1.5 text-indigo-500 text-[9px] font-black uppercase tracking-widest hover:bg-indigo-50 dark:hover:bg-slate-800 px-3 py-1.5 rounded-lg transition-all",
                                                        isImproving === 'description' && "animate-pulse opacity-50"
                                                    )}
                                                >
                                                    <Sparkles size={12} className={isImproving === 'description' ? 'animate-spin' : ''} /> 
                                                    {isImproving === 'description' ? 'Улучшаем...' : 'AI Улучшить'}
                                                </button>
                                            </div>
                                            <textarea
                                                rows={4}
                                                value={formData.description}
                                                onChange={e => setFormData({ ...formData, description: e.target.value })}
                                                className="w-full px-6 py-5 bg-slate-50/50 dark:bg-slate-800/50 rounded-3xl border-none font-medium text-[13px] leading-relaxed outline-none shadow-inner resize-y min-h-[120px] focus:ring-2 ring-indigo-500/10 transition-all font-sans"
                                            />
                                        </div>

                                        <div className="space-y-2.5">
                                            <div className="flex justify-between items-center mb-1">
                                                <label className="text-[10px] font-bold uppercase text-orange-400 tracking-[0.2em] ml-1">Insider Tip</label>
                                                <button 
                                                    onClick={() => handleImproveText('insider_tip')}
                                                    disabled={isImproving === 'insider_tip'}
                                                    className={cn(
                                                        "flex items-center gap-1.5 text-orange-500 text-[9px] font-black uppercase tracking-widest hover:bg-orange-50 dark:hover:bg-slate-800 px-3 py-1.5 rounded-lg transition-all",
                                                        isImproving === 'insider_tip' && "animate-pulse opacity-50"
                                                    )}
                                                >
                                                    <Sparkles size={12} className={isImproving === 'insider_tip' ? 'animate-spin' : ''} /> 
                                                    {isImproving === 'insider_tip' ? 'Улучшаем...' : 'AI Улучшить'}
                                                </button>
                                            </div>
                                            <textarea
                                                rows={2}
                                                value={formData.insider_tip}
                                                onChange={e => setFormData({ ...formData, insider_tip: e.target.value })}
                                                className="w-full px-6 py-4 bg-orange-500/5 rounded-2xl border border-orange-500/10 font-medium text-[12px] leading-relaxed outline-none focus:ring-2 ring-orange-500/10 transition-all italic text-orange-900 dark:text-orange-200 resize-y min-h-[80px]"
                                                placeholder="Секреты, лучшие места, лайфхаки..."
                                            />
                                        </div>

                                        <div className="space-y-2.5">
                                            <div className="flex justify-between items-center mb-1">
                                                <label className="text-[10px] font-bold uppercase text-emerald-500 tracking-[0.2em] ml-1">Must Try</label>
                                                <button 
                                                    onClick={() => handleImproveText('must_try')}
                                                    disabled={isImproving === 'must_try'}
                                                    className={cn(
                                                        "flex items-center gap-1.5 text-emerald-500 text-[9px] font-black uppercase tracking-widest hover:bg-emerald-50 dark:hover:bg-slate-800 px-3 py-1.5 rounded-lg transition-all",
                                                        isImproving === 'must_try' && "animate-pulse opacity-50"
                                                    )}
                                                >
                                                    <Sparkles size={12} className={isImproving === 'must_try' ? 'animate-spin' : ''} /> 
                                                    {isImproving === 'must_try' ? 'Улучшаем...' : 'AI Улучшить'}
                                                </button>
                                            </div>
                                            <textarea
                                                rows={2}
                                                value={formData.must_try}
                                                onChange={e => setFormData({ ...formData, must_try: e.target.value })}
                                                className="w-full px-6 py-4 bg-emerald-500/5 rounded-2xl border border-emerald-500/10 font-bold text-xs outline-none focus:ring-2 ring-emerald-500/10 transition-all text-emerald-900 dark:text-emerald-200 resize-y min-h-[80px]"
                                                placeholder="Напр. Фирменный латте, Краковская паста"
                                            />
                                        </div>

                                        <div className="space-y-2.5">
                                            <label className="text-[10px] font-bold uppercase text-slate-400 tracking-[0.2em] ml-1">Теги (Tags)</label>
                                            <div className="flex flex-wrap gap-2 p-1">
                                                <div className="flex items-center gap-2 w-full">
                                                    <Tag size={14} className="text-slate-300" />
                                                    <input
                                                        type="text"
                                                        value={formData.tags.join(', ')}
                                                        onChange={e => setFormData({ ...formData, tags: e.target.value.split(',').map(t => t.trim()) })}
                                                        className="flex-1 bg-transparent border-none outline-none font-bold text-xs text-slate-600 dark:text-slate-400"
                                                        placeholder="coffee, cozy, work, pizza..."
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Additional Options */}
                                <div className="p-8 rounded-[40px] bg-slate-900 dark:bg-white text-white dark:text-slate-900 relative overflow-hidden shadow-2xl">
                                    <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/20 rounded-full -translate-y-16 translate-x-16 blur-3xl" />
                                    <div className="relative z-10 space-y-6">
                                        <div className="flex items-center gap-3">
                                            <Activity className="text-indigo-400" size={20} />
                                            <h4 className="text-[10px] font-black uppercase tracking-[0.2em]">Настройки публикации</h4>
                                        </div>

                                        <div className="flex flex-col gap-5">
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-3">
                                                    <Sparkles className="text-amber-400" size={16} />
                                                    <span className="text-[11px] font-bold uppercase tracking-widest">Hidden Gem</span>
                                                </div>
                                                <input
                                                    type="checkbox"
                                                    checked={formData.is_hidden_gem}
                                                    onChange={e => setFormData({ ...formData, is_hidden_gem: e.target.checked })}
                                                    className="w-10 h-5 rounded-full appearance-none bg-slate-800 dark:bg-slate-200 checked:bg-indigo-500 relative transition-all cursor-pointer before:content-[''] before:absolute before:left-1 before:top-1 before:w-3 before:h-3 before:bg-white dark:before:bg-slate-900 before:rounded-full before:transition-all checked:before:translate-x-5"
                                                />
                                            </div>
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-3">
                                                    <Star className="text-indigo-400" size={16} />
                                                    <span className="text-[11px] font-bold uppercase tracking-widest">Featured (Рекомендуемое)</span>
                                                </div>
                                                <input
                                                    type="checkbox"
                                                    checked={formData.is_featured}
                                                    onChange={e => setFormData({ ...formData, is_featured: e.target.checked })}
                                                    className="w-10 h-5 rounded-full appearance-none bg-slate-800 dark:bg-slate-200 checked:bg-indigo-500 relative transition-all cursor-pointer before:content-[''] before:absolute before:left-1 before:top-1 before:w-3 before:h-3 before:bg-white dark:before:bg-slate-900 before:rounded-full before:transition-all checked:before:translate-x-5"
                                                />
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Section: Best Time & Special Labels */}
                                <div className="space-y-10 pb-10">
                                    <div className="flex items-center gap-3 border-l-4 border-indigo-500 pl-4">
                                        <h3 className="text-xs font-bold uppercase tracking-widest text-slate-900 dark:text-white">Метки и Особенности</h3>
                                    </div>

                                    <div className="space-y-8">
                                        {/* Best Time to Visit */}
                                        <div className="space-y-4">
                                            <label className="text-[10px] font-bold uppercase text-slate-400 tracking-[0.2em] ml-1">Лучшее время для посещения</label>
                                            <div className="flex flex-wrap gap-3">
                                                {BEST_TIMES.map(time => {
                                                    const isSelected = formData.best_time?.includes(time.id);
                                                    return (
                                                        <button
                                                            key={time.id}
                                                            type="button"
                                                            onClick={() => {
                                                                const current = formData.best_time || [];
                                                                const next = isSelected
                                                                    ? current.filter(t => t !== time.id)
                                                                    : [...current, time.id];
                                                                setFormData({ ...formData, best_time: next });
                                                            }}
                                                            className={cn(
                                                                "flex items-center gap-2 px-5 py-2.5 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all border",
                                                                isSelected
                                                                    ? "bg-indigo-600 border-indigo-600 text-white shadow-lg shadow-indigo-500/20"
                                                                    : "bg-white dark:bg-slate-800 border-slate-100 dark:border-slate-800 text-slate-500 hover:border-indigo-500/30"
                                                            )}
                                                        >
                                                            <time.icon size={14} />
                                                            {time.label}
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        </div>

                                        {/* Specialized Labels */}
                                        <div className="space-y-8">
                                            {Object.entries(LABEL_GROUPS).map(([group, labels]) => (
                                                <div key={group} className="space-y-4">
                                                    <div className="flex items-center gap-2">
                                                        <div className="h-px flex-1 bg-slate-100 dark:bg-slate-800/50"></div>
                                                        <span className="text-[9px] font-black uppercase tracking-[0.3em] text-slate-300 dark:text-slate-600">{group}</span>
                                                        <div className="h-px flex-1 bg-slate-100 dark:bg-slate-800/50"></div>
                                                    </div>
                                                    <div className="flex flex-wrap gap-2">
                                                        {labels.map(label => {
                                                            const isSelected = formData.special_labels?.includes(label);
                                                            return (
                                                                <button
                                                                    key={label}
                                                                    type="button"
                                                                    onClick={() => {
                                                                        const current = formData.special_labels || [];
                                                                        const next = isSelected
                                                                            ? current.filter(l => l !== label)
                                                                            : [...current, label];
                                                                        setFormData({ ...formData, special_labels: next });
                                                                    }}
                                                                    className={cn(
                                                                        "px-4 py-2 rounded-lg text-[10px] font-bold transition-all border",
                                                                        isSelected
                                                                            ? "bg-slate-900 dark:bg-white text-white dark:text-slate-900 border-slate-900 dark:border-white shadow-md shadow-slate-900/10"
                                                                            : "bg-slate-50/50 dark:bg-slate-800/50 border-transparent text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
                                                                    )}
                                                                >
                                                                    {label}
                                                                </button>
                                                            );
                                                        })}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Footer */}
                            <div className="p-6 lg:p-10 border-t border-slate-50 dark:border-slate-800/50 flex flex-col sm:flex-row gap-4 shrink-0 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl relative z-10">
                                {selectedLocation?.status === 'pending' && selectedLocation?.id !== 'NEW' && (
                                    <div className="flex gap-2 flex-1">
                                        <button 
                                            onClick={() => {
                                                handleReject(selectedLocation.id);
                                                setIsSlideOverOpen(false);
                                            }}
                                            className="flex-1 py-4 bg-orange-50 dark:bg-orange-500/10 text-orange-600 rounded-[20px] font-black text-[10px] uppercase tracking-widest border border-orange-200/50 dark:border-orange-500/20 active:scale-95 transition-all"
                                        >
                                            Отклонить
                                        </button>
                                        <button 
                                            onClick={() => {
                                                handleApprove(selectedLocation.id);
                                                setIsSlideOverOpen(false);
                                            }}
                                            className="flex-1 py-4 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 rounded-[20px] font-black text-[10px] uppercase tracking-widest border border-emerald-200/50 dark:border-emerald-500/20 active:scale-95 transition-all"
                                        >
                                            Одобрить
                                        </button>
                                    </div>
                                )}
                                <div className="flex gap-2 flex-[2]">
                                    <button 
                                        onClick={handleSave} 
                                        disabled={createLocMutation.isPending || updateLocMutation.isPending} 
                                        className="flex-1 py-4 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-[20px] font-black text-[10px] uppercase tracking-widest shadow-xl active:scale-95 transition-all flex items-center justify-center gap-3 disabled:opacity-50"
                                    >
                                        <Save size={14} className={cn((createLocMutation.isPending || updateLocMutation.isPending) && "animate-spin")} />
                                        {selectedLocation?.id === 'NEW' ? 'Создать объект' : 'Сохранить изменения'}
                                    </button>
                                    <button 
                                        onClick={() => setIsSlideOverOpen(false)} 
                                        className="px-6 py-4 bg-slate-50 dark:bg-slate-800 text-slate-400 rounded-[20px] font-bold text-[10px] uppercase tracking-widest hover:text-slate-900 dark:hover:text-white transition-all border-none"
                                    >
                                        Отмена
                                    </button>
                                </div>
                            </div>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>

            {/* Import Wizard Modal */}
            <AnimatePresence>
                {isImportWizardOpen && (
                    <ImportWizard
                        isOpen={isImportWizardOpen}
                        onClose={() => setIsImportWizardOpen(false)}
                        onImportComplete={() => {
                            // Optionally refresh list
                            console.log('Import successful')
                        }}
                    />
                )}
            </AnimatePresence>
        </div>
    )
}

export default AdminLocationsPage
