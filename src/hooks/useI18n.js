import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { changeLanguage } from '@/i18n/config'

/**
 * useI18n - Умный хук для управления переводами
 * 
 * @param {string} namespace - Пространство имен (common, admin, features)
 * @param {boolean} isAdmin - Режим админки (true = русский, false = английский)
 * @returns {Object} Методы и данные для работы с переводами
 */
export function useI18n(namespace = 'common', isAdmin = false) {
    const { t, i18n: i18nInstance } = useTranslation(namespace)

    // Авто-переключение языка на основе роли отключено для поддержки мультиязычности в админке
    /*
    useEffect(() => {
        if (isAdmin && i18nInstance.language !== 'ru') {
            changeLanguage('ru')
        }
    }, [isAdmin, i18nInstance])
    */

    // Функция для явного переключения языка
    const setLanguage = (lng) => {
        changeLanguage(lng)
    }

    // Функция для переключения на язык пользователя
    const setUserLanguage = () => setLanguage('en')

    // Функция для переключения на язык админки
    const setAdminLanguage = () => setLanguage('ru')

    // Получить доступные языки
    const getAvailableLanguages = () => {
        return i18nInstance.options.supportedLngs || ['en', 'ru', 'pl', 'ua']
    }

    return {
        t,
        i18n: i18nInstance,
        language: i18nInstance.language,
        setLanguage,
        setUserLanguage,
        setAdminLanguage,
        getAvailableLanguages,
        isAdminMode: isAdmin
    }
}

/**
 * useAppLanguage - Хук только для пользовательского приложения
 */
export function useAppLanguage() {
    return useI18n('features', false)
}

/**
 * useAdminLanguage - Хук только для админки
 */
export function useAdminLanguage() {
    return useI18n('admin', true)
}

export default useI18n
