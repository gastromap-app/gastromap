import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { motion } from 'framer-motion'
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import L from 'leaflet'
import { useTheme } from '@/hooks/useTheme'
import { Link, useSearchParams } from 'react-router-dom'
import { Star, LocateFixed, Navigation, Plus } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useGeoStore } from '@/shared/store/useGeoStore'
import { useLocationsInBounds } from '@/shared/api/queries/location.queries'
import { useLocationFilters } from '@/shared/filters/useLocationFilters'
import { useUIStore } from '@/shared/store/useUIStore'
import MarkerClusterGroup from 'react-leaflet-cluster'
import LocationImage from '@/components/ui/LocationImage'
import { DineModeToggle } from '@/features/dinewithme/components/DineModeToggle'
import { DineWithMeLayer } from '@/features/dinewithme/components/DineWithMeLayer'
import { CommunityGuidelinesModal } from '@/features/dinewithme/components/CommunityGuidelinesModal'
import { PresenceSetupSheet } from '@/features/dinewithme/components/PresenceSetupSheet'
import { useDiningPresence } from '@/features/dinewithme/hooks/useDiningPresence'
import { useAllDiners } from '@/features/dinewithme/hooks/useAllDiners'
import { useAuthStore } from '@/shared/store/useAuthStore'

// ─── Fix Leaflet default icon paths ──────────────────────────────────────
import icon from 'leaflet/dist/images/marker-icon.png'
import iconShadow from 'leaflet/dist/images/marker-shadow.png'
L.Marker.prototype.options.icon = L.icon({
    iconUrl: icon,
    shadowUrl: iconShadow,
    iconSize: [25, 41],
    iconAnchor: [12, 41],
})

// ─── Category → emoji + color ─────────────────────────────────────────────
const CATEGORY_CONFIG = {
    'Cafe':       { emoji: '☕', color: '#f97316' },
    'Restaurant': { emoji: '🍽️', color: '#3b82f6' },
    'Fine Dining':{ emoji: '🎩', color: '#8b5cf6' },
    'Bar':        { emoji: '🍸', color: '#ec4899' },
    'Bakery':     { emoji: '🥐', color: '#eab308' },
    'Fast Food':  { emoji: '🍔', color: '#ef4444' },
    default:      { emoji: '📍', color: '#6b7280' },
}

function getCategoryConfig(category) {
    return CATEGORY_CONFIG[category] ?? CATEGORY_CONFIG.default
}

