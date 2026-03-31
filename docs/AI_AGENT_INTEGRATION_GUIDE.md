# 🤖 AI Agent Integration Guide - GastroMap

**Date:** 2026-03-31  
**Status:** ✅ **ALREADY INTEGRATED**  
**Current Provider:** OpenRouter

---

## 📋 OVERVIEW

У тебя **УЖЕ есть** ИИ-агент в приложении! 

**GastroGuide** — твой ИИ-помощник, который:
- ✅ Отвечает на вопросы о ресторанах
- ✅ Даёт персональные рекомендации
- ✅ Работает через OpenRouter API
- ✅ Поддерживает 300+ моделей (включая бесплатные)
- ✅ Имеет streaming ответов
- ✅ Запоминает контекст диалога

---

## 🎯 ЧТО УЖЕ РАБОТАЕТ

### 1. GastroGuide Chat

**Где:** `src/hooks/useAIChat.js`

**Функции:**
```javascript
import { useAIChat } from '@/hooks/useAIChat'

const {
    messages,      // История сообщений
    isTyping,      // Индикатор печати
    isStreaming,   // Streaming режим
    sendMessage,   // Отправить сообщение
    clearHistory,  // Очистить историю
} = useAIChat()
```

**Как работает:**
1. Пользователь задаёт вопрос
2. Запрос отправляется в OpenRouter API
3. Ответ стримится в реальном времени
4. Контекст сохраняется (8 последних сообщений)

### 2. OpenRouter Integration

**Где:** `src/shared/api/ai.api.js`

**Доступные функции:**
```javascript
import { analyzeQueryStream, analyzeQuery } from '@/shared/api/ai.api'

// Streaming ответ
analyzeQueryStream('Best Italian restaurants', context, onChunk)

// Обычный запрос
analyzeQuery('Find romantic places', context)
```

**Модели:**
- ✅ **DeepSeek V3.2** (бесплатно, 128K контекст)
- ✅ **Step 3.5 Flash** (бесплатно, 256K контекст)
- ✅ **Nemotron 3 Super** (бесплатно, 1M контекст)
- ✅ **Qwen3 Coder** (бесплатно, 262K контекст)
- ✅ **Claude 3.7** (платно, $3/1M tokens)
- ✅ **GPT-5.4** (платно, $2.5/1M tokens)

---

## 🔧 КАК ЭТО РАБОТАЕТ

### Архитектура

```
┌─────────────┐
│   User UI   │
│ GastroGuide │
└──────┬──────┘
       │
       ↓
┌─────────────────┐
│  useAIChat Hook │
│  (React State)  │
└──────┬──────────┘
       │
       ↓
┌─────────────────┐
│   AI API Layer  │
│  analyzeQuery   │
└──────┬──────────┘
       │
       ↓
┌─────────────────┐
│  OpenRouter API │
│  (300+ models)  │
└──────┬──────────┘
       │
       ↓
┌─────────────────┐
│  LLM Models     │
│  DeepSeek, etc. │
└─────────────────┘
```

### Flow

```javascript
// 1. User sends message
sendMessage('Find cozy Italian places')

// 2. Hook adds to history
addMessage({ role: 'user', content: '...' })

// 3. Build context
const context = {
    preferences: userPrefs,
    location: currentCity,
    history: last8Messages
}

// 4. Call API with streaming
analyzeQueryStream(query, context, (chunk) => {
    updateLastMessage(chunk)
})

// 5. Stream response
// "Here" → " are" → " some" → " cozy" → ...
```

---

## 💡 ВАРИАНТЫ ИНТЕГРАЦИИ

### ✅ Вариант 1: OpenRouter (УЖЕ РАБОТАЕТ)

**Плюсы:**
- ✅ 300+ моделей в одном API
- ✅ Бесплатные модели доступны
- ✅ Streaming из коробки
- ✅ Простая интеграция (OpenAI-compatible)
- ✅ Один ключ для всех моделей

**Минусы:**
- ⚠️ Бесплатные модели могут быть медленными
- ⚠️ Лимиты на бесплатные запросы

**Цена:**
- Бесплатные модели: $0
- Premium модели: $1-15 / 1M tokens

