/**
 * LocalStorageManager Service
 * Manages IndexedDB operations for persistent data storage
 */

import rateLimiter from './RateLimiter.js'

const DB_NAME = 'MoodSpot'
const DB_VERSION = 1
const STORES = {
  SESSIONS: 'sessions',
  MOOD_HISTORY: 'moodHistory',
  API_USAGE: 'apiUsage',
  USER_PREFERENCES: 'userPreferences',
  RECOMMENDATIONS: 'recommendations'
}

class LocalStorageManager {
  constructor() {
    this.db = null
    this.initialized = false
  }

  /**
   * Initialize IndexedDB connection
   */
  async initialize() {
    if (this.initialized && this.db) return this.db

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION)

      request.onerror = () => {
        console.error('Failed to open IndexedDB:', request.error)
        reject(request.error)
      }

      request.onsuccess = () => {
        this.db = request.result
        this.initialized = true
        console.log('IndexedDB initialized successfully')
        resolve(this.db)
      }

      request.onupgradeneeded = (event) => {
        const db = event.target.result
        this.createObjectStores(db)
      }
    })
  }

  /**
   * Create object stores for the database
   */
  createObjectStores(db) {
    // Sessions store
    if (!db.objectStoreNames.contains(STORES.SESSIONS)) {
      const sessionStore = db.createObjectStore(STORES.SESSIONS, { keyPath: 'sessionId' })
      sessionStore.createIndex('timestamp', 'timestamp', { unique: false })
    }

    // Mood history store
    if (!db.objectStoreNames.contains(STORES.MOOD_HISTORY)) {
      const moodStore = db.createObjectStore(STORES.MOOD_HISTORY, { keyPath: 'id' })
      moodStore.createIndex('timestamp', 'timestamp', { unique: false })
      moodStore.createIndex('primaryMood', 'analysis.primaryMood', { unique: false })
    }

    // API usage store
    if (!db.objectStoreNames.contains(STORES.API_USAGE)) {
      const apiStore = db.createObjectStore(STORES.API_USAGE, { keyPath: 'date' })
    }

    // User preferences store
    if (!db.objectStoreNames.contains(STORES.USER_PREFERENCES)) {
      db.createObjectStore(STORES.USER_PREFERENCES, { keyPath: 'key' })
    }

    // Recommendations store
    if (!db.objectStoreNames.contains(STORES.RECOMMENDATIONS)) {
      const recStore = db.createObjectStore(STORES.RECOMMENDATIONS, { keyPath: 'cacheKey' })
      recStore.createIndex('timestamp', 'timestamp', { unique: false })
    }

    console.log('IndexedDB object stores created')
  }

  /**
   * Check database operation quota before proceeding
   */
  async checkDatabaseQuota() {
    const hasQuota = await rateLimiter.checkQuota('database')
    if (!hasQuota) {
      throw new Error('Daily database operation limit exceeded')
    }
    return rateLimiter.incrementUsage('database')
  }

  /**
   * Save user session data
   */
  async saveSession(sessionData) {
    await this.initialize()
    
    if (!(await this.checkDatabaseQuota())) {
      throw new Error('Database quota exceeded')
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([STORES.SESSIONS], 'readwrite')
      const store = transaction.objectStore(STORES.SESSIONS)
      
      const sessionWithTimestamp = {
        ...sessionData,
        sessionId: sessionData.sessionId || this.generateSessionId(),
        timestamp: new Date().toISOString(),
        lastUpdated: new Date().toISOString()
      }

      const request = store.put(sessionWithTimestamp)

      request.onsuccess = () => {
        console.log('Session saved successfully')
        resolve(sessionWithTimestamp)
      }

      request.onerror = () => {
        console.error('Failed to save session:', request.error)
        reject(request.error)
      }
    })
  }

  /**
   * Load user session data
   */
  async loadSession(sessionId = null) {
    await this.initialize()
    
    if (!(await this.checkDatabaseQuota())) {
      console.warn('Database quota exceeded, returning cached session')
      return this.getCachedSession()
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([STORES.SESSIONS], 'readonly')
      const store = transaction.objectStore(STORES.SESSIONS)
      
      if (sessionId) {
        // Load specific session
        const request = store.get(sessionId)
        
        request.onsuccess = () => {
          resolve(request.result || null)
        }
        
        request.onerror = () => {
          console.error('Failed to load session:', request.error)
          reject(request.error)
        }
      } else {
        // Load most recent session
        const index = store.index('timestamp')
        const request = index.openCursor(null, 'prev')
        
        request.onsuccess = () => {
          const cursor = request.result
          resolve(cursor ? cursor.value : null)
        }
        
        request.onerror = () => {
          console.error('Failed to load recent session:', request.error)
          reject(request.error)
        }
      }
    })
  }

  /**
   * Save mood analysis result (alias for saveMoodEntry)
   */
  async saveMoodAnalysis(moodData) {
    return this.saveMoodEntry(moodData)
  }

  /**
   * Save mood entry
   */
  async saveMoodEntry(moodData) {
    await this.initialize()
    
    if (!(await this.checkDatabaseQuota())) {
      throw new Error('Database quota exceeded')
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([STORES.MOOD_HISTORY], 'readwrite')
      const store = transaction.objectStore(STORES.MOOD_HISTORY)
      
      const moodWithId = {
        ...moodData,
        id: moodData.id || this.generateId(),
        timestamp: moodData.timestamp || new Date().toISOString()
      }

      const request = store.put(moodWithId)

      request.onsuccess = () => {
        console.log('Mood analysis saved successfully')
        resolve(moodWithId)
      }

      request.onerror = () => {
        console.error('Failed to save mood analysis:', request.error)
        reject(request.error)
      }
    })
  }

  /**
   * Get mood history
   */
  async getMoodHistory(limit = 10) {
    await this.initialize()
    
    if (!(await this.checkDatabaseQuota())) {
      console.warn('Database quota exceeded, returning cached history')
      return this.getCachedMoodHistory()
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([STORES.MOOD_HISTORY], 'readonly')
      const store = transaction.objectStore(STORES.MOOD_HISTORY)
      const index = store.index('timestamp')
      
      const results = []
      const request = index.openCursor(null, 'prev')
      
      request.onsuccess = () => {
        const cursor = request.result
        if (cursor && results.length < limit) {
          results.push(cursor.value)
          cursor.continue()
        } else {
          resolve(results)
        }
      }
      
      request.onerror = () => {
        console.error('Failed to load mood history:', request.error)
        reject(request.error)
      }
    })
  }

  /**
   * Log API usage
   */
  async logApiUsage(service, endpoint = null) {
    await this.initialize()
    
    // Don't count API usage logging against database quota
    // This is a special case to prevent infinite loops
    
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([STORES.API_USAGE], 'readwrite')
      const store = transaction.objectStore(STORES.API_USAGE)
      const today = new Date().toISOString().split('T')[0]
      
      // Get existing usage for today
      const getRequest = store.get(today)
      
      getRequest.onsuccess = () => {
        const existing = getRequest.result || {
          date: today,
          openaiCalls: 0,
          googlePlacesCalls: 0,
          databaseOperations: 0,
          details: []
        }
        
        // Increment the appropriate counter
        if (service === 'openai') existing.openaiCalls++
        if (service === 'googlePlaces') existing.googlePlacesCalls++
        if (service === 'database') existing.databaseOperations++
        
        // Add detail entry
        existing.details.push({
          service,
          endpoint,
          timestamp: new Date().toISOString()
        })
        
        // Keep only last 100 detail entries to prevent bloat
        if (existing.details.length > 100) {
          existing.details = existing.details.slice(-100)
        }
        
        const putRequest = store.put(existing)
        
        putRequest.onsuccess = () => resolve(existing)
        putRequest.onerror = () => reject(putRequest.error)
      }
      
      getRequest.onerror = () => reject(getRequest.error)
    })
  }

  /**
   * Get API usage for a specific date
   */
  async getApiUsage(date = null) {
    await this.initialize()
    
    const targetDate = date || new Date().toISOString().split('T')[0]
    
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([STORES.API_USAGE], 'readonly')
      const store = transaction.objectStore(STORES.API_USAGE)
      const request = store.get(targetDate)
      
      request.onsuccess = () => {
        resolve(request.result || {
          date: targetDate,
          openaiCalls: 0,
          googlePlacesCalls: 0,
          databaseOperations: 0,
          details: []
        })
      }
      
      request.onerror = () => {
        console.error('Failed to get API usage:', request.error)
        reject(request.error)
      }
    })
  }

  /**
   * Clear old data to prevent storage bloat
   */
  async clearOldData(daysToKeep = 30) {
    await this.initialize()
    
    if (!(await this.checkDatabaseQuota())) {
      console.warn('Database quota exceeded, skipping cleanup')
      return
    }

    const cutoffDate = new Date()
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep)
    const cutoffString = cutoffDate.toISOString()

    // Clear old sessions
    await this.clearOldRecords(STORES.SESSIONS, 'timestamp', cutoffString)
    
    // Clear old mood history (keep more of this)
    const moodCutoff = new Date()
    moodCutoff.setDate(moodCutoff.getDate() - (daysToKeep * 3))
    await this.clearOldRecords(STORES.MOOD_HISTORY, 'timestamp', moodCutoff.toISOString())
    
    // Clear old API usage logs
    await this.clearOldRecords(STORES.API_USAGE, 'date', cutoffDate.toISOString().split('T')[0])
    
    // Clear old recommendations (keep for 7 days)
    const recCutoff = new Date()
    recCutoff.setDate(recCutoff.getDate() - 7)
    await this.clearOldRecords(STORES.RECOMMENDATIONS, 'timestamp', recCutoff.toISOString())
  }

  /**
   * Clear old records from a specific store
   */
  async clearOldRecords(storeName, indexName, cutoffValue) {
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([storeName], 'readwrite')
      const store = transaction.objectStore(storeName)
      const index = store.index(indexName)
      
      const range = IDBKeyRange.upperBound(cutoffValue, true)
      const request = index.openCursor(range)
      
      let deletedCount = 0
      
      request.onsuccess = () => {
        const cursor = request.result
        if (cursor) {
          cursor.delete()
          deletedCount++
          cursor.continue()
        } else {
          console.log(`Cleared ${deletedCount} old records from ${storeName}`)
          resolve(deletedCount)
        }
      }
      
      request.onerror = () => {
        console.error(`Failed to clear old records from ${storeName}:`, request.error)
        reject(request.error)
      }
    })
  }

  /**
   * Generate unique session ID
   */
  generateSessionId() {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  /**
   * Generate unique ID
   */
  generateId() {
    return `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  /**
   * Get cached session from localStorage (fallback)
   */
  getCachedSession() {
    try {
      const cached = localStorage.getItem('moodspot_session_cache')
      return cached ? JSON.parse(cached) : null
    } catch (error) {
      console.error('Failed to get cached session:', error)
      return null
    }
  }

  /**
   * Get cached mood history from localStorage (fallback)
   */
  getCachedMoodHistory() {
    try {
      const cached = localStorage.getItem('moodspot_mood_cache')
      return cached ? JSON.parse(cached) : []
    } catch (error) {
      console.error('Failed to get cached mood history:', error)
      return []
    }
  }

  /**
   * Save analysis cache
   */
  async saveAnalysisCache(cacheData) {
    try {
      localStorage.setItem('moodspot_analysis_cache', JSON.stringify(cacheData))
    } catch (error) {
      console.error('Failed to save analysis cache:', error)
    }
  }

  /**
   * Get analysis cache
   */
  async getAnalysisCache() {
    try {
      const cached = localStorage.getItem('moodspot_analysis_cache')
      return cached ? JSON.parse(cached) : {}
    } catch (error) {
      console.error('Failed to get analysis cache:', error)
      return {}
    }
  }

  /**
   * Clear analysis cache
   */
  async clearAnalysisCache() {
    try {
      localStorage.removeItem('moodspot_analysis_cache')
    } catch (error) {
      console.error('Failed to clear analysis cache:', error)
    }
  }

  /**
   * Save business recommendations to cache
   */
  async saveRecommendations(cacheKey, recommendations) {
    await this.initialize()
    
    if (!(await this.checkDatabaseQuota())) {
      // Fallback to localStorage
      try {
        const cacheData = {
          cacheKey,
          recommendations,
          timestamp: new Date().toISOString()
        }
        localStorage.setItem(`moodspot_rec_${cacheKey}`, JSON.stringify(cacheData))
      } catch (error) {
        console.error('Failed to save recommendations to localStorage:', error)
      }
      return
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([STORES.RECOMMENDATIONS], 'readwrite')
      const store = transaction.objectStore(STORES.RECOMMENDATIONS)
      
      const recData = {
        cacheKey,
        recommendations,
        timestamp: new Date().toISOString()
      }

      const request = store.put(recData)

      request.onsuccess = () => {
        console.log('Recommendations saved successfully')
        resolve(recData)
      }

      request.onerror = () => {
        console.error('Failed to save recommendations:', request.error)
        reject(request.error)
      }
    })
  }

  /**
   * Get cached business recommendations
   */
  async getRecommendations(cacheKey) {
    await this.initialize()
    
    if (!(await this.checkDatabaseQuota())) {
      // Fallback to localStorage
      try {
        const cached = localStorage.getItem(`moodspot_rec_${cacheKey}`)
        if (cached) {
          const data = JSON.parse(cached)
          // Check if cache is still valid (1 hour)
          if (Date.now() - new Date(data.timestamp).getTime() < 60 * 60 * 1000) {
            return data.recommendations
          }
        }
      } catch (error) {
        console.error('Failed to get recommendations from localStorage:', error)
      }
      return []
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([STORES.RECOMMENDATIONS], 'readonly')
      const store = transaction.objectStore(STORES.RECOMMENDATIONS)
      const request = store.get(cacheKey)
      
      request.onsuccess = () => {
        const result = request.result
        if (result) {
          // Check if cache is still valid (1 hour)
          const cacheAge = Date.now() - new Date(result.timestamp).getTime()
          if (cacheAge < 60 * 60 * 1000) {
            resolve(result.recommendations)
          } else {
            resolve([])
          }
        } else {
          resolve([])
        }
      }
      
      request.onerror = () => {
        console.error('Failed to get recommendations:', request.error)
        reject(request.error)
      }
    })
  }

  /**
   * Cache important data in localStorage as backup
   */
  async cacheImportantData(sessionData, moodHistory) {
    try {
      if (sessionData) {
        localStorage.setItem('moodspot_session_cache', JSON.stringify(sessionData))
      }
      if (moodHistory) {
        localStorage.setItem('moodspot_mood_cache', JSON.stringify(moodHistory.slice(0, 5)))
      }
    } catch (error) {
      console.error('Failed to cache data:', error)
    }
  }
}

// Create singleton instance
const localStorageManager = new LocalStorageManager()

export default localStorageManager