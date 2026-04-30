import React from 'react'
import { MapContainer, TileLayer, Marker, Popup, useMap, useMapEvents } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import L from 'leaflet'
import { useTheme } from '@/hooks/useTheme'
import { Link } from 'react-router-dom'
import { Star, LocateFixed, Navigation } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useLocationsStore } from '@/shared/store/useLocationsStore'
import MarkerClusterGroup from 'react-leaflet-cluster'
import LocationImage from '@/components/ui/LocationImage'

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

// ─── Map Events Handler ──────────────────────────────────────────────────
function MapBoundsHandler() {
    const map = useMap()
    const fetchInBounds = useLocationsStore(state => state.fetchInBounds)
    const setBounds = useLocationsStore(state => state.setBounds)

    useMapEvents({
        moveend: () => {
            const b = map.getBounds()
            const bounds = {
                sw: { lat: b.getSouthWest().lat, lng: b.getSouthWest().lng },
                ne: { lat: b.getNorthEast().lat, lng: b.getNorthEast().lng }
            }
            setBounds(bounds)
            fetchInBounds(bounds)
        }
    })

    return null
}

// ─── Locate Me Control ───────────────────────────────────────────────────
function LocateMeButton() {
    const map = useMap()
    const { updateUserLocation } = useLocationsStore()
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

const MapTab = () => {
    const locations = useLocationsStore(state => state.mapMarkers)
    const { userLocation } = useLocationsStore()
    const { theme } = useTheme()
    const { t } = useTranslation()

    const mapCenter = userLocation ? [userLocation.lat, userLocation.lng] : [41.0082, 28.9784]

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
                        : 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png'
                    }
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
                />

                <MapBoundsHandler />
                <LocateMeButton />

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

                <MarkerClusterGroup
                    chunkedLoading
                    maxClusterRadius={60}
                    iconCreateFunction={createClusterCustomIcon}
                >
                    {locations.map(loc => (
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
                                            className="flex items-center justify-center gap-2 w-full py-2.5 bg-blue-600 hover:bg-blue-700 active:scale-[0.98] text-white rounded-xl text-xs font-bold transition-all shadow-lg shadow-blue-600/20"
                                        >
                                            <Navigation size={12} />
                                            {t('common.viewDetails', 'View Details')}
                                        </Link>
                                    </div>
                                </div>
                            </Popup>
                        </Marker>
                    ))}
                </MarkerClusterGroup>
            </MapContainer>
        </div>
    )
}

export default MapTab
