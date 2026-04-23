/**
 * Notification Bell Component
 *
 * Displays notification count badge and opens notification center.
 * Used in app header.
 */

import React, { useState, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Bell, X, Check, CheckCheck, Settings, Trash2, ExternalLink } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useNotificationStore, useUnreadCount } from '@/shared/store/useNotificationStore'
import {
    getNotificationHistory,
    markNotificationRead,
    markAllNotificationsRead,
    requestPermission,
    getPermissionStatus,
    subscribeToPush,
    unsubscribeFromPush,
    NOTIFICATION_TYPES,
} from '@/shared/api/notifications.api'
import { formatDistanceToNow } from '@/lib/date'

const NotificationBell = ({ className }) => {
    const [isOpen, setIsOpen] = useState(false)
    const dropdownRef = useRef(null)

    const unreadCount = useUnreadCount()
    const {
        notifications,
        permissionStatus,
        pushEnabled,
        setPermissionStatus,
        setPushEnabled,
        setNotifications,
        markAsRead,
        markAllAsRead,
        setLoading,
        loading,
    } = useNotificationStore()

    // Close on click outside
    useEffect(() => {
        const handleClickOutside = (e) => {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
                setIsOpen(false)
            }
        }

        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside)
        }

        return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [isOpen])
    const fetchNotifications = useCallback(async () => {
        setLoading(true)
        try {
            const history = await getNotificationHistory(20)
            setNotifications(history)
        } catch (err) {
            console.warn('Could not fetch notifications:', err)
        } finally {
            setLoading(false)
        }
    }, [setLoading, setNotifications])

    // Fetch notifications on mount and when dropdown opens
    useEffect(() => {
        if (isOpen) {
            fetchNotifications()
        }
    }, [isOpen, fetchNotifications])

    // Check permission status on mount
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

    const handleMarkRead = async (id) => {
        markAsRead(id)
        await markNotificationRead(id)
    }

    const handleMarkAllRead = async () => {
        markAllAsRead()
        await markAllNotificationsRead()
    }

    const getTypeIcon = (type) => {
        const typeConfig = Object.values(NOTIFICATION_TYPES).find(t => t.id === type)
        return typeConfig?.icon || '🔔'
    }

    return (
        <div className={cn('relative', className)} ref={dropdownRef}>
            {/* Bell Button */}
            <button
                onClick={() => setIsOpen(!isOpen)}
                className={cn(
                    'relative p-2 rounded-xl transition-all',
                    'hover:bg-slate-100 dark:hover:bg-slate-800',
                    isOpen && 'bg-slate-100 dark:bg-slate-800'
                )}
                aria-label={`Notifications ${unreadCount > 0 ? `(${unreadCount} unread)` : ''}`}
            >
                <Bell
                    size={20}
                    className={cn(
                        'transition-colors',
                        unreadCount > 0
                            ? 'text-indigo-500'
                            : 'text-slate-500 dark:text-slate-400'
                    )}
                />

                {/* Unread Badge */}
                <AnimatePresence>
                    {unreadCount > 0 && (
                        <motion.span
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            exit={{ scale: 0 }}
                            className="absolute -top-1 -right-1 min-w-[18px] h-[18px] flex items-center justify-center bg-red-500 text-white text-[10px] font-bold rounded-full px-1"
                        >
                            {unreadCount > 9 ? '9+' : unreadCount}
                        </motion.span>
                    )}
                </AnimatePresence>
            </button>

            {/* Dropdown */}
            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ opacity: 0, y: -10, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -10, scale: 0.95 }}
                        transition={{ duration: 0.15 }}
                        className={cn(
                            'absolute right-0 top-full mt-2 w-80 sm:w-96',
                            'bg-white dark:bg-slate-900 rounded-2xl shadow-xl',
                            'border border-slate-200 dark:border-slate-700',
                            'overflow-hidden z-50'
                        )}
                    >
                        {/* Header */}
                        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-slate-700">
                            <h3 className="font-bold text-slate-900 dark:text-white">
                                Notifications
                            </h3>
                            <div className="flex items-center gap-1">
                                {unreadCount > 0 && (
                                    <button
                                        onClick={handleMarkAllRead}
                                        className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                                        title="Mark all as read"
                                    >
                                        <CheckCheck size={16} />
                                    </button>
                                )}
                                <button
                                    onClick={() => setIsOpen(false)}
                                    className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500"
                                >
                                    <X size={16} />
                                </button>
                            </div>
                        </div>

                        {/* Permission Banner (if not granted) */}
                        {permissionStatus !== 'granted' && permissionStatus !== 'unsupported' && (
                            <div className="p-4 bg-indigo-50 dark:bg-indigo-500/10 border-b border-indigo-200 dark:border-indigo-500/20">
                                <p className="text-sm text-indigo-700 dark:text-indigo-300 mb-2">
                                    Enable notifications to get updates about recommendations, approvals, and more.
                                </p>
                                <button
                                    onClick={handleRequestPermission}
                                    className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold rounded-lg transition-colors"
                                >
                                    Enable Notifications
                                </button>
                            </div>
                        )}

                        {/* Notification List */}
                        <div className="max-h-80 overflow-y-auto">
                            {loading ? (
                                <div className="p-8 text-center text-slate-500">
                                    <div className="w-6 h-6 border-2 border-slate-300 border-t-indigo-500 rounded-full animate-spin mx-auto mb-2" />
                                    Loading...
                                </div>
                            ) : notifications.length === 0 ? (
                                <div className="p-8 text-center text-slate-500">
                                    <Bell size={32} className="mx-auto mb-2 opacity-30" />
                                    <p className="text-sm">No notifications yet</p>
                                </div>
                            ) : (
                                <div className="divide-y divide-slate-100 dark:divide-slate-800">
                                    {notifications.map((notification) => (
                                        <div
                                            key={notification.id}
                                            className={cn(
                                                'p-3 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors cursor-pointer',
                                                !notification.read && 'bg-indigo-50/50 dark:bg-indigo-500/5'
                                            )}
                                            onClick={() => handleMarkRead(notification.id)}
                                        >
                                            <div className="flex gap-3">
                                                <span className="text-lg flex-shrink-0">
                                                    {getTypeIcon(notification.type)}
                                                </span>
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-sm font-medium text-slate-900 dark:text-white truncate">
                                                        {notification.title}
                                                    </p>
                                                    <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2">
                                                        {notification.body}
                                                    </p>
                                                    <p className="text-[10px] text-slate-400 mt-1">
                                                        {formatDistanceToNow(new Date(notification.created_at || notification.createdAt))}
                                                    </p>
                                                </div>
                                                {!notification.read && (
                                                    <div className="w-2 h-2 bg-indigo-500 rounded-full flex-shrink-0 mt-2" />
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Footer */}
                        <div className="flex items-center justify-between px-4 py-2 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
                            <label className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={pushEnabled}
                                    onChange={handleTogglePush}
                                    className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                                />
                                Push enabled
                            </label>
                            <a
                                href="/settings/notifications"
                                className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1"
                            >
                                <Settings size={12} />
                                Settings
                            </a>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    )
}

export default NotificationBell