**Как использовать:**
```javascript
// Уже настроено! Просто используй useAIChat
const { sendMessage } = useAIChat()
sendMessage('Recommend a date night restaurant')
```

---

### 🆕 Вариант 2: Google AI Studio (Gemini)

**Плюсы:**
- ✅ Бесплатный tier (60 запросов/мин)
- ✅ Очень быстрый
- ✅ Мультимодальный (текст + изображения)
- ✅ Хорош для диалогов

**Минусы:**
- ⚠️ Нужен отдельный API ключ
- ⚠️ Меньше моделей чем у OpenRouter

**Цена:**
- Free: 60 requests/min, 1500/day
- Paid: $0.000125-0.0005 / 1K tokens

**Как интегрировать:**

1. **Получи ключ:** https://aistudio.google.com/apikey

2. **Добавь в .env:**
```bash
VITE_GOOGLE_AI_KEY=your_key_here
VITE_GOOGLE_AI_MODEL=gemini-2.0-flash
```

3. **Создай API файл:**
```javascript
// src/shared/api/google.ai.js
import { GoogleGenerativeAI } from '@google/generative-ai'

const genAI = new GoogleGenerativeAI(import.meta.env.VITE_GOOGLE_AI_KEY)

export async function queryGoogleAI(prompt, context = {}) {
    const model = genAI.getGenerativeModel({ 
        model: 'gemini-2.0-flash' 
    })
    
    const systemPrompt = `You are GastroGuide, a helpful restaurant assistant.
Current location: ${context.city || 'Krakow'}
User preferences: ${JSON.stringify(context.preferences || {})}`

    const result = await model.generateContent([
        systemPrompt,
        prompt
    ])
    
    return result.response.text()
}

export async function queryGoogleAIStream(prompt, context, onChunk) {
    const model = genAI.getGenerativeModel({ 
        model: 'gemini-2.0-flash' 
    })
    
    const result = await model.generateContentStream(prompt)
    
    for await (const chunk of result.stream) {
        onChunk(chunk.text())
    }
}
```

4. **Обнови useAIChat:**
```javascript
// Добавить переключатель
const provider = config.ai.provider || 'openrouter'

if (provider === 'google') {
    response = await queryGoogleAIStream(query, context, onChunk)
} else {
    response = await analyzeQueryStream(query, context, onChunk)
}
```

---

### 🆕 Вариант 3: Hugging Face Inference API

**Плюсы:**
- ✅ Бесплатный tier (30k tokens/мес)
- ✅ Огромный выбор open-source моделей
- ✅ Хорош для специфических задач

**Минусы:**
- ⚠️ Медленнее чем коммерческие API
- ⚠️ Rate limits на бесплатном тарифе

**Цена:**
- Free: 30k tokens/month
- Pro: $9/month (1M tokens)

**Популярные модели:**
- `mistralai/Mixtral-8x7B-Instruct`
- `meta-llama/Llama-3-70b-instruct`
- `google/gemma-7b-it`

**Как интегрировать:**

```javascript
// src/shared/api/huggingface.api.js
const HF_API = 'https://api-inference.huggingface.co/models'
const HF_TOKEN = import.meta.env.VITE_HF_TOKEN

export async function queryHF(prompt, model = 'mistralai/Mixtral-8x7B-Instruct') {
    const response = await fetch(`${HF_API}/${model}`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${HF_TOKEN}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            inputs: prompt,
            parameters: {
                max_new_tokens: 500,
                temperature: 0.7
            }
        })
    })
    
    const result = await response.json()
    return result[0]?.generated_text || ''
}
```

---

### 🆕 Вариант 4: Ollama (Local LLM)

**Плюсы:**
- ✅ Полностью бесплатно
- ✅ Работает офлайн
- ✅ Полный контроль
- ✅ Нет лимитов

**Минусы:**
- ⚠️ Нужен свой сервер
- ⚠️ Медленнее облачных API
- ⚠️ Требует ресурсы (GPU рекомендуется)

**Популярные модели:**
- `llama3.1:8b` (4GB RAM)
- `mistral:7b` (4GB RAM)
- `mixtral:8x7b` (26GB RAM)
- `gemma:7b` (4GB RAM)

**Как интегрировать:**

