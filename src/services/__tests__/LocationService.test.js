import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { LocationService } from '../LocationService.js'

// Mock dependencies
vi.mock('../RateLimiter.js', () => ({
  default: {
    checkQuota: vi.fn().mockReturnValue(true),
    incrementUsage: vi.fn()
  }
}))

vi.mock('../LocalStorageManager.js', () => ({
  default: {
    saveRecommendations: vi.fn().mockResolvedValue(true),
    getRecommendations: vi.fn().mockResolvedValue([])
  }
}))

// Mock environment variables
vi.mock('../../config/environment.js', () => ({
  getApiKey: vi.fn().mockReturnValue('test-api-key')
}))

describe('LocationService', () => {
  let locationService
  let mockGeolocation
  let mockFetch

  beforeEach(() => {
    locationService = new LocationService()
    
    // Mock geolocation
    mockGeolocation = {
      getCurrentPosition: vi.fn(),
      watchPosition: vi.fn(),
      clearWatch: vi.fn()
    }
    
    Object.defineProperty(global.navigator, 'geolocation', {
      value: mockGeolocation,
      writable: true
    })

    // Mock permissions API
    Object.defineProperty(global.navigator, 'permissions', {
      value: {
        query: vi.fn().mockResolvedValue({ state: 'granted' })
      },
      writable: true
    })

    // Mock fetch
    mockFetch = vi.fn()
    global.fetch = mockFetch

    // Mock import.meta.env
    vi.stubGlobal('import.meta', {
      env: {
        VITE_GOOGLE_PLACES_API_KEY: 'test-google-api-key'
      }
    })
  })

  afterEach(() => {
    vi.clearAllMocks()
    vi.unstubAllGlobals()
  })

  describe('getCurrentLocation', () => {
    it('should get current location successfully', async () => {
      const mockPosition = {
        coords: {
          latitude: 37.7749,
          longitude: -122.4194
        },
        timestamp: Date.now()
      }

      mockGeolocation.getCurrentPosition.mockImplementation((success) => {
        success(mockPosition)
      })

      const result = await locationService.getCurrentLocation()
      expect(result).toEqual(mockPosition)
      expect(mockGeolocation.getCurrentPosition).toHaveBeenCalledWith(
        expect.any(Function),
        expect.any(Function),
        expect.any(Object)
      )
    })

    it('should handle geolocation errors', async () => {
      const mockError = {
        code: 1, // PERMISSION_DENIED
        message: 'Permission denied',
        PERMISSION_DENIED: 1
      }

      mockGeolocation.getCurrentPosition.mockImplementation((success, error) => {
        error(mockError)
      })

      await expect(locationService.getCurrentLocation()).rejects.toThrow('Location access denied by user')
    })

    it('should return cached location if valid', async () => {
      const mockPosition = {
        coords: {
          latitude: 37.7749,
          longitude: -122.4194
        },
        timestamp: Date.now()
      }

      // Set cached location
      locationService.cachedLocation = {
        position: mockPosition,
        timestamp: Date.now()
      }

      const result = await locationService.getCurrentLocation()
      expect(result).toEqual(mockPosition)
      expect(mockGeolocation.getCurrentPosition).not.toHaveBeenCalled()
    })

    it('should handle unsupported geolocation', async () => {
      Object.defineProperty(global.navigator, 'geolocation', {
        value: undefined,
        writable: true
      })

      await expect(locationService.getCurrentLocation()).rejects.toThrow('Geolocation is not supported by this browser')
    })
  })

  describe('searchNearbyBusinesses', () => {
    const mockLocation = {
      latitude: 37.7749,
      longitude: -122.4194
    }

    const mockCategories = ['restaurant', 'cafe']

    it('should search nearby businesses successfully', async () => {
      const mockApiResponse = {
        status: 'OK',
        results: [
          {
            place_id: 'place1',
            name: 'Test Restaurant',
            rating: 4.5,
            geometry: {
              location: {
                lat: 37.7750,
                lng: -122.4195
              }
            },
            vicinity: '123 Test St',
            opening_hours: {
              open_now: true
            },
            price_level: 2,
            photos: [{ photo_reference: 'photo1' }],
            user_ratings_total: 100
          }
        ]
      }

      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockApiResponse)
      })

      const result = await locationService.searchNearbyBusinesses(mockLocation, mockCategories)

      expect(result).toHaveLength(1)
      expect(result[0]).toMatchObject({
        placeId: 'place1',
        name: 'Test Restaurant',
        rating: 4.5,
        category: 'restaurant',
        address: '123 Test St',
        isOpen: true
      })
      expect(mockFetch).toHaveBeenCalled()
    })

    it('should handle API quota exceeded', async () => {
      locationService.rateLimiter.checkQuota = vi.fn().mockReturnValue(false)
      
      const result = await locationService.searchNearbyBusinesses(mockLocation, mockCategories)
      
      // Should return generic recommendations as fallback
      expect(result).toHaveLength(3)
      expect(result[0].name).toBe('Local Coffee Shop')
      expect(mockFetch).not.toHaveBeenCalled()
    })

    it('should handle API errors gracefully', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 400
      })

      const result = await locationService.searchNearbyBusinesses(mockLocation, mockCategories)
      
      // Should return generic recommendations as fallback
      expect(result).toHaveLength(3)
      expect(result[0].name).toBe('Local Coffee Shop')
    })

    it('should return cached results when available', async () => {
      const cacheKey = `${mockLocation.latitude},${mockLocation.longitude}-${mockCategories.join(',')}`
      const cachedRecommendations = [
        {
          placeId: 'cached1',
          name: 'Cached Restaurant',
          rating: 4.0
        }
      ]

      locationService.cachedRecommendations.set(cacheKey, {
        recommendations: cachedRecommendations,
        timestamp: Date.now()
      })

      const result = await locationService.searchNearbyBusinesses(mockLocation, mockCategories)
      
      expect(result).toEqual(cachedRecommendations)
      expect(mockFetch).not.toHaveBeenCalled()
    })

    it('should handle missing API key', async () => {
      locationService.apiKey = null

      const result = await locationService.searchNearbyBusinesses(mockLocation, mockCategories)
      
      // Should return generic recommendations as fallback when API key is missing
      expect(result).toHaveLength(3)
      expect(result[0].name).toBe('Local Coffee Shop')
    })
  })

  describe('getCategoriesForMood', () => {
    it('should return correct categories for known moods', () => {
      expect(locationService.getCategoriesForMood('happy')).toEqual([
        'restaurant', 'amusement_park', 'shopping_mall', 'cafe'
      ])
      
      expect(locationService.getCategoriesForMood('sad')).toEqual([
        'cafe', 'bookstore', 'spa', 'park'
      ])
    })

    it('should return default categories for unknown moods', () => {
      expect(locationService.getCategoriesForMood('unknown')).toEqual([
        'restaurant', 'cafe', 'park', 'shopping_mall'
      ])
    })

    it('should handle case insensitive mood matching', () => {
      expect(locationService.getCategoriesForMood('HAPPY')).toEqual([
        'restaurant', 'amusement_park', 'shopping_mall', 'cafe'
      ])
    })
  })

  describe('requestLocationPermission', () => {
    it('should return true for granted permission', async () => {
      const result = await locationService.requestLocationPermission()
      expect(result).toBe(true)
    })

    it('should return false for denied permission', async () => {
      navigator.permissions.query.mockResolvedValue({ state: 'denied' })
      
      const result = await locationService.requestLocationPermission()
      expect(result).toBe(false)
    })

    it('should handle missing permissions API', async () => {
      Object.defineProperty(global.navigator, 'permissions', {
        value: undefined,
        writable: true
      })

      mockGeolocation.getCurrentPosition.mockImplementation((success) => {
        success({
          coords: { latitude: 37.7749, longitude: -122.4194 },
          timestamp: Date.now()
        })
      })

      const result = await locationService.requestLocationPermission()
      expect(result).toBe(true)
    })
  })

  describe('calculateDistance', () => {
    it('should calculate distance between coordinates', () => {
      const distance = locationService.calculateDistance(
        37.7749, -122.4194, // San Francisco
        37.7849, -122.4094  // Nearby point
      )
      
      expect(distance).toBeGreaterThan(0)
      expect(typeof distance).toBe('number')
    })

    it('should return 0 for same coordinates', () => {
      const distance = locationService.calculateDistance(
        37.7749, -122.4194,
        37.7749, -122.4194
      )
      
      expect(distance).toBe(0)
    })
  })

  describe('deduplicateAndSort', () => {
    it('should remove duplicates and sort by rating and distance', () => {
      const recommendations = [
        { placeId: '1', rating: 4.0, distance: 100 },
        { placeId: '2', rating: 4.5, distance: 200 },
        { placeId: '1', rating: 4.2, distance: 150 }, // Duplicate with better rating
        { placeId: '3', rating: 4.5, distance: 50 }
      ]

      const result = locationService.deduplicateAndSort(recommendations)
      
      expect(result).toHaveLength(3)
      expect(result[0].placeId).toBe('3') // Best rating and closest
      expect(result[1].placeId).toBe('2') // Same rating as #3 but farther
      expect(result[2].placeId).toBe('1') // Lower rating, should use better duplicate
      expect(result[2].rating).toBe(4.2) // Should use the better rating
    })
  })

  describe('cacheRecommendations', () => {
    it('should cache recommendations with timestamp', () => {
      const key = 'test-key'
      const recommendations = [{ placeId: '1', name: 'Test' }]
      
      locationService.cacheRecommendations(key, recommendations)
      
      expect(locationService.cachedRecommendations.has(key)).toBe(true)
      const cached = locationService.cachedRecommendations.get(key)
      expect(cached.recommendations).toEqual(recommendations)
      expect(cached.timestamp).toBeTypeOf('number')
    })

    it('should limit cache size', () => {
      // Fill cache beyond limit
      for (let i = 0; i < 55; i++) {
        locationService.cacheRecommendations(`key-${i}`, [])
      }
      
      expect(locationService.cachedRecommendations.size).toBeLessThanOrEqual(50)
    })
  })

  describe('clearCache', () => {
    it('should clear all cached data', () => {
      locationService.cachedLocation = { test: 'data' }
      locationService.cachedRecommendations.set('key', { test: 'data' })
      
      locationService.clearCache()
      
      expect(locationService.cachedLocation).toBeNull()
      expect(locationService.cachedRecommendations.size).toBe(0)
    })
  })

  describe('getGenericRecommendations', () => {
    it('should return generic recommendations', () => {
      const result = locationService.getGenericRecommendations()
      
      expect(result).toHaveLength(3)
      expect(result[0]).toMatchObject({
        placeId: 'generic-1',
        name: 'Local Coffee Shop',
        category: 'cafe'
      })
    })
  })
})