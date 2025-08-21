/**
 * MoodAnalysisService
 * Handles mood analysis using OpenAI GPT-4 Vision API
 */

import { 
  API_CONFIG, 
  APP_CONFIG, 
  getApiKey, 
  getBusinessCategoriesForMood,
  isDevelopment 
} from '../config/environment.js'
import rateLimiter from './RateLimiter.js'
import localStorageManager from './LocalStorageManager.js'
import tidbService from './TiDBAPIService.js'

class MoodAnalysisService {
  constructor() {
    this.apiKey = null
    this.isInitialized = false
    this.analysisCache = new Map()
  }

  /**
   * Initialize the service
   */
  async initialize() {
    try {
      this.apiKey = getApiKey('openai')
      if (!this.apiKey) {
        console.warn('OpenAI API key not found. Mood analysis will use mock data.')
      }
      
      // Load cached analyses
      await this.loadAnalysisCache()
      
      this.isInitialized = true
      console.log('✅ MoodAnalysisService initialized')
    } catch (error) {
      console.error('❌ Failed to initialize MoodAnalysisService:', error)
      throw error
    }
  }

  /**
   * Analyze mood from drawing image data
   * @param {Object} exportData - Canvas export data from DrawingCanvas
   * @returns {Promise<Object>} Mood analysis result
   */
  async analyzeMood(exportData) {
    if (!this.isInitialized) {
      await this.initialize()
    }

    try {
      // Check rate limiting first
      const canMakeRequest = await rateLimiter.checkQuota('openai')
      const quotaInfo = await rateLimiter.getAllQuotas()
      const remaining = quotaInfo.openai.remaining
      
      if (!canMakeRequest) {
        throw new Error(`Daily OpenAI quota exceeded (${quotaInfo.openai.used}/${quotaInfo.openai.limit}). Please try again tomorrow.`)
      }
      
      // Warn when approaching limit (less than 10 calls remaining)
      if (remaining <= 10) {
        console.warn(`⚠️ Approaching API limit: ${remaining} calls remaining`)
      }

      // Validate input data
      if (!exportData || !exportData.dataUrl) {
        throw new Error('Invalid drawing data provided')
      }

      // Check cache first
      const cacheKey = this.generateCacheKey(exportData.dataUrl)
      if (this.analysisCache.has(cacheKey)) {
        console.log('📋 Returning cached mood analysis')
        return this.analysisCache.get(cacheKey)
      }

      // Prepare image for API
      const optimizedImage = this.optimizeImageForAPI(exportData.dataUrl)
      
      let analysisResult

      if (this.apiKey && !isDevelopment()) {
        // Make actual API call in production with API key
        analysisResult = await this.callOpenAIAPI(optimizedImage)
        
        // Increment usage counter
        await rateLimiter.incrementUsage('openai')
      } else {
        // Use mock analysis for development/demo or when no API key
        console.log('🎭 Using mock mood analysis (no API key or development mode)')
        analysisResult = this.generateMockAnalysis()
      }

      // Add metadata
      analysisResult.metadata = {
        timestamp: new Date().toISOString(),
        imageSize: exportData.compressedSize,
        compressionRatio: exportData.compressionRatio,
        processingTime: Date.now() - Date.now() // Will be calculated properly
      }

      // Map mood to business categories
      analysisResult.businessCategories = getBusinessCategoriesForMood(analysisResult.primaryMood)

      // Cache the result
      this.analysisCache.set(cacheKey, analysisResult)
      await this.saveAnalysisCache()

      // Store in local database
      await this.storeAnalysisResult(analysisResult, exportData)

      // Save to TiDB (non-blocking)
      this.saveMoodToTiDB(analysisResult.primaryMood, analysisResult.confidence)

      return analysisResult

    } catch (error) {
      console.error('❌ Mood analysis failed:', error)
      
      // Return fallback analysis for better UX
      if (error.message.includes('quota exceeded')) {
        throw error // Re-throw quota errors
      }
      
      return this.generateFallbackAnalysis(error.message)
    }
  }

