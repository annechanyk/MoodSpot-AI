import { useState, useEffect, useCallback } from 'react'
import tidbService from '../services/TiDBAPIService.js'

export function useTiDBStatus() {
  const [isConnected, setIsConnected] = useState(false)
  const [moodCount, setMoodCount] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [lastUpdate, setLastUpdate] = useState(Date.now())

  const checkStatus = useCallback(async () => {
    try {
      setIsLoading(true)
      
      // Check connection status
      const connected = await tidbService.testConnection()
      setIsConnected(connected)
      
      // Get mood count if connected
      if (connected) {
        const count = await tidbService.getMoodCount()
        setMoodCount(count)
      } else {
        setMoodCount(0)
      }
      
      setLastUpdate(Date.now())
      
    } catch (error) {
      console.warn('TiDB status check failed:', error)
      setIsConnected(false)
      setMoodCount(0)
    } finally {
      setIsLoading(false)
    }
  }, [])

  const refreshStatus = useCallback(() => {
    checkStatus()
  }, [checkStatus])

  useEffect(() => {
    checkStatus()
    
    // Update status every 30 seconds
    const interval = setInterval(checkStatus, 30000)
    
    return () => clearInterval(interval)
  }, [checkStatus])

  return {
    isConnected,
    moodCount,
    isLoading,
    lastUpdate,
    refreshStatus
  }
}

export default useTiDBStatus
