/**
 * DineWithMeLayer — renders diner avatar markers on the Leaflet map.
 *
 * This component is rendered inside the MapContainer when Dine mode is active.
 * It maps over nearby diners and creates Marker components with custom avatar icons.
 * Also renders the current user's own presence marker.
 */
import React from 'react'
import { Marker, Popup } from 'react-leaflet'
import { useNearbyDiners } from '../hooks/useNearbyDiners'
import { useDiningPresence } from '../hooks/useDiningPresence'
import { createDinerMarkerIcon } from './DinerAvatarMarker'
import { DinerCard } from './DinerCard'
import { useGeoStore } from '@/shared/store/useGeoStore'
import { useAuthStore } from '@/shared/store/useAuthStore'
import { formatDisplayName } from '../api/dinewithme.api'

export function DineWithMeLayer({ isActive }) {
    const { diners, isLoading } = useNearbyDiners(isActive)
    const { myPresence, isPresent } = useDiningPresence()
    const { user } = useAuthStore()
    const { lat: userLat, lng: userLng } = useGeoStore()

    if (!isActive) return null

    if (isLoading && diners.length === 0) {
        return null
    }

    // Build the current user's own marker data
    const ownMarker = isPresent && myPresence ? {
        id: 'own-presence',
        user_id: user?.id,
        lat: myPresence.lat,
        lng: myPresence.lng,
        status: myPresence.status,
        avatarUrl: user?.user_metadata?.avatar_url || null,
        displayName: formatDisplayName(user?.user_metadata?.full_name || user?.user_metadata?.name),
        venueName: '',  // filled by presence
        _distance: 0,
        message: myPresence.message,
        contact_info: myPresence.contact_info,
        party_size: myPresence.party_size,
        isOwn: true,
    } : null

    const allDiners = ownMarker ? [ownMarker, ...diners] : diners

    return (
        <>
            {allDiners.map((diner, index) => (
                <Marker
                    key={diner.id || diner.user_id}
                    position={[Number(diner.lat), Number(diner.lng)]}
                    icon={createDinerMarkerIcon({
                        avatarUrl: diner.avatarUrl,
                        displayName: diner.displayName,
                        venueName: diner.venueName,
                        status: diner.status,
                        pingOffset: (index % 3) / 3,
                        isOwn: diner.isOwn,
                    })}
                >
                    <Popup className="diner-popup" maxWidth={300} minWidth={280}>
                        <DinerCard
                            diner={diner}
                            userLat={userLat}
                            userLng={userLng}
                        />
                    </Popup>
                </Marker>
            ))}
        </>
    )
}
