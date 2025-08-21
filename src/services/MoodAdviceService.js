/**
 * MoodAdviceService - Provides comprehensive mood improvement advice and recommendations
 * Supports anxiety, sadness, stress, happiness, and mixed emotional states
 */
class MoodAdviceService {
  constructor() {
    this.adviceDatabase = this.initializeAdviceDatabase();
    this.cacheKey = 'mood_advice_cache';
    this.cacheExpiry = 24 * 60 * 60 * 1000; // 24 hours in milliseconds
  }

  /**
   * Get personalized advice recommendations for a mood analysis result
   * @param {Object} moodResult - Result from MoodAnalysisService
   * @param {Array} userHistory - Optional previous mood analysis results
   * @returns {Object} Personalized advice recommendation
   */
  getAdviceForMood(moodResult, userHistory = []) {
    const { primaryMood, emotions, confidence } = moodResult;
    
    // Get base advice for primary mood
    let relevantAdvice = this.getAdviceByCategory(primaryMood.toLowerCase());
    
    // Add advice for secondary emotions if they have significant intensity
    emotions.forEach(emotion => {
      if (emotion.intensity > 0.3 && emotion.name !== primaryMood) {
        const secondaryAdvice = this.getAdviceByCategory(emotion.name.toLowerCase());
        relevantAdvice = [...relevantAdvice, ...secondaryAdvice];
      }
    });

    // Remove duplicates and personalize
    const uniqueAdvice = this.removeDuplicateAdvice(relevantAdvice);
    const personalizedAdvice = this.personalizeAdvice(uniqueAdvice, moodResult, userHistory);

    const recommendation = {
      mood: primaryMood,
      intensity: confidence,
      emotions: emotions,
      advice: personalizedAdvice,
      personalizedMessage: this.generatePersonalizedMessage(moodResult, userHistory),
      timestamp: new Date(),
      cacheId: this.generateCacheId(moodResult)
    };

    // Cache the recommendation for offline access
    this.cacheAdvice(recommendation);

    return recommendation;
  }

  /**
   * Get advice by emotional category
   * @param {string} category - Emotion category (anxiety, sadness, stress, happiness, etc.)
   * @returns {Array} Array of advice objects for the category
   */
  getAdviceByCategory(category) {
    const normalizedCategory = category.toLowerCase();
    return this.adviceDatabase.get(normalizedCategory) || [];
  }

  /**
   * Personalize advice based on mood intensity and user history
   * @param {Array} advice - Base advice array
   * @param {Object} moodResult - Current mood analysis
   * @param {Array} userHistory - Previous mood sessions
   * @returns {Array} Personalized and prioritized advice
   */
  personalizeAdvice(advice, moodResult, userHistory) {
    const { confidence, emotions } = moodResult;
    
    // Sort advice by relevance and difficulty based on mood intensity
    let personalizedAdvice = advice.map(item => ({
      ...item,
      relevanceScore: this.calculateRelevanceScore(item, moodResult, userHistory)
    }));

    // Sort by relevance score (highest first)
    personalizedAdvice.sort((a, b) => b.relevanceScore - a.relevanceScore);

    // Adjust difficulty recommendations based on mood intensity
    if (confidence > 0.8) {
      // High confidence mood - prioritize immediate relief techniques
      personalizedAdvice = personalizedAdvice.filter(item => 
        item.difficulty === 'easy' || item.category === 'immediate_relief'
      );
    }

    // Limit to top 6 most relevant advice items
    return personalizedAdvice.slice(0, 6).map(item => {
      const { relevanceScore, ...adviceItem } = item;
      return adviceItem;
    });
  }

  /**
   * Calculate relevance score for advice item
   * @param {Object} adviceItem - Individual advice item
   * @param {Object} moodResult - Current mood analysis
   * @param {Array} userHistory - Previous sessions
   * @returns {number} Relevance score (0-1)
   */
  calculateRelevanceScore(adviceItem, moodResult, userHistory) {
    let score = 0.5; // Base score

    // Boost score for primary mood match
    if (adviceItem.category === moodResult.primaryMood.toLowerCase()) {
      score += 0.3;
    }

    // Boost for emotion intensity match
    moodResult.emotions.forEach(emotion => {
      if (adviceItem.category === emotion.name.toLowerCase()) {
        score += emotion.intensity * 0.2;
      }
    });

    // Boost for appropriate difficulty level
    if (moodResult.confidence > 0.7 && adviceItem.difficulty === 'easy') {
      score += 0.1;
    } else if (moodResult.confidence < 0.5 && adviceItem.difficulty === 'medium') {
      score += 0.1;
    }

    // Historical preference boost
    if (userHistory.length > 0) {
      const hasUsedSimilar = userHistory.some(session => 
        session.advice && session.advice.some(used => used.category === adviceItem.category)
      );
      if (hasUsedSimilar) {
        score += 0.15; // Slight boost for familiar techniques
      }
    }

    return Math.min(score, 1.0);
  }

