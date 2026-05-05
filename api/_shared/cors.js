const ALLOWED_ORIGINS = [
    'https://gastromap.app',
    'https://www.gastromap.app',
    /\.vercel\.app$/,
    'http://localhost:5173',
    'http://localhost:3000',
]

export function setCorsHeaders(req, res) {
    const origin = req.headers?.origin || ''
    const isAllowed = ALLOWED_ORIGINS.some(o =>
        o instanceof RegExp ? o.test(origin) : o === origin
    )
    res.setHeader('Access-Control-Allow-Origin', isAllowed ? origin : '')
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
}
