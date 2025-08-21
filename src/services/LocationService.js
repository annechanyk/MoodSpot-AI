import rateLimiter from './RateLimiter.js';
import localStorageManager from './LocalStorageManager.js';

/**
 * LocationService handles geolocation and Google Places API integration
 * with rate limiting and caching for offline access
 */
export class LocationService {
  constructor() {
    this.rateLimiter = rateLimiter;
    this.storageManager = localStorageManager;
    this.apiKey = import.meta.env.VITE_GOOGLE_PLACES_API_KEY;
    this.cachedLocation = null;
    this.cachedRecommendations = new Map();
    
    // Mood to business category mapping
    this.moodCategoryMap = {
      happy: ['restaurant', 'amusement_park', 'shopping_mall', 'cafe'],
      sad: ['cafe', 'bookstore', 'spa', 'park'],
      anxious: ['spa', 'park', 'gym', 'library'],
      angry: ['gym', 'park', 'sports_complex'],
      excited: ['amusement_park', 'shopping_mall', 'restaurant', 'movie_theater'],
      calm: ['park', 'library', 'spa', 'cafe'],
      energetic: ['gym', 'sports_complex', 'amusement_park'],
      lonely: ['cafe', 'restaurant', 'shopping_mall', 'community_center'],
      creative: ['art_gallery', 'bookstore', 'cafe', 'museum'],
      tired: ['spa', 'cafe', 'park'],
      default: ['restaurant', 'cafe', 'park', 'shopping_mall']
    };
  }

  /**
   * Get user's current location with comprehensive error handling
   * @returns {Promise<GeolocationPosition>}
   */
  async getCurrentLocation() {
    console.log('📍 LOCATION: Starting getCurrentLocation...')
    
    return new Promise((resolve, reject) => {
      // Check if geolocation is supported
      if (!navigator.geolocation) {
        console.error('❌ LOCATION: Geolocation not supported by browser')
        reject(new Error('Geolocation is not supported by this browser. Please enable location services or enter your location manually.'));
        return;
      }

      console.log('✅ LOCATION: Geolocation API is available')

      // Check for cached location (valid for 10 minutes)
      if (this.cachedLocation && 
          Date.now() - this.cachedLocation.timestamp < 10 * 60 * 1000) {
        console.log('📍 LOCATION: Using cached location')
        resolve(this.cachedLocation.position);
        return;
      }

      console.log('🔍 LOCATION: Requesting fresh location...')

      const options = {
        enableHighAccuracy: true,
        timeout: 15000, // Increased timeout
        maximumAge: 300000 // 5 minutes
      };

      console.log('⚙️ LOCATION: Geolocation options:', options)

      navigator.geolocation.getCurrentPosition(
        (position) => {
          console.log('✅ LOCATION: Successfully obtained location:', {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy
          })
          
          // Cache the location
          this.cachedLocation = {
            position,
            timestamp: Date.now()
          };
          resolve(position);
        },
        (error) => {
          console.error('❌ LOCATION: Geolocation error:', error)
          console.error('❌ LOCATION: Error code:', error.code)
          console.error('❌ LOCATION: Error message:', error.message)
          
          let errorMessage;
          let userFriendlyMessage;
          
          switch (error.code) {
            case error.PERMISSION_DENIED:
              errorMessage = 'Location access denied by user';
              userFriendlyMessage = 'Location access was denied. Please enable location permissions in your browser settings or enter your location manually.';
              console.error('❌ LOCATION: Permission denied')
              break;
            case error.POSITION_UNAVAILABLE:
              errorMessage = 'Location information unavailable';
              userFriendlyMessage = 'Your location could not be determined. Please check your GPS settings or enter your location manually.';
              console.error('❌ LOCATION: Position unavailable')
              break;
            case error.TIMEOUT:
              errorMessage = 'Location request timed out';
              userFriendlyMessage = 'Location request timed out. Please try again or enter your location manually.';
              console.error('❌ LOCATION: Request timeout')
              break;
            default:
              errorMessage = 'An unknown error occurred while retrieving location';
              userFriendlyMessage = 'Unable to get your location. Please try again or enter your location manually.';
              console.error('❌ LOCATION: Unknown error')
              break;
          }
          
          const enhancedError = new Error(userFriendlyMessage);
          enhancedError.code = error.code;
          enhancedError.originalMessage = errorMessage;
          reject(enhancedError);
        },
        options
      );
    });
  }

