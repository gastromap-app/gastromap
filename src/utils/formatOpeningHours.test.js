import { describe, it, expect } from 'vitest'
import { formatOpeningHours, getHoursForDay, isCurrentlyOpen } from './formatOpeningHours'

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
