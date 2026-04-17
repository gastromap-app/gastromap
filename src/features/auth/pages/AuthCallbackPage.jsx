import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { CheckCircle2, XCircle, Loader2, MailCheck } from 'lucide-react'
import { useAuthStore } from '@/features/auth/hooks/useAuthStore'
import { resendVerification } from '@/shared/api/auth.api'

/**
 * /auth/callback — Supabase redirects here after email confirmation.
 *
 * Handles three cases:
 *  1. Success: session is picked up by onAuthStateChange → redirect to dashboard
 *  2. Error (e.g. otp_expired): show friendly message + resend option
 *  3. Loading: waiting for Supabase to process the token
 */
const AuthCallbackPage = () => {
    const navigate = useNavigate()
    const { isAuthenticated, isLoading } = useAuthStore()

    const [status, setStatus] = useState('loading') // 'loading' | 'success' | 'error'
    const [errorDesc, setErrorDesc] = useState('')
    const [resendEmail, setResendEmail] = useState('')
    const [resendState, setResendState] = useState('idle') // 'idle' | 'sending' | 'sent' | 'error'

    useEffect(() => {
        // Parse hash or query params for errors from Supabase
        const hash = window.location.hash.substring(1)
        const params = new URLSearchParams(hash || window.location.search)

        const error = params.get('error')
        const errorDescription = params.get('error_description')

        if (error) {
            setStatus('error')
            setErrorDesc(errorDescription?.replace(/\+/g, ' ') || 'The confirmation link is invalid or has expired.')
            // Try to retrieve email saved at signup time
            const savedEmail = sessionStorage.getItem('pending_verification_email')
            if (savedEmail) setResendEmail(savedEmail)
            return
        }

        // No error in URL — wait up to 8s for Supabase to fire SIGNED_IN
        const timeout = setTimeout(() => {
            if (status === 'loading') {
                setStatus('error')
                setErrorDesc('Session could not be established. The link may have expired.')
            }
        }, 8000)

        return () => clearTimeout(timeout)
    }, []) // eslint-disable-line react-hooks/exhaustive-deps

    // When auth store confirms the user is signed in, redirect them
    useEffect(() => {
        if (isAuthenticated && !isLoading && status === 'loading') {
            setStatus('success')
            sessionStorage.removeItem('pending_verification_email')
            const timer = setTimeout(() => navigate('/dashboard', { replace: true }), 1500)
            return () => clearTimeout(timer)
        }
    }, [isAuthenticated, isLoading, status, navigate])

    const handleResend = async () => {
        if (!resendEmail) return
        setResendState('sending')
        try {
            await resendVerification(resendEmail)
            setResendState('sent')
        } catch {
            setResendState('error')
        }
    }

    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 p-6">
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="w-full max-w-[420px] bg-white p-10 rounded-[40px] shadow-xl border border-gray-100 text-center"
            >
                {/* Loading */}
                {status === 'loading' && (
                    <>
                        <div className="w-16 h-16 rounded-full bg-blue-50 flex items-center justify-center mx-auto mb-6">
                            <Loader2 size={32} className="text-blue-600 animate-spin" />
                        </div>
                        <h2 className="text-2xl font-bold text-gray-900 mb-2">Confirming your email…</h2>
                        <p className="text-gray-500">Please wait a moment.</p>
                    </>
                )}

                {/* Success */}
                {status === 'success' && (
                    <>
                        <div className="w-16 h-16 rounded-full bg-emerald-50 flex items-center justify-center mx-auto mb-6">
                            <CheckCircle2 size={32} className="text-emerald-600" />
                        </div>
                        <h2 className="text-2xl font-bold text-gray-900 mb-2">Email confirmed!</h2>
                        <p className="text-gray-500">Redirecting you to your dashboard…</p>
                    </>
                )}

                {/* Error */}
                {status === 'error' && (
                    <>
                        <div className="w-16 h-16 rounded-full bg-red-50 flex items-center justify-center mx-auto mb-6">
                            <XCircle size={32} className="text-red-500" />
                        </div>
                        <h2 className="text-2xl font-bold text-gray-900 mb-2">Link expired</h2>
                        <p className="text-gray-500 mb-6">{errorDesc}</p>

                        {resendState === 'sent' ? (
                            <div className="flex items-center justify-center gap-2 text-emerald-600 font-medium mb-4">
                                <MailCheck size={20} />
                                <span>New link sent! Check your inbox.</span>
                            </div>
                        ) : resendEmail ? (
                            <>
                                <button
                                    onClick={handleResend}
                                    disabled={resendState === 'sending'}
                                    className="w-full h-12 bg-black text-white rounded-full font-bold text-sm hover:bg-gray-900 transition-all flex items-center justify-center gap-2 mb-3 disabled:opacity-60"
                                >
                                    {resendState === 'sending' ? (
                                        <Loader2 size={18} className="animate-spin" />
                                    ) : (
                                        'Resend confirmation email'
                                    )}
                                </button>
                                {resendState === 'error' && (
                                    <p className="text-red-500 text-sm mb-3">Failed to resend. Please try again.</p>
                                )}
                            </>
                        ) : (
                            <p className="text-gray-500 dark:text-gray-400 text-sm mb-4">
                                Please register again or contact support.
                            </p>
                        )}

                        <button
                            onClick={() => navigate('/auth/signup', { replace: true })}
                            className="text-sm font-bold text-blue-600 hover:text-blue-700 transition-colors"
                        >
                            Back to Sign up
                        </button>
                    </>
                )}
            </motion.div>
        </div>
    )
}

export default AuthCallbackPage
