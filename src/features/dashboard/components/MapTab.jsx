import React, { useEffect, useMemo } from 'react'
import { Navigation as NavIcon } from 'lucide-react'
import { MapContainer, TileLayer, Marker, Popup, useMap, useMapEvents } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import L from 'leaflet'
import { useTheme } from '@/hooks/useTheme'
import { Link } from 'react-router-dom'
import { Star } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useLocationsStore } from '@/shared/store/useLocationsStore'

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

// ─── Custom teardrop marker with rating badge ─────────────────────────────
function makeMarkerIcon(loc, highlighted = false) {
    const { emoji, color } = getCategoryConfig(loc.category)
    const size = highlighted ? 48 : 40
    const effectiveRating = loc.google_rating ?? loc.rating
    const ratingBg = effectiveRating >= 4.7 ? '#2563eb' : '#374151'

    return L.divIcon({
        className: '',
        html: `
            <div style="
                position:relative;
                width:${size}px;height:${size}px;
                background:${color};
                border-radius:50% 50% 50% 0;
                transform:rotate(-45deg);
                box-shadow:0 4px 12px rgba(0,0,0,0.35);
                border:2.5px solid white;
                cursor:pointer;
                ${highlighted ? 'outline:3px solid white;outline-offset:2px;' : ''}
            ">
                <div style="
                    position:absolute;inset:0;
                    display:flex;align-items:center;justify-content:center;
                    transform:rotate(45deg);
                    font-size:${highlighted ? 18 : 16}px;line-height:1;
                ">${emoji}</div>
                ${effectiveRating ? `
                <div style="
                    position:absolute;bottom:-6px;right:-6px;
                    transform:rotate(45deg);
                    background:${ratingBg};color:white;
                    font-size:9px;font-weight:900;
                    padding:2px 4px;border-radius:6px;
                    border:1.5px solid white;
                    box-shadow:0 2px 6px rgba(0,0,0,0.3);
                    white-space:nowrap;
                ">★${effectiveRating}</div>` : ''}
            </div>`,
        iconSize: [size, size],
        iconAnchor: [size / 4, size],
        popupAnchor: [size / 2 - 4, -size],
    })
}

// ─── Cluster bubble ───────────────────────────────────────────────────────
function makeClusterIcon(count) {
    const size = count > 9 ? 44 : 38
    return L.divIcon({
        className: '',
        html: `<div style="
            width:${size}px;height:${size}px;
            background:rgba(37,99,235,0.90);
            border:3px solid white;border-radius:50%;
            display:flex;align-items:center;justify-content:center;
            color:white;font-size:13px;font-weight:900;
            box-shadow:0 4px 14px rgba(37,99,235,0.45);
        ">${count}</div>`,
        iconSize: [size, size],
        iconAnchor: [size / 2, size / 2],
    })
}

// ─── Grid-based clustering ────────────────────────────────────────────────
function clusterLocations(locations, zoom) {
    if (zoom >= 15 || locations.length <= 3) {
        return locations.map((loc) => ({ locations: [loc], center: loc.coordinates }))
    }
    const gridSize = zoom >= 13 ? 0.005 : zoom >= 11 ? 0.015 : 0.04
    const grid = new Map()
    locations.forEach((loc) => {
        if (!loc.coordinates) return
        const key = `${Math.floor(loc.coordinates.lng / gridSize)}:${Math.floor(loc.coordinates.lat / gridSize)}`
        if (!grid.has(key)) grid.set(key, [])
        grid.get(key).push(loc)
    })
    return Array.from(grid.values()).map((group) => ({
        locations: group,
        center: {
            lat: group.reduce((s, l) => s + l.coordinates.lat, 0) / group.length,
            lng: group.reduce((s, l) => s + l.coordinates.lng, 0) / group.length,
        },
    }))
}

