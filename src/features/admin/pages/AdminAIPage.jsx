import React, { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
    Bot, MessageSquare, Zap, Shield, Settings,
    Save, Play, Pause, RefreshCw, Sliders, Brain,
    CheckCircle2, ChevronDown, ChevronUp, Send,
    Loader2, AlertCircle, Eye, EyeOff, Star, Globe, Cpu,
    FileText, RotateCcw, Search, Key, X,
    Database, GitBranch, Thermometer, Hash, ArrowUp, ArrowDown,
    ToggleLeft, ToggleRight, Copy, Code, Clock, Wrench, Activity,
    Layers, UserCheck
} from 'lucide-react'
import { cn } from '@/lib/utils'
import AdminPageHeader, { adminBtnPrimary } from '../components/AdminPageHeader'
import { useAppConfigStore } from '@/shared/store/useAppConfigStore'
import { DEFAULT_PROMPTS, MODEL_CASCADE, PAID_MODELS, TOOLS } from '@/shared/api/ai/constants'
import { testAIConnection } from '@/shared/api/ai/utils'
import { DEFAULT_KG_SYSTEM_PROMPT } from '@/shared/api/kg-ai-agent.api'

// ─── Available OpenRouter free models (April 2026) ──────────────────────────
// Ordered by reliability/availability - models less likely to be rate-limited first

const FREE_MODELS = [
    // ── TOP TIER — Best quality & reliability ──────────────────────────────
    {
        id: 'nvidia/nemotron-3-super-120b-a12b:free',
        name: 'Nemotron 3 Super 120B',
        provider: 'NVIDIA',
        context: '262K',
        languages: 'EN / multilingual',
        badge: '🧠 Best RAG',
        badgeColor: 'bg-green-100 dark:bg-green-500/20 text-green-700 dark:text-green-400',
        description: 'NVIDIA 120B model. 262K context, best for RAG and agentic tasks.',
        toolUse: true,
    },
    {
        id: 'openai/gpt-oss-120b:free',
        name: 'GPT-OSS 120B',
        provider: 'OpenAI',
        context: '131K',
        languages: 'EN / multilingual',
        badge: '⚠️ Unstable',
        badgeColor: 'bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-400',
        description: 'OpenAI largest open-weight model. Note: Can be unreliable on OpenRouter free tier.',
        toolUse: true,
    },
    {
        id: 'meta-llama/llama-3.3-70b-instruct:free',
        name: 'Llama 3.3 70B',
        provider: 'Meta',
        context: '65K',
        languages: 'EN / RU / PL / multilingual',
        badge: '⚠️ Deprecated',
        badgeColor: 'bg-rose-100 dark:bg-rose-500/20 text-rose-600 dark:text-rose-400',
        description: 'May no longer be available on free tier. Use Nemotron or Owl Alpha instead.',
        toolUse: true,
    },
    {
        id: 'openrouter/owl-alpha',
        name: 'Owl Alpha',
        provider: 'OpenRouter',
        context: '1M',
        languages: 'EN / multilingual',
        badge: '🦉 Agentic',
        badgeColor: 'bg-purple-100 dark:bg-purple-500/20 text-purple-600 dark:text-purple-400',
        description: '1M context. Built for agentic workloads, tool use, and long-context tasks.',
        toolUse: true,
    },
    {
        id: 'google/gemma-4-31b-it:free',
        name: 'Gemma 4 31B',
        provider: 'Google',
        context: '262K',
        languages: 'EN / RU / PL / UA / 140+',
        badge: '🆕 New Best',
        badgeColor: 'bg-indigo-100 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400',
        description: 'Latest Google model. 262K context, excellent reasoning, 140+ languages.',
        toolUse: true,
    },
    {
        id: 'google/gemma-4-26b-a4b-it:free',
        name: 'Gemma 4 26B',
        provider: 'Google',
        context: '262K',
        languages: 'EN / RU / PL / UA / 140+',
        badge: '⚡ Fast & Smart',
        badgeColor: 'bg-sky-100 dark:bg-sky-500/20 text-sky-600 dark:text-sky-400',
        description: 'Newest Gemma variant with A4B architecture. Optimised for performance.',
        toolUse: true,
    },
    {
        id: 'google/gemma-3-27b-it:free',
        name: 'Gemma 3 27B',
        provider: 'Google',
        context: '131K',
        languages: 'EN / RU / PL / UA / 140+',
        badge: '👁 Vision',
        badgeColor: 'bg-sky-100 dark:bg-sky-500/20 text-sky-600 dark:text-sky-400',
        description: 'Reliable Google model. Multimodal vision support, 140+ languages.',
        toolUse: true,
    },
    // ── SPEED TIER — Low latency ────────────────────────────────────────────
    {
        id: 'stepfun/step-3.5-flash:free',
        name: 'Step 3.5 Flash',
        provider: 'StepFun',
        context: '256K',
        languages: 'EN / RU / PL / UA / multilingual',
        badge: '⚡ Fastest',
        badgeColor: 'bg-orange-100 dark:bg-orange-500/20 text-orange-600 dark:text-orange-400',
        description: 'Fastest free model. Low latency, 256K context. Best for real-time chat.',
        toolUse: true,
    },
    {
        id: 'nvidia/nemotron-nano-9b-v2:free',
        name: 'Nemotron Nano 9B v2',
        provider: 'NVIDIA',
        context: '128K',
        languages: 'EN / multilingual',
        badge: 'High Availability',
        badgeColor: 'bg-lime-100 dark:bg-lime-500/20 text-lime-700 dark:text-lime-400',
        description: 'Compact but capable. High availability, rarely rate-limited.',
        toolUse: true,
    },
    {
        id: 'openai/gpt-oss-20b:free',
        name: 'GPT-OSS 20B',
        provider: 'OpenAI',
        context: '131K',
        languages: 'EN / multilingual',
        badge: 'Apache 2.0',
        badgeColor: 'bg-yellow-100 dark:bg-yellow-500/20 text-yellow-600 dark:text-yellow-400',
        description: 'OpenAI open-weight compact model. Strong function calling.',
        toolUse: true,
    },
    // ── LARGE CONTEXT TIER ──────────────────────────────────────────────────
    {
        id: 'arcee-ai/trinity-large-preview:free',
        name: 'Trinity Large',
        provider: 'Arcee AI',
        context: '131K',
        languages: 'EN / multilingual',
        badge: '✅ Stable',
        badgeColor: 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400',
        description: 'Arcee Trinity Large — stable and reliable for structured tasks.',
        toolUse: true,
    },
    {
        id: 'qwen/qwen3-next-80b-a3b-instruct:free',
        name: 'Qwen3 Next 80B',
        provider: 'Alibaba',
        context: '262K',
        languages: '100+ incl. RU / PL / UA',
        badge: 'New',
        badgeColor: 'bg-blue-100 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400',
        description: 'Next-gen Qwen3 with MoE architecture. 262K context, fast inference.',
        toolUse: true,
    },
    {
        id: 'qwen/qwen3-coder:free',
        name: 'Qwen3 Coder 480B',
        provider: 'Alibaba',
        context: '262K',
        languages: '100+ incl. RU / PL / UA',
        badge: 'Best Coding',
        badgeColor: 'bg-blue-100 dark:bg-blue-500/20 text-blue-700 dark:text-blue-400',
        description: '480B MoE model. State-of-the-art coding. Also great for structured JSON.',
        toolUse: true,
    },
    {
        id: 'minimax/minimax-m2.5:free',
        name: 'MiniMax M2.5',
        provider: 'MiniMax',
        context: '196K',
        languages: 'EN / multilingual',
        badge: 'Large Context',
        badgeColor: 'bg-teal-100 dark:bg-teal-500/20 text-teal-600 dark:text-teal-400',
        description: '196K context for long conversations and document analysis.',
        toolUse: true,
    },
    {
        id: 'z-ai/glm-4.5-air:free',
        name: 'GLM-4.5-Air',
        provider: 'Z.AI',
        context: '131K',
        languages: 'EN / RU / PL / ZH',
        badge: 'Multilingual',
        badgeColor: 'bg-blue-100 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400',
        description: 'Fast hybrid thinking mode. Good for multilingual tasks. 131K context.',
        toolUse: true,
    },
    {
        id: 'nousresearch/hermes-3-llama-3.1-405b:free',
        name: 'Hermes 3 405B',
        provider: 'Nous Research',
        context: '131K',
        languages: 'EN / multilingual',
        badge: 'Largest Free',
        badgeColor: 'bg-indigo-100 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400',
        description: 'Llama 3.1 405B fine-tune. Excellent reasoning and tool use. 131K context.',
        toolUse: true,
    },
    {
        id: 'nvidia/nemotron-3-nano-30b-a3b:free',
        name: 'Nemotron Nano 30B',
        provider: 'NVIDIA',
        context: '256K',
        languages: 'EN / multilingual',
        badge: '🪶 Lightweight',
        badgeColor: 'bg-lime-100 dark:bg-lime-500/20 text-lime-700 dark:text-lime-400',
        description: 'Efficient 30B MoE (3B active). 256K context, high availability.',
        toolUse: true,
    },
    {
        id: 'inclusionai/ring-2.6-1t:free',
        name: 'Ring 2.6 1T',
        provider: 'InclusionAI',
        context: '262K',
        languages: 'EN / multilingual',
        badge: '🧠 Thinking',
        badgeColor: 'bg-violet-100 dark:bg-violet-500/20 text-violet-600 dark:text-violet-400',
        description: '1T params (63B active). Adaptive reasoning, great for complex agent tasks.',
        toolUse: true,
    },
    {
        id: 'poolside/laguna-m.1:free',
        name: 'Laguna M.1',
        provider: 'Poolside',
        context: '131K',
        languages: 'EN',
        badge: '💻 Coding',
        badgeColor: 'bg-cyan-100 dark:bg-cyan-500/20 text-cyan-600 dark:text-cyan-400',
        description: 'Flagship coding agent model. Tool calling, reasoning, 128K context.',
        toolUse: true,
    },
    // ── PAID TIER — Higher quality, faster, more stable ─────────────────────
    {
        id: 'google/gemini-2.5-flash-lite',
        name: 'Gemini 2.5 Flash Lite',
        provider: 'Google',
        context: '1M',
        languages: 'EN / RU / PL / UA / multilingual',
        badge: '💰 $0.05/$0.30',
        badgeColor: 'bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-400',
        description: 'Cheapest paid model. Ultra-fast, 1M context. ~$0.40/month at 100 req/day.',
        toolUse: true,
    },
    {
        id: 'google/gemini-3.1-flash-lite',
        name: 'Gemini 3.1 Flash Lite',
        provider: 'Google',
        context: '1M',
        languages: 'EN / RU / PL / UA / multilingual',
        badge: '💰 $0.25/$1.50',
        badgeColor: 'bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-400',
        description: 'Newest Google model. Best quality/speed ratio. ~$2/month at 100 req/day.',
        toolUse: true,
    },
    {
        id: 'deepseek/deepseek-chat',
        name: 'DeepSeek V3.2 Chat',
        provider: 'DeepSeek',
        context: '128K',
        languages: 'EN / RU / PL / multilingual',
        badge: '💰 $0.32/$0.89',
        badgeColor: 'bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-400',
        description: 'Best reasoning for price. 685B MoE model. ~$1.60/month at 100 req/day.',
        toolUse: true,
    },
]

