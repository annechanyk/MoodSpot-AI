/**
 * MoodSpot RateLimiter Service Tests
 * Tests for quota management and rate limiting functionality
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import rateLimiter from '../RateLimiter.js'

// Mock localStorage
const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn()
}

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock
})

describe('RateLimiter Service', () => {
  beforeEach(() => {
    // Reset mocks
    vi.clearAllMocks()
    
    // Reset rate limiter state
    rateLimiter.quotas = null
    rateLimiter.initialized = false
    
    // Mock current date
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2024-01-15T10:00:00Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('Initialization', () => {
    it('should initialize with default quotas when no stored data exists', async () => {
      localStorageMock.getItem.mockReturnValue(null)
      
      await rateLimiter.initialize()
      
      expect(rateLimiter.initialized).toBe(true)
      expect(rateLimiter.quotas).toEqual({
        date: '2024-01-15',
        services: {
          openai: { used: 0, limit: 100 },
          googlePlaces: { used: 0, limit: 250 },
          database: { used: 0, limit: 1000 }
        },
        resetTime: '2024-01-16T00:00:00.000Z'
      })
    })

    it('should load existing quotas from localStorage', async () => {
      const existingQuotas = {
        date: '2024-01-15',
        services: {
          openai: { used: 5, limit: 100 },
          googlePlaces: { used: 10, limit: 250 },
          database: { used: 50, limit: 1000 }
        },
        resetTime: '2024-01-16T00:00:00.000Z'
      }
      
      localStorageMock.getItem.mockReturnValue(JSON.stringify(existingQuotas))
      
      await rateLimiter.initialize()
      
      expect(rateLimiter.quotas).toEqual(existingQuotas)
    })

    it('should reset quotas when date has changed', async () => {
      const oldQuotas = {
        date: '2024-01-14', // Yesterday
        services: {
          openai: { used: 50, limit: 100 },
          googlePlaces: { used: 100, limit: 250 },
          database: { used: 500, limit: 1000 }
        },
        resetTime: '2024-01-15T00:00:00.000Z'
      }
      
      localStorageMock.getItem.mockReturnValue(JSON.stringify(oldQuotas))
      
      await rateLimiter.initialize()
      
      expect(rateLimiter.quotas.date).toBe('2024-01-15')
      expect(rateLimiter.quotas.services.openai.used).toBe(0)
      expect(rateLimiter.quotas.services.googlePlaces.used).toBe(0)
      expect(rateLimiter.quotas.services.database.used).toBe(0)
    })
  })

  describe('Quota Checking', () => {
    beforeEach(async () => {
      localStorageMock.getItem.mockReturnValue(null)
      await rateLimiter.initialize()
    })

    it('should return true when quota is available', async () => {
      const hasQuota = await rateLimiter.checkQuota('openai')
      expect(hasQuota).toBe(true)
    })

    it('should return false when quota is exceeded', async () => {
      // Set usage to limit
      rateLimiter.quotas.services.openai.used = 100
      
      const hasQuota = await rateLimiter.checkQuota('openai')
      expect(hasQuota).toBe(false)
    })

    it('should return false for unknown service', async () => {
      const hasQuota = await rateLimiter.checkQuota('unknown')
      expect(hasQuota).toBe(false)
    })
  })

  describe('Usage Increment', () => {
    beforeEach(async () => {
      localStorageMock.getItem.mockReturnValue(null)
      await rateLimiter.initialize()
    })

    it('should increment usage when quota is available', async () => {
      const success = await rateLimiter.incrementUsage('openai')
      
      expect(success).toBe(true)
      expect(rateLimiter.quotas.services.openai.used).toBe(1)
      expect(localStorageMock.setItem).toHaveBeenCalled()
    })

    it('should not increment when quota is exceeded', async () => {
      // Set usage to limit
      rateLimiter.quotas.services.openai.used = 100
      
      const success = await rateLimiter.incrementUsage('openai')
      
      expect(success).toBe(false)
      expect(rateLimiter.quotas.services.openai.used).toBe(100)
    })

    it('should return false for unknown service', async () => {
      const success = await rateLimiter.incrementUsage('unknown')
      expect(success).toBe(false)
    })
  })

  describe('Remaining Quota', () => {
    beforeEach(async () => {
      localStorageMock.getItem.mockReturnValue(null)
      await rateLimiter.initialize()
    })

    it('should return correct remaining quota', async () => {
      rateLimiter.quotas.services.openai.used = 25
      
      const remaining = await rateLimiter.getRemainingQuota('openai')
      expect(remaining).toBe(75)
    })

    it('should return 0 when quota is exceeded', async () => {
      rateLimiter.quotas.services.openai.used = 150
      
      const remaining = await rateLimiter.getRemainingQuota('openai')
      expect(remaining).toBe(0)
    })

    it('should return 0 for unknown service', async () => {
      const remaining = await rateLimiter.getRemainingQuota('unknown')
      expect(remaining).toBe(0)
    })
  })

  describe('All Quotas Status', () => {
    beforeEach(async () => {
      localStorageMock.getItem.mockReturnValue(null)
      await rateLimiter.initialize()
    })

    it('should return complete quota status', async () => {
      rateLimiter.quotas.services.openai.used = 25
      rateLimiter.quotas.services.googlePlaces.used = 50
      rateLimiter.quotas.services.database.used = 100
      
      const status = await rateLimiter.getAllQuotas()
      
      expect(status).toEqual({
        openai: {
          used: 25,
          limit: 100,
          remaining: 75,
          percentage: 25
        },
        googlePlaces: {
          used: 50,
          limit: 250,
          remaining: 200,
          percentage: 20
        },
        database: {
          used: 100,
          limit: 1000,
          remaining: 900,
          percentage: 10
        },
        resetTime: '2024-01-16T00:00:00.000Z',
        date: '2024-01-15'
      })
    })
  })

  describe('Time Until Reset', () => {
    beforeEach(async () => {
      localStorageMock.getItem.mockReturnValue(null)
      await rateLimiter.initialize()
    })

    it('should calculate hours until reset correctly', () => {
      // Current time is 10:00 AM, reset is at midnight (14 hours)
      const hours = rateLimiter.getHoursUntilReset()
      expect(hours).toBe(14)
    })

    it('should return 0 when past reset time', () => {
      // Move time to after midnight
      vi.setSystemTime(new Date('2024-01-16T01:00:00Z'))
      
      const hours = rateLimiter.getHoursUntilReset()
      expect(hours).toBe(0)
    })
  })

  describe('Force Reset', () => {
    beforeEach(async () => {
      localStorageMock.getItem.mockReturnValue(null)
      await rateLimiter.initialize()
    })

    it('should reset all quotas to zero', async () => {
      // Set some usage
      rateLimiter.quotas.services.openai.used = 50
      rateLimiter.quotas.services.googlePlaces.used = 100
      rateLimiter.quotas.services.database.used = 200
      
      await rateLimiter.forceReset()
      
      expect(rateLimiter.quotas.services.openai.used).toBe(0)
      expect(rateLimiter.quotas.services.googlePlaces.used).toBe(0)
      expect(rateLimiter.quotas.services.database.used).toBe(0)
      expect(localStorageMock.setItem).toHaveBeenCalled()
    })
  })

  describe('Error Handling', () => {
    it('should handle localStorage errors gracefully', async () => {
      localStorageMock.getItem.mockImplementation(() => {
        throw new Error('localStorage error')
      })
      
      await rateLimiter.initialize()
      
      // Should still initialize with default quotas
      expect(rateLimiter.initialized).toBe(true)
      expect(rateLimiter.quotas.services.openai.used).toBe(0)
    })

    it('should handle invalid JSON in localStorage', async () => {
      localStorageMock.getItem.mockReturnValue('invalid json')
      
      await rateLimiter.initialize()
      
      // Should initialize with default quotas
      expect(rateLimiter.initialized).toBe(true)
      expect(rateLimiter.quotas.services.openai.used).toBe(0)
    })
  })

  describe('Date Utilities', () => {
    it('should generate correct date string', () => {
      const dateString = rateLimiter.getTodayString()
      expect(dateString).toBe('2024-01-15')
    })

    it('should generate correct next midnight', () => {
      const midnight = rateLimiter.getNextMidnight()
      expect(midnight).toBe('2024-01-16T00:00:00.000Z')
    })
  })
})