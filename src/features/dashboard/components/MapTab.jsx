import React from 'react'
import { MapContainer, TileLayer, Marker, Popup, useMap, useMapEvents } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import L from 'leaflet'
import { useTheme } from '@/hooks/useTheme'
import { Link } from 'react-router-dom'
import { Star } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useLocationsStore } from '@/shared/store/useLocationsStore'
import MarkerClusterGroup from 'react-leaflet-cluster'

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

const MapTab = () => {
    const locations = useLocationsStore(state => state.filteredLocations)
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
                >
                    {locations.map(loc => (
                        <Marker 
                            key={loc.id}
                            position={[loc.lat, loc.lng]}
                            icon={makeMarkerIcon(loc)}
                        >
                            <Popup className="custom-popup">
                                <div className="p-1 min-w-[200px]">
                                    <div className="flex justify-between items-start mb-2">
                                        <span className="text-xs font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 px-2 py-0.5 rounded-full">
                                            {getCategoryConfig(loc.category).emoji} {loc.category}
                                        </span>
                                        {(loc.google_rating || loc.rating) && (
                                            <div className="flex items-center gap-1 text-xs font-black text-amber-500 bg-amber-50 dark:bg-amber-900/20 px-2 py-0.5 rounded-full">
                                                <Star className="w-3 h-3 fill-current" />
                                                {loc.google_rating || loc.rating}
                                            </div>
                                        )}
                                    </div>
                                    <h3 className="font-bold text-sm text-gray-900 dark:text-white mb-1">{loc.name || loc.title}</h3>
                                    <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-2 mb-3">{loc.address}</p>
                                    <Link 
                                        to={`/location/${loc.id}`}
                                        className="block w-full text-center py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition-colors"
                                    >
                                        {t('common.viewDetails')}
                                    </Link>
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
