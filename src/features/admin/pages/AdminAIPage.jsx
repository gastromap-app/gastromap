import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
    Bot, MessageSquare, Zap, Shield, Settings,
    Save, Play, Pause, RefreshCw, Sliders, Brain,
    CheckCircle2, ChevronDown, ChevronUp, Send,
    Loader2, AlertCircle, Eye, EyeOff, Star, Globe, Cpu,
    FileText, RotateCcw, Search, Key,
    Database, GitBranch, Thermometer, Hash, ArrowUp, ArrowDown,
    ToggleLeft, ToggleRight, Copy, Code, Clock, Wrench, Activity,
    Layers, UserCheck
} from 'lucide-react'
import { cn } from '@/lib/utils'
import AdminPageHeader, { adminBtnPrimary } from '../components/AdminPageHeader'
import { useAppConfigStore } from '@/shared/store/useAppConfigStore'
import { config } from '@/shared/config/env'
import { DEFAULT_PROMPTS, MODEL_CASCADE, TOOLS } from '@/shared/api/ai/constants'
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
        badge: 'Reliable',
        badgeColor: 'bg-rose-100 dark:bg-rose-500/20 text-rose-600 dark:text-rose-400',
        description: 'Battle-tested model. Reliable JSON output, great for instruction following.',
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
]

// ─── Model card ──────────────────────────────────────────────────────────────

