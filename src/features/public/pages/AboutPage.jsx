import React from 'react'
import { LazyImage } from '@/components/ui/LazyImage'
import PageHeader from '@/components/layout/public/PageHeader'
import { motion } from 'framer-motion'

const AboutPage = () => {
    return (
        <div className="bg-base-100 min-h-screen">
            <PageHeader
                title="Our Story"
                subtitle="We are on a mission to map the world's culinary treasures."
                highlight="About Us"
            />

            <section className="py-20 px-6">
                <div className="container mx-auto max-w-4xl">
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        className="prose prose-lg mx-auto text-base-content/70 leading-relaxed"
                    >
                        <p className="text-xl font-medium text-base-content mb-8">
                            GastroMap began with a simple question: "Where should we eat?"
                            In a world of overwhelming options and paid reviews, finding true quality is harder than ever.
                        </p>
                        <p className="mb-6">
                            We built an AI-driven platform that cuts through the noise. By analyzing thousands of data points—from classic guidebooks to local whispers—we curate a selection of spots that truly matter.
                        </p>
                        <p className="mb-6">
                            Our team is a diverse mix of chefs, data scientists, and explorers, united by a love for great food and smart technology.
                        </p>

                        <div className="grid grid-cols-2 gap-6 my-12 not-prose">
                            <div className="bg-gray-100 rounded-[32px] h-64 overflow-hidden relative group">
                                <LazyImage 
                                    src="https://images.unsplash.com/photo-1556910103-1c02745a30bf?q=80&w=2940&auto=format&fit=crop" 
                                    alt="Team" 
                                    className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" 
                                    width={800}
                                />
                            </div>
                            <div className="bg-gray-100 rounded-[32px] h-64 overflow-hidden relative group">
                                <LazyImage 
                                    src="https://images.unsplash.com/photo-1522071820081-009f0129c71c?q=80&w=2940&auto=format&fit=crop" 
                                    alt="Office" 
                                    className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" 
                                    width={800}
                                />
                            </div>
                        </div>

                        <h3 className="text-2xl font-bold text-base-content mb-4">Our Values</h3>
                        <ul className="list-disc pl-6 space-y-2 marker:text-blue-600">
                            <li><strong>Authenticity:</strong> No paid placements, ever.</li>
                            <li><strong>Quality:</strong> We verify every location.</li>
                            <li><strong>Community:</strong> Built by foodies, for foodies.</li>
                        </ul>
                    </motion.div>
                </div>
            </section>
        </div>
    )
}

export default AboutPage
