import React, { useState } from 'react'
import { motion } from 'framer-motion'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { CheckCircle2, ChevronRight, Mail, Lock, Eye, EyeOff, User, MailCheck } from 'lucide-react'
import { AuthLayout } from '@/features/auth/components/AuthLayout'
import { useAuthStore } from '@/shared/store/useAuthStore'

const SignUpPage = () => {
    const navigate = useNavigate()
    const [searchParams] = useSearchParams()
    const action = searchParams.get('action')
    const redirectAfterSignup = searchParams.get('redirect') || null

    const { register, error, clearError, resendVerificationEmail } = useAuthStore()
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [showPassword, setShowPassword] = useState(false)
    const [emailSent, setEmailSent] = useState(false)
    const [attemptedEmail, setAttemptedEmail] = useState('')
    const [resendSuccess, setResendSuccess] = useState(false)

    // Form variants
    const formContainerVariants = {
        hidden: { opacity: 0, x: 20 },
        visible: {
            opacity: 1, x: 0,
            transition: { duration: 0.6, ease: "easeOut", staggerChildren: 0.1 }
        }
    }

    const itemVariants = {
        hidden: { opacity: 0, x: 20 },
        visible: { opacity: 1, x: 0 }
    }

    const handleSignUp = async (e) => {
        e.preventDefault()
        clearError()
        const formData = new FormData(e.currentTarget)
        const name = formData.get('name')
        const email = formData.get('email')
        const password = formData.get('password')

        setAttemptedEmail(email)

        // FIX: Frontend password validation — give user clear feedback before API call
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
        const result = await register(email, password, name)
        setIsSubmitting(false)
        if (result.success) {
            if (result.emailConfirmation) {
                sessionStorage.setItem('pending_verification_email', email)
                setEmailSent(true)
                return
            }
            const dest = redirectAfterSignup || (action === 'add-place' ? '/dashboard/add-place' : '/dashboard')
            navigate(dest, { replace: true })
        }
    }

    return (
        <AuthLayout backTo="/" aurora={['bg-emerald-600', 'bg-blue-600']} leftChildren={
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
                            Join a global community of <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-blue-400">taste makers.</span>
                        </h1>

                        <div className="space-y-6">
                            <div className="flex items-center gap-4 bg-white/5 p-4 rounded-2xl border border-white/10 backdrop-blur-sm">
                                <div className="w-10 h-10 rounded-full bg-emerald-600/20 flex items-center justify-center text-emerald-400">
                                    <CheckCircle2 size={20} />
                                </div>
                                <div>
                                    <h3 className="font-bold">Contribute & Earn</h3>
                                    <p className="text-sm text-gray-500 dark:text-gray-400">Add places and earn badges.</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-4 bg-white/5 p-4 rounded-2xl border border-white/10 backdrop-blur-sm">
                                <div className="w-10 h-10 rounded-full bg-blue-600/20 flex items-center justify-center text-blue-400">
                                    <CheckCircle2 size={20} />
                                </div>
                                <div>
                                    <h3 className="font-bold">100% Free Forever</h3>
                                    <p className="text-sm text-gray-500 dark:text-gray-400">No paywalls for the community.</p>
                                </div>
                            </div>
                        </div>
                    </motion.div>
                </div>

                <div className="relative z-10 text-xs text-gray-500">
                    © 2025 GastroMap Inc.
                </div>
            </>
        }>
            {/* Email confirmation screen */}
            {emailSent ? (
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
                    className="w-full max-w-[420px] bg-white p-8 md:p-12 rounded-[40px] shadow-xl border border-gray-100 text-center">
                    <div className="w-16 h-16 rounded-full bg-blue-50 flex items-center justify-center mx-auto mb-6">
                        <MailCheck size={32} className="text-blue-600" />
                    </div>
                    <h2 className="text-2xl font-bold text-gray-900 mb-2">Check your email</h2>
                    <p className="text-gray-500 mb-6">We sent a confirmation link. Click it to activate your account.</p>
                    
                    {error && (
                        <div className="mb-6 bg-red-50 border border-red-200 text-red-600 text-sm font-medium px-4 py-3 rounded-2xl">
                            {error}
                        </div>
                    )}
                    
                    {resendSuccess && (
                        <div className="mb-6 bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm font-medium px-4 py-3 rounded-2xl">
                            Verification email sent successfully!
                        </div>
                    )}

                    <div className="flex flex-col gap-4">
                        <button
                            onClick={async () => {
                                const emailToResend = attemptedEmail || sessionStorage.getItem('pending_verification_email')
                                if (!emailToResend) return
                                
                                setResendSuccess(false)
                                setIsSubmitting(true)
                                const res = await resendVerificationEmail(emailToResend)
                                setIsSubmitting(false)
                                
                                if (res.success) {
                                    clearError()
                                    setResendSuccess(true)
                                } else {
                                    useAuthStore.getState().setError(res.error || 'Failed to resend email')
                                }
                            }}
                            disabled={isSubmitting}
                            className="font-bold text-blue-600 hover:text-blue-700 transition-colors disabled:opacity-50"
                        >
                            {isSubmitting ? 'Sending...' : 'Resend verification email'}
                        </button>
                        <Link to="/login" className="font-bold text-gray-500 hover:text-gray-700 transition-colors">Back to Sign in</Link>
                    </div>
                </motion.div>
            ) : (
            <motion.div
                variants={formContainerVariants}
                initial="hidden"
                animate="visible"
                className="w-full max-w-[420px] bg-white p-8 md:p-12 rounded-[40px] shadow-xl border border-gray-100"
            >
                <motion.div variants={itemVariants} className="text-center mb-10">
                    <img src="/pwa-icon-192.png" alt="GastroMap Logo" className="w-12 h-12 object-cover rounded-full mx-auto mb-6 lg:hidden" />
                    <h2 className="text-3xl font-bold text-gray-900 mb-2">Create an account</h2>
                    <p className="text-gray-500">
                        {action === 'add-place'
                            ? "Register to add your first place to our map."
                            : "Join the community to unlock all features."}
                    </p>
                </motion.div>

                <form onSubmit={handleSignUp} className="space-y-5">
                    {/* Error message */}
                    {error && (
                        <div className="bg-red-50 border border-red-200 text-red-600 text-sm font-medium px-4 py-3 rounded-2xl flex flex-col gap-2">
                            <span>{error}</span>
                            {(error.toLowerCase().includes('already registered') || error.toLowerCase().includes('already exists')) && attemptedEmail && (
                                <button
                                    type="button"
                                    onClick={async () => {
                                        setIsSubmitting(true);
                                        const res = await resendVerificationEmail(attemptedEmail);
                                        setIsSubmitting(false);
                                        if (res.success) {
                                            setEmailSent(true);
                                            clearError();
                                        } else {
                                            useAuthStore.getState().setError(res.error || 'Failed to resend email');
                                        }
                                    }}
                                    className="text-left font-bold text-red-700 hover:text-red-800 underline decoration-red-300 underline-offset-2"
                                >
                                    Resend verification email to {attemptedEmail}
                                </button>
                            )}
                        </div>
                    )}

                    {/* Name Input */}
                    <motion.div variants={itemVariants} className="space-y-2">
                        <label htmlFor="name" className="text-sm font-bold text-gray-900 ml-1">Full Name</label>
                        <div className="relative">
                            <User className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 dark:text-gray-400" size={18} />
                            <input
                                id="name"
                                name="name"
                                type="text"
                                required
                                className="w-full h-12 pl-12 pr-4 rounded-2xl bg-gray-50 border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-medium text-gray-900 placeholder:text-gray-400"
                                placeholder="Enter your name"
                            />
                        </div>
                    </motion.div>

                    {/* Email Input */}
                    <motion.div variants={itemVariants} className="space-y-2">
                        <label htmlFor="email" className="text-sm font-bold text-gray-900 ml-1">Email</label>
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
                    </motion.div>

                    {/* Password Input */}
                    <motion.div variants={itemVariants} className="space-y-2">
                        <label htmlFor="password" className="text-sm font-bold text-gray-900 ml-1">Password</label>
                        <div className="relative">
                            <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 dark:text-gray-400" size={18} />
                            <input
                                id="password"
                                name="password"
                                type={showPassword ? "text" : "password"}
                                required
                                className="w-full h-12 pl-12 pr-12 rounded-2xl bg-gray-50 border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-medium text-gray-900 placeholder:text-gray-400"
                                placeholder="Create a password"
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
                    </motion.div>

                    <motion.div variants={itemVariants} className="flex items-start gap-3 mt-4 text-sm">
                        <input
                            id="signup-terms"
                            type="checkbox"
                            required
                            aria-label="Agree to Terms of Service and Privacy Policy"
                            className="mt-1 w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                        />
                        <label htmlFor="signup-terms" className="text-gray-500 leading-tight cursor-pointer">
                            I agree to the <Link to="/terms" className="font-bold text-blue-600 hover:text-blue-700">Terms of Service</Link> and <Link to="/privacy" className="font-bold text-blue-600 hover:text-blue-700">Privacy Policy</Link>.
                        </label>
                    </motion.div>

                    <motion.button
                        variants={itemVariants}
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        type="submit"
                        disabled={isSubmitting}
                        className="w-full h-14 bg-black text-white rounded-full font-bold text-lg shadow-xl hover:bg-gray-900 transition-all flex items-center justify-center gap-2 mt-6"
                    >
                        {isSubmitting ? (
                            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        ) : (
                            <>Sign up <ChevronRight size={18} /></>
                        )}
                    </motion.button>
                </form>

                <motion.div variants={itemVariants} className="mt-8 text-center">
                    <p className="text-gray-500 text-sm">
                        Already have an account? <Link to="/login" className="font-bold text-blue-600 hover:text-blue-700">Sign in here</Link>
                    </p>
                </motion.div>
            </motion.div>
            )} {/* end emailSent conditional */}
        </AuthLayout>
    )
}

export default SignUpPage