// ─── Auto-center map whenever location set changes ────────────────────────
function MapAutoCenter({ locations }) {
    const map = useMap()
    useEffect(() => {
        const valid = locations.filter(l => l.coordinates?.lat && l.coordinates?.lng)
        if (!valid.length) return
        const lat = valid.reduce((s, l) => s + l.coordinates.lat, 0) / valid.length
        const lng = valid.reduce((s, l) => s + l.coordinates.lng, 0) / valid.length
        map.setView([lat, lng], map.getZoom(), { animate: true, duration: 0.8 })
    }, [map, locations])
    return null
}

// ─── Map helpers ──────────────────────────────────────────────────────────
const MapUpdater = ({ theme }) => {
    const map = useMap()
    useEffect(() => { setTimeout(() => map.invalidateSize(), 300) }, [map, theme])
    return null
}

const LocationController = ({ userPos, trigger }) => {
    const map = useMap()
    useEffect(() => {
        if (userPos && trigger > 0) map.flyTo(userPos, 15, { duration: 1.5 })
    }, [map, userPos, trigger])
    return null
}

const ZoomTracker = ({ onZoomChange }) => {
    useMapEvents({ zoomend: (e) => onZoomChange(e.target.getZoom()) })
    return null
}

// ─── Popup card ───────────────────────────────────────────────────────────
function PopupCard({ loc }) {
    return (
        <div className="w-48 overflow-hidden rounded-2xl" style={{ fontFamily: 'inherit' }}>
            <div className="h-28 relative overflow-hidden">
                <img src={loc.image} alt={loc.title} className="w-full h-full object-cover" loading="lazy" />
                <div className="absolute top-2 right-2 bg-white/90 backdrop-blur px-1.5 py-0.5 rounded-full text-[10px] font-black flex items-center gap-0.5 shadow">
                    <Star size={8} className="text-blue-600 fill-blue-600" /> {loc.rating}
                </div>
                <div className="absolute bottom-0 inset-x-0 h-10 bg-gradient-to-t from-black/60 to-transparent" />
            </div>
            <div className="p-3">
                <h3 className="font-black text-gray-900 text-sm leading-tight truncate">{loc.title}</h3>
                <div className="flex items-center justify-between mt-1 mb-2.5">
                    <span className="text-[10px] text-gray-500 font-semibold">{loc.category}</span>
                    <span className="text-[10px] font-bold text-gray-600">{loc.price_level || loc.priceLevel}</span>
                </div>
                <Link
                    to={`/location/${loc.id}`}
                    className="block text-center text-[11px] font-black uppercase tracking-widest bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-xl transition-colors"
                >
                    View details →
                </Link>
            </div>
        </div>
    )
}

