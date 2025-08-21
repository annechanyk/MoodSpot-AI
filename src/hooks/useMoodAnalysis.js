import { useState } from 'react'
import { moodAnalysisService } from '../services'

const mockAnalysisResults = [
  {
    mood: 'Happy',
    emoji: '😊',
    color: '#FFD700',
    description: 'Your drawing shows bright, energetic strokes that suggest a positive and uplifting mood.',
    recommendations: [
      {
        icon: '🎵',
        title: 'Listen to upbeat music',
        description: 'Keep the positive energy flowing with your favorite uplifting songs.'
      },
      {
        icon: '🏃‍♀️',
        title: 'Go for a walk',
        description: 'Channel this energy into some light physical activity outdoors.'
      },
      {
        icon: '📞',
        title: 'Connect with friends',
        description: 'Share your good mood by reaching out to someone you care about.'
      }
    ]
  },
  {
    mood: 'Calm',
    emoji: '😌',
    color: '#87CEEB',
    description: 'Your drawing reflects a peaceful state with gentle, flowing movements.',
    recommendations: [
      {
        icon: '🧘‍♀️',
        title: 'Practice meditation',
        description: 'Maintain this peaceful state with a short mindfulness session.'
      },
      {
        icon: '📚',
        title: 'Read a book',
        description: 'Enjoy some quiet time with a good book or magazine.'
      },
      {
        icon: '🍃',
        title: 'Spend time in nature',
        description: 'Take a peaceful moment outdoors to connect with nature.'
      }
    ]
  },
  {
    mood: 'Anxious',
    emoji: '😰',
    color: '#FF6B6B',
    description: 'Your drawing shows quick, scattered strokes that may indicate feelings of worry or stress.',
    recommendations: [
      {
        icon: '🫁',
        title: 'Deep breathing',
        description: 'Try the 4-7-8 breathing technique to help calm your nervous system.'
      },
      {
        icon: '📝',
        title: 'Write it down',
        description: 'Journal about what\'s on your mind to help process your thoughts.'
      },
      {
        icon: '☕',
        title: 'Take a break',
        description: 'Step away from stressful activities and have a warm drink.'
      }
    ]
  }
]

