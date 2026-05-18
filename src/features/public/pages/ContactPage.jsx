import React, { useState } from 'react'
import { motion } from 'framer-motion'
import { Send, Mail, MapPin, Clock, MessageCircle, ArrowLeft } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'

const CUBIC = [0.86, 0, 0.07, 1]

const ContactPage = () => {
    const { t } = useTranslation()
    const [status, setStatus] = useState('idle')
    const [form, setForm] = useState({ name: '', email: '', subject: 'General Inquiry', message: '' })

    const handleSubmit = (e) => {
        e.preventDefault()
        setStatus('sending')

        const mailtoLink = `mailto:gastromap1@gmail.com?subject=[GastroMap Contact] ${encodeURIComponent(form.subject)} from ${encodeURIComponent(form.name)}&body=${encodeURIComponent(
            `Name: ${form.name}\nEmail: ${form.email}\n\nMessage:\n${form.message}`
        )}`
        window.location.href = mailtoLink

        setTimeout(() => {
            setStatus('success')
        }, 800)
    }

    const set = (field, val) => setForm(prev => ({ ...prev, [field]: val }))

    return (
        <div className="min-h-screen bg-[#FAFAFA] dark:bg-[hsl(220,20%,3%)] relative overflow-hidden">
            {/* Background decorations */}
            <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-indigo-500/5 dark:bg-indigo-500/10 rounded-full blur-[150px] pointer-events-none" />
            <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-violet-500/5 dark:bg-violet-500/10 rounded-full blur-[120px] pointer-events-none" />

            {/* Header */}
            <header className="relative z-10 pt-32 pb-16 px-6 text-center">
                <motion.div
                    initial={{ opacity: 0, y: 24 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.8, ease: CUBIC }}
                >
                    <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-100 dark:border-indigo-500/20 mb-8">
                        <MessageCircle size={14} className="text-indigo-600 dark:text-indigo-400" />
                        <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider">Get in Touch</span>
                    </div>

                    <h1 className="text-5xl md:text-7xl font-black text-slate-900 dark:text-white tracking-tighter leading-[0.9] mb-6">
                        Let's <span className="text-indigo-600">talk.</span>
                    </h1>

                    <p className="text-lg md:text-xl text-slate-500 dark:text-slate-400 font-medium max-w-lg mx-auto leading-relaxed">
                        Questions, feedback, or a new discovery to share — we're always happy to hear from you.
                    </p>
                </motion.div>
            </header>

            {/* Main content */}
            <section className="relative z-10 px-6 pb-32">
                <div className="max-w-5xl mx-auto grid lg:grid-cols-5 gap-8 lg:gap-12">

                    {/* Contact info — left column */}
                    <motion.div
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.7, delay: 0.2, ease: CUBIC }}
                        className="lg:col-span-2 space-y-8"
                    >
                        <div className="bg-white dark:bg-[hsl(220,20%,6%)] rounded-[28px] border border-slate-100 dark:border-white/[0.06] p-8 shadow-sm">
                            <h2 className="text-xl font-black text-slate-900 dark:text-white tracking-tight mb-6">Contact Info</h2>

                            <div className="space-y-5">
                                <div className="flex items-center gap-4">
                                    <div className="w-11 h-11 rounded-2xl bg-indigo-50 dark:bg-indigo-500/10 flex items-center justify-center shrink-0">
                                        <Mail size={18} className="text-indigo-600 dark:text-indigo-400" />
                                    </div>
                                    <div>
                                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Email</p>
                                        <a href="mailto:gastromap1@gmail.com" className="text-sm font-semibold text-slate-900 dark:text-white hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">
                                            gastromap1@gmail.com
                                        </a>
                                    </div>
                                </div>

                                <div className="flex items-center gap-4">
                                    <div className="w-11 h-11 rounded-2xl bg-indigo-50 dark:bg-indigo-500/10 flex items-center justify-center shrink-0">
                                        <MapPin size={18} className="text-indigo-600 dark:text-indigo-400" />
                                    </div>
                                    <div>
                                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Location</p>
                                        <span className="text-sm font-semibold text-slate-900 dark:text-white">Wrocław, Poland</span>
                                    </div>
                                </div>

                                <div className="flex items-center gap-4">
                                    <div className="w-11 h-11 rounded-2xl bg-indigo-50 dark:bg-indigo-500/10 flex items-center justify-center shrink-0">
                                        <Clock size={18} className="text-indigo-600 dark:text-indigo-400" />
                                    </div>
                                    <div>
                                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Response Time</p>
                                        <span className="text-sm font-semibold text-slate-900 dark:text-white">Within 24 hours</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Back link */}
                        <Link
                            to="/"
                            className="inline-flex items-center gap-2 text-sm font-bold text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors group"
                        >
                            <ArrowLeft size={16} className="group-hover:-translate-x-1 transition-transform" />
                            Back to Home
                        </Link>
                    </motion.div>

                    {/* Form — right column */}
                    <motion.div
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.7, delay: 0.3, ease: CUBIC }}
                        className="lg:col-span-3"
                    >
                        <div className="bg-white dark:bg-[hsl(220,20%,6%)] rounded-[28px] border border-slate-100 dark:border-white/[0.06] p-8 lg:p-10 shadow-sm">
                            {status === 'success' ? (
                                <motion.div
                                    initial={{ opacity: 0, scale: 0.9 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    className="text-center py-12"
                                >
                                    <div className="w-20 h-20 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-[28px] flex items-center justify-center mx-auto mb-6 shadow-lg shadow-emerald-500/10">
                                        <Send size={32} />
                                    </div>
                                    <h3 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight mb-3">Message Sent!</h3>
                                    <p className="text-slate-500 dark:text-slate-400 font-medium mb-8">We'll get back to you as soon as possible.</p>
                                    <button
                                        onClick={() => { setStatus('idle'); setForm({ name: '', email: '', subject: 'General Inquiry', message: '' }) }}
                                        className="h-12 px-8 rounded-2xl bg-slate-100 dark:bg-white/[0.06] text-slate-600 dark:text-slate-300 font-bold text-sm hover:bg-slate-200 dark:hover:bg-white/[0.1] transition-all active:scale-95"
                                    >
                                        Send another message
                                    </button>
                                </motion.div>
                            ) : (
                                <form onSubmit={handleSubmit} className="space-y-5">
                                    <div className="grid sm:grid-cols-2 gap-5">
                                        <div className="space-y-2">
                                            <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider ml-1">Name</label>
                                            <input
                                                required
                                                type="text"
                                                value={form.name}
                                                onChange={e => set('name', e.target.value)}
                                                placeholder="Your name"
                                                className="w-full h-12 px-5 rounded-2xl bg-slate-50/80 dark:bg-[hsl(220,20%,9%)] border border-slate-100 dark:border-white/[0.06] text-slate-900 dark:text-white font-medium focus:outline-none focus:border-indigo-400 dark:focus:border-indigo-500 transition-colors placeholder:text-slate-300 dark:placeholder:text-slate-600"
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider ml-1">Email</label>
                                            <input
                                                required
                                                type="email"
                                                value={form.email}
                                                onChange={e => set('email', e.target.value)}
                                                placeholder="your@email.com"
                                                className="w-full h-12 px-5 rounded-2xl bg-slate-50/80 dark:bg-[hsl(220,20%,9%)] border border-slate-100 dark:border-white/[0.06] text-slate-900 dark:text-white font-medium focus:outline-none focus:border-indigo-400 dark:focus:border-indigo-500 transition-colors placeholder:text-slate-300 dark:placeholder:text-slate-600"
                                            />
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider ml-1">Subject</label>
                                        <select
                                            value={form.subject}
                                            onChange={e => set('subject', e.target.value)}
                                            className="w-full h-12 px-5 rounded-2xl bg-slate-50/80 dark:bg-[hsl(220,20%,9%)] border border-slate-100 dark:border-white/[0.06] text-slate-900 dark:text-white font-medium focus:outline-none focus:border-indigo-400 dark:focus:border-indigo-500 transition-colors appearance-none"
                                        >
                                            <option>General Inquiry</option>
                                            <option>Support</option>
                                            <option>Partnership</option>
                                            <option>Report a Bug</option>
                                            <option>New Location Suggestion</option>
                                        </select>
                                    </div>

                                    <div className="space-y-2">
                                        <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider ml-1">Message</label>
                                        <textarea
                                            required
                                            rows={5}
                                            value={form.message}
                                            onChange={e => set('message', e.target.value)}
                                            placeholder="Tell us what's on your mind..."
                                            className="w-full p-5 rounded-2xl bg-slate-50/80 dark:bg-[hsl(220,20%,9%)] border border-slate-100 dark:border-white/[0.06] text-slate-900 dark:text-white font-medium focus:outline-none focus:border-indigo-400 dark:focus:border-indigo-500 transition-colors resize-none placeholder:text-slate-300 dark:placeholder:text-slate-600"
                                        />
                                    </div>

                                    <button
                                        type="submit"
                                        disabled={status === 'sending'}
                                        className="w-full h-14 rounded-2xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-black text-sm uppercase tracking-widest shadow-xl shadow-slate-900/10 dark:shadow-white/5 hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-3"
                                    >
                                        {status === 'sending' ? (
                                            <>
                                                <span className="w-4 h-4 rounded-full border-2 border-white/30 dark:border-slate-900/30 border-t-white dark:border-t-slate-900 animate-spin" />
                                                Opening mail client...
                                            </>
                                        ) : (
                                            <>
                                                <Send size={16} />
                                                Send Message
                                            </>
                                        )}
                                    </button>
                                </form>
                            )}
                        </div>
                    </motion.div>
                </div>
            </section>
        </div>
    )
}

export default ContactPage
