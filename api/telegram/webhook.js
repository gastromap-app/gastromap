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
    res.setHeader('Access-Control-Allow-Origin', '*')
    if (req.method === 'OPTIONS') return res.status(200).end()
    if (req.method !== 'POST') return res.status(200).end()

    const token = process.env.TELEGRAM_BOT_TOKEN
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

    console.log(`[telegram/webhook] Message from ${chatId}: ${text}`)

    // ── /start или /help ─────────────────────────────────────────────────────
    if (text.startsWith('/start') || text.startsWith('/help')) {
        await sendMessage(token, chatId, [
            `👋 Привет, <b>${username}</b>! Я GastroMap Location Bot.`,
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
            `🔍 Ищу данные о <b>${parsed.value.slice(0, 60)}</b>...\n\nЭто займёт ~30 секунд. Я пришлю результат как только создам карточку.`
        )

        // Запускаем pipeline асинхронно — НЕ await
        const processUrl = process.env.VERCEL_URL
            ? `https://${process.env.VERCEL_URL}/api/telegram/process`
            : 'https://gastromap-five.vercel.app/api/telegram/process'

        fetch(processUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                chatId,
                query: parsed,
                username,
            }),
        }).catch(err => console.error('[telegram/webhook] Process fetch failed:', err.message))

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
