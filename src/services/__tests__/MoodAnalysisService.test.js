import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import moodAnalysisService from '../MoodAnalysisService.js'

// Mock the dependencies
vi.mock('../RateLimiter.js', () => ({
  default: {
    checkQuota: vi.fn(() => Promise.resolve(true)),
    incrementUsage: vi.fn(() => Promise.resolve()),
    getAllQuotas: vi.fn(() => Promise.resolve({
      openai: { used: 0, limit: 100 }
    }))
  }
}))

vi.mock('../LocalStorageManager.js', () => ({
  default: {
    saveMoodEntry: vi.fn(() => Promise.resolve()),
    getAnalysisCache: vi.fn(() => Promise.resolve({})),
    saveAnalysisCache: vi.fn(() => Promise.resolve()),
    clearAnalysisCache: vi.fn(() => Promise.resolve()),
    getMoodHistory: vi.fn(() => Promise.resolve([]))
  }
}))

vi.mock('../../config/environment.js', () => ({
  getApiKey: vi.fn(() => null), // No API key for testing
  getBusinessCategoriesForMood: vi.fn(() => ['cafe', 'park', 'restaurant']),
  isDevelopment: vi.fn(() => true), // Always development mode in tests
  API_CONFIG: {
    OPENAI: {
      BASE_URL: 'https://api.openai.com/v1',
      MODEL: 'gpt-4o',
      MAX_TOKENS: 500,
      TEMPERATURE: 0.7
    }
  }
}))

