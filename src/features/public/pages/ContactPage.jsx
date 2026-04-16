import React, { useState } from 'react'
import PageHeader from '@/components/layout/public/PageHeader'
import { Button } from '@/components/ui/button'
import { motion } from 'framer-motion'
import { Send, Mail, MapPin, Clock } from 'lucide-react'

const ContactPage = () => {
    const [status, setStatus] = useState('idle')
    const [form, setForm] = useState({ name: '', email: '', subject: 'General Inquiry', message: '' })

    const handleSubmit = (e) => {
        e.preventDefault()
        setStatus('sending')

        // Send via mailto (real delivery without backend)
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
        <div className="bg-base-100 min-h-screen">
            <PageHeader
                title="Get in Touch"
                subtitle="Have a question or found a hidden gem? Let us know."
                highlight="Contact"
            />

            <section className="py-20 px-6">
                <div className="container mx-auto max-w-4xl grid md:grid-cols-2 gap-12">
                    {/* Contact info */}
                    <div className="space-y-8">
                        <div>
                            <h2 className="text-2xl font-bold mb-4">Contact Information</h2>
                            <p className="text-gray-500 leading-relaxed">
                                We're always happy to hear from you — whether it's a question, feedback, or a new discovery.
                            </p>
                        </div>
                        <div className="space-y-4">
                            <div className="flex items-center gap-3 text-gray-600">
                                <div className="w-10 h-10 rounded-full bg-indigo-50 flex items-center justify-center">
                                    <Mail size={18} className="text-indigo-600" />
                                </div>
                                <a href="mailto:gastromap1@gmail.com" className="hover:text-indigo-600 transition-colors font-medium">
                                    gastromap1@gmail.com
                                </a>
                            </div>
                            <div className="flex items-center gap-3 text-gray-600">
                                <div className="w-10 h-10 rounded-full bg-indigo-50 flex items-center justify-center">
                                    <MapPin size={18} className="text-indigo-600" />
                                </div>
                                <span className="font-medium">Wrocław, Poland</span>
                            </div>
                            <div className="flex items-center gap-3 text-gray-600">
                                <div className="w-10 h-10 rounded-full bg-indigo-50 flex items-center justify-center">
                                    <Clock size={18} className="text-indigo-600" />
                                </div>
                                <span className="font-medium">Response within 24 hours</span>
                            </div>
                        </div>
                    </div>

                    {/* Form */}
                    <div className="bg-white rounded-[32px] border border-gray-100 shadow-xl p-8">
                        {status === 'success' ? (
                            <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="text-center py-8">
                                <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-4">
                                    <Send size={28} />
                                </div>
                                <h3 className="text-2xl font-bold mb-2">Message Sent!</h3>
                                <p className="text-gray-500">We'll get back to you as soon as possible.</p>
                                <Button variant="outline" className="mt-8 rounded-full" onClick={() => { setStatus('idle'); setForm({ name: '', email: '', subject: 'General Inquiry', message: '' }) }}>
                                    Send another
                                </Button>
                            </motion.div>
                        ) : (
                            <form onSubmit={handleSubmit} className="space-y-5">
                                <div className="space-y-1.5">
                                    <label className="text-sm font-bold text-gray-800 ml-1">Name</label>
                                    <input required type="text" value={form.name} onChange={e => set('name', e.target.value)}
                                        placeholder="Your name"
                                        className="w-full h-12 px-4 rounded-xl bg-gray-50 border border-gray-200 focus:outline-none focus:border-indigo-400 transition-colors font-medium" />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-sm font-bold text-gray-800 ml-1">Email</label>
                                    <input required type="email" value={form.email} onChange={e => set('email', e.target.value)}
                                        placeholder="your@email.com"
                                        className="w-full h-12 px-4 rounded-xl bg-gray-50 border border-gray-200 focus:outline-none focus:border-indigo-400 transition-colors font-medium" />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-sm font-bold text-gray-800 ml-1">Subject</label>
                                    <select value={form.subject} onChange={e => set('subject', e.target.value)}
                                        className="w-full h-12 px-4 rounded-xl bg-gray-50 border border-gray-200 focus:outline-none focus:border-indigo-400 transition-colors font-medium">
                                        <option>General Inquiry</option>
                                        <option>Support</option>
                                        <option>Partnership</option>
                                        <option>Report a Bug</option>
                                        <option>New Location Suggestion</option>
                                    </select>
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-sm font-bold text-gray-800 ml-1">Message</label>
                                    <textarea required rows={5} value={form.message} onChange={e => set('message', e.target.value)}
                                        placeholder="Tell us what's on your mind..."
                                        className="w-full p-4 rounded-xl bg-gray-50 border border-gray-200 focus:outline-none focus:border-indigo-400 transition-colors font-medium resize-none" />
                                </div>
                                <Button type="submit" disabled={status === 'sending'}
                                    className="w-full h-12 rounded-full bg-slate-900 hover:bg-slate-800 text-white font-bold text-sm transition-all hover:scale-[1.02]">
                                    {status === 'sending' ? 'Opening mail client...' : 'Send Message'}
                                </Button>
                            </form>
                        )}
                    </div>
                </div>
            </section>
        </div>
    )
}

export default ContactPage
