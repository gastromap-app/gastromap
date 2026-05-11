import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { X, Heart, Loader2, Coffee } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const DonationModal = ({ isOpen, onClose, onSubmit, isLoading, initialAmount = '5' }) => {
    const { t } = useTranslation();
    const [amount, setAmount] = useState(initialAmount);
    const [error, setError] = useState('');
    const [customMode, setCustomMode] = useState(false);

    // Reset state when modal closes — intentional synchronous reset
    useEffect(() => {
        if (!isOpen) {
            setAmount(initialAmount);
            setError('');
            setCustomMode(false);
        }
    }, [isOpen, initialAmount]);

    const handleClose = useCallback(() => {
        if (isLoading) return;
        onClose();
    }, [isLoading, onClose]);

    useEffect(() => {
        const handleEscape = (e) => {
            if (e.key === 'Escape') handleClose();
        };
        if (isOpen) {
            document.addEventListener('keydown', handleEscape);
            document.body.style.overflow = 'hidden';
        }
        return () => {
            document.removeEventListener('keydown', handleEscape);
            document.body.style.overflow = '';
        };
    }, [isOpen, handleClose]);

    const handlePresetClick = (preset) => {
        setAmount(preset);
        setCustomMode(false);
        setError('');
    };

    const handleCustomClick = () => {
        setCustomMode(true);
        setAmount('');
        setError('');
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        const parsedAmount = parseInt(amount, 10);

        if (isNaN(parsedAmount) || parsedAmount < 1) {
            setError(t('manifesto.invalid_amount', 'Please enter a valid amount'));
            return;
        }

        setError('');
        onSubmit(parsedAmount);
    };

    const predefinedAmounts = ['5', '10', '25', '50'];

    return (
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center">
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        onClick={handleClose}
                        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
                    />

                    {/* Modal Container */}
                    <motion.div
                        initial={{ opacity: 0, y: '100%' }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: '100%' }}
                        transition={{ type: 'spring', damping: 28, stiffness: 350 }}
                        className="relative w-full sm:max-w-[420px] sm:mx-4"
                    >
                        {/* Mobile handle indicator */}
                        <div className="sm:hidden flex justify-center pt-3 pb-1">
                            <div className="w-10 h-1 rounded-full bg-white/30" />
                        </div>

                        {/* Card */}
                        <div className="bg-white dark:bg-[#1C1C1E] rounded-t-[2rem] sm:rounded-[2rem] shadow-2xl border border-black/5 dark:border-white/10 max-h-[85vh] overflow-y-auto">
                            <div className="p-6 sm:p-8">
                                {/* Header */}
                                <div className="flex items-start justify-between mb-6">
                                    <div className="flex items-center gap-3">
                                        <div className="w-11 h-11 bg-blue-100 dark:bg-blue-500/20 rounded-2xl flex items-center justify-center">
                                            <Coffee className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                                        </div>
                                        <div>
                                            <h3 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white tracking-tight">
                                                {t('manifesto.support_title', 'Support GastroMap')}
                                            </h3>
                                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                                                {t('manifesto.support_subtitle', 'One-time donation')}
                                            </p>
                                        </div>
                                    </div>
                                    <button
                                        onClick={handleClose}
                                        disabled={isLoading}
                                        className="p-2 -mr-2 -mt-2 hover:bg-gray-100 dark:hover:bg-white/10 rounded-xl transition-colors text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 disabled:opacity-30"
                                    >
                                        <X className="w-5 h-5" />
                                    </button>
                                </div>

                                {/* Description */}
                                <p className="text-sm text-gray-500 dark:text-gray-400 mb-6 leading-relaxed">
                                    {t('manifesto.support_desc', 'Choose an amount to support the project. Your contribution helps us grow and improve.')}
                                </p>

                                <form onSubmit={handleSubmit}>
                                    {/* Preset Amounts */}
                                    <div className="grid grid-cols-2 gap-3 mb-4">
                                        {predefinedAmounts.map((preset) => (
                                            <button
                                                key={preset}
                                                type="button"
                                                onClick={() => handlePresetClick(preset)}
                                                className={`relative py-3.5 px-4 rounded-2xl border-2 text-sm font-bold transition-all active:scale-[0.97] ${
                                                    amount === preset && !customMode
                                                        ? 'bg-blue-600 border-blue-600 text-white shadow-lg shadow-blue-600/25'
                                                        : 'bg-transparent border-gray-200 dark:border-white/10 text-gray-900 dark:text-white hover:border-blue-400 dark:hover:border-blue-500'
                                                }`}
                                            >
                                                <span className="text-lg">${preset}</span>
                                                {preset === '5' && (
                                                    <span className="absolute -top-2 left-1/2 -translate-x-1/2 px-2 py-0.5 bg-blue-600 text-white text-[9px] font-black uppercase tracking-wider rounded-full">
                                                        Popular
                                                    </span>
                                                )}
                                            </button>
                                        ))}
                                    </div>

                                    {/* Custom Amount Toggle */}
                                    <button
                                        type="button"
                                        onClick={handleCustomClick}
                                        className={`w-full py-3 px-4 rounded-2xl border-2 text-sm font-bold transition-all mb-4 active:scale-[0.97] ${
                                            customMode
                                                ? 'bg-blue-600 border-blue-600 text-white shadow-lg shadow-blue-600/25'
                                                : 'bg-transparent border-dashed border-gray-300 dark:border-white/15 text-gray-500 dark:text-gray-400 hover:border-blue-400 dark:hover:border-blue-500 hover:text-blue-600 dark:hover:text-blue-400'
                                        }`}
                                    >
                                        {customMode ? t('manifesto.custom_amount', 'Custom amount') : `+ ${t('manifesto.custom_amount', 'Custom amount')}`}
                                    </button>

                                    {/* Custom Input */}
                                    <AnimatePresence>
                                        {customMode && (
                                            <motion.div
                                                initial={{ height: 0, opacity: 0 }}
                                                animate={{ height: 'auto', opacity: 1 }}
                                                exit={{ height: 0, opacity: 0 }}
                                                transition={{ duration: 0.2 }}
                                                className="overflow-hidden mb-4"
                                            >
                                                <div className="relative">
                                                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                                        <span className="text-gray-400 dark:text-gray-500 font-bold text-lg">$</span>
                                                    </div>
                                                    <input
                                                        type="number"
                                                        min="1"
                                                        step="1"
                                                        autoFocus
                                                        value={amount}
                                                        onChange={(e) => setAmount(e.target.value)}
                                                        className={`block w-full pl-10 pr-16 py-4 bg-gray-50 dark:bg-white/5 border-2 ${error ? 'border-red-400' : 'border-gray-200 dark:border-white/10'} rounded-2xl text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:border-blue-500 dark:focus:border-blue-400 transition-all text-lg font-bold`}
                                                        placeholder="Enter amount"
                                                    />
                                                    <div className="absolute inset-y-0 right-0 pr-4 flex items-center pointer-events-none">
                                                        <span className="text-gray-400 dark:text-gray-500 font-medium text-sm">USD</span>
                                                    </div>
                                                </div>
                                            </motion.div>
                                        )}
                                    </AnimatePresence>

                                    {/* Error */}
                                    <AnimatePresence>
                                        {error && (
                                            <motion.p
                                                initial={{ opacity: 0, y: -5 }}
                                                animate={{ opacity: 1, y: 0 }}
                                                exit={{ opacity: 0, y: -5 }}
                                                className="text-red-500 text-sm mb-4 px-1"
                                            >
                                                {error}
                                            </motion.p>
                                        )}
                                    </AnimatePresence>

                                    {/* Submit Button */}
                                    <button
                                        type="submit"
                                        disabled={isLoading || (!amount && customMode)}
                                        className="w-full py-4 px-4 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold rounded-2xl flex items-center justify-center gap-2.5 transition-all active:scale-[0.98] text-base shadow-lg shadow-blue-600/20"
                                    >
                                        {isLoading ? (
                                            <Loader2 className="w-5 h-5 animate-spin" />
                                        ) : (
                                            <>
                                                <Heart className="w-4 h-4 fill-white" />
                                                {t('manifesto.support_button', 'Continue to Payment')}
                                            </>
                                        )}
                                    </button>

                                    {/* Secure note */}
                                    <p className="text-center text-[11px] text-gray-400 dark:text-gray-500 mt-4 flex items-center justify-center gap-1.5">
                                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                                        </svg>
                                        {t('manifesto.secure_payment', 'Secure payment via Stripe')}
                                    </p>
                                </form>
                            </div>
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
};

export default DonationModal;
