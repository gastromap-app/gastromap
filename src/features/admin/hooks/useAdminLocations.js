import { useState, useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { 
    useLocations, useCreateLocationMutation, useUpdateLocationMutation, useDeleteLocationMutation, 
    useUpdateLocationStatusMutation, usePendingLocations, useExtractLocationMutation, 
    useReindexLocationSemanticMutation, useBulkReindexLocationsMutation, useSpoonacularSearchMutation,
    useAIQueryMutation, useCulinaryContextMutation 
} from '@/shared/api/queries'

/**
 * Custom hook for Admin Locations page business logic
 * Extracted to reduce component complexity and improve testability
 */
export const useAdminLocations = () => {
    const [view, setView] = useState('list')
    const [searchQuery, setSearchQuery] = useState('')
    const [statusFilter, setStatusFilter] = useState('all')
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

    const location = useLocation()
    const navigate = useNavigate()

    // Data fetching
    const { data: locsData, isLoading: loadingLocations, error: loadError } = useLocations({ all: true, limit: 500 })
    const locationsList = locsData?.data ?? []
    
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
    }, [location.search])

    // Logging
    useEffect(() => {
        console.log('[Admin] locsData:', locsData)
        if (loadError) console.error('[Admin] Load Error:', loadError)
    }, [locsData, loadError])

    useEffect(() => {
        console.log('[Admin] locationsList.length:', locationsList.length)
    }, [locationsList.length])

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
            what_to_try: [],
            price_level: '$$',
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
    }

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
        
        if (loc.price_range) {
            prepared.price_level = loc.price_range
        }
        
        if (loc.tags?.length) {
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
                    // Contact
                    phone:         data.phone          ?? prev.phone,
                    website:       data.website        ?? prev.website,
                    // Content
                    description:   data.description    ?? prev.description,
                    insider_tip:   data.insider_tip    ?? prev.insider_tip,
                    cuisine:       data.cuisine        ?? prev.cuisine,
                    price_level:   data.price_level    ?? prev.price_level,
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
        
        if (submissionData.price_level) {
            submissionData.price_range = submissionData.price_level
            delete submissionData.price_level
        }
        
        // vibe is a separate column — keep it as-is, also merge into tags for search
        if (submissionData.vibe?.length) {
            const existingTags = submissionData.tags || []
            submissionData.tags = [...new Set([...existingTags, ...submissionData.vibe])]
            // DO NOT delete vibe — it's a separate DB column
        }
        
        if (typeof submissionData.must_try === 'string') {
            submissionData.what_to_try = submissionData.must_try
                .split(',')
                .map(s => s.trim())
                .filter(Boolean)
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
        view,
        setView,
        searchQuery,
        setSearchQuery,
        statusFilter,
        setStatusFilter,
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
        
        // Data
        locationsList,
        pendingLocations,
        loadingLocations,
        loadError,
        filteredLocations,
        
        // Mutations
        createLocMutation,
        updateLocMutation,
        deleteLocMutation,
        updateLocStatusMutation,
        extractMutation,
        reindexMutation,
        bulkReindexMutation,
        spoonacularMutation,
        aiQueryMutation,
        culinaryContextMutation,
        
        // Handlers
        handleCreateNew,
        handleEdit,
        handleAIMagic,
        handleCulinarySearch,
        addCulinaryItem,
        handleApprove,
        handleReject,
        handleDelete,
        handleImproveText,
        handleSave,
        addImageUrl,
        removeImage,
        prepareFormData
    }
}