// ─── Main component ───────────────────────────────────────────────────────
const MapTab = ({ activeFilter = 'All' }) => {
    const { t } = useTranslation()
    const { theme } = useTheme()
    const { filteredLocations: storeFiltered } = useLocationsStore()
    const [userPos, setUserPos] = React.useState(null)
    const [locateTrigger, setLocateTrigger] = React.useState(0)
    const [_locating, setLocating] = React.useState(false)
    const [geoState, setGeoState] = React.useState('idle') // 'idle'|'locating'|'success'|'denied'|'unavailable'
    const [zoom, setZoom] = React.useState(14)
    const [selectedId, setSelectedId] = React.useState(null)

    // On mount: только проверяем статус разрешения (без запроса!)
    // Если уже granted — тихо берём позицию без диалога
    useEffect(() => {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        if (!navigator.geolocation) { setGeoState('unavailable'); return }
        if (navigator.permissions) {
            navigator.permissions.query({ name: 'geolocation' }).then((result) => {
                if (result.state === 'granted') {
                    // Уже разрешено — можно тихо взять позицию
                    navigator.geolocation.getCurrentPosition(
                        (pos) => {
                            setUserPos([pos.coords.latitude, pos.coords.longitude])
                            setGeoState('success')
                        },
                        () => setGeoState('idle'),
                        { enableHighAccuracy: false, timeout: 5000, maximumAge: 60000 }
                    )
                } else if (result.state === 'denied') {
                    setGeoState('denied')
                }
                // 'prompt' — ничего не делаем, ждём кнопку
            }).catch(() => {}) // Safari не поддерживает permissions API — ок
        }
    }, [])

    const handleLocateMe = () => {
        if (!navigator.geolocation) { setGeoState('unavailable'); return }
        setGeoState('locating')
        setLocating(true)
        navigator.geolocation.getCurrentPosition(
            (pos) => {
                const coords = [pos.coords.latitude, pos.coords.longitude]
                setUserPos(coords)
                setLocateTrigger((n) => n + 1)
                setLocating(false)
                setGeoState('success')
            },
            (err) => {
                setLocating(false)
                if (err.code === err.PERMISSION_DENIED) {
                    setGeoState('denied')
                } else {
                    setGeoState('idle')
                }
            },
            { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 }
        )
    }

    const displayLocations = useMemo(() => {
        // Filter by category first
        const byCategory = activeFilter === 'All'
            ? storeFiltered
            : storeFiltered.filter((loc) => loc.category === activeFilter)
        // Strip locations with no real coordinates (DB normaliser defaults missing lat/lng to 0)
        return byCategory.filter(l => l.coordinates?.lat && l.coordinates?.lng)
    }, [storeFiltered, activeFilter])

    // Compute initial center from locations (fallback: central Europe)
    const initialCenter = useMemo(() => {
        const valid = displayLocations
        if (!valid.length) return [51.505, 19.0]
        return [
            valid.reduce((s, l) => s + l.coordinates.lat, 0) / valid.length,
            valid.reduce((s, l) => s + l.coordinates.lng, 0) / valid.length,
        ]
    }, []) // eslint-disable-line react-hooks/exhaustive-deps

    const clusters = useMemo(
        () => clusterLocations(displayLocations, zoom),
        [displayLocations, zoom]
    )

    const lightTiles = 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png'
    const darkTiles  = 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'

    const userIcon = L.divIcon({
        className: '',
        html: `<div style="position:relative;width:20px;height:20px;">
                 <div style="position:absolute;inset:0;background:#3b82f6;border-radius:50%;animation:ping 1s cubic-bezier(0,0,0.2,1) infinite;opacity:0.6;"></div>
                 <div style="position:absolute;inset:2px;background:#2563eb;border-radius:50%;border:2px solid white;box-shadow:0 2px 8px rgba(37,99,235,0.6);"></div>
               </div>`,
        iconSize: [20, 20],
        iconAnchor: [10, 10],
    })

    return (
        <div className="w-full h-full overflow-hidden relative z-0">
            {/* Locate Me */}
            {/* Locate Me — bottom-right, above nav bar */}
            {/* Locate Me button */}
            <button
                onClick={handleLocateMe}
                aria-label={geoState === 'denied' ? 'Location access denied — tap to retry' : 'Locate me'}
                disabled={geoState === 'locating'}
                className={`
                    absolute z-[500] p-3 rounded-full shadow-lg
                    backdrop-blur-md border transition-all active:scale-95
                    right-4 disabled:opacity-60
                    ${geoState === 'denied'
                        ? 'bg-red-500/20 border-red-400/40 text-red-400'
                        : geoState === 'success'
                            ? (theme === 'dark' ? 'bg-blue-600/80 border-blue-400/40 text-white' : 'bg-blue-600 border-blue-400 text-white')
                            : (theme === 'dark'
                                ? 'bg-black/60 border-white/20 text-white hover:bg-black/80'
                                : 'bg-white/95 border-white/60 text-blue-600 hover:bg-white')}
                `}
                style={{ bottom: 'calc(env(safe-area-inset-bottom) + 88px)' }}
            >
                {geoState === 'locating' ? (
                    <div className="w-5 h-5 rounded-full border-2 border-blue-400 border-t-transparent animate-spin" />
                ) : geoState === 'denied' ? (
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
                    </svg>
                ) : (
                    <NavIcon
                        size={20}
                        className={`transition-all ${geoState === 'success' ? 'fill-white' : ''}`}
                    />
                )}
            </button>
            {/* Denied tooltip */}
            {geoState === 'denied' && (
                <div
                    className="absolute z-[499] right-16 bg-red-500/90 backdrop-blur-md text-white text-xs font-bold px-3 py-2 rounded-xl shadow-lg pointer-events-none"
                    style={{ bottom: 'calc(env(safe-area-inset-bottom) + 94px)', maxWidth: '180px' }}
                >
                    Location blocked. Allow in browser settings.
                </div>
            )}

            {/* Location count — bottom-left above nav */}
            <div
                className={`
                    absolute left-4 z-[500]
                    px-3 py-1.5 rounded-full text-xs font-black shadow-lg backdrop-blur-md border
                    ${theme === 'dark'
                        ? 'bg-black/60 border-white/20 text-white/70'
                        : 'bg-white/90 border-white/60 text-gray-700'}
                `}
                style={{ bottom: 'calc(env(safe-area-inset-bottom) + 88px)' }}
            >
                {displayLocations.length} place{displayLocations.length !== 1 ? 's' : ''}
            </div>

            <MapContainer
                center={initialCenter}
                zoom={13}
                scrollWheelZoom
                zoomControl={false}
                style={{ height: '100%', width: '100%' }}
            >
                <TileLayer
                    attribution='&copy; <a href="https://carto.com/">CARTO</a>'
                    url={theme === 'dark' ? darkTiles : lightTiles}
                />
                <MapUpdater theme={theme} />
                <LocationController userPos={userPos} trigger={locateTrigger} />
                <ZoomTracker onZoomChange={setZoom} />
                <MapAutoCenter locations={displayLocations} />

                {userPos && (
                    <Marker position={userPos} icon={userIcon}>
                        <Popup closeButton={false}>
                            <div className="px-2 py-1 text-xs font-bold text-center text-gray-700">📍 {t('map.you_are_here')}</div>
                        </Popup>
                    </Marker>
                )}

                {clusters.map((cluster, i) => {
                    const pos = [cluster.center.lat, cluster.center.lng]
                    if (cluster.locations.length > 1) {
                        return (
                            <Marker key={`cl-${i}`} position={pos} icon={makeClusterIcon(cluster.locations.length)}>
                                <Popup closeButton={false}>
                                    <div className="p-2 space-y-1 max-h-48 overflow-y-auto w-40">
                                        {cluster.locations.map((loc) => (
                                            <Link key={loc.id} to={`/location/${loc.id}`}
                                                className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-gray-50 transition-colors">
                                                <span className="text-lg">{getCategoryConfig(loc.category).emoji}</span>
                                                <div className="min-w-0">
                                                    <p className="text-xs font-bold text-gray-900 truncate">{loc.title}</p>
                                                    <p className="text-[10px] text-gray-500 dark:text-gray-400">★ {loc.rating}</p>
                                                </div>
                                            </Link>
                                        ))}
                                    </div>
                                </Popup>
                            </Marker>
                        )
                    }
                    const loc = cluster.locations[0]
                    if (!loc.coordinates) return null
                    return (
                        <Marker
                            key={loc.id}
                            position={pos}
                            icon={makeMarkerIcon(loc, selectedId === loc.id)}
                            eventHandlers={{ click: () => setSelectedId(loc.id) }}
                        >
                            <Popup
                                closeButton={false}
                                eventHandlers={{ remove: () => setSelectedId(null) }}
                            >
                                <PopupCard loc={loc} />
                            </Popup>
                        </Marker>
                    )
                })}
            </MapContainer>
        </div>
    )
}

export default MapTab