  /**
   * Search for nearby businesses based on location and mood categories
   * @param {Coordinates} location - User's coordinates
   * @param {string[]} moodCategories - Business categories based on mood
   * @param {number} radius - Search radius in meters (default: 5000)
   * @returns {Promise<BusinessRecommendation[]>}
   */
  async searchNearbyBusinesses(location, moodCategories, radius = 5000) {
    // Check rate limiting for Google Places API
    if (!this.rateLimiter.checkQuota('googlePlaces')) {
      console.warn('Google Places API quota exceeded');
      return this.getCachedRecommendations(location, moodCategories);
    }

    if (!this.apiKey) {
      throw new Error('Google Places API key not configured');
    }

    const cacheKey = `${location.latitude},${location.longitude}-${moodCategories.join(',')}`;
    
    // Check for cached recommendations (valid for 1 hour)
    if (this.cachedRecommendations.has(cacheKey)) {
      const cached = this.cachedRecommendations.get(cacheKey);
      if (Date.now() - cached.timestamp < 60 * 60 * 1000) {
        return cached.recommendations;
      }
    }

    try {
      const allRecommendations = [];

      // Search for each category
      for (const category of moodCategories) {
        const recommendations = await this.searchByCategory(location, category, radius);
        allRecommendations.push(...recommendations);
      }

      // Remove duplicates and sort by rating and distance
      const uniqueRecommendations = this.deduplicateAndSort(allRecommendations);
      
      // Cache the results
      this.cacheRecommendations(cacheKey, uniqueRecommendations);
      
      // Store in local storage for offline access
      await this.storageManager.saveRecommendations(cacheKey, uniqueRecommendations);

      // Increment rate limiter
      this.rateLimiter.incrementUsage('googlePlaces');

      return uniqueRecommendations.slice(0, 10); // Return top 10 results
    } catch (error) {
      console.error('Error searching nearby businesses:', error);
      // Return cached recommendations as fallback
      return this.getCachedRecommendations(location, moodCategories);
    }
  }