// ─── Model card ──────────────────────────────────────────────────────────────

const ModelCard = ({ model, selected, onSelect, disabled }) => (
    <button
        onClick={() => !disabled && onSelect(model.id)}
        aria-label={`Select ${model.name}`}
        className={cn(
            'w-full text-left p-3 sm:p-4 rounded-2xl border transition-all duration-200',
            selected
                ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-500/10 shadow-md shadow-indigo-500/10'
                : 'border-slate-200 dark:border-white/[0.08] bg-white dark:bg-[hsl(220,20%,9%)]/50 hover:border-slate-300 dark:hover:border-slate-600',
            disabled && 'opacity-50 cursor-not-allowed'
        )}
    >
        <div className="flex items-start justify-between gap-2 mb-2">
            <div className="flex items-center gap-2 min-w-0 flex-1">
                <div className={cn(
                    'w-4 h-4 rounded-full border-2 flex-shrink-0 transition-all',
                    selected ? 'border-indigo-500 bg-indigo-500' : 'border-slate-300 dark:border-white/[0.08]'
                )}>
                    {selected && <div className="w-1.5 h-1.5 bg-white rounded-full m-auto mt-[1px]" />}
                </div>
                <span className="font-bold text-xs sm:text-sm text-slate-900 dark:text-white truncate">{model.name}</span>
            </div>
            <span className={cn('text-[8px] sm:text-[9px] font-black uppercase tracking-wider px-1.5 sm:px-2 py-0.5 rounded-full flex-shrink-0', model.badgeColor)}>
                {model.badge}
            </span>
        </div>
        <p className="text-[11px] sm:text-xs text-slate-500 dark:text-[hsl(220,10%,55%)] leading-relaxed mb-2 sm:mb-3 pl-6 line-clamp-2">{model.description}</p>
        <div className="flex flex-wrap gap-2 sm:gap-3 pl-6">
            <span className="flex items-center gap-1 text-[9px] sm:text-[10px] text-slate-400">
                <Cpu size={10} /> {model.context}
            </span>
            <span className="flex items-center gap-1 text-[9px] sm:text-[10px] text-slate-400">
                <Globe size={10} /> {model.languages}
            </span>
            {model.toolUse && (
                <span className="text-[10px] text-emerald-500 font-bold">✓ Tool Use</span>
            )}
        </div>
    </button>
)

// ─── Agent card ───────────────────────────────────────────────────────────────

const AgentCard = ({ name, role, isActive, onToggle, icon: Icon, color, description }) => (
    <div className="bg-white dark:bg-[hsl(220,20%,6%)] p-4 rounded-2xl border border-slate-100 dark:border-white/[0.06] shadow-sm relative overflow-hidden group hover:border-indigo-500/20 transition-all duration-300">
        <div className={cn('absolute top-0 right-0 w-24 h-24 blur-[60px] opacity-10 transition-opacity group-hover:opacity-20', color.replace('text-', 'bg-'))} />
        <div className="relative z-10">
            <div className="flex justify-between items-center mb-3">
                <div className="flex items-center gap-3">
                    <div className={cn('p-2.5 rounded-xl bg-opacity-10 dark:bg-opacity-20 shadow-inner', color)}>
                        <Icon size={18} />
                    </div>
                    <div>
                        <h3 className="text-sm font-bold text-slate-900 dark:text-white">{name}</h3>
                        <p className="text-[9px] font-bold text-indigo-500/80 uppercase tracking-widest">{role}</p>
                    </div>
                </div>
                <div className={cn(
                    'px-2.5 py-1 rounded-lg text-[8px] font-bold uppercase tracking-[0.15em] flex items-center gap-1.5',
                    isActive ? 'bg-green-50 dark:bg-green-500/10 text-green-600 dark:text-green-500' : 'bg-slate-50 dark:bg-[hsl(220,20%,9%)] text-slate-400'
                )}>
                    <div className={cn('w-1.5 h-1.5 rounded-full', isActive ? 'bg-green-500 animate-pulse' : 'bg-slate-300')} />
                    {isActive ? 'ACTIVE' : 'PAUSED'}
                </div>
            </div>
            <p className="text-xs text-slate-500 dark:text-[hsl(220,10%,55%)] leading-relaxed mb-3">{description}</p>
            <button
                onClick={onToggle}
                aria-label={isActive ? `Stop ${name}` : `Start ${name}`}
                className={cn(
                    'w-full flex items-center justify-center gap-2 py-2.5 rounded-xl font-bold text-[10px] uppercase tracking-widest transition-all active:scale-95 shadow-md',
                    isActive ? 'bg-slate-900 dark:bg-[hsl(220,20%,9%)] text-white' : 'bg-indigo-600 text-white shadow-indigo-500/20'
                )}
            >
                {isActive ? <Pause size={12} /> : <Play size={12} />}
                {isActive ? 'STOP' : 'START'}
            </button>
        </div>
    </div>
)

// ─── Tool card for Tool Definitions Viewer ──────────────────────────────────

const ToolCard = ({ tool }) => {
    const fn = tool.function
    const params = fn.parameters?.properties || {}
    return (
        <div className="bg-slate-50/70 dark:bg-[hsl(220,20%,9%)]/30 p-5 rounded-2xl border border-slate-100 dark:border-white/[0.04]">
            <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                    <Code size={16} className="text-indigo-500" />
                    <h3 className="font-bold text-sm text-slate-900 dark:text-white font-mono">{fn.name}</h3>
                </div>
                <button
                    onClick={() => navigator.clipboard.writeText(JSON.stringify(tool, null, 2))}
                    className="text-xs text-indigo-600 dark:text-indigo-400 font-bold flex items-center gap-1 hover:underline"
                >
                    <Copy size={12} /> Copy JSON
                </button>
            </div>
            <p className="text-xs text-slate-500 dark:text-[hsl(220,10%,55%)] mb-4">{fn.description}</p>
            <div className="space-y-2">
                {Object.entries(params).map(([name, prop]) => (
                    <div key={name} className="flex items-start gap-3 text-xs">
                        <code className="font-mono text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-500/10 px-2 py-0.5 rounded flex-shrink-0">{name}</code>
                        <span className="text-slate-400 flex-shrink-0">{prop.type}{prop.type === 'array' ? `[${prop.items?.type}]` : ''}</span>
                        <span className="text-slate-600 dark:text-[hsl(220,10%,55%)]">{prop.description}</span>
                    </div>
                ))}
            </div>
            {fn.parameters?.required?.length > 0 && (
                <p className="text-xs text-amber-600 dark:text-amber-400 mt-3">Required: {fn.parameters.required.join(', ')}</p>
            )}
        </div>
    )
}

// ─── Collapsible section wrapper ──────────────────────────────────────────────

