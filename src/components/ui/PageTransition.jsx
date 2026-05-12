import React from 'react'

/**
 * PageTransition — previously animated with framer-motion (opacity/scale/blur).
 * Removed animation to eliminate the fade-out/fade-in flash on page navigation.
 * Kept as a plain wrapper so existing imports don't break.
 */
export const PageTransition = ({ children, className, style, ...rest }) => {
    return (
        <div style={style} className={className} {...rest}>
            {children}
        </div>
    )
}
