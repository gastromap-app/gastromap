import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Hammer, AlertTriangle, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAppConfigStore } from '@/shared/store/useAppConfigStore'

const DISMISS_KEY = 'admin-banner-dismissed'

const STATUS_CONFIG = {
    maintenance: {
        icon: Hammer,
        label: 'Maintenance',
        note: 'Regular users see the maintenance page',
        bg: 'bg-amber-50 dark:bg-amber-950/30',
        border: 'border-amber-200 dark:border-amber-800/50',
        text: 'text-amber-700 dark:text-amber-300',
        iconColor: 'text-amber-500 dark:text-amber-400',
        dismissHover: 'hover:bg-amber-100 dark:hover:bg-amber-900/40',
    },
    down: {
        icon: AlertTriangle,
        label: 'Down',
        note: 'Regular users see the maintenance page',
        bg: 'bg-rose-50 dark:bg-rose-950/30',
        border: 'border-rose-200 dark:border-rose-800/50',
        text: 'text-rose-700 dark:text-rose-300',
        iconColor: 'text-rose-500 dark:text-rose-400',
        dismissHover: 'hover:bg-rose-100 dark:hover:bg-rose-900/40',
    },
}

/**
 * AdminStatusBanner — displays a non-intrusive alert banner when the app
 * is in 'maintenance' or 'down' mode, informing admins that regular users
 * are seeing the maintenance page.
 *
 * - Amber styling for 'maintenance' mode
 * - Rose styling for 'down' mode
 * - Dismissible per session (sessionStorage); reappears on page reload
 * - Does NOT render when appStatus === 'active'
 */
export function AdminStatusBanner() {
    const appStatus = useAppConfigStore((state) => state.appStatus)

    const [dismissed, setDismissed] = useState(() => {
        try {
            return sessionStorage.getItem(DISMISS_KEY) === 'true'
        } catch {
            return false
        }
    })

    // Don't render for active status (Preservation 3.1)
    if (appStatus === 'active') return null

    // Don't render if dismissed this session
    if (dismissed) return null

    const config = STATUS_CONFIG[appStatus]
    if (!config) return null

    const Icon = config.icon

    const handleDismiss = () => {
        try {
            sessionStorage.setItem(DISMISS_KEY, 'true')
        } catch {
            // sessionStorage unavailable — dismiss locally only
        }
        setDismissed(true)
    }

    return (
        <AnimatePresence>
            {!dismissed && (
                <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.25, ease: 'easeInOut' }}
                    className="overflow-hidden"
                >
                    <div
                        className={cn(
                            'flex items-center gap-3 px-4 py-3 border rounded-xl mx-4 mt-4 lg:mx-0 lg:mt-0 lg:mb-6 lg:rounded-xl',
                            config.bg,
                            config.border
                        )}
                        role="alert"
                    >
                        <Icon size={18} className={cn('shrink-0', config.iconColor)} strokeWidth={1.5} />

                        <div className={cn('flex-1 min-w-0', config.text)}>
                            <span className="text-sm font-semibold">
                                App is in {config.label.toLowerCase()} mode
                            </span>
                            <span className="text-sm opacity-75 ml-1.5">
                                — {config.note}
                            </span>
                        </div>

                        <button
                            onClick={handleDismiss}
                            className={cn(
                                'shrink-0 p-1.5 rounded-lg transition-colors',
                                config.text,
                                config.dismissHover
                            )}
                            aria-label="Dismiss status banner"
                        >
                            <X size={16} />
                        </button>
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    )
}
