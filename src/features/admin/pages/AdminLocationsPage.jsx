import React, { useEffect, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import {
    Plus, Search, Filter, MoreHorizontal, Edit, Trash2,
    Download, Upload, ChevronRight, Globe, Building2, MapPin,
    CheckCircle, Clock, AlertCircle, Star, ChevronDown, ArrowRight,
    X, LayoutGrid, List as ListIcon, Activity, Zap, Phone, Link as LinkIcon, Tag, Sparkles,
    Instagram, Facebook, Wand2, Image as ImageIcon, Map, CalendarCheck, Save,
    MessageSquare, User, Calendar
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { AnimatePresence } from 'framer-motion'
import { cn } from '@/lib/utils'
import { MapContainer, TileLayer, Marker, Popup, useMapEvents } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import L from 'leaflet'
import { useTheme } from '@/hooks/useTheme'
import AdminPageHeader, { adminBtnPrimary, adminBtnSecondary } from '../components/AdminPageHeader'
import LocationHierarchyExplorer from '../components/LocationHierarchyExplorer'
import ImportWizard from '../components/ImportWizard'
import MapTab from '@/features/dashboard/components/MapTab'
import { useAdminLocations } from '../hooks/useAdminLocations'

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

    const lat = position?.[0]
    const lng = position?.[1]

    useEffect(() => {
        if (isValidPosition) {
            // Only update view if the position is significantly different to prevent jumping
            const currentCenter = map.getCenter();
            const dist = Math.sqrt(Math.pow(currentCenter.lat - position[0], 2) + Math.pow(currentCenter.lng - position[1], 2));
            if (dist > 0.0001) {
                map.setView(position, map.getZoom());
            }
        }
    }, [lat, lng, map, isValidPosition, position]);

    // Only render marker if position is valid
    return isValidPosition ? (
        <Marker position={position}></Marker>
    ) : null;
}

import LocationListItem from '../components/LocationListItem'
import LocationFormSlideOver from '../components/LocationFormSlideOver'
import LocationFilters from '../components/LocationFilters'
import LocationStats from '../components/LocationStats'
import ListViewSection from '../components/ListViewSection'
import { getLabelGroups } from '@/shared/config/filterOptions'

const AdminLocationsPage = () => {
    const { t, i18n } = useTranslation()
    const hook = useAdminLocations()
    
    const {
        statusFilter, setStatusFilter, searchQuery, setSearchQuery,
        activeCategory, setActiveCategory, activePriceLevels, setActivePriceLevels,
        minRating, setMinRating, activeVibes, setActiveVibes, sortBy, setSortBy,
        activeCity, setActiveCity, activeCountry, setActiveCountry,
        selectedLocation, isSlideOverOpen, setIsSlideOverOpen,
        isImportWizardOpen, setIsImportWizardOpen, viewMode, setViewMode,
        formData, setFormData,
        culinarySearchQuery, setCulinarySearchQuery, culinaryResults,
        openActionMenuId, setOpenActionMenuId, isImproving, setIsImproving,
        locationsList, pendingLocations, pendingReviews, loadError, filteredLocations,
        countries, cities,
        paginatedLocations, totalPages, currentPage, setCurrentPage, PAGE_SIZE,
        extractMutation, reindexMutation, bulkReindexMutation, spoonacularMutation,
        embeddingMutation, bulkEmbeddingMutation, fullEnrichMutation,
        aiQueryMutation,
        handleCreateNew, handleEdit, handleAIMagic, handleCulinarySearch, addCulinaryItem,
        handleApprove, handleReject, handleToggleVisibility, handleDelete, handleSave,
        handleApproveReview, handleRejectReview,
        isExporting, handleExport,
        toast, setToast
    } = hook

    const { theme } = useTheme()
    const isDark = theme === 'dark'

    const LABEL_GROUPS = getLabelGroups(i18n.language)

    const mapLocations = useMemo(() =>
        filteredLocations.filter(l => l.coordinates?.lat && l.coordinates?.lng),
        [filteredLocations]
    )

    const mapCenter = useMemo(() => {
        if (!mapLocations.length) return [50.0647, 19.9450]
        return [
            mapLocations.reduce((s, l) => s + l.coordinates.lat, 0) / mapLocations.length,
            mapLocations.reduce((s, l) => s + l.coordinates.lng, 0) / mapLocations.length,
        ]
    }, [mapLocations])

    const BEST_TIMES = [
        { id: 'morning', label: t('admin.morning'), icon: Clock },
        { id: 'day', label: t('admin.day'), icon: Clock },
        { id: 'evening', label: t('admin.evening'), icon: Clock },
        { id: 'late_night', label: t('admin.late_night'), icon: Clock }
    ]


    return (
        <div className="space-y-6 lg:space-y-10 pb-12 font-sans">
            {/* Error Message Display */}
            {loadError && (
                <div className="bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 p-6 rounded-3xl mb-6">
                    <div className="flex items-start gap-4">
                        <div className="w-10 h-10 rounded-2xl bg-red-100 dark:bg-red-500/20 flex items-center justify-center text-red-600 dark:text-red-400 shrink-0">
                            <AlertCircle size={20} />
                        </div>
                        <div>
                            <h3 className="text-sm font-bold text-red-900 dark:text-red-200 uppercase tracking-widest leading-none mt-1">{t('admin.errors.data_load_failure')}</h3>
                            <p className="text-[11px] text-red-600 dark:text-red-400 font-medium mt-2 leading-relaxed">
                                {loadError.message || t('admin.data_load_error_desc')}
                            </p>
                        </div>
                    </div>
                </div>
            )}

            <AdminPageHeader
                eyebrow={t('admin.admin_panel_label')}
                title={t('admin.locations_title')}
                subtitle={t('admin.locations_subtitle')}
                actions={
                    <div className="flex items-center gap-2">
                        <div className="hidden sm:flex items-center gap-2">
                            <button
                                onClick={() => setIsImportWizardOpen(true)}
                                className={adminBtnSecondary}
                            >
                                <Upload size={16} />
                                <span className="hidden lg:inline ml-1">{t('admin.import')}</span>
                            </button>
                            <button
                                onClick={handleExport}
                                disabled={isExporting}
                                className={cn(adminBtnSecondary, "disabled:opacity-40")}
                            >
                                <Download size={16} />
                                <span className="hidden lg:inline ml-1">{isExporting ? t('admin.exporting') : t('admin.export')}</span>
                            </button>
                            <button
                                onClick={() => {
                                    if (confirm(t('admin.bulk_reindex_confirm'))) {
                                        bulkReindexMutation.mutate({ limit: 50, onlyMissing: true })
                                    }
                                }}
                                disabled={bulkReindexMutation.isPending}
                                className={cn(adminBtnSecondary, "disabled:opacity-40")}
                            >
                                <Sparkles size={16} className="text-indigo-500" />
                                <span className="hidden lg:inline ml-1">{bulkReindexMutation.isPending ? t('admin.reindexing') : t('admin.ai_reindex')}</span>
                            </button>
                            <button
                                onClick={() => {
                                    const mode = confirm(t('admin.bulk_embedding_confirm'))
                                    bulkEmbeddingMutation.mutate({ limit: 50, onlyEmpty: mode })
                                }}
                                disabled={bulkEmbeddingMutation.isPending}
                                className={cn(adminBtnSecondary, "disabled:opacity-40")}
                                title={t('admin.update_embeddings_title')}
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-violet-500">
                                    <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
                                    <polyline points="3.29 7 12 12 20.71 7"/>
                                    <line x1="12" y1="22" x2="12" y2="12"/>
                                </svg>
                                <span className="hidden lg:inline ml-1">{bulkEmbeddingMutation.isPending ? t('admin.embedding') : t('admin.embeddings')}</span>
                            </button>
                        </div>
                        <button
                            onClick={handleCreateNew}
                            className={adminBtnPrimary}
                        >
                            <Plus size={18} />
                            <span className="hidden sm:inline ml-1">{t('admin.new')}</span>
                        </button>
                    </div>
                }
            />

            <LocationStats locationsList={locationsList} pendingLocations={pendingLocations} />

            <div className="bg-white dark:bg-[hsl(220,20%,6%)] rounded-[32px] lg:rounded-[48px] border border-slate-100 dark:border-white/[0.06] shadow-sm overflow-hidden flex flex-col flex-1 min-h-[600px]">
                <LocationFilters
                    view={statusFilter}
                    onViewChange={setStatusFilter}
                    viewMode={viewMode}
                    onViewModeChange={setViewMode}
                    searchQuery={searchQuery}
                    onSearchChange={setSearchQuery}
                    filteredCount={filteredLocations.length}
                    totalCount={locationsList.length}
                    
                    // Advanced Filters
                    activeCategory={activeCategory}
                    onCategoryChange={setActiveCategory}
                    activePriceLevels={activePriceLevels}
                    onPriceLevelsChange={setActivePriceLevels}
                    minRating={minRating}
                    onMinRatingChange={setMinRating}
                    activeVibes={activeVibes}
                    onVibesChange={setActiveVibes}
                    sortBy={sortBy}
                    onSortChange={setSortBy}
                    activeCity={activeCity}
                    onCityChange={setActiveCity}
                    activeCountry={activeCountry}
                    onCountryChange={setActiveCountry}
                    cities={cities}
                    countries={countries}
                />

                {/* Pagination */}
                {statusFilter !== 'reviews' && totalPages > 1 && (
                    <div className="flex items-center justify-center gap-2 py-4 border-b border-slate-50 dark:border-white/[0.04]">
                        <button
                            disabled={currentPage === 1}
                            onClick={() => setCurrentPage(p => p - 1)}
                            className="px-4 py-2 rounded-xl text-sm font-bold bg-slate-100 dark:bg-[hsl(220,20%,9%)] disabled:opacity-30 hover:bg-slate-200 dark:hover:bg-[hsl(220,20%,15%)] transition-colors"
                        > {t('admin.actions.prev')} </button>
                        <span className="text-sm font-bold text-slate-500 dark:text-[hsl(220,10%,55%)]">
                            {currentPage} / {totalPages}
                        </span>
                        <button
                            disabled={currentPage === totalPages}
                            onClick={() => setCurrentPage(p => p + 1)}
                            className="px-4 py-2 rounded-xl text-sm font-bold bg-slate-100 dark:bg-[hsl(220,20%,9%)] disabled:opacity-30 hover:bg-slate-200 dark:hover:bg-[hsl(220,20%,15%)] transition-colors"
                        > {t('admin.actions.next')} </button>
                    </div>
                )}

                <div className="flex-1 flex flex-col pt-2 font-black leading-none">
                    {statusFilter === 'reviews' ? (
                        <div className="p-4 lg:p-10">
                            {pendingReviews.length === 0 ? (
                                <div className="text-center py-20">
                                    <MessageSquare size={48} className="mx-auto text-slate-300 dark:text-[hsl(220,10%,35%)] mb-4" />
                                    <p className="text-lg font-bold text-slate-400">{t('admin.no_reviews_pending')}</p>
                                    <p className="text-sm text-slate-400 mt-1">{t('admin.all_reviews_checked')}</p>
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    {pendingReviews.map((rev) => (
                                        <div
                                            key={rev.id}
                                            className="bg-white dark:bg-[hsl(220,20%,6%)] rounded-[24px] border border-slate-100 dark:border-white/[0.06] p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
                                        >
                                            <div className="flex items-start gap-4 flex-1 min-w-0">
                                                <div className="w-12 h-12 rounded-xl bg-indigo-50 dark:bg-[hsl(217,91%,60%)]/10 flex items-center justify-center text-indigo-600 dark:text-[hsl(217,91%,60%)] shrink-0">
                                                    <User size={22} />
                                                </div>
                                                <div className="min-w-0">
                                                    <div className="flex items-center gap-2 flex-wrap">
                                                        <p className="text-sm font-bold text-slate-900 dark:text-[hsl(220,20%,96%)]">{rev.profiles?.name || t('admin.anonymous')}</p>
                                                        <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider flex items-center gap-1">
                                                            <MapPin size={10} /> {rev.locations?.title || rev.location_id}
                                                        </span>
                                                    </div>
                                                    <div className="flex items-center gap-1 mt-1">
                                                        {[1,2,3,4,5].map(s => (
                                                            <Star key={s} size={12} className={s <= rev.rating ? 'text-amber-400 fill-amber-400' : 'text-slate-200 dark:text-[hsl(220,6%,30%)] fill-slate-200 dark:fill-[hsl(220,6%,30%)]'} />
                                                        ))}
                                                    </div>
                                                    <p className="text-sm text-slate-600 dark:text-[hsl(220,10%,55%)] mt-2 line-clamp-2">{rev.review_text}</p>
                                                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-1 flex items-center gap-1">
                                                        <Calendar size={10} /> {new Date(rev.created_at).toLocaleDateString(i18n.language === 'ru' ? 'ru-RU' : i18n.language)}
                                                    </p>
                                                </div>
                                            </div>
                                            <div className="flex gap-2 w-full sm:w-auto">
                                                <button
                                                    onClick={() => handleRejectReview(rev.id)}
                                                    className="flex-1 sm:flex-none px-5 py-3 bg-white dark:bg-[hsl(220,20%,9%)] text-rose-600 dark:text-rose-400 rounded-[20px] font-bold text-[10px] uppercase tracking-widest border border-slate-100 dark:border-white/[0.06] active:scale-95 transition-all"
                                                >
                                                    {t('admin.reject')}
                                                </button>
                                                <button
                                                    onClick={() => handleApproveReview(rev.id)}
                                                    className="flex-1 sm:flex-none px-5 py-3 bg-emerald-500 hover:bg-emerald-600 text-white rounded-[20px] font-bold text-[10px] uppercase tracking-widest active:scale-95 transition-all shadow-lg shadow-emerald-500/20"
                                                >
                                                    {t('admin.approve')}
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    ) : viewMode === 'list' ? (
                        <ListViewSection
                            filteredLocations={paginatedLocations}
                            viewMode={viewMode}
                            onEditLocation={handleEdit}
                            onDelete={handleDelete}
                            onApprove={handleApprove}
                            onReject={handleReject}
                            onToggleVisibility={handleToggleVisibility}
                            openActionMenuId={openActionMenuId}
                            onToggleActionMenu={(id) => setOpenActionMenuId(openActionMenuId === id ? null : id)}
                        />
                    ) : viewMode === 'map' ? (
                        <div className="flex-1 relative min-h-[500px]">
                            {mapLocations.length === 0 ? (
                                <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-400">
                                    <MapPin size={48} className="mb-3 opacity-30" />
                                    <p className="text-sm font-bold">{t('admin.no_locations_with_coords')}</p>
                                </div>
                            ) : (
                                <MapContainer
                                    center={mapCenter}
                                    zoom={5}
                                    scrollWheelZoom={false}
                                    className="w-full h-full absolute inset-0"
                                >
                                    <TileLayer
                                        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
                                        url={isDark
                                            ? 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
                                            : 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png'}
                                    />
                                    {mapLocations.map(loc => (
                                        <Marker
                                            key={loc.id}
                                            position={[loc.coordinates.lat, loc.coordinates.lng]}
                                        >
                                            <Popup>
                                                <div className="font-sans p-1 min-w-[160px]">
                                                    <p className="font-bold text-sm text-slate-900">{loc.title}</p>
                                                    <p className="text-xs text-slate-500 mt-0.5">{loc.city}{loc.country ? `, ${loc.country}` : ''}</p>
                                                    {(loc.google_rating ?? loc.rating) && (
                                                        <p className="text-xs text-amber-600 font-bold mt-1">★ {loc.google_rating ?? loc.rating}</p>
                                                    )}
                                                    <span className={cn(
                                                        "inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider mt-2",
                                                        loc.status === 'active' || loc.status === 'approved'
                                                            ? "bg-emerald-50 text-emerald-600"
                                                            : loc.status === 'pending'
                                                                ? "bg-amber-50 text-amber-600"
                                                                : "bg-rose-50 text-rose-500"
                                                    )}>
                                                        {loc.status}
                                                    </span>
                                                </div>
                                            </Popup>
                                        </Marker>
                                    ))}
                                </MapContainer>
                            )}
                        </div>
                    ) : null}
                </div>
            </div>

            <AnimatePresence>
                {isSlideOverOpen && selectedLocation && formData && (
                    <LocationFormSlideOver
                        isOpen={isSlideOverOpen}
                        onClose={() => setIsSlideOverOpen(false)}
                        selectedLocation={selectedLocation}
                        formData={formData}
                        setFormData={setFormData}
                        onSave={handleSave}
                        onDelete={handleDelete}
                        extractMutation={extractMutation}
                        aiQueryMutation={aiQueryMutation}
                        reindexMutation={reindexMutation}
                        embeddingMutation={embeddingMutation}
                        fullEnrichMutation={fullEnrichMutation}
                        isImproving={isImproving}
                        setIsImproving={setIsImproving}
                        handleAIMagic={handleAIMagic}
                        spoonacularMutation={spoonacularMutation}
                        culinarySearchQuery={culinarySearchQuery}
                        setCulinarySearchQuery={setCulinarySearchQuery}
                        culinaryResults={culinaryResults}
                        handleCulinarySearch={handleCulinarySearch}
                        addCulinaryItem={addCulinaryItem}
                    />
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

            {/* Toast Notifications */}
            <AnimatePresence>
                {toast && (
                    <div className="fixed bottom-6 right-6 z-[9999]">
                        <div 
                            className={cn(
                                "flex items-center gap-3 px-5 py-4 rounded-2xl shadow-2xl border backdrop-blur-xl animate-in slide-in-from-bottom-5",
                                toast.type === 'success' ? "bg-emerald-500/90 border-emerald-400 text-white" :
                                toast.type === 'error' ? "bg-rose-500/90 border-rose-400 text-white" :
                                "bg-indigo-600/90 border-indigo-400 text-white"
                            )}
                        >
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
            </AnimatePresence>
        </div>
    )
}

export default AdminLocationsPage
