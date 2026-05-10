import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { X, Heart, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const DonationModal = ({ isOpen, onClose, onSubmit, isLoading, initialAmount = '5' }) => {
    const { t } = useTranslation();
    const [amount, setAmount] = useState(initialAmount);
    const [error, setError] = useState('');

    // Update amount if initialAmount changes while modal is closed
    React.useEffect(() => {
        if (!isOpen) {
            setAmount(initialAmount);
            setError('');
        }
    }, [isOpen, initialAmount]);

    const handleSubmit = (e) => {
        e.preventDefault();
        const parsedAmount = parseInt(amount, 10);
        
        if (isNaN(parsedAmount) || parsedAmount <= 0) {
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
                <>
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50"
                    />
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 20 }}
                        className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-md z-50 px-4 max-h-[90vh] flex items-center"
                    >
                        <div className="bg-white dark:bg-[#1C1C1E] rounded-3xl shadow-xl overflow-hidden border border-black/5 dark:border-white/10 w-full max-h-[85vh] overflow-y-auto">
                            <div className="p-5 sm:p-6">
                                <div className="flex items-center justify-between mb-6">
                                    <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center">
                                        <Heart className="w-6 h-6 text-blue-600 dark:text-blue-500" />
                                    </div>
                                    <button 
                                        onClick={onClose}
                                        className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors text-gray-500 dark:text-gray-400"
                                    >
                                        <X className="w-5 h-5" />
                                    </button>
                                </div>
                                
                                <h3 className="text-xl sm:text-2xl font-semibold text-gray-900 dark:text-white mb-2 tracking-tight">
                                    {t('manifesto.support_title', 'Support GastroMap')}
                                </h3>
                                <p className="text-sm sm:text-base text-gray-500 dark:text-gray-400 mb-5 sm:mb-6">
                                    {t('manifesto.support_desc', 'Choose an amount to support the project. Your contribution helps us grow.')}
                                </p>

                                <form onSubmit={handleSubmit}>
                                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
                                        {predefinedAmounts.map((preset) => (
                                            <button
                                                key={preset}
                                                type="button"
                                                onClick={() => setAmount(preset)}
                                                className={`py-3 rounded-xl border text-sm font-medium transition-colors ${
                                                    amount === preset 
                                                        ? 'bg-blue-600 border-blue-600 text-white' 
                                                        : 'bg-white dark:bg-[#2C2C2E] border-gray-200 dark:border-white/10 text-gray-900 dark:text-white hover:border-blue-600 dark:hover:border-blue-500'
                                                }`}
                                            >
                                                ${preset}
                                            </button>
                                        ))}
                                    </div>

                                    <div className="relative mb-5 sm:mb-6">
                                        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                            <span className="text-gray-500 dark:text-gray-400 font-medium text-sm">$</span>
                                        </div>
                                        <input
                                            type="number"
                                            min="1"
                                            value={amount}
                                            onChange={(e) => setAmount(e.target.value)}
                                            className={`block w-full pl-8 pr-12 py-3.5 sm:py-3 bg-white dark:bg-[#2C2C2E] border ${error ? 'border-red-500' : 'border-gray-200 dark:border-white/10'} rounded-xl text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 transition-all text-base min-h-[48px]`}
                                            placeholder="Other amount"
                                        />
                                        <div className="absolute inset-y-0 right-0 pr-4 flex items-center pointer-events-none">
                                            <span className="text-gray-500 dark:text-gray-400 font-medium text-sm">USD</span>
                                        </div>
                                    </div>
                                    
                                    {error && (
                                        <p className="text-red-500 text-sm mb-4">{error}</p>
                                    )}

                                    <button
                                        type="submit"
                                        disabled={isLoading || !amount}
                                        className="w-full py-4 sm:py-3.5 px-4 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-medium rounded-xl flex items-center justify-center transition-colors min-h-[52px] text-base sm:text-sm"
                                    >
                                        {isLoading ? (
                                            <Loader2 className="w-5 h-5 animate-spin" />
                                        ) : (
                                            t('manifesto.support_button', 'Continue to Payment')
                                        )}
                                    </button>
                                </form>
                            </div>
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
};

export default DonationModal;
