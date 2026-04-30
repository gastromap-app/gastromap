import { useState, useEffect, useCallback } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { 
    useAdminLocationsQuery, useCreateLocationMutation, useUpdateLocationMutation, useDeleteLocationMutation, 
    useUpdateLocationStatusMutation, usePendingLocations, useExtractLocationMutation, 
    useReindexLocationSemanticMutation, useBulkReindexLocationsMutation, useSpoonacularSearchMutation,
    useUpdateLocationEmbeddingMutation, useBulkUpdateEmbeddingsMutation,
    useEnrichLocationFullMutation,
    useAIQueryMutation, useCulinaryContextMutation,
    usePendingReviews, useUpdateReviewStatusMutation
} from '@/shared/api/queries'
import { applyAllFilters } from '@/shared/utils/locationFilters'
import { exportLocationsToCSV } from '@/shared/utils/importExportUtils'

/**
 * Custom hook for Admin Locations page business logic
 * Extracted to reduce component complexity and improve testability
 */
export const useAdminLocations = () => {
    const [searchQuery, setSearchQuery] = useState('')
    const [statusFilter, setStatusFilter] = useState('all')
    
    // Advanced Filters (Synchronized with Dashboard)
    const [activeCategory, setActiveCategory] = useState('All')
    const [activePriceLevels, setActivePriceLevels] = useState([])
    const [minRating, setMinRating] = useState(null)
    const [activeVibes, setActiveVibes] = useState([])
    const [sortBy, setSortBy] = useState('newest')
    const [activeCity, setActiveCity] = useState('All')
    const [activeCountry, setActiveCountry] = useState('All')

    // Reset city when country changes
    useEffect(() => {
        setActiveCity('All')
    }, [activeCountry])

    const [selectedLocation, setSelectedLocation] = useState(null)
    const [isSlideOverOpen, setIsSlideOverOpen] = useState(false)
    const [isImportWizardOpen, setIsImportWizardOpen] = useState(false)
    const [viewMode, setViewMode] = useState('list')
    const [formData, setFormData] = useState(null)
    const [aiSearchQuery, setAiSearchQuery] = useState('')
    const [culinarySearchQuery, setCulinarySearchQuery] = useState('')
    const [culinaryResults, setCulinaryResults] = useState(null)
    const [openActionMenuId, setOpenActionMenuId] = useState(null)
    const [isImproving, setIsImproving] = useState(null)
    const [isExporting, setIsExporting] = useState(false)
    const [toast, setToast] = useState(null)
    const [currentPage, setCurrentPage] = useState(1)
    const PAGE_SIZE = 20

    // Auto-hide toast
    useEffect(() => {
        if (toast) {
            const timer = setTimeout(() => setToast(null), 4000)
            return () => clearTimeout(timer)
        }
    }, [toast])

    // Background tasks listener with UI feedback
    useEffect(() => {
        const handleBgTask = (e) => {
            const { type, status } = e.detail
            
            const taskNames = {
                'ai-enrichment': 'AI Обогащение',
                'translation': 'Авто-перевод',
                'kg-sync': 'KG Синхронизация'
            }

            const name = taskNames[type] || type

            if (status === 'running') {
                setToast({ message: `${name}: процесс запущен...`, type: 'info' })
            } else if (status === 'success') {
                setToast({ message: `${name}: данные обновлены успешно!`, type: 'success' })
            } else if (status === 'error') {
                setToast({ message: `${name}: ошибка при выполнении.`, type: 'error' })
            }
        }
        window.addEventListener('bg-task-status', handleBgTask)
        return () => window.removeEventListener('bg-task-status', handleBgTask)
    }, [])

    const handleExport = async () => {
        if (!locationsList || locationsList.length === 0) {
            setToast({ message: 'Нет данных для экспорта', type: 'error' })
            return
        }

        setIsExporting(true)
        try {
            // We use the full locationsList from the database for export
            // Or we could use filteredLocations if user wants to export only current view
            // Let's export filtered results if search/filters are active, otherwise all
            const dataToExport = filteredLocations.length > 0 ? filteredLocations : locationsList
            
            exportLocationsToCSV(dataToExport)
            
            setToast({ 
                message: `Экспортировано ${dataToExport.length} локаций`, 
                type: 'success' 
            })
        } catch (err) {
            console.error('[Export] error:', err)
            setToast({ message: 'Ошибка при экспорте данных', type: 'error' })
        } finally {
            setIsExporting(false)
        }
    }

    const location = useLocation()
    const navigate = useNavigate()

    // Data fetching
    const { data: locsData, isLoading: loadingLocations, error: loadError } = useAdminLocationsQuery({ all: true, limit: 500 })
    const locationsList = locsData?.data ?? []
    
    const createLocMutation = useCreateLocationMutation()
    const updateLocMutation = useUpdateLocationMutation()
    const deleteLocMutation = useDeleteLocationMutation()
    const updateLocStatusMutation = useUpdateLocationStatusMutation()
    const { data: pendingLocations = [] } = usePendingLocations()
    const { data: pendingReviews = [] } = usePendingReviews()
    const updateReviewStatusMutation = useUpdateReviewStatusMutation()
    const extractMutation = useExtractLocationMutation()
    const reindexMutation = useReindexLocationSemanticMutation()
    const bulkReindexMutation = useBulkReindexLocationsMutation()
    const embeddingMutation = useUpdateLocationEmbeddingMutation()
    const bulkEmbeddingMutation = useBulkUpdateEmbeddingsMutation()
    const fullEnrichMutation = useEnrichLocationFullMutation()
    const spoonacularMutation = useSpoonacularSearchMutation()
    const aiQueryMutation = useAIQueryMutation()
    const culinaryContextMutation = useCulinaryContextMutation()

    const handleCreateNew = useCallback(() => {
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
            what_to_try: [],
            price_range: '$$',
            website: '',
            phone: '',
            opening_hours: '',
            booking_url: '',
            social_instagram: '',
            social_facebook: '',
            image: '',
            photos: [],
            images: [],
            lat: 50.0647,
            lng: 19.9450,
            google_rating: null,
            rating: null,
            tags: [],
            vibe: [],
            features: [],
            special_labels: [],
            best_for: [],
            dietary: [],
            cuisine: '',
            has_wifi: false,
            has_outdoor_seating: false,
            reservations_required: false,
            michelin_stars: 0,
            michelin_bib: false,
            // KG fields
            kg_cuisines: [],
            kg_dishes: [],
            kg_ingredients: [],
            kg_allergens: [],
            kg_enriched_at: null,
            status: 'pending'
        }
        setSelectedLocation(emptyLocation)
        setFormData(emptyLocation)
        setIsSlideOverOpen(true)
    }, [setSelectedLocation, setFormData, setIsSlideOverOpen])

    // URL parameter handling
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
    }, [location.search, location.pathname, navigate, handleCreateNew])

    // Logging
    useEffect(() => {
        if (locsData) console.log('[Admin] Locations loaded:', locsData.data?.length)
        if (loadError) console.error('[Admin] Load Error:', loadError)
    }, [locsData, loadError])

    // (Removed duplicate bg-task-status listener — the one above at line ~59 already handles toasts)

    const prepareFormData = (loc) => {
        if (!loc) return null
        
        const prepared = { ...loc }
        
        // Handle must_try alias for the UI string input
        if (Array.isArray(loc.what_to_try)) {
            prepared.must_try = loc.what_to_try.join(', ')
        } else {
            prepared.must_try = loc.what_to_try || ''
        }

        // Ensure KG fields are present (they come from normalise now)
        prepared.kg_cuisines    = loc.kg_cuisines    ?? []
        prepared.kg_dishes      = loc.kg_dishes      ?? []
        prepared.kg_ingredients = loc.kg_ingredients ?? []
        prepared.kg_allergens   = loc.kg_allergens   ?? []
        prepared.kg_enriched_at = loc.kg_enriched_at ?? null

        // Ensure other optional fields
        prepared.vibe           = loc.vibe           ?? []
        prepared.features       = loc.features       ?? []
        prepared.dietary        = loc.dietary        ?? []
        prepared.michelin_stars = loc.michelin_stars ?? 0
        prepared.michelin_bib   = loc.michelin_bib   ?? false
        
        // Map canonical fields to UI field names for editing
        if (loc.cuisine_types?.length) {
            prepared.cuisine = loc.cuisine_types.join(', ')
        }
        
        // price_range is already canonical, no mapping needed for UI

        
        // FIX: Do NOT overwrite vibe from tags — they are separate DB columns
        // vibe = atmosphere labels, tags = search keywords — different semantics
        // Ensure vibe has a value from the location data (already set above)
        if (!prepared.vibe?.length && loc.tags?.length) {
            // Only fall back to tags if vibe is truly empty
            prepared.vibe = [...loc.tags]
        }

        return prepared
    }

    const handleEdit = (loc) => {
        if (!loc) return
        setSelectedLocation(loc)
        setFormData(prepareFormData(loc))
        setIsSlideOverOpen(true)
    }

    const handleAIMagic = async (externalQuery) => {
        // Accept query from card component or fall back to internal state
        const query = (typeof externalQuery === 'string' ? externalQuery : aiSearchQuery).trim()
        if (!query) return

        try {
            const data = await extractMutation.mutateAsync(query)
            if (data) {
                const source = data._source === 'google_places' ? '✅ Google Places' : '⚠️ AI (fallback)'
                console.log(`[GastroAssistant] Data source: ${source}`, data)

                setFormData(prev => ({
                    ...prev,
                    // Core fields — prefer Google Places data
                    title:         data.title         ?? prev.title,
                    category:      data.category      ?? prev.category,
                    city:          data.city           ?? prev.city,
                    country:       data.country        ?? prev.country,
                    address:       data.address        ?? prev.address,
                    lat:           data.lat            ?? prev.lat,
                    lng:           data.lng            ?? prev.lng,
                    google_rating: data.google_rating  ?? prev.google_rating,
                    rating:        data.rating         ?? prev.rating ?? data.google_rating,
                    // Contact
                    phone:         data.phone          ?? prev.phone,
                    website:       data.website        ?? prev.website,
                    // Content
                    description:   data.description    ?? prev.description,
                    insider_tip:   data.insider_tip    ?? prev.insider_tip,
                    cuisine:       data.cuisine        ?? prev.cuisine,
                    price_range:   data.price_range    ?? data.price_level ?? prev.price_range,
                    opening_hours: data.opening_hours  ?? prev.opening_hours,
                    // Arrays — merge or replace
                    tags:          data.tags?.length       ? data.tags       : prev.tags,
                    amenities:     data.amenities?.length  ? data.amenities  : prev.amenities,
                    dietary:       data.dietary?.length    ? data.dietary    : prev.dietary,
                    best_for:      data.best_for?.length   ? data.best_for   : prev.best_for,
                    // what_to_try from either field name
                    what_to_try:   data.what_to_try?.length ? data.what_to_try
                                   : data.must_try?.length  ? (typeof data.must_try === 'string' ? data.must_try.split(',').map(s=>s.trim()) : data.must_try)
                                   : prev.what_to_try,
                    // Meta
                    _data_source: source,
                    _candidates:  data._candidates ?? null,
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

    const handleApprove = async (id) => {
        try {
            await updateLocStatusMutation.mutateAsync({ id, status: 'approved' })
        } catch (error) {
            console.error('Approve failed:', error)
        }
    }

    const handleToggleVisibility = async (id, currentStatus) => {
        try {
            const newStatus = (currentStatus === 'active' || currentStatus === 'approved') ? 'hidden' : 'active'
            await updateLocStatusMutation.mutateAsync({ id, status: newStatus })
        } catch (error) {
            console.error('Toggle visibility failed:', error)
        }
    }

    const handleReject = async (id) => {
        try {
            await updateLocStatusMutation.mutateAsync({ id, status: 'rejected' })
        } catch (error) {
            console.error('Reject failed:', error)
        }
    }

    const handleApproveReview = async (reviewId) => {
        try {
            await updateReviewStatusMutation.mutateAsync({ reviewId, status: 'published' })
            setToast({ message: 'Отзыв одобрен и опубликован.', type: 'success' })
        } catch (error) {
            console.error('Approve review failed:', error)
            setToast({ message: 'Ошибка при одобрении отзыва.', type: 'error' })
        }
    }

    const handleRejectReview = async (reviewId) => {
        try {
            await updateReviewStatusMutation.mutateAsync({ reviewId, status: 'rejected' })
            setToast({ message: 'Отзыв отклонён.', type: 'success' })
        } catch (error) {
            console.error('Reject review failed:', error)
            setToast({ message: 'Ошибка при отклонении отзыва.', type: 'error' })
        }
    }

    const handleDelete = (id) => {
        if (confirm('Вы уверены, что хотите удалить этот объект? Это действие нельзя отменить.')) {
            deleteLocMutation.mutate(id)
        }
    }

    const handleImproveText = async (field) => {
        const text = formData[field]
        if (!text || text.length < 5) {
            alert('Сначала введите хотя бы немного текста для улучшения')
            return
        }
        
        setIsImproving(field)
        try {
            const prompt = `Improve this Gastronomic location ${field}. Make it engaging, evocative and professional, while keeping the original intent. Length should be proportional. Here is the text: "${text}"`
            const result = await aiQueryMutation.mutateAsync({ message: prompt })
            
            let improvedText = ""
            if (typeof result === 'string') {
                improvedText = result
            } else if (result && typeof result === 'object') {
                improvedText = result.text || result.content || result.result || result.output || JSON.stringify(result)
            }
            
            improvedText = improvedText.replace(/^["']|["']$/g, '').trim()
            setFormData(prev => ({ ...prev, [field]: improvedText }))
        } catch (error) {
            console.error('AI improvement failed:', error)
        } finally {
            setIsImproving(null)
        }
    }

    const prepareSubmissionData = (formData) => {
        const submissionData = { ...formData }
        
        // Map old field names to canonical Supabase schema
        if (submissionData.cuisine) {
            submissionData.cuisine_types = typeof submissionData.cuisine === 'string' 
                ? submissionData.cuisine.split(',').map(s => s.trim()).filter(Boolean)
                : submissionData.cuisine
            delete submissionData.cuisine
        }
        

        
        // vibe is a separate column — keep it as-is, also merge into tags for search
        if (submissionData.vibe?.length) {
            const existingTags = submissionData.tags || []
            submissionData.tags = [...new Set([...existingTags, ...submissionData.vibe])]
            // DO NOT delete vibe — it's a separate DB column
        }
        
        // Handle what_to_try / must_try with both array and string sources
        if (Array.isArray(submissionData.what_to_try) && submissionData.what_to_try.length > 0) {
            submissionData.must_try = submissionData.what_to_try.join(', ')
        } else if (typeof submissionData.must_try === 'string' && submissionData.must_try.trim()) {
            submissionData.what_to_try = submissionData.must_try.split(',').map(s => s.trim()).filter(Boolean)
            submissionData.must_try = submissionData.must_try.trim()
        }

        // Clean up legacy fields to ensure strict schema adherence
        // Ensure both ratings are numbers if present
        if (submissionData.rating !== undefined && submissionData.rating !== null) {
            submissionData.rating = parseFloat(submissionData.rating)
        }
        if (submissionData.google_rating !== undefined && submissionData.google_rating !== null) {
            submissionData.google_rating = parseFloat(submissionData.google_rating)
        }

        return submissionData
    }

    const handleSave = () => {
        // Validation
        if (!formData.title?.trim()) return alert('Название обязательно')
        if (!formData.category) return alert('Категория обязательна')
        if (!formData.city) return alert('Город обязателен')

        // Basic URL Validation
        const urlFields = ['website', 'booking_url', 'social_instagram', 'social_facebook']
        for (const field of urlFields) {
            const val = formData[field]?.trim()
            if (val && !val.startsWith('http') && !val.startsWith('www')) {
                return alert(`Поле ${field} должно быть ссылкой (напр. https://...)`)
            }
        }

        const submissionData = prepareSubmissionData(formData)

        if (selectedLocation.id === 'NEW') {
            submissionData.status = 'pending'
            createLocMutation.mutate(submissionData, { 
                onSuccess: () => {
                    setIsSlideOverOpen(false)
                    setFormData(null)
                    setSelectedLocation(null)
                    // FIX: Switch filter to 'pending' so newly created location is visible
                    setStatusFilter('pending')
                    setToast({ message: 'Локация создана! Статус: ожидает модерации.', type: 'success' })
                },
                onError: (err) => {
                    alert('Ошибка создания: ' + (err?.message || 'Попробуйте ещё раз'))
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
                },
                onError: (err) => {
                    alert('Ошибка сохранения: ' + (err?.message || 'Попробуйте ещё раз'))
                }
            })
        }
    }

    const filteredLocations = applyAllFilters(locationsList, {
        activeCategory,
        searchQuery,
        activePriceLevels,
        minRating,
        activeVibes,
        sortBy,
        activeCity,
        activeCountry,
    }).filter(loc => statusFilter === 'all' || loc.status === statusFilter)

    // Derived data for filters
    const countries = Array.from(new Set(locationsList.map(l => l.country).filter(Boolean))).sort()
    const cities = Array.from(new Set(
        locationsList
            .filter(l => activeCountry === 'All' || l.country === activeCountry)
            .map(l => l.city)
            .filter(Boolean)
    )).sort()

    // Pagination logic
    const totalPages = Math.ceil(filteredLocations.length / PAGE_SIZE)
    const paginatedLocations = filteredLocations.slice(
        (currentPage - 1) * PAGE_SIZE,
        currentPage * PAGE_SIZE
    )

    // Reset to page 1 when filters change
    useEffect(() => {
        setCurrentPage(1)
    }, [searchQuery, statusFilter, activeCategory, activePriceLevels, minRating, activeVibes, sortBy, activeCity, activeCountry])

    const addImageUrl = (url) => {
        if (!url) return
        setFormData(prev => {
            if (!prev) return prev
            return {
                ...prev,
                images: [...(prev.images || []), url],
                image_url: prev.image_url || url
            }
        })
    }

    const removeImage = (index) => {
        setFormData(prev => {
            if (!prev || !prev.images) return prev
            const newImages = prev.images.filter((_, i) => i !== index)
            return {
                ...prev,
                images: newImages,
                image_url: prev.image_url === prev.images[index] ? (newImages[0] || '') : prev.image_url
            }
        })
    }

    return {
        // State
        statusFilter,
        setStatusFilter,
        searchQuery,
        setSearchQuery,
        activeCategory,
        setActiveCategory,
        activePriceLevels,
        setActivePriceLevels,
        minRating,
        setMinRating,
        activeVibes,
        setActiveVibes,
        sortBy,
        setSortBy,
        activeCity,
        setActiveCity,
        activeCountry,
        setActiveCountry,
        selectedLocation,
        setSelectedLocation,
        isSlideOverOpen,
        setIsSlideOverOpen,
        isImportWizardOpen,
        setIsImportWizardOpen,
        viewMode,
        setViewMode,
        formData,
        setFormData,
        aiSearchQuery,
        setAiSearchQuery,
        culinarySearchQuery,
        setCulinarySearchQuery,
        culinaryResults,
        setCulinaryResults,
        openActionMenuId,
        setOpenActionMenuId,
        isImproving,
        setIsImproving,
        toast,
        setToast,
        
        // Data
        locationsList,
        pendingLocations,
        pendingReviews,
        loadingLocations,
        loadError,
        filteredLocations,
        countries,
        cities,
        
        // Mutations
        createLocMutation,
        updateLocMutation,
        deleteLocMutation,
        updateLocStatusMutation,
        updateReviewStatusMutation,
        extractMutation,
        reindexMutation,
        embeddingMutation,
        bulkEmbeddingMutation,
        fullEnrichMutation,
        bulkReindexMutation,
        spoonacularMutation,
        aiQueryMutation,
        culinaryContextMutation,
        
        // Pagination
        currentPage,
        setCurrentPage,
        totalPages,
        PAGE_SIZE,
        paginatedLocations,
        
        // Handlers
        handleCreateNew,
        handleEdit,
        handleAIMagic,
        handleCulinarySearch,
        addCulinaryItem,
        handleApprove,
        handleReject,
        handleToggleVisibility,
        handleDelete,
        handleImproveText,
        handleSave,
        addImageUrl,
        removeImage,
        prepareFormData,
        isExporting,
        handleExport,
        handleApproveReview,
        handleRejectReview
    }
}