  /**
   * Call OpenAI GPT-4 Vision API
   * @param {string} imageData - Base64 image data
   * @returns {Promise<Object>} API response
   */
  async callOpenAIAPI(imageData) {
    const startTime = Date.now()
    
    const prompt = `You are an expert art therapist analyzing a drawing to determine the creator's emotional state. Analyze this drawing carefully based on these visual elements:

VISUAL ANALYSIS CRITERIA:
- Line quality: smooth/jagged, light/heavy pressure, continuous/broken strokes, fast/slow execution
- Color palette: dark/bright, warm/cool tones, monochromatic/diverse, color intensity
- Shapes and forms: angular/curved, geometric/organic, large/small, simple/complex
- Composition: balanced/unbalanced, centered/scattered, full/sparse, organized/chaotic
- Drawing style: detailed/sketchy, realistic/abstract, controlled/expressive

MOOD CLASSIFICATION:
You must classify the PRIMARY mood as exactly ONE of these 15 categories:
happy, sad, anxious, calm, creative, energetic, tired, angry, excited, peaceful, confident, overwhelmed, lonely, frustrated, inspired

CRITICAL INSTRUCTIONS:
- Analyze the ACTUAL visual elements - do NOT default to "happy"
- Different line qualities indicate different emotions (jagged = anxiety/anger, flowing = calm/happy)
- Dark colors often indicate sadness/anxiety, bright colors suggest energy/happiness
- Chaotic compositions may show overwhelm/anxiety, organized ones suggest calm/confidence
- Heavy pressure/bold strokes can indicate strong emotions (anger, excitement, confidence)
- Light, tentative strokes may suggest uncertainty, sadness, or tiredness

REQUIRED JSON OUTPUT FORMAT (respond with ONLY this JSON, no other text):
{
  "primaryMood": "one_of_the_15_words_exactly",
  "confidence": 0.85,
  "description": "Specific analysis of visual elements that led to this mood classification",
  "recommendations": [
    {
      "title": "Actionable wellness advice title",
      "description": "Detailed explanation of how this helps with the detected mood",
      "icon": "relevant_emoji"
    },
    {
      "title": "Second wellness recommendation",
      "description": "Another specific suggestion tailored to this mood",
      "icon": "relevant_emoji"
    },
    {
      "title": "Third personalized advice",
      "description": "Additional mood-specific guidance",
      "icon": "relevant_emoji"
    }
  ]
}

Remember: Respond with ONLY valid JSON. No additional text before or after.`

    const requestBody = {
      model: API_CONFIG.OPENAI.MODEL,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: prompt
            },
            {
              type: "image_url",
              image_url: {
                url: imageData,
                detail: "low" // Use low detail to reduce costs
              }
            }
          ]
        }
      ],
      max_tokens: API_CONFIG.OPENAI.MAX_TOKENS,
      temperature: API_CONFIG.OPENAI.TEMPERATURE
    }

    const response = await fetch(`${API_CONFIG.OPENAI.BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`
      },
      body: JSON.stringify(requestBody)
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(`OpenAI API error: ${response.status} - ${errorData.error?.message || 'Unknown error'}`)
    }

    const data = await response.json()
    
    if (!data.choices || !data.choices[0] || !data.choices[0].message) {
      throw new Error('Invalid response format from OpenAI API')
    }

    const content = data.choices[0].message.content.trim()
    
    try {
      // Clean up response - remove any text before/after JSON
      let jsonContent = content
      
      // Find JSON boundaries
      const jsonStart = content.indexOf('{')
      const jsonEnd = content.lastIndexOf('}')
      
      if (jsonStart !== -1 && jsonEnd !== -1 && jsonEnd > jsonStart) {
        jsonContent = content.substring(jsonStart, jsonEnd + 1)
      }
      
      // Parse JSON response
      const analysisResult = JSON.parse(jsonContent)
      
      // Validate required fields
      if (!analysisResult.primaryMood || typeof analysisResult.primaryMood !== 'string') {
        throw new Error('Missing or invalid primaryMood field')
      }
      
      if (!analysisResult.description || typeof analysisResult.description !== 'string') {
        throw new Error('Missing or invalid description field')
      }
      
      // Validate primaryMood is one of the expected 15 moods
      const validMoods = ['happy', 'sad', 'anxious', 'calm', 'creative', 'energetic', 'tired', 'angry', 'excited', 'peaceful', 'confident', 'overwhelmed', 'lonely', 'frustrated', 'inspired']
      const normalizedMood = analysisResult.primaryMood.toLowerCase().trim()
      
      if (!validMoods.includes(normalizedMood)) {
        console.warn(`Invalid mood detected: ${analysisResult.primaryMood}, defaulting to closest match`)
        // Find closest match or default to 'creative'
        analysisResult.primaryMood = this.findClosestMood(normalizedMood, validMoods) || 'creative'
      } else {
        analysisResult.primaryMood = normalizedMood
      }

      // Ensure recommendations array exists and is valid
      if (!analysisResult.recommendations || !Array.isArray(analysisResult.recommendations)) {
        analysisResult.recommendations = []
      }
      
      // Validate and clean recommendations
      analysisResult.recommendations = analysisResult.recommendations
        .filter(rec => rec && typeof rec === 'object' && rec.title && rec.description)
        .slice(0, 4) // Limit to 4 recommendations
        .map(rec => ({
          title: String(rec.title).trim(),
          description: String(rec.description).trim(),
          icon: rec.icon || '💡'
        }))

      // Ensure confidence is a valid number
      if (typeof analysisResult.confidence !== 'number' || analysisResult.confidence < 0 || analysisResult.confidence > 1) {
        analysisResult.confidence = 0.75 // Default confidence
      }

      // Add processing time
      analysisResult.processingTime = Date.now() - startTime

      console.log('✅ Parsed OpenAI response:', {
        mood: analysisResult.primaryMood,
        confidence: analysisResult.confidence,
        recommendationsCount: analysisResult.recommendations.length
      })

      return analysisResult

    } catch (parseError) {
      console.error('❌ Failed to parse OpenAI response:', {
        error: parseError.message,
        content: content.substring(0, 200) + '...'
      })
      throw new Error(`Failed to parse mood analysis response: ${parseError.message}`)
    }
  }

  /**
   * Find closest matching mood from valid moods list
   * @param {string} mood - Input mood string
   * @param {Array} validMoods - Array of valid mood strings
   * @returns {string|null} Closest matching mood or null
   */
  findClosestMood(mood, validMoods) {
    if (!mood || !validMoods || validMoods.length === 0) return null
    
    // Direct match
    if (validMoods.includes(mood)) return mood
    
    // Partial match - find mood that contains the input or vice versa
    for (const validMood of validMoods) {
      if (mood.includes(validMood) || validMood.includes(mood)) {
        return validMood
      }
    }
    
    // Similarity-based matching for common variations
    const moodMappings = {
      'joyful': 'happy',
      'cheerful': 'happy',
      'elated': 'excited',
      'depressed': 'sad',
      'melancholy': 'sad',
      'worried': 'anxious',
      'nervous': 'anxious',
      'stressed': 'overwhelmed',
      'relaxed': 'calm',
      'serene': 'peaceful',
      'tranquil': 'peaceful',
      'artistic': 'creative',
      'imaginative': 'creative',
      'lively': 'energetic',
      'vigorous': 'energetic',
      'exhausted': 'tired',
      'weary': 'tired',
      'mad': 'angry',
      'furious': 'angry',
      'thrilled': 'excited',
      'enthusiastic': 'excited',
      'sure': 'confident',
      'self-assured': 'confident',
      'swamped': 'overwhelmed',
      'isolated': 'lonely',
      'alone': 'lonely',
      'annoyed': 'frustrated',
      'irritated': 'frustrated',
      'motivated': 'inspired',
      'uplifted': 'inspired'
    }
    
    return moodMappings[mood] || null
  }

  /**
   * Optimize image for API transmission
   * @param {string} dataUrl - Original canvas data URL
   * @returns {string} Optimized image data URL
   */
  optimizeImageForAPI(dataUrl) {
    try {
      // For now, return as-is since DrawingCanvas already optimizes
      // In the future, we could add additional compression here
      return dataUrl
    } catch (error) {
      console.error('Image optimization failed:', error)
      return dataUrl
    }
  }

  /**
   * Generate mock analysis for development/demo
   * @returns {Object} Mock analysis result
   */
  generateMockAnalysis() {
    // Define 15 diverse mood categories with specific recommendations
    const moodDatabase = {
      happy: {
        primaryMood: 'happy',
        confidence: 0.85 + Math.random() * 0.1,
        description: 'Your drawing radiates joy with bright colors and uplifting strokes.',
        recommendations: [
          { title: 'Share Your Joy', description: 'Call a friend and share this positive energy with someone you care about.', icon: '📞' },
          { title: 'Celebrate This Moment', description: 'Take a photo or write in a gratitude journal to capture this happiness.', icon: '📸' },
          { title: 'Spread Positivity', description: 'Do something kind for someone else to multiply your joy.', icon: '🌟' }
        ]
      },
      sad: {
        primaryMood: 'sad',
        confidence: 0.75 + Math.random() * 0.15,
        description: 'Your drawing shows gentle, melancholic tones suggesting you need comfort.',
        recommendations: [
          { title: 'Gentle Self-Care', description: 'Make yourself a warm drink and wrap up in something cozy.', icon: '☕' },
          { title: 'Connect with Support', description: 'Reach out to a trusted friend or family member for a caring conversation.', icon: '🤗' },
          { title: 'Honor Your Feelings', description: 'Allow yourself to feel sad - it\'s okay and this emotion will pass.', icon: '💙' }
        ]
      },
      anxious: {
        primaryMood: 'anxious',
        confidence: 0.78 + Math.random() * 0.12,
        description: 'Your drawing shows tension and worried energy in the lines and composition.',
        recommendations: [
          { title: 'Deep Breathing', description: 'Try 4-7-8 breathing: inhale for 4, hold for 7, exhale for 8 counts.', icon: '🫁' },
          { title: 'Grounding Exercise', description: 'Name 5 things you see, 4 you can touch, 3 you hear, 2 you smell, 1 you taste.', icon: '🌱' },
          { title: 'Gentle Movement', description: 'Take a slow walk or do gentle stretches to release physical tension.', icon: '🚶' }
        ]
      },
      calm: {
        primaryMood: 'calm',
        confidence: 0.82 + Math.random() * 0.08,
        description: 'Your drawing displays peaceful, flowing lines suggesting inner tranquility.',
        recommendations: [
          { title: 'Mindful Moment', description: 'Sit quietly and focus on your breath for 5 minutes to deepen this calm.', icon: '🧘' },
          { title: 'Nature Connection', description: 'Step outside or look out a window to connect with natural beauty.', icon: '🌿' },
          { title: 'Peaceful Activity', description: 'Read something inspiring or listen to gentle music.', icon: '📚' }
        ]
      },
      creative: {
        primaryMood: 'creative',
        confidence: 0.87 + Math.random() * 0.08,
        description: 'Your drawing shows artistic flair and imaginative expression.',
        recommendations: [
          { title: 'Capture Ideas', description: 'Write down or sketch any creative inspirations while they\'re fresh.', icon: '💡' },
          { title: 'Explore Art', description: 'Try a new artistic medium or visit a gallery for inspiration.', icon: '🎨' },
          { title: 'Creative Project', description: 'Start or continue a creative project that excites you.', icon: '✨' }
        ]
      },
      energetic: {
        primaryMood: 'energetic',
        confidence: 0.89 + Math.random() * 0.06,
        description: 'Your drawing pulses with dynamic energy and vibrant movement.',
        recommendations: [
          { title: 'Physical Activity', description: 'Channel this energy into exercise, dancing, or active movement.', icon: '💃' },
          { title: 'Productive Tasks', description: 'Tackle that project or task you\'ve been putting off.', icon: '⚡' },
          { title: 'Social Energy', description: 'Connect with friends for an energizing activity or conversation.', icon: '👥' }
        ]
      },
      tired: {
        primaryMood: 'tired',
        confidence: 0.73 + Math.random() * 0.12,
        description: 'Your drawing shows fatigue with heavy, weary strokes.',
        recommendations: [
          { title: 'Rest Permission', description: 'Give yourself permission to rest without guilt - you deserve it.', icon: '😴' },
          { title: 'Gentle Restoration', description: 'Take a warm bath or shower to refresh your body and mind.', icon: '🛁' },
          { title: 'Energy Foods', description: 'Eat something nourishing and drink plenty of water.', icon: '🍎' }
        ]
      },
      angry: {
        primaryMood: 'angry',
        confidence: 0.84 + Math.random() * 0.11,
        description: 'Your drawing shows sharp, aggressive strokes indicating intense anger.',
        recommendations: [
          { title: 'Safe Physical Release', description: 'Punch a pillow, do jumping jacks, or go for a vigorous run.', icon: '🥊' },
          { title: 'Cool Down Time', description: 'Take 10 deep breaths and count to 20 before responding.', icon: '❄️' },
          { title: 'Express Safely', description: 'Write about your anger or talk to someone you trust.', icon: '✍️' }
        ]
      },
      excited: {
        primaryMood: 'excited',
        confidence: 0.91 + Math.random() * 0.07,
        description: 'Your drawing bursts with enthusiasm and anticipatory energy.',
        recommendations: [
          { title: 'Channel Excitement', description: 'Use this energy to work on something you\'re passionate about.', icon: '🚀' },
          { title: 'Share the Buzz', description: 'Tell someone about what\'s got you so excited!', icon: '📢' },
          { title: 'Plan Action', description: 'Make concrete plans to act on whatever is exciting you.', icon: '📋' }
        ]
      },
      peaceful: {
        primaryMood: 'peaceful',
        confidence: 0.86 + Math.random() * 0.09,
        description: 'Your drawing emanates serenity with soft, harmonious lines.',
        recommendations: [
          { title: 'Savor the Peace', description: 'Sit quietly and fully experience this beautiful sense of calm.', icon: '🕊️' },
          { title: 'Meditation Time', description: 'Spend 10-15 minutes in peaceful meditation or prayer.', icon: '🧘‍♀️' },
          { title: 'Share Serenity', description: 'Be a calming presence for someone who might need it.', icon: '☮️' }
        ]
      },
      confident: {
        primaryMood: 'confident',
        confidence: 0.88 + Math.random() * 0.08,
        description: 'Your drawing shows bold, decisive strokes reflecting strong self-assurance.',
        recommendations: [
          { title: 'Take Bold Action', description: 'Use this confidence to tackle something challenging.', icon: '💪' },
          { title: 'Lead Others', description: 'Step up and offer leadership or guidance to someone.', icon: '👑' },
          { title: 'Set Big Goals', description: 'This is the perfect time to aim high and dream big.', icon: '🎯' }
        ]
      },
      overwhelmed: {
        primaryMood: 'overwhelmed',
        confidence: 0.81 + Math.random() * 0.14,
        description: 'Your drawing shows chaotic, overlapping lines suggesting you feel swamped.',
        recommendations: [
          { title: 'Priority List', description: 'Write down everything, then pick just the top 3 most important items.', icon: '📝' },
          { title: 'Take a Break', description: 'Step away for 15 minutes - even overwhelm needs a pause.', icon: '⏸️' },
          { title: 'Ask for Help', description: 'Reach out to someone who can assist or just listen.', icon: '🆘' }
        ]
      },
      lonely: {
        primaryMood: 'lonely',
        confidence: 0.77 + Math.random() * 0.13,
        description: 'Your drawing has isolated elements suggesting you\'re feeling disconnected.',
        recommendations: [
          { title: 'Reach Out', description: 'Send a text or make a call to someone you care about.', icon: '📱' },
          { title: 'Join Something', description: 'Look for a group, class, or community activity to join.', icon: '👥' },
          { title: 'Self-Compassion', description: 'Be gentle with yourself - loneliness is temporary and normal.', icon: '💝' }
        ]
      },
      frustrated: {
        primaryMood: 'frustrated',
        confidence: 0.85 + Math.random() * 0.10,
        description: 'Your drawing shows blocked, jagged energy indicating frustration.',
        recommendations: [
          { title: 'Step Away', description: 'Take a break from whatever is frustrating you right now.', icon: '🚪' },
          { title: 'Physical Release', description: 'Do some vigorous exercise to discharge the frustrated energy.', icon: '🏃' },
          { title: 'New Approach', description: 'Try tackling the problem from a completely different angle.', icon: '🔄' }
        ]
      },
      inspired: {
        primaryMood: 'inspired',
        confidence: 0.93 + Math.random() * 0.05,
        description: 'Your drawing flows with creative inspiration and visionary energy.',
        recommendations: [
          { title: 'Capture the Vision', description: 'Write down or sketch your inspired ideas immediately.', icon: '💡' },
          { title: 'Take Action', description: 'Start working on whatever is inspiring you - strike while the iron is hot!', icon: '⚡' },
          { title: 'Share Inspiration', description: 'Tell others about your vision - inspiration is contagious.', icon: '✨' }
        ]
      }
    };

    // CRITICAL FIX: Proper random mood selection
    const moodKeys = Object.keys(moodDatabase);
    const randomIndex = Math.floor(Math.random() * moodKeys.length);
    const selectedMood = moodKeys[randomIndex];
    const moodData = moodDatabase[selectedMood];

    // Add processing metadata
    return {
      ...moodData,
      processingTime: 800 + Math.random() * 400,
      isMockData: true,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Generate fallback analysis when API fails
   * @param {string} errorMessage - Error that occurred
   * @returns {Object} Fallback analysis
   */
  generateFallbackAnalysis(errorMessage) {
    return {
      primaryMood: 'calm',
      confidence: 0.5,
      description: 'We encountered an issue analyzing your drawing, but your creative expression is still valuable. Sometimes the act of drawing itself can be therapeutic.',
      recommendations: [
        {
          title: 'Take a Deep Breath',
          description: 'Focus on slow, calming breaths to center yourself in this moment.',
          icon: '🫁'
        },
        {
          title: 'Continue Creating',
          description: 'Keep expressing yourself through art - it\'s a healthy way to process emotions.',
          icon: '🎨'
        },
        {
          title: 'Try Again Later',
          description: 'Technical issues happen. Feel free to draw again when you\'re ready.',
          icon: '🔄'
        }
      ],
      businessCategories: getBusinessCategoriesForMood('calm'),
      metadata: {
        timestamp: new Date().toISOString(),
        error: errorMessage,
        isFallback: true
      }
    }
  }

  /**
   * Store analysis result in local database
   * @param {Object} analysisResult - Analysis result to store
   * @param {Object} exportData - Original drawing data
   */
  async storeAnalysisResult(analysisResult, exportData) {
    try {
      const moodEntry = {
        id: this.generateId(),
        timestamp: new Date().toISOString(),
        imageData: exportData.dataUrl,
        imageDimensions: {
          width: exportData.width,
          height: exportData.height
        },
        analysis: analysisResult,
        sessionId: this.getSessionId()
      }

      await localStorageManager.saveMoodEntry(moodEntry)
      
      if (isDevelopment()) {
        console.log('💾 Mood analysis stored:', {
          id: moodEntry.id,
          mood: analysisResult.primaryMood,
          confidence: analysisResult.confidence
        })
      }
    } catch (error) {
      console.error('Failed to store mood analysis:', error)
      // Don't throw - storage failure shouldn't break the analysis flow
    }
  }

  /**
   * Load analysis cache from storage
   */
  async loadAnalysisCache() {
    try {
      const cached = await localStorageManager.getAnalysisCache()
      if (cached) {
        this.analysisCache = new Map(Object.entries(cached))
      }
    } catch (error) {
      console.error('Failed to load analysis cache:', error)
    }
  }

  /**
   * Save analysis cache to storage
   */
  async saveAnalysisCache() {
    try {
      const cacheObject = Object.fromEntries(this.analysisCache)
      await localStorageManager.saveAnalysisCache(cacheObject)
    } catch (error) {
      console.error('Failed to save analysis cache:', error)
    }
  }

  /**
   * Generate cache key for image data
   * @param {string} imageData - Base64 image data
   * @returns {string} Cache key
   */
  generateCacheKey(imageData) {
    // Create a more robust hash by sampling the image data
    const sampleSize = Math.min(1000, imageData.length)
    const step = Math.floor(imageData.length / sampleSize)
    let hash = 0
    
    for (let i = 0; i < imageData.length; i += step) {
      const char = imageData.charCodeAt(i)
      hash = ((hash << 5) - hash) + char
      hash = hash & hash // Convert to 32-bit integer
    }
    
    // Include image length in hash to differentiate similar images
    hash = hash ^ imageData.length
    
    return `mood_${Math.abs(hash)}`
  }

  /**
   * Generate unique ID
   * @returns {string} Unique identifier
   */
  generateId() {
    return `mood_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  /**
   * Get current session ID
   * @returns {string} Session identifier
   */
  getSessionId() {
    let sessionId = localStorage.getItem('moodspot_session_id')
    if (!sessionId) {
      sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      localStorage.setItem('moodspot_session_id', sessionId)
    }
    return sessionId
  }

  /**
   * Get mood analysis history
   * @param {number} limit - Maximum number of entries to return
   * @returns {Promise<Array>} Array of mood entries
   */
  async getMoodHistory(limit = 10) {
    try {
      return await localStorageManager.getMoodHistory(limit)
    } catch (error) {
      console.error('Failed to get mood history:', error)
      return []
    }
  }

  /**
   * Clear analysis cache
   */
  clearCache() {
    this.analysisCache.clear()
    localStorageManager.clearAnalysisCache()
  }

  /**
   * Save mood to TiDB (non-blocking)
   * @param {string} mood - Primary mood
   * @param {number} confidence - Confidence score
   */
  async saveMoodToTiDB(mood, confidence) {
    try {
      await tidbService.saveMood(mood, confidence)
      console.log('✅ Mood saved to TiDB:', { mood, confidence })
      
      // Dispatch event to update UI
      window.dispatchEvent(new CustomEvent('moodSavedToTiDB', {
        detail: { mood, confidence }
      }))
    } catch (error) {
      console.warn('⚠️ Failed to save mood to TiDB (continuing normally):', error.message)
      // Don't throw - TiDB failure shouldn't break the analysis flow
    }
  }

  /**
   * Get service status
   * @returns {Object} Service status information
   */
  async getStatus() {
    const quotas = await rateLimiter.getAllQuotas()
    
    return {
      initialized: this.isInitialized,
      hasApiKey: !!this.apiKey,
      cacheSize: this.analysisCache.size,
      quotaRemaining: quotas.openai.limit - quotas.openai.used,
      quotaUsed: quotas.openai.used,
      quotaLimit: quotas.openai.limit
    }
  }
}

// Create singleton instance
const moodAnalysisService = new MoodAnalysisService()

export default moodAnalysisService