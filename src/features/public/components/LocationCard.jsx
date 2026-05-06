import React from 'react'
import { useNavigate } from 'react-router-dom'
import { MapPin, Star, Sunrise, Sun, Sunset, Sparkles } from 'lucide-react'
import { motion } from 'framer-motion'
import { useFavorites } from '@/hooks/useFavorites'
import { translate } from '@/utils/translation'
import FavoriteButton from '@/components/ui/FavoriteButton'
import { useTranslation } from 'react-i18next'
import { getCategoryLabel, getLabelEmoji } from '@/shared/config/filterOptions'
import { getDisplayRating } from '@/utils/ratingUtils'
import {
    CutoutCard,
    CutoutCardMedia,
    CutoutCardImage,
    CutoutCardOverlay,
    CutoutCardInsetLabel,
    CutoutCardPin,
    CutoutCorner,
    CutoutCardContent,
    CutoutCardFooter,
    useCutoutContentStaggerVariants,
} from '@/components/ui/cutout-card'

export default function LocationCard({ location }) {
    const { i18n, t } = useTranslation()
    const navigate = useNavigate()
    const { isFavorite, toggleFavorite } = useFavorites()
    const isFav = isFavorite(location.id)
    const stagger = useCutoutContentStaggerVariants()

    // Calculate Ground Truth Rating
    const displayRating = getDisplayRating(location, [])
    const price = location.price_range || ''
    const city = location.city || ''

    // Best time icons
    const bestTimeIcons = []
    if (location.best_time) {
        if (location.best_time.includes('morning')) bestTimeIcons.push({ icon: Sunrise, color: 'text-orange-400' })
        if (location.best_time.includes('day')) bestTimeIcons.push({ icon: Sun, color: 'text-yellow-500' })
        if (location.best_time.includes('evening')) bestTimeIcons.push({ icon: Sunset, color: 'text-orange-500' })
        if (location.best_time.includes('late_night')) bestTimeIcons.push({ icon: Sparkles, color: 'text-indigo-400' })
    }

    // Pick primary category label for the inset label
    const categoryLabel = getCategoryLabel(location.category, i18n.language)

    // Pick a pin label — cuisine, price range, or special label
    const pinLabel = location.cuisine
        ? translate(location.cuisine)
        : price
            ? price
            : null

    return (
        <CutoutCard
            className="group cursor-pointer transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_8px_32px_rgba(0,0,0,0.12)] dark:hover:shadow-[0_8px_32px_rgba(0,0,0,0.4)] active:scale-[0.98]"
            onClick={() => navigate(`/location/${location.id}`)}
            role="article"
            aria-label={location.title}
        >
            {/* Media */}
            <CutoutCardMedia className="h-52">
                <CutoutCardImage
                    src={location.image}
                    alt={location.title}
                    className="transition-transform duration-700 group-hover:scale-110"
                />
                <CutoutCardOverlay />

                {/* InsetLabel — category at bottom-left of media */}
                <CutoutCardInsetLabel className="bottom-0 left-0 rounded-tr-[20px] bg-white/90 dark:bg-[hsl(220,20%,12%)]/90 backdrop-blur-md px-4 py-2.5">
                    <span className="font-semibold text-[10px] text-slate-500 dark:text-slate-400 uppercase tracking-widest">
                        {categoryLabel}
                    </span>
                    <CutoutCorner className="absolute -right-[31px] -bottom-px rotate-90 text-white/90 dark:text-[hsl(220,20%,12%)]/90" />
                    <CutoutCorner className="absolute -top-[31px] -left-px rotate-90 text-white/90 dark:text-[hsl(220,20%,12%)]/90" />
                </CutoutCardInsetLabel>

                {/* Pin — cuisine or price at top-right */}
                {pinLabel && (
                    <CutoutCardPin className="top-0 right-0 rounded-bl-[16px] bg-blue-500 px-3.5 py-1.5 font-semibold text-white text-[11px] shadow-md shadow-blue-500/20">
                        {pinLabel}
                        <CutoutCorner
                            className="absolute top-0 -left-[23px] -rotate-90 text-blue-500"
                            size={24}
                        />
                        <CutoutCorner
                            className="absolute right-0 -bottom-[23px] -rotate-90 text-blue-500"
                            size={24}
                        />
                    </CutoutCardPin>
                )}

                {/* Favorite button — top-left corner */}
                <div className="absolute top-2.5 left-2.5 z-10">
                    <FavoriteButton
                        isFavorite={isFav}
                        onToggle={(e) => { e.stopPropagation(); toggleFavorite(location.id) }}
                        variant="chip"
                        size={18}
                    />
                </div>

                {/* Rating badge — bottom-right of media */}
                {displayRating.rating > 0 && (
                    <div className="absolute bottom-2.5 right-2.5 z-10 flex items-center gap-1 bg-black/40 backdrop-blur-md px-2 py-1 rounded-full border border-white/10 shadow-lg">
                        <Star size={10} className="text-yellow-400 fill-yellow-400" />
                        <span className="text-[11px] font-black text-white">{Number(displayRating.rating).toFixed(1)}</span>
                    </div>
                )}
            </CutoutCardMedia>

            {/* Content */}
            <CutoutCardContent>
                <motion.div
                    animate="show"
                    className="contents"
                    initial="hidden"
                    variants={stagger.container}
                >
                    <motion.h2
                        className="mb-1.5 font-semibold text-[1.0625rem] leading-snug text-slate-900 dark:text-white group-hover:text-blue-500 transition-colors"
                        variants={stagger.item}
                    >
                        {location.title}
                    </motion.h2>

                    {/* Address line */}
                    {location.address && (
                        <motion.div
                            className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400 text-[0.8125rem] mb-3"
                            variants={stagger.item}
                        >
                            <MapPin size={13} className="shrink-0" />
                            <span className="truncate">{location.address}</span>
                        </motion.div>
                    )}

                    {/* Description */}
                    {location.description && (
                        <motion.p
                            className="text-[0.9375rem] text-slate-500 dark:text-slate-400 leading-relaxed line-clamp-2 mb-3"
                            variants={stagger.item}
                        >
                            {location.description}
                        </motion.p>
                    )}

                    {/* Footer */}
                    <motion.div variants={stagger.item}>
                        <CutoutCardFooter>
                            <div className="flex items-center gap-2">
                                {/* Best time icons */}
                                {bestTimeIcons.length > 0 && (
                                    <div className="flex gap-1 items-center">
                                        {bestTimeIcons.map(({ icon: Icon, color }, i) => (
                                            <Icon key={i} size={14} className={color} />
                                        ))}
                                    </div>
                                )}

                                {/* Tags */}
                                {location.tags?.slice(0, 2).map(tag => (
                                    <span
                                        key={tag}
                                        className="text-[10px] font-medium text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-white/5 px-2 py-0.5 rounded-full"
                                    >
                                        {translate(tag)}
                                    </span>
                                ))}
                            </div>

                            {/* Right side: city + price */}
                            <div className="flex items-center gap-1.5 text-[0.6875rem] font-medium text-slate-400 dark:text-slate-500 tabular-nums">
                                {city && <span className="truncate max-w-[100px]">{city}</span>}
                                {city && price && <span className="text-slate-300 dark:text-slate-600">·</span>}
                                {price && <span>{price}</span>}
                            </div>
                        </CutoutCardFooter>
                    </motion.div>
                </motion.div>
            </CutoutCardContent>
        </CutoutCard>
    )
}
