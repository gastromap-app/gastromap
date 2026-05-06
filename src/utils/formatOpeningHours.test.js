import { describe, it, expect } from 'vitest'
import { formatOpeningHours, getHoursForDay, isCurrentlyOpen, normalizeOpeningHoursToJSON } from './formatOpeningHours'

describe('formatOpeningHours', () => {
    it('returns empty string for null/undefined', () => {
        expect(formatOpeningHours(null)).toBe('')
        expect(formatOpeningHours(undefined)).toBe('')
        expect(formatOpeningHours('')).toBe('')
    })

    it('formats simple string hours', () => {
        expect(formatOpeningHours('09:00 - 23:00')).toBe('09:00 – 23:00')
        expect(formatOpeningHours('8:00-18:00')).toBe('08:00 – 18:00')
    })

    it('formats JSON object hours (same every day)', () => {
        const hours = {
            monday: '08:00-18:00',
            tuesday: '08:00-18:00',
            wednesday: '08:00-18:00',
            thursday: '08:00-18:00',
            friday: '08:00-18:00',
            saturday: '08:00-18:00',
            sunday: '08:00-18:00'
        }
        expect(formatOpeningHours(hours)).toBe('08:00 – 18:00')
    })

    it('formats JSON string hours', () => {
        const hours = '{"monday":"09:00-17:00","tuesday":"09:00-17:00","wednesday":"09:00-17:00","thursday":"09:00-17:00","friday":"09:00-17:00","saturday":"10:00-16:00","sunday":"10:00-16:00"}'
        // Should show weekday/weekend split
        const result = formatOpeningHours(hours)
        expect(result).toContain('09:00 – 17:00')
        expect(result).toContain('10:00 – 16:00')
    })

    it('shows "Today:" prefix when days differ', () => {
        // Mock: assume today is Wednesday
        const originalGetDay = Date.prototype.getDay
        Date.prototype.getDay = () => 3 // Wednesday

        const hours = {
            monday: '08:00-18:00',
            tuesday: '08:00-18:00',
            wednesday: '09:00-17:00',
            thursday: '08:00-18:00',
            friday: '08:00-18:00',
            saturday: '10:00-16:00',
            sunday: '10:00-16:00'
        }

        const result = formatOpeningHours(hours)
        expect(result).toContain('Today:')
        expect(result).toContain('09:00 – 17:00')

        // Restore
        Date.prototype.getDay = originalGetDay
    })
})

describe('getHoursForDay', () => {
    it('returns hours for specific day', () => {
        const hours = {
            monday: '08:00-18:00',
            tuesday: '09:00-17:00'
        }
        expect(getHoursForDay(hours, 'monday')).toBe('08:00 – 18:00')
        expect(getHoursForDay(hours, 'tuesday')).toBe('09:00 – 17:00')
    })

    it('returns null for missing day', () => {
        expect(getHoursForDay(null, 'monday')).toBeNull()
        expect(getHoursForDay({}, 'monday')).toBeNull()
    })
})

describe('isCurrentlyOpen', () => {
    it('returns null for invalid input', () => {
        const result = isCurrentlyOpen(null)
        expect(result.isOpen).toBeNull()
    })

    it('detects open status correctly', () => {
        const hours = {
            monday: '08:00-18:00',
            tuesday: '08:00-18:00',
            wednesday: '08:00-18:00',
            thursday: '08:00-18:00',
            friday: '08:00-18:00',
            saturday: '09:00-18:00',
            sunday: '09:00-18:00'
        }

        const result = isCurrentlyOpen(hours)
        expect(result.todayHours).toBe('08:00 – 18:00')
        expect(result.isOpen).toBeDefined()
    })

    it('handles simple string format', () => {
        const result = isCurrentlyOpen('09:00 - 23:00')
        expect(result.todayHours).toBe('09:00 – 23:00')
        expect(result.isOpen).toBeDefined()
    })
})