describe('MoodAnalysisService', () => {
  beforeEach(async () => {
    vi.clearAllMocks()
    // Reset service state
    moodAnalysisService.isInitialized = false
    moodAnalysisService.analysisCache = new Map()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('initialization', () => {
    it('should initialize successfully', async () => {
      await moodAnalysisService.initialize()
      
      expect(moodAnalysisService.isInitialized).toBe(true)
    })

    it('should handle missing API key gracefully', async () => {
      // Ensure getApiKey returns null for this test
      const { getApiKey } = await import('../../config/environment.js')
      getApiKey.mockReturnValue(null)
      
      // Reset and reinitialize
      moodAnalysisService.isInitialized = false
      await moodAnalysisService.initialize()
      
      expect(moodAnalysisService.apiKey).toBeNull()
      expect(moodAnalysisService.isInitialized).toBe(true)
    })
  })

  describe('mood analysis', () => {
    beforeEach(async () => {
      await moodAnalysisService.initialize()
    })

    it('should analyze mood with mock data when no API key', async () => {
      const mockExportData = {
        dataUrl: 'data:image/png;base64,mock-image-data',
        width: 400,
        height: 300,
        compressedSize: 1024,
        compressionRatio: 50
      }

      const result = await moodAnalysisService.analyzeMood(mockExportData)

      expect(result).toHaveProperty('primaryMood')
      expect(result).toHaveProperty('confidence')
      expect(result).toHaveProperty('recommendations')
      expect(result).toHaveProperty('description')
      expect(result).toHaveProperty('businessCategories')
      expect(result).toHaveProperty('metadata')
      expect(result.isMockData).toBe(true)
    })

    it('should handle invalid export data', async () => {
      await expect(moodAnalysisService.analyzeMood(null)).rejects.toThrow('Invalid drawing data provided')
      await expect(moodAnalysisService.analyzeMood({})).rejects.toThrow('Invalid drawing data provided')
    })

    it('should use cache for repeated analysis', async () => {
      const mockExportData = {
        dataUrl: 'data:image/png;base64,same-image-data',
        width: 400,
        height: 300,
        compressedSize: 1024,
        compressionRatio: 50
      }

      // First analysis
      const result1 = await moodAnalysisService.analyzeMood(mockExportData)
      
      // Second analysis with same data should use cache
      const result2 = await moodAnalysisService.analyzeMood(mockExportData)

      expect(result1.primaryMood).toBe(result2.primaryMood)
      expect(moodAnalysisService.analysisCache.size).toBe(1)
    })

    it('should handle quota exceeded error', async () => {
      const rateLimiter = await import('../RateLimiter.js')
      rateLimiter.default.checkQuota.mockResolvedValueOnce(false)

      const mockExportData = {
        dataUrl: 'data:image/png;base64,mock-image-data',
        width: 400,
        height: 300
      }

      await expect(moodAnalysisService.analyzeMood(mockExportData)).rejects.toThrow('Daily OpenAI quota exceeded')
    })
  })

  describe('mock analysis generation', () => {
    it('should generate valid mock analysis', () => {
      const mockResult = moodAnalysisService.generateMockAnalysis()

      expect(mockResult).toHaveProperty('primaryMood')
      expect(mockResult).toHaveProperty('confidence')
      expect(mockResult).toHaveProperty('recommendations')
      expect(mockResult).toHaveProperty('description')
      expect(mockResult.isMockData).toBe(true)
      
      expect(typeof mockResult.confidence).toBe('number')
      expect(mockResult.confidence).toBeGreaterThan(0)
      expect(mockResult.confidence).toBeLessThanOrEqual(1)
      
      expect(Array.isArray(mockResult.recommendations)).toBe(true)
      expect(mockResult.recommendations.length).toBeGreaterThan(0)
      
      // Check recommendation structure
      const firstRec = mockResult.recommendations[0]
      expect(firstRec).toHaveProperty('title')
      expect(firstRec).toHaveProperty('description')
      expect(firstRec).toHaveProperty('icon')
    })

    it('should generate different mock results', () => {
      const results = []
      for (let i = 0; i < 10; i++) {
        results.push(moodAnalysisService.generateMockAnalysis())
      }

      // Should have some variety in moods
      const uniqueMoods = new Set(results.map(r => r.primaryMood))
      expect(uniqueMoods.size).toBeGreaterThan(1)
    })
  })

  describe('fallback analysis', () => {
    it('should generate fallback analysis on error', () => {
      const fallback = moodAnalysisService.generateFallbackAnalysis('Test error')

      expect(fallback.primaryMood).toBe('calm')
      expect(fallback.confidence).toBe(0.5)
      expect(fallback.metadata.error).toBe('Test error')
      expect(fallback.metadata.isFallback).toBe(true)
    })
  })

  describe('cache management', () => {
    beforeEach(async () => {
      await moodAnalysisService.initialize()
    })

    it('should generate consistent cache keys', () => {
      const imageData = 'data:image/png;base64,test-data'
      const key1 = moodAnalysisService.generateCacheKey(imageData)
      const key2 = moodAnalysisService.generateCacheKey(imageData)

      expect(key1).toBe(key2)
      expect(key1).toMatch(/^mood_\d+$/)
    })

    it('should clear cache', () => {
      moodAnalysisService.analysisCache.set('test', 'data')
      expect(moodAnalysisService.analysisCache.size).toBe(1)

      moodAnalysisService.clearCache()
      expect(moodAnalysisService.analysisCache.size).toBe(0)
    })
  })

  describe('service status', () => {
    it('should return service status', async () => {
      // Ensure no API key for this test
      const { getApiKey } = await import('../../config/environment.js')
      getApiKey.mockReturnValue(null)
      
      // Reset and reinitialize
      moodAnalysisService.isInitialized = false
      await moodAnalysisService.initialize()
      
      const status = await moodAnalysisService.getStatus()

      expect(status).toHaveProperty('initialized')
      expect(status).toHaveProperty('hasApiKey')
      expect(status).toHaveProperty('cacheSize')
      expect(status).toHaveProperty('quotaRemaining')
      expect(status).toHaveProperty('quotaUsed')
      expect(status).toHaveProperty('quotaLimit')
      
      expect(status.initialized).toBe(true)
      expect(status.hasApiKey).toBe(false) // No API key in test
    })
  })

  describe('utility functions', () => {
    it('should generate unique IDs', () => {
      const id1 = moodAnalysisService.generateId()
      const id2 = moodAnalysisService.generateId()

      expect(id1).not.toBe(id2)
      expect(id1).toMatch(/^mood_\d+_[a-z0-9]+$/)
      expect(id2).toMatch(/^mood_\d+_[a-z0-9]+$/)
    })

    it('should generate and persist session ID', () => {
      // Clear any existing session ID
      localStorage.removeItem('moodspot_session_id')

      const sessionId1 = moodAnalysisService.getSessionId()
      const sessionId2 = moodAnalysisService.getSessionId()

      expect(sessionId1).toBe(sessionId2) // Should be the same
      expect(sessionId1).toMatch(/^session_\d+_[a-z0-9]+$/)
    })
  })
})