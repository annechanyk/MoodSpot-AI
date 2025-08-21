/**
 * useLocationService Hook
 * React hook for managing location services and business recommendations
 */

import { useState, useEffect, useCallback } from 'react'
import { LocationService } from '../services/LocationService.js'

/**
 * Custom hook for location services
 * @returns {Object} Location service state and methods
 */
export function useLocationService() {
  const [locationService] = useState(() => new LocationService())
  const [location, setLocation] = useState(null)
  const [locationError, setLocationError] = useState(null)
  const [locationLoading, setLocationLoading] = useState(false)
  const [hasLocationPermission, setHasLocationPermission] = useState(null)
  const [recommendations, setRecommendations] = useState([])
  const [recommendationsLoading, setRecommendationsLoading] = useState(false)
  const [recommendationsError, setRecommendationsError] = useState(null)

  /**
   * Request location permission
   */
  const requestLocationPermission = useCallback(async () => {
    try {
      const permission = await locationService.requestLocationPermission()
      setHasLocationPermission(permission)
      return permission
    } catch (error) {
      console.error('Error requesting location permission:', error)
      setHasLocationPermission(false)
      return false
    }
  }, [locationService])

  /**
   * Get current location with enhanced error handling
   */
  const getCurrentLocation = useCallback(async (fallbackAddress = null) => {
    console.log('🎯 HOOK: Getting current location...', { fallbackAddress })
    setLocationLoading(true)
    setLocationError(null)

    try {
      const locationData = await locationService.getLocationWithFallback(fallbackAddress)
      console.log('✅ HOOK: Location obtained:', locationData)
      
      const formattedLocation = {
        latitude: locationData.latitude,
        longitude: locationData.longitude,
        accuracy: locationData.accuracy || null,
        source: locationData.source,
        timestamp: Date.now()
      }
      
      setLocation(formattedLocation)
      return formattedLocation
    } catch (error) {
      console.error('❌ HOOK: Error getting location:', error)
      setLocationError(error.message)
      return null
    } finally {
      setLocationLoading(false)
    }
  }, [locationService])

  /**
   * Get location from address (manual input)
   */
  const getLocationFromAddress = useCallback(async (address) => {
    console.log('🏠 HOOK: Getting location from address:', address)
    setLocationLoading(true)
    setLocationError(null)

    try {
      const locationData = await locationService.getLocationFromAddress(address)
      console.log('✅ HOOK: Address geocoded:', locationData)
      
      const formattedLocation = {
        latitude: locationData.latitude,
        longitude: locationData.longitude,
        source: 'manual',
        address: address,
        timestamp: Date.now()
      }
      
      setLocation(formattedLocation)
      return formattedLocation
    } catch (error) {
      console.error('❌ HOOK: Error geocoding address:', error)
      setLocationError(error.message)
      return null
    } finally {
      setLocationLoading(false)
    }
  }, [locationService])

  /**
   * Search for nearby businesses based on mood
   */
  const searchNearbyBusinesses = useCallback(async (mood, customLocation = null, radius = 5000) => {
    setRecommendationsLoading(true)
    setRecommendationsError(null)

    try {
      // Use provided location or current location
      const searchLocation = customLocation || location
      
      if (!searchLocation) {
        throw new Error('Location is required for business search')
      }

      // Get categories for the mood
      const categories = locationService.getCategoriesForMood(mood)
      
      // Search for businesses
      const results = await locationService.searchNearbyBusinesses(
        searchLocation,
        categories,
        radius
      )
      
      setRecommendations(results)
      return results
    } catch (error) {
      console.error('Error searching businesses:', error)
      setRecommendationsError(error.message)
      return []
    } finally {
      setRecommendationsLoading(false)
    }
  }, [locationService, location])

  /**
   * Get business categories for a mood
   */
  const getCategoriesForMood = useCallback((mood) => {
    return locationService.getCategoriesForMood(mood)
  }, [locationService])

  /**
   * Clear all cached data
   */
  const clearCache = useCallback(() => {
    locationService.clearCache()
    setRecommendations([])
  }, [locationService])

  /**
   * Calculate distance between two points
   */
  const calculateDistance = useCallback((lat1, lon1, lat2, lon2) => {
    return locationService.calculateDistance(lat1, lon1, lat2, lon2)
  }, [locationService])

  // Check location permission on mount
  useEffect(() => {
    requestLocationPermission()
  }, [requestLocationPermission])

  return {
    // Location state
    location,
    locationError,
    locationLoading,
    hasLocationPermission,
    
    // Recommendations state
    recommendations,
    recommendationsLoading,
    recommendationsError,
    
    // Methods
    requestLocationPermission,
    getCurrentLocation,
    getLocationFromAddress,
    searchNearbyBusinesses,
    getCategoriesForMood,
    clearCache,
    calculateDistance,
    
    // Service instance (for advanced usage)
    locationService
  }
}

/**
 * Hook for getting location with automatic retry
 */
export function useLocation(autoRequest = true) {
  const [location, setLocation] = useState(null)
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)
  const [locationService] = useState(() => new LocationService())

  const getLocation = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const position = await locationService.getCurrentLocation()
      const locationData = {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        accuracy: position.coords.accuracy,
        timestamp: position.timestamp
      }
      setLocation(locationData)
      return locationData
    } catch (err) {
      setError(err.message)
      return null
    } finally {
      setLoading(false)
    }
  }, [locationService])

  useEffect(() => {
    if (autoRequest) {
      getLocation()
    }
  }, [autoRequest, getLocation])

  return {
    location,
    error,
    loading,
    getLocation,
    retry: getLocation
  }
}

/**
 * Hook for business recommendations based on mood
 */
export function useBusinessRecommendations(mood, location, radius = 5000) {
  const [recommendations, setRecommendations] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [locationService] = useState(() => new LocationService())

  const searchBusinesses = useCallback(async () => {
    if (!mood || !location) return

    setLoading(true)
    setError(null)

    try {
      const categories = locationService.getCategoriesForMood(mood)
      const results = await locationService.searchNearbyBusinesses(
        location,
        categories,
        radius
      )
      setRecommendations(results)
    } catch (err) {
      setError(err.message)
      setRecommendations([])
    } finally {
      setLoading(false)
    }
  }, [mood, location, radius, locationService])

  useEffect(() => {
    searchBusinesses()
  }, [searchBusinesses])

  return {
    recommendations,
    loading,
    error,
    refresh: searchBusinesses
  }
}

export default useLocationService