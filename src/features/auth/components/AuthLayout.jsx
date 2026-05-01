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
        <div className={`min-h-screen w-full bg-white flex ${reverse ? 'flex-row-reverse' : ''}`}>
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
            <div className="flex-1 relative flex items-center justify-center p-6 bg-gray-50/50">
                <Link
                    to={backTo}
                    className="absolute top-8 left-8 lg:left-12 p-3 bg-white hover:bg-gray-100 rounded-full transition-colors group"
                >
                    <ArrowLeft size={20} className="text-gray-900 group-hover:-translate-x-1 transition-transform" />
                </Link>

                {children}
            </div>
        </div>
    )
}
