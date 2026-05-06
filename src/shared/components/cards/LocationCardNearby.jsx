import React from 'react'
import { useNavigate } from 'react-router-dom'
import { MapPin } from 'lucide-react'
import { motion } from 'framer-motion'
import { LazyImage } from '@/components/ui/LazyImage'
import { formatDistance } from '@/lib/geo.js'
import {
    CutoutCard,
    CutoutCardMedia,
    CutoutCardOverlay,
    CutoutCardPin,
    CutoutCorner,
    CutoutCardContent,
    useCutoutContentStaggerVariants,
} from '@/components/ui/cutout-card'

/**
 * Compact nearby location card — cutout style with photo, title, and distance.
 *
 * Used in: "Nearby Locations" horizontal scroll section on dashboard.
 */
export function LocationCardNearby({
    location,
    className = '',
    width = 'w-[160px]',
}) {
    const navigate = useNavigate()
    const stagger = useCutoutContentStaggerVariants()
    const image = location.image || location.image_url
    const distanceKm = location._dist ?? location.distance_km ?? location.distance

    return (
        <button
            onClick={() => navigate(`/location/${location.id}`)}
            className={`flex-shrink-0 ${width} group text-left transition-all duration-300 active:scale-[0.98] hover:-translate-y-1 ${className}`}
        >
            <CutoutCard className="overflow-hidden">
                {/* Image */}
                <CutoutCardMedia className="h-[100px]">
                    <div className="absolute inset-0">
                        <LazyImage
                            src={image}
                            alt={location.title}
                            className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                            wrapperClassName="w-full h-full"
                        />
                    </div>
                    <CutoutCardOverlay />

                    {/* Distance badge */}
                    {distanceKm != null && Number.isFinite(distanceKm) && (
                        <CutoutCardPin className="bottom-1.5 left-1.5 rounded-tr-[10px] bg-black/40 backdrop-blur-md px-2 py-1 flex items-center gap-1 border border-white/10 shadow-lg">
                            <MapPin size={9} className="text-blue-400" />
                            <span className="text-[9px] font-black text-white">
                                {formatDistance(distanceKm)}
                            </span>
                            <CutoutCorner
                                className="absolute bottom-0 -right-[23px] rotate-90 text-black/40"
                                size={24}
                            />
                            <CutoutCorner
                                className="absolute top-0 -left-[23px] rotate-90 text-black/40"
                                size={24}
                            />
                        </CutoutCardPin>
                    )}
                </CutoutCardMedia>

                {/* Content */}
                <CutoutCardContent className="p-3">
                    <motion.div
                        animate="show"
                        className="contents"
                        initial="hidden"
                        variants={stagger.container}
                    >
                        <motion.h4
                            className="text-[0.8125rem] font-semibold leading-tight truncate text-slate-900 dark:text-white group-hover:text-blue-500 transition-colors tracking-[-0.012em]"
                            variants={stagger.item}
                        >
                            {location.title}
                        </motion.h4>
                        <motion.p
                            className="text-[0.625rem] text-slate-400 dark:text-slate-500 truncate mt-1 font-medium uppercase tracking-[0.06em]"
                            variants={stagger.item}
                        >
                            {location.city}
                        </motion.p>
                    </motion.div>
                </CutoutCardContent>
            </CutoutCard>
        </button>
    )
}