const ModelCard = ({ model, selected, onSelect, disabled }) => (
    <button
        onClick={() => !disabled && onSelect(model.id)}
        aria-label={`Select ${model.name}`}
        className={cn(
            'w-full text-left p-4 rounded-2xl border transition-all duration-200',
            selected
                ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-500/10 shadow-md shadow-indigo-500/10'
                : 'border-slate-200 dark:border-white/[0.08] bg-white dark:bg-[hsl(220,20%,9%)]/50 hover:border-slate-300 dark:hover:border-slate-600',
            disabled && 'opacity-50 cursor-not-allowed'
        )}
    >
        <div className="flex items-start justify-between gap-3 mb-2">
            <div className="flex items-center gap-2 min-w-0">
                <div className={cn(
                    'w-4 h-4 rounded-full border-2 flex-shrink-0 transition-all',
                    selected ? 'border-indigo-500 bg-indigo-500' : 'border-slate-300 dark:border-white/[0.08]'
                )}>
                    {selected && <div className="w-1.5 h-1.5 bg-white rounded-full m-auto mt-[1px]" />}
                </div>
                <span className="font-bold text-sm text-slate-900 dark:text-white truncate">{model.name}</span>
                <span className="text-[10px] text-slate-400 dark:text-[hsl(220,10%,55%)] flex-shrink-0">{model.provider}</span>
            </div>
            <span className={cn('text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full flex-shrink-0', model.badgeColor)}>
                {model.badge}
            </span>
        </div>
        <p className="text-xs text-slate-500 dark:text-[hsl(220,10%,55%)] leading-relaxed mb-3 pl-6">{model.description}</p>
        <div className="flex gap-3 pl-6">
            <span className="flex items-center gap-1 text-[10px] text-slate-400">
                <Cpu size={10} /> {model.context}
            </span>
            <span className="flex items-center gap-1 text-[10px] text-slate-400">
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
    <div className="bg-white dark:bg-[hsl(220,20%,6%)] p-6 rounded-[28px] border border-slate-100 dark:border-white/[0.06] shadow-sm relative overflow-hidden group hover:border-indigo-500/20 transition-all duration-300">
        <div className={cn('absolute top-0 right-0 w-32 h-32 blur-[80px] opacity-10 transition-opacity group-hover:opacity-20', color.replace('text-', 'bg-'))} />
        <div className="relative z-10">
            <div className="flex justify-between items-start mb-5">
                <div className={cn('p-4 rounded-2xl bg-opacity-10 dark:bg-opacity-20 shadow-inner', color)}>
                    <Icon size={24} />
                </div>
                <div className={cn(
                    'px-3 py-1.5 rounded-xl text-[9px] font-bold uppercase tracking-[0.2em] flex items-center gap-1.5',
                    isActive ? 'bg-green-50 dark:bg-green-500/10 text-green-600 dark:text-green-500' : 'bg-slate-50 dark:bg-[hsl(220,20%,9%)] text-slate-400'
                )}>
                    <div className={cn('w-1.5 h-1.5 rounded-full', isActive ? 'bg-green-500 animate-pulse' : 'bg-slate-300')} />
                    {isActive ? 'ACTIVE' : 'PAUSED'}
                </div>
            </div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-0.5">{name}</h3>
            <p className="text-[10px] font-bold text-indigo-500/80 uppercase tracking-widest mb-3">{role}</p>
            <p className="text-sm text-slate-500 dark:text-[hsl(220,10%,55%)] leading-relaxed mb-6">{description}</p>
            <div className="flex gap-2">
                <button
                    onClick={onToggle}
                    aria-label={isActive ? `Stop ${name}` : `Start ${name}`}
                    className={cn(
                        'flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-[10px] uppercase tracking-widest transition-all active:scale-95 shadow-md',
                        isActive ? 'bg-slate-900 dark:bg-[hsl(220,20%,9%)] text-white' : 'bg-indigo-600 text-white shadow-indigo-500/20'
                    )}
                >
                    {isActive ? <Pause size={14} /> : <Play size={14} />}
                    {isActive ? 'STOP' : 'START'}
                </button>
                <button aria-label={`${name} settings`} className="p-3 rounded-xl bg-slate-50 dark:bg-[hsl(220,20%,9%)] text-slate-400 hover:text-slate-600 dark:hover:text-white transition-all">
                    <Settings size={18} />
                </button>
            </div>
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
    const [braveApiKey, setBraveApiKey] = useState(appConfig.braveSearchApiKey ?? '')
    const [showBraveKey, setShowBraveKey] = useState(false)

    // ── Models (MUST be declared before useEffect that uses them in dependencies)
    const [primaryModel, setPrimaryModel] = useState(
        appConfig.aiPrimaryModel || 'nvidia/nemotron-3-super-120b-a12b:free'
    )
    const [fallbackModel, setFallbackModel] = useState(
        appConfig.aiFallbackModel || 'z-ai/glm-4.5-air:free'
    )

    // ── API key (MUST be declared before useEffect that uses it)
    const [apiKey, setApiKey] = useState(appConfig.aiApiKey || '')
    const [showKey, setShowKey] = useState(false)

    // ── Key Status (Functional Improvement)
    const [apiKeyStatus, setApiKeyStatus] = useState('idle') // idle | validating | valid | invalid | error
    const [apiKeyError, setApiKeyError] = useState('')
    const [validationTrigger, setValidationTrigger] = useState(0)

    const validateKey = React.useCallback(async () => {
        setApiKeyStatus('validating')
        setApiKeyError('')

        const timeoutId = setTimeout(() => {
            setApiKeyStatus('error')
            setApiKeyError('Validation timeout — no response in 10s')
        }, 10000)

        try {
            const result = await testAIConnection('ping', primaryModel)
            clearTimeout(timeoutId)
            if (result.ok) {
                setApiKeyStatus('valid')
                setApiKeyError('')
            } else {
                setApiKeyStatus('invalid')
                setApiKeyError(result.text || 'Invalid API Key')
            }
        } catch (err) {
            clearTimeout(timeoutId)
            setApiKeyStatus('error')
            setApiKeyError(err.message || 'Connection failed')
        }
    }, [primaryModel])

    // ── Validate API Key when it changes
    React.useEffect(() => {
        if (!primaryModel) return

        if (apiKey && apiKey.startsWith('sk-or-')) {
            validateKey()
        } else {
            setApiKeyStatus(apiKey ? 'invalid' : 'idle')
            setApiKeyError(apiKey ? 'Must start with sk-or-' : '')
        }
    }, [apiKey, primaryModel, validationTrigger, validateKey])

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
        return saved?.length > 0 ? saved : [...MODEL_CASCADE]
    })
    const [cascadeEnabled, setCascadeEnabled] = useState(() => {
        const saved = appConfig.aiModelCascade
        return new Set(saved?.length > 0 ? saved : MODEL_CASCADE)
    })

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
                { visitedCount: 5, visitedNames: ['Pod Baranem', 'Starka'], favoritesNames: ['Szara Gęś'], foodieDNA: 'Adventurous Explorer', userExperience: 'Loves Polish and Italian cuisine', recentInterests: ['fine dining', 'date night'] }
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

    const getPrimaryInfo = () => FREE_MODELS.find(m => m.id === primaryModel) ?? FREE_MODELS[0]
    const getFallbackInfo = () => FREE_MODELS.find(m => m.id === fallbackModel) ?? FREE_MODELS[1]

    const handleSave = () => {
        appConfig.updateSettings({
            aiGuideActive: agentActive.guide,
            aiAssistantActive: agentActive.assistant,
            aiPrimaryModel: primaryModel,
            aiFallbackModel: fallbackModel,
            aiApiKey: apiKey,
            aiGuideSystemPrompt: guidePrompt,
            aiAssistantSystemPrompt: assistantPrompt,
            aiKGAgentSystemPrompt: kgAgentPrompt,
            braveSearchApiKey: braveApiKey,
            aiModelCascade: cascadeModels.filter(m => cascadeEnabled.has(m)),
            aiGuideTemp: guideTemp,
            aiAssistantTemp: assistantTemp,
            aiGuideMaxTokens: guideMaxTokens,
            aiAssistantMaxTokens: assistantMaxTokens,
            aiGuideTone: guideTone,
        })
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
                actions={
                    <div className="flex items-center gap-2">
                        {saved && (
                            <motion.span
                                initial={{ scale: 0, opacity: 0 }}
                                animate={{ scale: 1, opacity: 1 }}
                                className="flex items-center gap-1.5 text-xs font-bold text-emerald-600 dark:text-emerald-400"
                            >
                                <CheckCircle2 size={14} /> Saved!
                            </motion.span>
                        )}
                        <button onClick={handleSave} className={adminBtnPrimary}>
                            <Save size={13} /> Save Settings
                        </button>
                    </div>
                }
            />

            {/* 2. Active Agents */}
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

            {/* 3. Data Sources Pipeline */}
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

            {/* 4. AI Models */}
            <div className="bg-white dark:bg-[hsl(220,20%,6%)]/50 rounded-[28px] lg:rounded-[32px] border border-slate-100 dark:border-white/[0.03] shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-50 dark:border-white/[0.03] flex items-center gap-2">
                    <Cpu size={16} className="text-indigo-500" />
                    <h2 className="font-semibold text-sm text-slate-900 dark:text-white">AI Models (OpenRouter Free)</h2>
                </div>
                <div className="p-6 space-y-6">
                    <div className="grid md:grid-cols-2 gap-6">
                        {/* Primary Model */}
                        <div className="bg-slate-50/70 dark:bg-[hsl(220,20%,9%)]/30 p-5 rounded-2xl border border-slate-100 dark:border-white/[0.04]">
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="font-bold text-sm text-slate-900 dark:text-white">Primary Model</h3>
                                <button
                                    onClick={() => setShowPrimaryPicker(!showPrimaryPicker)}
                                    className="text-indigo-600 dark:text-indigo-400 text-xs font-bold flex items-center gap-1 hover:underline"
                                >
                                    {showPrimaryPicker ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                                    {showPrimaryPicker ? 'Close' : 'Change'}
                                </button>
                            </div>
                            {showPrimaryPicker ? (
                                <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2">
                                    {FREE_MODELS.map((model) => (
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
                        <div className="bg-slate-50/70 dark:bg-[hsl(220,20%,9%)]/30 p-5 rounded-2xl border border-slate-100 dark:border-white/[0.04]">
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="font-bold text-sm text-slate-900 dark:text-white">Fallback Model</h3>
                                <button
                                    onClick={() => setShowFallbackPicker(!showFallbackPicker)}
                                    className="text-indigo-600 dark:text-indigo-400 text-xs font-bold flex items-center gap-1 hover:underline"
                                >
                                    {showFallbackPicker ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                                    {showFallbackPicker ? 'Close' : 'Change'}
                                </button>
                            </div>
                            {showFallbackPicker ? (
                                <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2">
                                    {FREE_MODELS.map((model) => (
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

            {/* 5. Model Cascade Editor */}
            <CollapsibleSection title="Model Cascade Editor" icon={GitBranch} iconColor="text-amber-500" defaultOpen={false}>
                <div className="p-6">
                    <p className="text-xs text-slate-500 dark:text-[hsl(220,10%,55%)] mb-4">
                        Drag models up/down to set the fallback order. Disable models to skip them in the cascade.
                        The primary model is always tried first; this list is used only when it fails.
                    </p>
                    <div className="space-y-2">
                        {cascadeModels.map((modelId, index) => {
                            const enabled = cascadeEnabled.has(modelId)
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
                                    <span className={cn(
                                        'flex-1 text-sm font-mono truncate',
                                        enabled ? 'text-slate-900 dark:text-white' : 'text-slate-400 dark:text-[hsl(220,10%,55%)]'
                                    )}>
                                        {modelDisplayName(modelId)}
                                    </span>
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
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                    <p className="text-xs text-slate-400 mt-3">
                        {cascadeModels.filter(m => cascadeEnabled.has(m)).length} of {cascadeModels.length} models enabled in cascade
                    </p>
                </div>
            </CollapsibleSection>

            {/* 6. API Key */}
            <div className="bg-white dark:bg-[hsl(220,20%,6%)]/50 rounded-[28px] lg:rounded-[32px] border border-slate-100 dark:border-white/[0.03] shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-50 dark:border-white/[0.03] flex items-center gap-2">
                    <Shield size={16} className="text-indigo-500" />
                    <h2 className="font-semibold text-sm text-slate-900 dark:text-white">OpenRouter API Key</h2>
                </div>
                <div className="p-6">
                    <div className="flex gap-3 mb-4">
                        <div className="flex-1 relative">
                            <input
                                type={showKey ? 'text' : 'password'}
                                value={apiKey}
                                onChange={(e) => setApiKey(e.target.value)}
                                placeholder="sk-or-v1-..."
                                className="w-full h-12 px-5 rounded-2xl border border-slate-100 dark:border-white/[0.06] bg-slate-50/50 dark:bg-[hsl(220,20%,9%)]/50 text-slate-900 dark:text-white font-mono text-sm focus:outline-none focus:border-indigo-500 transition-all shadow-inner"
                            />
                            <button
                                onClick={() => setShowKey(!showKey)}
                                className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-[hsl(220,20%,90%)]"
                                aria-label={showKey ? 'Hide API key' : 'Show API key'}
                            >
                                {showKey ? <EyeOff size={16} /> : <Eye size={16} />}
                            </button>
                        </div>
                        <div className="flex items-center gap-3">
                            <button
                                onClick={() => setValidationTrigger(v => v + 1)}
                                disabled={apiKeyStatus === 'validating' || !apiKey}
                                className={cn(
                                    "px-4 h-12 rounded-2xl font-bold text-[10px] uppercase tracking-widest border transition-all",
                                    apiKeyStatus === 'valid' 
                                        ? "bg-emerald-50 border-emerald-200 text-emerald-600 dark:bg-emerald-500/10 dark:border-emerald-500/20 dark:text-emerald-400"
                                        : "bg-slate-50 border-slate-200 text-slate-600 dark:bg-[hsl(220,20%,9%)] dark:border-white/[0.08] dark:text-[hsl(220,10%,55%)]"
                                )}
                            >
                                {apiKeyStatus === 'validating' ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
                                <span className="ml-2">Test Key</span>
                            </button>
                            <div className="flex-1 flex items-center gap-3 px-5 h-12 rounded-2xl bg-slate-50/70 dark:bg-[hsl(220,20%,9%)]/30 border border-slate-100 dark:border-white/[0.04]">
                                <div className={cn(
                                    "w-2 h-2 rounded-full",
                                    apiKeyStatus === 'valid' ? "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" :
                                    apiKeyStatus === 'invalid' || apiKeyStatus === 'error' ? "bg-red-500" :
                                    apiKeyStatus === 'validating' ? "bg-amber-500 animate-pulse" : "bg-slate-300 dark:bg-[hsl(220,10%,35%)]"
                                )} />
                                <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500 dark:text-[hsl(220,10%,55%)]">
                                    Status: {apiKeyStatus === 'idle' ? 'Not Checked' : apiKeyStatus.toUpperCase()}
                                </span>
                                {apiKeyError && (
                                    <span className="text-[10px] text-red-500 truncate max-w-[200px]">
                                        — {apiKeyError}
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>
                    <p className="text-xs text-slate-500 dark:text-[hsl(220,10%,55%)]">
                        Get your free API key from{' '}
                        <a href="https://openrouter.ai/keys" target="_blank" rel="noopener noreferrer" className="text-indigo-600 dark:text-indigo-400 hover:underline font-semibold">
                            openrouter.ai/keys
                        </a>
                    </p>
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
                                    <h3 className="font-bold text-sm text-slate-900 dark:text-white">GastroGuide</h3>
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
                                    onClick={() => setGuidePrompt(DEFAULT_PROMPTS.guide)}
                                    className="text-xs text-indigo-600 dark:text-indigo-400 font-bold flex items-center gap-1 hover:underline"
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
                        <p className="text-xs text-slate-400 mt-2">
                            {guidePrompt.length} characters {guidePrompt.length === 0 && '(using default)'}
                        </p>
                    </div>

                    {/* GastroAssistant Prompt */}
                    <div className="bg-slate-50/70 dark:bg-[hsl(220,20%,9%)]/30 p-5 rounded-2xl border border-slate-100 dark:border-white/[0.04]">
                        <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-3">
                                <div className="p-2 rounded-xl bg-emerald-100 dark:bg-emerald-500/20">
                                    <Brain className="text-emerald-500" size={16} />
                                </div>
                                <div>
                                    <h3 className="font-bold text-sm text-slate-900 dark:text-white">GastroAssistant</h3>
                                    <p className="text-xs text-slate-500">Background agent for search &amp; personalization</p>
                                </div>
                            </div>
                            <button
                                onClick={() => setAssistantPrompt(DEFAULT_PROMPTS.assistant)}
                                className="text-xs text-indigo-600 dark:text-indigo-400 font-bold flex items-center gap-1 hover:underline"
                            >
                                <RotateCcw size={12} />
                                Reset
                            </button>
                        </div>
                        <textarea
                            value={assistantPrompt}
                            onChange={(e) => setAssistantPrompt(e.target.value)}
                            placeholder={DEFAULT_PROMPTS.assistant}
                            rows={6}
                            className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-white/[0.08] bg-white dark:bg-[hsl(220,20%,6%)] text-slate-900 dark:text-white text-sm font-mono focus:outline-none focus:border-indigo-500 transition-all resize-y"
                        />
                        <p className="text-xs text-slate-400 mt-2">
                            {assistantPrompt.length} characters {assistantPrompt.length === 0 && '(using default)'}
                        </p>
                    </div>

                    {/* KG Agent Prompt */}
                    <div className="bg-slate-50/70 dark:bg-[hsl(220,20%,9%)]/30 p-5 rounded-2xl border border-slate-100 dark:border-white/[0.04]">
                        <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-3">
                                <div className="p-2 rounded-xl bg-indigo-100 dark:bg-indigo-500/20">
                                    <Globe className="text-indigo-500" size={16} />
                                </div>
                                <div>
                                    <h3 className="font-bold text-sm text-slate-900 dark:text-white">Knowledge Graph Agent</h3>
                                    <p className="text-xs text-slate-500">Enriches the culinary database from Open Food Facts &amp; web sources</p>
                                </div>
                            </div>
                            <button
                                onClick={() => setKgAgentPrompt('')}
                                className="text-xs text-indigo-600 dark:text-indigo-400 font-bold flex items-center gap-1 hover:underline"
                            >
                                <RotateCcw size={12} />
                                Reset
                            </button>
                        </div>
                        <div className="mb-3 p-3 rounded-xl bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-100 dark:border-indigo-500/20">
                            <p className="text-xs text-indigo-700 dark:text-indigo-300 font-medium leading-relaxed">
                                This agent connects to Open Food Facts, Wikipedia, and other culinary sources to populate
                                the Knowledge Graph with cuisines, dishes, and ingredients.
                                GastroGuide reads this data for semantic, context-aware recommendations.
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
                            <p className="text-xs text-slate-400 mt-1.5">
                                Get a free key at{" "}
                                <a href="https://api.search.brave.com" target="_blank" rel="noopener noreferrer" className="text-indigo-500 hover:underline">api.search.brave.com</a>.
                                {braveApiKey ? " ✓ Web search enrichment active" : " Leave empty to skip web search."}
                            </p>
                        </div>
                        <textarea
                            value={kgAgentPrompt}
                            onChange={(e) => setKgAgentPrompt(e.target.value)}
                            placeholder={DEFAULT_KG_SYSTEM_PROMPT}
                            rows={8}
                            className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-white/[0.08] bg-white dark:bg-[hsl(220,20%,6%)] text-slate-900 dark:text-white text-sm font-mono focus:outline-none focus:border-indigo-500 transition-all resize-y"
                        />
                        <p className="text-xs text-slate-400 mt-2">
                            {kgAgentPrompt.length} characters {kgAgentPrompt.length === 0 && '(using default — Open Food Facts + Wikipedia sources)'}
                        </p>
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
                            disabled={testing || !testMessage.trim() || (!apiKey && !config.ai.useProxy)}
                            className={cn(
                                'h-10 px-5 rounded-2xl font-semibold text-sm text-white flex items-center gap-2 transition-all active:scale-95',
                                testing || !testMessage.trim() || (!apiKey && !config.ai.useProxy)
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
            </div>
        </div>
    )
}

export default AdminAIPage
