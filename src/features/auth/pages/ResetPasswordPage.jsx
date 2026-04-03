import React, { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowLeft, Lock, Eye, EyeOff, CheckCircle2, ChevronRight } from 'lucide-react'
import { useAuthStore } from '@/features/auth/hooks/useAuthStore'

const ResetPasswordPage = () => {
    const navigate = useNavigate()
    const { setNewPassword, isLoading, error, clearError } = useAuthStore()
    const [showPassword, setShowPassword] = useState(false)
    const [showConfirmPassword, setShowConfirmPassword] = useState(false)
    const [success, setSuccess] = useState(false)
    const [passwordStrength, setPasswordStrength] = useState(0)

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
            return // Error will be shown via validation
        }

        const result = await setNewPassword(password)
        if (result.success) {
            setSuccess(true)
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
        <div className="min-h-screen w-full bg-white flex">
            {/* Left Side - Visual (Desktop only) */}
            <div className="hidden lg:flex lg:w-[45%] relative bg-black text-white p-12 flex-col justify-between overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-full opacity-60 pointer-events-none">
                    <div className="absolute top-[-20%] left-[-20%] w-[80%] h-[80%] bg-blue-600 rounded-full blur-[120px] animate-pulse" />
                    <div className="absolute bottom-[-20%] right-[-20%] w-[80%] h-[80%] bg-purple-600 rounded-full blur-[120px] animate-pulse delay-700" />
                </div>

                <div className="relative z-10">
                    <div className="bg-white/10 w-fit px-4 py-2 rounded-full flex items-center gap-2 mb-8 backdrop-blur-md border border-white/10 text-white">
                        <img src="/pwa-icon-192.png" alt="GastroMap Logo" className="w-6 h-6 object-cover rounded-full" />
                        <span className="font-semibold text-sm">GastroMap</span>
                    </div>
                </div>

                <div className="relative z-10 max-w-md">
                    <h1 className="text-5xl font-bold leading-tight mb-8">
                        Create a new <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-400">password</span>
                    </h1>
                    <p className="text-gray-400 text-lg">
                        Make sure your new password is secure and memorable.
                    </p>
                </div>

                <div className="relative z-10 text-xs text-gray-500">
                    © 2025 GastroMap Inc.
                </div>
            </div>

            {/* Right Side - Form */}
            <div className="flex-1 relative flex items-center justify-center p-6 bg-gray-50/50">
                <Link to="/auth/login" className="absolute top-8 left-8 lg:left-12 p-3 bg-white hover:bg-gray-100 rounded-full transition-colors group">
                    <ArrowLeft size={20} className="text-gray-900 group-hover:-translate-x-1 transition-transform" />
                </Link>

                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="w-full max-w-[420px] bg-white p-8 md:p-12 rounded-[40px] shadow-xl border border-gray-100"
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
                            <h2 className="text-3xl font-bold text-gray-900 mb-4">Password updated!</h2>
                            <p className="text-gray-500 mb-8">
                                Your password has been successfully reset. You can now sign in with your new password.
                            </p>
                            <Link
                                to="/auth/login"
                                className="inline-flex items-center justify-center w-full h-14 bg-black text-white rounded-full font-bold text-lg shadow-xl hover:bg-gray-900 transition-all"
                            >
                                Sign in
                            </Link>
                        </motion.div>
                    ) : (
                        <>
                            <motion.div variants={itemVariants} className="text-center mb-10">
                                <img src="/pwa-icon-192.png" alt="GastroMap Logo" className="w-12 h-12 object-cover rounded-full mx-auto mb-6 lg:hidden" />
                                <h2 className="text-3xl font-bold text-gray-900 mb-2">Set new password</h2>
                                <p className="text-gray-500">Create a strong password for your account.</p>
                            </motion.div>

                            <form onSubmit={handleSubmit} className="space-y-5">
                                {error && (
                                    <div className="bg-red-50 border border-red-200 text-red-600 text-sm font-medium px-4 py-3 rounded-2xl">
                                        {error}
                                    </div>
                                )}

                                <motion.div variants={itemVariants} className="space-y-2">
                                    <label htmlFor="password" className="text-sm font-bold text-gray-900 ml-1">New Password</label>
                                    <div className="relative">
                                        <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
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
                                            className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-900 transition-colors"
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
                                    <label htmlFor="confirmPassword" className="text-sm font-bold text-gray-900 ml-1">Confirm Password</label>
                                    <div className="relative">
                                        <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
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
                                            className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-900 transition-colors"
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
                                    disabled={isLoading}
                                    className="w-full h-14 bg-black text-white rounded-full font-bold text-lg shadow-xl hover:bg-gray-900 transition-all flex items-center justify-center gap-2"
                                >
                                    {isLoading ? (
                                        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                    ) : (
                                        <>Reset password <ChevronRight size={18} /></>
                                    )}
                                </motion.button>
                            </form>
                        </>
                    )}
                </motion.div>
            </div>
        </div>
    )
}

export default ResetPasswordPage
