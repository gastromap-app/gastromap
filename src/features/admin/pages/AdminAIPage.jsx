import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
    Bot, MessageSquare, Zap, Shield, Settings,
    Save, Play, Pause, RefreshCw, Sliders, Brain,
    CheckCircle2, ChevronDown, ChevronUp, Send,
    Loader2, AlertCircle, Eye, EyeOff, Star, Globe, Cpu,
    FileText, RotateCcw
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAppConfigStore } from '@/store/useAppConfigStore'
import { config } from '@/shared/config/env'
import { DEFAULT_PROMPTS, testAIConnection, MODEL_CASCADE } from '@/shared/api/ai.api'
import { DEFAULT_KG_SYSTEM_PROMPT } from '@/shared/api/kg-ai-agent.api'

// ─── Available OpenRouter free models (April 2026) ──────────────────────────
// Ordered by reliability/availability - models less likely to be rate-limited first

const FREE_MODELS = [
    {
        id: 'stepfun/step-3.5-flash:free',
        name: 'Step 3.5 Flash',
        provider: 'StepFun',
        context: '256K',
        languages: 'EN / RU / PL / UA / multilingual',
        badge: 'Fastest',
        badgeColor: 'bg-orange-100 dark:bg-orange-500/20 text-orange-600 dark:text-orange-400',
        description: 'Fastest free model. Low latency, high availability. Best for real-time chat.',
        toolUse: true,
    },
    {
        id: 'nvidia/nemotron-nano-9b-v2:free',
        name: 'Nemotron Nano 9B v2',
        provider: 'NVIDIA',
        context: '128K',
        languages: 'EN / multilingual',
        badge: 'Most Available',
        badgeColor: 'bg-green-100 dark:bg-green-500/20 text-green-600 dark:text-green-400',
        description: 'Lightning-fast responses. High availability, rarely rate-limited.',
        toolUse: true,
    },
    {
        id: 'z-ai/glm-4.5-air:free',
        name: 'GLM-4.5-Air',
        provider: 'Z.AI',
        context: '128K',
        languages: 'EN / RU / PL',
        badge: 'Fast',
        badgeColor: 'bg-blue-100 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400',
        description: 'Fast hybrid thinking mode. Good availability.',
        toolUse: true,
    },
    {
        id: 'mistralai/mistral-small-3.1:free',
        name: 'Mistral Small 3.1',
        provider: 'Mistral',
        context: '131K',
        languages: 'EN / RU / PL / UA',
        badge: 'Best Multilingual',
        badgeColor: 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400',
        description: 'Reliable multilingual model with strong reasoning.',
        toolUse: true,
    },
    {
        id: 'openai/gpt-oss-20b:free',
        name: 'GPT-OSS 20B',
        provider: 'OpenAI',
        context: '128K',
        languages: 'EN / multilingual',
        badge: 'Apache 2.0',
        badgeColor: 'bg-yellow-100 dark:bg-yellow-500/20 text-yellow-600 dark:text-yellow-400',
        description: 'OpenAI open-weight model. Strong function calling.',
        toolUse: true,
    },
    {
        id: 'minimax/minimax-m2.5:free',
        name: 'MiniMax M2.5',
        provider: 'MiniMax',
        context: '256K',
        languages: 'EN / multilingual',
        badge: 'Large Context',
        badgeColor: 'bg-teal-100 dark:bg-teal-500/20 text-teal-600 dark:text-teal-400',
        description: 'Large context window for long conversations.',
        toolUse: true,
    },
    {
        id: 'mistralai/devstral-2512:free',
        name: 'Devstral 2',
        provider: 'Mistral',
        context: '256K',
        languages: 'EN / RU / PL / UA',
        badge: 'Agentic',
        badgeColor: 'bg-indigo-100 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400',
        description: 'Best agentic model. May be rate-limited during peak hours.',
        toolUse: true,
    },
    {
        id: 'meta-llama/llama-3.3-70b-instruct:free',
        name: 'Llama 3.3 70B',
        provider: 'Meta',
        context: '131K',
        languages: 'EN / RU / PL',
        badge: 'Popular',
        badgeColor: 'bg-rose-100 dark:bg-rose-500/20 text-rose-600 dark:text-rose-400',
        description: 'Well-known model. Often rate-limited during peak hours.',
        toolUse: true,
    },
    {
        id: 'qwen/qwen3-coder:free',
        name: 'Qwen3 Coder',
        provider: 'Alibaba',
        context: '262K',
        languages: '100+ incl. RU / PL / UA',
        badge: 'Largest Context',
        badgeColor: 'bg-purple-100 dark:bg-purple-500/20 text-purple-600 dark:text-purple-400',
        description: 'Largest context window. Often rate-limited.',
        toolUse: true,
    },
    {
        id: 'qwen/qwen3.6-plus:free',
        name: 'Qwen3.6 Plus',
        provider: 'Alibaba',
        context: '1M',
        languages: '100+ incl. RU / PL / UA',
        badge: '1M Context',
        badgeColor: 'bg-violet-100 dark:bg-violet-500/20 text-violet-600 dark:text-violet-400',
        description: 'Massive 1M context window. Hybrid architecture with vision + tool use.',
        toolUse: true,
    },
    {
        id: 'google/gemma-3-27b-it:free',
        name: 'Gemma 3 27B',
        provider: 'Google',
        context: '131K',
        languages: 'EN / RU / PL / UA / 140+',
        badge: 'Vision',
        badgeColor: 'bg-sky-100 dark:bg-sky-500/20 text-sky-600 dark:text-sky-400',
        description: 'Best free Google model. Multimodal vision support, 140+ languages.',
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
                : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/50 hover:border-slate-300 dark:hover:border-slate-600',
            disabled && 'opacity-50 cursor-not-allowed'
        )}
    >
        <div className="flex items-start justify-between gap-3 mb-2">
            <div className="flex items-center gap-2 min-w-0">
                <div className={cn(
                    'w-4 h-4 rounded-full border-2 flex-shrink-0 transition-all',
                    selected ? 'border-indigo-500 bg-indigo-500' : 'border-slate-300 dark:border-slate-600'
                )}>
                    {selected && <div className="w-1.5 h-1.5 bg-white rounded-full m-auto mt-[1px]" />}
                </div>
                <span className="font-bold text-sm text-slate-900 dark:text-white truncate">{model.name}</span>
                <span className="text-[10px] text-slate-400 dark:text-slate-500 flex-shrink-0">{model.provider}</span>
            </div>
            <span className={cn('text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full flex-shrink-0', model.badgeColor)}>
                {model.badge}
            </span>
        </div>
        <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed mb-3 pl-6">{model.description}</p>
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
    <div className="bg-white dark:bg-slate-900 p-6 rounded-[28px] border border-slate-100 dark:border-slate-800 shadow-sm relative overflow-hidden group hover:border-indigo-500/20 transition-all duration-300">
        <div className={cn('absolute top-0 right-0 w-32 h-32 blur-[80px] opacity-10 transition-opacity group-hover:opacity-20', color.replace('text-', 'bg-'))} />
        <div className="relative z-10">
            <div className="flex justify-between items-start mb-5">
                <div className={cn('p-4 rounded-2xl bg-opacity-10 dark:bg-opacity-20 shadow-inner', color)}>
                    <Icon size={24} />
                </div>
                <div className={cn(
                    'px-3 py-1.5 rounded-xl text-[9px] font-bold uppercase tracking-[0.2em] flex items-center gap-1.5',
                    isActive ? 'bg-green-50 dark:bg-green-500/10 text-green-600 dark:text-green-500' : 'bg-slate-50 dark:bg-slate-800 text-slate-400'
                )}>
                    <div className={cn('w-1.5 h-1.5 rounded-full', isActive ? 'bg-green-500 animate-pulse' : 'bg-slate-300')} />
                    {isActive ? 'ACTIVE' : 'PAUSED'}
                </div>
            </div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-0.5">{name}</h3>
            <p className="text-[10px] font-bold text-indigo-500/80 uppercase tracking-widest mb-3">{role}</p>
            <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed mb-6">{description}</p>
            <div className="flex gap-2">
                <button
                    onClick={onToggle}
                    aria-label={isActive ? `Stop ${name}` : `Start ${name}`}
                    className={cn(
                        'flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-[10px] uppercase tracking-widest transition-all active:scale-95 shadow-md',
                        isActive ? 'bg-slate-900 dark:bg-slate-800 text-white' : 'bg-indigo-600 text-white shadow-indigo-500/20'
                    )}
                >
                    {isActive ? <Pause size={14} /> : <Play size={14} />}
                    {isActive ? 'STOP' : 'START'}
                </button>
                <button aria-label={`${name} settings`} className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-white transition-all">
                    <Settings size={18} />
                </button>
            </div>
        </div>
    </div>
)

