import React, { useEffect } from 'react'
import {
    Plus, Search, Filter, MoreHorizontal, Edit, Trash2,
    Download, Upload, ChevronRight, Globe, Building2, MapPin,
    CheckCircle, Clock, AlertCircle, Star, ChevronDown, ArrowRight,
    X, LayoutGrid, List as ListIcon, Activity, Zap, Phone, Link as LinkIcon, Tag, Sparkles,
    Instagram, Facebook, Wand2, Image as ImageIcon, Map, CalendarCheck, Save
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { AnimatePresence } from 'framer-motion'
import { cn } from '@/lib/utils'
import { MapContainer, TileLayer, Marker, useMapEvents } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import L from 'leaflet'
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
import ListViewSection from '../components/ListViewSection'
import { getLabelGroupsRu } from '@/shared/config/filterOptions'

const AdminLocationsPage = () => {
    const hook = useAdminLocations()
    
    const {
        view, setView, searchQuery, setSearchQuery,
        selectedLocation, isSlideOverOpen, setIsSlideOverOpen,
        isImportWizardOpen, setIsImportWizardOpen, viewMode, setViewMode,
        formData, setFormData,
        culinarySearchQuery, setCulinarySearchQuery, culinaryResults,
        openActionMenuId, setOpenActionMenuId, isImproving, setIsImproving,
        locationsList, pendingLocations, loadError, filteredLocations,
        paginatedLocations, totalPages, currentPage, setCurrentPage, PAGE_SIZE,
        extractMutation, reindexMutation, bulkReindexMutation, spoonacularMutation,
        embeddingMutation, bulkEmbeddingMutation, fullEnrichMutation,
        aiQueryMutation,
        handleCreateNew, handleEdit, handleAIMagic, handleCulinarySearch, addCulinaryItem,
        handleApprove, handleReject, handleToggleVisibility, handleDelete, handleSave,
        isExporting, handleExport
    } = hook

    const LABEL_GROUPS = getLabelGroupsRu() // auto-synced from filterOptions.js

    const BEST_TIMES = [
        { id: 'morning', label: 'Утро', icon: Clock },
        { id: 'day', label: 'День', icon: Clock },
        { id: 'evening', label: 'Вечер', icon: Clock },
        { id: 'late_night', label: 'Поздняя ночь', icon: Clock }
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
                            <h3 className="text-sm font-bold text-red-900 dark:text-red-200 uppercase tracking-widest leading-none mt-1">Data Load Failure</h3>
                            <p className="text-[11px] text-red-600 dark:text-red-400 font-medium mt-2 leading-relaxed">
                                {loadError.message || 'Could not fetch data from database. Please check your Supabase configuration or network connection.'}
                            </p>
                        </div>
                    </div>
                </div>
            )}

            <AdminPageHeader
                eyebrow="Admin"
                title="Locations"
                subtitle="Manage restaurants, cafes, and gastro-spots database."
                actions={
                    <div className="flex items-center gap-2">
                        <div className="hidden sm:flex items-center gap-2">
                            <button
                                onClick={() => setIsImportWizardOpen(true)}
                                className={adminBtnSecondary}
                            >
                                <Upload size={16} />
                                <span className="hidden lg:inline ml-1">Импорт</span>
                            </button>
                            <button
                                onClick={handleExport}
                                disabled={isExporting}
                                className={cn(adminBtnSecondary, "disabled:opacity-40")}
                            >
                                <Download size={16} />
                                <span className="hidden lg:inline ml-1">{isExporting ? 'Exporting...' : 'Экспорт'}</span>
                            </button>
                            <button
                                onClick={() => {
                                    if (confirm('Запустить фоновое индексирование всех объектов?')) {
                                        bulkReindexMutation.mutate({ limit: 50, onlyMissing: true })
                                    }
                                }}
                                disabled={bulkReindexMutation.isPending}
                                className={cn(adminBtnSecondary, "disabled:opacity-40")}
                            >
                                <Sparkles size={16} className="text-indigo-500" />
                                <span className="hidden lg:inline ml-1">{bulkReindexMutation.isPending ? 'Reindexing...' : 'Reindex'}</span>
                            </button>
                            <button
                                onClick={() => {
                                    const mode = confirm('Обновить только пустые embeddings?\n\nОК = только пустые\nОтмена = все локации')
                                    bulkEmbeddingMutation.mutate({ limit: 50, onlyEmpty: mode })
                                }}
                                disabled={bulkEmbeddingMutation.isPending}
                                className={cn(adminBtnSecondary, "disabled:opacity-40")}
                                title="Обновить векторные embeddings"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-violet-500">
                                    <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
                                    <polyline points="3.29 7 12 12 20.71 7"/>
                                    <line x1="12" y1="22" x2="12" y2="12"/>
                                </svg>
                                <span className="hidden lg:inline ml-1">{bulkEmbeddingMutation.isPending ? 'Embedding...' : 'Embeddings'}</span>
                            </button>
                        </div>
                        <button
                            onClick={handleCreateNew}
                            className={adminBtnPrimary}
                        >
                            <Plus size={18} />
                            <span className="hidden sm:inline ml-1">Новый</span>
                        </button>
                    </div>
                }
            />

            <LocationStats locationsList={locationsList} pendingLocations={pendingLocations} />

            <div className="bg-white dark:bg-slate-900/50 rounded-[32px] lg:rounded-[48px] border border-slate-100 dark:border-slate-800/50 shadow-sm overflow-hidden flex flex-col flex-1 min-h-[600px]">
                <LocationFilters
                    view={view}
                    onViewChange={setView}
                    viewMode={viewMode}
                    onViewModeChange={setViewMode}
                    searchQuery={searchQuery}
                    onSearchChange={setSearchQuery}
                    filteredCount={filteredLocations.length}
                    totalCount={locationsList.length}
                />

                {/* Pagination */}
                {totalPages > 1 && (
                    <div className="flex items-center justify-center gap-2 py-4 border-b border-slate-50 dark:border-slate-800/50">
                        <button
                            disabled={currentPage === 1}
                            onClick={() => setCurrentPage(p => p - 1)}
                            className="px-4 py-2 rounded-xl text-sm font-bold bg-slate-100 dark:bg-slate-800 disabled:opacity-30 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                        >← Prev</button>
                        <span className="text-sm font-bold text-slate-500 dark:text-slate-400">
                            {currentPage} / {totalPages}
                        </span>
                        <button
                            disabled={currentPage === totalPages}
                            onClick={() => setCurrentPage(p => p + 1)}
                            className="px-4 py-2 rounded-xl text-sm font-bold bg-slate-100 dark:bg-slate-800 disabled:opacity-30 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                        >Next →</button>
                    </div>
                )}

                <div className="flex-1 flex flex-col pt-2 font-black leading-none">
                    {view === 'list' && (
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
                    )}
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
        </div>
    )
}

export default AdminLocationsPage
