import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import LanguageDetector from 'i18next-browser-languagedetector'

import enTranslations from '../locales/en/translation.json'
import plTranslations from '../locales/pl/translation.json'
import ruTranslations from '../locales/ru/translation.json'
import uaTranslations from '../locales/ua/translation.json'

const resources = {
    en: { translation: enTranslations },
    pl: { translation: plTranslations },
    ru: { translation: ruTranslations },
    ua: { translation: uaTranslations }
}

i18n
    .use(LanguageDetector)
    .use(initReactI18next)
    .init({
        resources,
        fallbackLng: 'en',
        supportedLngs: ['en', 'pl', 'ru', 'ua'],
        interpolation: {
            escapeValue: false // React already escapes by default
        }
    })

export default i18n
