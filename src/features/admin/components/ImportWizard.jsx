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

    const parseFile = (file) => {
        setIsParsing(true)
        const reader = new FileReader()
        reader.onload = (e) => {
            const content = e.target.result
            // Simple CSV/JSON parser logic for demo
            setTimeout(() => {
                try {
                    if (file.name.endsWith('.json')) {
                        const data = JSON.parse(content)
                        setFullData(data)
                        setPreviewData(data.slice(0, 5))
                    } else {
                        // Quote-aware CSV parser
                        const lines = content.split('\n').filter(l => l.trim())
                        const headers = parseCSVLine(lines[0])
                        const allData = lines.slice(1).map(line => {
                            const values = parseCSVLine(line)
                            return headers.reduce((obj, header, i) => {
                                obj[header.trim()] = values[i]?.trim()
                                return obj
                            }, {})
                        })
                        setFullData(allData)
                        setPreviewData(allData.slice(0, 5))
                    }
                    setStep(2)
                } catch (err) {
                    alert('Error parsing file: ' + err.message)
                } finally {
                    setIsParsing(false)
                }
            }, 1000)
        }
        reader.readAsText(file)
    }

    const startImport = async () => {
        setIsImporting(true)
        setImportProgress(0)

        // Process items and write to Supabase
        const { supabase } = await import('@/shared/api/client')
        const processed = []

        for (let i = 0; i < fullData.length; i++) {
            const item = fullData[i]
            // Use utility to process all fields correctly
            const processedItem = processImportedRow(item)
            
            // Default values and safety checks
            // Default values and safety checks
            if (!processedItem.title && !processedItem.name) processedItem.title = 'Untitled'
            if (!processedItem.category) processedItem.category = 'restaurant'
            if (!processedItem.status) processedItem.status = 'pending'
            
            // If ID is not a valid UUID or is missing, remove it so DB generates a new one
            if (!processedItem.id || processedItem.id === 'NEW' || processedItem.id.length < 10) {
                delete processedItem.id
            }
            
            processed.push(processedItem)
            setImportProgress(Math.round(((i + 1) / fullData.length) * 70))
        }

        // Batch insert to Supabase
        if (supabase && processed.length > 0) {
            try {
                const BATCH = 20
                for (let b = 0; b < processed.length; b += BATCH) {
                    await supabase.from('locations').upsert(processed.slice(b, b + BATCH), { onConflict: 'id' })
                    setImportProgress(70 + Math.round(((b + BATCH) / processed.length) * 30))
                }
            } catch (err) {
                console.error('[ImportWizard] Supabase insert error:', err)
            }
        }

        // Also add to local store for immediate UI update
        processed.forEach(item => addLocation(item))

        setIsImporting(false)
        setStep(3)
        if (onImportComplete) onImportComplete()
    }

    if (!isOpen) return null

    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={onClose}
                className="absolute inset-0 bg-slate-950/40 backdrop-blur-md"
            />

            <motion.div
                initial={{ scale: 0.9, opacity: 0, y: 20 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.9, opacity: 0, y: 20 }}
                className="relative bg-white dark:bg-[hsl(220,20%,6%)] w-full max-w-2xl rounded-[32px] md:rounded-[48px] shadow-2xl overflow-hidden border border-slate-200 dark:border-white/[0.06]"
            >
                {/* Header */}
                <div className="p-6 md:p-8 border-b border-slate-100 dark:border-white/[0.06] flex justify-between items-center bg-slate-50/50 dark:bg-[hsl(220,20%,3%)]/20">
                    <div>
                        <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                            <Database className="w-5 h-5 text-indigo-500" />
                            Import Locations
                        </h2>
                        <p className="text-xs text-slate-500 dark:text-[hsl(220,10%,55%)] mt-1 uppercase tracking-widest font-bold">Step {step} of 3</p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-slate-100 dark:hover:bg-[hsl(220,20%,12%)] rounded-xl transition-colors text-slate-400">
                        <X size={20} />
                    </button>
                </div>

                {/* Content */}
                <div className="p-6 md:p-10">
                    <AnimatePresence mode="wait">
                        {step === 1 && (
                            <motion.div
                                key="step1"
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -20 }}
                                className="space-y-6"
                            >
                                <div
                                    onClick={() => fileInputRef.current?.click()}
                                    className="border-2 border-dashed border-slate-200 dark:border-white/[0.06] rounded-[32px] p-10 md:p-16 flex flex-col items-center justify-center gap-4 hover:border-indigo-500/50 hover:bg-slate-50 dark:hover:bg-[hsl(220,20%,12%)]/20 transition-all cursor-pointer group"
                                >
                                    <div className="w-16 h-16 bg-indigo-50 dark:bg-indigo-500/10 rounded-3xl flex items-center justify-center text-indigo-500 group-hover:scale-110 transition-transform">
                                        {isParsing ? <Loader2 className="w-8 h-8 animate-spin" /> : <Upload className="w-8 h-8" />}
                                    </div>
                                    <div className="text-center">
                                        <p className="font-bold text-slate-900 dark:text-white text-lg">Click or drag locations file</p>
                                        <p className="text-sm text-slate-500 dark:text-[hsl(220,10%,55%)] mt-1">Supports .csv and .json formats</p>
                                    </div>
                                    <input
                                        type="file"
                                        className="hidden"
                                        ref={fileInputRef}
                                        onChange={handleFileChange}
                                        accept=".csv,.json"
                                    />
                                </div>
                                <div className="flex justify-center gap-4">
                                    <Button 
                                        variant="outline" 
                                        className="rounded-full gap-2 text-xs uppercase tracking-widest font-bold h-12 px-6"
                                        onClick={downloadCSVTemplate}
                                    >
                                        <Download className="w-4 h-4" />
                                        Download Template
                                    </Button>
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
                                <div className="flex items-center justify-between mb-4">
                                    <div className="flex items-center gap-2">
                                        <FileText className="w-5 h-5 text-indigo-500" />
                                        <span className="font-bold text-slate-900 dark:text-white">{file?.name}</span>
                                        <Badge variant="secondary" className="bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 text-[10px] uppercase">{previewData.length}+ items detected</Badge>
                                    </div>
                                    <button onClick={() => setStep(1)} className="text-[10px] font-bold uppercase text-slate-400 hover:text-indigo-500 tracking-widest">Change File</button>
                                </div>

                                <div className="bg-slate-50 dark:bg-[hsl(220,20%,3%)]/50 rounded-2xl border border-slate-100 dark:border-white/[0.06] overflow-hidden">
                                    <div className="max-h-48 overflow-y-auto custom-scrollbar">
                                        <table className="w-full text-left text-[11px]">
                                            <thead className="bg-slate-100 dark:bg-[hsl(220,20%,9%)] sticky top-0">
                                                <tr>
                                                    {previewData[0] && Object.keys(previewData[0]).map(key => (
                                                        <th key={key} className="px-4 py-2 font-bold uppercase text-slate-500 dark:text-[hsl(220,10%,55%)] tracking-wider whitespace-nowrap">{key}</th>
                                                    ))}
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-200/50 dark:divide-slate-800/50">
                                                {previewData.map((row, i) => (
                                                    <tr key={i}>
                                                        {Object.values(row).map((val, j) => (
                                                            <td key={j} className="px-4 py-3 text-slate-600 dark:text-[hsl(220,10%,55%)] truncate max-w-[150px]">{val?.toString() || '—'}</td>
                                                        ))}
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>

                                <div className="p-6 bg-indigo-500/5 dark:bg-indigo-500/10 rounded-[24px] border border-indigo-500/10 flex items-center justify-between group cursor-pointer" onClick={() => setEnrichmentEnabled(!enrichmentEnabled)}>
                                    <div className="flex items-center gap-4">
                                        <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center transition-all", enrichmentEnabled ? "bg-indigo-500 text-white shadow-lg shadow-indigo-500/20" : "bg-slate-200 dark:bg-[hsl(220,20%,9%)] text-slate-400")}>
                                            <Sparkles className={cn("w-5 h-5", enrichmentEnabled && "animate-pulse")} />
                                        </div>
                                        <div>
                                            <p className="font-bold text-sm text-slate-900 dark:text-white">GastroAI Enrichment</p>
                                            <p className="text-xs text-slate-500 dark:text-[hsl(220,10%,55%)]">Auto-fill coordinates, ratings and opening hours</p>
                                        </div>
                                    </div>
                                    <div className={cn("w-12 h-6 rounded-full relative transition-colors duration-300", enrichmentEnabled ? "bg-indigo-500" : "bg-slate-200 dark:bg-[hsl(220,20%,9%)]")}>
                                        <div className={cn("absolute top-1 w-4 h-4 bg-white rounded-full transition-all duration-300", enrichmentEnabled ? "left-7" : "left-1")} />
                                    </div>
                                </div>

                                {isImporting && (
                                    <div className="w-full bg-slate-100 dark:bg-[hsl(220,20%,9%)] h-1.5 rounded-full overflow-hidden mt-6">
                                        <motion.div
                                            initial={{ width: 0 }}
                                            animate={{ width: `${importProgress}%` }}
                                            className="h-full bg-indigo-600"
                                        />
                                    </div>
                                )}

                                <Button
                                    disabled={isImporting}
                                    onClick={startImport}
                                    className="w-full bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-[20px] h-14 font-bold text-xs uppercase tracking-[0.2em] shadow-xl active:scale-95 transition-all mt-4"
                                >
                                    {isImporting ? (
                                        <div className="flex items-center gap-3">
                                            <Loader2 className="w-4 h-4 animate-spin" />
                                            Enriching Data ({importProgress}%)
                                        </div>
                                    ) : (
                                        <div className="flex items-center gap-3">
                                            <ArrowRight className="w-4 h-4" />
                                            Execute Import
                                        </div>
                                    )}
                                </Button>
                            </motion.div>
                        )}

                        {step === 3 && (
                            <motion.div
                                key="step3"
                                initial={{ opacity: 0, scale: 0.9 }}
                                animate={{ opacity: 1, scale: 1 }}
                                className="flex flex-col items-center py-10 space-y-6"
                            >
                                <div className="w-24 h-24 bg-green-50 dark:bg-green-500/10 rounded-[32px] flex items-center justify-center text-green-500">
                                    <CheckCircle2 size={48} />
                                </div>
                                <div className="text-center">
                                    <h3 className="text-2xl font-bold text-slate-900 dark:text-white leading-none">Import Success!</h3>
                                    <p className="text-slate-500 dark:text-[hsl(220,10%,55%)] mt-2 font-medium">{fullData.length} locations added to database.</p>
                                </div>
                                <Button
                                    onClick={onClose}
                                    className="px-10 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-full h-12 font-bold text-xs uppercase tracking-widest"
                                >
                                    Finish
                                </Button>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            </motion.div>
        </div>
    )
}

export default ImportWizard
