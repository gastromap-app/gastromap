import React from 'react'
import { useNavigate } from 'react-router-dom'
import { MapPin } from 'lucide-react'
import { LazyImage } from '@/components/ui/LazyImage'
import { formatDistance } from '@/lib/geo.js'

/**
 * Compact nearby location card — photo, title, and distance.
 *
 * Used in: "Nearby Locations" horizontal scroll section on dashboard.
 */
export function LocationCardNearby({
    location,
    className = '',
    width = 'w-[160px]',
}) {
    const navigate = useNavigate()
    const image = location.image || location.image_url
    const distanceKm = location._dist ?? location.distance_km ?? location.distance

    return (
        <button
            onClick={() => navigate(`/location/${location.id}`)}
            className={`flex-shrink-0 ${width} group text-left surface transition-all duration-300 active:scale-[0.98] hover:surface-elevated hover:-translate-y-1 ${className}`}
        >
            {/* Image */}
            <div className="relative h-[120px] w-full overflow-hidden rounded-t-[20px]">
                <LazyImage
                    src={image}
                    alt={location.title}
                    className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                    wrapperClassName="w-full h-full"
                />

                {/* Distance badge */}
                {distanceKm != null && Number.isFinite(distanceKm) && (
                    <div className="absolute bottom-2.5 left-2.5 flex items-center gap-1 bg-black/40 backdrop-blur-md px-2 py-1 rounded-full border border-white/10 shadow-lg">
                        <MapPin size={10} className="text-blue-400" />
                        <span className="text-[10px] font-black text-white">
                            {formatDistance(distanceKm)}
                        </span>
                    </div>
                )}
            </div>

            {/* Content */}
            <div className="p-4">
                <h4 className="text-[0.9375rem] font-extrabold leading-tight truncate text-t-primary group-hover:text-blue-500 transition-colors tracking-tight">
                    {location.title}
                </h4>
                <p className="text-[0.6875rem] text-t-tertiary truncate mt-1.5 font-bold uppercase tracking-[0.14em]">
                    {location.city}
                </p>
            </div>
        </button>
    )
}
