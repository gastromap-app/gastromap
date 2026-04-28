import React from 'react'
import { useNavigate } from 'react-router-dom'
import { MapPin, Star } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card'
import { Link } from 'react-router-dom'
import { useFavoritesStore } from '@/features/dashboard/hooks/useFavoritesStore'
import { translate } from '@/utils/translation'
import LazyImage from '@/components/ui/LazyImage'
import FavoriteButton from '@/components/ui/FavoriteButton'
import { useTranslation } from 'react-i18next'
import { getCategoryLabel } from '@/shared/config/filterOptions'

export default function LocationCard({ location }) {
    const { i18n } = useTranslation()
    const navigate = useNavigate()
    const { isFavorite, toggleFavorite } = useFavoritesStore()
    const isFav = isFavorite(location.id)

    return (
        <Card className="overflow-hidden hover:shadow-lg transition-shadow duration-300 group">
            <div className="relative h-48 overflow-hidden">
                <LazyImage
                    src={location.image}
                    alt={location.title}
                    crossOrigin="anonymous"
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                />
                <div className="absolute top-2 right-2 z-10">
                    <FavoriteButton
                        isFavorite={isFav}
                        onToggle={() => toggleFavorite(location.id)}
                        variant="chip"
                        size={20}
                    />
                </div>
                <div className="absolute top-2 left-2 flex gap-1.5">
                    <Badge className="bg-background/80 text-foreground backdrop-blur-sm border-none">
                        {getCategoryLabel(location.category, i18n.language)}
                    </Badge>
                    {location.cuisine && (
                        <Badge className="bg-blue-600/90 text-white backdrop-blur-sm border-none font-black shadow-lg">
                            {translate(location.cuisine)}
                        </Badge>
                    )}
                </div>
            </div>

            <CardHeader className="p-4 pb-2">
                <div className="flex justify-between items-start">
                    <h3 className="font-semibold text-lg leading-tight group-hover:text-primary transition-colors">
                        {location.title}
                    </h3>
                    <div className="flex items-center gap-1 text-yellow-500">
                        <Star className="h-4 w-4 fill-current" />
                        <span className="text-sm font-medium text-foreground">{location.rating}</span>
                    </div>
                </div>
                <div className="flex items-center gap-1 text-muted-foreground text-sm">
                    <MapPin className="h-3.5 w-3.5" />
                    <span className="truncate">{location.address}</span>
                </div>
            </CardHeader>

            <CardContent className="p-4 pt-0 flex-1" onClick={() => navigate(`/location/${location.id}`)}>
                <p className="text-sm text-muted-foreground line-clamp-2">
                    {location.description}
                </p>
                <div className="mt-3 flex flex-wrap gap-1.5 items-center">
                    {/* Tags */}
                    {location.tags?.slice(0, 2).map(tag => (
                        <Badge key={tag} variant="outline" className="text-[9px] font-bold h-5 px-2 bg-slate-50 dark:bg-slate-800/50 border-none">
                            {translate(tag)}
                        </Badge>
                    ))}

                    {/* Special Labels */}
                    {location.special_labels?.slice(0, 2).map(label => (
                        <span key={label} className="text-[9px] font-black uppercase tracking-wider text-blue-500/80 dark:text-blue-400/60">
                            • {translate(label)}
                        </span>
                    ))}
                </div>
            </CardContent>

            <CardFooter className="p-4 pt-0 mt-auto">
                <Link to={`/location/${location.id}`} className="w-full">
                    <Button className="w-full" size="sm" variant="secondary">
                        View Details
                    </Button>
                </Link>
            </CardFooter>
        </Card>
    )
}
