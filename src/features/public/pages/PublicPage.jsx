import React from 'react'
import PageHeader from '@/components/layout/public/PageHeader'
import { motion } from 'framer-motion'

const PublicPage = ({ title, subtitle, content }) => {
    return (
        <div className="bg-white min-h-screen">
            <PageHeader title={title} subtitle={subtitle} />
            <div className="container mx-auto px-6 max-w-4xl py-12">
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.2 }}
                    className="prose prose-lg prose-blue mx-auto text-gray-600"
                >
                    {content || (
                        <div className="bg-gray-50 rounded-3xl p-12 text-center border border-gray-100">
                            <p className="text-gray-500 dark:text-gray-400">Content for {title} is coming soon.</p>
                        </div>
                    )}
                </motion.div>
            </div>
        </div>
    )
}

export default PublicPage
