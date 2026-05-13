/**
 * Standardize opening_hours to format: "Mon-Fri: 8AM-5PM, Sat-Sun: 9AM-5PM"
 * 
 * Handles:
 * 1. Google Places verbose: "Monday: 7:00 AM – 7:00 PM | Tuesday: ..."
 * 2. JSON objects: {"monday":"10:00-18:00",...}
 * 3. 24h format: "Mon-Fri: 08:30-17:00"
 * 4. Already correct format (skip)
 */

const { createClient } = require('@supabase/supabase-js')

const supabase = createClient(
    'https://myyzguendoruefiiufop.supabase.co',
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im15eXpndWVuZG9ydWVmaWl1Zm9wIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NTE2NTc4NywiZXhwIjoyMDkwNzQxNzg3fQ.SOZnER0ntb2laFfDejHAXMOPdCNqH3hAuPXBH2LChbs'
)

const DAY_ABBREV = {
    monday: 'Mon', tuesday: 'Tue', wednesday: 'Wed', thursday: 'Thu',
    friday: 'Fri', saturday: 'Sat', sunday: 'Sun'
}

const DAY_ORDER = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

// Convert 24h time "08:30" or "13:00" to "8:30AM" / "1PM"
function to12h(time24) {
    if (!time24 || time24 === 'Closed') return 'Closed'
    const [h, m] = time24.split(':').map(Number)
    if (isNaN(h)) return time24
    const period = h >= 12 ? 'PM' : 'AM'
    const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h
    if (m === 0) return `${h12}${period}`
    return `${h12}:${String(m).padStart(2, '0')}${period}`
}

// Convert "7:00 AM" or "10:00 PM" to "7AM" / "10PM"
function normalizeAmPm(timeStr) {
    if (!timeStr) return ''
    const cleaned = timeStr.trim().replace(/\s+/g, ' ')
    const match = cleaned.match(/^(\d{1,2}):?(\d{2})?\s*(AM|PM)$/i)
    if (!match) return cleaned
    const h = parseInt(match[1])
    const m = match[2] ? parseInt(match[2]) : 0
    const period = match[3].toUpperCase()
    if (m === 0) return `${h}${period}`
    return `${h}:${String(m).padStart(2, '0')}${period}`
}

// Group consecutive days with same hours
function groupDays(dayHoursMap) {
    const entries = DAY_ORDER.map(d => ({ day: d, hours: dayHoursMap[d] || null }))
    const groups = []
    let current = null

    for (const entry of entries) {
        if (!entry.hours) continue
        if (current && current.hours === entry.hours) {
            current.days.push(entry.day)
        } else {
            if (current) groups.push(current)
            current = { days: [entry.day], hours: entry.hours }
        }
    }
    if (current) groups.push(current)

    return groups.map(g => {
        const dayRange = g.days.length === 1
            ? g.days[0]
            : g.days.length === 7
                ? 'Daily'
                : `${g.days[0]}-${g.days[g.days.length - 1]}`
        return dayRange === 'Daily' ? `Daily: ${g.hours}` : `${dayRange}: ${g.hours}`
    }).join(', ')
}

    // Parse Google Places verbose format
function parseGoogleVerbose(str) {
    const dayHours = {}
    const parts = str.split('|').map(s => s.trim())
    
    for (const part of parts) {
        const match = part.match(/^(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday):\s*(.+)$/i)
        if (!match) continue
        const day = DAY_ABBREV[match[1].toLowerCase()]
        const timeStr = match[2].trim()
        
        if (timeStr.toLowerCase() === 'closed') continue
        
        // Parse "7:00 AM – 7:00 PM" or "1:00 – 10:00 PM" (first time may lack AM/PM)
        const timeMatch = timeStr.match(/(\d{1,2}:\d{2})\s*(AM|PM)?\s*[–—-]\s*(\d{1,2}:\d{2})\s*(AM|PM)?/i)
        if (timeMatch) {
            const openHour = parseInt(timeMatch[1].split(':')[0])
            const closeHour = parseInt(timeMatch[3].split(':')[0])
            const closePeriod = (timeMatch[4] || 'PM').toUpperCase()
            
            // Infer open period: if no AM/PM given, determine from context
            let openPeriod = timeMatch[2] ? timeMatch[2].toUpperCase() : null
            if (!openPeriod) {
                // Restaurant logic: if close is PM and open hour is small (1-11),
                // it's almost always PM too (restaurants open at 1PM, not 1AM)
                // Only exception: early morning (5-8 = AM for cafes/bakeries)
                if (closePeriod === 'PM') {
                    if (openHour >= 6 && openHour <= 9) openPeriod = 'AM' // Early cafe/bakery
                    else openPeriod = 'PM' // Afternoon/evening restaurant
                } else {
                    openPeriod = 'AM'
                }
            }
            
            const openTime = normalizeAmPm(`${timeMatch[1]} ${openPeriod}`)
            const closeTime = normalizeAmPm(`${timeMatch[3]} ${closePeriod}`)
            dayHours[day] = `${openTime}-${closeTime}`
        }
    }
    
    if (Object.keys(dayHours).length === 0) return null
    return groupDays(dayHours)
}