  /**
   * Search businesses by specific category using Google Places API
   * @private
   */
  async searchByCategory(location, category, radius) {
    const url = new URL('https://maps.googleapis.com/maps/api/place/nearbysearch/json');
    url.searchParams.append('location', `${location.latitude},${location.longitude}`);
    url.searchParams.append('radius', radius.toString());
    url.searchParams.append('type', category);
    url.searchParams.append('key', this.apiKey);

    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`Google Places API error: ${response.status}`);
    }

    const data = await response.json();
    
    if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
      throw new Error(`Google Places API error: ${data.status}`);
    }

    return data.results.map(place => ({
      placeId: place.place_id,
      name: place.name,
      rating: place.rating || 0,
      distance: this.calculateDistance(
        location.latitude,
        location.longitude,
        place.geometry.location.lat,
        place.geometry.location.lng
      ),
      category: category,
      address: place.vicinity || place.formatted_address || 'Address not available',
      isOpen: place.opening_hours?.open_now ?? null,
      priceLevel: place.price_level,
      photoReference: place.photos?.[0]?.photo_reference,
      userRatingsTotal: place.user_ratings_total || 0
    }));
  }

  /**
   * Get business categories based on detected mood
   * @param {string} mood - Primary detected mood
   * @returns {string[]} Array of business categories
   */
  getCategoriesForMood(mood) {
    const normalizedMood = mood.toLowerCase();
    return this.moodCategoryMap[normalizedMood] || this.moodCategoryMap.default;
  }

  /**
   * Cache recommendations in memory
   * @private
   */
  cacheRecommendations(key, recommendations) {
    this.cachedRecommendations.set(key, {
      recommendations,
      timestamp: Date.now()
    });

    // Limit cache size to prevent memory issues
    if (this.cachedRecommendations.size > 50) {
      const oldestKey = this.cachedRecommendations.keys().next().value;
      this.cachedRecommendations.delete(oldestKey);
    }
  }

  /**
   * Get cached recommendations for offline access
   * @param {Coordinates} location 
   * @param {string[]} moodCategories 
   * @returns {Promise<BusinessRecommendation[]>}
   */
  async getCachedRecommendations(location, moodCategories) {
    try {
      const cacheKey = `${location.latitude},${location.longitude}-${moodCategories.join(',')}`;
      
      // Try memory cache first
      if (this.cachedRecommendations.has(cacheKey)) {
        return this.cachedRecommendations.get(cacheKey).recommendations;
      }

      // Try local storage
      const cached = await this.storageManager.getRecommendations(cacheKey);
      if (cached && cached.length > 0) {
        return cached;
      }

      // Return generic recommendations if no cache available
      return this.getGenericRecommendations();
    } catch (error) {
      console.error('Error getting cached recommendations:', error);
      return this.getGenericRecommendations();
    }
  }

  /**
   * Get generic recommendations when no location or cache is available
   * @private
   */
  getGenericRecommendations() {
    return [
      {
        placeId: 'generic-1',
        name: 'Local Coffee Shop',
        rating: 4.0,
        distance: 0,
        category: 'cafe',
        address: 'Nearby location',
        isOpen: null
      },
      {
        placeId: 'generic-2',
        name: 'Community Park',
        rating: 4.2,
        distance: 0,
        category: 'park',
        address: 'Nearby location',
        isOpen: true
      },
      {
        placeId: 'generic-3',
        name: 'Local Restaurant',
        rating: 4.1,
        distance: 0,
        category: 'restaurant',
        address: 'Nearby location',
        isOpen: null
      }
    ];
  }

  /**
   * Remove duplicate recommendations and sort by rating and distance
   * @private
   */
  deduplicateAndSort(recommendations) {
    const uniqueMap = new Map();
    
    recommendations.forEach(rec => {
      if (!uniqueMap.has(rec.placeId) || 
          uniqueMap.get(rec.placeId).rating < rec.rating) {
        uniqueMap.set(rec.placeId, rec);
      }
    });

    return Array.from(uniqueMap.values()).sort((a, b) => {
      // Sort by rating first (descending), then by distance (ascending)
      if (Math.abs(a.rating - b.rating) > 0.1) {
        return b.rating - a.rating;
      }
      return a.distance - b.distance;
    });
  }

  /**
   * Calculate distance between two coordinates using Haversine formula
   * @private
   */
  calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371e3; // Earth's radius in meters
    const φ1 = lat1 * Math.PI / 180;
    const φ2 = lat2 * Math.PI / 180;
    const Δφ = (lat2 - lat1) * Math.PI / 180;
    const Δλ = (lon2 - lon1) * Math.PI / 180;

    const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return Math.round(R * c); // Distance in meters
  }

  /**
   * Request location permission with user-friendly messaging
   * @returns {Promise<boolean>}
   */
  async requestLocationPermission() {
    try {
      if (!navigator.permissions) {
        // Fallback: try to get location directly
        await this.getCurrentLocation();
        return true;
      }

      const permission = await navigator.permissions.query({ name: 'geolocation' });
      
      if (permission.state === 'granted') {
        return true;
      } else if (permission.state === 'prompt') {
        // Permission will be requested when getCurrentLocation is called
        return true;
      } else {
        return false;
      }
    } catch (error) {
      console.error('Error checking location permission:', error);
      return false;
    }
  }

  /**
   * Get location from address using geocoding (fallback method)
   * @param {string} address - Address to geocode
   * @returns {Promise<{latitude: number, longitude: number}>}
   */
  async getLocationFromAddress(address) {
    console.log('🗺️ LOCATION: Geocoding address:', address)
    
    if (!this.apiKey) {
      throw new Error('Google Places API key not configured for geocoding');
    }

    try {
      const url = new URL('https://maps.googleapis.com/maps/api/geocode/json');
      url.searchParams.append('address', address);
      url.searchParams.append('key', this.apiKey);

      console.log('🌐 LOCATION: Making geocoding request...')
      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error(`Geocoding API error: ${response.status}`);
      }

      const data = await response.json();
      console.log('📍 LOCATION: Geocoding response:', data)
      
      if (data.status !== 'OK' || !data.results || data.results.length === 0) {
        throw new Error(`Could not find location for: ${address}`);
      }

      const location = data.results[0].geometry.location;
      console.log('✅ LOCATION: Geocoded successfully:', location)
      
      return {
        latitude: location.lat,
        longitude: location.lng
      };
    } catch (error) {
      console.error('❌ LOCATION: Geocoding failed:', error)
      throw error;
    }
  }

  /**
   * Get location with fallback options
   * @param {string} fallbackAddress - Optional address to use if GPS fails
   * @returns {Promise<{latitude: number, longitude: number, source: string}>}
   */
  async getLocationWithFallback(fallbackAddress = null) {
    console.log('📍 LOCATION: Getting location with fallback options...')
    
    try {
      // Try GPS first
      console.log('🛰️ LOCATION: Attempting GPS location...')
      const position = await this.getCurrentLocation();
      console.log('✅ LOCATION: GPS successful')
      
      return {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        accuracy: position.coords.accuracy,
        source: 'gps'
      };
    } catch (gpsError) {
      console.warn('⚠️ LOCATION: GPS failed, trying fallback options:', gpsError.message)
      
      if (fallbackAddress) {
        try {
          console.log('🗺️ LOCATION: Trying geocoding fallback...')
          const geocoded = await this.getLocationFromAddress(fallbackAddress);
          console.log('✅ LOCATION: Geocoding successful')
          
          return {
            ...geocoded,
            source: 'geocoded'
          };
        } catch (geocodeError) {
          console.error('❌ LOCATION: Geocoding also failed:', geocodeError.message)
        }
      }
      
      // Final fallback - throw the original GPS error with suggestions
      const fallbackError = new Error(
        `Location unavailable: ${gpsError.message} Please enable location services or try entering a city name.`
      );
      fallbackError.originalError = gpsError;
      throw fallbackError;
    }
  }

  /**
   * Check API key configuration
   * @returns {boolean}
   */
  isApiKeyConfigured() {
    const hasKey = !!this.apiKey;
    console.log('🔑 LOCATION: API key configured:', hasKey)
    return hasKey;
  }

  /**
   * Clear all cached data
   */
  clearCache() {
    console.log('🧹 LOCATION: Clearing cache')
    this.cachedLocation = null;
    this.cachedRecommendations.clear();
  }
}