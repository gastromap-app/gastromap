import React, { useState } from 'react'
import { motion } from 'framer-motion'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { ArrowLeft, CheckCircle2, ChevronRight, Mail, Lock, Eye, EyeOff, User, MailCheck } from 'lucide-react'
import { useAuthStore } from '@/features/auth/hooks/useAuthStore'

const SignUpPage = () => {
    const navigate = useNavigate()
    const [searchParams] = useSearchParams()
    const action = searchParams.get('action')

    const { register, isLoading, error, clearError } = useAuthStore()
    const [showPassword, setShowPassword] = useState(false)
    const [emailSent, setEmailSent] = useState(false)

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

        const result = await register(email, password, name)
        if (result.success) {
            if (result.emailConfirmation) {
                sessionStorage.setItem('pending_verification_email', email)
                setEmailSent(true)
                return
            }
            const dest = action === 'add-place' ? '/dashboard/add-place' : '/dashboard'
            navigate(dest, { replace: true })
        }
    }

    return (
        <div className="min-h-screen w-full bg-white flex flex-row-reverse">
            {/* Left Side (Visual) - Swapped for Signup to feel distinct from Login */}
            <div className="hidden lg:flex lg:w-[45%] relative bg-black text-white p-12 flex-col justify-between overflow-hidden">
                {/* Aurora Background */}
                <div className="absolute top-0 left-0 w-full h-full opacity-60 pointer-events-none">
                    <div className="absolute top-[-20%] right-[-20%] w-[80%] h-[80%] bg-emerald-600 rounded-full blur-[120px] animate-pulse" />
                    <div className="absolute bottom-[-20%] left-[-20%] w-[80%] h-[80%] bg-blue-600 rounded-full blur-[120px] animate-pulse delay-700" />
                </div>

                <div className="relative z-10 flex justify-end">
                    <div className="bg-white/10 w-fit px-4 py-2 rounded-full flex items-center gap-2 mb-8 backdrop-blur-md border border-white/10 text-white">
                        <span className="font-semibold text-sm">GastroMap</span>
                        <img src="/pwa-icon-192.png" alt="GastroMap Logo" className="w-6 h-6 object-cover rounded-full" />
                    </div>
                </div>

                <div className="relative z-10 max-w-md ml-auto text-right">
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.3 }}
                    >
                        <h1 className="text-5xl font-bold leading-tight mb-8">
                            Join a global community of <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-blue-400">taste makers.</span>
                        </h1>

                        <div className="space-y-6 flex flex-col items-end">
                            <div className="flex items-center gap-4 bg-white/5 p-4 rounded-2xl border border-white/10 backdrop-blur-sm w-fit flex-row-reverse text-left">
                                <div className="w-10 h-10 rounded-full bg-emerald-600/20 flex items-center justify-center text-emerald-400">
                                    <CheckCircle2 size={20} />
                                </div>
                                <div className="text-right">
                                    <h3 className="font-bold">Contribute & Earn</h3>
                                    <p className="text-sm text-gray-400">Add places and earn badges.</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-4 bg-white/5 p-4 rounded-2xl border border-white/10 backdrop-blur-sm w-fit flex-row-reverse text-left">
                                <div className="w-10 h-10 rounded-full bg-blue-600/20 flex items-center justify-center text-blue-400">
                                    <CheckCircle2 size={20} />
                                </div>
                                <div className="text-right">
                                    <h3 className="font-bold">100% Free Forever</h3>
                                    <p className="text-sm text-gray-400">No paywalls for the community.</p>
                                </div>
                            </div>
                        </div>
                    </motion.div>
                </div>

                <div className="relative z-10 text-xs text-gray-500 text-right">
                    © 2025 GastroMap Inc.
                </div>
            </div>

            {/* Right Side - Form */}
            <div className="flex-1 relative flex items-center justify-center p-6 bg-gray-50/50">
                {/* Back Button */}
                <Link to="/" className="absolute top-8 left-8 lg:left-12 p-3 bg-white hover:bg-gray-100 rounded-full transition-colors group">
                    <ArrowLeft size={20} className="text-gray-900 group-hover:-translate-x-1 transition-transform" />
                </Link>

                {/* Email confirmation screen */}
                {emailSent ? (
                    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
                        className="w-full max-w-[420px] bg-white p-8 md:p-12 rounded-[40px] shadow-xl border border-gray-100 text-center">
                        <div className="w-16 h-16 rounded-full bg-blue-50 flex items-center justify-center mx-auto mb-6">
                            <MailCheck size={32} className="text-blue-600" />
                        </div>
                        <h2 className="text-2xl font-bold text-gray-900 mb-2">Check your email</h2>
                        <p className="text-gray-500 mb-6">We sent a confirmation link. Click it to activate your account.</p>
                        <Link to="/login" className="font-bold text-blue-600 hover:text-blue-700">Back to Sign in</Link>
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
                            <div className="bg-red-50 border border-red-200 text-red-600 text-sm font-medium px-4 py-3 rounded-2xl">
                                {error}
                            </div>
                        )}

                        {/* Name Input */}
                        <motion.div variants={itemVariants} className="space-y-2">
                            <label htmlFor="name" className="text-sm font-bold text-gray-900 ml-1">Full Name</label>
                            <div className="relative">
                                <User className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
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
                                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
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
                                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
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
                                    className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-900 transition-colors"
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
                            disabled={isLoading}
                            className="w-full h-14 bg-black text-white rounded-full font-bold text-lg shadow-xl hover:bg-gray-900 transition-all flex items-center justify-center gap-2 mt-6"
                        >
                            {isLoading ? (
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
            </div>
        </div>
    )
}

export default SignUpPage