1. **Установи Ollama:**
```bash
curl -fsSL https://ollama.com/install.sh | sh
ollama pull llama3.1:8b
```

2. **Запусти сервер:**
```bash
ollama serve
# http://localhost:11434
```

3. **API интеграция:**
```javascript
// src/shared/api/ollama.api.js
const OLLAMA_URL = 'http://localhost:11434/api/generate'

export async function queryOllama(prompt, model = 'llama3.1:8b') {
    const response = await fetch(OLLAMA_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            model,
            prompt,
            stream: false
        })
    })
    
    const result = await response.json()
    return result.response
}

export async function queryOllamaStream(prompt, model, onChunk) {
    const response = await fetch(OLLAMA_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            model,
            prompt,
            stream: true
        })
    })
    
    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    
    while (true) {
        const { done, value } = await reader.read()
        if (done) break
        
        const chunk = decoder.decode(value)
        const lines = chunk.split('\n')
        
        for (const line of lines) {
            if (line.trim()) {
                const data = JSON.parse(line)
                if (data.response) {
                    onChunk(data.response)
                }
            }
        }
    }
}
```

---

### 🆕 Вариант 5: Vercel AI SDK

**Плюсы:**
- ✅ Unified API для всех провайдеров
- ✅ Streaming из коробки
- ✅ React hooks готовы
- ✅ Edge functions поддержка

**Минусы:**
- ⚠️ Extra dependency
- ⚠️ Нужно учить новый API

**Цена:**
- SDK: бесплатно
- Провайдеры: по их тарифам

**Как интегрировать:**

```bash
npm install ai @ai-sdk/react
```

```javascript
// src/hooks/useAI.js
import { useChat } from 'ai/react'

export function useGastroAI() {
    return useChat({
        api: '/api/ai/chat',
        initialMessages: [],
        body: {
            model: 'openrouter:deepseek/deepseek-chat-v3-0324:free'
        }
    })
}
```

```typescript
// pages/api/ai/chat.ts
import { streamText } from 'ai'
import { createOpenRouter } from '@openrouter/ai-sdk-provider'

export async function POST(req: Request) {
    const { messages } = await req.json()
    
    const openrouter = createOpenRouter({
        apiKey: process.env.OPENROUTER_API_KEY
    })
    
    const result = streamText({
        model: openrouter('deepseek/deepseek-chat-v3-0324:free'),
        messages
    })
    
    return result.toDataStreamResponse()
}
```

---

## 🔄 ПЕРЕКЛЮЧЕНИЕ МЕЖДУ ПРОВАЙДЕРАМИ

### Config-based switching

```javascript
// src/shared/config/env.js
export const config = {
    ai: {
        provider: 'openrouter', // or 'google', 'huggingface', 'ollama'
        openRouter: { /* ... */ },
        google: { /* ... */ },
        // ...
    }
}
```

### Provider factory

```javascript
// src/shared/api/ai.factory.js
import { analyzeQueryStream as openrouter } from './ai.api'
import { queryGoogleAIStream as google } from './google.ai'
import { queryOllamaStream as ollama } from './ollama.api'

const providers = {
    openrouter,
    google,
    huggingface,
    ollama
}

export function getProvider(name = 'openrouter') {
    return providers[name] || providers.openrouter
}

// Usage
const ai = getProvider(config.ai.provider)
ai(query, context, onChunk)
```

---

## 🎯 РЕКОМЕНДАЦИИ

### Для GastroMap (твой случай):

**✅ Используй OpenRouter (уже работает!)**

**Почему:**
1. ✅ Уже интегрирован
2. ✅ Бесплатные модели доступны
3. ✅ 300+ моделей на выбор
4. ✅ Простое переключение между моделями
5. ✅ Streaming работает

**Оптимизация:**
```javascript
// Выбери быструю бесплатную модель
VITE_AI_MODEL=step3ai/step-3.5-flash:free

// Для сложных задач используй premium
VITE_AI_MODEL_PREMIUM=anthropic/claude-3.7-sonnet
```

### Если хочешь альтернативу:

**🥈 Google AI Studio** — для скорости
- Быстрее чем OpenRouter
- Бесплатный лимит щедрый
- Хорош для диалогов

