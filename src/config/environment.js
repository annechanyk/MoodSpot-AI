/**
 * Environment Configuration
 * Manages API keys, limits, and environment-specific settings
 */

// API Rate Limits (daily)
export const API_LIMITS = {
  OPENAI_DAILY_LIMIT: 50,
  GOOGLE_PLACES_DAILY_LIMIT: 250,
  DATABASE_DAILY_LIMIT: 1000
}

// API Configuration
export const API_CONFIG = {
  OPENAI: {
    BASE_URL: 'https://api.openai.com/v1',
    MODEL: 'gpt-4o-mini',
    MAX_TOKENS: 600,
    TEMPERATURE: 0.8
  },
  GOOGLE_PLACES: {
    BASE_URL: 'https://maps.googleapis.com/maps/api/place',
    RADIUS: 5000, // 5km radius for business search
    LANGUAGE: 'en'
  }
}

// Application Configuration
export const APP_CONFIG = {
  SESSION_TIMEOUT: 24 * 60 * 60 * 1000, // 24 hours in milliseconds
  MAX_DRAWING_SIZE: 800, // Max canvas dimension for API optimization
  IMAGE_QUALITY: 0.8, // JPEG quality for canvas export
  CACHE_DURATION: 60 * 60 * 1000, // 1 hour cache duration
  MAX_MOOD_HISTORY: 50, // Maximum mood entries to keep
  CLEANUP_INTERVAL: 7 * 24 * 60 * 60 * 1000 // Weekly cleanup
}

// Mood to Business Category Mapping
export const MOOD_BUSINESS_MAPPING = {
  happy: ['restaurant', 'amusement_park', 'shopping_mall', 'movie_theater', 'park'],
  excited: ['amusement_park', 'night_club', 'bowling_alley', 'movie_theater', 'shopping_mall'],
  calm: ['spa', 'park', 'library', 'cafe', 'museum'],
  peaceful: ['park', 'spa', 'library', 'church', 'museum'],
  anxious: ['spa', 'park', 'cafe', 'gym', 'library'],
  stressed: ['spa', 'gym', 'park', 'cafe', 'massage'],
  sad: ['cafe', 'library', 'park', 'movie_theater', 'restaurant'],
  angry: ['gym', 'park', 'spa', 'bowling_alley', 'massage'],
  tired: ['cafe', 'spa', 'park', 'restaurant', 'massage'],
  energetic: ['gym', 'amusement_park', 'shopping_mall', 'bowling_alley', 'park'],
  creative: ['art_gallery', 'museum', 'library', 'cafe', 'bookstore'],
  social: ['restaurant', 'bar', 'movie_theater', 'shopping_mall', 'cafe'],
  contemplative: ['library', 'museum', 'park', 'cafe', 'church'],
  playful: ['amusement_park', 'bowling_alley', 'arcade', 'park', 'movie_theater']
}

// Default business categories (fallback)
export const DEFAULT_BUSINESS_CATEGORIES = [
  'restaurant', 'cafe', 'park', 'shopping_mall', 'movie_theater'
]

/**
 * Get API key from environment variables
 * In production, these should be set as environment variables
 * For development, you can create a .env file
 */
export function getApiKey(service) {
  switch (service) {
    case 'openai':
      return import.meta.env.VITE_OPENAI_API_KEY || process.env.VITE_OPENAI_API_KEY
    case 'googlePlaces':
      return import.meta.env.VITE_GOOGLE_PLACES_API_KEY || process.env.VITE_GOOGLE_PLACES_API_KEY
    default:
      console.error(`Unknown API service: ${service}`)
      return null
  }
}

/**
 * Validate that required API keys are present
 */
export function validateApiKeys() {
  const openaiKey = getApiKey('openai')
  const googleKey = getApiKey('googlePlaces')
  
  const missing = []
  if (!openaiKey) missing.push('VITE_OPENAI_API_KEY')
  if (!googleKey) missing.push('VITE_GOOGLE_PLACES_API_KEY')
  
  if (missing.length > 0) {
    console.warn('Missing API keys:', missing.join(', '))
    console.warn('Please set these environment variables for full functionality')
    return false
  }
  
  return true
}

/**
 * Get business categories for a detected mood
 */
export function getBusinessCategoriesForMood(mood) {
  const normalizedMood = mood.toLowerCase().trim()
  
  // Direct match
  if (MOOD_BUSINESS_MAPPING[normalizedMood]) {
    return MOOD_BUSINESS_MAPPING[normalizedMood]
  }
  
  // Partial match
  for (const [moodKey, categories] of Object.entries(MOOD_BUSINESS_MAPPING)) {
    if (normalizedMood.includes(moodKey) || moodKey.includes(normalizedMood)) {
      return categories
    }
  }
  
  // Fallback to default categories
  return DEFAULT_BUSINESS_CATEGORIES
}

/**
 * Check if running in development mode
 */
export function isDevelopment() {
  return import.meta.env.DEV || process.env.NODE_ENV === 'development'
}

/**
 * Check if running in production mode
 */
export function isProduction() {
  return import.meta.env.PROD || process.env.NODE_ENV === 'production'
}

/**
 * Get current environment name
 */
export function getEnvironment() {
  return import.meta.env.MODE || process.env.NODE_ENV || 'development'
}

/**
 * Log configuration status (for debugging)
 */
export function logConfigStatus() {
  if (isDevelopment()) {
    console.log('🔧 Environment Configuration:')
    console.log('- Environment:', getEnvironment())
    console.log('- OpenAI API Key:', getApiKey('openai') ? '✅ Set' : '❌ Missing')
    console.log('- Google Places API Key:', getApiKey('googlePlaces') ? '✅ Set' : '❌ Missing')
    console.log('- API Limits:', API_LIMITS)
    console.log('- App Config:', APP_CONFIG)
  }
}