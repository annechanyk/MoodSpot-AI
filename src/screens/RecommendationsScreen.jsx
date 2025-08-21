import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import useMoodAnalysis from '../hooks/useMoodAnalysis'
import useLocationService from '../hooks/useLocationService'
import '../styles/recommendations-screen.css'

function RecommendationsScreen() {
  const navigate = useNavigate()
  const { analysisResult } = useMoodAnalysis()
  const { 
    searchNearbyBusinesses, 
    recommendationsLoading, 
    recommendationsError,
    hasLocationPermission,
    requestLocationPermission,
    getCurrentLocation,
    getLocationFromAddress,
    location,
    locationError,
    locationLoading
  } = useLocationService()
  
  const [businessRecommendations, setBusinessRecommendations] = useState([])
  const [locationStatus, setLocationStatus] = useState('ready')
  const [showManualInput, setShowManualInput] = useState(false)
  const [manualAddress, setManualAddress] = useState('')

  useEffect(() => {
    console.log('🎯 RECS: Component mounted, checking analysis result...')
    
    if (!analysisResult) {
      console.warn('⚠️ RECS: No analysis result, redirecting to home')
      navigate('/')
      return
    }

    console.log('✅ RECS: Analysis result found:', {
      mood: analysisResult.mood,
      hasBusinessRecs: !!(analysisResult.businessRecommendations?.length)
    })

    // Start with fallback recommendations immediately
    setBusinessRecommendations(analysisResult.businessRecommendations || [])
    setLocationStatus('ready')
    
    // Check API configuration
    console.log('🔑 RECS: Checking API configuration...')
    const apiConfigured = process.env.VITE_GOOGLE_PLACES_API_KEY || import.meta.env.VITE_GOOGLE_PLACES_API_KEY
    console.log('🔑 RECS: Google Places API key configured:', !!apiConfigured)
    
    if (!apiConfigured) {
      console.warn('⚠️ RECS: Google Places API key not configured')
      setLocationStatus('api_not_configured')
    }
  }, [analysisResult, navigate])

  // Get location-based recommendations with comprehensive error handling
  const getLocationRecommendations = async () => {
    console.log('🎯 RECS: Starting location recommendations...')
    
    try {
      setLocationStatus('getting_location')
      console.log('📍 RECS: Requesting location permission...')
      
      // Request location permission first
      const granted = await requestLocationPermission()
      if (!granted) {
        console.warn('⚠️ RECS: Location permission denied')
        setLocationStatus('permission_denied')
        setShowManualInput(true)
        return
      }

      console.log('✅ RECS: Permission granted, getting location...')
      
      // Get current location
      const userLocation = await getCurrentLocation()
      if (!userLocation) {
        console.warn('⚠️ RECS: Could not get location')
        setLocationStatus('location_failed')
        setShowManualInput(true)
        return
      }

      console.log('✅ RECS: Location obtained, searching businesses...')
      setLocationStatus('searching')
      
      // Search for nearby businesses
      const recommendations = await searchNearbyBusinesses(analysisResult.mood, userLocation)
      console.log('✅ RECS: Found recommendations:', recommendations.length)
      
      setBusinessRecommendations(recommendations)
      setLocationStatus('success')
      setShowManualInput(false)
      
    } catch (error) {
      console.error('❌ RECS: Failed to get recommendations:', error)
      setLocationStatus('error')
      setShowManualInput(true)
    }
  }

  // Handle manual address input
  const handleManualLocation = async () => {
    if (!manualAddress.trim()) {
      alert('Please enter a city or address')
      return
    }

    console.log('🏠 RECS: Using manual address:', manualAddress)
    
    try {
      setLocationStatus('getting_location')
      
      // Get location from address
      const userLocation = await getLocationFromAddress(manualAddress.trim())
      if (!userLocation) {
        setLocationStatus('location_failed')
        return
      }

      console.log('✅ RECS: Manual location obtained, searching businesses...')
      setLocationStatus('searching')
      
      // Search for nearby businesses
      const recommendations = await searchNearbyBusinesses(analysisResult.mood, userLocation)
      console.log('✅ RECS: Found recommendations:', recommendations.length)
      
      setBusinessRecommendations(recommendations)
      setLocationStatus('success')
      setShowManualInput(false)
      
    } catch (error) {
      console.error('❌ RECS: Manual location failed:', error)
      setLocationStatus('error')
      alert(`Could not find location: ${error.message}`)
    }
  }

  const handleStartOver = () => {
    navigate('/')
  }

  const handleBackToAnalysis = () => {
    navigate('/analysis')
  }

  const getLocationStatusMessage = () => {
    switch (locationStatus) {
      case 'getting_location':
        return 'Getting your location...'
      case 'searching':
        return 'Finding nearby places...'
      case 'permission_denied':
        return 'Location access was denied. You can try again or enter your location manually.'
      case 'location_failed':
        return 'Could not determine your location. Please try again or enter your location manually.'
      case 'error':
        return 'Error getting your location. Please try again or enter your location manually.'
      case 'success':
        return 'Found nearby places based on your location!'
      case 'api_not_configured':
        return 'Location services are not configured. Showing general recommendations.'
      default:
        return 'Click "Find Nearby Places" to get location-based recommendations.'
    }
  }

  if (!analysisResult) {
    return (
      <div className="screen recommendations-screen">
        <div className="error-state">
          <p>No analysis data available. Please start with a drawing.</p>
          <button className="button" onClick={handleStartOver}>
            Start Drawing
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="screen recommendations-screen">
      <header className="recommendations-header">
        <h1>Recommendations</h1>
        <p>Based on your {analysisResult.mood.toLowerCase()} mood</p>
        <div className="mood-indicator-small">
          <span className="mood-emoji">{analysisResult.emoji}</span>
          <span className="mood-name">{analysisResult.mood}</span>
        </div>
      </header>

      <main className="recommendations-main">
        {/* Activity Recommendations */}
        <section className="recommendations-section">
          <h2>Activities for You</h2>
          <div className="recommendations-list">
            {analysisResult.recommendations.map((rec, index) => (
              <div key={index} className="recommendation-card activity-card">
                <div className="recommendation-icon">{rec.icon}</div>
                <div className="recommendation-content">
                  <h3>{rec.title}</h3>
                  <p>{rec.description}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Business Recommendations */}
        <section className="recommendations-section">
          <div className="section-header">
            <h2>Places Near You</h2>
            {locationStatus === 'ready' && (
              <button 
                className="button button-secondary"
                onClick={getLocationRecommendations}
                disabled={recommendationsLoading}
              >
                📍 Find Nearby Places
              </button>
            )}
          </div>
          
          {(recommendationsLoading || ['getting_location', 'searching'].includes(locationStatus)) && (
            <div className="loading-state">
              <div className="loading-spinner"></div>
              <p>{getLocationStatusMessage()}</p>
            </div>
          )}

          {recommendationsError && (
            <div className="error-state">
              <p>Error: {recommendationsError}</p>
            </div>
          )}

          {(locationStatus === 'permission_denied' || locationStatus === 'location_failed' || locationStatus === 'error' || showManualInput) && (
            <div className="location-input-section">
              <div className="info-state">
                <p>📍 {getLocationStatusMessage()}</p>
                
                {!showManualInput ? (
                  <div className="location-buttons">
                    <button 
                      className="button button-secondary"
                      onClick={getLocationRecommendations}
                      disabled={locationLoading}
                    >
                      {locationLoading ? 'Getting Location...' : 'Try GPS Again'}
                    </button>
                    <button 
                      className="button button-primary"
                      onClick={() => setShowManualInput(true)}
                    >
                      Enter Location Manually
                    </button>
                  </div>
                ) : (
                  <div className="manual-location-input">
                    <h4>Enter Your Location</h4>
                    <div className="input-group">
                      <input
                        type="text"
                        placeholder="Enter city, address, or zip code..."
                        value={manualAddress}
                        onChange={(e) => setManualAddress(e.target.value)}
                        onKeyPress={(e) => e.key === 'Enter' && handleManualLocation()}
                        className="location-input"
                      />
                      <button 
                        className="button button-primary"
                        onClick={handleManualLocation}
                        disabled={locationLoading || !manualAddress.trim()}
                      >
                        {locationLoading ? 'Searching...' : 'Find Places'}
                      </button>
                    </div>
                    <button 
                      className="button button-secondary"
                      onClick={() => {
                        setShowManualInput(false)
                        setManualAddress('')
                      }}
                    >
                      Cancel
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {businessRecommendations.length > 0 && (
            <div className="business-recommendations">
              {businessRecommendations.slice(0, 6).map((business, index) => (
                <div key={business.placeId || index} className="recommendation-card business-card">
                  <div className="business-info">
                    <h3>{business.name}</h3>
                    <p className="business-category">{business.category.replace('_', ' ')}</p>
                    <div className="business-details">
                      {business.rating > 0 && (
                        <span className="rating">
                          ⭐ {business.rating.toFixed(1)}
                        </span>
                      )}
                      {business.distance > 0 && (
                        <span className="distance">
                          📍 {business.distance > 1000 
                            ? `${(business.distance / 1000).toFixed(1)}km` 
                            : `${business.distance}m`}
                        </span>
                      )}
                      {business.isOpen !== null && (
                        <span className={`status ${business.isOpen ? 'open' : 'closed'}`}>
                          {business.isOpen ? '🟢 Open' : '🔴 Closed'}
                        </span>
                      )}
                    </div>
                    <p className="business-address">{business.address}</p>
                  </div>
                </div>
              ))}
            </div>
          )}

          {locationStatus === 'success' && businessRecommendations.length === 0 && (
            <div className="empty-state">
              <p>No nearby places found. Try expanding your search area.</p>
            </div>
          )}
        </section>

        <div className="recommendations-actions">
          <button 
            className="button"
            onClick={handleStartOver}
          >
            New Drawing
          </button>
          <button 
            className="button button-secondary"
            onClick={handleBackToAnalysis}
          >
            Back to Analysis
          </button>
        </div>
      </main>
    </div>
  )
}

export default RecommendationsScreen