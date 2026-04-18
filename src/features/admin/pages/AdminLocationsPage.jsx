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
import { MapContainer, TileLayer, Marker, useMapEvents } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import L from 'leaflet'
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
import AdminLocationsHeader from '../components/AdminLocationsHeader'
import ListViewSection from '../components/ListViewSection'
import ModerationQueueView from '../components/ModerationQueueView'
import { getLabelGroupsRu } from '@/shared/config/filterOptions'

const AdminLocationsPage = () => {
    const hook = useAdminLocations()
    
    const {
        view, setView, searchQuery, setSearchQuery, statusFilter, setStatusFilter,
        selectedLocation, isSlideOverOpen, setIsSlideOverOpen,
        isImportWizardOpen, setIsImportWizardOpen, viewMode, setViewMode,
        formData, setFormData,
        culinarySearchQuery, setCulinarySearchQuery, culinaryResults,
        openActionMenuId, setOpenActionMenuId, isImproving, setIsImproving,
        locationsList, pendingLocations, loadError, filteredLocations,
        extractMutation, reindexMutation, bulkReindexMutation, spoonacularMutation,
        aiQueryMutation,
        handleCreateNew, handleEdit, handleAIMagic, handleCulinarySearch, addCulinaryItem,
        handleApprove, handleReject, handleDelete, handleSave,
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

            <AdminLocationsHeader
                onCreateNew={handleCreateNew}
                onImport={() => setIsImportWizardOpen(true)}
                onExport={handleExport}
                isExporting={isExporting}
                onBulkReindex={() => {
                    if (confirm('Запустить фоновое индексирование всех объектов без векторного поиска?')) {
                        bulkReindexMutation.mutate({ limit: 50, onlyMissing: true }, {
                            onSuccess: (data) => alert(`Обработано ${data.processed} объектов`)
                        })
                    }
                }}
                isBulkReindexPending={bulkReindexMutation.isPending}
            />

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
                    {view === 'list' && (
                        <ListViewSection
                            filteredLocations={filteredLocations}
                            viewMode={viewMode}
                            onEditLocation={handleEdit}
                            onDelete={handleDelete}
                            onApprove={handleApprove}
                            onReject={handleReject}
                            openActionMenuId={openActionMenuId}
                            onToggleActionMenu={(id) => setOpenActionMenuId(openActionMenuId === id ? null : id)}
                        />
                    )}
                    {view === 'moderation' && (
                        <ModerationQueueView
                            pendingLocations={pendingLocations}
                            onEdit={handleEdit}
                            onApprove={handleApprove}
                            onReject={handleReject}
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