// Parse JSON format
function parseJsonHours(str) {
    let obj
    try {
        obj = JSON.parse(str)
    } catch { return null }
    
    const dayHours = {}
    for (const [key, value] of Object.entries(obj)) {
        const day = DAY_ABBREV[key.toLowerCase()]
        if (!day) continue
        if (!value || value.toLowerCase() === 'closed') continue
        
        // "10:00-18:00" → "10AM-6PM"
        const match = value.match(/(\d{2}:\d{2})\s*-\s*(\d{2}:\d{2})/)
        if (match) {
            dayHours[day] = `${to12h(match[1])}-${to12h(match[2])}`
        }
    }
    
    if (Object.keys(dayHours).length === 0) return null
    return groupDays(dayHours)
}

// Parse 24h format like "Mon-Fri: 08:30-17:00"
function parse24hFormat(str) {
    // Check if it contains 24h times (XX:XX pattern without AM/PM)
    const has24h = /\d{2}:\d{2}/.test(str) && !/AM|PM/i.test(str) && !str.startsWith('{')
    if (!has24h) return null
    
    // Replace all 24h times with 12h
    return str.replace(/(\d{2}:\d{2})/g, (match) => to12h(match))
}

// Check if already in correct format
function isCorrectFormat(str) {
    // Correct format: "Mon-Fri: 8AM-5PM" or "Daily: 9AM-10PM"
    return /^(Mon|Tue|Wed|Thu|Fri|Sat|Sun|Daily)/.test(str) && /\d{1,2}(:\d{2})?(AM|PM)/i.test(str)
}

function standardize(hours) {
    if (!hours || hours.trim() === '') return null
    hours = hours.trim()
    
    // Already correct
    if (isCorrectFormat(hours)) return null // null = no change needed
    
    // JSON format
    if (hours.startsWith('{')) {
        return parseJsonHours(hours)
    }
    
    // Google Places verbose (contains "Monday:" or "Tuesday:" etc)
    if (/^(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday):/i.test(hours)) {
        return parseGoogleVerbose(hours)
    }
    
    // 24h format
    const converted24h = parse24hFormat(hours)
    if (converted24h) return converted24h
    
    // Unknown format — skip
    return null
}

async function main() {
    const { data, error } = await supabase
        .from('locations')
        .select('id, title, opening_hours')
        .not('opening_hours', 'is', null)
        .neq('opening_hours', '')
    
    if (error) { console.error(error); return }
    
    const updates = []
    const skipped = []
    
    for (const loc of data) {
        const standardized = standardize(loc.opening_hours)
        if (standardized) {
            updates.push({ id: loc.id, title: loc.title, old: loc.opening_hours, new: standardized })
        }
    }
    
    console.log(`\nTotal locations: ${data.length}`)
    console.log(`Already correct: ${data.length - updates.length}`)
    console.log(`Need update: ${updates.length}\n`)
    
    if (updates.length === 0) {
        console.log('Nothing to update!')
        return
    }
    
    console.log('--- PREVIEW (all changes) ---\n')
    for (const u of updates) {
        console.log(`${u.title}`)
        console.log(`  OLD: ${u.old.substring(0, 80)}${u.old.length > 80 ? '...' : ''}`)
        console.log(`  NEW: ${u.new}`)
        console.log('')
    }
    
    // Apply updates
    const DRY_RUN = process.argv.includes('--dry-run')
    if (DRY_RUN) {
        console.log('\n[DRY RUN] No changes applied. Remove --dry-run to apply.')
        return
    }
    
    console.log('\n--- APPLYING UPDATES ---\n')
    let success = 0, failed = 0
    
    for (const u of updates) {
        const { error } = await supabase
            .from('locations')
            .update({ opening_hours: u.new })
            .eq('id', u.id)
        
        if (error) {
            console.error(`FAILED: ${u.title} — ${error.message}`)
            failed++
        } else {
            success++
        }
    }
    
    console.log(`\nDone! Updated: ${success}, Failed: ${failed}`)
}

main()
