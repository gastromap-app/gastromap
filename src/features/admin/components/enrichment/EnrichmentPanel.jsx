import React, { useState, useCallback, useEffect } from 'react'
import { motion } from 'framer-motion'
import { X, Sparkles, Loader2, AlertTriangle, RefreshCw, Calendar, AlertCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useEnrichment } from '../../hooks/useEnrichment'
import FieldSelector from './FieldSelector'
import DiffView from './DiffView'
import PhotoPicker from './PhotoPicker'
import QuotaIndicator from './QuotaIndicator'

const DAILY_LIMIT = 1000

/**
 * EnrichmentPanel — Main orchestrator component for location enrichment.
 * Manages the enrichment workflow: field selection → fetch → diff review → apply.
 * Styled as a slide-over panel matching the existing LocationFormSlideOver pattern.
 */
export default function EnrichmentPanel({ location, onClose, onApplyChanges, queueInfo, onNext, onSkip }) {
    const {
        enrichmentState,
        diff,
        photos,
        error,
        quotaRemaining,
        fetchEnrichment,
        uploadPhotos,
        fetchQuotaStatus,
        reset,
    } = useEnrichment()

    const [selectedFields, setSelectedFields] = useState({
        title: true,
        opening_hours: true,
        address: true,
        coordinates: true,
        photos: true,
    })

    const [showLowQuotaConfirm, setShowLowQuotaConfirm] = useState(false)

    // Fetch quota status on mount
    useEffect(() => {
        fetchQuotaStatus()
    }, [fetchQuotaStatus])

    const hasFieldsSelected = Object.values(selectedFields).some(Boolean)
    const isLowQuota = quotaRemaining !== null && quotaRemaining < 50

    // Handle "Enrich" button click
    const handleEnrich = useCallback(() => {
        if (isLowQuota && !showLowQuotaConfirm) {
            setShowLowQuotaConfirm(true)
            return
        }
        setShowLowQuotaConfirm(false)
        fetchEnrichment(location.id, selectedFields)
    }, [isLowQuota, showLowQuotaConfirm, fetchEnrichment, location.id, selectedFields])

    // Handle "Apply" for a single field
    const handleApplyField = useCallback((fieldName) => {
        if (!diff || !diff[fieldName]) return
        onApplyChanges({ [fieldName]: diff[fieldName].google })
    }, [diff, onApplyChanges])

    // Handle "Cancel" (skip) for a single field — no-op, just visual
    const handleCancelField = useCallback(() => {
        // No action needed — the field is simply skipped
    }, [])

    // Handle "Apply All" — apply all non-matching google values
    const handleApplyAll = useCallback(() => {
        if (!diff) return
        const updates = {}
        Object.entries(diff).forEach(([field, data]) => {
            if (!data.match) {
                updates[field] = data.google
            }
        })
        if (Object.keys(updates).length > 0) {
            onApplyChanges(updates)
        }
    }, [diff, onApplyChanges])

    // Handle photo upload confirmation
    const handlePhotoConfirm = useCallback(async (photoRefs) => {
        const urls = await uploadPhotos(location.id, photoRefs)
        if (urls && urls.length > 0) {
            onApplyChanges({ uploadedPhotos: urls })
        }
    }, [uploadPhotos, location.id, onApplyChanges])

    // Handle retry after error
    const handleRetry = useCallback(() => {
        reset()
    }, [reset])

    // Format last_enriched_at date
    const lastEnrichedAt = location.last_enriched_at
        ? new Date(location.last_enriched_at).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        })
        : null

    // Check for CLOSED_PERMANENTLY status
    const isClosedPermanently = diff && Object.values(diff).some(
        d => d.google === 'CLOSED_PERMANENTLY'
    )
    const businessStatus = diff?.business_status?.google || null

    return (
        <>
            {/* Backdrop */}
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={onClose}
                className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-md"
            />

            {/* Panel */}
            <div className="fixed inset-y-0 right-0 z-[110] pointer-events-none flex">
                <motion.div
                    initial={{ x: '100%', opacity: 0 }}
                    animate={{ x: 0, opacity: 1 }}
                    exit={{ x: '100%', opacity: 0 }}
                    transition={{ type: 'spring', damping: 35, stiffness: 250 }}
                    className="ml-auto w-full max-w-lg bg-background pointer-events-auto flex flex-col overflow-hidden shadow-2xl border-l border-border"
                >
                    {/* Header */}
                    <div className="px-6 py-4 border-b border-border flex items-center gap-4 shrink-0 bg-background/80 backdrop-blur-xl">
                        <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
                            <Sparkles size={18} className="text-primary" strokeWidth={2} />
                        </div>
                        <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                                <h2 className="text-sm font-semibold text-t-primary truncate">
                                    Enrich: {location.title || 'Untitled'}
                                </h2>
                                {queueInfo && (
                                    <span className="text-[10px] font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-full shrink-0">
                                        {queueInfo.current}/{queueInfo.total}
                                    </span>
                                )}
                            </div>
                            <div className="flex items-center gap-3 mt-1">
                                <QuotaIndicator
                                    quotaRemaining={quotaRemaining}
                                    dailyLimit={DAILY_LIMIT}
                                />
                                {lastEnrichedAt && (
                                    <span className="inline-flex items-center gap-1 text-[10px] text-t-quaternary">
                                        <Calendar size={10} />
                                        {lastEnrichedAt}
                                    </span>
                                )}
                            </div>
                        </div>
                        <button
                            onClick={onClose}
                            className="w-9 h-9 flex items-center justify-center rounded-full bg-secondary/40 text-t-secondary hover:text-t-primary hover:bg-secondary/60 transition-all border border-border"
                        >
                            <X size={16} />
                        </button>
                    </div>

                    {/* Content */}
                    <div className="flex-1 overflow-y-auto p-6 space-y-6">
                        {/* Business Status Warning */}
                        {(businessStatus === 'CLOSED_PERMANENTLY' || isClosedPermanently) && (
                            <div className="flex items-start gap-3 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/40 rounded-xl">
                                <AlertCircle size={16} className="text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
                                <div>
                                    <p className="text-xs font-semibold text-red-700 dark:text-red-400">
                                        Permanently Closed
                                    </p>
                                    <p className="text-[11px] text-red-600/80 dark:text-red-400/70 mt-0.5">
                                        Google reports this location as permanently closed. Consider updating its status.
                                    </p>
                                </div>
                            </div>
                        )}

                        {/* Idle State: Field Selection + Enrich Button */}
                        {enrichmentState === 'idle' && (
                            <>
                                <FieldSelector
                                    selectedFields={selectedFields}
                                    onChange={setSelectedFields}
                                />

                                {/* Low Quota Confirmation */}
                                {showLowQuotaConfirm && (
                                    <div className="flex items-start gap-3 p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/40 rounded-xl">
                                        <AlertTriangle size={16} className="text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                                        <div className="flex-1">
                                            <p className="text-xs font-semibold text-amber-700 dark:text-amber-400">
                                                Low API Quota
                                            </p>
                                            <p className="text-[11px] text-amber-600/80 dark:text-amber-400/70 mt-0.5">
                                                Only {quotaRemaining} calls remaining today. Continue?
                                            </p>
                                            <div className="flex gap-2 mt-3">
                                                <button
                                                    onClick={handleEnrich}
                                                    className="px-3 py-1.5 bg-amber-600 text-white text-[10px] font-bold uppercase tracking-wider rounded-lg hover:bg-amber-700 transition-colors"
                                                >
                                                    Continue
                                                </button>
                                                <button
                                                    onClick={() => setShowLowQuotaConfirm(false)}
                                                    className="px-3 py-1.5 bg-secondary text-t-tertiary text-[10px] font-bold uppercase tracking-wider rounded-lg border border-border hover:bg-secondary/80 transition-colors"
                                                >
                                                    Cancel
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* Enrich Button */}
                                <button
                                    onClick={handleEnrich}
                                    disabled={!hasFieldsSelected}
                                    className={cn(
                                        "w-full flex items-center justify-center gap-2 py-3.5 px-4 rounded-xl text-sm font-bold uppercase tracking-wider transition-all",
                                        hasFieldsSelected
                                            ? "bg-primary text-white hover:bg-primary/90 shadow-md shadow-primary/20"
                                            : "bg-secondary text-t-quaternary border border-border cursor-not-allowed"
                                    )}
                                >
                                    <Sparkles size={16} />
                                    Enrich Location
                                </button>
                            </>
                        )}

                        {/* Loading State */}
                        {enrichmentState === 'loading' && (
                            <div className="flex flex-col items-center justify-center py-16 gap-4">
                                <Loader2 size={32} className="animate-spin text-primary" />
                                <p className="text-sm text-t-tertiary font-medium">
                                    Fetching data from Google Places...
                                </p>
                                <p className="text-[11px] text-t-quaternary">
                                    This may take a few seconds
                                </p>
                            </div>
                        )}

                        {/* Reviewing State: Diff + Photos */}
                        {enrichmentState === 'reviewing' && (
                            <>
                                <DiffView
                                    diff={diff}
                                    onApplyField={handleApplyField}
                                    onCancelField={handleCancelField}
                                    onApplyAll={handleApplyAll}
                                />

                                {photos && photos.length > 0 && (
                                    <div className="pt-4 border-t border-border">
                                        <PhotoPicker
                                            photos={photos}
                                            existingPhotos={[
                                                location.image_url,
                                                ...(location.google_photos || []),
                                            ].filter(Boolean)}
                                            onConfirmSelection={handlePhotoConfirm}
                                            isUploading={false}
                                        />
                                    </div>
                                )}

                                {/* Back to field selection */}
                                <button
                                    onClick={reset}
                                    className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-xs font-medium text-t-tertiary bg-secondary border border-border hover:bg-secondary/80 transition-colors"
                                >
                                    <RefreshCw size={12} />
                                    Start Over
                                </button>

                                {/* Queue navigation buttons */}
                                {onNext && (
                                    <div className="flex gap-2 pt-4 border-t border-border">
                                        <button
                                            onClick={onSkip}
                                            className="flex-1 py-3 rounded-xl text-xs font-bold text-t-tertiary bg-secondary border border-border hover:bg-secondary/80 transition-colors"
                                        >
                                            Skip
                                        </button>
                                        <button
                                            onClick={onNext}
                                            className="flex-1 py-3 rounded-xl text-xs font-bold text-white bg-primary hover:bg-primary/90 transition-colors shadow-sm"
                                        >
                                            Next →
                                        </button>
                                    </div>
                                )}
                            </>
                        )}

                        {/* Uploading State */}
                        {enrichmentState === 'uploading' && (
                            <div className="flex flex-col items-center justify-center py-16 gap-4">
                                <Loader2 size={32} className="animate-spin text-primary" />
                                <p className="text-sm text-t-tertiary font-medium">
                                    Uploading photos to storage...
                                </p>
                            </div>
                        )}

                        {/* Error State */}
                        {enrichmentState === 'error' && (
                            <div className="flex flex-col items-center justify-center py-12 gap-4">
                                <div className="w-12 h-12 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                                    <AlertTriangle size={20} className="text-red-600 dark:text-red-400" />
                                </div>
                                <div className="text-center">
                                    <p className="text-sm font-semibold text-t-primary">
                                        Enrichment Failed
                                    </p>
                                    <p className="text-xs text-t-tertiary mt-1 max-w-xs">
                                        {error || 'An unexpected error occurred. Please try again.'}
                                    </p>
                                </div>
                                <button
                                    onClick={handleRetry}
                                    className="flex items-center gap-2 px-4 py-2 bg-primary text-white text-xs font-bold uppercase tracking-wider rounded-lg hover:bg-primary/90 transition-colors"
                                >
                                    <RefreshCw size={12} />
                                    Retry
                                </button>
                            </div>
                        )}
                    </div>
                </motion.div>
            </div>
        </>
    )
}
