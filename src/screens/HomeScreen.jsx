import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import DrawingCanvas from '../components/DrawingCanvas'
import TiDBStatus from '../components/TiDBStatus.jsx'
import useMoodAnalysis from '../hooks/useMoodAnalysis'
import '../styles/home-screen.css'

function HomeScreen() {
  const navigate = useNavigate()
  const { analyzeDrawing, isAnalyzing, clearAnalysis } = useMoodAnalysis()
  const [hasDrawing, setHasDrawing] = useState(false)

  useEffect(() => {
    console.log('🏠 HomeScreen mounted')
    // Clear any previous analysis when returning to home
    clearAnalysis()
    return () => {
      console.log('🏠 HomeScreen unmounting')
    }
  }, [clearAnalysis])

  const handleDrawingComplete = async (exportData) => {
    console.log('🎨 HOME: Drawing completed, starting analysis...', exportData)
    
    if (isAnalyzing) {
      console.log('⚠️ HOME: Analysis already in progress, ignoring duplicate request')
      return
    }
    
    try {
      console.log('🧠 HOME: Calling analyzeDrawing...')
      const result = await analyzeDrawing(exportData)
      console.log('✅ HOME: Analysis completed successfully:', result)
      
      if (result && !result.isError) {
        console.log('🧭 HOME: Analysis successful, navigating to /analysis...')
        console.log('📊 HOME: Result details:', {
          mood: result.mood,
          confidence: result.confidence,
          hasDescription: !!result.description
        })
        
        // Navigate immediately - no delay needed
        console.log('🚀 HOME: Executing navigation to /analysis')
        navigate('/analysis')
        console.log('✅ HOME: Navigation call completed')
      } else {
        console.error('❌ HOME: Analysis failed or returned error result:', result)
        alert('Analysis failed. Please try drawing again.')
      }
      
    } catch (error) {
      console.error('❌ HOME: Analysis failed with error:', error)
      console.error('❌ HOME: Error stack:', error.stack)
      alert(`Analysis failed: ${error.message}. Please try again.`)
    }
  }

  const handleDrawingChange = (hasContent) => {
    setHasDrawing(hasContent)
  }

  return (
    <div className="screen home-screen">
      <header className="home-header">
        <h1>MoodSpot</h1>
        <p>Express your feelings through drawing and get personalized advice</p>
        <TiDBStatus />
      </header>
      
      <main className="home-main">
        <div className="canvas-container">
          <DrawingCanvas 
            onDrawingComplete={handleDrawingComplete}
            onDrawingChange={handleDrawingChange}
            showSubmitButton={hasDrawing && !isAnalyzing}
            submitButtonText={isAnalyzing ? "Analyzing..." : "Analyze My Drawing"}
            disabled={isAnalyzing}
          />
        </div>
        
        {isAnalyzing && (
          <div className="analysis-loading">
            <div className="loading-spinner"></div>
            <p>Analyzing your drawing and preparing personalized advice...</p>
            <p className="analysis-tip">This may take a few moments...</p>
          </div>
        )}
      </main>
    </div>
  )
}

export default HomeScreen