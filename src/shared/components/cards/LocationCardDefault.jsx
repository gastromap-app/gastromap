import React from 'react'
import { useNavigate } from 'react-router-dom'
import { Star } from 'lucide-react'
import { LazyImage } from '@/components/ui/LazyImage'
import FavoriteButton from '@/components/ui/FavoriteButton'
import { useFavorites } from '@/hooks/useFavorites'

/**
 * Default location card — rich preview with photo, rating, favorites,
 * title, city, budget, and description snippet.
 *
 * Used in: explore grids, recommendations, trending, search results.
 */
export function LocationCardDefault({
    location,
    className = '',
    imageHeight = 'h-48',
}) {
    const navigate = useNavigate()
    const { isFavorite, toggleFavorite } = useFavorites()
    const isFav = isFavorite(location.id)

    const image = location.image || location.image_url
    const rating = location.google_rating || location.rating || 0
    const price = location.price_range || ''

    return (
        <div
            onClick={() => navigate(`/location/${location.id}`)}
            className={`group cursor-pointer rounded-2xl overflow-hidden border transition-all duration-200 active:scale-[0.98] bg-white dark:bg-[hsl(220,20%,6%)] border-slate-200/50 dark:border-white/5 hover:shadow-lg dark:hover:shadow-none ${className}`}
        >
            {/* Image */}
            <div className={`relative ${imageHeight} overflow-hidden`}>
                <LazyImage
                    src={image}
                    alt={location.title}
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                    wrapperClassName="w-full h-full"
                />

                {/* Gradient overlay */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />

                {/* Rating badge */}
                {rating > 0 && (
                    <div className="absolute top-2.5 left-2.5 flex items-center gap-1 bg-black/50 backdrop-blur-md px-1.5 py-0.5 rounded-full">
                        <Star size={10} className="text-yellow-400 fill-yellow-400" />
                        <span className="text-[10px] font-bold text-white">{Number(rating).toFixed(1)}</span>
                    </div>
                )}

                {/* Favorite button */}
                <div className="absolute top-2 right-2 z-10">
                    <FavoriteButton
                        isFavorite={isFav}
                        onToggle={() => toggleFavorite(location.id)}
                        variant="chip"
                        size={18}
                        className="bg-black/30 backdrop-blur-sm hover:bg-black/50"
                    />
                </div>
            </div>

            {/* Content */}
            <div className="p-3.5">
                <h3 className="text-[15px] font-semibold leading-tight truncate text-gray-900 dark:text-white">
                    {location.title}
                </h3>

                <div className="flex items-center gap-2 mt-1 text-[12px]">
                    <span className="text-slate-600 dark:text-gray-500 truncate">
                        {location.city}
                    </span>
                    {price && (
                        <>
                            <span className="text-slate-300 dark:text-gray-700">·</span>
                            <span className="text-slate-500 dark:text-gray-600 font-medium">
                                {price}
                            </span>
                        </>
                    )}
                </div>

                {location.description && (
                    <p className="text-[12px] text-slate-500 dark:text-gray-600 mt-2 line-clamp-2 leading-relaxed">
                        {location.description}
                    </p>
                )}
            </div>
        </div>
    )
}