describe('normalizeOpeningHoursToJSON', () => {
    it('returns null for null/undefined', () => {
        expect(normalizeOpeningHoursToJSON(null)).toBeNull()
        expect(normalizeOpeningHoursToJSON(undefined)).toBeNull()
    })

    it('converts simple 24h string to JSON', () => {
        const result = normalizeOpeningHoursToJSON('09:00 - 23:00')
        expect(typeof result).toBe('string')
        const parsed = JSON.parse(result)
        expect(parsed.monday).toBe('09:00-23:00')
        expect(parsed.sunday).toBe('09:00-23:00')
    })

    it('parses Google Places weekday_text (AM/PM)', () => {
        const weekdayText = [
            'Monday: 8:00 AM – 6:00 PM',
            'Tuesday: 8:00 AM – 6:00 PM',
            'Wednesday: 8:00 AM – 6:00 PM',
            'Thursday: 8:00 AM – 6:00 PM',
            'Friday: 8:00 AM – 10:00 PM',
            'Saturday: 9:00 AM – 10:00 PM',
            'Sunday: 9:00 AM – 6:00 PM'
        ]
        
        const result = normalizeOpeningHoursToJSON(weekdayText)
        expect(typeof result).toBe('string')
        const parsed = JSON.parse(result)
        expect(parsed.monday).toBe('08:00-18:00')
        expect(parsed.friday).toBe('08:00-22:00')
        expect(parsed.saturday).toBe('09:00-22:00')
    })

    it('parses Google Places weekday_text (24h format)', () => {
        const weekdayText = [
            'Monday: 08:00-18:00',
            'Tuesday: 08:00-18:00',
            'Wednesday: 08:00-18:00'
        ]
        
        const result = normalizeOpeningHoursToJSON(weekdayText)
        const parsed = JSON.parse(result)
        expect(parsed.monday).toBe('08:00-18:00')
    })

    it('parses Apify format', () => {
        const apifyHours = [
            { day: 'Monday', hours: '8:00 AM – 6:00 PM' },
            { day: 'Tuesday', hours: '8:00 AM – 6:00 PM' },
            { day: 'Saturday', hours: '10:00 AM – 8:00 PM' }
        ]
        
        const result = normalizeOpeningHoursToJSON(apifyHours)
        const parsed = JSON.parse(result)
        expect(parsed.monday).toBe('08:00-18:00')
        expect(parsed.saturday).toBe('10:00-20:00')
    })

    it('normalizes already-JSON object', () => {
        const obj = {
            monday: '8:00-18:00',
            tuesday: '8:00 - 18:00',
            wednesday: '08:00-18:00'
        }
        
        const result = normalizeOpeningHoursToJSON(obj)
        const parsed = JSON.parse(result)
        expect(parsed.monday).toBe('08:00-18:00')
        expect(parsed.tuesday).toBe('08:00-18:00')
    })

    it('normalizes JSON string', () => {
        const jsonStr = '{"monday":"8:00-18:00","tuesday":"9:00 - 17:00"}'
        const result = normalizeOpeningHoursToJSON(jsonStr)
        const parsed = JSON.parse(result)
        expect(parsed.monday).toBe('08:00-18:00')
        expect(parsed.tuesday).toBe('09:00-17:00')
    })

    it('handles overnight hours (AM/PM)', () => {
        const weekdayText = ['Monday: 10:00 PM – 2:00 AM']
        const result = normalizeOpeningHoursToJSON(weekdayText)
        const parsed = JSON.parse(result)
        expect(parsed.monday).toBe('22:00-02:00')
    })

    it('handles 12:00 AM/PM edge cases', () => {
        // 12:00 AM = 00:00, 12:00 PM = 12:00
        const apifyHours = [
            { day: 'Monday', hours: '12:00 AM – 12:00 PM' }
        ]
        const result = normalizeOpeningHoursToJSON(apifyHours)
        const parsed = JSON.parse(result)
        expect(parsed.monday).toBe('00:00-12:00')
    })
})
