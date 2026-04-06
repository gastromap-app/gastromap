/**
 * Auto-Translation API
 * 
 * Automatically translates location data to multiple languages
 * Uses OpenRouter AI models for translation
 * 
 * Supported languages:
 * - en: English
 * - pl: Polish
 * - uk: Ukrainian
 * - ru: Russian
 */

import { analyzeQuery } from './ai.api'
import { supabase } from './client'
import { config } from '@/shared/config/env'
import { useAppConfigStore } from '@/shared/store/useAppConfigStore'

// Supported languages
export const SUPPORTED_LANGUAGES = {
    en: { name: 'English', label: 'EN' },
    pl: { name: 'Polish', label: 'PL' },
    uk: { name: 'Ukrainian', label: 'UK' },
    ru: { name: 'Russian', label: 'RU' }
}

// Fields to translate
export const TRANSLATABLE_FIELDS = [
    'title',
    'description',
    'address',
    'insider_tip',
    'what_to_try',
    'ai_context'
]

/**
 * Translate text to target language with timeout protection
 */
export async function translateText(text, targetLang, sourceLang = 'auto') {
    if (!text || typeof text !== 'string') {
        return text
    }

    const sourceLanguage = sourceLang || 'auto'
    const targetLanguage = SUPPORTED_LANGUAGES[targetLang]?.name || targetLang

    const prompt = `Translate the following text to ${targetLanguage}.
Preserve formatting, proper nouns, and brand names.
Return ONLY the translation, no explanations.

Text to translate:
"${text}"`

    try {
        // Add timeout to prevent hanging translation requests
        const timeoutPromise = new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Translation request timeout')), 30000)
        )

        const response = await Promise.race([
            analyzeQuery(prompt, {
                systemPrompt: 'You are a professional translator. Translate accurately while preserving meaning and tone.',
                temperature: 0.3,
                maxTokens: 1000
            }),
            timeoutPromise
        ])

        return response?.content?.trim() || text
    } catch (error) {
        console.error('[Translation API] Error translating text:', error.message)
        return text
    }
}

/**
 * Translate array of strings
 */
export async function translateArray(texts, targetLang) {
    if (!Array.isArray(texts)) {
        return texts
    }
    
    const translated = await Promise.all(
        texts.map(text => translateText(text, targetLang))
    )
    
    return translated
}

/**
 * Translate all translatable fields of a location
 */
export async function translateLocation(locationData, targetLang, sourceLang = 'auto') {
    if (!locationData) {
        return locationData
    }
    
    const translated = { ...locationData }
    
    for (const field of TRANSLATABLE_FIELDS) {
        if (locationData[field]) {
            if (Array.isArray(locationData[field])) {
                translated[field] = await translateArray(locationData[field], targetLang)
            } else {
                translated[field] = await translateText(locationData[field], targetLang, sourceLang)
            }
        }
    }
    
    return translated
}

/**
 * Auto-translate location to all supported languages
 * Uses sequential translation with delays to prevent API overload
 */
export async function autoTranslateAll(locationData, sourceLang = 'auto') {
    if (!locationData) {
        return locationData
    }

    const result = {
        ...locationData,
        translations: {}
    }

    const translations = {}
    const TRANSLATION_DELAY_MS = 500 // Delay between language translations

    for (const [langCode, langInfo] of Object.entries(SUPPORTED_LANGUAGES)) {
        console.log(`[Translation API] Translating to ${langInfo.name}...`)

        try {
            const translated = await translateLocation(locationData, langCode, sourceLang)
            translations[langCode] = {
                title: translated.title,
                description: translated.description,
                address: translated.address,
                insider_tip: translated.insider_tip,
                what_to_try: translated.what_to_try,
                ai_context: translated.ai_context,
                translated_at: new Date().toISOString()
            }

            // Add delay between language translations to prevent API overload
            if (langCode !== 'ru') { // No delay after last language
                await new Promise(resolve => setTimeout(resolve, TRANSLATION_DELAY_MS))
            }
        } catch (error) {
            console.error(`[Translation API] Failed to translate to ${langCode}:`, error)
            translations[langCode] = {
                title: locationData.title,
                description: locationData.description,
                error: error.message
            }
        }
    }

    result.translations = translations
    return result
}

/**
 * Save translations to database with exponential backoff retry logic
 */
