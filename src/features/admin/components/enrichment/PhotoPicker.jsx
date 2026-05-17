import React, { useState } from 'react'
import { CheckSquare, Square, Image, Upload, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * PhotoPicker — Grid for selecting Google Places photos to upload.
 * Shows photo previews from Google Places Photo API.
 */
export default function PhotoPicker({ photos, existingPhotos = [], onConfirmSelection, isUploading }) {
    const [selected, setSelected] = useState([])

    const togglePhoto = (reference) => {
        setSelected(prev =>
            prev.includes(reference)
                ? prev.filter(r => r !== reference)
                : [...prev, reference]
        )
    }

    const selectAll = () => {
        const selectable = photos
            .filter(p => !isExisting(p.reference))
            .map(p => p.reference)
        setSelected(selectable)
    }

    const deselectAll = () => setSelected([])

    const isExisting = (reference) => {
        return existingPhotos.some(url => url && url.includes(reference))
    }

    const handleConfirm = () => {
        if (selected.length > 0) {
            onConfirmSelection(selected)
        }
    }

    if (!photos || photos.length === 0) {
        return (
            <div className="text-center py-8 text-t-quaternary text-sm">
                <Image size={24} className="mx-auto mb-2 opacity-50" />
                No photos available from Google Places.
            </div>
        )
    }

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <label className="text-[10px] font-medium uppercase tracking-wider text-t-tertiary">
                    Google Places Photos ({photos.length})
                </label>
                <div className="flex gap-2">
                    <button
                        onClick={selectAll}
                        disabled={isUploading}
                        className="text-[10px] font-medium text-primary hover:text-primary/80 transition-colors disabled:opacity-50"
                    >
                        Select All
                    </button>
                    <span className="text-t-quaternary">|</span>
                    <button
                        onClick={deselectAll}
                        disabled={isUploading}
                        className="text-[10px] font-medium text-t-tertiary hover:text-t-secondary transition-colors disabled:opacity-50"
                    >
                        Clear
                    </button>
                </div>
            </div>

            {/* Photo grid */}
            <div className="grid grid-cols-3 gap-2">
                {photos.map((photo, index) => {
                    const existing = isExisting(photo.reference)
                    const isSelected = selected.includes(photo.reference)

                    return (
                        <button
                            key={photo.reference || index}
                            onClick={() => !existing && !isUploading && togglePhoto(photo.reference)}
                            disabled={existing || isUploading}
                            className={cn(
                                "relative rounded-xl border transition-all aspect-square overflow-hidden",
                                existing
                                    ? "border-emerald-200 dark:border-emerald-800/40 cursor-default"
                                    : isSelected
                                        ? "border-primary/40 ring-2 ring-primary/20"
                                        : "border-border hover:border-primary/20"
                            )}
                        >
                            {/* Photo preview */}
                            {photo.previewUrl ? (
                                <img
                                    src={photo.previewUrl}
                                    alt={`Photo ${index + 1}`}
                                    className="w-full h-full object-cover"
                                    loading="lazy"
                                />
                            ) : (
                                <div className="w-full h-full bg-secondary flex flex-col items-center justify-center">
                                    <Image size={20} className="text-t-quaternary mb-1" />
                                    <span className="text-[9px] text-t-quaternary font-mono">
                                        {photo.width}×{photo.height}
                                    </span>
                                </div>
                            )}

                            {/* Overlay for selected/existing state */}
                            {(isSelected || existing) && (
                                <div className={cn(
                                    "absolute inset-0 flex items-center justify-center",
                                    existing ? "bg-emerald-600/30" : "bg-primary/20"
                                )}>
                                    {existing ? (
                                        <span className="px-2 py-1 bg-emerald-600 text-white text-[9px] font-bold uppercase rounded-md shadow">
                                            Uploaded
                                        </span>
                                    ) : (
                                        <CheckSquare size={24} className="text-white drop-shadow-lg" />
                                    )}
                                </div>
                            )}

                            {/* Photo number badge */}
                            <div className="absolute top-1.5 left-1.5 w-5 h-5 rounded-full bg-black/60 text-white text-[9px] font-bold flex items-center justify-center">
                                {index + 1}
                            </div>

                            {/* Selection checkbox */}
                            {!existing && (
                                <div className="absolute top-1.5 right-1.5">
                                    {isSelected ? (
                                        <CheckSquare size={16} className="text-primary drop-shadow" />
                                    ) : (
                                        <Square size={16} className="text-white/70 drop-shadow" />
                                    )}
                                </div>
                            )}
                        </button>
                    )
                })}
            </div>

            {/* Upload progress / Confirm button */}
            {isUploading ? (
                <div className="flex items-center justify-center gap-2 py-3 px-4 bg-primary/10 rounded-xl border border-primary/20">
                    <Loader2 size={14} className="animate-spin text-primary" />
                    <span className="text-xs font-medium text-primary">
                        Uploading photos to Cloudflare R2...
                    </span>
                </div>
            ) : (
                <button
                    onClick={handleConfirm}
                    disabled={selected.length === 0}
                    className={cn(
                        "w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-xs font-bold uppercase tracking-wider transition-all",
                        selected.length > 0
                            ? "bg-primary text-white hover:bg-primary/90 shadow-sm"
                            : "bg-secondary text-t-quaternary border border-border cursor-not-allowed"
                    )}
                >
                    <Upload size={14} />
                    Upload {selected.length} Photo{selected.length !== 1 ? 's' : ''} to R2
                </button>
            )}
        </div>
    )
}
