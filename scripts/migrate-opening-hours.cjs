/**
 * Migration Script: Populate opening_hours_structured from existing opening_hours
 * 
 * Scans all locations with opening_hours set but opening_hours_structured empty,
 * parses the text into a structured JSONB format, and updates the DB.
 * 
 * Supported input formats:
 *   - JSON string: '{"monday":"08:00-18:00",...}'
 *   - JSON object (already structured)
 *   - Simple range: "09:00 - 23:00" (applies to all days)
 *   - Day-range: "Mon-Fri: 10:00-22:00, Sat-Sun: 11:00-23:00"
 *   - Google weekday_text: "Monday: 8:00 AM – 6:00 PM | Tuesday: ..."
 *   - Pipe-separated: "Monday: 09:00–22:00 | Tuesday: 09:00–22:00 | ..."
 *   - Comma-separated day ranges: "Mon-Fri 09:00-22:00, Sat 10:00-23:00, Sun closed"
 * 
 * Usage: node scripts/migrate-opening-hours.cjs [--dry-run]
 */

const { createClient } = require('@supabase/supabase-js')
require('dotenv').config()

const SUPABASE_URL = process.env.VITE_SUPABASE_URL
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY

if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error('❌ Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env')
    process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)
const DRY_RUN = process.argv.includes('--dry-run')

const DAYS_ORDER = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']

const DAY_ALIASES = {
    'mon': 'monday', 'tue': 'tuesday', 'wed': 'wednesday',
    'thu': 'thursday', 'fri': 'friday', 'sat': 'saturday', 'sun': 'sunday',
    'monday': 'monday', 'tuesday': 'tuesday', 'wednesday': 'wednesday',
    'thursday': 'thursday', 'friday': 'friday', 'saturday': 'saturday', 'sunday': 'sunday',
    'пн': 'monday', 'вт': 'tuesday', 'ср': 'wednesday',
    'чт': 'thursday', 'пт': 'friday', 'сб': 'saturday', 'вс': 'sunday',
}

function normalizeTime(time) {
    const match = time.match(/(\d{1,2}):(\d{2})/)
    if (!match) return time
    return `${match[1].padStart(2, '0')}:${match[2]}`
}

function normalizeTimeRange(range) {
    if (!range) return null
    const lower = range.toLowerCase().trim()
    if (lower === 'closed' || lower === 'закрыто' || lower === 'zamknięte' || lower === 'зачинено') return 'closed'
    
    const match = range.match(/(\d{1,2}:\d{2})\s*[-–—]\s*(\d{1,2}:\d{2})/)
    if (!match) return range.trim()
    return `${normalizeTime(match[1])}-${normalizeTime(match[2])}`
}

