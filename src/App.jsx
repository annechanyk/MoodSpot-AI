import React, { useEffect } from 'react'
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import HomeScreen from './screens/HomeScreen'
import AnalysisScreen from './screens/AnalysisScreen'
import ErrorBoundary from './components/ErrorBoundary'
import UniverseBackground from './components/UniverseBackground'
import { initializeServices } from './services'
import { BRANDING } from './config/branding'
import './styles/app.css'

function App() {
  useEffect(() => {
    // Set document title
    document.title = `${BRANDING.APP_NAME} - ${BRANDING.APP_TAGLINE}`
    
    // Initialize services
    initializeServices().catch(error => {
      console.error('Failed to initialize MoodSpot services:', error)
    })
  }, [])

  return (
    <ErrorBoundary>
      <Router>
        <div className="app" data-app="moodspot">
          <UniverseBackground />
          <div className="app-content">
            <Routes>
              <Route path="/" element={<HomeScreen />} />
              <Route path="/analysis" element={<AnalysisScreen />} />
            </Routes>
          </div>
        </div>
      </Router>
    </ErrorBoundary>
  )
}

export default App