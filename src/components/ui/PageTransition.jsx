import React from 'react'
import { motion, useReducedMotion } from 'framer-motion'

const fullVariants = {
    initial: { opacity: 0, y: 16, scale: 0.98, filter: 'blur(8px)' },
    animate: { opacity: 1, y: 0,  scale: 1,    filter: 'blur(0px)' },
    exit:    { opacity: 0, y: -12, scale: 0.98, filter: 'blur(8px)' },
}

const reducedVariants = {
    initial: { opacity: 0 },
    animate: { opacity: 1 },
    exit:    { opacity: 0 },
}

const transition = {
    type: 'spring',
    stiffness: 280,
    damping: 28,
    mass: 0.6,
}

const reducedTransition = { duration: 0.15 }

export const PageTransition = ({ children, className }) => {
    const shouldReduceMotion = useReducedMotion()
    return (
        <motion.div
            initial="initial"
            animate="animate"
            exit="exit"
            variants={shouldReduceMotion ? reducedVariants : fullVariants}
            transition={shouldReduceMotion ? reducedTransition : transition}
            style={{ willChange: 'opacity, transform' }}
            className={className}
        >
            {children}
        </motion.div>
    )
}
