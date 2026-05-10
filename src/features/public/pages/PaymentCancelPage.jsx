import React from 'react';
import { useNavigate } from 'react-router-dom';
import { XCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';

const PaymentCancelPage = () => {
    const { t } = useTranslation();
    const navigate = useNavigate();

    return (
        <div className="min-h-screen bg-[#F5F5F7] dark:bg-black pt-24 sm:pt-32 pb-12 sm:pb-20 flex flex-col items-center justify-center px-4" style={{ paddingTop: 'max(6rem, env(safe-area-inset-top) + 4rem)' }}>
            <div className="bg-white dark:bg-[#1C1C1E] p-6 sm:p-8 md:p-12 rounded-2xl sm:rounded-3xl shadow-sm border border-black/5 dark:border-white/10 max-w-lg w-full text-center">
                <div className="w-16 h-16 sm:w-20 sm:h-20 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mx-auto mb-5 sm:mb-6">
                    <XCircle className="w-8 h-8 sm:w-10 sm:h-10 text-red-600 dark:text-red-500" />
                </div>

                <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white tracking-tight mb-3 sm:mb-4">
                    {t('payment.cancel.title', 'Payment Cancelled')}
                </h1>

                <p className="text-gray-500 dark:text-gray-400 text-base sm:text-lg mb-6 sm:mb-8">
                    {t('payment.cancel.description', 'Your payment process was cancelled and no charges were made. You can try again whenever you are ready.')}
                </p>

                <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center">
                    <button
                        onClick={() => navigate('/dashboard')}
                        className="px-6 sm:px-8 py-3.5 sm:py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-full transition-colors min-h-[48px]"
                    >
                        {t('payment.cancel.try_again', 'Back to Dashboard')}
                    </button>
                    <button
                        onClick={() => navigate('/')}
                        className="px-6 sm:px-8 py-3.5 sm:py-3 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-900 dark:text-white font-medium rounded-full transition-colors min-h-[48px]"
                    >
                        {t('payment.cancel.home', 'Go to Home')}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default PaymentCancelPage;