// ─── Main page ────────────────────────────────────────────────────────────────

const AdminAIPage = () => {
    const appConfig = useAppConfigStore()

    // ── Temps
    const [guideTemp, setGuideTemp] = useState(appConfig.aiGuideTemp ?? 0.7)
    const [assistantTemp, setAssistantTemp] = useState(appConfig.aiAssistantTemp ?? 0.4)

    // ── System Prompts
    const [guidePrompt, setGuidePrompt] = useState(appConfig.aiGuideSystemPrompt ?? '')
    const [assistantPrompt, setAssistantPrompt] = useState(appConfig.aiAssistantSystemPrompt ?? '')
    const [kgAgentPrompt, setKgAgentPrompt] = useState(appConfig.aiKGAgentSystemPrompt ?? '')

    // ── Agents
    const [agentActive, setAgentActive] = useState({
        guide: appConfig.aiGuideActive ?? true,
        assistant: appConfig.aiAssistantActive ?? true,
    })

    // ── Models
    const [primaryModel, setPrimaryModel] = useState(
        appConfig.aiPrimaryModel || 'nvidia/nemotron-nano-9b-v2:free'
    )
    const [fallbackModel, setFallbackModel] = useState(
        appConfig.aiFallbackModel || 'z-ai/glm-4.5-air:free'
    )

    // ── API key
    const [apiKey, setApiKey] = useState(appConfig.aiApiKey || '')
    const [showKey, setShowKey] = useState(false)

    // ── UI state
    const [saved, setSaved] = useState(false)
    const [showPrimaryPicker, setShowPrimaryPicker] = useState(false)
    const [showFallbackPicker, setShowFallbackPicker] = useState(false)

    // ── Test panel
    const [testMessage, setTestMessage] = useState('')
    const [testModel, setTestModel] = useState('primary')
    const [testing, setTesting] = useState(false)
    const [testResult, setTestResult] = useState(null) // { ok, text, latency, model }

    const toggleAgent = (key) => setAgentActive(prev => ({ ...prev, [key]: !prev[key] }))

    const getPrimaryInfo = () => FREE_MODELS.find(m => m.id === primaryModel) ?? FREE_MODELS[0]
    const getFallbackInfo = () => FREE_MODELS.find(m => m.id === fallbackModel) ?? FREE_MODELS[1]

    const handleSave = () => {
        appConfig.updateSettings({
            aiGuideTemp: guideTemp,
            aiAssistantTemp: assistantTemp,
            aiGuideActive: agentActive.guide,
            aiAssistantActive: agentActive.assistant,
            aiPrimaryModel: primaryModel,
            aiFallbackModel: fallbackModel,
            aiApiKey: apiKey,
            aiGuideSystemPrompt: guidePrompt,
            aiAssistantSystemPrompt: assistantPrompt,
            aiKGAgentSystemPrompt: kgAgentPrompt,
        })
        setSaved(true)
        setTimeout(() => setSaved(false), 2500)
    }

    // ── Test model call using the cascade system
    const handleTest = async () => {
        if (!testMessage.trim()) return

        setTesting(true)
        setTestResult(null)

        // Use the preferred model (primary or fallback) but cascade if rate-limited
        const preferredModel = testModel === 'primary' ? primaryModel : fallbackModel

        const result = await testAIConnection(testMessage, preferredModel)

        setTestResult({
            ok: result.ok,
            text: result.text,
            latency: result.latency,
            model: result.modelUsed,
        })

        setTesting(false)
    }

    return (
        <div className="space-y-6 lg:space-y-8 pb-12 font-sans">
            {/* Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4">
                <div>
                    <h1 className="text-xl lg:text-3xl font-bold text-slate-900 dark:text-white leading-none tracking-tight">AI &amp; Agents</h1>
                    <p className="text-slate-500 dark:text-slate-400 font-medium mt-1.5 text-xs lg:text-base">Configure GastroGuide AI models, agents, and API settings.</p>
                </div>
                <div className="flex items-center gap-3">
                    {saved && (
                        <motion.div
                            initial={{ scale: 0, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 font-semibold text-sm"
                        >
                            <CheckCircle2 size={16} />
                            Saved!
                        </motion.div>
                    )}
                    <button
                        onClick={handleSave}
                        className="h-10 px-5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl font-semibold text-sm flex items-center gap-2 transition-all shadow-sm"
                    >
                        <Save size={15} />
                        Save Settings
                    </button>
                </div>
            </div>

            {/* Agents */}
            <div className="bg-white dark:bg-slate-900/50 rounded-[28px] lg:rounded-[32px] border border-slate-100 dark:border-slate-800/50 shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-50 dark:border-slate-800/50 flex items-center gap-2">
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

            {/* AI Models */}
            <div className="bg-white dark:bg-slate-900/50 rounded-[28px] lg:rounded-[32px] border border-slate-100 dark:border-slate-800/50 shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-50 dark:border-slate-800/50 flex items-center gap-2">
                    <Cpu size={16} className="text-indigo-500" />
                    <h2 className="font-semibold text-sm text-slate-900 dark:text-white">AI Models (OpenRouter Free)</h2>
                </div>
                <div className="p-6 space-y-6">
                    <div className="grid md:grid-cols-2 gap-6">
                        {/* Primary Model */}
                        <div className="bg-slate-50/70 dark:bg-slate-800/30 p-5 rounded-2xl border border-slate-100 dark:border-slate-700/50">
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
                                    <p className="text-xs text-slate-600 dark:text-slate-400 mb-2">{getPrimaryInfo().description}</p>
                                    <div className="flex gap-3 text-[10px] text-slate-500">
                                        <span>📊 {getPrimaryInfo().context}</span>
                                        <span>🌍 {getPrimaryInfo().languages}</span>
                                        {getPrimaryInfo().toolUse && <span className="text-emerald-500 font-bold">✓ Tool Use</span>}
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Fallback Model */}
                        <div className="bg-slate-50/70 dark:bg-slate-800/30 p-5 rounded-2xl border border-slate-100 dark:border-slate-700/50">
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
                                <div className="p-4 bg-slate-100 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700">
                                    <div className="flex items-center justify-between mb-2">
                                        <span className="font-bold text-sm text-slate-900 dark:text-white">{getFallbackInfo().name}</span>
                                        <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-400">
                                            {getFallbackInfo().badge}
                                        </span>
                                    </div>
                                    <p className="text-xs text-slate-600 dark:text-slate-400 mb-2">{getFallbackInfo().description}</p>
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

            {/* API Key */}
            <div className="bg-white dark:bg-slate-900/50 rounded-[28px] lg:rounded-[32px] border border-slate-100 dark:border-slate-800/50 shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-50 dark:border-slate-800/50 flex items-center gap-2">
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
                                className="w-full h-12 px-5 rounded-2xl border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50 text-slate-900 dark:text-white font-mono text-sm focus:outline-none focus:border-indigo-500 transition-all shadow-inner"
                            />
                            <button
                                onClick={() => setShowKey(!showKey)}
                                className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                                aria-label={showKey ? 'Hide API key' : 'Show API key'}
                            >
                                {showKey ? <EyeOff size={16} /> : <Eye size={16} />}
                            </button>
                        </div>
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                        Get your free API key from{' '}
                        <a href="https://openrouter.ai/keys" target="_blank" rel="noopener noreferrer" className="text-indigo-600 dark:text-indigo-400 hover:underline font-semibold">
                            openrouter.ai/keys
                        </a>
                    </p>
                </div>
            </div>

            {/* Temperature */}
            <div className="bg-white dark:bg-slate-900/50 rounded-[28px] lg:rounded-[32px] border border-slate-100 dark:border-slate-800/50 shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-50 dark:border-slate-800/50 flex items-center gap-2">
                    <Sliders size={16} className="text-indigo-500" />
                    <h2 className="font-semibold text-sm text-slate-900 dark:text-white">Temperature Settings</h2>
                </div>
                <div className="p-6">
                    <div className="grid md:grid-cols-2 gap-6">
                        <div className="bg-slate-50/70 dark:bg-slate-800/30 p-5 rounded-2xl border border-slate-100 dark:border-slate-700/50">
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="font-bold text-sm text-slate-900 dark:text-white">GastroGuide</h3>
                                <span className="font-mono font-bold text-indigo-600 dark:text-indigo-400 text-sm bg-indigo-50 dark:bg-indigo-500/10 px-3 py-1 rounded-lg">{guideTemp.toFixed(1)}</span>
                            </div>
                            <input
                                type="range"
                                min="0"
                                max="2"
                                step="0.1"
                                value={guideTemp}
                                onChange={(e) => setGuideTemp(parseFloat(e.target.value))}
                                className="w-full accent-indigo-600"
                            />
                            <div className="flex justify-between text-[10px] text-slate-400 mt-2 font-semibold uppercase tracking-wider">
                                <span>Precise (0)</span>
                                <span>Creative (2)</span>
                            </div>
                        </div>
                        <div className="bg-slate-50/70 dark:bg-slate-800/30 p-5 rounded-2xl border border-slate-100 dark:border-slate-700/50">
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="font-bold text-sm text-slate-900 dark:text-white">GastroAssistant</h3>
                                <span className="font-mono font-bold text-indigo-600 dark:text-indigo-400 text-sm bg-indigo-50 dark:bg-indigo-500/10 px-3 py-1 rounded-lg">{assistantTemp.toFixed(1)}</span>
                            </div>
                            <input
                                type="range"
                                min="0"
                                max="2"
                                step="0.1"
                                value={assistantTemp}
                                onChange={(e) => setAssistantTemp(parseFloat(e.target.value))}
                                className="w-full accent-indigo-600"
                            />
                            <div className="flex justify-between text-[10px] text-slate-400 mt-2 font-semibold uppercase tracking-wider">
                                <span>Precise (0)</span>
                                <span>Creative (2)</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* System Prompts */}
            <div className="bg-white dark:bg-slate-900/50 rounded-[28px] lg:rounded-[32px] border border-slate-100 dark:border-slate-800/50 shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-50 dark:border-slate-800/50 flex items-center gap-2">
                    <FileText size={16} className="text-indigo-500" />
                    <h2 className="font-semibold text-sm text-slate-900 dark:text-white">System Prompts</h2>
                </div>
                <div className="p-6 space-y-5">
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                        Customize AI behavior. Leave empty to use default prompts. Changes take effect immediately after saving.
                    </p>
                    {/* GastroGuide Prompt */}
                    <div className="bg-slate-50/70 dark:bg-slate-800/30 p-5 rounded-2xl border border-slate-100 dark:border-slate-700/50">
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
                            <button
                                onClick={() => setGuidePrompt(DEFAULT_PROMPTS.guide)}
                                className="text-xs text-indigo-600 dark:text-indigo-400 font-bold flex items-center gap-1 hover:underline"
                            >
                                <RotateCcw size={12} />
                                Reset
                            </button>
                        </div>
                        <textarea
                            value={guidePrompt}
                            onChange={(e) => setGuidePrompt(e.target.value)}
                            placeholder={DEFAULT_PROMPTS.guide}
                            rows={6}
                            className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-sm font-mono focus:outline-none focus:border-indigo-500 transition-all resize-y"
                        />
                        <p className="text-xs text-slate-400 mt-2">
                            {guidePrompt.length} characters {guidePrompt.length === 0 && '(using default)'}
                        </p>
                    </div>

                    {/* GastroAssistant Prompt */}
                    <div className="bg-slate-50/70 dark:bg-slate-800/30 p-5 rounded-2xl border border-slate-100 dark:border-slate-700/50">
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
                            className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-sm font-mono focus:outline-none focus:border-indigo-500 transition-all resize-y"
                        />
                        <p className="text-xs text-slate-400 mt-2">
                            {assistantPrompt.length} characters {assistantPrompt.length === 0 && '(using default)'}
                        </p>
                    </div>

                    {/* KG Agent Prompt */}
                    <div className="bg-slate-50/70 dark:bg-slate-800/30 p-5 rounded-2xl border border-slate-100 dark:border-slate-700/50">
                        <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-3">
                                <div className="p-2 rounded-xl bg-violet-100 dark:bg-violet-500/20">
                                    <Globe className="text-violet-500" size={16} />
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
                        <div className="mb-3 p-3 rounded-xl bg-violet-50 dark:bg-violet-500/10 border border-violet-100 dark:border-violet-500/20">
                            <p className="text-xs text-violet-700 dark:text-violet-300 font-medium leading-relaxed">
                                This agent connects to Open Food Facts, Wikipedia, and other culinary sources to populate
                                the Knowledge Graph with cuisines, dishes, and ingredients.
                                GastroGuide reads this data for semantic, context-aware recommendations.
                            </p>
                        </div>
                        <textarea
                            value={kgAgentPrompt}
                            onChange={(e) => setKgAgentPrompt(e.target.value)}
                            placeholder={DEFAULT_KG_SYSTEM_PROMPT}
                            rows={8}
                            className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-sm font-mono focus:outline-none focus:border-violet-500 transition-all resize-y"
                        />
                        <p className="text-xs text-slate-400 mt-2">
                            {kgAgentPrompt.length} characters {kgAgentPrompt.length === 0 && '(using default — Open Food Facts + Wikipedia sources)'}
                        </p>
                    </div>
                </div>
            </div>

            {/* Test Panel */}
            <div className="bg-white dark:bg-slate-900/50 rounded-[28px] lg:rounded-[32px] border border-slate-100 dark:border-slate-800/50 shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-50 dark:border-slate-800/50 flex items-center gap-2">
                    <Play size={16} className="text-indigo-500" />
                    <h2 className="font-semibold text-sm text-slate-900 dark:text-white">Test Model</h2>
                </div>
                <div className="p-6">
                    <div className="flex gap-3 mb-4">
                        <select
                            value={testModel}
                            onChange={(e) => setTestModel(e.target.value)}
                            className="px-4 h-12 rounded-2xl border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50 text-slate-900 dark:text-white text-sm focus:outline-none focus:border-indigo-500 transition-all"
                        >
                            <option value="primary">Primary: {getPrimaryInfo().name}</option>
                            <option value="fallback">Fallback: {getFallbackInfo().name}</option>
                        </select>
                        <input
                            type="text"
                            value={testMessage}
                            onChange={(e) => setTestMessage(e.target.value)}
                            placeholder="Test message..."
                            className="flex-1 h-12 px-5 rounded-2xl border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50 text-slate-900 dark:text-white text-sm focus:outline-none focus:border-indigo-500 transition-all shadow-inner"
                            onKeyDown={(e) => e.key === 'Enter' && handleTest()}
                        />
                        <button
                            onClick={handleTest}
                            disabled={testing || !testMessage.trim() || (!apiKey && !config.ai.useProxy)}
                            className={cn(
                                'h-10 px-5 rounded-2xl font-semibold text-sm text-white flex items-center gap-2 transition-all active:scale-95',
                                testing || !testMessage.trim() || (!apiKey && !config.ai.useProxy)
                                    ? 'bg-slate-300 dark:bg-slate-700 cursor-not-allowed'
                                    : 'bg-indigo-600 hover:bg-indigo-500 shadow-sm'
                            )}
                        >
                            {testing ? <Loader2 className="animate-spin" size={15} /> : <Send size={15} />}
                            Run
                        </button>
                    </div>

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
                            <p className="text-sm text-slate-700 dark:text-slate-300 font-mono">
                                {testResult.text}
                            </p>
                        </motion.div>
                    )}
                </div>
            </div>
        </div>
    )
}

export default AdminAIPage