export async function saveTranslations(locationId, translations, retries = 2) {
    const MAX_RETRIES = retries
    let lastError = null

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
        try {
            const { error } = await supabase
                .from('location_translations')
                .upsert({
                    location_id: locationId,
                    translations: translations,
                    updated_at: new Date().toISOString()
                }, {
                    onConflict: 'location_id'
                })

            if (error) {
                console.error(`[Translation API] Error saving translations (attempt ${attempt + 1}):`, error)
                lastError = error

                // Only retry on specific lock-related errors
                if (error.message?.includes('lock') || error.code === 'PGRST301') {
                    if (attempt < MAX_RETRIES) {
                        // Exponential backoff: 500ms, 1000ms, 2000ms
                        const delayMs = 500 * Math.pow(2, attempt)
                        console.log(`[Translation API] Retrying in ${delayMs}ms...`)
                        await new Promise(resolve => setTimeout(resolve, delayMs))
                        continue
                    }
                } else {
                    // Don't retry for non-lock errors
                    throw error
                }
            } else {
                console.log('[Translation API] Translations saved successfully')
                return
            }
        } catch (error) {
            lastError = error
            console.error(`[Translation API] Exception saving translations (attempt ${attempt + 1}):`, error)

            if (error.message?.includes('lock') && attempt < MAX_RETRIES) {
                const delayMs = 500 * Math.pow(2, attempt)
                console.log(`[Translation API] Retrying in ${delayMs}ms...`)
                await new Promise(resolve => setTimeout(resolve, delayMs))
            }
        }
    }

    // After all retries exhausted, log but don't throw - translations are non-blocking
    console.error('[Translation API] Failed to save translations after retries:', lastError)
    // Non-blocking failure - don't throw to avoid blocking location creation
}

/**
 * Get translations for a location
 */
export async function getTranslations(locationId) {
    try {
        const { data, error } = await supabase
            .from('location_translations')
            .select('translations')
            .eq('location_id', locationId)
            .single()
        
        if (error) {
            if (error.code === 'PGRST116') {
                return null
            }
            throw error
        }
        
        return data?.translations || null
    } catch (error) {
        console.error('[Translation API] Error getting translations:', error)
        return null
    }
}

/**
 * Get location with translations for specific language
 */
export async function getLocationWithTranslation(locationId, lang) {
    try {
        const { data: location, error: locError } = await supabase
            .from('locations')
            .select('*')
            .eq('id', locationId)
            .single()
        
        if (locError) throw locError
        if (!location) return null
        
        const translations = await getTranslations(locationId)
        
        if (translations && translations[lang]) {
            const translated = {
                ...location,
                ...translations[lang]
            }
            return translated
        }
        
        return location
    } catch (error) {
        console.error('[Translation API] Error getting location with translation:', error)
        return null
    }
}

/**
 * Batch translate multiple locations
 */
export async function batchTranslate(locations, targetLang) {
    if (!Array.isArray(locations)) {
        return locations
    }
    
    console.log(`[Translation API] Batch translating ${locations.length} locations to ${targetLang}...`)
    
    const translated = await Promise.all(
        locations.map(loc => translateLocation(loc, targetLang))
    )
    
    return translated
}

/**
 * Detect language of text (heuristic with Unicode ranges)
 * @param {string} text - Text to analyze
 * @returns {string} Detected language code
 */
export function detectLanguage(text) {
    if (!text || typeof text !== 'string') return 'en'
    
    const lowerText = text.toLowerCase()
    
    // Polish characters
    const polish = /[ąćęłńóśźż]/
    if (polish.test(lowerText)) return 'pl'
    
    // Ukrainian unique characters: і, ї, є, ґ (Unicode: U+0456, U+0457, U+0454, U+0491)
    const ukrainianUnique = /[ієїґ]/
    if (ukrainianUnique.test(lowerText)) return 'uk'
    
    // Russian: Cyrillic without Ukrainian unique chars
    const cyrillic = /[а-яё]/
    if (cyrillic.test(lowerText)) return 'ru'
    
    return 'en'
}

/**
 * Enable auto-translation on location create/update
 */
export async function processLocationTranslations(locationData, autoTranslate = true) {
    const appCfg = useAppConfigStore.getState()
    const isAIReady = config.ai.isOpenRouterConfigured || appCfg.aiApiKey
    
    if (!autoTranslate || !isAIReady) {
        return locationData
    }
    
    console.log('[Translation API] Processing auto-translations...')
    
    try {
        const result = await autoTranslateAll(locationData)
        return result
    } catch (error) {
        console.error('[Translation API] Auto-translation failed:', error)
        return locationData
    }
}

export default {
    translateText,
    translateArray,
    translateLocation,
    autoTranslateAll,
    saveTranslations,
    getTranslations,
    getLocationWithTranslation,
    batchTranslate,
    detectLanguage,
    processLocationTranslations,
    SUPPORTED_LANGUAGES,
    TRANSLATABLE_FIELDS
}
