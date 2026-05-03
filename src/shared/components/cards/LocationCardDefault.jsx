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
            className={`group cursor-pointer surface transition-all duration-300 active:scale-[0.98] hover:surface-elevated hover:-translate-y-1 ${className}`}
        >
            {/* Image */}
            <div className={`relative ${imageHeight} overflow-hidden rounded-t-[28px]`}>
                <LazyImage
                    src={image}
                    alt={location.title}
                    className="w-full h-full object-cover transition-transform duration-1000 group-hover:scale-110"
                    wrapperClassName="w-full h-full"
                />

                {/* Gradient overlay */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent" />

                {/* Rating badge */}
                {rating > 0 && (
                    <div className="absolute top-3 left-3 flex items-center gap-1 bg-black/40 backdrop-blur-md px-2 py-1 rounded-full border border-white/10 shadow-lg">
                        <Star size={10} className="text-yellow-400 fill-yellow-400" />
                        <span className="text-[11px] font-black text-white">{Number(rating).toFixed(1)}</span>
                    </div>
                )}

                {/* Favorite button */}
                <div className="absolute top-3 right-3 z-10">
                    <FavoriteButton
                        isFavorite={isFav}
                        onToggle={() => toggleFavorite(location.id)}
                        variant="chip"
                        size={18}
                        className="bg-black/40 backdrop-blur-md hover:bg-black/60 border border-white/10 shadow-lg"
                    />
                </div>
            </div>

            {/* Content */}
            <div className="p-5">
                <h3 className="text-[1.125rem] font-extrabold leading-[1.2] text-t-primary group-hover:text-blue-500 transition-colors tracking-tight">
                    {location.title}
                </h3>

                <div className="flex items-center gap-2 mt-2 text-[0.6875rem] font-bold uppercase tracking-[0.14em]">
                    <span className="text-blue-500 truncate">
                        {location.city}
                    </span>
                    {price && (
                        <>
                            <span className="text-t-quaternary">·</span>
                            <span className="text-t-tertiary">
                                {price}
                            </span>
                        </>
                    )}
                </div>

                {location.description && (
                    <p className="text-[0.9375rem] text-t-tertiary mt-3 line-clamp-2 leading-relaxed font-medium tracking-tight">
                        {location.description}
                    </p>
                )}
            </div>
        </div>
    )
}
