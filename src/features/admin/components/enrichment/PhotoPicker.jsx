import React, { useState } from 'react'
import { CheckSquare, Square, Image, Upload, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * PhotoPicker — Grid for selecting Google Places photos to upload.
 * Shows numbered thumbnails with dimensions (actual previews require API key,
 * so we display metadata and selection controls).
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
        // Check if this photo reference is already in existing photos
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
                                "relative flex flex-col items-center justify-center p-3 rounded-xl border transition-all aspect-square",
                                existing
                                    ? "bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800/40 cursor-default"
                                    : isSelected
                                        ? "bg-primary/10 border-primary/40 ring-2 ring-primary/20"
                                        : "bg-secondary border-border hover:border-primary/20 hover:bg-secondary/80"
                            )}
                        >
                            {/* Photo number */}
                            <div className={cn(
                                "w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold mb-1.5",
                                existing
                                    ? "bg-emerald-200 dark:bg-emerald-800 text-emerald-700 dark:text-emerald-300"
                                    : isSelected
                                        ? "bg-primary text-white"
                                        : "bg-card border border-border text-t-tertiary"
                            )}>
                                {index + 1}
                            </div>

                            {/* Dimensions */}
                            <span className="text-[9px] text-t-quaternary font-mono">
                                {photo.width}×{photo.height}
                            </span>

                            {/* Selection indicator */}
                            <div className="absolute top-2 right-2">
                                {existing ? (
                                    <span className="px-1.5 py-0.5 bg-emerald-600 text-white text-[8px] font-bold uppercase rounded">
                                        Uploaded
                                    </span>
                                ) : isSelected ? (
                                    <CheckSquare size={14} className="text-primary" />
                                ) : (
                                    <Square size={14} className="text-t-quaternary" />
                                )}
                            </div>
                        </button>
                    )
                })}
            </div>

            {/* Upload progress / Confirm button */}
            {isUploading ? (
                <div className="flex items-center justify-center gap-2 py-3 px-4 bg-primary/10 rounded-xl border border-primary/20">
                    <Loader2 size={14} className="animate-spin text-primary" />
                    <span className="text-xs font-medium text-primary">
                        Uploading photos...
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
                    Upload {selected.length} Photo{selected.length !== 1 ? 's' : ''}
                </button>
            )}
        </div>
    )
}
