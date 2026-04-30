import React, { useState, useRef } from 'react'
import {
    ArrowRight, Sparkles, Loader2, Database, Download, FileSpreadsheet
} from 'lucide-react'
import { downloadCSVTemplate, processImportedRow } from '@/shared/utils/importExportUtils'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useLocationsStore } from '@/shared/store/useLocationsStore'

const ImportWizard = ({ isOpen, onClose, onImportComplete }) => {
    const [step, setStep] = useState(1)
    const [file, setFile] = useState(null)
    const [previewData, setPreviewData] = useState([])
    const [fullData, setFullData] = useState([])
    const [isParsing, setIsParsing] = useState(false)
    const [isImporting, setIsImporting] = useState(false)
    const [enrichmentEnabled, setEnrichmentEnabled] = useState(true)
    const [importProgress, setImportProgress] = useState(0)
    const fileInputRef = useRef(null)
    const addLocation = useLocationsStore(state => state.addLocation)

    const handleFileChange = (e) => {
        const selectedFile = e.target.files[0]
        if (selectedFile) {
            setFile(selectedFile)
            parseFile(selectedFile)
        }
    }

    // Quote-aware CSV field splitter
    const parseCSVLine = (line) => {
        const fields = []
        let current = ''
        let inQuotes = false
        for (let i = 0; i < line.length; i++) {
            const ch = line[i]
            if (ch === '"') {
                if (inQuotes && line[i + 1] === '"') {
                    current += '"'
                    i++ // skip escaped quote
                } else {
                    inQuotes = !inQuotes
                }
            } else if (ch === ',' && !inQuotes) {
                fields.push(current.trim())
                current = ''
            } else {
                current += ch
            }
        }
        fields.push(current.trim())
        return fields
    }

    const parseFile = (selectedFile) => {
        setIsParsing(true)
        const reader = new FileReader()
        reader.onload = (e) => {
            const content = e.target.result
            const lines = content.split('\n')
            if (lines.length < 2) {
                setIsParsing(false)
                return
            }

            const headers = parseCSVLine(lines[0])
            const rows = lines.slice(1).filter(line => line.trim()).map(line => {
                const values = parseCSVLine(line)
                const row = {}
                headers.forEach((header, index) => {
                    if (header) {
                        row[header.toLowerCase().replace(/ /g, '_')] = values[index] || ''
                    }
                })
                return row
            })

            setFullData(rows)
            setPreviewData(rows.slice(0, 5))
            setIsParsing(false)
            setStep(2)
        }
        reader.readAsText(selectedFile)
    }

    const handleImport = async () => {
        setIsImporting(true)
        let successCount = 0

        for (let i = 0; i < fullData.length; i++) {
            try {
                const row = fullData[i]
                const locationData = processImportedRow(row)
                
                await addLocation(locationData)
                successCount++
                setImportProgress(Math.round(((i + 1) / fullData.length) * 100))
            } catch (err) {
                console.error('Import error for row', i, err)
            }
        }

        setIsImporting(false)
        if (onImportComplete) onImportComplete(successCount)
        onClose()
    }

    if (!isOpen) return null

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6">
            <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={onClose}
                className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            
            <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                className="relative w-full max-w-4xl bg-white dark:bg-gray-900 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
            >
                {/* Header */}
                <div className="p-6 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between bg-gray-50/50 dark:bg-gray-800/50">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center text-white shadow-lg shadow-blue-500/20">
                            <Database className="w-5 h-5" />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-gray-900 dark:text-white">Import Locations</h2>
                            <p className="text-sm text-gray-500 dark:text-gray-400">Step {step} of 3</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl transition-colors">
                        <ArrowRight className="w-5 h-5 rotate-45" />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6">
                    <AnimatePresence mode="wait">
                        {step === 1 && (
                            <motion.div
                                key="step1"
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -20 }}
                                className="space-y-6"
                            >
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="p-6 rounded-3xl border-2 border-dashed border-gray-200 dark:border-gray-700 hover:border-blue-500 dark:hover:border-blue-400 transition-colors flex flex-col items-center justify-center text-center space-y-4 bg-gray-50/30 dark:bg-gray-800/30">
                                        <div className="w-16 h-16 rounded-2xl bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center text-blue-600">
                                            <FileSpreadsheet className="w-8 h-8" />
                                        </div>
                                        <div>
                                            <h3 className="font-bold text-gray-900 dark:text-white">Upload CSV File</h3>
                                            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Select your locations database file</p>
                                        </div>
                                        <input 
                                            type="file" 
                                            ref={fileInputRef}
                                            onChange={handleFileChange}
                                            accept=".csv"
                                            className="hidden"
                                        />
                                        <Button 
                                            onClick={() => fileInputRef.current?.click()}
                                            disabled={isParsing}
                                            className="rounded-xl"
                                        >
                                            {isParsing ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                                            Choose File
                                        </Button>
                                    </div>

                                    <div className="p-6 rounded-3xl bg-blue-50/50 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-900/30 space-y-4">
                                        <div className="flex items-center gap-3 text-blue-600">
                                            <Download className="w-5 h-5" />
                                            <h3 className="font-bold">Template</h3>
                                        </div>
                                        <p className="text-sm text-blue-700/70 dark:text-blue-300/70 leading-relaxed">
                                            Download our unified template to ensure all fields are correctly mapped to the database.
                                        </p>
                                        <Button 
                                            variant="outline" 
                                            onClick={downloadCSVTemplate}
                                            className="w-full rounded-xl border-blue-200 dark:border-blue-800 bg-white dark:bg-gray-900 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20"
                                        >
                                            Download CSV Template
                                        </Button>
                                    </div>
                                </div>

                                <div className="bg-amber-50 dark:bg-amber-900/10 border border-amber-100 dark:border-amber-900/30 p-4 rounded-2xl">
                                    <div className="flex gap-3">
                                        <div className="text-amber-600">⚠️</div>
                                        <div className="text-sm text-amber-800 dark:text-amber-200">
                                            <p className="font-bold mb-1">Required Format:</p>
                                            <ul className="list-disc list-inside space-y-1 opacity-80">
                                                <li>First row must contain headers</li>
                                                <li>Required: name, category, address, lat, lng</li>
                                                <li>Optional: rating, phone, website, description</li>
                                            </ul>
                                        </div>
                                    </div>
                                </div>
                            </motion.div>
                        )}

                        {step === 2 && (
                            <motion.div
                                key="step2"
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -20 }}
                                className="space-y-6"
                            >
                                <div className="flex items-center justify-between">
                                    <h3 className="font-bold text-gray-900 dark:text-white">Data Preview ({fullData.length} locations)</h3>
                                    <Badge variant="outline" className="rounded-lg">Top 5 rows shown</Badge>
                                </div>

                                <div className="overflow-hidden rounded-2xl border border-gray-100 dark:border-gray-800">
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-left text-sm">
                                            <thead className="bg-gray-50 dark:bg-gray-800/50 text-gray-500 dark:text-gray-400 font-medium">
                                                <tr>
                                                    <th className="px-4 py-3">Name</th>
                                                    <th className="px-4 py-3">Category</th>
                                                    <th className="px-4 py-3">Address</th>
                                                    <th className="px-4 py-3">Lat/Lng</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                                                {previewData.map((row, i) => (
                                                    <tr key={i} className="text-gray-700 dark:text-gray-300">
                                                        <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">{row.name}</td>
                                                        <td className="px-4 py-3">{row.category}</td>
                                                        <td className="px-4 py-3 truncate max-w-[200px]">{row.address}</td>
                                                        <td className="px-4 py-3 text-gray-400">{row.lat}, {row.lng}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>

                                <div className="p-4 rounded-2xl bg-blue-50 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-900/30 flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className="p-2 rounded-lg bg-blue-600 text-white">
                                            <Sparkles className="w-4 h-4" />
                                        </div>
                                        <div>
                                            <p className="font-bold text-blue-900 dark:text-blue-100">AI Enrichment</p>
                                            <p className="text-xs text-blue-700/70 dark:text-blue-300/70">Automatically generate descriptions and tags</p>
                                        </div>
                                    </div>
                                    <div 
                                        onClick={() => setEnrichmentEnabled(!enrichmentEnabled)}
                                        className={cn(
                                            "w-12 h-6 rounded-full transition-colors relative cursor-pointer",
                                            enrichmentEnabled ? "bg-blue-600" : "bg-gray-300 dark:bg-gray-700"
                                        )}
                                    >
                                        <div className={cn(
                                            "absolute top-1 w-4 h-4 bg-white rounded-full transition-all",
                                            enrichmentEnabled ? "left-7" : "left-1"
                                        )} />
                                    </div>
                                </div>

                                <div className="flex gap-3">
                                    <Button variant="outline" onClick={() => setStep(1)} className="rounded-xl flex-1">Back</Button>
                                    <Button onClick={() => setStep(3)} className="rounded-xl flex-1">Continue</Button>
                                </div>
                            </motion.div>
                        )}

                        {step === 3 && (
                            <motion.div
                                key="step3"
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -20 }}
                                className="text-center py-12 space-y-6"
                            >
                                {!isImporting ? (
                                    <>
                                        <div className="w-20 h-20 rounded-3xl bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center text-blue-600 mx-auto">
                                            <Database className="w-10 h-10" />
                                        </div>
                                        <div>
                                            <h3 className="text-2xl font-bold text-gray-900 dark:text-white">Ready to Import</h3>
                                            <p className="text-gray-500 dark:text-gray-400 mt-2">
                                                We are about to import {fullData.length} locations to your database.
                                                {enrichmentEnabled && " AI enrichment is enabled."}
                                            </p>
                                        </div>
                                        <div className="flex gap-3 max-w-sm mx-auto">
                                            <Button variant="outline" onClick={() => setStep(2)} className="rounded-xl flex-1">Back</Button>
                                            <Button onClick={handleImport} className="rounded-xl flex-1">Start Import</Button>
                                        </div>
                                    </>
                                ) : (
                                    <div className="space-y-6">
                                        <div className="relative w-32 h-32 mx-auto">
                                            <svg className="w-full h-full transform -rotate-90">
                                                <circle
                                                    cx="64" cy="64" r="60"
                                                    stroke="currentColor"
                                                    strokeWidth="8"
                                                    fill="transparent"
                                                    className="text-gray-100 dark:text-gray-800"
                                                />
                                                <circle
                                                    cx="64" cy="64" r="60"
                                                    stroke="currentColor"
                                                    strokeWidth="8"
                                                    fill="transparent"
                                                    strokeDasharray={377}
                                                    strokeDashoffset={377 - (377 * importProgress) / 100}
                                                    className="text-blue-600 transition-all duration-300"
                                                    strokeLinecap="round"
                                                />
                                            </svg>
                                            <div className="absolute inset-0 flex items-center justify-center">
                                                <span className="text-2xl font-black text-gray-900 dark:text-white">{importProgress}%</span>
                                            </div>
                                        </div>
                                        <div>
                                            <h3 className="text-xl font-bold text-gray-900 dark:text-white">Importing Data...</h3>
                                            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Please do not close this window</p>
                                        </div>
                                        <div className="max-w-xs mx-auto">
                                            <div className="h-1.5 w-full bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                                                <motion.div 
                                                    className="h-full bg-blue-600"
                                                    animate={{ width: `${importProgress}%` }}
                                                />
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            </motion.div>
        </div>
    )
}

export default ImportWizard
