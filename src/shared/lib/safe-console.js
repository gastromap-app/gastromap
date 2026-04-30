/**
 * Safe console wrapper for production safety
 * Prevents "console.log is not a function" errors when console is undefined or overridden
 */



/**
 * Safely call console method, falling back to noop if not available
 */
function safeConsole(method, ...args) {
    try {
        if (typeof console?.[method] === 'function') {
            console[method](...args)
        }
    } catch {
        // Silently fail if console logging fails
    }
}

export const log = (...args) => safeConsole('log', ...args)
export const warn = (...args) => safeConsole('warn', ...args)
export const error = (...args) => safeConsole('error', ...args)
export const info = (...args) => safeConsole('info', ...args)

// Default export for easy replacement: import safeConsole from '...'
export default {
    log,
    warn,
    error,
    info,
    // Direct passthrough for cases where we want the real console
    _raw: console
}
