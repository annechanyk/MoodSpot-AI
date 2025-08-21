/**
 * MoodSpot Branding Configuration
 * App name, colors, and branding constants
 */

export const BRANDING = {
  APP_NAME: 'MoodSpot',
  APP_TAGLINE: 'Discover your mood, find your spot',
  APP_DESCRIPTION: 'Express your emotions through drawing and discover personalized local recommendations',
  
  // Color palette
  COLORS: {
    PRIMARY: '#6366F1', // Indigo
    SECONDARY: '#EC4899', // Pink
    SUCCESS: '#10B981', // Emerald
    WARNING: '#F59E0B', // Amber
    ERROR: '#EF4444', // Red
    
    // Mood colors
    HAPPY: '#FFD700', // Gold
    CALM: '#87CEEB', // Sky Blue
    EXCITED: '#FF6B6B', // Coral
    PEACEFUL: '#98D8C8', // Mint
    ANXIOUS: '#FFA07A', // Light Salmon
    CREATIVE: '#DDA0DD', // Plum
    ENERGETIC: '#FF7F50', // Coral
    CONTEMPLATIVE: '#B0C4DE' // Light Steel Blue
  },
  
  // App metadata
  META: {
    VERSION: '1.0.0',
    AUTHOR: 'MoodSpot Team',
    COPYRIGHT: `© ${new Date().getFullYear()} MoodSpot`,
    WEBSITE: 'https://moodspot.app',
    SUPPORT_EMAIL: 'support@moodspot.app'
  },
  
  // Feature names
  FEATURES: {
    DRAWING: 'Mood Canvas',
    ANALYSIS: 'Mood Insights',
    RECOMMENDATIONS: 'Spot Finder',
    HISTORY: 'Mood Journey'
  },
  
  // UI Text
  UI_TEXT: {
    WELCOME_MESSAGE: 'Welcome to MoodSpot',
    DRAWING_PROMPT: 'Draw how you\'re feeling right now',
    ANALYSIS_LOADING: 'Analyzing your mood...',
    RECOMMENDATIONS_TITLE: 'Perfect spots for your mood',
    QUOTA_WARNING: 'Daily limit reached',
    OFFLINE_MESSAGE: 'You\'re offline - showing cached results'
  }
}

/**
 * Get mood color by name
 */
export function getMoodColor(mood) {
  const normalizedMood = mood.toUpperCase()
  return BRANDING.COLORS[normalizedMood] || BRANDING.COLORS.PRIMARY
}

/**
 * Get app title with tagline
 */
export function getAppTitle() {
  return `${BRANDING.APP_NAME} - ${BRANDING.APP_TAGLINE}`
}

/**
 * Get feature display name
 */
export function getFeatureName(feature) {
  return BRANDING.FEATURES[feature.toUpperCase()] || feature
}

export default BRANDING