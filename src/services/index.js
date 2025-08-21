/**
 * Services Index
 * Central export point for all services and initialization
 */

import rateLimiter from './RateLimiter.js'
import localStorageManager from './LocalStorageManager.js'
import moodAnalysisService from './MoodAnalysisService.js'
import MoodAdviceService from './MoodAdviceService.js'
import tidbService from './TiDBAPIService.js'
import { validateApiKeys, logConfigStatus } from '../config/environment.js'

/**
 * Initialize all core services
 */
export async function initializeServices() {
  try {
    console.log('🚀 Initializing MoodSpot services...')
    
    // Log configuration status in development
    logConfigStatus()
    
    // Validate API keys
    const hasValidKeys = validateApiKeys()
    if (!hasValidKeys) {
      console.warn('⚠️ Some API keys are missing. App will run with limited functionality.')
    }
    
    // Initialize rate limiter
    await rateLimiter.initialize()
    console.log('✅ Rate limiter initialized')
    
    // Initialize local storage manager
    await localStorageManager.initialize()
    console.log('✅ Local storage manager initialized')
    
    // Initialize mood analysis service
    await moodAnalysisService.initialize()
    console.log('✅ Mood analysis service initialized')
    
    // Initialize mood advice service
    const moodAdviceService = new MoodAdviceService()
    console.log('✅ Mood advice service initialized')
    
    // Initialize TiDB service (deferred to not block app startup)
    let tidbConnected = false
    console.log('🔄 TiDB service will initialize in background...')
    
    // Defer TiDB connection to not block app startup
    setTimeout(async () => {
      try {
        tidbConnected = await tidbService.connect()
        console.log('✅ TiDB service initialized successfully')
      } catch (error) {
        console.warn('⚠️ TiDB connection failed, continuing without database:', error.message)
      }
    }, 1000) // 1 second delay
    
    // Get current quota status
    const quotas = await rateLimiter.getAllQuotas()
    console.log('📊 Current API quotas:', {
      openai: `${quotas.openai.used}/${quotas.openai.limit}`,
      database: `${quotas.database.used}/${quotas.database.limit}`
    })
    
    // Schedule daily cleanup
    scheduleCleanup()
    
    console.log('🎉 All services initialized successfully')
    
    return {
      rateLimiter,
      localStorageManager,
      moodAnalysisService,
      moodAdviceService,
      tidbService,
      tidbConnected,
      hasValidApiKeys: hasValidKeys,
      quotas
    }
    
  } catch (error) {
    console.error('❌ Failed to initialize services:', error)
    throw error
  }
}

/**
 * Schedule periodic cleanup of old data
 */
function scheduleCleanup() {
  // Run cleanup once per day
  const CLEANUP_INTERVAL = 24 * 60 * 60 * 1000 // 24 hours
  
  setInterval(async () => {
    try {
      console.log('🧹 Running scheduled data cleanup...')
      await localStorageManager.clearOldData(30) // Keep 30 days of data
      console.log('✅ Data cleanup completed')
    } catch (error) {
      console.error('❌ Data cleanup failed:', error)
    }
  }, CLEANUP_INTERVAL)
}

/**
 * Get service health status
 */
export async function getServiceHealth() {
  try {
    const quotas = await rateLimiter.getAllQuotas()
    const dbHealth = await checkDatabaseHealth()
    
    return {
      status: 'healthy',
      services: {
        rateLimiter: {
          status: 'healthy',
          quotas
        },
        database: {
          status: dbHealth ? 'healthy' : 'degraded',
          available: dbHealth
        }
      },
      timestamp: new Date().toISOString()
    }
  } catch (error) {
    return {
      status: 'unhealthy',
      error: error.message,
      timestamp: new Date().toISOString()
    }
  }
}

/**
 * Check database health
 */
async function checkDatabaseHealth() {
  try {
    await localStorageManager.initialize()
    return true
  } catch (error) {
    console.error('Database health check failed:', error)
    return false
  }
}

/**
 * Emergency reset all services (for debugging)
 */
export async function emergencyReset() {
  try {
    console.log('🚨 Emergency reset initiated...')
    
    // Reset rate limiter
    await rateLimiter.forceReset()
    
    // Clear all local storage
    localStorage.clear()
    
    // Reinitialize services
    await initializeServices()
    
    console.log('✅ Emergency reset completed')
    return true
  } catch (error) {
    console.error('❌ Emergency reset failed:', error)
    return false
  }
}

// Export services for direct access
export { rateLimiter, localStorageManager, moodAnalysisService, tidbService }
export { MoodAdviceService }