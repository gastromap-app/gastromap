import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
    Bot, MessageSquare, Zap, Shield, Settings,
    Save, Play, Pause, RefreshCw, Sliders, Brain, CheckCircle2
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAppConfigStore } from '@/store/useAppConfigStore'

// ─── Agent card with controllable isActive ─────────────────────────────────
const AgentCard = ({ name, role, isActive, onToggle, icon: Icon, color, description }) => (
    <div className="bg-white dark:bg-slate-900 p-6 lg:p-10 rounded-[28px] lg:rounded-[48px] border border-slate-100 dark:border-slate-800 shadow-sm relative overflow-hidden group hover:border-indigo-500/20 transition-all duration-500">
        <div className={cn("absolute top-0 right-0 w-32 lg:w-48 h-32 lg:h-48 blur-[80px] lg:blur-[100px] opacity-10 transition-opacity group-hover:opacity-20", color.replace('text-', 'bg-'))} />
        <div className="relative z-10">
            <div className="flex justify-between items-start mb-6 lg:mb-8">
                <div className={cn("p-4 lg:p-5 rounded-2xl lg:rounded-[24px] bg-opacity-10 dark:bg-opacity-20 shadow-inner", color, color.replace('bg-', 'text-'))}>
                    <Icon size={28} className="lg:w-8 lg:h-8" />
                </div>
                <div className={cn(
                    "px-3 lg:px-4 py-1 lg:py-1.5 rounded-lg lg:rounded-xl text-[9px] lg:text-[10px] font-bold uppercase tracking-[0.2em] flex items-center gap-1.5",
                    isActive ? 'bg-green-50 dark:bg-green-500/10 text-green-600 dark:text-green-500' : 'bg-slate-50 dark:bg-slate-800 text-slate-400'
                )}>
                    <div className={cn("w-1.5 h-1.5 lg:w-2 lg:h-2 rounded-full", isActive ? 'bg-green-500 animate-pulse' : 'bg-slate-300')} />
                    {isActive ? 'ACTIVE' : 'PAUSED'}
                </div>
            </div>

            <div className="mb-6">
                <h3 className="text-xl lg:text-2xl font-bold text-slate-900 dark:text-white leading-tight mb-1">{name}</h3>
                <p className="text-[10px] font-bold text-indigo-500/80 dark:text-indigo-400/80 uppercase tracking-widest leading-none">{role}</p>
            </div>

            <p className="text-[13px] lg:text-base font-medium text-slate-500 dark:text-slate-400 leading-relaxed mb-8 lg:mb-10 line-clamp-3">{description}</p>

            <div className="flex gap-2">
                <button
                    onClick={onToggle}
                    aria-label={isActive ? `Stop ${name}` : `Start ${name}`}
                    className={cn(
                        "flex-1 flex items-center justify-center gap-2 lg:gap-2.5 py-3 lg:py-4 rounded-xl lg:rounded-2xl font-bold text-[10px] lg:text-[11px] uppercase tracking-widest transition-all active:scale-95 shadow-md",
                        isActive ? 'bg-slate-900 dark:bg-slate-800 text-white shadow-slate-900/10' : 'bg-indigo-600 text-white shadow-indigo-500/20'
                    )}
                >
                    {isActive ? <Pause size={16} /> : <Play size={16} />}
                    {isActive ? 'STOP' : 'START'}
                </button>
                <button
                    aria-label={`${name} settings`}
                    className="p-3 lg:p-4 rounded-xl lg:rounded-2xl bg-slate-50 dark:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-white hover:bg-slate-100 transition-all shadow-inner shrink-0"
                >
                    <Settings size={20} className="lg:w-5 lg:h-5" />
                </button>
            </div>
        </div>
    </div>
)

