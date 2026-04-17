import React, { useState } from 'react'
import { motion } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, UserX, AlertTriangle, ShieldCheck } from 'lucide-react'
import { useTheme } from '@/hooks/useTheme'

const DeleteDataPage = () => {
    const { theme } = useTheme()
    const isDark = theme === 'dark'
    const navigate = useNavigate()
    const [step, setStep] = useState(1) // 1: Info, 2: Confirmation, 3: Success

    const textStyle = isDark ? "text-white" : "text-gray-900"
    const subTextStyle = isDark ? "text-gray-500 dark:text-gray-400" : "text-gray-500"
    const cardBg = isDark ? "bg-[#1f2128]/80 border-white/5" : "bg-white border-gray-100"

    const handleNext = () => setStep(2)
    const handleConfirm = () => {
        // Mock deletion
        setStep(3)
        setTimeout(() => navigate('/login'), 3000)
    }

    return (
        <div className="w-full min-h-screen relative z-10 pb-32">
            {/* Header */}
            <div className="pt-24 px-6 mb-8 flex items-center gap-4">
                <button
                    onClick={() => navigate('/profile')}
                    className={`p-2 rounded-xl transition-colors ${isDark ? 'bg-white/5 hover:bg-white/10 text-white' : 'bg-gray-100 hover:bg-gray-200 text-gray-700'}`}
                >
                    <ArrowLeft size={20} />
                </button>
                <h1 className={`text-2xl font-black ${textStyle}`}>Delete My Data</h1>
            </div>

            <div className="px-5">
                {step === 1 && (
                    <div className="space-y-6">
                        <div className={`p-8 rounded-[40px] border ${cardBg} text-center`}>
                            <div className="w-20 h-20 bg-red-500/10 text-red-500 rounded-3xl flex items-center justify-center mx-auto mb-6">
                                <AlertTriangle size={40} />
                            </div>
                            <h2 className={`text-xl font-black mb-3 ${textStyle}`}>This action is permanent</h2>
                            <p className={`text-sm leading-relaxed mb-6 ${subTextStyle}`}>
                                Requesting data deletion will result in the permanent removal of your account, saved locations, reviews, and all personal preferences associated with your profile. This cannot be undone.
                            </p>
                            <div className={`p-4 rounded-2xl ${isDark ? 'bg-white/5' : 'bg-gray-50'} text-left space-y-3 mb-6`}>
                                <div className="flex gap-3">
                                    <ShieldCheck size={18} className="text-blue-500 shrink-0" />
                                    <span className={`text-[12px] font-bold ${textStyle}`}>GDPR Compliant: We will process your request within 30 days.</span>
                                </div>
                            </div>
                        </div>
                        <button
                            onClick={handleNext}
                            className="w-full py-4 rounded-[24px] bg-red-500 text-white font-black shadow-xl shadow-red-500/20 hover:bg-red-600 active:scale-[0.98] transition-all"
                        >
                            I Understand, Continue
                        </button>
                    </div>
                )}

                {step === 2 && (
                    <div className="space-y-6 text-center">
                        <div className={`p-8 rounded-[40px] border ${cardBg}`}>
                            <h2 className={`text-xl font-black mb-3 ${textStyle}`}>Confirm Deletion</h2>
                            <p className={`text-sm mb-8 ${subTextStyle}`}>Please type "DELETE" below to confirm that you want to permanently remove your account.</p>
                            <input
                                type="text"
                                className={`w-full p-4 rounded-2xl text-center text-lg font-black outline-none border mb-6 ${isDark ? 'bg-white/5 border-white/10 text-white' : 'bg-gray-50 border-gray-200 text-gray-900'}`}
                                placeholder="TYPE HERE"
                            />
                            <div className="flex gap-3">
                                <button onClick={() => setStep(1)} className={`flex-1 py-4 rounded-2xl font-bold ${isDark ? 'bg-white/5 text-white' : 'bg-gray-100 text-gray-700'}`}>Cancel</button>
                                <button onClick={handleConfirm} className="flex-1 py-4 rounded-2xl bg-red-500 text-white font-bold">Delete Now</button>
                            </div>
                        </div>
                    </div>
                )}

                {step === 3 && (
                    <div className="text-center py-12">
                        <motion.div
                            initial={{ scale: 0.5, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            className="w-20 h-20 bg-green-500/10 text-green-500 rounded-full flex items-center justify-center mx-auto mb-6"
                        >
                            <ShieldCheck size={40} />
                        </motion.div>
                        <h2 className={`text-2xl font-black mb-2 ${textStyle}`}>Request Received</h2>
                        <p className={subTextStyle}>Your account information will be wiped soon. Redirecting you...</p>
                    </div>
                )}
            </div>
        </div>
    )
}

export default DeleteDataPage
