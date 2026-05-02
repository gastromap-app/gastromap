import React, { useState, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
    Settings, Globe, Shield, Activity,
    Save, AlertTriangle, Power, Hammer,
    CheckCircle2, Info, Image as ImageIcon, Upload
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'
import AdminPageHeader, { adminBtnPrimary } from '../components/AdminPageHeader'
import { useAppConfigStore } from '@/shared/store/useAppConfigStore'
import LazyImage from '@/components/ui/LazyImage'

const SettingSection = ({ title, icon: Icon, children }) => (
    <div className="bg-white dark:bg-[hsl(220,20%,6%)]/50 rounded-[28px] lg:rounded-[32px] border border-slate-100 dark:border-white/[0.03] p-6 lg:p-8 shadow-sm">
        <div className="flex items-center gap-3 mb-6">
            <div className="w-9 h-9 rounded-xl bg-indigo-500/10 text-indigo-500 flex items-center justify-center">
                <Icon size={18} />
            </div>
            <h2 className="text-base font-bold text-slate-900 dark:text-white">{title}</h2>
        </div>
        {children}
    </div>
)

const StatusOption = ({ status, currentStatus, title, description, icon: Icon, color, onClick }) => {
    const isActive = currentStatus === status
    return (
        <button
            onClick={() => onClick(status)}
            className={cn(
                "flex items-center gap-4 p-5 rounded-2xl border-2 transition-all text-left",
                isActive
                    ? cn("bg-white dark:bg-[hsl(220,20%,9%)] shadow-xl scale-[1.02]", color.replace('text-', 'border-'))
                    : "bg-slate-50 dark:bg-[hsl(220,20%,9%)]/30 border-transparent hover:bg-white dark:hover:bg-[hsl(220,20%,12%)]"
            )}
        >
            <div className={cn("w-12 h-12 rounded-xl flex items-center justify-center shrink-0", isActive ? color : "bg-slate-200 dark:bg-[hsl(220,20%,12%)] text-slate-400")}>
                <Icon size={24} />
            </div>
            <div className="flex-1 min-w-0">
                <p className={cn("text-sm font-black leading-none mb-1", isActive ? "text-slate-900 dark:text-white" : "text-slate-500")}>{title}</p>
                <p className="text-[10px] text-slate-400 font-medium truncate">{description}</p>
            </div>
            {isActive && <CheckCircle2 size={20} className={cn("shrink-0", color)} />}
        </button>
    )
}

const LogoUpload = ({ label, value, onUpload }) => {
    const { t } = useTranslation()
    const inputRef = useRef(null)
    return (
        <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">{label}</label>
            <div
                role="button"
                tabIndex={0}
                aria-label={`Upload ${label}`}
                onClick={() => inputRef.current?.click()}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') inputRef.current?.click() }}
                className="h-32 bg-slate-100 dark:bg-[hsl(220,20%,9%)] rounded-2xl border-2 border-dashed border-slate-200 dark:border-white/[0.08] flex flex-col items-center justify-center gap-2 cursor-pointer hover:bg-slate-50 hover:border-indigo-400 transition-all group overflow-hidden relative"
            >
                {value ? (
                    <LazyImage src={value} alt="Logo preview" className="w-full h-full object-contain p-4" />
                ) : (
                    <>
                        <ImageIcon size={24} className="text-slate-300 group-hover:text-indigo-500 transition-colors" />
                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{t('admin.settings.click_upload')}</span>
                    </>
                )}
                <input
                    ref={inputRef}
                    type="file"
                    accept="image/png,image/svg+xml,image/jpeg"
                    className="hidden"
                    onChange={(e) => {
                        const file = e.target.files?.[0]
                        if (file) onUpload(URL.createObjectURL(file))
                    }}
                />
            </div>
        </div>
    )
}

const AdminSettingsPage = () => {
    const { t } = useTranslation()
    const config = useAppConfigStore()
    const [formData, setFormData] = useState({
        appName: config.appName,
        appDescription: config.appDescription,
        seoKeywords: config.seoKeywords,
        maintenanceMessage: config.maintenanceMessage,
        logoDark: config.logoDark ?? null,
        logoLight: config.logoLight ?? null,
    })
    const [toast, setToast] = useState(null)

    const showToast = (msg, type = 'success') => {
        setToast({ msg, type })
        setTimeout(() => setToast(null), 3000)
    }

    const handleSave = () => {
        if (!formData.appName?.trim()) {
            showToast(t('admin.settings.name_required'), 'error')
            return
        }
        if (formData.appDescription && formData.appDescription.length > 500) {
            showToast(t('admin.settings.desc_too_long'), 'error')
            return
        }
        config.updateSettings(formData)
        showToast(t('admin.settings.settings_saved'))
    }

    const handleClearCache = () => {
        if (!window.confirm(t('admin.settings.clear_cache_confirm'))) return
        try {
            const keysToRemove = []
            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i)
                if (key && (key.startsWith('nominatim:') || key.startsWith('gastromap:'))) {
                    keysToRemove.push(key)
                }
            }
            keysToRemove.forEach(k => localStorage.removeItem(k))
            showToast(t('admin.settings.cache_cleared', { count: keysToRemove.length }))
        } catch {
            showToast(t('admin.settings.cache_clear_failed'), 'error')
        }
    }

    return (
        <div className="space-y-6 lg:space-y-8 pb-12 font-sans">
            {/* Toast */}
            <AnimatePresence>
                {toast && (
                    <motion.div
                        initial={{ opacity: 0, y: -16 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -16 }}
                        className={cn(
                            "fixed top-24 right-8 z-[9999] px-5 py-3 rounded-2xl text-white text-sm font-semibold shadow-xl border backdrop-blur-md flex items-center gap-2",
                            toast.type === 'error'
                                ? "bg-rose-600/95 border-rose-400/20"
                                : "bg-slate-900/95 border-white/10"
                        )}
                    >
                        <CheckCircle2 size={15} className={toast.type === 'error' ? "text-rose-200" : "text-emerald-400"} />
                        {toast.msg}
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Header */}
            <AdminPageHeader
                eyebrow="Admin"
                title={t('admin.settings.title')}
                subtitle={t('admin.settings.subtitle')}
            />

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
                {/* General Settings */}
                <div className="space-y-8">
                    <SettingSection title={t('admin.settings.general')} icon={Settings}>
                        <div className="space-y-6">
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">{t('admin.settings.app_name')}</label>
                                <input
                                    type="text"
                                    value={formData.appName}
                                    onChange={(e) => setFormData({ ...formData, appName: e.target.value })}
                                    className="w-full h-14 bg-slate-50/50 dark:bg-[hsl(220,20%,9%)]/50 border border-slate-100 dark:border-white/[0.06] rounded-2xl px-6 font-bold text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500 transition-all shadow-inner"
                                    placeholder="GastroMap"
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <LogoUpload
                                    label={t('admin.settings.logo_dark')}
                                    value={formData.logoDark}
                                    onUpload={(url) => setFormData(f => ({ ...f, logoDark: url }))}
                                />
                                <LogoUpload
                                    label={t('admin.settings.logo_light')}
                                    value={formData.logoLight}
                                    onUpload={(url) => setFormData(f => ({ ...f, logoLight: url }))}
                                />
                            </div>
                        </div>
                    </SettingSection>

                    <SettingSection title={t('admin.settings.seo_title')} icon={Globe}>
                        <div className="space-y-6">
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">{t('admin.settings.seo_desc')}</label>
                                <textarea
                                    value={formData.appDescription}
                                    onChange={(e) => setFormData({ ...formData, appDescription: e.target.value })}
                                    rows={4}
                                    className="w-full bg-slate-50/50 dark:bg-[hsl(220,20%,9%)]/50 border border-slate-100 dark:border-white/[0.06] rounded-2xl p-6 font-bold text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500 transition-all shadow-inner resize-none"
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">{t('admin.settings.keywords')}</label>
                                <input
                                    type="text"
                                    value={formData.seoKeywords}
                                    onChange={(e) => setFormData({ ...formData, seoKeywords: e.target.value })}
                                    className="w-full h-14 bg-slate-50/50 dark:bg-[hsl(220,20%,9%)]/50 border border-slate-100 dark:border-white/[0.06] rounded-2xl px-6 font-bold text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500 transition-all shadow-inner"
                                />
                            </div>
                        </div>
                    </SettingSection>
                </div>

                {/* Status & Maintenance */}
                <div className="space-y-8">
                    <SettingSection title={t('admin.settings.app_status')} icon={Activity}>
                        <div className="flex flex-col gap-3">
                            <StatusOption
                                status="active"
                                currentStatus={config.appStatus}
                                title={t('admin.settings.status_live')}
                                description={t('admin.settings.status_live_desc')}
                                icon={Power}
                                color="bg-emerald-500 text-emerald-500"
                                onClick={config.setAppStatus}
                            />
                            <StatusOption
                                status="maintenance"
                                currentStatus={config.appStatus}
                                title={t('admin.settings.status_maintenance')}
                                description={t('admin.settings.status_maintenance_desc')}
                                icon={Hammer}
                                color="bg-amber-500 text-amber-500"
                                onClick={config.setAppStatus}
                            />
                            <StatusOption
                                status="down"
                                currentStatus={config.appStatus}
                                title={t('admin.settings.status_offline')}
                                description={t('admin.settings.status_offline_desc')}
                                icon={AlertTriangle}
                                color="bg-rose-500 text-rose-500"
                                onClick={config.setAppStatus}
                            />
                        </div>

                        <AnimatePresence>
                            {config.appStatus !== 'active' && (
                                <motion.div
                                    initial={{ height: 0, opacity: 0 }}
                                    animate={{ height: 'auto', opacity: 1 }}
                                    exit={{ height: 0, opacity: 0 }}
                                    className="mt-8 pt-8 border-t border-slate-50 dark:border-white/[0.03] space-y-4 overflow-hidden"
                                >
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 italic">{t('admin.settings.maintenance_message')}</label>
                                        <textarea
                                            value={formData.maintenanceMessage}
                                            onChange={(e) => setFormData({ ...formData, maintenanceMessage: e.target.value })}
                                            rows={3}
                                            className="w-full bg-slate-50/50 dark:bg-[hsl(220,20%,9%)]/50 border border-indigo-100 dark:border-indigo-500/20 rounded-2xl p-6 font-bold text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500 transition-all shadow-inner resize-none"
                                        />
                                    </div>
                                    <div className="bg-indigo-50 dark:bg-indigo-500/10 rounded-2xl p-6 flex gap-4">
                                        <Info className="text-indigo-500 shrink-0" size={20} />
                                        <p className="text-[11px] font-medium text-slate-500 dark:text-[hsl(220,10%,55%)] leading-relaxed italic">
                                            {t('admin.settings.admin_access_note')}
                                        </p>
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </SettingSection>

                    <SettingSection title={t('admin.settings.security')} icon={Shield}>
                        <div className="bg-rose-50 dark:bg-rose-500/10 rounded-3xl p-8 border border-rose-100 dark:border-rose-500/20">
                            <h3 className="text-sm font-black text-rose-500 uppercase tracking-widest mb-4">{t('admin.settings.danger_zone')}</h3>
                            <p className="text-xs text-slate-500 dark:text-[hsl(220,10%,55%)] mb-6 leading-relaxed">
                                {t('admin.settings.clear_cache_desc')}
                            </p>
                            <button
                                onClick={handleClearCache}
                                className="w-full h-12 bg-rose-500/10 hover:bg-rose-500 text-rose-500 hover:text-white rounded-xl border border-rose-500/20 font-black text-[10px] uppercase tracking-widest transition-all active:scale-95"
                            >
                                {t('admin.settings.clear_cache_btn')}
                            </button>
                        </div>
                    </SettingSection>
                </div>
            </div>

            {/* Bottom Actions */}
            <div className="flex justify-end pt-6">
                <button 
                    onClick={handleSave} 
                    className={cn(adminBtnPrimary, "h-14 px-10 text-sm shadow-xl shadow-indigo-500/20 active:scale-95")}
                >
                    <Save size={16} /> 
                    <span>{t('admin.settings.save_changes')}</span>
                </button>
            </div>
        </div>
    )
}

export default AdminSettingsPage
