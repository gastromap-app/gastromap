/**
 * Vercel Serverless — Telegram Webhook
 * 
 * Принимает обновления от Telegram, сразу отвечает 200 OK,
 * и запускает pipeline обработки локации асинхронно.
 * 
 * Команды:
 *   /add <название>, <адрес>   — добавить локацию по названию и адресу
 *   /add <Google Maps URL>     — добавить по ссылке Google Maps
 *   /help                      — справка
 */

import { setCorsHeaders } from '../_shared/cors.js'
import { applyRateLimit, checkRateLimit } from '../_shared/rate-limit.js'

// Polyfill AbortSignal.timeout for older Node.js
if (!AbortSignal.timeout) {
    AbortSignal.timeout = (ms) => {
        const controller = new AbortController()
        setTimeout(() => controller.abort(new DOMException('Timeout', 'TimeoutError')), ms)
        return controller.signal
    }
}

function escapeHtml(str) {
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
}

const TELEGRAM_API = 'https://api.telegram.org'

// Отправить сообщение пользователю
async function sendMessage(token, chatId, text, options = {}) {
    await fetch(`${TELEGRAM_API}/bot${token}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            chat_id: chatId,
            text,
            parse_mode: 'HTML',
            ...options,
        }),
    })
}

// Распарсить команду /add
function parseAddCommand(text) {
    // Убираем /add или /add@BotName
    const cleaned = text.replace(/^\/add(@\S+)?\s*/i, '').trim()
    if (!cleaned) return null

    // Проверяем — это Google Maps URL?
    if (cleaned.startsWith('http') && (cleaned.includes('maps.google') || cleaned.includes('goo.gl') || cleaned.includes('maps.app.goo'))) {
        return { type: 'url', value: cleaned }
    }

    // Иначе — текстовый запрос "Название, Адрес"
    return { type: 'text', value: cleaned }
}

export default async function handler(req, res) {
    // CORS
    setCorsHeaders(req, res)
    if (req.method === 'OPTIONS') return res.status(200).end()
    if (req.method !== 'POST') return res.status(200).end()

    if (applyRateLimit(req, res, 'telegram-webhook', { maxRequests: 30, windowMs: 60000 })) return

    // C1: Telegram secret token verification
    const secretToken = process.env.TELEGRAM_SECRET_TOKEN
    if (!secretToken || req.headers['x-telegram-bot-api-secret-token'] !== secretToken) {
        return res.status(401).json({ error: 'Unauthorized' })
    }

    const token = process.env.GASTROMAP_LOCATION_BOT_TOKEN || process.env.TELEGRAM_BOT_TOKEN
    if (!token) {
        console.error('[telegram/webhook] TELEGRAM_BOT_TOKEN not set')
        return res.status(200).json({ ok: true }) // всегда 200 для Telegram
    }

    const update = req.body
    const message = update?.message || update?.edited_message
    if (!message?.text) return res.status(200).json({ ok: true })

    const chatId = message.chat.id
    const text = message.text.trim()
    const username = message.from?.first_name || 'друг'

    // Per-chat rate limiting
    const chatRl = checkRateLimit('telegram-per-chat', { maxRequests: 5, windowMs: 60000 }, String(chatId))
    if (!chatRl.allowed) {
        await sendMessage(token, chatId, '⏳ Too many requests. Please wait a minute.')
        return res.status(200).json({ ok: true })
    }

    console.log(`[telegram/webhook] Message from ${chatId}: ${text}`)

    // ── /start или /help ─────────────────────────────────────────────────────
    if (text.startsWith('/start') || text.startsWith('/help')) {
        await sendMessage(token, chatId, [
            `👋 Привет, <b>${escapeHtml(username)}</b>! Я GastroMap Location Bot.`,
            '',
            'Я умею добавлять новые локации в GastroMap — сам нахожу всю информацию через Google Places, Apify и веб-поиск.',
            '',
            '<b>Как использовать:</b>',
            '/add Название, Адрес, Город',
            '/add Hamsa, ul. Floriańska 14, Kraków',
            '/add https://maps.google.com/...',
            '',
            '<b>Что я нахожу:</b>',
            '📍 Адрес, координаты, телефон, сайт',
            '🕐 Часы работы, ценовой диапазон',
            '📸 Фотографии, рейтинг',
            '🍽 Кухня, теги, атмосфера',
            '📝 Описание (AI-генерация)',
        ].join('\n'))
        return res.status(200).json({ ok: true })
    }

    // ── /add команда ─────────────────────────────────────────────────────────
    if (text.startsWith('/add')) {
        const parsed = parseAddCommand(text)

        if (!parsed) {
            await sendMessage(token, chatId,
                '❌ Укажи название и адрес локации:\n\n<code>/add Hamsa, ul. Floriańska 14, Kraków</code>'
            )
            return res.status(200).json({ ok: true })
        }

        // Сразу отвечаем пользователю — не заставляем ждать
        await sendMessage(token, chatId,
            `🔍 Ищу данные о <b>${escapeHtml(parsed.value.slice(0, 60))}</b>...\n\nЭто займёт ~30 секунд. Я пришлю результат как только создам карточку.`
        )

        // Запускаем pipeline — Vercel serverless timeout 60s должно хватить
        // Важно: НЕ fire-and-forget, иначе Vercel может убить процесс
        const processUrl = process.env.VERCEL_URL
            ? `https://${process.env.VERCEL_URL}/api/telegram/process`
            : 'https://gastromap-five.vercel.app/api/telegram/process'

        try {
            const processRes = await fetch(processUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    chatId,
                    query: parsed,
                    username,
                }),
                signal: AbortSignal.timeout(55000), // 55s timeout (buffer before 60s limit)
            })

            if (!processRes.ok) {
                console.error(`[telegram/webhook] Process failed: ${processRes.status}`)
                await sendMessage(token, chatId,
                    `⚠️ Не удалось создать локацию. Попробуй еще раз позже.`
                )
            }
        } catch (err) {
            console.error('[telegram/webhook] Process timeout/error:', err.message)
            await sendMessage(token, chatId,
                `⏳ Поиск занял слишком много времени. Попробуй еще раз или уточни запрос.`
            )
        }

        return res.status(200).json({ ok: true })
    }

    // ── Неизвестная команда ───────────────────────────────────────────────────
    if (text.startsWith('/')) {
        await sendMessage(token, chatId,
            '❓ Неизвестная команда. Напиши /help чтобы посмотреть что я умею.'
        )
    }

    return res.status(200).json({ ok: true })
}