function useMoodAnalysis() {
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [analysisResult, setAnalysisResult] = useState(() => {
    // Try to restore from sessionStorage on initialization
    try {
      const saved = sessionStorage.getItem('moodspot_analysis_result')
      if (saved) {
        console.log('🔄 Restored analysis result from sessionStorage')
        return JSON.parse(saved)
      }
    } catch (error) {
      console.warn('Failed to restore from sessionStorage:', error)
    }
    return null
  })

  const analyzeDrawing = async (exportData = null) => {
    console.log('🧠 Starting mood analysis...', exportData)
    setIsAnalyzing(true)
    setAnalysisResult(null)
    
    // Clear sessionStorage when starting new analysis
    try {
      sessionStorage.removeItem('moodspot_analysis_result')
    } catch (error) {
      console.warn('Failed to clear sessionStorage:', error)
    }
    
    try {
      // Log drawing data for debugging
      if (exportData) {
        console.log('📊 Analyzing drawing:', {
          dimensions: `${exportData.width}x${exportData.height}`,
          compressionRatio: `${exportData.compressionRatio?.toFixed(1)}%`,
          originalSize: `${(exportData.originalSize / 1024).toFixed(1)}KB`,
          compressedSize: `${(exportData.compressedSize / 1024).toFixed(1)}KB`
        })
      } else {
        console.warn('⚠️ No export data provided to analyzeDrawing')
      }
      
      // Use the actual MoodAnalysisService
      console.log('🔍 Using MoodAnalysisService for real analysis...')
      
      const analysisResult = await moodAnalysisService.analyzeMood(exportData)
      
      console.log('✅ Real analysis result:', analysisResult)
      
      // Skip location-based recommendations during analysis for faster response
      // Location recommendations will be fetched later in RecommendationsScreen
      console.log('⚡ Skipping location recommendations for faster analysis')
      const businessRecommendations = getGenericRecommendationsForMood(analysisResult.primaryMood)

      // Transform the result to match the expected format for the UI
      const transformedResult = {
        mood: analysisResult.primaryMood,
        primaryMood: analysisResult.primaryMood, // Keep both for compatibility
        emoji: getMoodEmoji(analysisResult.primaryMood),
        color: getMoodColor(analysisResult.primaryMood),
        description: analysisResult.description,
        confidence: analysisResult.confidence,
        emotions: analysisResult.emotions || [analysisResult.primaryMood],
        businessCategories: analysisResult.businessCategories || [],
        recommendations: analysisResult.recommendations || [], // Use real API recommendations
        businessRecommendations: businessRecommendations, // Add business recommendations
        drawingData: exportData,
        analysisTimestamp: new Date().toISOString(),
        processingTime: analysisResult.processingTime || 0,
        isMockData: analysisResult.isMockData || false
      }
      
      // Validate the transformed result
      if (!transformedResult.mood || !transformedResult.description) {
        throw new Error('Invalid analysis result: missing required fields')
      }
      
      console.log('💾 Setting analysis result:', transformedResult)
      setAnalysisResult(transformedResult)
      
      // Also save to sessionStorage for persistence across navigation
      try {
        sessionStorage.setItem('moodspot_analysis_result', JSON.stringify(transformedResult))
        console.log('💾 Saved analysis result to sessionStorage')
      } catch (error) {
        console.warn('Failed to save to sessionStorage:', error)
      }
      
      console.log('🎉 Analysis completed successfully!')
      return transformedResult
      
    } catch (error) {
      console.error('❌ Analysis failed:', error)
      
      // Create a fallback result for any error
      const fallbackMood = 'creative'
      const fallbackResult = {
        mood: fallbackMood,
        primaryMood: fallbackMood,
        emoji: getMoodEmoji(fallbackMood),
        color: getMoodColor(fallbackMood),
        description: 'Your drawing shows creative expression. We encountered an issue with detailed analysis, but your creativity shines through!',
        confidence: 0.7,
        emotions: [fallbackMood],
        businessCategories: ['cafe', 'art_gallery', 'park'],
        recommendations: [
          {
            title: 'Express Yourself',
            description: 'Continue creating art as a way to process your emotions and express your inner world.',
            icon: '🎨'
          },
          {
            title: 'Take a Moment',
            description: 'Pause and breathe deeply to center yourself after this technical hiccup.',
            icon: '🫁'
          },
          {
            title: 'Try Again',
            description: 'Feel free to draw again when you\'re ready - technology sometimes needs a second chance.',
            icon: '🔄'
          }
        ],
        businessRecommendations: getGenericRecommendationsForMood(fallbackMood),
        drawingData: exportData,
        analysisTimestamp: new Date().toISOString(),
        processingTime: 0,
        isMockData: true,
        isError: false // Don't mark as error, just use fallback
      }
      
      console.log('🔄 Using fallback analysis result:', fallbackResult)
      setAnalysisResult(fallbackResult)
      
      // Also save fallback to sessionStorage
      try {
        sessionStorage.setItem('moodspot_analysis_result', JSON.stringify(fallbackResult))
      } catch (error) {
        console.warn('Failed to save fallback to sessionStorage:', error)
      }
      
      return fallbackResult
    } finally {
      setIsAnalyzing(false)
    }
  }

  // Helper function to get emoji for mood (15 categories)
  const getMoodEmoji = (mood) => {
    const emojiMap = {
      happy: '😊',
      sad: '😢',
      anxious: '😰',
      calm: '😌',
      creative: '🎨',
      energetic: '⚡',
      tired: '😴',
      angry: '😠',
      excited: '🤩',
      peaceful: '☮️',
      confident: '💪',
      overwhelmed: '🤯',
      lonely: '😔',
      frustrated: '😤',
      inspired: '✨'
    }
    return emojiMap[mood.toLowerCase()] || '😐'
  }

  // Helper function to get color for mood (15 categories)
  const getMoodColor = (mood) => {
    const colorMap = {
      happy: '#FFD700',
      sad: '#6495ED',
      anxious: '#FF6B6B',
      calm: '#87CEEB',
      creative: '#FF69B4',
      energetic: '#32CD32',
      tired: '#9370DB',
      angry: '#DC143C',
      excited: '#FF6B35',
      peaceful: '#98FB98',
      confident: '#FF8C00',
      overwhelmed: '#FF4444',
      lonely: '#708090',
      frustrated: '#CD5C5C',
      inspired: '#DA70D6'
    }
    return colorMap[mood.toLowerCase()] || '#808080'
  }

  // Helper function to get generic recommendations when location is not available
  const getGenericRecommendationsForMood = (mood) => {
    const genericRecommendations = {
      happy: [
        { placeId: 'generic-1', name: 'Local Coffee Shop', category: 'cafe', rating: 4.2, distance: 0, address: 'Nearby location', isOpen: null },
        { placeId: 'generic-2', name: 'Community Park', category: 'park', rating: 4.5, distance: 0, address: 'Nearby location', isOpen: true },
        { placeId: 'generic-3', name: 'Shopping Center', category: 'shopping_mall', rating: 4.0, distance: 0, address: 'Nearby location', isOpen: null }
      ],
      sad: [
        { placeId: 'generic-4', name: 'Cozy Cafe', category: 'cafe', rating: 4.3, distance: 0, address: 'Nearby location', isOpen: null },
        { placeId: 'generic-5', name: 'Local Library', category: 'library', rating: 4.4, distance: 0, address: 'Nearby location', isOpen: true },
        { placeId: 'generic-6', name: 'Quiet Park', category: 'park', rating: 4.2, distance: 0, address: 'Nearby location', isOpen: true }
      ],
      anxious: [
        { placeId: 'generic-7', name: 'Wellness Spa', category: 'spa', rating: 4.6, distance: 0, address: 'Nearby location', isOpen: null },
        { placeId: 'generic-8', name: 'Peaceful Park', category: 'park', rating: 4.3, distance: 0, address: 'Nearby location', isOpen: true },
        { placeId: 'generic-9', name: 'Meditation Center', category: 'gym', rating: 4.1, distance: 0, address: 'Nearby location', isOpen: null }
      ],
      excited: [
        { placeId: 'generic-10', name: 'Entertainment Center', category: 'amusement_park', rating: 4.4, distance: 0, address: 'Nearby location', isOpen: null },
        { placeId: 'generic-11', name: 'Popular Restaurant', category: 'restaurant', rating: 4.2, distance: 0, address: 'Nearby location', isOpen: null },
        { placeId: 'generic-12', name: 'Shopping Mall', category: 'shopping_mall', rating: 4.0, distance: 0, address: 'Nearby location', isOpen: true }
      ]
    }
    
    return genericRecommendations[mood.toLowerCase()] || genericRecommendations.happy
  }

  const clearAnalysis = () => {
    console.log('🧹 Clearing analysis result')
    setAnalysisResult(null)
    try {
      sessionStorage.removeItem('moodspot_analysis_result')
    } catch (error) {
      console.warn('Failed to clear sessionStorage:', error)
    }
  }

  return {
    analyzeDrawing,
    isAnalyzing,
    analysisResult,
    clearAnalysis
  }
}

export default useMoodAnalysis