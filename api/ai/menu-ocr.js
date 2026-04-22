/**
 * /api/ai/menu-ocr.js
 * Menu OCR via Nemotron Nano 2 VL (multimodal, free on OpenRouter)
 *
 * POST body:
 *   { image_url: string }  — URL публичного изображения меню
 *   OR
 *   { image_base64: string, mime_type: string }  — base64 данные
 *
 * Returns:
 *   { dishes: [{ name, description, price, category }], raw_text: string }
 */

const VISION_MODELS = [
  'nvidia/nemotron-nano-2-vl:free',    // ✅ primary — 12B multimodal, OCR
  'google/gemma-3-27b-it:free',         // ✅ fallback — multimodal
  'google/gemma-4-31b-it:free',         // ✅ fallback 2
]

const PROMPT = `You are a menu parser for a restaurant discovery app.

Analyze this menu image and extract ALL dishes/items you can see.

Return ONLY a valid JSON object (no markdown, no comments):
{
  "dishes": [
    {
      "name": "Dish name",
      "description": "Brief description if visible",
      "price": "price as string e.g. '12.50' or '12,50 zł' or null if not visible",
      "category": "category/section name e.g. 'Mains', 'Drinks', 'Desserts', or null"
    }
  ],
  "raw_text": "all text you can see in the image, line by line"
}

Rules:
- Extract every single item with a price or name you can see
- Keep original language for dish names
- If price is not visible, set price to null
- If no menu is visible, return { "dishes": [], "raw_text": "No menu visible" }`

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { image_url, image_base64, mime_type = 'image/jpeg' } = req.body || {}

  if (!image_url && !image_base64) {
    return res.status(400).json({ error: 'image_url or image_base64 required' })
  }

  const apiKey = process.env.OPENROUTER_API_KEY
  if (!apiKey?.trim()) {
    return res.status(500).json({ error: 'OPENROUTER_API_KEY not configured' })
  }

  // Build image content block
  const imageContent = image_url
    ? { type: 'image_url', image_url: { url: image_url } }
    : { type: 'image_url', image_url: { url: `data:${mime_type};base64,${image_base64}` } }

  const messages = [
    {
      role: 'user',
      content: [
        imageContent,
        { type: 'text', text: PROMPT },
      ],
    },
  ]

  let lastError = null

  for (const model of VISION_MODELS) {
    try {
      const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://gastromap.app',
          'X-Title': 'GastroMap Menu OCR',
        },
        body: JSON.stringify({
          model,
          messages,
          max_tokens: 2000,
          temperature: 0.1,
        }),
        signal: AbortSignal.timeout(30000),
      })

      if (response.status === 429) {
        lastError = `429 on ${model}`
        console.warn(`[menu-ocr] 429 on ${model}, trying next...`)
        await new Promise(r => setTimeout(r, 800))
        continue
      }

      if (!response.ok) {
        lastError = `${response.status} on ${model}`
        console.warn(`[menu-ocr] ${response.status} on ${model}`)
        continue
      }

      const data = await response.json()
      let content = data.choices?.[0]?.message?.content?.trim() || ''

      // Strip markdown fences
      const fenceMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/)
      if (fenceMatch) content = fenceMatch[1].trim()

      let parsed
      try {
        parsed = JSON.parse(content)
      } catch (e) {
        // Try to extract JSON from content
        const jsonMatch = content.match(/\{[\s\S]*\}/)
        if (jsonMatch) {
          try { parsed = JSON.parse(jsonMatch[0]) } catch { /* ignore */ }
        }
      }

      if (!parsed) {
        lastError = `JSON parse failed on ${model}`
        console.warn(`[menu-ocr] Could not parse JSON from ${model}`)
        continue
      }

      console.log(`[menu-ocr] success model=${model} dishes=${parsed.dishes?.length ?? 0}`)

      return res.status(200).json({
        dishes: parsed.dishes || [],
        raw_text: parsed.raw_text || '',
        model_used: model,
        dish_count: (parsed.dishes || []).length,
      })

    } catch (err) {
      lastError = err.message
      console.warn(`[menu-ocr] Error on ${model}:`, err.message)
      await new Promise(r => setTimeout(r, 500))
    }
  }

  return res.status(503).json({
    error: 'All vision models failed',
    last_error: lastError,
    models_tried: VISION_MODELS,
  })
}
