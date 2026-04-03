/**
 * Admin Notifications Settings Page
 *
 * Configure notification types, templates, and system-wide settings.
 */

import React, { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import {
    Bell, BellOff, Send, Settings, Users, MapPin, Star,
    Check, X, Save, RefreshCw, TestTube, Shield, Globe,
    ToggleLeft, ToggleRight, AlertCircle, CheckCircle2
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useNotificationStore } from '@/store/useNotificationStore'
import {
    NOTIFICATION_TYPES,
    getPermissionStatus,
    requestPermission,
    showLocalNotification,
    subscribeToPush,
    unsubscribeFromPush,
} from '@/shared/api/notifications.api'

// ─── Notification Type Card ────────────────────────────────────────────────

const NotificationTypeCard = ({ type, enabled, onToggle }) => (
    <div className={cn(
        'p-4 rounded-xl border transition-all',
        enabled
            ? 'border-indigo-200 dark:border-indigo-500/30 bg-indigo-50/50 dark:bg-indigo-500/5'
            : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900'
    )}>
        <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3">
                <span className="text-2xl flex-shrink-0">{type.icon}</span>
                <div>
                    <h4 className="font-bold text-slate-900 dark:text-white text-sm">
                        {type.label}
                    </h4>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                        {type.description}
                    </p>
                    {type.adminOnly && (
                        <span className="inline-flex items-center gap-1 mt-2 px-2 py-0.5 bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-300 text-[10px] font-bold rounded-full">
                            <Shield size={10} />
                            Admin Only
                        </span>
                    )}
                </div>
            </div>
            <button
                onClick={() => onToggle(type.id)}
                className={cn(
                    'p-1 rounded-lg transition-colors',
                    enabled
                        ? 'text-indigo-500 hover:text-indigo-600'
                        : 'text-slate-400 hover:text-slate-500'
                )}
            >
                {enabled ? (
                    <ToggleRight size={24} className="text-indigo-500" />
                ) : (
                    <ToggleLeft size={24} />
                )}
            </button>
        </div>
    </div>
)

// ─── Main Page ──────────────────────────────────────────────────────────────

const AdminNotificationsPage = () => {
    const {
        preferences,
        permissionStatus,
        pushEnabled,
        setPermissionStatus,
        setPushEnabled,
        togglePreference,
        resetPreferences,
    } = useNotificationStore()

    const [saved, setSaved] = useState(false)
    const [testing, setTesting] = useState(false)
    const [testResult, setTestResult] = useState(null)

    // Check permission on mount
    useEffect(() => {
        const status = getPermissionStatus()
        setPermissionStatus(status)
    }, [setPermissionStatus])

    const handleRequestPermission = async () => {
        const status = await requestPermission()
        setPermissionStatus(status)

        if (status === 'granted') {
            const subscription = await subscribeToPush()
            setPushEnabled(!!subscription)
        }
    }

    const handleTogglePush = async () => {
        if (pushEnabled) {
            await unsubscribeFromPush()
            setPushEnabled(false)
        } else {
            await handleRequestPermission()
        }
    }

    const handleSave = () => {
        // Preferences are auto-saved via zustand persist
        setSaved(true)
        setTimeout(() => setSaved(false), 2500)
    }

    const handleTestNotification = async () => {
        setTesting(true)
        setTestResult(null)

        try {
            if (permissionStatus !== 'granted') {
                throw new Error('Notification permission not granted')
            }

            await showLocalNotification('Test Notification from GastroMap', {
                body: 'If you see this, push notifications are working correctly!',
                tag: 'test',
            })

            setTestResult({ success: true, message: 'Notification sent!' })
        } catch (err) {
            setTestResult({ success: false, message: err.message })
        } finally {
            setTesting(false)
        }
    }

    // Separate user and admin notification types
    const userTypes = Object.values(NOTIFICATION_TYPES).filter(t => !t.adminOnly)
    const adminTypes = Object.values(NOTIFICATION_TYPES).filter(t => t.adminOnly)

    return (
        <div className="max-w-4xl mx-auto px-6 py-10">
            {/* Header */}
            <div className="mb-10">
                <h1 className="text-4xl font-black text-slate-900 dark:text-white mb-3 tracking-tight">
                    Notifications
                </h1>
                <p className="text-slate-500 dark:text-slate-400 text-lg">
                    Configure push notification settings and types
                </p>
            </div>

            {/* Permission Status */}
            <section className="mb-10">
                <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-6 flex items-center gap-2">
                    <Bell className="text-indigo-500" size={24} />
                    Permission Status
                </h2>
                <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-700">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <div className={cn(
                                'w-12 h-12 rounded-xl flex items-center justify-center',
                                permissionStatus === 'granted'
                                    ? 'bg-green-100 dark:bg-green-500/20'
                                    : permissionStatus === 'denied'
                                        ? 'bg-red-100 dark:bg-red-500/20'
                                        : 'bg-slate-100 dark:bg-slate-800'
                            )}>
                                {permissionStatus === 'granted' ? (
                                    <Bell className="text-green-500" size={24} />
                                ) : permissionStatus === 'denied' ? (
                                    <BellOff className="text-red-500" size={24} />
                                ) : (
                                    <BellOff className="text-slate-400" size={24} />
                                )}
                            </div>
                            <div>
                                <h3 className="font-bold text-slate-900 dark:text-white">
                                    {permissionStatus === 'granted'
                                        ? 'Notifications Enabled'
                                        : permissionStatus === 'denied'
                                            ? 'Notifications Blocked'
                                            : permissionStatus === 'unsupported'
                                                ? 'Not Supported'
                                                : 'Permission Required'}
                                </h3>
                                <p className="text-sm text-slate-500">
                                    {permissionStatus === 'granted'
                                        ? 'Your browser will receive push notifications'
                                        : permissionStatus === 'denied'
                                            ? 'Enable notifications in your browser settings'
                                            : 'Click to request notification permission'}
                                </p>
                            </div>
                        </div>

                        {permissionStatus !== 'unsupported' && (
                            <button
                                onClick={handleTogglePush}
                                disabled={permissionStatus === 'denied'}
                                className={cn(
                                    'px-4 py-2 rounded-xl font-bold text-sm transition-all',
                                    permissionStatus === 'denied'
                                        ? 'bg-slate-200 dark:bg-slate-700 text-slate-400 cursor-not-allowed'
                                        : pushEnabled
                                            ? 'bg-red-100 dark:bg-red-500/20 text-red-600 dark:text-red-400 hover:bg-red-200 dark:hover:bg-red-500/30'
                                            : 'bg-indigo-600 text-white hover:bg-indigo-700'
                                )}
                            >
                                {pushEnabled ? 'Disable' : 'Enable'}
                            </button>
                        )}
                    </div>

                    {permissionStatus === 'denied' && (
                        <div className="mt-4 p-3 bg-amber-50 dark:bg-amber-500/10 rounded-xl border border-amber-200 dark:border-amber-500/20">
                            <p className="text-sm text-amber-800 dark:text-amber-200">
                                <strong>Tip:</strong> Open your browser settings to allow notifications for this site.
                            </p>
                        </div>
                    )}
                </div>
            </section>

            {/* Test Notification */}
            <section className="mb-10">
                <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-6 flex items-center gap-2">
                    <TestTube className="text-indigo-500" size={24} />
                    Test Notifications
                </h2>
                <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-700">
                    <div className="flex items-center gap-4">
                        <button
                            onClick={handleTestNotification}
                            disabled={testing || permissionStatus !== 'granted'}
                            className={cn(
                                'px-6 py-3 rounded-xl font-bold flex items-center gap-2 transition-all',
                                testing || permissionStatus !== 'granted'
                                    ? 'bg-slate-200 dark:bg-slate-700 text-slate-400 cursor-not-allowed'
                                    : 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-md shadow-indigo-500/20'
                            )}
                        >
                            {testing ? (
                                <RefreshCw className="animate-spin" size={18} />
                            ) : (
                                <Send size={18} />
                            )}
                            Send Test
                        </button>

                        <p className="text-sm text-slate-500">
                            Send a test notification to verify everything works
                        </p>
                    </div>

                    {testResult && (
                        <motion.div
                            initial={{ opacity: 0, y: -10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className={cn(
                                'mt-4 p-3 rounded-xl flex items-center gap-2',
                                testResult.success
                                    ? 'bg-green-50 dark:bg-green-500/10 text-green-700 dark:text-green-300'
                                    : 'bg-red-50 dark:bg-red-500/10 text-red-700 dark:text-red-300'
                            )}
                        >
                            {testResult.success ? (
                                <CheckCircle2 size={18} />
                            ) : (
                                <AlertCircle size={18} />
                            )}
                            {testResult.message}
                        </motion.div>
                    )}
                </div>
            </section>

            {/* User Notification Types */}
            <section className="mb-10">
                <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-6 flex items-center gap-2">
                    <Users className="text-indigo-500" size={24} />
                    User Notification Types
                </h2>
                <div className="grid sm:grid-cols-2 gap-4">
                    {userTypes.map((type) => (
                        <NotificationTypeCard
                            key={type.id}
                            type={type}
                            enabled={preferences[type.id]}
                            onToggle={togglePreference}
                        />
                    ))}
                </div>
            </section>

            {/* Admin Notification Types */}
            <section className="mb-10">
                <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-6 flex items-center gap-2">
                    <Shield className="text-indigo-500" size={24} />
                    Admin Notification Types
                </h2>
                <div className="grid sm:grid-cols-2 gap-4">
                    {adminTypes.map((type) => (
                        <NotificationTypeCard
                            key={type.id}
                            type={type}
                            enabled={preferences[type.id]}
                            onToggle={togglePreference}
                        />
                    ))}
                </div>
            </section>

            {/* Footer Actions */}
            <div className="flex items-center justify-between sticky bottom-6 bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-lg">
                <button
                    onClick={resetPreferences}
                    className="px-4 py-2 text-sm text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"
                >
                    Reset to Defaults
                </button>

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
                    <button
                        onClick={handleSave}
                        className="px-8 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold flex items-center gap-2 transition-all active:scale-95 shadow-md shadow-indigo-500/20"
                    >
                        <Save size={18} />
                        Save Settings
                    </button>
                </div>
            </div>
        </div>
    )
}

export default AdminNotificationsPage
