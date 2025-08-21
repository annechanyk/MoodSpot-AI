import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import MoodAdviceService from '../MoodAdviceService.js';

describe('MoodAdviceService', () => {
  let service;
  let mockLocalStorage;

  beforeEach(() => {
    // Mock localStorage
    mockLocalStorage = {
      getItem: vi.fn(),
      setItem: vi.fn(),
      removeItem: vi.fn()
    };
    global.localStorage = mockLocalStorage;
    
    service = new MoodAdviceService();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Initialization', () => {
    it('should initialize with comprehensive advice database', () => {
      const database = service.getAdviceDatabase();
      
      expect(database).toBeInstanceOf(Map);
      expect(database.has('anxiety')).toBe(true);
      expect(database.has('sadness')).toBe(true);
      expect(database.has('stress')).toBe(true);
      expect(database.has('happiness')).toBe(true);
      expect(database.has('mixed')).toBe(true);
      expect(database.has('anger')).toBe(true);
      expect(database.has('fear')).toBe(true);
    });

    it('should have properly structured advice items', () => {
      const anxietyAdvice = service.getAdviceByCategory('anxiety');
      
      expect(anxietyAdvice.length).toBeGreaterThan(0);
      
      const firstAdvice = anxietyAdvice[0];
      expect(firstAdvice).toHaveProperty('category');
      expect(firstAdvice).toHaveProperty('title');
      expect(firstAdvice).toHaveProperty('description');
      expect(firstAdvice).toHaveProperty('actionSteps');
      expect(firstAdvice).toHaveProperty('techniques');
      expect(firstAdvice).toHaveProperty('duration');
      expect(firstAdvice).toHaveProperty('difficulty');
      
      expect(Array.isArray(firstAdvice.actionSteps)).toBe(true);
      expect(Array.isArray(firstAdvice.techniques)).toBe(true);
      expect(['easy', 'medium', 'advanced']).toContain(firstAdvice.difficulty);
    });
  });

  describe('getAdviceForMood', () => {
    it('should return personalized advice for anxiety', () => {
      const moodResult = {
        primaryMood: 'Anxiety',
        confidence: 0.8,
        emotions: [
          { name: 'anxiety', intensity: 0.8 },
          { name: 'stress', intensity: 0.4 }
        ]
      };

      const recommendation = service.getAdviceForMood(moodResult);

      expect(recommendation).toHaveProperty('mood', 'Anxiety');
      expect(recommendation).toHaveProperty('intensity', 0.8);
      expect(recommendation).toHaveProperty('advice');
      expect(recommendation).toHaveProperty('personalizedMessage');
      expect(recommendation).toHaveProperty('timestamp');
      expect(recommendation).toHaveProperty('cacheId');

      expect(Array.isArray(recommendation.advice)).toBe(true);
      expect(recommendation.advice.length).toBeGreaterThan(0);
      expect(recommendation.advice.length).toBeLessThanOrEqual(6);
    });

    it('should include advice for secondary emotions with high intensity', () => {
      const moodResult = {
        primaryMood: 'Anxiety',
        confidence: 0.7,
        emotions: [
          { name: 'anxiety', intensity: 0.7 },
          { name: 'sadness', intensity: 0.6 }, // Should be included (> 0.3)
          { name: 'happiness', intensity: 0.2 } // Should be excluded (< 0.3)
        ]
      };

      const recommendation = service.getAdviceForMood(moodResult);
      
      // Should have advice from both anxiety and sadness categories
      const categories = recommendation.advice.map(advice => advice.category);
      expect(categories).toContain('anxiety');
      expect(categories).toContain('sadness');
    });

    it('should personalize advice based on mood intensity', () => {
      const highIntensityMood = {
        primaryMood: 'Anxiety',
        confidence: 0.9,
        emotions: [{ name: 'anxiety', intensity: 0.9 }]
      };

      const recommendation = service.getAdviceForMood(highIntensityMood);
      
      // High intensity should prioritize easy techniques
      const difficulties = recommendation.advice.map(advice => advice.difficulty);
      expect(difficulties.filter(d => d === 'easy').length).toBeGreaterThan(0);
    });

    it('should generate appropriate personalized messages', () => {
      const anxietyMood = {
        primaryMood: 'Anxiety',
        confidence: 0.7,
        emotions: [{ name: 'anxiety', intensity: 0.7 }]
      };

      const recommendation = service.getAdviceForMood(anxietyMood);
      
      expect(typeof recommendation.personalizedMessage).toBe('string');
      expect(recommendation.personalizedMessage.length).toBeGreaterThan(0);
    });
  });

  describe('getAdviceByCategory', () => {
    it('should return advice for valid categories', () => {
      const anxietyAdvice = service.getAdviceByCategory('anxiety');
      const stressAdvice = service.getAdviceByCategory('stress');
      
      expect(Array.isArray(anxietyAdvice)).toBe(true);
      expect(Array.isArray(stressAdvice)).toBe(true);
      expect(anxietyAdvice.length).toBeGreaterThan(0);
      expect(stressAdvice.length).toBeGreaterThan(0);
    });

    it('should return empty array for invalid categories', () => {
      const invalidAdvice = service.getAdviceByCategory('nonexistent');
      
      expect(Array.isArray(invalidAdvice)).toBe(true);
      expect(invalidAdvice.length).toBe(0);
    });

    it('should handle case insensitive category names', () => {
      const lowerCase = service.getAdviceByCategory('anxiety');
      const upperCase = service.getAdviceByCategory('ANXIETY');
      const mixedCase = service.getAdviceByCategory('AnXiEtY');
      
      expect(lowerCase).toEqual(upperCase);
      expect(lowerCase).toEqual(mixedCase);
    });
  });

  describe('personalizeAdvice', () => {
    it('should calculate relevance scores correctly', () => {
      const moodResult = {
        primaryMood: 'anxiety',
        confidence: 0.8,
        emotions: [{ name: 'anxiety', intensity: 0.8 }]
      };

      const advice = service.getAdviceByCategory('anxiety');
      const personalized = service.personalizeAdvice(advice, moodResult, []);

      expect(personalized.length).toBeLessThanOrEqual(6);
      expect(personalized.length).toBeGreaterThan(0);
      
      // Should not have relevanceScore property in final result
      personalized.forEach(item => {
        expect(item).not.toHaveProperty('relevanceScore');
      });
    });

    it('should boost scores for historical preferences', () => {
      const moodResult = {
        primaryMood: 'anxiety',
        confidence: 0.7,
        emotions: [{ name: 'anxiety', intensity: 0.7 }]
      };

      const userHistory = [{
        advice: [{ category: 'anxiety', title: 'Deep Breathing Exercise' }]
      }];

      const personalized = service.personalizeAdvice(
        service.getAdviceByCategory('anxiety'),
        moodResult,
        userHistory
      );

      expect(personalized.length).toBeGreaterThan(0);
    });
  });

  describe('Caching functionality', () => {
    it('should cache advice recommendations', () => {
      const recommendation = {
        mood: 'Anxiety',
        advice: [],
        cacheId: 'test-cache-id',
        timestamp: new Date()
      };

      service.cacheAdvice(recommendation);

      expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
        'mood_advice_cache',
        expect.any(String)
      );
    });

    it('should retrieve cached advice by ID', () => {
      const cachedData = {
        'test-id': {
          mood: 'Anxiety',
          advice: [],
          cachedAt: Date.now()
        }
      };

      mockLocalStorage.getItem.mockReturnValue(JSON.stringify(cachedData));

      const retrieved = service.getCachedAdviceById('test-id');
      
      expect(retrieved).toBeTruthy();
      expect(retrieved.mood).toBe('Anxiety');
    });

    it('should return null for expired cache', () => {
      const expiredData = {
        'test-id': {
          mood: 'Anxiety',
          advice: [],
          cachedAt: Date.now() - (25 * 60 * 60 * 1000) // 25 hours ago
        }
      };

      mockLocalStorage.getItem.mockReturnValue(JSON.stringify(expiredData));

      const retrieved = service.getCachedAdviceById('test-id');
      
      expect(retrieved).toBeNull();
    });

    it('should handle localStorage errors gracefully', () => {
      mockLocalStorage.getItem.mockImplementation(() => {
        throw new Error('Storage error');
      });

      const cache = service.getCachedAdvice();
      
      expect(cache).toEqual({});
    });

    it('should clear cache', () => {
      service.clearCache();
      
      expect(mockLocalStorage.removeItem).toHaveBeenCalledWith('mood_advice_cache');
    });
  });

  describe('generateCacheId', () => {
    it('should generate consistent cache IDs', () => {
      const moodResult = {
        primaryMood: 'Anxiety',
        emotions: [
          { name: 'anxiety', intensity: 0.8 },
          { name: 'stress', intensity: 0.4 }
        ]
      };

      const id1 = service.generateCacheId(moodResult);
      const id2 = service.generateCacheId(moodResult);

      expect(id1).toBe(id2);
      expect(typeof id1).toBe('string');
      expect(id1.length).toBeGreaterThan(0);
    });

    it('should generate different IDs for different moods', () => {
      const mood1 = {
        primaryMood: 'Anxiety',
        emotions: [{ name: 'anxiety', intensity: 0.8 }]
      };

      const mood2 = {
        primaryMood: 'Sadness',
        emotions: [{ name: 'sadness', intensity: 0.7 }]
      };

      const id1 = service.generateCacheId(mood1);
      const id2 = service.generateCacheId(mood2);

      expect(id1).not.toBe(id2);
    });
  });

  describe('searchAdvice', () => {
    it('should find advice by title keywords', () => {
      const results = service.searchAdvice('breathing');
      
      expect(Array.isArray(results)).toBe(true);
      expect(results.length).toBeGreaterThan(0);
      
      const hasBreathingAdvice = results.some(advice => 
        advice.title.toLowerCase().includes('breathing')
      );
      expect(hasBreathingAdvice).toBe(true);
    });

    it('should find advice by technique keywords', () => {
      const results = service.searchAdvice('meditation');
      
      expect(Array.isArray(results)).toBe(true);
      
      const hasMeditationTechnique = results.some(advice =>
        advice.techniques.some(technique => 
          technique.toLowerCase().includes('meditation')
        )
      );
      expect(hasMeditationTechnique).toBe(true);
    });

    it('should return empty array for no matches', () => {
      const results = service.searchAdvice('nonexistentkeyword123');
      
      expect(Array.isArray(results)).toBe(true);
      expect(results.length).toBe(0);
    });

    it('should be case insensitive', () => {
      const lowerResults = service.searchAdvice('breathing');
      const upperResults = service.searchAdvice('BREATHING');
      const mixedResults = service.searchAdvice('BrEaThInG');
      
      expect(lowerResults.length).toBe(upperResults.length);
      expect(lowerResults.length).toBe(mixedResults.length);
    });
  });

  describe('getAvailableCategories', () => {
    it('should return all available emotion categories', () => {
      const categories = service.getAvailableCategories();
      
      expect(Array.isArray(categories)).toBe(true);
      expect(categories).toContain('anxiety');
      expect(categories).toContain('sadness');
      expect(categories).toContain('stress');
      expect(categories).toContain('happiness');
      expect(categories).toContain('mixed');
      expect(categories).toContain('anger');
      expect(categories).toContain('fear');
    });
  });

  describe('removeDuplicateAdvice', () => {
    it('should remove duplicate advice items', () => {
      const duplicateAdvice = [
        { category: 'anxiety', title: 'Deep Breathing', description: 'Test' },
        { category: 'anxiety', title: 'Deep Breathing', description: 'Test' },
        { category: 'stress', title: 'Quick Reset', description: 'Test' }
      ];

      const unique = service.removeDuplicateAdvice(duplicateAdvice);
      
      expect(unique.length).toBe(2);
      expect(unique[0].title).toBe('Deep Breathing');
      expect(unique[1].title).toBe('Quick Reset');
    });

    it('should preserve order of first occurrence', () => {
      const advice = [
        { category: 'anxiety', title: 'First', description: 'Test' },
        { category: 'stress', title: 'Second', description: 'Test' },
        { category: 'anxiety', title: 'First', description: 'Test' }
      ];

      const unique = service.removeDuplicateAdvice(advice);
      
      expect(unique.length).toBe(2);
      expect(unique[0].title).toBe('First');
      expect(unique[1].title).toBe('Second');
    });
  });

  describe('generatePersonalizedMessage', () => {
    it('should generate different messages for different moods', () => {
      const anxietyMood = { primaryMood: 'anxiety', confidence: 0.7 };
      const happinessMood = { primaryMood: 'happiness', confidence: 0.8 };

      const anxietyMessage = service.generatePersonalizedMessage(anxietyMood, []);
      const happinessMessage = service.generatePersonalizedMessage(happinessMood, []);

      expect(typeof anxietyMessage).toBe('string');
      expect(typeof happinessMessage).toBe('string');
      expect(anxietyMessage).not.toBe(happinessMessage);
    });

    it('should personalize messages for returning users', () => {
      const mood = { primaryMood: 'anxiety', confidence: 0.7 };
      const history = [
        { timestamp: new Date() },
        { timestamp: new Date() },
        { timestamp: new Date() }
      ];

      const message = service.generatePersonalizedMessage(mood, history);
      
      expect(message.toLowerCase()).toContain('welcome back');
    });
  });
});