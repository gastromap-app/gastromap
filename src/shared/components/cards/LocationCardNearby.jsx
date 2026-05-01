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
            className={`flex-shrink-0 ${width} text-left rounded-2xl overflow-hidden border transition-all duration-200 active:scale-[0.98] bg-white dark:bg-[hsl(220,20%,6%)] border-slate-200/50 dark:border-white/5 hover:shadow-md ${className}`}
        >
            {/* Image */}
            <div className="relative h-[110px] w-full overflow-hidden">
                <LazyImage
                    src={image}
                    alt={location.title}
                    className="w-full h-full object-cover"
                    wrapperClassName="w-full h-full"
                />

                {/* Distance badge */}
                {distanceKm != null && Number.isFinite(distanceKm) && (
                    <div className="absolute bottom-2 left-2 flex items-center gap-1 bg-black/60 backdrop-blur-md px-2 py-0.5 rounded-full">
                        <MapPin size={8} className="text-blue-400" />
                        <span className="text-[10px] font-bold text-white">
                            {formatDistance(distanceKm)}
                        </span>
                    </div>
                )}
            </div>

            {/* Content */}
            <div className="p-2.5">
                <h4 className="text-[13px] font-bold leading-tight truncate text-gray-900 dark:text-white">
                    {location.title}
                </h4>
                <p className="text-[11px] text-slate-500 dark:text-gray-600 truncate mt-0.5">
                    {location.city}
                </p>
            </div>
        </button>
    )
}
