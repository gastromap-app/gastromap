import React from 'react'
import PageHeader from '@/components/layout/public/PageHeader'
import { motion } from 'framer-motion'
import { ArrowUpRight, Clock, User } from 'lucide-react'
import { Link } from 'react-router-dom'

const surfaceApple = "bg-white dark:bg-[#1C1C1E] shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-[0_8px_30px_rgb(255,255,255,0.02)] border border-black/[0.08] dark:border-white/[0.06]"

const fadeInUp = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.5 } },
}

const posts = [
    {
        title: "The Hidden Gems of Tokyo's Izakaya Scene",
        excerpt: "Beyond the neon lights and tourist traps lies a world of intimate taverns where locals gather for yakitori, cold beer, and unfiltered conversation.",
        author: "Mika Tanaka",
        date: "Apr 28, 2026",
        readTime: "6 min read",
        tag: "Travel",
        image: "https://images.unsplash.com/photo-1553621042-f6e147245754?q=80&w=800&auto=format&fit=crop"
    },
    {
        title: "Why Warsaw Became Europe's Most Exciting Food City",
        excerpt: "From traditional pierogi to avant-garde tasting menus, Poland's capital is redefining Central European cuisine one plate at a time.",
        author: "Piotr Kowalski",
        date: "Apr 15, 2026",
        readTime: "5 min read",
        tag: "Culture",
        image: "https://images.unsplash.com/photo-1555396273-367ea4eb4db5?q=80&w=800&auto=format&fit=crop"
    },
    {
        title: "The Science of Pairing: Coffee & Pastry",
        excerpt: "Our AI analyzed 10,000 reviews to find the perfect croissant-and-cappuccino combinations. The results surprised even our data team.",
        author: "GastroMap AI",
        date: "Mar 30, 2026",
        readTime: "4 min read",
        tag: "Science",
        image: "https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?q=80&w=800&auto=format&fit=crop"
    },
    {
        title: "Community Spotlight: Anna's Vegan Map of London",
        excerpt: "How one user built the most comprehensive plant-based dining guide in the UK — and why community curation beats algorithms.",
        author: "Community Team",
        date: "Mar 12, 2026",
        readTime: "7 min read",
        tag: "Community",
        image: "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?q=80&w=800&auto=format&fit=crop"
    }
]

const BlogPage = () => {
    return (
        <div className="bg-[#F5F5F7] dark:bg-black min-h-screen">
            <PageHeader
                title="Stories from the Kitchen"
                subtitle="Travel notes, tasting guides, and community stories from food lovers around the world."
                highlight="GastroMap Journal"
            />

            {/* Featured Post */}
            <section className="px-4 sm:px-6 md:px-8 pb-12">
                <div className="max-w-[1200px] mx-auto">
                    <motion.div
                        variants={fadeInUp}
                        initial="hidden"
                        animate="visible"
                        className={`relative rounded-[32px] md:rounded-[40px] overflow-hidden group cursor-pointer ${surfaceApple}`}
                    >
                        <div className="grid md:grid-cols-2">
                            <div className="relative h-64 md:h-auto overflow-hidden">
                                <img
                                    src="https://images.unsplash.com/photo-1414235077428-338989a2e8c0?q=80&w=1200&auto=format&fit=crop"
                                    alt="Featured post"
                                    className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform [transition-duration:2000ms]"
                                />
                            </div>
                            <div className="p-8 md:p-12 flex flex-col justify-center">
                                <span className="inline-block w-fit px-3 py-1 rounded-full text-xs font-semibold bg-blue-50 text-blue-600 mb-4">Featured</span>
                                <h2 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white mb-4 leading-tight">
                                    The Art of Slow Dining: Why the Best Meals Take Time
                                </h2>
                                <p className="text-gray-500 dark:text-white/60 mb-6 leading-relaxed">
                                    In a world of instant delivery and 15-minute meals, we explore the restaurants that refuse to rush — and why their patience creates unforgettable experiences.
                                </p>
                                <div className="flex items-center gap-4 text-sm text-gray-400">
                                    <span className="flex items-center gap-1"><User size={14} /> Sarah Mitchell</span>
                                    <span className="flex items-center gap-1"><Clock size={14} /> 8 min read</span>
                                </div>
                            </div>
                        </div>
                    </motion.div>
                </div>
            </section>

            {/* Post Grid */}
            <section className="px-4 sm:px-6 md:px-8 pb-24">
                <div className="max-w-[1200px] mx-auto">
                    <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
                        {posts.map((post, i) => (
                            <motion.article
                                key={i}
                                variants={fadeInUp}
                                initial="hidden"
                                whileInView="visible"
                                viewport={{ once: true }}
                                transition={{ delay: i * 0.1 }}
                                className={`group cursor-pointer rounded-[32px] overflow-hidden flex flex-col ${surfaceApple}`}
                            >
                                <div className="relative h-48 overflow-hidden">
                                    <img
                                        src={post.image}
                                        alt={post.title}
                                        className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform [transition-duration:2000ms]"
                                    />
                                    <div className="absolute top-4 left-4">
                                        <span className="px-3 py-1 rounded-full text-xs font-semibold bg-white/90 text-gray-900 backdrop-blur-md">
                                            {post.tag}
                                        </span>
                                    </div>
                                </div>
                                <div className="p-6 flex-1 flex flex-col">
                                    <h3 className="font-bold text-gray-900 dark:text-white mb-2 leading-snug group-hover:text-blue-600 transition-colors">
                                        {post.title}
                                    </h3>
                                    <p className="text-sm text-gray-500 dark:text-white/50 mb-4 line-clamp-2 flex-1">
                                        {post.excerpt}
                                    </p>
                                    <div className="flex items-center justify-between text-xs text-gray-400 pt-4 border-t border-gray-100 dark:border-white/5">
                                        <span className="flex items-center gap-1"><User size={12} /> {post.author}</span>
                                        <span className="flex items-center gap-1"><Clock size={12} /> {post.readTime}</span>
                                    </div>
                                </div>
                            </motion.article>
                        ))}
                    </div>
                </div>
            </section>

            {/* Newsletter CTA */}
            <section className="px-4 sm:px-6 md:px-8 pb-24">
                <div className="max-w-[800px] mx-auto">
                    <motion.div
                        variants={fadeInUp}
                        initial="hidden"
                        whileInView="visible"
                        viewport={{ once: true }}
                        className="bg-gradient-to-br from-blue-900 to-black text-white p-8 md:p-12 rounded-[40px] text-center relative overflow-hidden"
                    >
                        <div className="absolute top-0 right-0 w-64 h-64 bg-blue-600 rounded-full blur-[120px] opacity-20 pointer-events-none" />
                        <h2 className="text-2xl md:text-3xl font-bold mb-4 relative z-10">Get stories in your inbox</h2>
                        <p className="text-white/60 mb-8 max-w-md mx-auto relative z-10">
                            Weekly curated guides, hidden gems, and community highlights from food lovers worldwide.
                        </p>
                        <div className="flex flex-col sm:flex-row gap-3 max-w-md mx-auto relative z-10">
                            <input
                                type="email"
                                placeholder="your@email.com"
                                className="flex-1 h-12 px-5 rounded-full bg-white/10 border border-white/10 text-white placeholder:text-white/40 focus:outline-none focus:border-white/30"
                            />
                            <button className="h-12 px-8 rounded-full bg-white text-blue-900 font-bold text-sm hover:bg-blue-50 transition-colors">
                                Subscribe
                            </button>
                        </div>
                    </motion.div>
                </div>
            </section>
        </div>
    )
}

export default BlogPage