const CollapsibleSection = ({ title, icon: Icon, iconColor = 'text-indigo-500', defaultOpen = false, children }) => {
    const [open, setOpen] = useState(defaultOpen)
    return (
        <div className="bg-white dark:bg-[hsl(220,20%,6%)]/50 rounded-[28px] lg:rounded-[32px] border border-slate-100 dark:border-white/[0.03] shadow-sm overflow-hidden">
            <button
                onClick={() => setOpen(!open)}
                className="w-full px-6 py-4 border-b border-slate-50 dark:border-white/[0.03] flex items-center gap-2 hover:bg-slate-50/50 dark:hover:bg-[hsl(220,20%,12%)]/20 transition-colors"
            >
                <Icon size={16} className={iconColor} />
                <h2 className="font-semibold text-sm text-slate-900 dark:text-white flex-1 text-left">{title}</h2>
                {open ? <ChevronUp size={16} className="text-slate-400" /> : <ChevronDown size={16} className="text-slate-400" />}
            </button>
            <AnimatePresence initial={false}>
                {open && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="overflow-hidden"
                    >
                        {children}
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    )
}

// ─── Helper: extract display name from model ID ────────────────────────────

const modelDisplayName = (id) => {
    const found = FREE_MODELS.find(m => m.id === id)
    if (found) return found.name
    // Fallback: extract from ID like "meta-llama/llama-3.3-70b-instruct:free"
    const parts = id.split('/')
    const raw = parts[parts.length - 1].replace(':free', '').replace(/-/g, ' ')
    return raw.replace(/\b\w/g, c => c.toUpperCase())
}

// ─── Main page ────────────────────────────────────────────────────────────────

const AdminAIPage = () => {
    const appConfig = useAppConfigStore()


    // ── System Prompts
    const [guidePrompt, setGuidePrompt] = useState(appConfig.aiGuideSystemPrompt ?? '')
    const [assistantPrompt, setAssistantPrompt] = useState(appConfig.aiAssistantSystemPrompt ?? '')
    const [kgAgentPrompt, setKgAgentPrompt] = useState(appConfig.aiKGAgentSystemPrompt ?? '')
    
    // Check if prompts match system defaults
    const isGuideDefault = !guidePrompt || guidePrompt === DEFAULT_PROMPTS.guide
    const isAssistantDefault = !assistantPrompt || assistantPrompt === DEFAULT_PROMPTS.assistant
    const isKgDefault = !kgAgentPrompt || kgAgentPrompt === DEFAULT_KG_SYSTEM_PROMPT

    const [showGuideDiff, setShowGuideDiff] = useState(false)
    const [showAssistantDiff, setShowAssistantDiff] = useState(false)
    const [showKgDiff, setShowKgDiff] = useState(false)
    const [braveApiKey, setBraveApiKey] = useState(appConfig.braveSearchApiKey ?? '')
    const [showBraveKey, setShowBraveKey] = useState(false)

    // ── Models (MUST be declared before useEffect that uses them in dependencies)
    const [primaryModel, setPrimaryModel] = useState(
        appConfig.aiPrimaryModel || 'nvidia/nemotron-3-super-120b-a12b:free'
    )
    const [fallbackModel, setFallbackModel] = useState(
        appConfig.aiFallbackModel || 'z-ai/glm-4.5-air:free'
    )

    // ── API key is now configured server-side only (no client state needed)

    // ── Agents
    const [agentActive, setAgentActive] = useState({
        guide: appConfig.aiGuideActive ?? true,
        assistant: appConfig.aiAssistantActive ?? true,
    })

    // ── UI state
    const [saved, setSaved] = useState(false)
    const [showPrimaryPicker, setShowPrimaryPicker] = useState(false)
    const [showFallbackPicker, setShowFallbackPicker] = useState(false)

    // ── Model Cascade Editor
    const [cascadeModels, setCascadeModels] = useState(() => {
        const saved = appConfig.aiModelCascade
        if (saved?.length > 0) {
            return saved
        }
        // First-time fallback: use MODEL_CASCADE from constants (no auto-adding paid models)
        return [...MODEL_CASCADE]
    })
    const [cascadeEnabled, setCascadeEnabled] = useState(() => {
        const saved = appConfig.aiModelCascade
        return new Set(saved?.length > 0 ? saved : MODEL_CASCADE)
    })

    // Sync cascade state when appConfig loads from Supabase (may happen after initial render)
    useEffect(() => {
        const saved = appConfig.aiModelCascade
        if (saved?.length > 0) {
            setCascadeModels(saved)
            setCascadeEnabled(new Set(saved))
        }
    }, [appConfig.aiModelCascade])

    // Auto-correct Primary/Fallback if they no longer exist in the cascade list
    useEffect(() => {
        if (cascadeModels.length === 0) return
        if (!cascadeModels.includes(primaryModel)) {
            setPrimaryModel(cascadeModels[0])
        }
        if (!cascadeModels.includes(fallbackModel)) {
            setFallbackModel(cascadeModels[cascadeModels.length > 1 ? 1 : 0])
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [cascadeModels])

    // ── Model Scanner (OpenRouter)
    const [showModelScanner, setShowModelScanner] = useState(false)
    const [availableModels, setAvailableModels] = useState([])
    const [scanLoading, setScanLoading] = useState(false)
    const [selectedNewModels, setSelectedNewModels] = useState(new Set())

    const moveCascade = (index, direction) => {
        const newArr = [...cascadeModels]
        const swapIdx = index + direction
        if (swapIdx < 0 || swapIdx >= newArr.length) return
        ;[newArr[index], newArr[swapIdx]] = [newArr[swapIdx], newArr[index]]
        setCascadeModels(newArr)
    }

    const toggleCascadeModel = (modelId) => {
        setCascadeEnabled(prev => {
            const next = new Set(prev)
            if (next.has(modelId)) next.delete(modelId)
            else next.add(modelId)
            return next
        })
    }

    const scanModels = async () => {
        setScanLoading(true)
        try {
            const resp = await fetch('https://openrouter.ai/api/v1/models')
            const data = await resp.json()
            const models = (data.data || [])
                .filter(m => {
                    const isFree = m.pricing?.prompt === '0' && m.pricing?.completion === '0'
                    const notInCascade = !cascadeModels.includes(m.id)
                    return isFree && notInCascade
                })
                .map(m => ({
                    id: m.id,
                    name: m.name,
                    contextLength: m.context_length,
                    hasToolCalling: m.supported_parameters?.includes('tools') || m.supported_parameters?.includes('tool_choice'),
                }))
                .sort((a, b) => {
                    if (a.hasToolCalling !== b.hasToolCalling) return b.hasToolCalling ? 1 : -1
                    return (b.contextLength || 0) - (a.contextLength || 0)
                })
            setAvailableModels(models)
            setShowModelScanner(true)
        } catch (err) {
            console.error('Failed to scan models:', err)
        } finally {
            setScanLoading(false)
        }
    }

    const addSelectedModels = () => {
        const newModels = [...selectedNewModels]
        setCascadeModels(prev => [...prev, ...newModels])
        setCascadeEnabled(prev => {
            const next = new Set(prev)
            newModels.forEach(id => next.add(id))
            return next
        })
        setSelectedNewModels(new Set())
        setShowModelScanner(false)
    }

    // ── Generation Settings
    const [guideTemp, setGuideTemp] = useState(appConfig.aiGuideTemp ?? 0.7)
    const [assistantTemp, setAssistantTemp] = useState(appConfig.aiAssistantTemp ?? 0.4)
    const [guideMaxTokens, setGuideMaxTokens] = useState(appConfig.aiGuideMaxTokens ?? 1024)
    const [assistantMaxTokens, setAssistantMaxTokens] = useState(appConfig.aiAssistantMaxTokens ?? 1024)
    const [guideTone, setGuideTone] = useState(appConfig.aiGuideTone ?? 'friendly')

    // ── Live Prompt Preview
    const [previewPrompt, setPreviewPrompt] = useState('')
    const [showPreview, setShowPreview] = useState(false)
    const [previewLoading, setPreviewLoading] = useState(false)

    const handlePreview = async () => {
        setPreviewLoading(true)
        try {
            const { buildSystemPrompt } = await import('@/shared/api/ai/prompts')
            const result = await buildSystemPrompt(
                { favoriteCuisines: ['Italian', 'Polish'], vibePreference: ['Romantic'], priceRange: ['$$'], dietaryRestrictions: [] },
                'romantic dinner in Krakow',
                'guide',
                { visitedCount: 5, visitedNames: ['Pod Baranem', 'Starka'], favoritesNames: ['Szara Gęś'], foodieDNA: 'Adventurous Explorer', userExperience: 'Loves Polish and Italian cuisine', recentInterests: ['fine dining', 'date night'] },
                [],
                guidePrompt
            )
            setPreviewPrompt(result)
            setShowPreview(true)
        } catch (e) {
            setPreviewPrompt('Error: ' + e.message)
            setShowPreview(true)
        }
        setPreviewLoading(false)
    }

    // ── Test panel
    const [testMessage, setTestMessage] = useState('')
    const [testModel, setTestModel] = useState('primary')
    const [testing, setTesting] = useState(false)
    const [testResult, setTestResult] = useState(null) // { ok, text, latency, model }
    const [fullPipelineTest, setFullPipelineTest] = useState(false)

    const toggleAgent = (key) => setAgentActive(prev => ({ ...prev, [key]: !prev[key] }))

    const getPrimaryInfo = () => FREE_MODELS.find(m => m.id === primaryModel) ?? { name: modelDisplayName(primaryModel), badge: 'Custom', badgeColor: 'bg-slate-100 dark:bg-white/5 text-slate-500', description: primaryModel, context: '—', languages: '—', toolUse: false }
    const getFallbackInfo = () => FREE_MODELS.find(m => m.id === fallbackModel) ?? { name: modelDisplayName(fallbackModel), badge: 'Custom', badgeColor: 'bg-slate-100 dark:bg-white/5 text-slate-500', description: fallbackModel, context: '—', languages: '—', toolUse: false }

    // Unified model list for Primary/Fallback pickers — derived from the
    // user-edited cascade list (single source of truth). Falls back to FREE_MODELS
    // metadata when the model is a known free one, otherwise builds a placeholder.
    const allPickerModels = (() => {
        const freeMap = new Map(FREE_MODELS.map(m => [m.id, m]))
        return cascadeModels.map(id => freeMap.get(id) ?? ({
            id,
            name: modelDisplayName(id),
            badge: 'Cascade',
            badgeColor: 'bg-amber-100 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400',
            description: id,
            context: '—',
            languages: '—',
            toolUse: false,
            provider: '',
        }))
    })()

    const [saveError, setSaveError] = useState(null)

    const handleSaveModels = async () => {
        setSaveError(null)
        console.log('[AdminAI] handleSaveModels called. Cascade:', cascadeModels.length, 'models. Primary:', primaryModel)
        try {
            // Save ALL models in the cascade list
            const result = await appConfig.updateSettings({
                aiPrimaryModel: primaryModel,
                aiFallbackModel: fallbackModel,
                aiModelCascade: cascadeModels,
                aiGuideTemp: guideTemp,
                aiAssistantTemp: assistantTemp,
                aiGuideMaxTokens: guideMaxTokens,
                aiAssistantMaxTokens: assistantMaxTokens,
                aiGuideTone: guideTone,
            })
            console.log('[AdminAI] updateSettings returned:', result)
            if (result?.ok === false) {
                setSaveError('Failed to save to Supabase. Check console — likely RLS / auth issue. Changes are NOT persisted.')
                return
            }
            setSaved(true)
            setTimeout(() => setSaved(false), 2500)
        } catch (err) {
            console.error('[AdminAI] handleSaveModels error:', err)
            setSaveError('Error: ' + (err?.message || String(err)))
        }
    }

    const handleSavePrompts = async () => {
        setSaveError(null)
        const result = await appConfig.updateSettings({
            aiGuideActive: agentActive.guide,
            aiAssistantActive: agentActive.assistant,
            aiGuideSystemPrompt: guidePrompt,
            aiAssistantSystemPrompt: assistantPrompt,
            aiKGAgentSystemPrompt: kgAgentPrompt,
            braveSearchApiKey: braveApiKey,
        })
        if (result?.ok === false) {
            setSaveError('Failed to save to Supabase. Check console.')
            return
        }
        setSaved(true)
        setTimeout(() => setSaved(false), 2500)
    }

    // ── Test model call using the cascade system
    const handleTest = async () => {
        if (!testMessage.trim()) return

        setTesting(true)
        setTestResult(null)

        if (fullPipelineTest) {
            try {
                const { runAgentPass } = await import('@/shared/api/ai/agents')
                const { buildSystemPrompt } = await import('@/shared/api/ai/prompts')
                const systemPrompt = await buildSystemPrompt({}, testMessage, 'guide')
                const messages = [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: testMessage }
                ]
                const startTime = Date.now()
                const result = await runAgentPass(messages, [])
                setTestResult({
                    ok: true,
                    text: result.text,
                    latency: Date.now() - startTime,
                    model: result.modelUsed,
                    toolCalls: result.toolCalls || [],
                    timing: result.timing || null,
                })
            } catch (err) {
                setTestResult({
                    ok: false,
                    text: err.message,
                    latency: 0,
                    model: '—',
                    toolCalls: [],
                    timing: null,
                })
            }
        } else {
            const preferredModel = testModel === 'primary' ? primaryModel : fallbackModel
            const result = await testAIConnection(testMessage, preferredModel)
            setTestResult({
                ok: result.ok,
                text: result.text,
                latency: result.latency,
                model: result.modelUsed,
                toolCalls: [],
                timing: null,
            })
        }

        setTesting(false)
    }

    return (
        <div className="space-y-6 lg:space-y-8 pb-12 font-sans">
            {/* 1. Header */}
            <AdminPageHeader
                eyebrow="Admin"
                title="AI Agents"
                subtitle="Configure AI models, agents, and system prompts."
            />

            {/* 2. API Key Status — Server-side */}
            <div className="bg-white dark:bg-[hsl(220,20%,6%)]/50 rounded-[24px] border border-slate-100 dark:border-white/[0.03] overflow-hidden shadow-sm">
                <div className="px-6 py-4 border-b border-slate-50 dark:border-white/[0.03] flex items-center gap-2">
                    <Shield size={16} className="text-emerald-500" />
                    <h2 className="font-semibold text-sm text-slate-900 dark:text-white">OpenRouter Connection</h2>
                </div>
                <div className="p-6">
                    <div className="flex items-center gap-3">
                        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 text-emerald-700 dark:text-emerald-400 text-xs font-bold">
                            <CheckCircle2 size={14} />
                            API key: configured server-side ✓
                        </span>
                    </div>
                    <p className="text-xs text-slate-500 dark:text-[hsl(220,10%,55%)] mt-3">
                        Usage stats available on{' '}
                        <a href="https://openrouter.ai/activity" target="_blank" rel="noopener noreferrer" className="text-indigo-600 dark:text-indigo-400 hover:underline font-semibold">
                            OpenRouter dashboard
                        </a>
                    </p>
                </div>
            </div>

            {/* 3. Active Agents */}
            <div className="bg-white dark:bg-[hsl(220,20%,6%)]/50 rounded-[28px] lg:rounded-[32px] border border-slate-100 dark:border-white/[0.03] shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-50 dark:border-white/[0.03] flex items-center gap-2">
                    <Bot size={16} className="text-indigo-500" />
                    <h2 className="font-semibold text-sm text-slate-900 dark:text-white">Active Agents</h2>
                </div>
                <div className="p-6">
                    <div className="grid md:grid-cols-2 gap-6">
                        <AgentCard
                            name="GastroGuide"
                            role="AI Dining Assistant"
                            isActive={agentActive.guide}
                            onToggle={() => toggleAgent('guide')}
                            icon={MessageSquare}
                            color="text-indigo-500"
                            description="Interactive chat assistant that helps users discover restaurants based on preferences, mood, and occasion."
                        />
                        <AgentCard
                            name="GastroAssistant"
                            role="Background Helper"
                            isActive={agentActive.assistant}
                            onToggle={() => toggleAgent('assistant')}
                            icon={Brain}
                            color="text-emerald-500"
                            description="Silent AI that powers smart search, recommendations, and personalization across the app."
                        />
                    </div>
                </div>
            </div>

            {/* 4. Data Sources Pipeline */}
            <CollapsibleSection title="Data Sources Pipeline" icon={Layers} iconColor="text-violet-500" defaultOpen={false}>
                <div className="p-6">
                    <p className="text-xs text-slate-500 dark:text-[hsl(220,10%,55%)] mb-5">
                        Read-only visualization of the AI data pipeline — how user queries flow through the system.
                    </p>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                        {[
                            { icon: Brain, label: 'Intent Analysis', desc: 'LLM analyzes user intent, extracts filters', color: 'text-violet-500 bg-violet-100 dark:bg-violet-500/20' },
                            { icon: Wrench, label: 'Tool Calling', desc: 'search_locations / get_location_details', color: 'text-indigo-500 bg-indigo-100 dark:bg-indigo-500/20' },
                            { icon: Database, label: 'Supabase Locations', desc: 'PostgreSQL — restaurants, cafes, bars with full metadata', color: 'text-emerald-500 bg-emerald-100 dark:bg-emerald-500/20' },
                            { icon: Search, label: 'pgvector Search', desc: 'Semantic vector search for contextual matching', color: 'text-sky-500 bg-sky-100 dark:bg-sky-500/20' },
                            { icon: GitBranch, label: 'Knowledge Graph', desc: 'Cuisines, dishes, ingredients, allergens', color: 'text-amber-500 bg-amber-100 dark:bg-amber-500/20' },
                            { icon: UserCheck, label: 'User Profile', desc: 'Preferences, Foodie DNA, visit history, favorites', color: 'text-rose-500 bg-rose-100 dark:bg-rose-500/20' },
                        ].map((step, i) => (
                            <div key={step.label} className="relative">
                                <div className="bg-slate-50/70 dark:bg-[hsl(220,20%,9%)]/30 p-4 rounded-2xl border border-slate-100 dark:border-white/[0.04] h-full">
                                    <div className={cn('w-9 h-9 rounded-xl flex items-center justify-center mb-3', step.color)}>
                                        <step.icon size={18} />
                                    </div>
                                    <h3 className="font-bold text-xs text-slate-900 dark:text-white mb-1">{step.label}</h3>
                                    <p className="text-[11px] text-slate-500 dark:text-[hsl(220,10%,55%)] leading-relaxed">{step.desc}</p>
                                </div>
                                {/* Arrow between cards on larger screens */}
                                {i < 5 && (
                                    <div className="hidden md:flex absolute -right-2.5 top-1/2 -translate-y-1/2 z-10 text-slate-300 dark:text-[hsl(220,10%,55%)]">
                                        <svg width="20" height="20" viewBox="0 0 20 20" fill="none"><path d="M6 4l8 6-8 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                    <div className="mt-5 flex items-center gap-2 text-xs text-slate-400">
                        <Activity size={14} />
                        <span>User Query → Intent Analysis → Tool Calling → Data Sources → Personalization → Response</span>
                    </div>
                </div>
            </CollapsibleSection>

            {/* 4. Model Cascade Editor — SOURCE OF TRUTH for available models.
                  Primary/Fallback pickers below select from this list. */}
            <div className="bg-white dark:bg-[hsl(220,20%,6%)]/50 rounded-[28px] lg:rounded-[32px] border border-slate-100 dark:border-white/[0.03] shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-50 dark:border-white/[0.03] flex items-center gap-2">
                    <GitBranch size={16} className="text-amber-500" />
                    <h2 className="font-semibold text-sm text-slate-900 dark:text-white">Model Cascade Editor</h2>
                    <span className="ml-auto text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400">
                        Source of truth
                    </span>
                </div>
                <div className="p-6">
                    <p className="text-xs text-slate-500 dark:text-[hsl(220,10%,55%)] mb-4">
                        This list defines all models available to the app. Add via Scanner or manual entry, reorder with arrows, disable to skip in fallback chain, or remove with ✕. Primary &amp; Fallback below pick from this list.
                    </p>
                    <div className="space-y-2">
                        {cascadeModels.map((modelId, index) => {
                            const enabled = cascadeEnabled.has(modelId)
                            const paidModel = PAID_MODELS.find(m => m.id === modelId)
                            return (
                                <div
                                    key={modelId}
                                    className={cn(
                                        'flex items-center gap-3 p-3 rounded-xl border transition-all',
                                        enabled
                                            ? 'bg-slate-50/70 dark:bg-[hsl(220,20%,9%)]/30 border-slate-100 dark:border-white/[0.04]'
                                            : 'bg-slate-100/50 dark:bg-[hsl(220,20%,9%)]/10 border-slate-200/50 dark:border-white/[0.02] opacity-50'
                                    )}
                                >
                                    <span className="w-6 h-6 flex items-center justify-center rounded-lg bg-indigo-100 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 text-xs font-bold flex-shrink-0">
                                        {index + 1}
                                    </span>
                                    <div className="flex-1 min-w-0">
                                        <span className={cn(
                                            'text-sm font-mono truncate block',
                                            enabled ? 'text-slate-900 dark:text-white' : 'text-slate-400 dark:text-[hsl(220,10%,55%)]'
                                        )}>
                                            {modelDisplayName(modelId)}
                                        </span>
                                        <span className="text-[10px] text-slate-400 font-mono truncate block">{modelId}</span>
                                        {paidModel && (
                                            <span className="text-[9px] text-amber-600 dark:text-amber-400 font-bold uppercase tracking-wider">
                                                💰 PAID · {paidModel.input} in / {paidModel.output} out · {paidModel.note}
                                            </span>
                                        )}
                                        {(primaryModel === modelId || fallbackModel === modelId) && (
                                            <span className="inline-flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider mt-1 px-1.5 py-0.5 rounded-full bg-indigo-100 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
                                                {primaryModel === modelId ? '★ Primary' : '↻ Fallback'}
                                            </span>
                                        )}
                                    </div>
                                    <div className="flex items-center gap-1 flex-shrink-0">
                                        <button
                                            onClick={() => moveCascade(index, -1)}
                                            disabled={index === 0}
                                            className="p-1.5 rounded-lg hover:bg-slate-200 dark:hover:bg-[hsl(220,20%,15%)] text-slate-400 hover:text-slate-600 dark:hover:text-[hsl(220,20%,90%)] disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                                            aria-label="Move up"
                                        >
                                            <ArrowUp size={14} />
                                        </button>
                                        <button
                                            onClick={() => moveCascade(index, 1)}
                                            disabled={index === cascadeModels.length - 1}
                                            className="p-1.5 rounded-lg hover:bg-slate-200 dark:hover:bg-[hsl(220,20%,15%)] text-slate-400 hover:text-slate-600 dark:hover:text-[hsl(220,20%,90%)] disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                                            aria-label="Move down"
                                        >
                                            <ArrowDown size={14} />
                                        </button>
                                        <button
                                            onClick={() => toggleCascadeModel(modelId)}
                                            className={cn(
                                                'p-1.5 rounded-lg transition-all',
                                                enabled
                                                    ? 'text-emerald-500 hover:bg-emerald-100 dark:hover:bg-emerald-500/20'
                                                    : 'text-slate-300 dark:text-[hsl(220,10%,55%)] hover:bg-slate-200 dark:hover:bg-[hsl(220,20%,15%)]'
                                            )}
                                            aria-label={enabled ? 'Disable model' : 'Enable model'}
                                        >
                                            {enabled ? <ToggleRight size={18} /> : <ToggleLeft size={18} />}
                                        </button>
                                        <button
                                            onClick={() => {
                                                const next = cascadeModels.filter(id => id !== modelId)
                                                setCascadeModels(next)
                                                setCascadeEnabled(prev => { const ns = new Set(prev); ns.delete(modelId); return ns })
                                                // If removed model was primary/fallback, reassign to first available
                                                if (primaryModel === modelId && next.length > 0) setPrimaryModel(next[0])
                                                if (fallbackModel === modelId && next.length > 0) setFallbackModel(next[next.length > 1 ? 1 : 0])
                                            }}
                                            disabled={cascadeModels.length <= 1}
                                            className="p-1.5 rounded-lg text-slate-300 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                                            aria-label="Remove from cascade"
                                        >
                                            <X size={14} />
                                        </button>
                                    </div>
                                </div>
                            )
                        })}
                        {cascadeModels.length === 0 && (
                            <div className="p-6 text-center text-xs text-slate-400 border border-dashed border-slate-200 dark:border-white/[0.08] rounded-xl">
                                No models yet. Add one below or use the Scanner.
                            </div>
                        )}
                    </div>
                    <p className="text-xs text-slate-400 mt-3">
                        {cascadeModels.filter(m => cascadeEnabled.has(m)).length} of {cascadeModels.length} models enabled in cascade
                    </p>

                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 mt-4">
                        <button
                            onClick={scanModels}
                            disabled={scanLoading}
                            className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 text-xs font-bold hover:bg-indigo-100 dark:hover:bg-indigo-500/20 transition-colors disabled:opacity-50 shrink-0"
                        >
                            {scanLoading ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
                            {scanLoading ? 'Scanning...' : 'Scan OpenRouter Models'}
                        </button>
                        {/* Manual model ID input */}
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                            <input
                                type="text"
                                placeholder="Add model ID (e.g. google/gemini-2.5-flash-lite)"
                                className="flex-1 min-w-0 px-3 py-2.5 rounded-xl border border-slate-200 dark:border-white/[0.08] bg-white dark:bg-[hsl(220,20%,6%)] text-xs font-mono text-slate-900 dark:text-white outline-none focus:border-indigo-500 transition-all"
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter' && e.target.value.trim()) {
                                        const id = e.target.value.trim()
                                        if (!cascadeModels.includes(id)) {
                                            setCascadeModels(prev => [...prev, id])
                                            setCascadeEnabled(prev => { const next = new Set(prev); next.add(id); return next })
                                        }
                                        e.target.value = ''
                                    }
                                }}
                            />
                            <span className="text-[10px] text-slate-400 shrink-0">Enter ↵</span>
                        </div>
                    </div>

                    {/* Model Scanner Modal — rendered via portal to escape transform context */}
                    {showModelScanner && typeof document !== 'undefined' && createPortal(
                        <AnimatePresence>
                            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowModelScanner(false)} className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[200]" />
                            <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }} className="fixed inset-0 z-[210] flex items-center justify-center p-3 sm:p-6 pointer-events-none">
                                <div className="w-full max-w-[600px] max-h-[80vh] bg-white dark:bg-[hsl(220,20%,6%)] rounded-2xl shadow-2xl border border-slate-200 dark:border-white/[0.06] flex flex-col overflow-hidden pointer-events-auto">
                                <div className="p-4 sm:p-5 border-b border-slate-100 dark:border-white/[0.06] flex items-center justify-between">
                                    <div>
                                        <h3 className="text-sm sm:text-base font-black text-slate-900 dark:text-white">Available Free Models</h3>
                                        <p className="text-[10px] sm:text-xs text-slate-500 mt-0.5">{availableModels.length} free models found • {availableModels.filter(m => m.hasToolCalling).length} with tool calling</p>
                                    </div>
                                    <button onClick={() => setShowModelScanner(false)} className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-white/5 text-slate-400 min-w-[44px] min-h-[44px] flex items-center justify-center">
                                        <X size={18} />
                                    </button>
                                </div>
                                <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-1.5">
                                    {availableModels.map(model => (
                                        <label key={model.id} className={cn("flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all", selectedNewModels.has(model.id) ? "border-indigo-500/40 bg-indigo-50/50 dark:bg-indigo-500/10" : "border-slate-100 dark:border-white/[0.06] hover:border-slate-200 dark:hover:border-white/[0.1]")}>
                                            <input type="checkbox" checked={selectedNewModels.has(model.id)} onChange={() => setSelectedNewModels(prev => { const next = new Set(prev); next.has(model.id) ? next.delete(model.id) : next.add(model.id); return next })} className="w-4 h-4 rounded accent-indigo-500 shrink-0" />
                                            <div className="flex-1 min-w-0">
                                                <div className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white truncate">{model.name || model.id}</div>
                                                <div className="text-[9px] sm:text-[10px] text-slate-400 font-mono truncate">{model.id}</div>
                                            </div>
                                            <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
                                                {model.hasToolCalling && (
                                                    <span className="px-1.5 sm:px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 text-[8px] sm:text-[9px] font-bold uppercase">Tools</span>
                                                )}
                                                {model.contextLength && (
                                                    <span className="px-1.5 sm:px-2 py-0.5 rounded-full bg-slate-100 dark:bg-white/5 text-slate-500 text-[8px] sm:text-[9px] font-bold">{Math.round(model.contextLength / 1000)}K</span>
                                                )}
                                            </div>
                                        </label>
                                    ))}
                                </div>
                                <div className="p-3 sm:p-4 border-t border-slate-100 dark:border-white/[0.06] flex items-center justify-between">
                                    <span className="text-xs text-slate-500">{selectedNewModels.size} selected</span>
                                    <button onClick={addSelectedModels} disabled={selectedNewModels.size === 0} className="px-4 sm:px-5 py-2.5 rounded-xl bg-indigo-600 text-white text-xs font-bold hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors shadow-lg shadow-indigo-500/20">
                                        Add to Cascade ({selectedNewModels.size})
                                    </button>
                                </div>
                                </div>
                            </motion.div>
                        </AnimatePresence>,
                        document.body
                    )}
                </div>
            </div>

            {/* 5. Primary & Fallback Models — picked from cascade above */}
            <div className="bg-white dark:bg-[hsl(220,20%,6%)]/50 rounded-[28px] lg:rounded-[32px] border border-slate-100 dark:border-white/[0.03] shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-50 dark:border-white/[0.03] flex items-center gap-2">
                    <Cpu size={16} className="text-indigo-500" />
                    <h2 className="font-semibold text-sm text-slate-900 dark:text-white">Primary &amp; Fallback Models</h2>
                    <span className="ml-auto text-[10px] text-slate-400">From cascade list above</span>
                </div>
                <div className="p-6 space-y-6">
                    <div className="grid md:grid-cols-2 gap-6">
                        {/* Primary Model */}
                        <div className="bg-slate-50/70 dark:bg-[hsl(220,20%,9%)]/30 p-3 sm:p-5 rounded-2xl border border-slate-100 dark:border-white/[0.04]">
                            <div className="flex items-center justify-between mb-3 sm:mb-4">
                                <h3 className="font-bold text-xs sm:text-sm text-slate-900 dark:text-white">Primary Model</h3>
                                <button
                                    onClick={() => setShowPrimaryPicker(!showPrimaryPicker)}
                                    className="text-indigo-600 dark:text-indigo-400 text-xs font-bold flex items-center gap-1 hover:underline"
                                >
                                    {showPrimaryPicker ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                                    {showPrimaryPicker ? 'Close' : 'Change'}
                                </button>
                            </div>
                            {showPrimaryPicker ? (
                                <div className="space-y-2 sm:space-y-3 max-h-[300px] sm:max-h-[400px] overflow-y-auto pr-1 sm:pr-2">
                                    {allPickerModels.map((model) => (
                                        <ModelCard
                                            key={model.id}
                                            model={model}
                                            selected={primaryModel === model.id}
                                            onSelect={(id) => {
                                                setPrimaryModel(id)
                                                setShowPrimaryPicker(false)
                                            }}
                                            disabled={false}
                                        />
                                    ))}
                                </div>
                            ) : (
                                <div className="p-4 bg-indigo-50 dark:bg-indigo-500/10 rounded-xl border border-indigo-200 dark:border-indigo-500/20">
                                    <div className="flex items-center justify-between mb-2">
                                        <span className="font-bold text-sm text-slate-900 dark:text-white">{getPrimaryInfo().name}</span>
                                        <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-indigo-100 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400">
                                            {getPrimaryInfo().badge}
                                        </span>
                                    </div>
                                    <p className="text-xs text-slate-600 dark:text-[hsl(220,10%,55%)] mb-2">{getPrimaryInfo().description}</p>
                                    <div className="flex gap-3 text-[10px] text-slate-500">
                                        <span>📊 {getPrimaryInfo().context}</span>
                                        <span>🌍 {getPrimaryInfo().languages}</span>
                                        {getPrimaryInfo().toolUse && <span className="text-emerald-500 font-bold">✓ Tool Use</span>}
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Fallback Model */}
                        <div className="bg-slate-50/70 dark:bg-[hsl(220,20%,9%)]/30 p-3 sm:p-5 rounded-2xl border border-slate-100 dark:border-white/[0.04]">
                            <div className="flex items-center justify-between mb-3 sm:mb-4">
                                <h3 className="font-bold text-xs sm:text-sm text-slate-900 dark:text-white">Fallback Model</h3>
                                <button
                                    onClick={() => setShowFallbackPicker(!showFallbackPicker)}
                                    className="text-indigo-600 dark:text-indigo-400 text-xs font-bold flex items-center gap-1 hover:underline"
                                >
                                    {showFallbackPicker ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                                    {showFallbackPicker ? 'Close' : 'Change'}
                                </button>
                            </div>
                            {showFallbackPicker ? (
                                <div className="space-y-2 sm:space-y-3 max-h-[300px] sm:max-h-[400px] overflow-y-auto pr-1 sm:pr-2">
                                    {allPickerModels.map((model) => (
                                        <ModelCard
                                            key={model.id}
                                            model={model}
                                            selected={fallbackModel === model.id}
                                            onSelect={(id) => {
                                                setFallbackModel(id)
                                                setShowFallbackPicker(false)
                                            }}
                                            disabled={false}
                                        />
                                    ))}
                                </div>
                            ) : (
                                <div className="p-4 bg-slate-100 dark:bg-[hsl(220,20%,9%)]/50 rounded-xl border border-slate-200 dark:border-white/[0.08]">
                                    <div className="flex items-center justify-between mb-2">
                                        <span className="font-bold text-sm text-slate-900 dark:text-white">{getFallbackInfo().name}</span>
                                        <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-slate-200 dark:bg-[hsl(220,20%,12%)] text-slate-600 dark:text-[hsl(220,10%,55%)]">
                                            {getFallbackInfo().badge}
                                        </span>
                                    </div>
                                    <p className="text-xs text-slate-600 dark:text-[hsl(220,10%,55%)] mb-2">{getFallbackInfo().description}</p>
                                    <div className="flex gap-3 text-[10px] text-slate-500">
                                        <span>📊 {getFallbackInfo().context}</span>
                                        <span>🌍 {getFallbackInfo().languages}</span>
                                        {getFallbackInfo().toolUse && <span className="text-emerald-500 font-bold">✓ Tool Use</span>}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="p-4 bg-amber-50 dark:bg-amber-500/10 rounded-xl border border-amber-200 dark:border-amber-500/20">
                        <p className="text-sm text-amber-800 dark:text-amber-300">
                            <strong>💡 Tip:</strong> If your primary model is overloaded or slow, switch to <strong>Nemotron Nano 9B</strong> for fastest responses or <strong>Mistral Small 3.1</strong> for best multilingual performance.
                        </p>
                    </div>
                </div>
            </div>

            {/* 7. Generation Settings */}
            <CollapsibleSection title="Generation Settings" icon={Sliders} iconColor="text-emerald-500" defaultOpen={false}>
                <div className="p-6 space-y-6">
                    {/* Temperature */}
                    <div className="grid md:grid-cols-2 gap-6">
                        <div className="bg-slate-50/70 dark:bg-[hsl(220,20%,9%)]/30 p-5 rounded-2xl border border-slate-100 dark:border-white/[0.04]">
                            <div className="flex items-center gap-2 mb-3">
                                <Thermometer size={14} className="text-indigo-500" />
                                <h3 className="font-bold text-sm text-slate-900 dark:text-white">GastroGuide Temperature</h3>
                            </div>
                            <div className="flex items-center gap-3 mb-2">
                                <input
                                    type="range"
                                    min="0"
                                    max="1"
                                    step="0.1"
                                    value={guideTemp}
                                    onChange={(e) => setGuideTemp(parseFloat(e.target.value))}
                                    className="flex-1 h-2 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                                />
                                <span className="text-sm font-bold text-indigo-600 dark:text-indigo-400 w-10 text-right">{guideTemp}</span>
                            </div>
                            <p className="text-xs text-slate-400">Higher = more creative, Lower = more focused</p>
                        </div>
                        <div className="bg-slate-50/70 dark:bg-[hsl(220,20%,9%)]/30 p-5 rounded-2xl border border-slate-100 dark:border-white/[0.04]">
                            <div className="flex items-center gap-2 mb-3">
                                <Thermometer size={14} className="text-emerald-500" />
                                <h3 className="font-bold text-sm text-slate-900 dark:text-white">GastroAssistant Temperature</h3>
                            </div>
                            <div className="flex items-center gap-3 mb-2">
                                <input
                                    type="range"
                                    min="0"
                                    max="1"
                                    step="0.1"
                                    value={assistantTemp}
                                    onChange={(e) => setAssistantTemp(parseFloat(e.target.value))}
                                    className="flex-1 h-2 rounded-lg appearance-none cursor-pointer accent-emerald-600"
                                />
                                <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400 w-10 text-right">{assistantTemp}</span>
                            </div>
                            <p className="text-xs text-slate-400">Higher = more creative, Lower = more focused</p>
                        </div>
                    </div>

                    {/* Max Tokens */}
                    <div className="grid md:grid-cols-2 gap-6">
                        <div className="bg-slate-50/70 dark:bg-[hsl(220,20%,9%)]/30 p-5 rounded-2xl border border-slate-100 dark:border-white/[0.04]">
                            <div className="flex items-center gap-2 mb-3">
                                <Hash size={14} className="text-indigo-500" />
                                <h3 className="font-bold text-sm text-slate-900 dark:text-white">GastroGuide Max Tokens</h3>
                            </div>
                            <input
                                type="number"
                                min="256"
                                max="4096"
                                step="64"
                                value={guideMaxTokens}
                                onChange={(e) => setGuideMaxTokens(Math.max(256, Math.min(4096, parseInt(e.target.value) || 256)))}
                                className="w-full h-10 px-4 rounded-xl border border-slate-200 dark:border-white/[0.08] bg-white dark:bg-[hsl(220,20%,6%)] text-slate-900 dark:text-white text-sm focus:outline-none focus:border-indigo-500 transition-all"
                            />
                            <p className="text-xs text-slate-400 mt-1.5">256 – 4096 tokens</p>
                        </div>
                        <div className="bg-slate-50/70 dark:bg-[hsl(220,20%,9%)]/30 p-5 rounded-2xl border border-slate-100 dark:border-white/[0.04]">
                            <div className="flex items-center gap-2 mb-3">
                                <Hash size={14} className="text-emerald-500" />
                                <h3 className="font-bold text-sm text-slate-900 dark:text-white">GastroAssistant Max Tokens</h3>
                            </div>
                            <input
                                type="number"
                                min="256"
                                max="4096"
                                step="64"
                                value={assistantMaxTokens}
                                onChange={(e) => setAssistantMaxTokens(Math.max(256, Math.min(4096, parseInt(e.target.value) || 256)))}
                                className="w-full h-10 px-4 rounded-xl border border-slate-200 dark:border-white/[0.08] bg-white dark:bg-[hsl(220,20%,6%)] text-slate-900 dark:text-white text-sm focus:outline-none focus:border-indigo-500 transition-all"
                            />
                            <p className="text-xs text-slate-400 mt-1.5">256 – 4096 tokens</p>
                        </div>
                    </div>

                    {/* Tone */}
                    <div className="bg-slate-50/70 dark:bg-[hsl(220,20%,9%)]/30 p-5 rounded-2xl border border-slate-100 dark:border-white/[0.04]">
                        <div className="flex items-center gap-2 mb-3">
                            <MessageSquare size={14} className="text-indigo-500" />
                            <h3 className="font-bold text-sm text-slate-900 dark:text-white">GastroGuide Tone</h3>
                        </div>
                        <select
                            value={guideTone}
                            onChange={(e) => setGuideTone(e.target.value)}
                            className="w-full h-10 px-4 rounded-xl border border-slate-200 dark:border-white/[0.08] bg-white dark:bg-[hsl(220,20%,6%)] text-slate-900 dark:text-white text-sm focus:outline-none focus:border-indigo-500 transition-all"
                        >
                            <option value="friendly">Friendly — Warm, casual, like a foodie friend</option>
                            <option value="professional">Professional — Polished, expert restaurant critic</option>
                            <option value="expert">Expert — Concise, data-driven, culinary insider</option>
                        </select>
                        <div className="mt-3 space-y-1">
                            <p className="text-xs text-slate-500 dark:text-[hsl(220,10%,55%)]">
                                <span className="font-bold text-slate-700 dark:text-[hsl(220,10%,55%)]">Friendly</span> — Casual and warm, like chatting with a foodie friend who knows all the hidden gems.
                            </p>
                            <p className="text-xs text-slate-500 dark:text-[hsl(220,10%,55%)]">
                                <span className="font-bold text-slate-700 dark:text-[hsl(220,10%,55%)]">Professional</span> — Polished and elegant, like an expert restaurant critic writing for a guide.
                            </p>
                            <p className="text-xs text-slate-500 dark:text-[hsl(220,10%,55%)]">
                                <span className="font-bold text-slate-700 dark:text-[hsl(220,10%,55%)]">Expert</span> — Concise and data-driven, delivering culinary insider knowledge efficiently.
                            </p>
                        </div>
                    </div>
                </div>
            </CollapsibleSection>

            {/* Save Models & Generation Settings Button */}
            <div className="flex flex-col items-end gap-3">
                {saveError && (
                    <div className="w-full p-3 rounded-xl bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/20 text-rose-700 dark:text-rose-400 text-xs font-medium flex items-start gap-2">
                        <AlertCircle size={14} className="shrink-0 mt-0.5" />
                        <span>{saveError}</span>
                    </div>
                )}
                <button
                    onClick={handleSaveModels}
                    className={cn(adminBtnPrimary, "h-12 px-8 shadow-lg shadow-indigo-500/20 active:scale-95 transition-all")}
                >
                    <Save size={16} />
                    <span>{saved ? '✓ Saved!' : 'Save Model Settings'}</span>
                </button>
            </div>

            {/* 8. System Prompts (with Live Preview) */}
            <div className="bg-white dark:bg-[hsl(220,20%,6%)]/50 rounded-[28px] lg:rounded-[32px] border border-slate-100 dark:border-white/[0.03] shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-50 dark:border-white/[0.03] flex items-center gap-2">
                    <FileText size={16} className="text-indigo-500" />
                    <h2 className="font-semibold text-sm text-slate-900 dark:text-white">System Prompts</h2>
                </div>
                <div className="p-6 space-y-5">
                    <p className="text-xs text-slate-500 dark:text-[hsl(220,10%,55%)]">
                        Customize AI behavior. Leave empty to use default prompts. Changes take effect immediately after saving.
                    </p>
                    {/* GastroGuide Prompt */}
                    <div className="bg-slate-50/70 dark:bg-[hsl(220,20%,9%)]/30 p-5 rounded-2xl border border-slate-100 dark:border-white/[0.04]">
                        <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-3">
                                <div className="p-2 rounded-xl bg-indigo-100 dark:bg-indigo-500/20">
                                    <MessageSquare className="text-indigo-500" size={16} />
                                </div>
                                <div>
                                    <div className="flex items-center gap-2">
                                        <h3 className="font-bold text-sm text-slate-900 dark:text-white">GastroGuide</h3>
                                        <span className={cn(
                                            "text-[9px] px-1.5 py-0.5 rounded-full font-bold uppercase tracking-wider",
                                            isGuideDefault 
                                                ? "bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400"
                                                : "bg-amber-100 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400"
                                        )}>
                                            {isGuideDefault ? 'System Default' : 'Custom Override'}
                                        </span>
                                    </div>
                                    <p className="text-xs text-slate-500">User-facing dining assistant</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={handlePreview}
                                    disabled={previewLoading}
                                    className="text-xs text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-1 hover:underline disabled:opacity-50"
                                >
                                    {previewLoading ? <Loader2 size={12} className="animate-spin" /> : <Eye size={12} />}
                                    Preview Final Prompt
                                </button>
                                <button
                                    onClick={() => setShowGuideDiff(!showGuideDiff)}
                                    className="text-xs text-indigo-600 dark:text-indigo-400 font-bold flex items-center gap-1 hover:underline"
                                >
                                    <Code size={12} />
                                    {showGuideDiff ? 'Hide Diff' : 'Compare'}
                                </button>
                                <button
                                    onClick={() => setGuidePrompt(DEFAULT_PROMPTS.guide)}
                                    className="text-xs text-slate-400 hover:text-red-500 font-bold flex items-center gap-1 transition-colors"
                                >
                                    <RotateCcw size={12} />
                                    Reset
                                </button>
                            </div>
                        </div>
                        <textarea
                            value={guidePrompt}
                            onChange={(e) => setGuidePrompt(e.target.value)}
                            placeholder={DEFAULT_PROMPTS.guide}
                            rows={6}
                            className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-white/[0.08] bg-white dark:bg-[hsl(220,20%,6%)] text-slate-900 dark:text-white text-sm font-mono focus:outline-none focus:border-indigo-500 transition-all resize-y"
                        />
                        
                        {showGuideDiff && !isGuideDefault && (
                            <div className="mt-3 p-4 bg-slate-100 dark:bg-[hsl(220,20%,4%)] rounded-xl border border-dashed border-slate-300 dark:border-white/10">
                                <h4 className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2">Original System Default:</h4>
                                <pre className="text-[10px] text-slate-500 overflow-x-auto whitespace-pre-wrap max-h-[150px] font-mono leading-relaxed">
                                    {DEFAULT_PROMPTS.guide}
                                </pre>
                            </div>
                        )}

                        <div className="flex items-center justify-between mt-2">
                            <p className="text-xs text-slate-400">
                                {guidePrompt.length} characters {isGuideDefault && '(currently using system default)'}
                            </p>
                            {!isGuideDefault && (
                                <span className="text-[10px] text-amber-500 font-medium">⚠️ Custom override active</span>
                            )}
                        </div>
                    </div>

                    {/* GastroAssistant Prompt */}
                    <div className="bg-slate-50/70 dark:bg-[hsl(220,20%,9%)]/30 p-5 rounded-2xl border border-slate-100 dark:border-white/[0.04]">
                        <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-3">
                                <div className="p-2 rounded-xl bg-emerald-100 dark:bg-emerald-500/20">
                                    <Brain className="text-emerald-500" size={16} />
                                </div>
                                 <div>
                                    <div className="flex items-center gap-2">
                                        <h3 className="font-bold text-sm text-slate-900 dark:text-white">GastroAssistant</h3>
                                        <span className={cn(
                                            "text-[9px] px-1.5 py-0.5 rounded-full font-bold uppercase tracking-wider",
                                            isAssistantDefault 
                                                ? "bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400"
                                                : "bg-amber-100 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400"
                                        )}>
                                            {isAssistantDefault ? 'System Default' : 'Custom Override'}
                                        </span>
                                    </div>
                                    <p className="text-xs text-slate-500">Background agent for search & personalization</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => setShowAssistantDiff(!showAssistantDiff)}
                                    className="text-xs text-indigo-600 dark:text-indigo-400 font-bold flex items-center gap-1 hover:underline"
                                >
                                    <Code size={12} />
                                    {showAssistantDiff ? 'Hide Diff' : 'Compare'}
                                </button>
                                <button
                                    onClick={() => setAssistantPrompt(DEFAULT_PROMPTS.assistant)}
                                    className="text-xs text-slate-400 hover:text-red-500 font-bold flex items-center gap-1 transition-colors"
                                >
                                    <RotateCcw size={12} />
                                    Reset
                                </button>
                            </div>
                        </div>
                        <textarea
                            value={assistantPrompt}
                            onChange={(e) => setAssistantPrompt(e.target.value)}
                            placeholder={DEFAULT_PROMPTS.assistant}
                            rows={6}
                            className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-white/[0.08] bg-white dark:bg-[hsl(220,20%,6%)] text-slate-900 dark:text-white text-sm font-mono focus:outline-none focus:border-indigo-500 transition-all resize-y"
                        />

                        {showAssistantDiff && !isAssistantDefault && (
                            <div className="mt-3 p-4 bg-slate-100 dark:bg-[hsl(220,20%,4%)] rounded-xl border border-dashed border-slate-300 dark:border-white/10">
                                <h4 className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2">Original System Default:</h4>
                                <pre className="text-[10px] text-slate-500 overflow-x-auto whitespace-pre-wrap max-h-[150px] font-mono leading-relaxed">
                                    {DEFAULT_PROMPTS.assistant}
                                </pre>
                            </div>
                        )}

                        <div className="flex items-center justify-between mt-2">
                            <p className="text-xs text-slate-400">
                                {assistantPrompt.length} characters {isAssistantDefault && '(currently using system default)'}
                            </p>
                            {!isAssistantDefault && (
                                <span className="text-[10px] text-amber-500 font-medium">⚠️ Custom override active</span>
                            )}
                        </div>
                    </div>

                    {/* KG Agent Prompt */}
                    <div className="bg-slate-50/70 dark:bg-[hsl(220,20%,9%)]/30 p-5 rounded-2xl border border-slate-100 dark:border-white/[0.04]">
                        <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-3">
                                <div className="p-2 rounded-xl bg-indigo-100 dark:bg-indigo-500/20">
                                    <Globe className="text-indigo-500" size={16} />
                                </div>
                                <div>
                                    <div className="flex items-center gap-2">
                                        <h3 className="font-bold text-sm text-slate-900 dark:text-white">Knowledge Graph Agent</h3>
                                        <span className={cn(
                                            "text-[9px] px-1.5 py-0.5 rounded-full font-bold uppercase tracking-wider",
                                            isKgDefault 
                                                ? "bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400"
                                                : "bg-amber-100 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400"
                                        )}>
                                            {isKgDefault ? 'System Default' : 'Custom Override'}
                                        </span>
                                    </div>
                                    <p className="text-xs text-slate-500">Internal data enrichment and logic</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => setShowKgDiff(!showKgDiff)}
                                    className="text-xs text-indigo-600 dark:text-indigo-400 font-bold flex items-center gap-1 hover:underline"
                                >
                                    <Code size={12} />
                                    {showKgDiff ? 'Hide Diff' : 'Compare'}
                                </button>
                                <button
                                    onClick={() => setKgAgentPrompt(DEFAULT_KG_SYSTEM_PROMPT)}
                                    className="text-xs text-slate-400 hover:text-red-500 font-bold flex items-center gap-1 transition-colors"
                                >
                                    <RotateCcw size={12} />
                                    Reset
                                </button>
                            </div>
                        </div>

                        <div className="mb-3 p-3 rounded-xl bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-100 dark:border-indigo-500/20">
                            <p className="text-xs text-indigo-700 dark:text-indigo-300 font-medium leading-relaxed">
                                This agent connects to Open Food Facts, Wikipedia, and other culinary sources to populate
                                the Knowledge Graph with cuisines, dishes, and ingredients.
                            </p>
                        </div>

                        {/* Brave Search API Key */}
                        <div className="mb-4">
                            <div className="flex items-center gap-2 mb-2">
                                <Search size={13} className="text-indigo-500" />
                                <label className="text-xs font-semibold text-slate-700 dark:text-[hsl(220,10%,55%)]">Brave Search API Key</label>
                                <span className="text-xs text-slate-400">(free tier: 2 000 req/month)</span>
                            </div>
                            <div className="flex gap-2">
                                <div className="relative flex-1">
                                    <Key size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                    <input
                                        type={showBraveKey ? "text" : "password"}
                                        value={braveApiKey}
                                        onChange={(e) => setBraveApiKey(e.target.value)}
                                        placeholder="BSA..."
                                        className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-slate-200 dark:border-white/[0.08] bg-white dark:bg-[hsl(220,20%,6%)] text-slate-900 dark:text-white text-sm font-mono focus:outline-none focus:border-indigo-500 transition-all"
                                    />
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setShowBraveKey(v => !v)}
                                    className="px-3 py-2.5 rounded-xl border border-slate-200 dark:border-white/[0.08] bg-white dark:bg-[hsl(220,20%,6%)] text-slate-500 hover:text-slate-900 dark:hover:text-white transition-colors"
                                >
                                    {showBraveKey ? <EyeOff size={14} /> : <Eye size={14} />}
                                </button>
                            </div>
                        </div>

                        <textarea
                            value={kgAgentPrompt}
                            onChange={(e) => setKgAgentPrompt(e.target.value)}
                            placeholder={DEFAULT_KG_SYSTEM_PROMPT}
                            rows={8}
                            className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-white/[0.08] bg-white dark:bg-[hsl(220,20%,6%)] text-slate-900 dark:text-white text-sm font-mono focus:outline-none focus:border-indigo-500 transition-all resize-y"
                        />

                        {showKgDiff && !isKgDefault && (
                            <div className="mt-3 p-4 bg-slate-100 dark:bg-[hsl(220,20%,4%)] rounded-xl border border-dashed border-slate-300 dark:border-white/10">
                                <h4 className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2">Original System Default:</h4>
                                <pre className="text-[10px] text-slate-500 overflow-x-auto whitespace-pre-wrap max-h-[150px] font-mono leading-relaxed">
                                    {DEFAULT_KG_SYSTEM_PROMPT}
                                </pre>
                            </div>
                        )}

                        <div className="flex items-center justify-between mt-2">
                            <p className="text-xs text-slate-400">
                                {kgAgentPrompt.length} characters {isKgDefault && '(currently using system default)'}
                            </p>
                            {!isKgDefault && (
                                <span className="text-[10px] text-amber-500 font-medium">⚠️ Custom override active</span>
                            )}
                        </div>
                    </div>

                    {/* Live Prompt Preview */}
                    {showPreview && (
                        <motion.div
                            initial={{ opacity: 0, y: -8 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="bg-slate-50/70 dark:bg-[hsl(220,20%,9%)]/30 p-5 rounded-2xl border border-slate-100 dark:border-white/[0.04]"
                        >
                            <div className="flex items-center justify-between mb-3">
                                <div className="flex items-center gap-2">
                                    <Eye size={14} className="text-emerald-500" />
                                    <h3 className="font-bold text-sm text-slate-900 dark:text-white">Preview: Final GastroGuide Prompt</h3>
                                </div>
                                <button
                                    onClick={() => setShowPreview(false)}
                                    className="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-white"
                                >
                                    Close
                                </button>
                            </div>
                            <p className="text-xs text-slate-500 dark:text-[hsl(220,10%,55%)] mb-3">
                                Sample prompt built with test user profile (Italian & Polish cuisines, Romantic vibe, Krakow context).
                            </p>
                            <div className="max-h-[400px] overflow-y-auto p-4 bg-white dark:bg-[hsl(220,20%,6%)] rounded-xl border border-slate-200 dark:border-white/[0.08]">
                                <pre className="whitespace-pre-wrap font-mono text-xs text-slate-700 dark:text-[hsl(220,10%,55%)]">{previewPrompt}</pre>
                            </div>
                        </motion.div>
                    )}
                </div>
            </div>

            {/* 9. Tool Definitions Viewer */}
            <CollapsibleSection title="Tool Definitions" icon={Wrench} iconColor="text-indigo-500" defaultOpen={false}>
                <div className="p-6 space-y-4">
                    <p className="text-xs text-slate-500 dark:text-[hsl(220,10%,55%)]">
                        Tools the AI can call during conversations. These are sent with each request to enable function calling.
                    </p>
                    {TOOLS.map((tool) => (
                        <ToolCard key={tool.function.name} tool={tool} />
                    ))}
                </div>
            </CollapsibleSection>

            {/* 10. Enhanced Test Panel */}
            <div className="bg-white dark:bg-[hsl(220,20%,6%)]/50 rounded-[28px] lg:rounded-[32px] border border-slate-100 dark:border-white/[0.03] shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-50 dark:border-white/[0.03] flex items-center gap-2">
                    <Play size={16} className="text-indigo-500" />
                    <h2 className="font-semibold text-sm text-slate-900 dark:text-white">Test Model</h2>
                </div>
                <div className="p-6">
                    <div className="flex flex-wrap gap-3 mb-4">
                        <select
                            value={testModel}
                            onChange={(e) => setTestModel(e.target.value)}
                            disabled={fullPipelineTest}
                            className={cn(
                                "px-4 h-12 rounded-2xl border border-slate-100 dark:border-white/[0.06] bg-slate-50/50 dark:bg-[hsl(220,20%,9%)]/50 text-slate-900 dark:text-white text-sm focus:outline-none focus:border-indigo-500 transition-all",
                                fullPipelineTest && 'opacity-50'
                            )}
                        >
                            <option value="primary">Primary: {getPrimaryInfo().name}</option>
                            <option value="fallback">Fallback: {getFallbackInfo().name}</option>
                        </select>
                        <button
                            onClick={() => setFullPipelineTest(!fullPipelineTest)}
                            className={cn(
                                'h-12 px-4 rounded-2xl font-bold text-[10px] uppercase tracking-widest border transition-all flex items-center gap-2',
                                fullPipelineTest
                                    ? 'bg-violet-50 border-violet-200 text-violet-600 dark:bg-violet-500/10 dark:border-violet-500/20 dark:text-violet-400'
                                    : 'bg-slate-50 border-slate-200 text-slate-600 dark:bg-[hsl(220,20%,9%)] dark:border-white/[0.08] dark:text-[hsl(220,10%,55%)]'
                            )}
                        >
                            {fullPipelineTest ? <ToggleRight size={14} /> : <ToggleLeft size={14} />}
                            Full Pipeline
                        </button>
                        <input
                            type="text"
                            value={testMessage}
                            onChange={(e) => setTestMessage(e.target.value)}
                            placeholder={fullPipelineTest ? "Try: romantic dinner in Krakow" : "Test message..."}
                            className="flex-1 min-w-[200px] h-12 px-5 rounded-2xl border border-slate-100 dark:border-white/[0.06] bg-slate-50/50 dark:bg-[hsl(220,20%,9%)]/50 text-slate-900 dark:text-white text-sm focus:outline-none focus:border-indigo-500 transition-all shadow-inner"
                            onKeyDown={(e) => e.key === 'Enter' && handleTest()}
                        />
                        <button
                            onClick={handleTest}
                            disabled={testing || !testMessage.trim()}
                            className={cn(
                                'h-10 px-5 rounded-2xl font-semibold text-sm text-white flex items-center gap-2 transition-all active:scale-95',
                                testing || !testMessage.trim()
                                    ? 'bg-slate-300 dark:bg-[hsl(220,20%,12%)] cursor-not-allowed'
                                    : fullPipelineTest
                                        ? 'bg-violet-600 hover:bg-violet-500 shadow-sm'
                                        : 'bg-indigo-600 hover:bg-indigo-500 shadow-sm'
                            )}
                        >
                            {testing ? <Loader2 className="animate-spin" size={15} /> : <Send size={15} />}
                            Run
                        </button>
                    </div>

                    {fullPipelineTest && (
                        <p className="text-xs text-violet-500 dark:text-violet-400 mb-3">
                            Full pipeline test runs the complete agent pass with tool calling, knowledge graph context, and personalization.
                        </p>
                    )}

                    {testResult && (
                        <motion.div
                            initial={{ opacity: 0, y: -8 }}
                            animate={{ opacity: 1, y: 0 }}
                            className={cn(
                                'p-4 rounded-xl border',
                                testResult.ok
                                    ? 'bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/20'
                                    : 'bg-red-50 dark:bg-red-500/10 border-red-200 dark:border-red-500/20'
                            )}
                        >
                            <div className="flex items-center gap-2 mb-2">
                                {testResult.ok ? (
                                    <CheckCircle2 className="text-emerald-600 dark:text-emerald-400" size={16} />
                                ) : (
                                    <AlertCircle className="text-red-600 dark:text-red-400" size={16} />
                                )}
                                <span className="font-bold text-sm">
                                    {testResult.ok ? 'Success' : 'Error'}
                                </span>
                                <span className="text-xs text-slate-500 ml-auto">
                                    {testResult.model} · {testResult.latency}ms
                                </span>
                            </div>
                            <p className="text-sm text-slate-700 dark:text-[hsl(220,10%,55%)] font-mono">
                                {testResult.text}
                            </p>

                            {/* Tool Calls */}
                            {testResult.toolCalls?.length > 0 && (
                                <div className="mt-3 space-y-2">
                                    <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Tool Calls</p>
                                    {testResult.toolCalls.map((tc, i) => (
                                        <div key={i} className="p-3 bg-slate-50 dark:bg-[hsl(220,20%,9%)] rounded-xl text-xs font-mono">
                                            <span className="text-indigo-600 dark:text-indigo-400">{tc.name}</span>
                                            <span className="text-slate-400 ml-2">→ {tc.resultCount} results</span>
                                            <pre className="text-slate-500 mt-1 text-[10px] overflow-x-auto">{JSON.stringify(tc.args, null, 2)}</pre>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {/* Timing */}
                            {testResult.timing && (
                                <div className="mt-3 flex gap-4 text-xs text-slate-500">
                                    <span className="flex items-center gap-1"><Clock size={12} /> Total: {testResult.timing.totalMs}ms</span>
                                    {testResult.timing.toolExecutionMs > 0 && (
                                        <span>Tools: {testResult.timing.toolExecutionMs}ms</span>
                                    )}
                                </div>
                            )}
                        </motion.div>
                    )}
                </div>

                {/* 6. Final Save Action */}
                <div className="mt-10 mb-6 flex flex-col sm:flex-row items-center justify-end gap-6 bg-white dark:bg-[hsl(220,20%,6%)]/30 p-8 rounded-[32px] border border-slate-100 dark:border-white/[0.03] shadow-sm">
                    <AnimatePresence>
                        {saved && (
                            <motion.span
                                initial={{ scale: 0, opacity: 0, x: 20 }}
                                animate={{ scale: 1, opacity: 1, x: 0 }}
                                exit={{ scale: 0, opacity: 0, x: 20 }}
                                className="flex items-center gap-1.5 text-sm font-bold text-emerald-600 dark:text-emerald-400 mr-auto"
                            >
                                <CheckCircle2 size={16} /> Saved Successfully
                            </motion.span>
                        )}
                    </AnimatePresence>

                    <div className="flex flex-col items-end gap-3">
                        <button 
                            onClick={handleSavePrompts} 
                            className={cn(adminBtnPrimary, "h-14 px-10 min-w-[240px] shadow-2xl shadow-indigo-500/20 active:scale-95 transition-all")}
                        >
                            <Save size={18} /> Save Parameters
                        </button>
                        <div className="flex flex-col items-end pr-1">
                            <h3 className="text-sm font-bold text-slate-900 dark:text-white leading-tight">Ready to apply?</h3>
                            <p className="text-[11px] text-slate-500 leading-tight">All changes will take effect immediately across the platform.</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default AdminAIPage
