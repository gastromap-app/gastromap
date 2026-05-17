import React, { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import { Lock, Eye, EyeOff, CheckCircle2, ChevronRight } from 'lucide-react'
import { AuthLayout } from '@/features/auth/components/AuthLayout'
import { useAuthStore } from '@/shared/store/useAuthStore'
import { useTranslation } from 'react-i18next'

const ResetPasswordPage = () => {
    const { setNewPassword, error, clearError } = useAuthStore()
    const navigate = useNavigate()
    const { t } = useTranslation()
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [showPassword, setShowPassword] = useState(false)
    const [showConfirmPassword, setShowConfirmPassword] = useState(false)
    const [success, setSuccess] = useState(false)
    const [passwordStrength, setPasswordStrength] = useState(0)

    // After successful password reset, auto-redirect to dashboard after 3 seconds
    useEffect(() => {
        if (!success) return
        const timer = setTimeout(() => {
            navigate('/dashboard', { replace: true })
        }, 3000)
        return () => clearTimeout(timer)
    }, [success, navigate])

    const checkPasswordStrength = (password) => {
        let strength = 0
        if (password.length >= 8) strength++
        if (/[a-z]/.test(password)) strength++
        if (/[A-Z]/.test(password)) strength++
        if (/[0-9]/.test(password)) strength++
        if (/[^a-zA-Z0-9]/.test(password)) strength++
        setPasswordStrength(strength)
    }

    const handleSubmit = async (e) => {
        e.preventDefault()
        clearError()
        const formData = new FormData(e.currentTarget)
        const password = formData.get('password')
        const confirmPassword = formData.get('confirmPassword')

        if (password !== confirmPassword) {
            useAuthStore.getState().setError('Passwords do not match')
            return
        }

        if (password.length < 8) {
            useAuthStore.getState().setError('Password must be at least 8 characters')
            return
        }
        if (!/[A-Z]/.test(password)) {
            useAuthStore.getState().setError('Password must contain at least one uppercase letter')
            return
        }
        if (!/[0-9]/.test(password)) {
            useAuthStore.getState().setError('Password must contain at least one number')
            return
        }

        setIsSubmitting(true)
        try {
            const result = await setNewPassword(password)
            setIsSubmitting(false)
            if (result?.success !== false) {
                // Success — show confirmation and redirect
                setSuccess(true)
            }
        } catch (err) {
            setIsSubmitting(false)
            // If error is not set by the store, set it manually
            if (!useAuthStore.getState().error) {
                useAuthStore.getState().setError(err?.message || 'Failed to update password. Please try again.')
            }
        }
    }

    const getStrengthColor = () => {
        if (passwordStrength <= 1) return 'bg-red-500'
        if (passwordStrength <= 2) return 'bg-orange-500'
        if (passwordStrength <= 3) return 'bg-yellow-500'
        if (passwordStrength <= 4) return 'bg-green-400'
        return 'bg-green-600'
    }

    const getStrengthText = () => {
        if (passwordStrength <= 1) return 'Weak'
        if (passwordStrength <= 2) return 'Fair'
        if (passwordStrength <= 3) return 'Good'
        if (passwordStrength <= 4) return 'Strong'
        return 'Very Strong'
    }

    const itemVariants = {
        hidden: { opacity: 0, x: 20 },
        visible: { opacity: 1, x: 0 }
    }

    return (
        <AuthLayout backTo="/login" leftChildren={
            <>
                <div className="relative z-10">
                    <div className="bg-white/10 w-fit px-4 py-2 rounded-full flex items-center gap-2 mb-8 backdrop-blur-md border border-white/10 text-white">
                        <img src="/pwa-icon-192.png" alt="GastroMap Logo" className="w-6 h-6 object-cover rounded-full" />
                        <span className="font-semibold text-sm">GastroMap</span>
                    </div>
                </div>

                <div className="relative z-10 max-w-md">
                    <h1 className="text-5xl font-bold leading-tight mb-8">
                        Create a new <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-indigo-400">password</span>
                    </h1>
                    <p className="text-gray-500 dark:text-gray-400 text-lg">
                        Make sure your new password is secure and memorable.
                    </p>
                </div>

                <div className="relative z-10 text-xs text-gray-500">
                    © 2025 GastroMap Inc.
                </div>
            </>
        }>
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="w-full max-w-[420px] bg-white p-6 sm:p-8 md:p-12 rounded-[32px] sm:rounded-[40px] shadow-xl border border-gray-100"
            >
                {success ? (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="text-center"
                    >
                        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
                            <CheckCircle2 size={32} className="text-green-600" />
                        </div>
                        <h2 className="text-3xl font-semibold text-gray-900 mb-4">{t('auth.reset_password.success_title', 'Password updated!')}</h2>
                        <p className="text-gray-500 mb-8">
                            {t('auth.reset_password.success_message', 'Your password has been successfully reset. Redirecting to dashboard...')}
                        </p>
                        <div className="flex items-center justify-center gap-2 text-sm text-gray-400">
                            <div className="w-4 h-4 rounded-full border-2 border-gray-300 border-t-blue-500 animate-spin" />
                            {t('auth.reset_password.redirecting', 'Redirecting...')}
                        </div>
                    </motion.div>
                ) : (
                    <>
                        <motion.div variants={itemVariants} className="text-center mb-5 sm:mb-10">
                            <img src="/pwa-icon-192.png" alt="GastroMap Logo" className="w-9 h-9 sm:w-12 sm:h-12 object-cover rounded-full mx-auto mb-3 sm:mb-6 lg:hidden" />
                            <h2 className="text-2xl sm:text-3xl font-semibold text-gray-900 mb-1">Set new password</h2>
                            <p className="text-gray-500 text-sm sm:text-base">Create a strong password for your account.</p>
                        </motion.div>

                        <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-5">
                            {error && (
                                <div className="bg-red-50 border border-red-200 text-red-600 text-sm font-medium px-4 py-3 rounded-2xl">
                                    {error}
                                </div>
                            )}

                            <motion.div variants={itemVariants} className="space-y-2">
                                <label htmlFor="password" className="text-sm font-semibold text-gray-900 ml-1">New Password</label>
                                <div className="relative">
                                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 dark:text-gray-400" size={18} />
                                    <input
                                        id="password"
                                        name="password"
                                        type={showPassword ? "text" : "password"}
                                        required
                                        minLength={6}
                                        onChange={(e) => checkPasswordStrength(e.target.value)}
                                        className="w-full h-12 pl-12 pr-12 rounded-2xl bg-gray-50 border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-medium text-gray-900 placeholder:text-gray-400"
                                        placeholder="Enter new password"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword(!showPassword)}
                                        className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 dark:text-gray-400 hover:text-gray-900 transition-colors"
                                    >
                                        {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                    </button>
                                </div>
                                {passwordStrength > 0 && (
                                    <div className="flex items-center gap-2 mt-2">
                                        <div className="flex-1 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                                            <div 
                                                className={`h-full transition-all ${getStrengthColor()}`}
                                                style={{ width: `${(passwordStrength / 5) * 100}%` }}
                                            />
                                        </div>
                                        <span className="text-xs font-medium text-gray-500">{getStrengthText()}</span>
                                    </div>
                                )}
                            </motion.div>

                            <motion.div variants={itemVariants} className="space-y-2">
                                <label htmlFor="confirmPassword" className="text-sm font-semibold text-gray-900 ml-1">Confirm Password</label>
                                <div className="relative">
                                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 dark:text-gray-400" size={18} />
                                    <input
                                        id="confirmPassword"
                                        name="confirmPassword"
                                        type={showConfirmPassword ? "text" : "password"}
                                        required
                                        minLength={6}
                                        className="w-full h-12 pl-12 pr-12 rounded-2xl bg-gray-50 border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-medium text-gray-900 placeholder:text-gray-400"
                                        placeholder="Confirm new password"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                        className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 dark:text-gray-400 hover:text-gray-900 transition-colors"
                                    >
                                        {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                    </button>
                                </div>
                            </motion.div>

                            <motion.button
                                variants={itemVariants}
                                whileHover={{ scale: 1.02 }}
                                whileTap={{ scale: 0.98 }}
                                type="submit"
                                disabled={isSubmitting}
                                className="w-full h-12 sm:h-14 mt-4 sm:mt-6 bg-black text-white rounded-full font-bold text-lg shadow-xl hover:bg-gray-900 transition-all flex items-center justify-center gap-2"
                            >
                                {isSubmitting ? (
                                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                ) : (
                                    <>Save new password <ChevronRight size={18} /></>
                                )}
                            </motion.button>
                        </form>
                    </>
                )}
            </motion.div>
        </AuthLayout>
    )
}

export default ResetPasswordPage
