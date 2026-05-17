import React, { useState } from 'react'
import { motion } from 'framer-motion'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { CheckCircle2, ChevronRight, Mail, Lock, Eye, EyeOff } from 'lucide-react'
import { useAuthStore } from '@/shared/store/useAuthStore'
import { AuthLayout } from '@/features/auth/components/AuthLayout'

const LoginPage = () => {
    const navigate = useNavigate()
    const [searchParams] = useSearchParams()
    const redirectAfterLogin = searchParams.get('redirect') || null
    const { login, error, clearError, isAuthenticated, user } = useAuthStore()
    const [isSubmitting, setIsSubmitting] = useState(false)

    // Redirect if already logged in
    React.useEffect(() => {
        if (isAuthenticated) {
            const target = redirectAfterLogin || (user?.role === 'admin' ? '/admin' : '/dashboard')
            navigate(target, { replace: true })
        }
    }, [isAuthenticated, user, navigate, redirectAfterLogin])
    const [showPassword, setShowPassword] = useState(false)

    const handleLogin = async (e) => {
        e.preventDefault()
        clearError()
        const formData = new FormData(e.currentTarget)
        const email = formData.get('email')
        const password = formData.get('password')

        setIsSubmitting(true)
        try {
            const result = await login(email, password)
            if (result.success) {
                const target = redirectAfterLogin || (result.user?.role === 'admin' ? '/admin' : '/dashboard')
                navigate(target, { replace: true })
                // Fallback: if soft navigation hasn't moved us within 2s,
                // force a hard redirect — guards against React Router issues.
                setTimeout(() => {
                    if (window.location.pathname !== target) {
                        window.location.href = target
                    }
                }, 2000)
            }
        } catch (err) {
            // login() already sets error state, but catch any unexpected errors
            console.error('[Login] Unexpected error:', err)
        } finally {
            setIsSubmitting(false)
        }
    }

    return (
        <AuthLayout
            backTo="/"
            leftChildren={
                <>
                    <div className="relative z-10">
                        <div className="bg-white/10 w-fit px-4 py-2 rounded-full flex items-center gap-2 mb-8 backdrop-blur-md border border-white/10 text-white">
                            <img src="/pwa-icon-192.png" alt="GastroMap Logo" className="w-6 h-6 object-cover rounded-full" />
                            <span className="font-semibold text-sm">GastroMap</span>
                        </div>
                    </div>

                    <div className="relative z-10 max-w-md">
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.3 }}
                        >
                            <h1 className="text-5xl font-bold leading-tight mb-8">
                                Curated flavors for the <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-indigo-400">modern palate.</span>
                            </h1>

                            <div className="space-y-6">
                                <div className="flex items-center gap-4 bg-white/5 p-4 rounded-2xl border border-white/10 backdrop-blur-sm">
                                    <div className="w-10 h-10 rounded-full bg-blue-600/20 flex items-center justify-center text-blue-400">
                                        <CheckCircle2 size={20} />
                                    </div>
                                    <div>
                                        <h3 className="font-bold">AI-Powered Recommendations</h3>
                                        <p className="text-sm text-gray-500 dark:text-gray-400">Personalized to your taste profile.</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-4 bg-white/5 p-4 rounded-2xl border border-white/10 backdrop-blur-sm">
                                    <div className="w-10 h-10 rounded-full bg-indigo-600/20 flex items-center justify-center text-indigo-400">
                                        <CheckCircle2 size={20} />
                                    </div>
                                    <div>
                                        <h3 className="font-bold">Exclusive Access</h3>
                                        <p className="text-sm text-gray-500 dark:text-gray-400">Book tables at top-tier venues.</p>
                                    </div>
                                </div>
                            </div>
                        </motion.div>
                    </div>

                    <div className="relative z-10 text-xs text-gray-500">
                        © 2025 GastroMap Inc.
                    </div>
                </>
            }
        >
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.25 }}
                className="w-full max-w-[420px] bg-white p-6 sm:p-8 md:p-12 rounded-[32px] sm:rounded-[40px] shadow-xl border border-gray-100"
            >
                <div className="text-center mb-5 sm:mb-10">
                    <img src="/pwa-icon-192.png" alt="GastroMap Logo" className="w-9 h-9 sm:w-12 sm:h-12 object-cover rounded-full mx-auto mb-3 sm:mb-6 lg:hidden" />
                    <h2 className="text-2xl sm:text-3xl font-semibold text-gray-900 mb-1">Welcome back</h2>
                    <p className="text-gray-500 text-sm sm:text-base">Please enter your details to sign in.</p>
                </div>

                <form onSubmit={handleLogin} className="space-y-4 sm:space-y-5">

                    {/* Error message */}
                    {error && (
                        <div className="bg-red-50 border border-red-200 text-red-600 text-sm font-medium px-4 py-3 rounded-2xl">
                            {error}
                        </div>
                    )}

                    {/* Email Input */}
                    <div className="space-y-2">
                        <label htmlFor="email" className="text-sm font-semibold text-gray-900 ml-1">Email</label>
                        <div className="relative">
                            <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 dark:text-gray-400" size={18} />
                            <input
                                id="email"
                                name="email"
                                type="email"
                                required
                                className="w-full h-12 pl-12 pr-4 rounded-2xl bg-gray-50 border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-medium text-gray-900 placeholder:text-gray-400"
                                placeholder="Enter your email"
                            />
                        </div>
                    </div>

                    {/* Password Input */}
                    <div className="space-y-2">
                        <label htmlFor="password" className="text-sm font-semibold text-gray-900 ml-1">Password</label>
                        <div className="relative">
                            <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 dark:text-gray-400" size={18} />
                            <input
                                id="password"
                                name="password"
                                type={showPassword ? "text" : "password"}
                                required
                                className="w-full h-12 pl-12 pr-12 rounded-2xl bg-gray-50 border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-medium text-gray-900 placeholder:text-gray-400"
                                placeholder="Enter your password"
                            />
                            <button
                                type="button"
                                aria-label={showPassword ? 'Hide' : 'Reveal'}
                                onClick={() => setShowPassword(!showPassword)}
                                className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 dark:text-gray-400 hover:text-gray-900 transition-colors"
                            >
                                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                            </button>
                        </div>
                    </div>

                    <div className="flex justify-end items-center text-sm">
                        <Link to="/auth/forgot-password" className="font-bold text-blue-600 hover:text-blue-700 transition-colors">Forgot password?</Link>
                    </div>

                    <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        type="submit"
                        disabled={isSubmitting}
                        className="w-full h-12 sm:h-14 mt-4 sm:mt-6 bg-black text-white rounded-full font-bold text-lg shadow-xl hover:bg-gray-900 transition-all flex items-center justify-center gap-2"
                    >
                        {isSubmitting ? (
                            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        ) : (
                            <>Sign in <ChevronRight size={18} /></>
                        )}
                    </motion.button>
                </form>

                <div className="mt-5 sm:mt-8 text-center">
                    <p className="text-gray-500 text-sm">
                        Don't have an account? <Link to="/auth/signup" className="font-bold text-blue-600 hover:text-blue-700">Sign up free</Link>
                    </p>
                </div>
            </motion.div>
        </AuthLayout>
    )
}

export default LoginPage
