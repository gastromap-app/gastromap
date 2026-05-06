import React from 'react'
import { useNavigate } from 'react-router-dom'
import { Star } from 'lucide-react'
import { motion } from 'framer-motion'
import { LazyImage } from '@/components/ui/LazyImage'
import FavoriteButton from '@/components/ui/FavoriteButton'
import { useFavorites } from '@/hooks/useFavorites'
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
 * Default location card — cutout style with photo, rating, favorites,
 * title, city, budget, and description snippet.
 *
 * Used in: explore grids, recommendations, trending, search results.
 */
export function LocationCardDefault({
    location,
    className = '',
    imageHeight = 'h-40',
}) {
    const navigate = useNavigate()
    const { isFavorite, toggleFavorite } = useFavorites()
    const isFav = isFavorite(location.id)
    const stagger = useCutoutContentStaggerVariants()

    const image = location.image || location.image_url
    const rating = location.google_rating || location.rating || 0
    const price = location.price_range || ''

    return (
        <div
            onClick={() => navigate(`/location/${location.id}`)}
            className={`group cursor-pointer transition-all duration-300 active:scale-[0.98] hover:-translate-y-1 ${className}`}
        >
            <CutoutCard className="overflow-hidden">
                {/* Image */}
                <CutoutCardMedia className={imageHeight}>
                    <div className="absolute inset-0">
                        <LazyImage
                            src={image}
                            alt={location.title}
                            className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                            wrapperClassName="w-full h-full"
                        />
                    </div>
                    <CutoutCardOverlay />

                    {/* Pin — rating top-left */}
                    {rating > 0 && (
                        <CutoutCardPin className="top-2 left-2 rounded-br-[12px] bg-black/40 backdrop-blur-md px-2 py-1 flex items-center gap-1 border border-white/10 shadow-lg">
                            <Star size={10} className="text-yellow-400 fill-yellow-400" />
                            <span className="text-[10px] font-black text-white">{Number(rating).toFixed(1)}</span>
                            <CutoutCorner
                                className="absolute top-0 -right-[23px] rotate-90 text-black/40"
                                size={24}
                            />
                            <CutoutCorner
                                className="absolute bottom-0 -left-[23px] rotate-90 text-black/40"
                                size={24}
                            />
                        </CutoutCardPin>
                    )}

                    {/* Favorite button */}
                    <div className="absolute top-2 right-2 z-10">
                        <FavoriteButton
                            isFavorite={isFav}
                            onToggle={() => toggleFavorite(location.id)}
                            variant="chip"
                            size={18}
                            className="bg-black/40 backdrop-blur-md hover:bg-black/60 border border-white/10 shadow-lg"
                        />
                    </div>
                </CutoutCardMedia>

                {/* Content */}
                <CutoutCardContent className="p-4">
                    <motion.div
                        animate="show"
                        className="contents"
                        initial="hidden"
                        variants={stagger.container}
                    >
                        <motion.h3
                            className="text-[0.9375rem] font-semibold leading-[1.3] text-slate-900 dark:text-white group-hover:text-blue-500 transition-colors tracking-[-0.012em] line-clamp-1"
                            variants={stagger.item}
                        >
                            {location.title}
                        </motion.h3>

                        <motion.div
                            className="flex items-center gap-2 mt-1.5 text-[0.6875rem] font-medium uppercase tracking-[0.08em]"
                            variants={stagger.item}
                        >
                            <span className="text-blue-500 truncate">
                                {location.city}
                            </span>
                            {price && (
                                <>
                                    <span className="text-slate-300 dark:text-slate-600">·</span>
                                    <span className="text-slate-400 dark:text-slate-500">
                                        {price}
                                    </span>
                                </>
                            )}
                        </motion.div>

                        {location.description && (
                            <motion.p
                                className="text-[0.8125rem] text-slate-400 dark:text-slate-500 mt-2 line-clamp-2 leading-relaxed tracking-[-0.003em]"
                                variants={stagger.item}
                            >
                                {location.description}
                            </motion.p>
                        )}
                    </motion.div>
                </CutoutCardContent>
            </CutoutCard>
        </div>
    )
}