  /**
   * Generate personalized message based on mood and history
   * @param {Object} moodResult - Current mood analysis
   * @param {Array} userHistory - Previous sessions
   * @returns {string} Personalized message
   */
  generatePersonalizedMessage(moodResult, userHistory) {
    const { primaryMood, confidence } = moodResult;
    const moodName = primaryMood.toLowerCase();
    
    const messages = {
      anxiety: [
        "I can see you're feeling anxious right now. These techniques can help calm your nervous system.",
        "Anxiety is challenging, but you have the strength to work through it. Let's start with some grounding exercises.",
        "Your feelings are valid. Here are some proven methods to help ease your anxiety."
      ],
      sadness: [
        "I notice you're going through a difficult time. These gentle activities can help lift your spirits.",
        "It's okay to feel sad. These suggestions focus on small, manageable steps toward feeling better.",
        "Your emotions matter. Let's explore some nurturing ways to support yourself right now."
      ],
      stress: [
        "You seem to be under a lot of pressure. These stress-relief techniques can help you find some calm.",
        "Stress can be overwhelming, but these methods can help you regain your sense of balance.",
        "Let's work on releasing some of that tension with these proven stress-reduction techniques."
      ],
      happiness: [
        "It's wonderful that you're feeling positive! Here are ways to maintain and share this good energy.",
        "Your happiness is beautiful. These suggestions can help you sustain and spread these positive feelings.",
        "Great to see you in a good mood! Let's explore ways to keep this positivity flowing."
      ]
    };

    const moodMessages = messages[moodName] || [
      "I'm here to support you through whatever you're feeling right now.",
      "Every emotion has value. Let's find some helpful techniques for your current state.",
      "You're taking a positive step by seeking support. Here are some personalized suggestions."
    ];

    // Add history-based personalization
    if (userHistory.length > 2) {
      return `Welcome back! Based on your recent sessions, ${moodMessages[0].toLowerCase()}`;
    }

    return moodMessages[Math.floor(Math.random() * moodMessages.length)];
  }

  /**
   * Remove duplicate advice items based on title and category
   * @param {Array} advice - Array of advice items
   * @returns {Array} Deduplicated advice array
   */
  removeDuplicateAdvice(advice) {
    const seen = new Set();
    return advice.filter(item => {
      const key = `${item.category}-${item.title}`;
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });
  }

  /**
   * Cache advice recommendation for offline access
   * @param {Object} recommendation - Complete advice recommendation
   */
  cacheAdvice(recommendation) {
    try {
      const cache = this.getCachedAdvice();
      cache[recommendation.cacheId] = {
        ...recommendation,
        cachedAt: Date.now()
      };

      // Clean old cache entries (keep last 50)
      const entries = Object.entries(cache);
      if (entries.length > 50) {
        entries.sort((a, b) => b[1].cachedAt - a[1].cachedAt);
        const keepEntries = entries.slice(0, 50);
        const cleanCache = Object.fromEntries(keepEntries);
        localStorage.setItem(this.cacheKey, JSON.stringify(cleanCache));
      } else {
        localStorage.setItem(this.cacheKey, JSON.stringify(cache));
      }
    } catch (error) {
      console.warn('Failed to cache advice:', error);
    }
  }

  /**
   * Get cached advice recommendations
   * @returns {Object} Cached advice object
   */
  getCachedAdvice() {
    try {
      const cached = localStorage.getItem(this.cacheKey);
      return cached ? JSON.parse(cached) : {};
    } catch (error) {
      console.warn('Failed to load cached advice:', error);
      return {};
    }
  }

  /**
   * Get cached advice by cache ID
   * @param {string} cacheId - Cache identifier
   * @returns {Object|null} Cached recommendation or null
   */
  getCachedAdviceById(cacheId) {
    const cache = this.getCachedAdvice();
    const cached = cache[cacheId];
    
    if (cached && (Date.now() - cached.cachedAt) < this.cacheExpiry) {
      return cached;
    }
    
    return null;
  }

