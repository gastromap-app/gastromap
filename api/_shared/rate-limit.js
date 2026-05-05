// Simple in-memory rate limiter (best-effort for serverless)
const stores = new Map()

function getStore(name) {
    if (!stores.has(name)) stores.set(name, new Map())
    return stores.get(name)
}

/**
 * @param {string} name - Rate limiter name (e.g., 'telegram', 'ai-chat')
 * @param {object} opts - { windowMs, maxRequests }
 * @param {string} key - Unique key (IP, userId, chatId)
 * @returns {{ allowed: boolean, remaining: number, resetAt: number }}
 */
export function checkRateLimit(name, { windowMs = 60000, maxRequests = 10 }, key) {
    const store = getStore(name)
    const now = Date.now()
    const record = store.get(key)

    // Clean expired entries periodically
    if (store.size > 10000) {
        for (const [k, v] of store) {
            if (now - v.windowStart > windowMs) store.delete(k)
        }
    }

    if (!record || now - record.windowStart > windowMs) {
        store.set(key, { windowStart: now, count: 1 })
        return { allowed: true, remaining: maxRequests - 1, resetAt: now + windowMs }
    }

    record.count++
    const remaining = Math.max(0, maxRequests - record.count)
    const resetAt = record.windowStart + windowMs

    if (record.count > maxRequests) {
        return { allowed: false, remaining: 0, resetAt }
    }

    return { allowed: true, remaining, resetAt }
}

/**
 * Express/Vercel middleware-style helper
 * Returns true if rate limited (caller should return early)
 */
export function applyRateLimit(req, res, name, opts) {
    const key = req.headers['x-real-ip']
        || req.headers['x-forwarded-for']?.split(',').pop()?.trim()
        || req.socket?.remoteAddress
        || 'unknown'

    const result = checkRateLimit(name, opts, key)

    res.setHeader('X-RateLimit-Limit', opts.maxRequests)
    res.setHeader('X-RateLimit-Remaining', result.remaining)
    res.setHeader('X-RateLimit-Reset', Math.ceil(result.resetAt / 1000))

    if (!result.allowed) {
        const retryAfter = Math.ceil((result.resetAt - Date.now()) / 1000)
        res.setHeader('Retry-After', retryAfter)
        res.status(429).json({ error: 'Too many requests', retryAfter })
        return true // rate limited
    }

    return false // not limited
}
