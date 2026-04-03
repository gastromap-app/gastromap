import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
    Bot, MessageSquare, Zap, Shield, Settings,
    Save, Play, Pause, RefreshCw, Sliders, Brain,
    CheckCircle2, ChevronDown, ChevronUp, Send,
    Loader2, AlertCircle, Eye, EyeOff, Star, Globe, Cpu
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAppConfigStore } from '@/store/useAppConfigStore'
import { config } from '@/shared/config/env'

// ─── Available OpenRouter free models (March 2026) ──────────────────────────

const FREE_MODELS = [
    {
        id: 'mistralai/devstral-2512:free',
        name: 'Devstral 2',
        provider: 'Mistral',
        context: '256K',
        languages: 'EN / RU / PL / UA',
        badge: 'Recommended',
        badgeColor: 'bg-indigo-100 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400',
        description: 'Best agentic model with strong tool use. Excellent for chat and recommendations.',
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
        description: 'Reliable multilingual model with strong reasoning. Great fallback option.',
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
        description: 'Fast hybrid thinking mode. Good balance of speed and quality.',
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
        description: 'OpenAI open-weight model. Strong function calling and reasoning.',
        toolUse: true,
    },
    {
        id: 'nvidia/nemotron-nano-9b-v2:free',
        name: 'Nemotron Nano 9B v2',
        provider: 'NVIDIA',
        context: '128K',
        languages: 'EN / multilingual',
        badge: 'Fastest',
        badgeColor: 'bg-orange-100 dark:bg-orange-500/20 text-orange-600 dark:text-orange-400',
        description: 'Lightning-fast responses. Perfect for quick queries.',
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
        id: 'meta-llama/llama-3.3-70b-instruct:free',
        name: 'Llama 3.3 70B',
        provider: 'Meta',
        context: '131K',
        languages: 'EN / RU / PL',
        badge: 'Reliable',
        badgeColor: 'bg-rose-100 dark:bg-rose-500/20 text-rose-600 dark:text-rose-400',
        description: 'Well-known model. May be rate-limited during peak hours.',
        toolUse: true,
    },
    {
        id: 'qwen/qwen3-coder:free',
        name: 'Qwen3 Coder',
        provider: 'Alibaba',
        context: '262K',
        languages: '100+ incl. RU / PL / UA',
        badge: 'Large Context',
        badgeColor: 'bg-purple-100 dark:bg-purple-500/20 text-purple-600 dark:text-purple-400',
        description: 'Largest context window. Strong multilingual. Often rate-limited.',
        toolUse: true,
    },
]

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions'

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

    // ── Agents
    const [agentActive, setAgentActive] = useState({
        guide: appConfig.aiGuideActive ?? true,
        assistant: appConfig.aiAssistantActive ?? true,
    })

    // ── Models
    const [primaryModel, setPrimaryModel] = useState(
        appConfig.aiPrimaryModel || 'meta-llama/llama-3.3-70b-instruct:free'
    )
    const [fallbackModel, setFallbackModel] = useState(
        appConfig.aiFallbackModel || 'qwen/qwen3-coder:free'
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
        })
        setSaved(true)
        setTimeout(() => setSaved(false), 2500)
    }

    // ── Test model call (simple direct fetch, no tool use, just verify connectivity)
    const handleTest = async () => {
        const useProxy = config.ai.useProxy
        if (!testMessage.trim() || (!apiKey && !useProxy)) return

        setTesting(true)
        setTestResult(null)

        const modelId = testModel === 'primary' ? primaryModel : fallbackModel
        const startTime = performance.now()

        try {
            const url = useProxy ? config.ai.proxyUrl : OPENROUTER_URL
            const headers = { 'Content-Type': 'application/json' }
            if (!useProxy) {
                headers['Authorization'] = `Bearer ${apiKey}`
                headers['HTTP-Referer'] = window.location.origin
                headers['X-Title'] = 'GastroMap Admin'
            }

            const response = await fetch(url, {
                method: 'POST',
                headers,
                body: JSON.stringify({
                    model: modelId,
                    messages: [
                        { role: 'system', content: 'You are a helpful assistant. Keep responses under 2 sentences.' },
                        { role: 'user', content: testMessage },
                    ],
                    max_tokens: 100,
                }),
            })

            const latency = Math.round(performance.now() - startTime)

            if (!response.ok) {
                const errorText = await response.text()
                throw new Error(`HTTP ${response.status}: ${errorText}`)
            }

            const data = await response.json()
            const text = data.choices?.[0]?.message?.content || '(no response)'
            // Show which model the proxy actually used (may differ from requested due to cascade)
            const actualModel = data._model_used || modelId

            setTestResult({
                ok: true,
                text,
                latency,
                model: actualModel,
            })
        } catch (err) {
            const latency = Math.round(performance.now() - startTime)
            setTestResult({
                ok: false,
                text: err.message,
                latency,
                model: modelId,
            })
        } finally {
            setTesting(false)
        }
    }

    return (
        <div className="max-w-6xl mx-auto px-6 py-10">
            {/* Header */}
            <div className="mb-10">
                <h1 className="text-4xl font-black text-slate-900 dark:text-white mb-3 tracking-tight">
                    AI & Agents
                </h1>
                <p className="text-slate-500 dark:text-slate-400 text-lg">
                    Configure GastroGuide AI models, agents, and API settings
                </p>
            </div>

            {/* Agents */}
            <section className="mb-10">
                <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-6 flex items-center gap-2">
                    <Bot className="text-indigo-500" size={24} />
                    Active Agents
                </h2>
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
            </section>

            {/* AI Models */}
            <section className="mb-10">
                <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-6 flex items-center gap-2">
                    <Cpu className="text-indigo-500" size={24} />
                    AI Models (OpenRouter Free)
                </h2>

                <div className="grid md:grid-cols-2 gap-6 mb-6">
                    {/* Primary Model */}
                    <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-700">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="font-bold text-slate-900 dark:text-white">Primary Model</h3>
                            <button
                                onClick={() => setShowPrimaryPicker(!showPrimaryPicker)}
                                className="text-indigo-600 dark:text-indigo-400 text-sm font-bold flex items-center gap-1 hover:underline"
                            >
                                {showPrimaryPicker ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
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
                                    <span className="font-bold text-slate-900 dark:text-white">{getPrimaryInfo().name}</span>
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
                    <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-700">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="font-bold text-slate-900 dark:text-white">Fallback Model</h3>
                            <button
                                onClick={() => setShowFallbackPicker(!showFallbackPicker)}
                                className="text-indigo-600 dark:text-indigo-400 text-sm font-bold flex items-center gap-1 hover:underline"
                            >
                                {showFallbackPicker ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
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
                            <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700">
                                <div className="flex items-center justify-between mb-2">
                                    <span className="font-bold text-slate-900 dark:text-white">{getFallbackInfo().name}</span>
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

                {/* Model tips */}
                <div className="p-4 bg-amber-50 dark:bg-amber-500/10 rounded-xl border border-amber-200 dark:border-amber-500/20">
                    <p className="text-sm text-amber-800 dark:text-amber-300">
                        <strong>💡 Tip:</strong> If your primary model is overloaded or slow, switch to <strong>Step 3.5 Flash</strong> for fastest responses or <strong>Nemotron 3 Nano</strong> for balanced performance.
                    </p>
                </div>
            </section>

            {/* API Key */}
            <section className="mb-10">
                <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-6 flex items-center gap-2">
                    <Shield className="text-indigo-500" size={24} />
                    OpenRouter API Key
                </h2>
                <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-700">
                    <div className="flex gap-3 mb-4">
                        <div className="flex-1 relative">
                            <input
                                type={showKey ? 'text' : 'password'}
                                value={apiKey}
                                onChange={(e) => setApiKey(e.target.value)}
                                placeholder="sk-or-v1-..."
                                className="w-full px-4 py-3 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-mono text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            />
                            <button
                                onClick={() => setShowKey(!showKey)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                                aria-label={showKey ? 'Hide API key' : 'Show API key'}
                            >
                                {showKey ? <EyeOff size={18} /> : <Eye size={18} />}
                            </button>
                        </div>
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                        Get your free API key from{' '}
                        <a href="https://openrouter.ai/keys" target="_blank" rel="noopener noreferrer" className="text-indigo-600 dark:text-indigo-400 hover:underline">
                            openrouter.ai/keys
                        </a>
                    </p>
                </div>
            </section>

            {/* Temperature */}
            <section className="mb-10">
                <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-6 flex items-center gap-2">
                    <Sliders className="text-indigo-500" size={24} />
                    Temperature Settings
                </h2>
                <div className="grid md:grid-cols-2 gap-6">
                    <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-700">
                        <h3 className="font-bold text-slate-900 dark:text-white mb-4">GastroGuide Temperature</h3>
                        <input
                            type="range"
                            min="0"
                            max="2"
                            step="0.1"
                            value={guideTemp}
                            onChange={(e) => setGuideTemp(parseFloat(e.target.value))}
                            className="w-full accent-indigo-600"
                        />
                        <div className="flex justify-between text-xs text-slate-500 mt-2">
                            <span>Precise (0)</span>
                            <span className="font-mono font-bold text-indigo-600">{guideTemp.toFixed(1)}</span>
                            <span>Creative (2)</span>
                        </div>
                    </div>
                    <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-700">
                        <h3 className="font-bold text-slate-900 dark:text-white mb-4">Assistant Temperature</h3>
                        <input
                            type="range"
                            min="0"
                            max="2"
                            step="0.1"
                            value={assistantTemp}
                            onChange={(e) => setAssistantTemp(parseFloat(e.target.value))}
                            className="w-full accent-indigo-600"
                        />
                        <div className="flex justify-between text-xs text-slate-500 mt-2">
                            <span>Precise (0)</span>
                            <span className="font-mono font-bold text-indigo-600">{assistantTemp.toFixed(1)}</span>
                            <span>Creative (2)</span>
                        </div>
                    </div>
                </div>
            </section>

            {/* Test Panel */}
            <section className="mb-10">
                <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-6 flex items-center gap-2">
                    <Play className="text-indigo-500" size={24} />
                    Test Model
                </h2>
                <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-700">
                    <div className="flex gap-3 mb-4">
                        <select
                            value={testModel}
                            onChange={(e) => setTestModel(e.target.value)}
                            className="px-4 py-3 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        >
                            <option value="primary">Primary: {getPrimaryInfo().name}</option>
                            <option value="fallback">Fallback: {getFallbackInfo().name}</option>
                        </select>
                        <input
                            type="text"
                            value={testMessage}
                            onChange={(e) => setTestMessage(e.target.value)}
                            placeholder="Test message..."
                            className="flex-1 px-4 py-3 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            onKeyDown={(e) => e.key === 'Enter' && handleTest()}
                        />
                        <button
                            onClick={handleTest}
                            disabled={testing || !testMessage.trim() || (!apiKey && !config.ai.useProxy)}
                            className={cn(
                                'px-6 py-3 rounded-xl font-bold text-white flex items-center gap-2 transition-all active:scale-95',
                                testing || !testMessage.trim() || (!apiKey && !config.ai.useProxy)
                                    ? 'bg-slate-300 dark:bg-slate-700 cursor-not-allowed'
                                    : 'bg-indigo-600 hover:bg-indigo-700 shadow-md shadow-indigo-500/20'
                            )}
                        >
                            {testing ? <Loader2 className="animate-spin" size={18} /> : <Play size={18} />}
                            Test
                        </button>
                    </div>

                    {testResult && (
                        <div className={cn(
                            'p-4 rounded-xl border',
                            testResult.ok
                                ? 'bg-green-50 dark:bg-green-500/10 border-green-200 dark:border-green-500/20'
                                : 'bg-red-50 dark:bg-red-500/10 border-red-200 dark:border-red-500/20'
                        )}>
                            <div className="flex items-center gap-2 mb-2">
                                {testResult.ok ? (
                                    <CheckCircle2 className="text-green-600 dark:text-green-400" size={20} />
                                ) : (
                                    <AlertCircle className="text-red-600 dark:text-red-400" size={20} />
                                )}
                                <span className="font-bold text-sm">
                                    {testResult.ok ? 'Success' : 'Error'}
                                </span>
                                <span className="text-xs text-slate-500 ml-auto">
                                    Model: {testResult.model} | Latency: {testResult.latency}ms
                                </span>
                            </div>
                            <p className="text-sm text-slate-700 dark:text-slate-300 font-mono">
                                {testResult.text}
                            </p>
                        </div>
                    )}
                </div>
            </section>

            {/* Save */}
            <div className="flex items-center justify-between sticky bottom-6 bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-lg">
                <div className="flex items-center gap-3">
                    {saved && (
                        <motion.div
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            className="flex items-center gap-2 text-green-600 dark:text-green-400 font-bold text-sm"
                        >
                            <CheckCircle2 size={18} />
                            Saved!
                        </motion.div>
                    )}
                </div>
                <button
                    onClick={handleSave}
                    className="px-8 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold flex items-center gap-2 transition-all active:scale-95 shadow-md shadow-indigo-500/20"
                >
                    <Save size={18} />
                    Save Settings
                </button>
            </div>
        </div>
    )
}

export default AdminAIPage
