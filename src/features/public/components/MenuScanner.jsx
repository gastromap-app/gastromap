import React, { useState, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Camera, Upload, X, Loader2, UtensilsCrossed, CheckCircle2, AlertCircle } from 'lucide-react'
import { useTheme } from '@/hooks/useTheme'

/**
 * MenuScanner — AI-powered menu OCR using Nemotron Nano 2 VL
 *
 * Allows user to upload/take a photo of a menu →
 * AI extracts dishes, prices, categories → shows results.
 *
 * Uses /api/ai/menu-ocr (Vercel serverless).
 */
export function MenuScanner({ onDishesExtracted }) {
  const { theme } = useTheme()
  const isDark = theme === 'dark'
  const fileRef = useRef(null)

  const [state, setState] = useState('idle') // idle | uploading | scanning | done | error
  const [dishes, setDishes] = useState([])
  const [previewUrl, setPreviewUrl] = useState(null)
  const [errorMsg, setErrorMsg] = useState('')

  const textStyle  = isDark ? 'text-white'      : 'text-gray-900'
  const subText    = isDark ? 'text-white/50'    : 'text-gray-500'
  const cardBg     = isDark ? 'bg-white/5 border-white/10' : 'bg-gray-50 border-gray-100'

  const handleFile = async (file) => {
    if (!file || !file.type.startsWith('image/')) return

    setState('uploading')
    setDishes([])
    setErrorMsg('')

    // Create preview
    const url = URL.createObjectURL(file)
    setPreviewUrl(url)

    // Convert to base64
    const base64 = await new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload  = (e) => resolve(e.target.result.split(',')[1])
      reader.onerror = reject
      reader.readAsDataURL(file)
    })

    setState('scanning')

    try {
      const res = await fetch('/api/ai/menu-ocr', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          image_base64: base64,
          mime_type: file.type,
        }),
      })

      const data = await res.json()

      if (!res.ok || data.error) {
        throw new Error(data.error || `HTTP ${res.status}`)
      }

      setDishes(data.dishes || [])
      setState('done')
      onDishesExtracted?.(data.dishes || [])
    } catch (err) {
      console.error('[MenuScanner]', err)
      setErrorMsg(err.message)
      setState('error')
    }
  }

  const handleDrop = (e) => {
    e.preventDefault()
    const file = e.dataTransfer.files?.[0]
    if (file) handleFile(file)
  }

  const reset = () => {
    setState('idle')
    setDishes([])
    setPreviewUrl(null)
    setErrorMsg('')
    if (previewUrl) URL.revokeObjectURL(previewUrl)
  }

  const isScanning = state === 'uploading' || state === 'scanning'

  return (
    <div className="space-y-4">
      {/* Upload zone */}
      {state === 'idle' && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          onDrop={handleDrop}
          onDragOver={(e) => e.preventDefault()}
          onClick={() => fileRef.current?.click()}
          className={`
            relative flex flex-col items-center justify-center gap-4 p-10
            rounded-[32px] border-2 border-dashed cursor-pointer
            transition-all hover:border-blue-500/60 hover:bg-blue-500/5
            ${isDark ? 'border-white/10 bg-white/5' : 'border-gray-200 bg-gray-50'}
          `}
        >
          <div className="w-16 h-16 rounded-2xl bg-blue-600/10 flex items-center justify-center text-blue-500">
            <Camera size={32} />
          </div>
          <div className="text-center space-y-1">
            <p className={`font-black text-lg ${textStyle}`}>Scan Menu with AI</p>
            <p className={`text-sm ${subText}`}>
              Take a photo or upload an image — AI will extract dishes &amp; prices
            </p>
          </div>
          <div className="flex gap-3">
            <span className={`px-4 py-2 rounded-xl text-xs font-bold ${isDark ? 'bg-white/10 text-white/70' : 'bg-gray-200 text-gray-600'}`}>
              📷 Camera
            </span>
            <span className={`px-4 py-2 rounded-xl text-xs font-bold ${isDark ? 'bg-white/10 text-white/70' : 'bg-gray-200 text-gray-600'}`}>
              🖼 Gallery
            </span>
          </div>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={(e) => handleFile(e.target.files?.[0])}
          />
        </motion.div>
      )}

      {/* Scanning state */}
      {isScanning && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className={`flex flex-col items-center gap-6 p-10 rounded-[32px] border ${cardBg}`}
        >
          {previewUrl && (
            <div className="w-full max-h-48 rounded-2xl overflow-hidden">
              <img src={previewUrl} alt="menu" className="w-full h-full object-cover" />
            </div>
          )}
          <div className="flex items-center gap-3">
            <Loader2 size={24} className="text-blue-500 animate-spin" />
            <p className={`font-bold ${textStyle}`}>
              {state === 'uploading' ? 'Preparing image…' : 'AI scanning menu…'}
            </p>
          </div>
          <p className={`text-xs ${subText}`}>Nemotron Nano 2 VL is reading your menu</p>
        </motion.div>
      )}

      {/* Error */}
      {state === 'error' && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
          className={`flex flex-col items-center gap-4 p-8 rounded-[32px] border ${cardBg}`}
        >
          <AlertCircle size={32} className="text-red-500" />
          <div className="text-center">
            <p className={`font-black ${textStyle}`}>Scan failed</p>
            <p className={`text-xs mt-1 ${subText}`}>{errorMsg}</p>
          </div>
          <button onClick={reset}
            className="px-6 py-3 bg-blue-600 text-white font-black rounded-2xl text-sm hover:scale-[1.02] active:scale-95 transition-all"
          >Try Again</button>
        </motion.div>
      )}

      {/* Results */}
      {state === 'done' && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CheckCircle2 size={18} className="text-green-500" />
              <span className={`font-black ${textStyle}`}>
                {dishes.length} {dishes.length === 1 ? 'item' : 'items'} found
              </span>
            </div>
            <button onClick={reset} className={`text-xs font-bold ${subText} hover:text-blue-500 transition-colors`}>
              Scan again
            </button>
          </div>

          {/* Preview thumbnail */}
          {previewUrl && (
            <div className="w-full max-h-36 rounded-2xl overflow-hidden">
              <img src={previewUrl} alt="scanned menu" className="w-full h-full object-cover" />
            </div>
          )}

          {/* Dishes grouped by category */}
          {dishes.length > 0 ? (
            <div className="space-y-3">
              {/* Group by category */}
              {Object.entries(
                dishes.reduce((acc, d) => {
                  const cat = d.category || 'Menu'
                  if (!acc[cat]) acc[cat] = []
                  acc[cat].push(d)
                  return acc
                }, {})
              ).map(([category, items]) => (
                <div key={category} className="space-y-2">
                  <p className={`text-xs font-black uppercase tracking-wider ${subText}`}>{category}</p>
                  {items.map((dish, i) => (
                    <div key={i} className={`p-4 rounded-2xl border flex justify-between items-start gap-2 ${cardBg}`}>
                      <div className="space-y-0.5 flex-1 min-w-0">
                        <p className={`font-black text-sm truncate ${textStyle}`}>{dish.name}</p>
                        {dish.description && (
                          <p className={`text-xs ${subText} line-clamp-2`}>{dish.description}</p>
                        )}
                      </div>
                      {dish.price && (
                        <span className="text-blue-500 font-black text-sm flex-shrink-0">{dish.price}</span>
                      )}
                    </div>
                  ))}
                </div>
              ))}
            </div>
          ) : (
            <div className={`p-8 rounded-[32px] border text-center ${cardBg}`}>
              <UtensilsCrossed size={32} className={`mx-auto mb-3 ${subText}`} />
              <p className={`font-bold ${textStyle}`}>No dishes detected</p>
              <p className={`text-xs mt-1 ${subText}`}>Try a clearer photo of the menu</p>
            </div>
          )}
        </motion.div>
      )}
    </div>
  )
}
