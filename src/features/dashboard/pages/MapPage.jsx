import React from 'react'
import MapTab from '../components/MapTab'

/**
 * MapPage — fullscreen map experience.
 *
 * The map uses fixed inset-0 so it fills the entire viewport.
 * UniversalHeader (z-100) and BottomNav (z-70) float on top of the map.
 * Map controls (locate-me button, place count) are positioned
 * to stay clear of both the header and the bottom nav.
 */
const MapPage = () => {
    return (
        <div className="fixed inset-0 z-0">
            <MapTab fullscreen />
        </div>
    )
}

export default MapPage