// ─── Custom teardrop marker ───────────────────────────────────────────────
function makeMarkerIcon(loc) {
    const { emoji, color } = getCategoryConfig(loc.category)
    const effectiveRating = loc.google_rating ?? loc.rating
    const ratingBg = effectiveRating >= 4.7 ? '#2563eb' : '#374151'

    return L.divIcon({
        className: '',
        html: `
            <div style="
                position:relative;
                width:40px;height:40px;
                background:${color};
                border-radius:50% 50% 50% 0;
                transform:rotate(-45deg);
                box-shadow:0 4px 12px rgba(0,0,0,0.35);
                border:2.5px solid white;
            ">
                <div style="
                    position:absolute;inset:0;
                    display:flex;align-items:center;justify-content:center;
                    transform:rotate(45deg);
                    font-size:16px;
                ">${emoji}</div>
                ${effectiveRating ? `
                <div style="
                    position:absolute;bottom:-6px;right:-6px;
                    transform:rotate(45deg);
                    background:${ratingBg};color:white;
                    font-size:9px;font-weight:900;
                    padding:2px 4px;border-radius:6px;
                    border:1.5px solid white;
                ">★${effectiveRating}</div>` : ''}
            </div>`,
        iconSize: [40, 40],
        iconAnchor: [20, 40],
    })
}

// ─── Map Bounds Tracker ──────────────────────────────────────────────────
// Emits the initial viewport bounds IMMEDIATELY on mount (no 600 ms wait
// for the first fetch — fixes the cold-start delay), then debounces
// subsequent `moveend` events by 600 ms (R8.2, R13.7). Filter changes
// trigger immediate refetch via queryKey change in the parent (R8.3).
function MapBoundsTracker({ onBoundsChange }) {
    const map = useMap()
    const lastUpdateRef = useRef(0)
    const timerRef = useRef(null)

    // Emit initial bounds on mount so the first fetch starts without
    // waiting for the user to pan/zoom (cold-start fix).
    useEffect(() => {
        const b = map.getBounds()
        if (b) {
            const initialBounds = {
                sw: { lat: b.getSouthWest().lat, lng: b.getSouthWest().lng },
                ne: { lat: b.getNorthEast().lat, lng: b.getNorthEast().lng },
            }
            lastUpdateRef.current = Date.now()
            onBoundsChange(initialBounds)
        }
    }, [map, onBoundsChange])

    useEffect(() => {
        const handleMoveEnd = () => {
            const b = map.getBounds()
            const bounds = {
                sw: { lat: b.getSouthWest().lat, lng: b.getSouthWest().lng },
                ne: { lat: b.getNorthEast().lat, lng: b.getNorthEast().lng },
            }

            // 600ms debounce on viewport changes (R8.2, R13.7)
            clearTimeout(timerRef.current)
            const now = Date.now()
            const elapsed = now - lastUpdateRef.current
            if (elapsed >= 600) {
                lastUpdateRef.current = now
                onBoundsChange(bounds)
            } else {
                timerRef.current = setTimeout(() => {
                    lastUpdateRef.current = Date.now()
                    onBoundsChange(bounds)
                }, 600 - elapsed)
            }
        }

        map.on('moveend', handleMoveEnd)
        return () => {
            map.off('moveend', handleMoveEnd)
            clearTimeout(timerRef.current)
        }
    }, [map, onBoundsChange])

    return null
}

// ─── Locate Me Control ───────────────────────────────────────────────────
function LocateMeButton() {
    const map = useMap()
    const updateUserLocation = useGeoStore(state => state.updateUserLocation)
    const [isLocating, setIsLocating] = React.useState(false)
    const { t } = useTranslation()

    const handleLocate = async (e) => {
        e.preventDefault()
        e.stopPropagation()
        
        setIsLocating(true)
        try {
            const loc = await updateUserLocation()
            map.flyTo([loc.lat, loc.lng], 15, {
                animate: true,
                duration: 1.5
            })
        } catch (error) {
            console.error('[MapTab] Geolocation error:', error)
        } finally {
            setIsLocating(false)
        }
    }

    return (
        <div 
            className="absolute bottom-28 right-4 z-[1000] md:bottom-8 md:right-6 pointer-events-auto"
        >
            <button
                onClick={handleLocate}
                disabled={isLocating}
                className={`
                    flex items-center justify-center
                    w-12 h-12 rounded-2xl
                    bg-white/90 dark:bg-gray-900/90 backdrop-blur-xl
                    border border-white/20 dark:border-gray-800
                    shadow-[0_8px_32px_rgba(0,0,0,0.15)]
                    text-gray-800 dark:text-white
                    hover:scale-110 active:scale-90
                    transition-all duration-300
                    group
                    ${isLocating ? 'opacity-80 cursor-wait' : 'opacity-100 cursor-pointer'}
                `}
                title={t('map.locate_me')}
            >
                <LocateFixed 
                    className={`w-6 h-6 transition-all duration-500 
                        ${isLocating ? 'animate-spin text-blue-500' : 'group-hover:rotate-[15deg] group-hover:scale-110'}
                    `} 
                />
            </button>
        </div>
    )
}

// ─── Custom Cluster Icon ────────────────────────────────────────────────
const createClusterCustomIcon = (cluster) => {
    return L.divIcon({
        html: `
            <div class="flex items-center justify-center w-10 h-10 rounded-full bg-blue-600 text-white font-black text-xs shadow-xl ring-2 ring-white/30 backdrop-blur-md transition-transform active:scale-95">
                ${cluster.getChildCount()}
            </div>
        `,
        className: 'custom-marker-cluster',
        iconSize: L.point(40, 40, true),
    })
}

// ─── Fly to focus location (triggered by search dropdown select) ────────
function FlyToFocus({ focus }) {
    const map = useMap()
    useEffect(() => {
        if (!focus || typeof focus.lat !== 'number' || typeof focus.lng !== 'number') return
        map.flyTo([focus.lat, focus.lng], Math.max(map.getZoom(), 16), {
            animate: true,
            duration: 1.2,
        })
        // After fly animation completes, find and open the marker popup
        const openPopupTimer = setTimeout(() => {
            map.eachLayer(layer => {
                if (layer.getLatLng && layer.openPopup) {
                    const pos = layer.getLatLng()
                    if (Math.abs(pos.lat - focus.lat) < 0.0001 && Math.abs(pos.lng - focus.lng) < 0.0001) {
                        layer.openPopup()
                    }
                }
            })
        }, 1400) // slightly after flyTo duration (1.2s)
        return () => clearTimeout(openPopupTimer)
    }, [focus, map])
    return null
}

function MapPoseMemory() {
    const map = useMap()
    const lastMapPose = useUIStore(s => s.lastMapPose)
    const setLastMapPose = useUIStore(s => s.setLastMapPose)

    // Restore on mount (if we have a remembered pose)
    useEffect(() => {
        if (lastMapPose) {
            map.setView([lastMapPose.lat, lastMapPose.lng], lastMapPose.zoom, { animate: false })
        }
    }, [map]) // eslint-disable-line react-hooks/exhaustive-deps

    // Keep track of latest view — stable handler, no useMapEvents
    useEffect(() => {
        const handleMoveEnd = () => {
            const c = map.getCenter()
            setLastMapPose({ lat: c.lat, lng: c.lng, zoom: map.getZoom() })
        }
        map.on('moveend', handleMoveEnd)
        return () => map.off('moveend', handleMoveEnd)
    }, [map, setLastMapPose])

    return null
}

const MapTab = ({ activeFilter, focusLocation, onDineModeChange }) => {
    const userLocation = useGeoStore(state => state.userLocation)
    const { theme } = useTheme()
    const { t } = useTranslation()
    const [searchParams] = useSearchParams()
    const { user } = useAuthStore()

    // ── React Query: bounds-based marker fetching ──────────────────────
    const { asAPIFilters } = useLocationFilters()
    const apiFilters = useMemo(() => asAPIFilters(), [asAPIFilters])

    // Debounced bounds state — updated by MapBoundsTracker child (R8.2, R13.7)
    const [bounds, setBounds] = useState(null)
    const handleBoundsChange = useCallback((newBounds) => {
        setBounds(newBounds)
    }, [])

    // React Query hook — fetches markers for the current viewport + filters.
    // Filter changes (apiFilters) trigger immediate refetch via queryKey change
    // without the 600ms debounce (R8.3).
    const markersQuery = useLocationsInBounds(bounds, apiFilters)
    const { data: markersResult, isPending, isFetching } = markersQuery

    // ── Sticky-locations fallback (R14.1: stale-while-revalidate, no flicker) ──
    // While a new bounds query is in flight (pan/zoom triggered new queryKey),
    // keep the previous markers visible so they don't blink off-screen. When
    // the new result arrives we adopt it — including legitimate empty arrays.
    const lastLocationsRef = useRef([])
    const locations = useMemo(() => {
        const next = markersResult?.data ?? markersResult ?? null
        // We have a fresh result (success or empty) — adopt it as the new truth.
        if (Array.isArray(next)) {
            lastLocationsRef.current = next
            return next
        }
        // Otherwise the query is still in flight (no data yet) — keep showing
        // last known good list to avoid flicker. Only happens during the
        // first fetch or rapid pan/zoom.
        if (isPending || isFetching) {
            return lastLocationsRef.current
        }
        return []
    }, [markersResult, isPending, isFetching])

    // ── Dine With Me: only admin/moderator ─────────────────────────────
    const dineAllowed = user?.role === 'admin' || user?.role === 'moderator'

    // ── Dine With Me state ────────────────────────────────────────────
    const [dineModeActive, setDineModeActive] = useState(false)
    const [showGuidelines, setShowGuidelines] = useState(false)
    const [showSetup, setShowSetup] = useState(false)
    const { isPresent, goInvisible, isGoingInvisible, myPresence } = useDiningPresence()
    const { diners } = useAllDiners(dineModeActive)

    // Check if user has acknowledged guidelines before
    const GUIDELINES_KEY = 'gastromap_dine_guidelines_accepted'
    const hasAcceptedGuidelines = localStorage.getItem(GUIDELINES_KEY) === 'true'

    // Notify parent when dine mode changes
    useEffect(() => {
        onDineModeChange?.(dineModeActive)
    }, [dineModeActive, onDineModeChange])

    const handleDineToggle = useCallback(() => {
        if (dineModeActive) {
            // Exit dine mode
            setDineModeActive(false)
            goInvisible()
            return
        }

        // Enter dine mode — check guidelines first
        if (!hasAcceptedGuidelines) {
            setShowGuidelines(true)
        } else {
            setDineModeActive(true)
        }
    }, [dineModeActive, goInvisible, hasAcceptedGuidelines])

    // Auto-activate dine mode via URL param ?dine=true (only for allowed roles)
    useEffect(() => {
        if (dineAllowed && searchParams.get('dine') === 'true' && !dineModeActive) {
            handleDineToggle()
        }
    }, []) // eslint-disable-line react-hooks/exhaustive-deps

    const handleGuidelinesAccept = useCallback(() => {
        localStorage.setItem(GUIDELINES_KEY, 'true')
        setShowGuidelines(false)
        setDineModeActive(true)
    }, [])

    const handleCreateMeetup = useCallback(() => {
        setShowSetup(true)
    }, [])

    // Auto-activate dine mode when presence is set
    useEffect(() => {
        if (isPresent && !dineModeActive) {
            setDineModeActive(true)
        }
    }, [isPresent]) // eslint-disable-line react-hooks/exhaustive-deps

    // Apply category filter if active
    const visibleLocations = activeFilter && activeFilter !== 'All'
        ? locations.filter(loc =>
            loc.category?.toLowerCase() === activeFilter.toLowerCase()
        )
        : locations

    const mapCenter = userLocation ? [userLocation.lat, userLocation.lng]
        : useGeoStore.getState().lat && useGeoStore.getState().lng
            ? [useGeoStore.getState().lat, useGeoStore.getState().lng]
            : [52.2297, 21.0122] // Warsaw fallback

    return (
        <div className="w-full h-full overflow-hidden relative z-0">
            <MapContainer
                center={mapCenter}
                zoom={13}
                scrollWheelZoom
                zoomControl={false}
                attributionControl={false}
                style={{ height: '100%', width: '100%' }}
            >
                <TileLayer
                    url={theme === 'dark' 
                        ? 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
                        : 'https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}'
                    }
                    attribution={theme === 'dark'
                        ? '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
                        : '&copy; Google Maps'
                    }
                />

                <MapBoundsTracker onBoundsChange={handleBoundsChange} />
                <MapPoseMemory />
                <LocateMeButton />
                <FlyToFocus focus={focusLocation} />

                {/* Dine With Me toggle — admin/moderator only */}
                {dineAllowed && (
                    <DineModeToggle
                        isActive={dineModeActive}
                        isLoading={isGoingInvisible}
                        onToggle={handleDineToggle}
                        dinerCount={diners.length}
                    />
                )}

                {/* User location dot */}
                {userLocation && (
                    <Marker 
                        position={[userLocation.lat, userLocation.lng]}
                        icon={L.divIcon({
                            className: '',
                            html: `<div style="width:20px;height:20px;background:#3b82f6;border:3px solid white;border-radius:50%;box-shadow:0 0 15px rgba(59,130,246,0.6)"></div>`,
                            iconSize: [20, 20],
                            iconAnchor: [10, 10]
                        })}
                    />
                )}

                {/* Dine With Me layer OR location markers */}
                {dineAllowed && dineModeActive ? (
                    <DineWithMeLayer isActive={dineModeActive} diners={diners} onDeleteOwn={goInvisible} />
                ) : (
                    <MarkerClusterGroup
                        chunkedLoading
                        maxClusterRadius={60}
                        iconCreateFunction={createClusterCustomIcon}
                    >
                        {visibleLocations.map(loc => (
                            <Marker 
                                key={loc.id}
                                position={[loc.lat, loc.lng]}
                                icon={makeMarkerIcon(loc)}
                            >
                                <Popup className="custom-popup">
                                    <div className="flex flex-col w-full group">
                                        {/* Image Section */}
                                        <div className="relative w-full h-32 overflow-hidden bg-slate-100 dark:bg-slate-800">
                                            <LocationImage 
                                                src={loc.image_url} 
                                                alt={loc.name || loc.title}
                                                width={400}
                                                wrapperClassName="h-full"
                                            />
                                            
                                            {/* Top Badges Overlay */}
                                            <div className="absolute top-2 inset-x-2 flex justify-between items-start pointer-events-none">
                                                <span className="flex items-center gap-1 px-2 py-1 bg-black/60 backdrop-blur-md rounded-full border border-white/20 text-[10px] font-bold text-white">
                                                    {getCategoryConfig(loc.category).emoji} {loc.category}
                                                </span>
                                                
                                                {(loc.google_rating || loc.rating) && (
                                                    <div className="flex items-center gap-1 px-2 py-1 bg-white/90 dark:bg-[#1c1c1e]/90 backdrop-blur-md rounded-full border border-black/5 dark:border-white/10 shadow-sm">
                                                        <Star className="w-2.5 h-2.5 text-amber-500 fill-amber-500" />
                                                        <span className="text-[10px] font-black text-slate-900 dark:text-white">
                                                            {loc.google_rating || loc.rating}
                                                        </span>
                                                    </div>
                                                )}
                                            </div>
                                        </div>

                                        {/* Content Section */}
                                        <div className="p-3">
                                            <h3 className="text-sm font-bold text-slate-900 dark:text-white truncate mb-0.5 leading-tight">
                                                {loc.name || loc.title}
                                            </h3>
                                            <p className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-1 mb-3">
                                                {loc.address}
                                            </p>

                                            <Link 
                                                to={`/location/${loc.id}`}
                                                style={{ color: '#ffffff' }}
                                                className="flex items-center justify-center gap-2 w-full py-2.5 bg-blue-600 hover:bg-blue-700 active:scale-[0.98] !text-white no-underline rounded-xl text-xs font-bold transition-all shadow-lg shadow-blue-600/20"
                                            >
                                                <Navigation size={12} color="#ffffff" />
                                                <span style={{ color: '#ffffff' }}>{t('common.viewDetails', 'View Details')}</span>
                                            </Link>
                                        </div>
                                    </div>
                                </Popup>
                            </Marker>
                        ))}
                    </MarkerClusterGroup>
                )}
            </MapContainer>

            {/* Dine With Me overlays (outside MapContainer, fixed position) — admin/moderator only */}
            {dineAllowed && (
                <>
                    <CommunityGuidelinesModal
                        isOpen={showGuidelines}
                        onAccept={handleGuidelinesAccept}
                        onClose={() => setShowGuidelines(false)}
                    />
                    <PresenceSetupSheet
                        isOpen={showSetup}
                        onClose={() => setShowSetup(false)}
                        existingPresence={myPresence}
                        onDelete={goInvisible}
                    />
                </>
            )}

            {/* Create Meetup button — visible when in dine browse mode */}
            {dineAllowed && dineModeActive && (
                <div className="absolute bottom-32 left-4 z-[1000] md:bottom-20 md:left-6 pointer-events-auto">
                    <motion.button
                        onClick={handleCreateMeetup}
                        whileTap={{ scale: 0.9 }}
                        className={`
                            flex items-center gap-2 px-4 py-3 rounded-2xl
                            backdrop-blur-xl border shadow-lg
                            text-xs font-bold transition-all
                            ${theme === 'dark'
                                ? 'bg-emerald-500/90 border-emerald-400/40 text-white shadow-emerald-500/30'
                                : 'bg-emerald-500 border-emerald-400 text-white shadow-emerald-500/30'
                            }
                        `}
                    >
                        <Plus size={16} />
                        {t('dine.create_meetup', 'Create Meetup')}
                    </motion.button>
                </div>
            )}
        </div>
    )
}

export default MapTab
