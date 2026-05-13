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
            <div className="flex-1 relative flex items-center justify-center overflow-y-auto bg-[#0A0A0A] lg:bg-gray-50/50">
                {/* Mobile animated gradient mesh — same style as Community First section */}
                <div className="lg:hidden absolute inset-0 overflow-hidden pointer-events-none">
                    <div
                        className="absolute inset-0"
                        style={{
                            background: 'radial-gradient(ellipse at 20% 50%, rgba(225,29,72,0.15) 0%, transparent 50%), radial-gradient(ellipse at 80% 20%, rgba(59,130,246,0.12) 0%, transparent 50%), radial-gradient(ellipse at 50% 80%, rgba(16,185,129,0.1) 0%, transparent 50%)',
                            animation: 'authGradientMove 12s ease-in-out infinite',
                        }}
                    />
                    {/* Grid overlay */}
                    <div
                        className="absolute inset-0 opacity-[0.03]"
                        style={{
                            backgroundImage: 'linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)',
                            backgroundSize: '60px 60px',
                        }}
                    />
                    <style>{`
                        @keyframes authGradientMove {
                            0%, 100% {
                                background: radial-gradient(ellipse at 20% 50%, rgba(225,29,72,0.15) 0%, transparent 50%), radial-gradient(ellipse at 80% 20%, rgba(59,130,246,0.12) 0%, transparent 50%), radial-gradient(ellipse at 50% 80%, rgba(16,185,129,0.1) 0%, transparent 50%);
                            }
                            33% {
                                background: radial-gradient(ellipse at 60% 30%, rgba(225,29,72,0.18) 0%, transparent 50%), radial-gradient(ellipse at 30% 70%, rgba(59,130,246,0.15) 0%, transparent 50%), radial-gradient(ellipse at 80% 60%, rgba(16,185,129,0.12) 0%, transparent 50%);
                            }
                            66% {
                                background: radial-gradient(ellipse at 40% 60%, rgba(225,29,72,0.12) 0%, transparent 50%), radial-gradient(ellipse at 70% 40%, rgba(59,130,246,0.1) 0%, transparent 50%), radial-gradient(ellipse at 20% 30%, rgba(16,185,129,0.15) 0%, transparent 50%);
                            }
                        }
                    `}</style>
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
                <div className="relative z-10 w-full px-5 sm:px-6 py-4 sm:py-8 flex items-center justify-center min-h-[100dvh]"
                    style={{ paddingTop: 'max(3.5rem, env(safe-area-inset-top) + 2.5rem)', paddingBottom: 'max(1.5rem, env(safe-area-inset-bottom) + 0.5rem)' }}>
                    {children}
                </div>
            </div>
        </div>
    )
}
