/**
 * RateLimiter Service
 * Manages API quotas and prevents exceeding daily limits
 */

const RATE_LIMITS = {
  openai: 50,
  googlePlaces: 250,
  database: 1000
}

const STORAGE_KEY = 'moodspot_quotas'

class RateLimiter {
  constructor() {
    this.quotas = null
    this.initialized = false
  }

  /**
   * Initialize the rate limiter and load existing quotas
   */
  async initialize() {
    if (this.initialized) return
    
    await this.loadQuotas()
    this.checkAndResetDaily()
    this.initialized = true
  }

  /**
   * Load quotas from localStorage
   */
  async loadQuotas() {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored) {
        this.quotas = JSON.parse(stored)
      } else {
        this.quotas = this.createDefaultQuotas()
      }
    } catch (error) {
      console.error('Failed to load quotas:', error)
      this.quotas = this.createDefaultQuotas()
    }
  }

  /**
   * Create default quota structure
   */
  createDefaultQuotas() {
    const today = this.getTodayString()
    return {
      date: today,
      services: {
        openai: { used: 0, limit: RATE_LIMITS.openai },
        googlePlaces: { used: 0, limit: RATE_LIMITS.googlePlaces },
        database: { used: 0, limit: RATE_LIMITS.database }
      },
      resetTime: this.getNextMidnight()
    }
  }

  /**
   * Save quotas to localStorage
   */
  async saveQuotas() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.quotas))
    } catch (error) {
      console.error('Failed to save quotas:', error)
    }
  }

  /**
   * Check if quotas need daily reset
   */
  checkAndResetDaily() {
    const today = this.getTodayString()
    
    if (!this.quotas || this.quotas.date !== today) {
      console.log('Resetting daily quotas for', today)
      this.resetDailyCounters()
    }
  }

  /**
   * Reset all daily counters
   */
  resetDailyCounters() {
    const today = this.getTodayString()
    
    this.quotas = {
      date: today,
      services: {
        openai: { used: 0, limit: RATE_LIMITS.openai },
        googlePlaces: { used: 0, limit: RATE_LIMITS.googlePlaces },
        database: { used: 0, limit: RATE_LIMITS.database }
      },
      resetTime: this.getNextMidnight()
    }
    
    this.saveQuotas()
  }

  /**
   * Check if service has available quota
   * @param {string} service - Service name (openai, googlePlaces, database)
   * @returns {boolean} - True if quota available
   */
  async checkQuota(service) {
    await this.initialize()
    
    if (!this.quotas.services[service]) {
      console.error(`Unknown service: ${service}`)
      return false
    }

    const serviceQuota = this.quotas.services[service]
    return serviceQuota.used < serviceQuota.limit
  }

  /**
   * Increment usage for a service
   * @param {string} service - Service name
   * @returns {boolean} - True if increment successful, false if quota exceeded
   */
  async incrementUsage(service) {
    await this.initialize()
    
    if (!this.quotas.services[service]) {
      console.error(`Unknown service: ${service}`)
      return false
    }

    const serviceQuota = this.quotas.services[service]
    
    if (serviceQuota.used >= serviceQuota.limit) {
      console.warn(`Quota exceeded for ${service}: ${serviceQuota.used}/${serviceQuota.limit}`)
      return false
    }

    serviceQuota.used += 1
    await this.saveQuotas()
    
    console.log(`${service} usage: ${serviceQuota.used}/${serviceQuota.limit}`)
    return true
  }

  /**
   * Get remaining quota for a service
   * @param {string} service - Service name
   * @returns {number} - Remaining quota count
   */
  async getRemainingQuota(service) {
    await this.initialize()
    
    if (!this.quotas.services[service]) {
      return 0
    }

    const serviceQuota = this.quotas.services[service]
    return Math.max(0, serviceQuota.limit - serviceQuota.used)
  }

  /**
   * Get all quota information
   * @returns {object} - Complete quota status
   */
  async getAllQuotas() {
    await this.initialize()
    
    const result = {}
    for (const [service, quota] of Object.entries(this.quotas.services)) {
      result[service] = {
        used: quota.used,
        limit: quota.limit,
        remaining: quota.limit - quota.used,
        percentage: Math.round((quota.used / quota.limit) * 100)
      }
    }
    
    result.resetTime = this.quotas.resetTime
    result.date = this.quotas.date
    
    return result
  }

  /**
   * Get time until quota reset
   * @returns {number} - Hours until reset
   */
  getHoursUntilReset() {
    const now = new Date()
    const resetTime = new Date(this.quotas.resetTime)
    const diffMs = resetTime.getTime() - now.getTime()
    return Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60)))
  }

  /**
   * Get today's date string (YYYY-MM-DD)
   */
  getTodayString() {
    return new Date().toISOString().split('T')[0]
  }

  /**
   * Get next midnight as Date object
   */
  getNextMidnight() {
    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    tomorrow.setHours(0, 0, 0, 0)
    return tomorrow.toISOString()
  }

  /**
   * Force reset quotas (for testing/admin purposes)
   */
  async forceReset() {
    this.resetDailyCounters()
    console.log('Quotas force reset')
  }
}

// Create singleton instance
const rateLimiter = new RateLimiter()

export default rateLimiter