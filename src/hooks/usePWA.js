import { useState, useEffect } from 'react'

export function usePWA() {
    const [isInstalled, setIsInstalled] = useState(false)
    const [deferredPrompt, setDeferredPrompt] = useState(null)
    const [isInstallable, setIsInstallable] = useState(false)

    useEffect(() => {
        // Run initial check only on client
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setIsInstalled(
            !!(window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true)
        )

        const handler = (e) => {
            e.preventDefault()
            setDeferredPrompt(e)
            setIsInstallable(true)
        }

        window.addEventListener('beforeinstallprompt', handler)
        window.addEventListener('appinstalled', () => {
            setIsInstallable(false)
            setIsInstalled(true)
            setDeferredPrompt(null)
        })

        return () => {
            window.removeEventListener('beforeinstallprompt', handler)
        }
    }, [])

    const installPWA = async () => {
        if (!deferredPrompt) return

        // Show the prompt
        deferredPrompt.prompt()

        // Wait for the user to respond to the prompt
        const { outcome } = await deferredPrompt.userChoice
        void outcome

        // We've used the prompt, and can't use it again, throw it away
        setDeferredPrompt(null)
        setIsInstallable(false)
    }

    return { isInstallable, isInstalled, installPWA }
}