  /**
   * Generate cache ID for mood result
   * @param {Object} moodResult - Mood analysis result
   * @returns {string} Cache identifier
   */
  generateCacheId(moodResult) {
    const { primaryMood, emotions } = moodResult;
    const emotionString = emotions.map(e => `${e.name}:${e.intensity.toFixed(1)}`).join(',');
    return `${primaryMood}-${emotionString}`.replace(/[^a-zA-Z0-9:,-]/g, '');
  }

  /**
   * Initialize comprehensive advice database
   * @returns {Map} Advice database organized by emotional categories
   */
  initializeAdviceDatabase() {
    const database = new Map(); 
   // Anxiety advice database
    database.set('anxiety', [
      {
        category: 'anxiety',
        title: 'Deep Breathing Exercise',
        description: 'Calm your nervous system with controlled breathing techniques',
        actionSteps: [
          'Find a quiet, comfortable space',
          'Sit or lie down with your back straight',
          'Breathe in slowly through your nose for 4 counts',
          'Hold your breath for 4 counts',
          'Exhale slowly through your mouth for 6 counts',
          'Repeat for 5-10 cycles'
        ],
        techniques: ['4-7-8 breathing', 'Box breathing', 'Belly breathing', 'Counted breathing'],
        duration: '5-10 minutes',
        difficulty: 'easy'
      },
      {
        category: 'anxiety',
        title: 'Grounding Technique (5-4-3-2-1)',
        description: 'Use your senses to anchor yourself in the present moment',
        actionSteps: [
          'Name 5 things you can see around you',
          'Name 4 things you can touch',
          'Name 3 things you can hear',
          'Name 2 things you can smell',
          'Name 1 thing you can taste'
        ],
        techniques: ['Sensory grounding', 'Mindful observation', 'Present moment awareness'],
        duration: '3-5 minutes',
        difficulty: 'easy'
      },
      {
        category: 'anxiety',
        title: 'Progressive Muscle Relaxation',
        description: 'Release physical tension to reduce mental anxiety',
        actionSteps: [
          'Lie down in a comfortable position',
          'Start with your toes - tense for 5 seconds, then relax',
          'Move up through each muscle group',
          'Focus on the contrast between tension and relaxation',
          'End with your face and scalp muscles'
        ],
        techniques: ['Body scan', 'Tension release', 'Mindful relaxation'],
        duration: '15-20 minutes',
        difficulty: 'medium'
      },
      {
        category: 'anxiety',
        title: 'Calming Visualization',
        description: 'Create a mental safe space to reduce anxiety',
        actionSteps: [
          'Close your eyes and take three deep breaths',
          'Imagine a place where you feel completely safe and calm',
          'Engage all your senses in this visualization',
          'Stay in this space for several minutes',
          'Return to this place whenever you feel anxious'
        ],
        techniques: ['Guided imagery', 'Safe place visualization', 'Sensory imagination'],
        duration: '10-15 minutes',
        difficulty: 'medium'
      }
    ]);

    // Sadness advice database
    database.set('sadness', [
      {
        category: 'sadness',
        title: 'Gentle Movement',
        description: 'Light physical activity to naturally boost mood',
        actionSteps: [
          'Step outside for fresh air',
          'Take a slow 10-15 minute walk',
          'Focus on your surroundings and nature',
          'Notice three beautiful things during your walk',
          'Practice gratitude for your body\'s ability to move'
        ],
        techniques: ['Walking meditation', 'Nature therapy', 'Gratitude practice', 'Mindful movement'],
        duration: '10-20 minutes',
        difficulty: 'easy'
      },
      {
        category: 'sadness',
        title: 'Creative Expression',
        description: 'Channel emotions through artistic activities',
        actionSteps: [
          'Choose a creative medium (drawing, writing, music)',
          'Set aside 15-30 minutes without distractions',
          'Express your feelings without judgment',
          'Focus on the process, not the outcome',
          'Reflect on what you created'
        ],
        techniques: ['Art therapy', 'Journaling', 'Music therapy', 'Creative flow'],
        duration: '15-30 minutes',
        difficulty: 'easy'
      },
      {
        category: 'sadness',
        title: 'Connection and Support',
        description: 'Reach out to others for emotional support',
        actionSteps: [
          'Identify someone you trust and feel comfortable with',
          'Reach out via call, text, or in person',
          'Share how you\'re feeling honestly',
          'Ask for a listening ear or gentle company',
          'Accept offers of support gracefully'
        ],
        techniques: ['Social support', 'Vulnerability practice', 'Communication skills'],
        duration: '20-60 minutes',
        difficulty: 'medium'
      },
      {
        category: 'sadness',
        title: 'Self-Compassion Practice',
        description: 'Treat yourself with kindness during difficult times',
        actionSteps: [
          'Place your hand on your heart',
          'Acknowledge that you\'re suffering right now',
          'Remind yourself that suffering is part of human experience',
          'Offer yourself the same kindness you\'d give a good friend',
          'Speak to yourself with gentle, caring words'
        ],
        techniques: ['Self-compassion meditation', 'Loving-kindness practice', 'Inner dialogue work'],
        duration: '10-15 minutes',
        difficulty: 'medium'
      }
    ]);

    // Stress advice database
    database.set('stress', [
      {
        category: 'stress',
        title: 'Quick Stress Reset',
        description: 'Immediate techniques to reduce stress in the moment',
        actionSteps: [
          'Stop what you\'re doing and take a pause',
          'Take 5 deep, slow breaths',
          'Drop your shoulders and relax your jaw',
          'Shake out your hands and arms',
          'Remind yourself: "This feeling will pass"'
        ],
        techniques: ['Pause technique', 'Body awareness', 'Stress interruption'],
        duration: '2-5 minutes',
        difficulty: 'easy'
      },
      {
        category: 'stress',
        title: 'Time Management Technique',
        description: 'Organize tasks to reduce overwhelming feelings',
        actionSteps: [
          'Write down everything on your mind',
          'Categorize tasks as urgent, important, or neither',
          'Choose only 3 priority items for today',
          'Break large tasks into smaller, manageable steps',
          'Schedule specific times for each priority task'
        ],
        techniques: ['Priority matrix', 'Task breakdown', 'Time blocking'],
        duration: '15-20 minutes',
        difficulty: 'medium'
      },
      {
        category: 'stress',
        title: 'Mindful Stress Release',
        description: 'Use mindfulness to observe and release stress',
        actionSteps: [
          'Sit comfortably and close your eyes',
          'Notice where you feel stress in your body',
          'Breathe into those areas without trying to change them',
          'Observe the stress with curiosity, not judgment',
          'Imagine breathing out the tension with each exhale'
        ],
        techniques: ['Body scan meditation', 'Mindful breathing', 'Tension awareness'],
        duration: '10-15 minutes',
        difficulty: 'medium'
      },
      {
        category: 'stress',
        title: 'Physical Stress Release',
        description: 'Use movement to discharge stress energy',
        actionSteps: [
          'Do 10 jumping jacks or run in place for 30 seconds',
          'Stretch your arms overhead and to each side',
          'Roll your shoulders backward 10 times',
          'Gently massage your temples and neck',
          'Take 5 deep breaths to settle'
        ],
        techniques: ['Exercise therapy', 'Stretching', 'Self-massage', 'Energy discharge'],
        duration: '5-10 minutes',
        difficulty: 'easy'
      }
    ]);

    // Happiness advice database
    database.set('happiness', [
      {
        category: 'happiness',
        title: 'Gratitude Amplification',
        description: 'Deepen and extend your positive feelings',
        actionSteps: [
          'Write down 3 specific things you\'re grateful for right now',
          'For each item, write why it matters to you',
          'Share your gratitude with someone else',
          'Take a moment to really feel the appreciation',
          'Set a reminder to practice gratitude daily'
        ],
        techniques: ['Gratitude journaling', 'Appreciation practice', 'Positive sharing'],
        duration: '10-15 minutes',
        difficulty: 'easy'
      },
      {
        category: 'happiness',
        title: 'Joy Sharing',
        description: 'Spread your positive energy to others',
        actionSteps: [
          'Think of someone who would appreciate hearing from you',
          'Send them a message sharing something positive',
          'Compliment a stranger or do a small act of kindness',
          'Share your good mood through a smile or laugh',
          'Plan something fun to do with others'
        ],
        techniques: ['Social connection', 'Kindness practice', 'Positive communication'],
        duration: '15-30 minutes',
        difficulty: 'easy'
      },
      {
        category: 'happiness',
        title: 'Savoring Practice',
        description: 'Fully experience and extend positive moments',
        actionSteps: [
          'Pause and notice what\'s making you happy right now',
          'Engage all your senses in the experience',
          'Take a mental photograph of this moment',
          'Share the experience with someone you care about',
          'Write about it to remember later'
        ],
        techniques: ['Mindful savoring', 'Present moment awareness', 'Memory creation'],
        duration: '5-10 minutes',
        difficulty: 'easy'
      },
      {
        category: 'happiness',
        title: 'Energy Investment',
        description: 'Use your positive energy for meaningful activities',
        actionSteps: [
          'Choose an activity that aligns with your values',
          'Set a small, achievable goal for today',
          'Take action while your energy is high',
          'Notice how good it feels to make progress',
          'Celebrate your accomplishment'
        ],
        techniques: ['Goal setting', 'Value-based action', 'Achievement recognition'],
        duration: '30-60 minutes',
        difficulty: 'medium'
      }
    ]);

    // Mixed emotions / general advice
    database.set('mixed', [
      {
        category: 'mixed',
        title: 'Emotional Check-In',
        description: 'Understand and validate complex emotions',
        actionSteps: [
          'Take a few deep breaths and center yourself',
          'Name each emotion you\'re experiencing',
          'Rate the intensity of each emotion (1-10)',
          'Ask yourself what each emotion might be telling you',
          'Practice accepting all emotions without judgment'
        ],
        techniques: ['Emotional awareness', 'Mindful observation', 'Self-validation'],
        duration: '10-15 minutes',
        difficulty: 'medium'
      },
      {
        category: 'mixed',
        title: 'Balanced Response',
        description: 'Address multiple emotions with balanced techniques',
        actionSteps: [
          'Choose one calming technique for difficult emotions',
          'Choose one energizing technique for positive emotions',
          'Alternate between both approaches',
          'Notice how your emotional state shifts',
          'Adjust your approach based on what feels most needed'
        ],
        techniques: ['Emotional regulation', 'Adaptive coping', 'Flexible response'],
        duration: '15-20 minutes',
        difficulty: 'medium'
      }
    ]);

    // Additional emotional categories
    database.set('anger', [
      {
        category: 'anger',
        title: 'Cooling Down Technique',
        description: 'Safely discharge anger energy',
        actionSteps: [
          'Remove yourself from the triggering situation if possible',
          'Count slowly from 1 to 10, breathing deeply',
          'Do vigorous exercise for 5-10 minutes',
          'Write about your feelings without censoring',
          'Wait before responding or making decisions'
        ],
        techniques: ['Anger management', 'Physical release', 'Emotional processing'],
        duration: '10-20 minutes',
        difficulty: 'easy'
      }
    ]);

    database.set('fear', [
      {
        category: 'fear',
        title: 'Courage Building',
        description: 'Face fears with gradual, supported steps',
        actionSteps: [
          'Identify what specifically you\'re afraid of',
          'Break the fear into smaller, manageable parts',
          'Take one small step toward facing the fear',
          'Use breathing techniques to stay calm',
          'Celebrate your courage in taking any step forward'
        ],
        techniques: ['Gradual exposure', 'Fear analysis', 'Courage practice'],
        duration: '15-30 minutes',
        difficulty: 'medium'
      }
    ]);

    return database;
  }

  /**
   * Get the complete advice database
   * @returns {Map} Complete advice database
   */
  getAdviceDatabase() {
    return this.adviceDatabase;
  }

  /**
   * Get all available emotional categories
   * @returns {Array} Array of emotion category names
   */
  getAvailableCategories() {
    return Array.from(this.adviceDatabase.keys());
  }

  /**
   * Search advice by keywords
   * @param {string} query - Search query
   * @returns {Array} Matching advice items
   */
  searchAdvice(query) {
    const results = [];
    const searchTerm = query.toLowerCase();

    this.adviceDatabase.forEach((adviceList, category) => {
      adviceList.forEach(advice => {
        if (
          advice.title.toLowerCase().includes(searchTerm) ||
          advice.description.toLowerCase().includes(searchTerm) ||
          advice.techniques.some(technique => technique.toLowerCase().includes(searchTerm))
        ) {
          results.push(advice);
        }
      });
    });

    return results;
  }

  /**
   * Clear cached advice (for testing or reset purposes)
   */
  clearCache() {
    try {
      localStorage.removeItem(this.cacheKey);
    } catch (error) {
      console.warn('Failed to clear advice cache:', error);
    }
  }
}

export default MoodAdviceService;