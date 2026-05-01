#!/usr/bin/env node
/**
 * i18n Validation Script
 *
 * Scans the codebase for t('key') and t("key") usages,
 * then verifies every key exists in all locale JSON files.
 *
 * Usage:
 *   node scripts/validate-i18n.js
 *
 * Exit codes:
 *   0 — all keys present in all locales
 *   1 — missing keys found
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const SRC_DIR = path.join(__dirname, '..', 'src')
const LOCALES_DIR = path.join(__dirname, '..', 'src', 'locales')
const LOCALES = ['en', 'ru', 'pl', 'ua']

// ─── Extract keys from source files ──────────────────────────────────────────

function findSourceFiles(dir, files = []) {
    const entries = fs.readdirSync(dir, { withFileTypes: true })
    for (const entry of entries) {
        const fullPath = path.join(dir, entry.name)
        if (entry.isDirectory() && entry.name !== 'node_modules') {
            findSourceFiles(fullPath, files)
        } else if (entry.isFile() && /\.(jsx?|tsx?)$/.test(entry.name)) {
            files.push(fullPath)
        }
    }
    return files
}

const BLOCKED_KEYS = new Set([
    // Form / API field names (not translations)
    'name', 'email', 'password', 'message', 'subject', 'status', 'role',
    'id', 'value', 'error', 'image', 'title', 'description', 'category',
    'city', 'address', 'country', 'lat', 'lng', 'phone', 'website',
    'opening_hours', 'price_range', 'google_rating', 'rating', 'total_reviews',
    'cuisine_types', 'tags', 'dietary_options', 'amenities', 'best_for',
    'noise_level', 'outdoor_seating', 'pet_friendly', 'child_friendly',
    'average_visit_duration', 'ai_context', 'ai_keywords', 'insider_tip',
    'must_try', 'michelin_stars', 'michelin_bib', 'special_labels',
    'place_id', 'sessiontoken', 'q', 'width', 'height', 'fit', 'quality',
    'resize', 'timestamp', 'user_id', 'summary', 'translations',
    'import', 'ingredient', 'dish', 'guide', 'offline', 'div', 'i1',
    // Test / mock data
    'hello', 'themechange', 'touchstart', 'touchmove', 'onboarding_completed',
    'pi_mock_123', 'pi_mock_456', 'pi_mock_789', 'pi_mock_bad', 'pi_mock_blik',
    'prod_nonexistent', 'prod_subscription_monthly',
    // HTML / DOM
    'error_description',
])

function shouldSkipFile(filePath) {
    // Skip test files
    if (/\.(test|spec)\.(jsx?|tsx?)$/.test(filePath)) return true
    if (filePath.includes('__tests__')) return true
    // Skip mock data files
    if (filePath.includes('/mocks/')) return true
    return false
}

function extractKeysFromFile(filePath) {
    const content = fs.readFileSync(filePath, 'utf-8')
    const keys = new Set()

    // Match t('key') or t("key") or t(`key`) — only dotted keys or known namespaces
    const regex = /t\(['"`]([a-zA-Z0-9_.]+)['"`]/g
    let match
    while ((match = regex.exec(content)) !== null) {
        const key = match[1]
        if (BLOCKED_KEYS.has(key)) continue
        // Allow dotted keys (namespaced) or keys starting with known prefixes
        const isNamespaced = key.includes('.')
        const isKnownPrefix =
            key.startsWith('dashboard.') ||
            key.startsWith('errors.') ||
            key.startsWith('filter.') ||
            key.startsWith('location.') ||
            key.startsWith('onboarding.') ||
            key.startsWith('pages.') ||
            key.startsWith('header.') ||
            key.startsWith('admin.') ||
            key.startsWith('auth.') ||
            key.startsWith('common.') ||
            key.startsWith('footer.')
        if (isNamespaced || isKnownPrefix) {
            keys.add(key)
        }
    }

    // Also match i18nKey="key" (used in some Trans components)
    const i18nKeyRegex = /i18nKey=['"`]([a-zA-Z0-9_.]+)['"`]/g
    while ((match = i18nKeyRegex.exec(content)) !== null) {
        const key = match[1]
        if (BLOCKED_KEYS.has(key)) continue
        keys.add(key)
    }

    return keys
}

// ─── Check key existence in locale object ────────────────────────────────────

function getNestedValue(obj, path) {
    return path.split('.').reduce((acc, part) => acc?.[part], obj)
}

function loadLocale(locale) {
    const filePath = path.join(LOCALES_DIR, locale, 'translation.json')
    if (!fs.existsSync(filePath)) {
        console.error(`❌ Locale file not found: ${filePath}`)
        process.exit(1)
    }
    return JSON.parse(fs.readFileSync(filePath, 'utf-8'))
}

// ─── Main ────────────────────────────────────────────────────────────────────

const sourceFiles = findSourceFiles(SRC_DIR)
const allKeys = new Set()
const keyToFiles = new Map()

for (const file of sourceFiles) {
    if (shouldSkipFile(file)) continue
    const keys = extractKeysFromFile(file)
    for (const key of keys) {
        allKeys.add(key)
        if (!keyToFiles.has(key)) keyToFiles.set(key, [])
        keyToFiles.get(key).push(path.relative(process.cwd(), file))
    }
}

const localesData = {}
for (const locale of LOCALES) {
    localesData[locale] = loadLocale(locale)
}

let hasErrors = false
const missingByLocale = {}
for (const locale of LOCALES) missingByLocale[locale] = []

for (const key of allKeys) {
    for (const locale of LOCALES) {
        const value = getNestedValue(localesData[locale], key)
        if (value === undefined || value === null) {
            missingByLocale[locale].push(key)
            hasErrors = true
        }
    }
}

// ─── Report ──────────────────────────────────────────────────────────────────

console.log(`\n🔍 Scanned ${sourceFiles.length} source files, found ${allKeys.size} unique translation keys.\n`)

if (!hasErrors) {
    console.log('✅ All keys present in all locales (en, ru, pl, ua).\n')
    process.exit(0)
}

for (const locale of LOCALES) {
    const missing = missingByLocale[locale]
    if (missing.length === 0) {
        console.log(`✅ ${locale.toUpperCase()}: all keys present`)
        continue
    }
    console.log(`\n❌ ${locale.toUpperCase()}: ${missing.length} missing key(s)`)
    for (const key of missing.sort()) {
        const files = keyToFiles.get(key)
        console.log(`   · ${key}`)
        if (files && files.length <= 3) {
            for (const f of files) console.log(`       used in: ${f}`)
        }
    }
}

console.log('\n')
process.exit(1)
