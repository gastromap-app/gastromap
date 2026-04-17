import React from 'react'
import MapTab from '../components/MapTab'

const MapPage = () => {
    return (
        <div className="h-[100dvh] w-full relative z-0 flex flex-col">
            <div
                className="flex-1 absolute inset-0 pt-24"
                style={{ paddingBottom: 'calc(6rem + env(safe-area-inset-bottom))' }}
            >
                <MapTab />
            </div>
        </div>
    )
}

export default MapPage
