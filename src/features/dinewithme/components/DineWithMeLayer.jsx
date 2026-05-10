/**
 * DineWithMeLayer — renders diner avatar markers on the Leaflet map.
 *
 * This component is rendered inside the MapContainer when Dine mode is active.
 * Diners are passed as a prop from MapTab (fetched via useAllDiners).
 */
import React from 'react'
import { Marker, Popup } from 'react-leaflet'
import { createDinerMarkerIcon } from './DinerAvatarMarker'
import { DinerCard } from './DinerCard'
import { useGeoStore } from '@/shared/store/useGeoStore'
import { useAuthStore } from '@/shared/store/useAuthStore'

export function DineWithMeLayer({ isActive, diners = [], onDeleteOwn }) {
    const { user } = useAuthStore()
    const { lat: userLat, lng: userLng } = useGeoStore()

    if (!isActive) return null

    const currentUserId = user?.id

    return (
        <>
            {diners.map((diner, index) => {
                const isOwn = diner.user_id === currentUserId
                return (
                    <Marker
                        key={diner.id || diner.user_id}
                        position={[Number(diner.lat), Number(diner.lng)]}
                        icon={createDinerMarkerIcon({
                            avatarUrl: diner.avatarUrl,
                            displayName: diner.displayName,
                            venueName: diner.venueName,
                            status: diner.status,
                            pingOffset: (index % 3) / 3,
                            isOwn,
                        })}
                    >
                        <Popup className="diner-popup" maxWidth={340} minWidth={300}>
                            <DinerCard
                                diner={diner}
                                userLat={userLat}
                                userLng={userLng}
                                isOwn={isOwn}
                                onDelete={isOwn ? onDeleteOwn : undefined}
                            />
                        </Popup>
                    </Marker>
                )
            })}
        </>
    )
}