const AdminAIPage = () => {
    const config = useAppConfigStore()

    // Temperatures — persisted via useAppConfigStore
    const [guideTemp, setGuideTemp] = useState(config.aiGuideTemp ?? 0.7)
    const [assistantTemp, setAssistantTemp] = useState(config.aiAssistantTemp ?? 0.4)

    // Agent active states — persisted locally
    const [agentActive, setAgentActive] = useState({
        guide: config.aiGuideActive ?? true,
        assistant: config.aiAssistantActive ?? true,
    })

    const [saved, setSaved] = useState(false)

    const toggleAgent = (key) => {
        setAgentActive(prev => ({ ...prev, [key]: !prev[key] }))
    }

    const handleSave = () => {
        config.updateSettings({
            aiGuideTemp: guideTemp,
            aiAssistantTemp: assistantTemp,
            aiGuideActive: agentActive.guide,
            aiAssistantActive: agentActive.assistant,
        })
        setSaved(true)
        setTimeout(() => setSaved(false), 2500)
    }

    return (
        <div className="space-y-6 lg:space-y-8 pb-10 font-sans">
            {/* Toast */}
            <AnimatePresence>
                {saved && (
                    <motion.div
                        initial={{ opacity: 0, y: -20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -20 }}
                        className="fixed top-24 right-8 z-[9999] px-5 py-3 rounded-2xl bg-slate-900/95 text-white text-sm font-semibold shadow-xl border border-white/10 backdrop-blur-md flex items-center gap-2"
                    >
                        <CheckCircle2 size={14} className="text-emerald-400" />
                        AI configuration saved.
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-5">
                <div>
                    <h1 className="text-xl lg:text-2xl font-bold text-slate-900 dark:text-white leading-tight">AI Management</h1>
                    <p className="text-slate-500 dark:text-slate-400 font-medium mt-0.5 text-xs lg:text-sm">Configure intelligent agent parameters.</p>
                </div>
                <button
                    onClick={handleSave}
                    className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-2.5 bg-indigo-600 text-white rounded-xl font-bold text-[10px] lg:text-[11px] uppercase tracking-widest shadow-lg shadow-indigo-500/20 active:scale-95 transition-all"
                >
                    <Save size={18} />
                    Save Configuration
                </button>
            </div>

            {/* Agents */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 lg:gap-8">
                <AgentCard
                    name="AI Guide"
                    role="User Support"
                    isActive={agentActive.guide}
                    onToggle={() => toggleAgent('guide')}
                    icon={MessageSquare}
                    color="text-indigo-500"
                    description="Answers user questions, matches locations based on preferences, and helps plan dining routes."
                />
                <AgentCard
                    name="AI Assistant"
                    role="Admin Helper"
                    isActive={agentActive.assistant}
                    onToggle={() => toggleAgent('assistant')}
                    icon={Brain}
                    color="text-purple-500"
                    description="Analyzes trends, monitors review moderation, alerts on critical events, and supports bulk operations."
                />
            </div>

            {/* Global Settings */}
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 lg:gap-8">
                <div className="xl:col-span-2 bg-white dark:bg-slate-900 rounded-[28px] lg:rounded-[48px] border border-slate-100 dark:border-slate-800 shadow-sm p-6 lg:p-10">
                    <div className="flex items-center gap-3 mb-10 pl-1">
                        <div className="w-10 h-10 lg:w-12 lg:h-12 rounded-xl lg:rounded-2xl bg-slate-50 dark:bg-slate-800 flex items-center justify-center text-slate-400 transition-all"><Sliders size={20} className="lg:w-6 lg:h-6" /></div>
                        <h2 className="text-lg lg:text-xl font-bold text-slate-900 dark:text-white">Model Parameters</h2>
                    </div>

                    <div className="space-y-12">
                        {/* Guide Slider */}
                        <div className="space-y-6 lg:space-y-8 bg-slate-50/50 dark:bg-slate-800/30 p-5 lg:p-8 rounded-[24px] lg:rounded-[32px] border border-slate-100 dark:border-slate-800 shadow-inner">
                            <div className="flex justify-between items-start">
                                <div className="min-w-0 flex-1 pr-4">
                                    <h4 className="text-sm lg:text-lg font-bold text-slate-900 dark:text-white leading-tight truncate">AI Guide Creativity</h4>
                                    <p className="text-[10px] lg:text-sm font-medium text-slate-400 dark:text-slate-500 mt-1.5 leading-relaxed truncate">Variety and unpredictability of responses.</p>
                                </div>
                                <span className="bg-white dark:bg-slate-800 px-4 py-2 rounded-xl text-lg lg:text-2xl font-bold text-indigo-600 dark:text-indigo-400 shadow-sm border border-slate-100 dark:border-slate-700 min-w-[50px] lg:min-w-[60px] text-center leading-none">{guideTemp}</span>
                            </div>
                            <div className="relative py-2 leading-none">
                                <input
                                    type="range" min="0" max="1" step="0.1" value={guideTemp}
                                    onChange={(e) => setGuideTemp(parseFloat(e.target.value))}
                                    aria-label="AI Guide temperature"
                                    className="w-full h-1.5 lg:h-2 bg-slate-200 dark:bg-slate-700/50 rounded-full appearance-none cursor-pointer accent-indigo-600"
                                />
                                <div className="flex justify-between text-[9px] font-bold text-slate-300 uppercase tracking-widest mt-2">
                                    <span>Precise</span><span>Creative</span>
                                </div>
                            </div>
                        </div>

                        {/* Assistant Slider */}
                        <div className="space-y-6 lg:space-y-8 bg-slate-50/50 dark:bg-slate-800/30 p-5 lg:p-8 rounded-[24px] lg:rounded-[32px] border border-slate-100 dark:border-slate-800 shadow-inner">
                            <div className="flex justify-between items-start">
                                <div className="min-w-0 flex-1 pr-4">
                                    <h4 className="text-sm lg:text-lg font-bold text-slate-900 dark:text-white leading-tight truncate">AI Assistant Precision</h4>
                                    <p className="text-[10px] lg:text-sm font-medium text-slate-400 dark:text-slate-500 mt-1.5 leading-relaxed truncate">Strictness and accuracy of analytical responses.</p>
                                </div>
                                <span className="bg-white dark:bg-slate-800 px-4 py-2 rounded-xl text-lg lg:text-2xl font-bold text-purple-600 dark:text-purple-400 shadow-sm border border-slate-100 dark:border-slate-700 min-w-[50px] lg:min-w-[60px] text-center leading-none">{assistantTemp}</span>
                            </div>
                            <div className="relative py-2 leading-none">
                                <input
                                    type="range" min="0" max="1" step="0.1" value={assistantTemp}
                                    onChange={(e) => setAssistantTemp(parseFloat(e.target.value))}
                                    aria-label="AI Assistant temperature"
                                    className="w-full h-1.5 lg:h-2 bg-slate-200 dark:bg-slate-700/50 rounded-full appearance-none cursor-pointer accent-purple-600"
                                />
                                <div className="flex justify-between text-[9px] font-bold text-slate-300 uppercase tracking-widest mt-2">
                                    <span>Precise</span><span>Creative</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* System Stats */}
                <div className="bg-white dark:bg-slate-900 rounded-[28px] lg:rounded-[48px] border border-slate-100 dark:border-slate-800 shadow-sm p-6 lg:p-8 flex flex-col">
                    <h2 className="text-[9px] lg:text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500 mb-8 lg:mb-10 pl-1">System Status</h2>
                    <div className="space-y-8 flex-1 pl-1">
                        <div className="flex items-center justify-between group">
                            <div className="flex items-center gap-4">
                                <div className="w-10 h-10 rounded-xl bg-yellow-50 dark:bg-yellow-500/10 text-yellow-500 flex items-center justify-center shadow-inner group-hover:scale-105 transition-transform"><Zap size={18} /></div>
                                <span className="text-[13px] lg:text-sm font-bold text-slate-600 dark:text-slate-400 group-hover:text-slate-900 dark:group-hover:text-white transition-colors">Latency</span>
                            </div>
                            <span className="text-[13px] lg:text-sm font-bold text-green-500">~240ms</span>
                        </div>
                        <div className="flex items-center justify-between group">
                            <div className="flex items-center gap-4">
                                <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-500/10 text-indigo-500 flex items-center justify-center shadow-inner group-hover:scale-105 transition-transform"><Shield size={18} /></div>
                                <span className="text-[13px] lg:text-sm font-bold text-slate-600 dark:text-slate-400 group-hover:text-slate-900 dark:group-hover:text-white transition-colors">Agents Active</span>
                            </div>
                            <span className="text-[13px] lg:text-sm font-bold text-slate-900 dark:text-white">
                                {[agentActive.guide, agentActive.assistant].filter(Boolean).length}/2
                            </span>
                        </div>
                        <div className="flex items-center justify-between group">
                            <div className="flex items-center gap-4">
                                <div className="w-10 h-10 rounded-xl bg-slate-50 dark:bg-slate-800 text-slate-300 flex items-center justify-center shadow-inner group-hover:scale-105 transition-transform"><RefreshCw size={18} /></div>
                                <span className="text-[13px] lg:text-sm font-bold text-slate-600 dark:text-slate-400 group-hover:text-slate-900 dark:group-hover:text-white transition-colors">Config Saved</span>
                            </div>
                            <span className="text-[13px] lg:text-sm font-bold text-slate-400 dark:text-slate-600">{saved ? 'Just now' : 'Pending'}</span>
                        </div>
                    </div>

                    <div className="mt-10 p-5 lg:p-6 rounded-[24px] lg:rounded-[32px] bg-slate-50 dark:bg-slate-800/20 border border-slate-100 dark:border-slate-800 relative overflow-hidden group">
                        <div className="absolute top-0 right-0 w-16 h-16 bg-indigo-500 blur-2xl opacity-10 group-hover:scale-125 transition-all" />
                        <p className="text-[11px] lg:text-sm font-medium text-slate-600 dark:text-slate-400 leading-relaxed italic relative z-10">
                            {agentActive.guide && agentActive.assistant
                                ? '"All systems stable. Both agents operational."'
                                : agentActive.guide
                                    ? '"AI Guide active. AI Assistant is paused."'
                                    : agentActive.assistant
                                        ? '"AI Assistant active. AI Guide is paused."'
                                        : '"All agents are currently paused."'}
                        </p>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default AdminAIPage