**🥉 Ollama Local** — для офлайн/privacy
- Полностью бесплатно
- Нет лимитов
- Нужен свой сервер

---

## 📊 СРАВНЕНИЕ ТАРИФОВ

| Провайдер | Бесплатно | Premium | Speed | Качество |
|-----------|-----------|---------|-------|----------|
| **OpenRouter** | 300+ моделей | $1-15/1M | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ |
| **Google AI** | 60/min, 1500/day | $0.0005/1K | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ |
| **HuggingFace** | 30k tokens/mes | $9/mes (1M) | ⭐⭐⭐ | ⭐⭐⭐⭐ |
| **Ollama** | ∞ (свой сервер) | $0 | ⭐⭐ | ⭐⭐⭐⭐ |
| **Vercel AI** | SDK бесплатно | по провайдеру | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ |

---

## 🚀 СЛЕДУЮЩИЕ ШАГИ

### Option A: Оптимизировать текущий (рекомендую)

1. **Выбери быструю модель:**
```bash
# Edit .env
VITE_AI_MODEL=step3ai/step-3.5-flash:free
```

2. **Добавь fallback:**
```javascript
// Если DeepSeek не отвечает, переключись на Step
try {
    await analyzeQuery(query, { model: 'deepseek' })
} catch {
    await analyzeQuery(query, { model: 'step-3.5-flash' })
}
```

3. **Кэшируй частые запросы:**
```javascript
const cache = new Map()

export async function cachedQuery(query, context) {
    const key = `${query}:${JSON.stringify(context)}`
    if (cache.has(key)) return cache.get(key)
    
    const result = await analyzeQuery(query, context)
    cache.set(key, result)
    return result
}
```

### Option B: Добавить Google AI как backup

1. Получи ключ: https://aistudio.google.com/apikey
2. Скажи мне — я добавлю интеграцию за 5 минут!

### Option C: Локальный Ollama для тестов

1. Установи: `curl -fsSL https://ollama.com/install.sh | sh`
2. Скажи мне — я настрою локальный API!

---

## 📚 FILES REFERENCE

### Current Implementation
```
src/hooks/useAIChat.js              # Main hook
src/shared/api/ai.api.js            # OpenRouter API
src/features/shared/components/GastroAIChat.jsx  # UI
```

### New Files (если добавишь)
```
src/shared/api/google.ai.js         # Google AI
src/shared/api/huggingface.api.js   # HuggingFace
src/shared/api/ollama.api.js        # Ollama Local
src/shared/api/ai.factory.js        # Provider factory
```

---

## 🆘 TROUBLESHOOTING

### "Model not found"
```bash
# Check available models
curl https://openrouter.ai/api/v1/models \
  -H "Authorization: Bearer $OPENROUTER_API_KEY"
```

### "Rate limit exceeded"
```javascript
// Switch to another free model
VITE_AI_MODEL=nemotron/nemotron-3-405b-instruct:free
```

### "Too slow"
```javascript
// Use faster model
VITE_AI_MODEL=step3ai/step-3.5-flash:free
// Speed: ~50 tokens/sec vs DeepSeek ~20 tokens/sec
```

### "API key invalid"
```bash
# Regenerate key
# OpenRouter → Settings → API Keys → Create New
```

---

## 💬 FAQ

**Q: Можно ли использовать несколько провайдеров одновременно?**  
A: Да! Добавь factory pattern и переключайся по настроению.

**Q: Какой провайдер самый дешёвый?**  
A: Ollama (бесплатно, но нужен свой сервер). Из облачных — Google AI.

**Q: Можно ли кэшировать ответы?**  
A: Да! Используй Map/Redis для кэширования частых запросов.

**Q: Как сделать своего агента умнее?**  
A: Добавь RAG (Retrieval Augmented Generation) с твоей базой ресторанов.

**Q: Работает ли офлайн?**  
A: Только с Ollama локально. Облачные API требуют интернет.

---

**Current Status:** ✅ **OpenRouter Integrated & Working**  
**Recommended:** Keep OpenRouter, optimize model choice  
**Alternative:** Add Google AI as backup (5 min setup)

**Need help switching?** Just ask! 🚀
