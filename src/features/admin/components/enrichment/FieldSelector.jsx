import React, { useEffect } from 'react'
import { CheckSquare, Square, CheckCircle } from 'lucide-react'
import { cn } from '@/lib/utils'

const FIELDS = [
    { key: 'title', label: 'Title' },
    { key: 'opening_hours', label: 'Opening Hours' },
    { key: 'address', label: 'Address' },
    { key: 'coordinates', label: 'Geo Coordinates' },
    { key: 'photos', label: 'Photos' },
]

const STORAGE_KEY = 'enrichment-fields'

/**
 * FieldSelector — Checkbox group for selecting which fields to enrich.
 * Supports "Select All" with bidirectional sync.
 * Persists selection to sessionStorage.
 */
export default function FieldSelector({ selectedFields, onChange }) {
    // Restore from sessionStorage on mount
    useEffect(() => {
        try {
            const stored = sessionStorage.getItem(STORAGE_KEY)
            if (stored) {
                const parsed = JSON.parse(stored)
                // Only restore if it's a valid object with expected keys
                const isValid = FIELDS.every(f => typeof parsed[f.key] === 'boolean')
                if (isValid) {
                    onChange(parsed)
                }
            }
        } catch {
            // Ignore parse errors
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    // Persist to sessionStorage on change
    useEffect(() => {
        if (selectedFields) {
            try {
                sessionStorage.setItem(STORAGE_KEY, JSON.stringify(selectedFields))
            } catch {
                // Ignore storage errors
            }
        }
    }, [selectedFields])

    const allSelected = FIELDS.every(f => selectedFields[f.key])
    const someSelected = FIELDS.some(f => selectedFields[f.key]) && !allSelected

    const handleSelectAll = () => {
        const newValue = !allSelected
        const updated = {}
        FIELDS.forEach(f => { updated[f.key] = newValue })
        onChange(updated)
    }

    const handleToggleField = (key) => {
        onChange({ ...selectedFields, [key]: !selectedFields[key] })
    }

    return (
        <div className="space-y-3">
            <label className="text-[10px] font-medium uppercase tracking-wider text-t-tertiary">
                Fields to Enrich
            </label>

            {/* Select All */}
            <button
                onClick={handleSelectAll}
                className={cn(
                    "w-full flex items-center gap-3 px-4 py-3 rounded-xl border transition-all text-left",
                    allSelected
                        ? "bg-primary/10 border-primary/30 text-primary"
                        : "bg-secondary border-border text-t-secondary hover:border-primary/20"
                )}
            >
                {allSelected ? (
                    <CheckSquare size={16} strokeWidth={2.5} />
                ) : someSelected ? (
                    <CheckSquare size={16} strokeWidth={2.5} className="opacity-50" />
                ) : (
                    <Square size={16} strokeWidth={2.5} />
                )}
                <span className="text-xs font-semibold">Select All</span>
            </button>

            {/* Individual fields */}
            <div className="space-y-1.5">
                {FIELDS.map(field => (
                    <button
                        key={field.key}
                        onClick={() => handleToggleField(field.key)}
                        className={cn(
                            "w-full flex items-center gap-3 px-4 py-2.5 rounded-xl border transition-all text-left",
                            selectedFields[field.key]
                                ? "bg-primary/5 border-primary/20 text-t-primary"
                                : "bg-card border-border text-t-tertiary hover:border-border hover:bg-secondary"
                        )}
                    >
                        {selectedFields[field.key] ? (
                            <CheckCircle size={14} className="text-primary" strokeWidth={2.5} />
                        ) : (
                            <Square size={14} strokeWidth={2} />
                        )}
                        <span className="text-xs font-medium">{field.label}</span>
                    </button>
                ))}
            </div>
        </div>
    )
}
