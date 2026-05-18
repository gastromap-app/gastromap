import React, { useState, useEffect } from 'react'
import { AnimatePresence, motion } from 'framer-motion'

const GASTRO_SLIDES = [
  {
    url: 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=1920&q=80',
    label: 'Tokyo Ramen District',
    subtitle: 'Steaming bowls of handcrafted perfection',
  },
  {
    url: 'https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=1920&q=80',
    label: 'Paris Le Marais',
    subtitle: 'Where every plate tells a story',
  },
  {
    url: 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=1920&q=80',
    label: 'Barcelona La Boqueria',
    subtitle: 'A feast for all the senses',
  },
  {
    url: 'https://images.unsplash.com/photo-1476224203421-9ac39bcb3327?w=1920&q=80',
    label: 'Naples Pizza Alley',
    subtitle: 'Centuries of dough mastery',
  },
  {
    url: 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=1920&q=80',
    label: 'New York Fine Dining',
    subtitle: 'Ambiance meets culinary art',
  },
  {
    url: 'https://images.unsplash.com/photo-1559339352-11d035aa65de?w=1920&q=80',
    label: 'Marrakech Spice Market',
    subtitle: 'Colors and aromas of the Medina',
  },
  {
    url: 'https://images.unsplash.com/photo-1466978913421-dad2ebd01d17?w=1920&q=80',
    label: 'Bangkok Street Food',
    subtitle: 'Sizzling woks under neon lights',
  },
  {
    url: 'https://images.unsplash.com/photo-1528605248644-14dd04022da1?w=1920&q=80',
    label: 'Tuscany Farm Table',
    subtitle: 'Gathering around honest food',
  },
]

const INTERVAL_MS = 4500

export const MaintenanceCarousel = () => {
  const [currentIndex, setCurrentIndex] = useState(0)

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % GASTRO_SLIDES.length)
    }, INTERVAL_MS)

    return () => clearInterval(interval)
  }, [])

  const slide = GASTRO_SLIDES[currentIndex]

  return (
    <div className="relative w-full h-full overflow-hidden">
      <AnimatePresence mode="wait">
        <motion.div
          key={currentIndex}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.8, ease: 'easeInOut' }}
          className="absolute inset-0"
        >
          <img
            src={slide.url}
            alt={slide.label}
            className="w-full h-full object-cover"
          />
          {/* Gradient overlay for text readability */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />

          {/* Destination label */}
          <div className="absolute bottom-8 left-8 right-8">
            <motion.p
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="text-white/70 text-xs font-bold uppercase tracking-[0.2em] mb-2"
            >
              {slide.subtitle}
            </motion.p>
            <motion.h2
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.6, delay: 0.3 }}
              className="text-white text-2xl font-black tracking-tight drop-shadow-lg"
            >
              {slide.label}
            </motion.h2>
          </div>
        </motion.div>
      </AnimatePresence>

      {/* Slide indicators */}
      <div className="absolute bottom-8 right-8 flex gap-1.5">
        {GASTRO_SLIDES.map((_, idx) => (
          <div
            key={idx}
            className={`w-1.5 h-1.5 rounded-full transition-all duration-300 ${
              idx === currentIndex
                ? 'bg-white scale-125'
                : 'bg-white/40'
            }`}
          />
        ))}
      </div>
    </div>
  )
}
