import React from 'react'
import { Link } from 'react-router-dom'
import { Instagram, Twitter, Linkedin } from 'lucide-react'

const PublicFooter = () => (
    <div className="bg-slate-50 dark:bg-slate-950 transition-colors duration-500 mt-auto">
        <footer className="relative bg-black text-white py-12 md:py-20 rounded-t-[30px] md:rounded-t-[40px] overflow-hidden">

            {/* Static CSS Gradient Background — no JS, no GPU */}
            <div
                className="absolute inset-0 pointer-events-none"
                aria-hidden="true"
                style={{
                    background: `
                        radial-gradient(ellipse 90% 80% at -10% 120%, rgba(29,78,216,0.45) 0%, transparent 55%),
                        radial-gradient(ellipse 70% 60% at 110% 110%, rgba(37,99,235,0.30) 0%, transparent 50%),
                        radial-gradient(ellipse 50% 40% at 50% 100%, rgba(99,102,241,0.15) 0%, transparent 60%)
                    `
                }}
            />

            <div className="w-full relative z-10 px-4 md:px-8">
                <div className="flex flex-col lg:flex-row justify-between items-start gap-12">
                    <div>
                        <div className="bg-white/10 w-fit px-4 py-2 rounded-full flex items-center gap-2 mb-6 backdrop-blur-md border border-white/5 text-white">
                            <img src="/pwa-icon-192.png" alt="GastroMap Logo" className="w-6 h-6 object-cover rounded-full" />
                            <span className="font-semibold text-sm">GastroMap</span>
                        </div>
                        <p className="text-gray-400 text-sm max-w-xs leading-relaxed">
                            The world's most intelligent culinary guide. <br className="hidden sm:block" />
                            Made with love for foodies.
                        </p>
                        <div className="flex gap-4 mt-8">
                            {[[Instagram, 'https://instagram.com'], [Twitter, 'https://x.com'], [Linkedin, 'https://linkedin.com']].map(([Icon, url], i) => (
                                <div key={i} className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center hover:bg-blue-600 transition-colors cursor-pointer backdrop-blur-md border border-white/5">
                                    <Icon size={18} />
                                </div>
                            ))}
                        </div>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-4 gap-x-8 gap-y-12 md:gap-12 w-full lg:w-auto">
                        {[
                            {
                                head: "Product", links: [
                                    { name: 'Dashboard', path: '/dashboard' },
                                    { name: 'Add a Place', path: '/auth/signup?action=add-place' },
                                    { name: 'Supporter Options', path: '/pricing' }
                                ]
                            },
                            {
                                head: "Community", links: [
                                    { name: 'Leaderboard', path: '/dashboard/leaderboard' },
                                    { name: 'Guidelines', path: '/help' },
                                    { name: 'Blog', path: '/blog' }
                                ]
                            },
                            {
                                head: "Legal", links: [
                                    { name: 'Privacy', path: '/privacy' },
                                    { name: 'Terms', path: '/terms' },
                                    { name: 'Security', path: '/security' },
                                    { name: 'Cookies', path: '/cookies' }
                                ]
                            },
                            {
                                head: "Support", links: [
                                    { name: 'Help Center', path: '/help' },
                                    { name: 'Status', path: '/status' },
                                    { name: 'Community', path: '/community' },
                                    { name: 'Contact', path: '/contact' }
                                ]
                            },
                        ].map((col, i) => (
                            <div key={i} className="min-w-[120px]">
                                <h4 className="font-bold mb-4 md:mb-6 text-sm md:text-base">{col.head}</h4>
                                <ul className="space-y-4 text-sm text-gray-400">
                                    {col.links.map(l => (
                                        <li key={l.name}>
                                            <Link to={l.path} className="hover:text-white cursor-pointer transition-colors">
                                                {l.name}
                                            </Link>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        ))}
                    </div>
                </div>
                <div className="border-t border-white/10 mt-12 md:mt-20 pt-8 flex flex-col md:flex-row justify-between items-center gap-4 text-center md:text-left text-[10px] md:text-xs text-gray-500">
                    <p>© 2025 GastroMap Inc. All rights reserved.</p>
                    <div className="flex gap-6">
                        <Link to="/privacy" className="hover:text-white transition-colors">Privacy Policy</Link>
                        <Link to="/terms" className="hover:text-white transition-colors">Terms of Service</Link>
                    </div>
                </div>
            </div>
        </footer>
    </div>
)

export default PublicFooter