function to24Hour(hours, minutes, ampm) {
    if (ampm === 'AM') { if (hours === 12) hours = 0 }
    else { if (hours !== 12) hours += 12 }
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`
}

function convertAmPmRange(timeStr) {
    // Full format: "8:00 AM – 6:00 PM"
    const match = timeStr.match(/(\d{1,2}):(\d{2})\s*(AM|PM)\s*[-–—‑]\s*(\d{1,2}):(\d{2})\s*(AM|PM)/i)
    if (match) {
        const [, h1, m1, ap1, h2, m2, ap2] = match
        return `${to24Hour(parseInt(h1), parseInt(m1), ap1.toUpperCase())}-${to24Hour(parseInt(h2), parseInt(m2), ap2.toUpperCase())}`
    }
    // Short format without minutes: "8AM-5PM", "5PM-12AM"
    const shortMatch = timeStr.match(/(\d{1,2})\s*(AM|PM)\s*[-–—‑]\s*(\d{1,2})\s*(AM|PM)/i)
    if (shortMatch) {
        const [, h1, ap1, h2, ap2] = shortMatch
        return `${to24Hour(parseInt(h1), 0, ap1.toUpperCase())}-${to24Hour(parseInt(h2), 0, ap2.toUpperCase())}`
    }
    // Mixed: "6:30AM-8PM"
    const mixedMatch = timeStr.match(/(\d{1,2})(?::(\d{2}))?\s*(AM|PM)\s*[-–—‑]\s*(\d{1,2})(?::(\d{2}))?\s*(AM|PM)/i)
    if (mixedMatch) {
        const [, h1, m1 = '0', ap1, h2, m2 = '0', ap2] = mixedMatch
        return `${to24Hour(parseInt(h1), parseInt(m1), ap1.toUpperCase())}-${to24Hour(parseInt(h2), parseInt(m2), ap2.toUpperCase())}`
    }
    return normalizeTimeRange(timeStr)
}

function expandDayRange(startDay, endDay) {
    const startIdx = DAYS_ORDER.indexOf(startDay)
    const endIdx = DAYS_ORDER.indexOf(endDay)
    if (startIdx === -1 || endIdx === -1) return [startDay]
    if (startIdx <= endIdx) return DAYS_ORDER.slice(startIdx, endIdx + 1)
    // Wrap around (e.g., Fri-Mon)
    return [...DAYS_ORDER.slice(startIdx), ...DAYS_ORDER.slice(0, endIdx + 1)]
}

/**
 * Main parser — handles all known formats
 */
function parseOpeningHours(input) {
    if (!input) return null

    // 1. Already a JSON object
    if (typeof input === 'object' && !Array.isArray(input)) {
        const result = {}
        for (const [key, value] of Object.entries(input)) {
            const day = DAY_ALIASES[key.toLowerCase()]
            if (day && value) result[day] = normalizeTimeRange(String(value))
        }
        return Object.keys(result).length > 0 ? result : null
    }

    // 2. Array (Google weekday_text or Apify format)
    if (Array.isArray(input)) {
        if (input.length > 0 && typeof input[0] === 'string') {
            return parseWeekdayTextArray(input)
        }
        if (input.length > 0 && typeof input[0] === 'object') {
            const result = {}
            for (const item of input) {
                const day = DAY_ALIASES[(item.day || '').toLowerCase()]
                if (day && item.hours) {
                    const hrs = item.hours.trim()
                    result[day] = (hrs.includes('AM') || hrs.includes('PM')) ? convertAmPmRange(hrs) : normalizeTimeRange(hrs)
                }
            }
            return Object.keys(result).length > 0 ? result : null
        }
        return null
    }

    const str = String(input).trim()

    // 3. JSON string
    if (str.startsWith('{') || str.startsWith('[')) {
        try {
            const parsed = JSON.parse(str)
            return parseOpeningHours(parsed)
        } catch { /* not valid JSON */ }
    }

    // 4. Pipe-separated: "Monday: 09:00–22:00 | Tuesday: 09:00–22:00 | ..."
    //    Also handles: "Mon-Thu & Sun: 5PM-12AM | Fri-Sat: 5PM-2AM"
    if (str.includes('|')) {
        const segments = str.split('|').map(s => s.trim())
        const result = {}
        for (const segment of segments) {
            // Try to parse as "DayRange: Hours"
            const segMatch = segment.match(/^(.+?):\s*(.+)$/i)
            if (!segMatch) continue
            const dayPart = segMatch[1].toLowerCase().trim()
            const hoursPart = segMatch[2].trim()
            
            let hours
            const lowerHours = hoursPart.toLowerCase()
            if (lowerHours === 'closed') { hours = 'closed' }
            else if (/am|pm/i.test(hoursPart)) { hours = convertAmPmRange(hoursPart) }
            else { hours = normalizeTimeRange(hoursPart) }
            if (!hours) continue

            // Handle "&" in day part: "Mon-Thu & Sun"
            const andParts = dayPart.split(/\s*&\s*/)
            for (const part of andParts) {
                const rangeParts = part.trim().split(/\s*[-–]\s*/)
                if (rangeParts.length === 2) {
                    const startDay = DAY_ALIASES[rangeParts[0]]
                    const endDay = DAY_ALIASES[rangeParts[1]]
                    if (startDay && endDay) {
                        expandDayRange(startDay, endDay).forEach(d => { result[d] = hours })
                    }
                } else {
                    const day = DAY_ALIASES[rangeParts[0]]
                    if (day) result[day] = hours
                }
            }
        }
        if (Object.keys(result).length > 0) return result
        // If pipe parsing failed, try as weekday text
        return parseWeekdayTextArray(segments)
    }

    // 5. Day-range with commas: "Mon-Fri: 10:00-22:00, Sat-Sun: 11:00-23:00"
    //    or "Mon-Fri 10:00-22:00, Sat 10:00-23:00, Sun closed"
    //    or "Mon-Thu & Sun: 5PM-12AM | Fri-Sat: 5PM-2AM"
    //    or "Mon-Fri: 8AM-5PM, Sat-Sun: 9AM-4PM"
    //    or "Daily: 9AM-8PM"
    const dayRangePattern = /([a-zа-яё]{2,9}(?:\s*[-–&]\s*[a-zа-яё]{2,9})?|daily)\s*:?\s*(.+?)(?=[,|]|$)/gi
    const dayRangeMatches = [...str.matchAll(dayRangePattern)]
    if (dayRangeMatches.length > 0) {
        const result = {}
        for (const match of dayRangeMatches) {
            const dayPart = match[1].toLowerCase().trim()
            const hoursPart = match[2].trim()
            
            // Parse hours (handle AM/PM, 24h, and "closed")
            let hours
            const lowerHours = hoursPart.toLowerCase()
            if (lowerHours === 'closed' || lowerHours === 'закрыто' || lowerHours === 'zamknięte' || lowerHours === 'зачинено') {
                hours = 'closed'
            } else if (/am|pm/i.test(hoursPart)) {
                hours = convertAmPmRange(hoursPart)
            } else {
                hours = normalizeTimeRange(hoursPart)
            }
            
            if (!hours) continue

            // Handle "Daily"
            if (dayPart === 'daily') {
                DAYS_ORDER.forEach(d => { result[d] = hours })
                continue
            }

            // Check if it's a range (Mon-Fri) or single day (Mon)
            // Also handle "&" separator: "Mon-Thu & Sun"
            const andParts = dayPart.split(/\s*&\s*/)
            for (const part of andParts) {
                const rangeParts = part.trim().split(/\s*[-–]\s*/)
                if (rangeParts.length === 2) {
                    const startDay = DAY_ALIASES[rangeParts[0]]
                    const endDay = DAY_ALIASES[rangeParts[1]]
                    if (startDay && endDay) {
                        expandDayRange(startDay, endDay).forEach(d => { result[d] = hours })
                    }
                } else {
                    const day = DAY_ALIASES[rangeParts[0]]
                    if (day) result[day] = hours
                }
            }
        }
        if (Object.keys(result).length > 0) return result
    }

    // 6. Google weekday_text lines separated by commas or newlines
    //    "Monday: 8:00 AM – 6:00 PM, Tuesday: 8:00 AM – 6:00 PM, ..."
    if (/\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\s*:/i.test(str)) {
        const lines = str.split(/[,\n]/).map(s => s.trim()).filter(Boolean)
        return parseWeekdayTextArray(lines)
    }

    // 7. Simple time range: "09:00 - 23:00" (same for all days)
    const simpleMatch = str.match(/(\d{1,2}:\d{2})\s*[-–—]\s*(\d{1,2}:\d{2})/)
    if (simpleMatch) {
        const range = `${normalizeTime(simpleMatch[1])}-${normalizeTime(simpleMatch[2])}`
        const result = {}
        DAYS_ORDER.forEach(d => { result[d] = range })
        return result
    }

    // 8. AM/PM simple range: "8:00 AM – 10:00 PM" or "8AM-8PM" or "8AM‑8PM (daily)"
    const ampmMatch = str.match(/(\d{1,2})(?::(\d{2}))?\s*(AM|PM)\s*[-–—‑]\s*(\d{1,2})(?::(\d{2}))?\s*(AM|PM)/i)
    if (ampmMatch) {
        const range = convertAmPmRange(str)
        const result = {}
        DAYS_ORDER.forEach(d => { result[d] = range })
        return result
    }

    return null
}

function parseWeekdayTextArray(lines) {
    const result = {}
    for (const line of lines) {
        const match = line.match(/^(\w+)\s*:\s*(.+)$/i)
        if (!match) continue
        const day = DAY_ALIASES[match[1].toLowerCase()]
        if (!day) continue
        const hrs = match[2].trim()
        if (hrs.toLowerCase() === 'closed' || hrs.toLowerCase() === 'закрыто') {
            result[day] = 'closed'
        } else if (hrs.includes('AM') || hrs.includes('PM') || hrs.includes('am') || hrs.includes('pm')) {
            result[day] = convertAmPmRange(hrs)
        } else {
            result[day] = normalizeTimeRange(hrs)
        }
    }
    return Object.keys(result).length > 0 ? result : null
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
    console.log(`\n🕐 Opening Hours Migration ${DRY_RUN ? '(DRY RUN)' : ''}\n`)

    // Fetch all locations with opening_hours but no structured version
    const { data: locations, error } = await supabase
        .from('locations')
        .select('id, title, opening_hours, opening_hours_structured')
        .not('opening_hours', 'is', null)
        .is('opening_hours_structured', null)
        .order('created_at', { ascending: false })

    if (error) {
        console.error('❌ Failed to fetch locations:', error.message)
        process.exit(1)
    }

    console.log(`📋 Found ${locations.length} locations with opening_hours but no structured data\n`)

    let success = 0
    let failed = 0
    let skipped = 0
    const failures = []

    for (const loc of locations) {
        const parsed = parseOpeningHours(loc.opening_hours)

        if (!parsed) {
            skipped++
            failures.push({ id: loc.id, title: loc.title, raw: loc.opening_hours, reason: 'unparseable' })
            continue
        }

        if (DRY_RUN) {
            console.log(`  ✓ ${loc.title}: ${JSON.stringify(parsed)}`)
            success++
            continue
        }

        const { error: updateError } = await supabase
            .from('locations')
            .update({ opening_hours_structured: parsed })
            .eq('id', loc.id)

        if (updateError) {
            failed++
            failures.push({ id: loc.id, title: loc.title, raw: loc.opening_hours, reason: updateError.message })
        } else {
            success++
        }
    }

    console.log(`\n─── Results ───`)
    console.log(`  ✅ Migrated: ${success}`)
    console.log(`  ⚠️  Skipped (unparseable): ${skipped}`)
    console.log(`  ❌ Failed: ${failed}`)
    console.log(`  📊 Total: ${locations.length}\n`)

    if (failures.length > 0) {
        console.log(`\n─── Failures ───`)
        failures.slice(0, 20).forEach(f => {
            console.log(`  • [${f.id.slice(0, 8)}] ${f.title}: "${f.raw}" → ${f.reason}`)
        })
        if (failures.length > 20) console.log(`  ... and ${failures.length - 20} more`)
    }
}

main().catch(err => {
    console.error('❌ Script failed:', err)
    process.exit(1)
})
