import React from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'

/**
 * AuthLayout — shared split-screen layout for Login, SignUp, ForgotPassword, ResetPassword.
 *
 * @param {React.ReactNode} children — form content (right side)
 * @param {React.ReactNode} leftChildren — branded visual content (left side)
 * @param {boolean} [reverse=false] — swap left/right for visual variety
 * @param {string} [backTo='/'] — back-button destination
 * @param {[string,string]} [aurora=['bg-blue-600','bg-indigo-600']] — full tailwind bg-* classes for aurora blobs
 */
export function AuthLayout({ children, leftChildren, reverse = false, backTo = '/', aurora = ['bg-blue-600', 'bg-indigo-600'] }) {
    const [topClass, bottomClass] = aurora
    const topPos = reverse ? 'top-[-20%] right-[-20%]' : 'top-[-20%] left-[-20%]'
    const bottomPos = reverse ? 'bottom-[-20%] left-[-20%]' : 'bottom-[-20%] right-[-20%]'

    return (
        <div className={`min-h-screen w-full flex ${reverse ? 'flex-row-reverse' : ''}`}>
            {/* Left Side — Visual (desktop only) */}
            <div className="hidden lg:flex lg:w-[45%] relative bg-black text-white p-12 flex-col justify-between overflow-hidden">
                {/* Aurora Background */}
                <div className="absolute top-0 left-0 w-full h-full opacity-60 pointer-events-none">
                    <div className={`absolute ${topPos} w-[80%] h-[80%] ${topClass} rounded-full blur-[120px] animate-pulse`} />
                    <div className={`absolute ${bottomPos} w-[80%] h-[80%] ${bottomClass} rounded-full blur-[120px] animate-pulse delay-700`} />
                </div>

                {leftChildren}
            </div>

            {/* Right Side — Form */}
            <div className="flex-1 relative flex items-center justify-center bg-gray-50/50 lg:bg-gray-50/50 overflow-y-auto"
                style={{
                    background: 'linear-gradient(135deg, #0f172a 0%, #1e1b4b 50%, #312e81 100%)',
                }}>
                {/* Mobile aurora blobs */}
                <div className="lg:hidden absolute inset-0 overflow-hidden pointer-events-none">
                    <div className={`absolute top-[-10%] left-[-20%] w-[70%] h-[50%] ${topClass} rounded-full blur-[100px] opacity-40 animate-pulse`} />
                    <div className={`absolute bottom-[-10%] right-[-20%] w-[70%] h-[50%] ${bottomClass} rounded-full blur-[100px] opacity-40 animate-pulse delay-700`} />
                </div>

                {/* Back button — safe-area aware */}
                <Link
                    to={backTo}
                    className="absolute z-20 left-6 lg:left-12 p-3 bg-white/10 lg:bg-white hover:bg-white/20 lg:hover:bg-gray-100 rounded-full transition-colors group backdrop-blur-md border border-white/10 lg:border-none"
                    style={{ top: 'max(1.5rem, env(safe-area-inset-top) + 0.5rem)' }}
                >
                    <ArrowLeft size={20} className="text-white lg:text-gray-900 group-hover:-translate-x-1 transition-transform" />
                </Link>

                {/* Form wrapper with mobile padding for safe area */}
                <div className="relative z-10 w-full px-6 py-8 flex items-center justify-center min-h-screen"
                    style={{ paddingTop: 'max(5rem, env(safe-area-inset-top) + 4rem)', paddingBottom: 'max(2rem, env(safe-area-inset-bottom) + 1rem)' }}>
                    {children}
                </div>
            </div>
        </div>
    )
}
