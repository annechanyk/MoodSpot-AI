import React, { useEffect, useState } from 'react'
import useTiDBStatus from '../hooks/useTiDBStatus.js'
import tidbService from '../services/TiDBAPIService.js'

function TiDBStatus() {
  const { isConnected, moodCount, isLoading, refreshStatus } = useTiDBStatus()
  const [connectionType, setConnectionType] = useState('disconnected')

  useEffect(() => {
    // Listen for mood analysis completion events to refresh count
    const handleMoodSaved = () => {
      // Delay refresh to allow processing
      setTimeout(() => {
        refreshStatus()
        setConnectionType(tidbService.getConnectionType())
      }, 1000)
    }

    // Custom event listener for mood saves
    window.addEventListener('moodSavedToTiDB', handleMoodSaved)
    
    // Update connection type when component mounts
    setConnectionType(tidbService.getConnectionType())
    
    return () => {
      window.removeEventListener('moodSavedToTiDB', handleMoodSaved)
    }
  }, [refreshStatus])

  // Update connection type when connection status changes
  useEffect(() => {
    if (isConnected) {
      setConnectionType(tidbService.getConnectionType())
    }
  }, [isConnected])

  return (
    <div className="tidb-status">
      <div className="database-status">
        <span className="status-label">Database:</span>
        <span className={`status-indicator ${isConnected ? 'connected' : 'disconnected'}`}>
          {isLoading ? '⏳' : (
            isConnected ? (
              connectionType === 'tidb' ? '✅ TiDB Cloud' : 
              connectionType === 'fallback' ? '⚠️ Local Fallback' : '✅ Connected'
            ) : '❌ Disconnected'
          )}
        </span>
      </div>
      
      {isConnected && (
        <div className="mood-counter">
          <span className="counter-label">Moods saved to TiDB:</span>
          <span className="counter-value">{moodCount}</span>
        </div>
      )}
    </div>
  )
}

export default TiDBStatus
