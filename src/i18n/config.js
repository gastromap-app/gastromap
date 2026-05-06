import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
// NOTE: LanguageDetector disabled — English-only mode (Phase 1).
// Translations for ru/pl/ua are kept in resources for future re-enable.
// import LanguageDetector from 'i18next-browser-languagedetector'

// English translations
import enTranslation from '../locales/en/translation.json'

// Russian translations
import ruTranslation from '../locales/ru/translation.json'

// Polish translations
import plTranslation from '../locales/pl/translation.json'

// Ukrainian translations
import uaTranslation from '../locales/ua/translation.json'

const resources = {
    en: { translation: enTranslation },
    ru: { translation: ruTranslation },
    pl: { translation: plTranslation },
    ua: { translation: uaTranslation }
}

// Clear any previously persisted language preference so the UI is always English.
try {
    if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.removeItem('i18nextLng')
    }
} catch (_) { /* ignore storage errors */ }

i18n
    .use(initReactI18next)
    .init({
        resources,
        lng: 'en',
        fallbackLng: 'en',
        supportedLngs: ['en'],
        debug: false,
        interpolation: {
            escapeValue: false // React already escapes by default
        }
    })

// Helper function to change language
export const changeLanguage = (lng) => i18n.changeLanguage(lng)

// Helper to get current language
export const getCurrentLanguage = () => i18n.language

export default i18n
