import React, { useRef, useEffect, useState, useCallback } from 'react'
import '../styles/drawing-canvas.css'

function DrawingCanvas({ 
  onDrawingComplete, 
  onClear, 
  onDrawingChange,
  initialDrawingData = null,
  showSubmitButton = true,
  submitButtonText = "Analyze Mood",
  disabled = false
}) {
  const canvasRef = useRef(null)
  const [isDrawing, setIsDrawing] = useState(false)
  const [currentColor, setCurrentColor] = useState('#000000')
  const [brushSize, setBrushSize] = useState(3)
  const [hasDrawn, setHasDrawn] = useState(false)
  const [isExporting, setIsExporting] = useState(false)
  const [drawingActions, setDrawingActions] = useState([])
  const lastPointRef = useRef(null)
  const drawingPathRef = useRef([])
  const animationFrameRef = useRef(null)

  // Initialize canvas and restore drawing state
  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    
    // Set canvas size for mobile
    const resizeCanvas = () => {
      const container = canvas.parentElement
      const dpr = window.devicePixelRatio || 1
      const rect = container.getBoundingClientRect()
      
      // Set actual size in memory (scaled to account for extra pixel density)
      canvas.width = rect.width * dpr
      canvas.height = Math.min(rect.height, 400) * dpr
      
      // Scale the canvas back down using CSS
      canvas.style.width = rect.width + 'px'
      canvas.style.height = Math.min(rect.height, 400) + 'px'
      
      // Scale the drawing context so everything draws at the correct size
      ctx.scale(dpr, dpr)
      
      // Set drawing styles
      ctx.lineCap = 'round'
      ctx.lineJoin = 'round'
      ctx.imageSmoothingEnabled = true
      ctx.imageSmoothingQuality = 'high'
      
      // Restore drawing if available
      if (initialDrawingData) {
        restoreDrawing(initialDrawingData)
      }
    }

    resizeCanvas()
    window.addEventListener('resize', resizeCanvas)
    
    // Load persisted drawing state
    loadDrawingState()
    
    return () => {
      window.removeEventListener('resize', resizeCanvas)
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current)
      }
    }
  }, [initialDrawingData])

  // Enhanced touch event handling with smooth drawing
  const getEventPos = useCallback((e) => {
    const canvas = canvasRef.current
    const rect = canvas.getBoundingClientRect()
    const dpr = window.devicePixelRatio || 1
    
    let clientX, clientY
    if (e.touches && e.touches.length > 0) {
      clientX = e.touches[0].clientX
      clientY = e.touches[0].clientY
    } else {
      clientX = e.clientX
      clientY = e.clientY
    }
    
    return {
      x: (clientX - rect.left) * dpr,
      y: (clientY - rect.top) * dpr
    }
  }, [])

  const startDrawing = useCallback((e) => {
    if (disabled) return
    e.preventDefault()
    setIsDrawing(true)
    const newHasDrawn = true
    setHasDrawn(newHasDrawn)
    
    // Notify parent of drawing change
    if (onDrawingChange) {
      onDrawingChange(newHasDrawn)
    }
    
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    const pos = getEventPos(e)
    
    lastPointRef.current = pos
    drawingPathRef.current = [pos]
    
    ctx.beginPath()
    ctx.moveTo(pos.x, pos.y)
    
    // Save drawing state for persistence
    saveDrawingState()
  }, [getEventPos, disabled, onDrawingChange])

  const draw = useCallback((e) => {
    if (!isDrawing) return
    e.preventDefault()
    
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    const currentPos = getEventPos(e)
    const lastPos = lastPointRef.current
    
    if (!lastPos) return
    
    // Calculate distance for smooth drawing
    const distance = Math.sqrt(
      Math.pow(currentPos.x - lastPos.x, 2) + Math.pow(currentPos.y - lastPos.y, 2)
    )
    
    // Only draw if moved enough to prevent excessive points
    if (distance > 2) {
      // Use quadratic curve for smoother lines
      const midPoint = {
        x: (lastPos.x + currentPos.x) / 2,
        y: (lastPos.y + currentPos.y) / 2
      }
      
      ctx.strokeStyle = currentColor
      ctx.lineWidth = brushSize
      ctx.quadraticCurveTo(lastPos.x, lastPos.y, midPoint.x, midPoint.y)
      ctx.stroke()
      
      drawingPathRef.current.push(currentPos)
      lastPointRef.current = currentPos
      
      // Throttle state saving using animation frame
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current)
      }
      animationFrameRef.current = requestAnimationFrame(() => {
        saveDrawingState()
      })
    }
  }, [isDrawing, currentColor, brushSize, getEventPos])

  const stopDrawing = useCallback((e) => {
    if (!isDrawing) return
    e?.preventDefault()
    
    setIsDrawing(false)
    lastPointRef.current = null
    
    // Save final drawing state
    saveDrawingState()
    
    // Record drawing action for undo functionality
    const canvas = canvasRef.current
    const imageData = canvas.toDataURL('image/png')
    setDrawingActions(prev => [...prev, {
      type: 'stroke',
      color: currentColor,
      size: brushSize,
      path: [...drawingPathRef.current],
      timestamp: Date.now()
    }])
  }, [isDrawing, currentColor, brushSize])

  // Drawing state persistence
  const saveDrawingState = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    
    try {
      const imageData = canvas.toDataURL('image/png')
      localStorage.setItem('drawingCanvas_state', JSON.stringify({
        imageData,
        color: currentColor,
        brushSize,
        hasDrawn,
        timestamp: Date.now()
      }))
    } catch (error) {
      console.warn('Failed to save drawing state:', error)
    }
  }, [currentColor, brushSize, hasDrawn])

  const loadDrawingState = useCallback(() => {
    try {
      const saved = localStorage.getItem('drawingCanvas_state')
      if (saved) {
        const state = JSON.parse(saved)
        // Only restore if saved within last hour
        if (Date.now() - state.timestamp < 3600000) {
          setCurrentColor(state.color || '#000000')
          setBrushSize(state.brushSize || 3)
          setHasDrawn(state.hasDrawn || false)
          
          if (state.imageData) {
            restoreDrawing(state.imageData)
          }
        }
      }
    } catch (error) {
      console.warn('Failed to load drawing state:', error)
    }
  }, [])

  const restoreDrawing = useCallback((imageData) => {
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    
    const img = new Image()
    img.onload = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      ctx.drawImage(img, 0, 0)
    }
    img.src = imageData
  }, [])

  // Canvas image export with compression
  const exportCanvasImage = useCallback(async (quality = 0.8, format = 'image/jpeg') => {
    const canvas = canvasRef.current
    if (!canvas || !hasDrawn) {
      console.warn('⚠️ Cannot export: no canvas or no drawing')
      return null
    }
    
    console.log('📤 Starting canvas export...')
    setIsExporting(true)
    
    try {
      // Create a new canvas for export to ensure proper sizing
      const exportCanvas = document.createElement('canvas')
      const exportCtx = exportCanvas.getContext('2d')
      
      if (!exportCtx) {
        throw new Error('Failed to get export canvas context')
      }
      
      // Set export dimensions (optimize for API transmission)
      const maxDimension = 512
      const aspectRatio = canvas.width / canvas.height || 1
      
      if (aspectRatio > 1) {
        exportCanvas.width = maxDimension
        exportCanvas.height = maxDimension / aspectRatio
      } else {
        exportCanvas.width = maxDimension * aspectRatio
        exportCanvas.height = maxDimension
      }
      
      // Fill with white background for better compression
      exportCtx.fillStyle = '#ffffff'
      if (typeof exportCtx.fillRect === 'function') {
        exportCtx.fillRect(0, 0, exportCanvas.width, exportCanvas.height)
      }
      
      // Draw the original canvas scaled down
      if (typeof exportCtx.drawImage === 'function') {
        exportCtx.drawImage(canvas, 0, 0, exportCanvas.width, exportCanvas.height)
      }
      
      // Export with compression
      const originalData = canvas.toDataURL()
      const compressedData = exportCanvas.toDataURL(format, quality)
      
      const exportResult = {
        dataUrl: compressedData,
        width: exportCanvas.width,
        height: exportCanvas.height,
        originalSize: originalData.length,
        compressedSize: compressedData.length,
        compressionRatio: originalData.length > 0 ? (1 - compressedData.length / originalData.length) * 100 : 0
      }
      
      console.log('✅ Canvas export successful:', {
        dimensions: `${exportResult.width}x${exportResult.height}`,
        compressionRatio: `${exportResult.compressionRatio.toFixed(1)}%`
      })
      
      return exportResult
    } catch (error) {
      console.error('Failed to export canvas:', error)
      
      // Fallback: return original canvas data
      try {
        const fallbackData = canvas.toDataURL(format, quality)
        return {
          dataUrl: fallbackData,
          width: canvas.width,
          height: canvas.height,
          originalSize: fallbackData.length,
          compressedSize: fallbackData.length,
          compressionRatio: 0
        }
      } catch (fallbackError) {
        console.error('Fallback export also failed:', fallbackError)
        return null
      }
    } finally {
      setIsExporting(false)
    }
  }, [hasDrawn])

  const clearCanvas = useCallback(() => {
    if (disabled) return
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    
    setHasDrawn(false)
    setDrawingActions([])
    
    // Notify parent of drawing change
    if (onDrawingChange) {
      onDrawingChange(false)
    }
    
    // Clear persisted state
    localStorage.removeItem('drawingCanvas_state')
    
    if (onClear) {
      onClear()
    }
  }, [onClear, disabled, onDrawingChange])

  // Handle drawing completion
  const handleSubmitDrawing = useCallback(async (e) => {
    e.preventDefault() // Prevent any default behavior
    e.stopPropagation() // Stop event bubbling
    console.log('🖼️ BUTTON CLICKED: Submit drawing, hasDrawn:', hasDrawn)
    
    if (!hasDrawn) {
      console.warn('❌ No drawing to submit')
      return
    }
    
    if (isExporting) {
      console.warn('⚠️ Export already in progress')
      return
    }
    
    try {
      console.log('📤 Starting canvas export...')
      const exportData = await exportCanvasImage()
      console.log('✅ Export completed successfully:', exportData)
      
      if (exportData && onDrawingComplete) {
        console.log('🚀 Calling onDrawingComplete callback...')
        await onDrawingComplete(exportData)
        console.log('✅ onDrawingComplete callback finished')
      } else {
        console.error('❌ Missing export data or callback:', { exportData: !!exportData, onDrawingComplete: !!onDrawingComplete })
      }
    } catch (error) {
      console.error('❌ Error in handleSubmitDrawing:', error)
      alert(`Error processing drawing: ${error.message}`)
    }
  }, [hasDrawn, isExporting, exportCanvasImage, onDrawingComplete])

  return (
    <div className="drawing-canvas-container">
      <div className="canvas-tools">
        <div className="color-picker">
          <input
            type="color"
            value={currentColor}
            onChange={(e) => setCurrentColor(e.target.value)}
            className="color-input"
            aria-label="Choose drawing color"
          />
        </div>
        
        <div className="brush-size">
          <input
            type="range"
            min="1"
            max="20"
            value={brushSize}
            onChange={(e) => setBrushSize(parseInt(e.target.value))}
            className="brush-slider"
            aria-label="Brush size"
          />
          <span className="brush-size-label">{brushSize}px</span>
        </div>
        
        <button 
          type="button"
          className="button button-secondary clear-btn"
          onClick={(e) => {
            e.preventDefault()
            e.stopPropagation()
            clearCanvas()
          }}
          disabled={!hasDrawn || disabled}
          aria-label="Clear canvas"
        >
          Clear
        </button>
        
        {onDrawingComplete && showSubmitButton && (
          <button 
            type="button"
            className="button button-primary submit-btn"
            onClick={handleSubmitDrawing}
            disabled={!hasDrawn || isExporting || disabled}
            aria-label="Submit drawing for analysis"
          >
            {isExporting ? 'Processing...' : submitButtonText}
          </button>
        )}
      </div>
      
      <div className="canvas-wrapper">
        <canvas
          ref={canvasRef}
          className={`drawing-canvas ${isDrawing ? 'drawing-active' : ''} ${hasDrawn ? 'has-content' : ''}`}
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={stopDrawing}
          onMouseLeave={stopDrawing}
          onTouchStart={startDrawing}
          onTouchMove={draw}
          onTouchEnd={stopDrawing}
          onTouchCancel={stopDrawing}
          style={{ touchAction: 'none' }}
          aria-label="Drawing canvas"
        />
        
        {isDrawing && (
          <div className="drawing-feedback">
            <div className="drawing-indicator"></div>
          </div>
        )}
        
        {isExporting && (
          <div className="export-overlay">
            <div className="export-spinner"></div>
            <span>Preparing your drawing...</span>
          </div>
        )}
      </div>
      
      <div className="canvas-status">
        <p className="canvas-hint">
          {hasDrawn ? 'Great! Your drawing is ready for analysis' : 'Draw how you\'re feeling right now'}
        </p>
        
        {drawingActions.length > 0 && (
          <div className="drawing-stats">
            <span className="stat-item">Strokes: {drawingActions.length}</span>
            <span className="stat-item">Color: {currentColor}</span>
            <span className="stat-item">Brush: {brushSize}px</span>
          </div>
        )}
      </div>
    </div>
  )
}

export default DrawingCanvas