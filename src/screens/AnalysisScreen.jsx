import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import TiDBStatus from '../components/TiDBStatus.jsx'
import useMoodAnalysis from '../hooks/useMoodAnalysis'
import '../styles/analysis-screen.css'

function AnalysisScreen() {
  const navigate = useNavigate()
  const { isAnalyzing, analysisResult } = useMoodAnalysis()
  const [showResults, setShowResults] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    console.log('📊 AnalysisScreen mounted')
    return () => {
      console.log('📊 AnalysisScreen unmounting')
    }
  }, [])

  useEffect(() => {
    console.log('📊 AnalysisScreen effect:', { analysisResult, isAnalyzing })
    
    // If we have analysis result, show it
    if (analysisResult && !isAnalyzing) {
      console.log('✅ Showing analysis results with recommendations')
      setTimeout(() => setShowResults(true), 500)
    }
    // If no analysis result and not analyzing, redirect to home
    else if (!analysisResult && !isAnalyzing) {
      console.log('❌ No analysis result, redirecting to home')
      navigate('/')
    }
  }, [analysisResult, isAnalyzing, navigate])

  const handleStartOver = () => {
    navigate('/')
  }

  return (
    <div className="screen analysis-screen">
      <header className="analysis-header">
        <h1>Mood Analysis</h1>
        <TiDBStatus />
      </header>

      <main className="analysis-main">
        {isAnalyzing && (
          <div className="analysis-loading">
            <div className="loading-spinner"></div>
            <p>Analyzing your drawing and preparing personalized advice...</p>
            <p className="analysis-tip">Using AI to understand your mood through visual elements...</p>
          </div>
        )}

        {error && (
          <div className="analysis-error">
            <div className="error-icon">⚠️</div>
            <h3>Analysis Unavailable</h3>
            <p>{error}</p>
            <button 
              className="button button-secondary"
              onClick={handleStartOver}
            >
              Try Drawing Again
            </button>
          </div>
        )}

        {showResults && analysisResult && (
          <div className="analysis-results">
            {/* Mood Analysis Results */}
            <div className="mood-indicator">
              <h2>Your Mood</h2>
              <div className="mood-circle" style={{ backgroundColor: analysisResult.color }}>
                <span className="mood-emoji">{analysisResult.emoji}</span>
              </div>
              <h3>{analysisResult.mood}</h3>
            </div>

            <div className="analysis-details">
              <p>{analysisResult.description}</p>
              <div className="analysis-metadata">
                {analysisResult.confidence && (
                  <p className="confidence-score">
                    Confidence: {Math.round(analysisResult.confidence * 100)}%
                  </p>
                )}
                {analysisResult.processingTime && (
                  <p className="processing-time">
                    Analysis time: {(analysisResult.processingTime / 1000).toFixed(1)}s
                  </p>
                )}
                {analysisResult.isMockData && (
                  <p className="mock-indicator">
                    🎭 Demo mode - using sample analysis
                  </p>
                )}
              </div>
            </div>

            {/* Mood Recommendations Section */}
            {analysisResult.recommendations && analysisResult.recommendations.length > 0 && (
              <div className="mood-advice-section">
                <h2>Personalized Recommendations</h2>
                <p className="advice-message">
                  Based on your {analysisResult.primaryMood || analysisResult.mood} mood, here are some suggestions to help you feel better:
                </p>
                
                <div className="advice-cards">
                  {analysisResult.recommendations.map((recommendation, index) => (
                    <div key={index} className="advice-card">
                      <div className="advice-header">
                        <div className="advice-icon">{recommendation.icon}</div>
                        <h3>{recommendation.title}</h3>
                      </div>
                      
                      <p className="advice-description">{recommendation.description}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="analysis-actions">
              <button 
                className="button button-primary"
                onClick={handleStartOver}
              >
                Draw Again
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}

export default AnalysisScreen