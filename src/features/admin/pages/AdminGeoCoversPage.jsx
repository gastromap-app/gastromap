import React, { useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Upload, Trash2, Globe, CheckCircle2, AlertCircle, Link as LinkIcon, X } from 'lucide-react'
import AdminPageHeader from '../components/AdminPageHeader'
import { useGeoCovers, useUpsertGeoCoverMutation, useDeleteGeoCoverMutation } from '@/shared/api/queries'

// ─── Static fallback data ─────────────────────────────────────────────────────
const COUNTRIES = [
    { slug: 'poland',      name: 'Poland',      flag: '🇵🇱' },
    { slug: 'france',      name: 'France',      flag: '🇫🇷' },
    { slug: 'italy',       name: 'Italy',       flag: '🇮🇹' },
    { slug: 'spain',       name: 'Spain',       flag: '🇪🇸' },
    { slug: 'germany',     name: 'Germany',     flag: '🇩🇪' },
    { slug: 'portugal',    name: 'Portugal',    flag: '🇵🇹' },
    { slug: 'netherlands', name: 'Netherlands', flag: '🇳🇱' },
    { slug: 'czechia',     name: 'Czechia',     flag: '🇨🇿' },
]

// ─── Upload Card ──────────────────────────────────────────────────────────────
function CountryCoverCard({ country, cover }) {
    const inputRef = useRef(null)
    const [urlMode, setUrlMode] = useState(false)
    const [urlInput, setUrlInput] = useState('')
    const [preview, setPreview] = useState(null)
    const [selectedFile, setSelectedFile] = useState(null)
    const [toast, setToast] = useState(null)

    const upsert = useUpsertGeoCoverMutation()
    const remove = useDeleteGeoCoverMutation()

    const currentImage = preview || cover?.image_url || null

    const showToast = (msg, type = 'success') => {
        setToast({ msg, type })
        setTimeout(() => setToast(null), 3000)
    }

    const handleFile = (e) => {
        const file = e.target.files?.[0]
        if (!file) return
        setSelectedFile(file)
        setPreview(URL.createObjectURL(file))
        setUrlMode(false)
    }

    const handleSave = async () => {
        if (!selectedFile && !urlInput) return
        try {
            await upsert.mutateAsync({
                file: selectedFile || null,
                url: urlInput || null,
                slug: country.slug,
                geoType: 'country',
                name: country.name,
            })
            setPreview(null)
            setSelectedFile(null)
            setUrlInput('')
            showToast('Cover saved!')
        } catch (err) {
            showToast(err.message || 'Upload failed', 'error')
        }
    }

    const handleDelete = async () => {
        try {
            await remove.mutateAsync({ slug: country.slug, geoType: 'country' })
            setPreview(null)
            showToast('Cover removed')
        } catch (err) {
            showToast(err.message || 'Delete failed', 'error')
        }
    }

    const isDirty = !!(selectedFile || urlInput)

    return (
        <div className="bg-white dark:bg-slate-900/60 rounded-[24px] border border-slate-100 dark:border-slate-800/50 overflow-hidden shadow-sm">
            {/* Image area */}
            <div
                className="relative h-40 bg-slate-100 dark:bg-slate-800 cursor-pointer group"
                onClick={() => !urlMode && inputRef.current?.click()}
            >
                {currentImage ? (
                    <img
                        src={currentImage}
                        alt={country.name}
                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center gap-2 text-slate-400 group-hover:text-indigo-500 transition-colors">
                        <Upload size={28} />
                        <span className="text-[11px] font-bold uppercase tracking-wider">Click to upload</span>
                    </div>
                )}
                {/* Dark overlay on hover */}
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                    {currentImage && (
                        <Upload size={22} className="text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                    )}
                </div>
                <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />

                {/* Flag + name badge */}
                <div className="absolute bottom-2 left-3 flex items-center gap-1.5 bg-black/50 backdrop-blur-sm px-2.5 py-1 rounded-full">
                    <span className="text-base">{country.flag}</span>
                    <span className="text-white text-[11px] font-bold">{country.name}</span>
                </div>

                {/* Delete button */}
                {cover?.image_url && !isDirty && (
                    <button
                        onClick={(e) => { e.stopPropagation(); handleDelete() }}
                        disabled={remove.isPending}
                        className="absolute top-2 right-2 w-7 h-7 rounded-full bg-red-500/80 hover:bg-red-600 text-white flex items-center justify-center transition-all opacity-0 group-hover:opacity-100"
                    >
                        <Trash2 size={13} />
                    </button>
                )}
            </div>

            {/* Controls */}
            <div className="p-3 space-y-2">
                {/* URL mode toggle */}
                <button
                    onClick={() => setUrlMode(v => !v)}
                    className="flex items-center gap-1.5 text-[11px] font-semibold text-indigo-500 hover:text-indigo-600 transition-colors"
                >
                    <LinkIcon size={12} />
                    {urlMode ? 'Cancel URL input' : 'Use image URL instead'}
                </button>

                <AnimatePresence>
                    {urlMode && (
                        <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            className="overflow-hidden"
                        >
                            <input
                                value={urlInput}
                                onChange={e => { setUrlInput(e.target.value); setPreview(e.target.value || null); setSelectedFile(null) }}
                                placeholder="https://images.unsplash.com/..."
                                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-[12px] text-slate-800 dark:text-white outline-none focus:border-indigo-400 transition-colors"
                            />
                        </motion.div>
                    )}
                </AnimatePresence>

                {isDirty && (
                    <div className="flex gap-2">
                        <button
                            onClick={handleSave}
                            disabled={upsert.isPending}
                            className="flex-1 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-[12px] font-bold transition-all active:scale-95 disabled:opacity-50"
                        >
                            {upsert.isPending ? 'Saving…' : 'Save cover'}
                        </button>
                        <button
                            onClick={() => { setPreview(null); setSelectedFile(null); setUrlInput(''); setUrlMode(false) }}
                            className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-500 flex items-center justify-center hover:bg-slate-200 transition-colors"
                        >
                            <X size={14} />
                        </button>
                    </div>
                )}

                {/* Toast */}
                <AnimatePresence>
                    {toast && (
                        <motion.div
                            initial={{ opacity: 0, y: 4 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0 }}
                            className={`flex items-center gap-2 text-[11px] font-semibold px-3 py-2 rounded-xl ${
                                toast.type === 'error'
                                    ? 'bg-red-50 dark:bg-red-900/20 text-red-600'
                                    : 'bg-green-50 dark:bg-green-900/20 text-green-600'
                            }`}
                        >
                            {toast.type === 'error'
                                ? <AlertCircle size={13} />
                                : <CheckCircle2 size={13} />}
                            {toast.msg}
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </div>
    )
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function AdminGeoCoversPage() {
    const { data: covers = [], isLoading } = useGeoCovers('country')

    // Build a lookup: slug → cover record
    const coverMap = Object.fromEntries(covers.map(c => [c.slug, c]))

    return (
        <div className="space-y-6 pb-12">
            <AdminPageHeader
                title="Geo Covers"
                subtitle="Upload or link cover photos for each country shown on the dashboard"
                icon={Globe}
            />

            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800/30 rounded-2xl px-5 py-4 text-[13px] text-blue-700 dark:text-blue-300 font-medium">
                Images are stored in Supabase Storage <code className="bg-blue-100 dark:bg-blue-800/40 px-1.5 py-0.5 rounded text-[11px]">geo-covers</code> bucket and served publicly.
                Recommended size: <strong>800 × 500 px</strong>, max 5 MB.
            </div>

            {isLoading ? (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                    {COUNTRIES.map(c => (
                        <div key={c.slug} className="h-52 rounded-[24px] bg-slate-100 dark:bg-slate-800 animate-pulse" />
                    ))}
                </div>
            ) : (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                    {COUNTRIES.map(country => (
                        <CountryCoverCard
                            key={country.slug}
                            country={country}
                            cover={coverMap[country.slug] ?? null}
                        />
                    ))}
                </div>
            )}
        </div>
    )
}
