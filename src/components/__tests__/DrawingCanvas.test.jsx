import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import DrawingCanvas from '../DrawingCanvas'

// Mock localStorage
const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
}
global.localStorage = localStorageMock

// Mock canvas context
const mockContext = {
  beginPath: vi.fn(),
  moveTo: vi.fn(),
  lineTo: vi.fn(),
  quadraticCurveTo: vi.fn(),
  stroke: vi.fn(),
  clearRect: vi.fn(),
  scale: vi.fn(),
  drawImage: vi.fn(),
  fillRect: vi.fn(),
  toDataURL: vi.fn(() => 'data:image/png;base64,mock-image-data'),
  fillStyle: '#ffffff',
  strokeStyle: '#000000',
  lineWidth: 1,
  lineCap: 'round',
  lineJoin: 'round',
  imageSmoothingEnabled: true,
  imageSmoothingQuality: 'high',
}

const mockCanvas = {
  getContext: vi.fn(() => mockContext),
  toDataURL: vi.fn(() => 'data:image/png;base64,mock-image-data'),
  width: 400,
  height: 300,
  style: {},
  parentElement: {
    getBoundingClientRect: () => ({ width: 400, height: 300 }),
    clientWidth: 400,
    clientHeight: 300,
  },
  getBoundingClientRect: () => ({ left: 0, top: 0, width: 400, height: 300 }),
}

// Mock HTML5 Canvas
HTMLCanvasElement.prototype.getContext = vi.fn(() => mockContext)
HTMLCanvasElement.prototype.toDataURL = vi.fn(() => 'data:image/png;base64,mock-image-data')

// Mock document.createElement for canvas
const originalCreateElement = document.createElement
document.createElement = vi.fn((tagName) => {
  if (tagName === 'canvas') {
    return {
      getContext: vi.fn(() => mockContext),
      toDataURL: vi.fn(() => 'data:image/png;base64,mock-export-data'),
      width: 512,
      height: 512,
    }
  }
  return originalCreateElement.call(document, tagName)
})

describe('DrawingCanvas', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorageMock.getItem.mockReturnValue(null)
    
    // Mock devicePixelRatio
    Object.defineProperty(window, 'devicePixelRatio', {
      writable: true,
      value: 1,
    })
    
    // Mock requestAnimationFrame
    global.requestAnimationFrame = vi.fn(cb => setTimeout(cb, 0))
    global.cancelAnimationFrame = vi.fn()
  })

  it('renders drawing canvas with tools', () => {
    render(<DrawingCanvas />)
    
    expect(screen.getByLabelText('Choose drawing color')).toBeInTheDocument()
    expect(screen.getByLabelText('Brush size')).toBeInTheDocument()
    expect(screen.getByLabelText('Clear canvas')).toBeInTheDocument()
    expect(screen.getByLabelText('Drawing canvas')).toBeInTheDocument()
  })

  it('shows submit button when onDrawingComplete prop is provided', () => {
    const mockOnDrawingComplete = vi.fn()
    render(<DrawingCanvas onDrawingComplete={mockOnDrawingComplete} />)
    
    expect(screen.getByLabelText('Submit drawing for analysis')).toBeInTheDocument()
  })

  it('disables clear and submit buttons when no drawing exists', () => {
    const mockOnDrawingComplete = vi.fn()
    render(<DrawingCanvas onDrawingComplete={mockOnDrawingComplete} />)
    
    expect(screen.getByLabelText('Clear canvas')).toBeDisabled()
    expect(screen.getByLabelText('Submit drawing for analysis')).toBeDisabled()
  })

  it('updates brush size when slider changes', () => {
    render(<DrawingCanvas />)
    
    const brushSlider = screen.getByLabelText('Brush size')
    fireEvent.change(brushSlider, { target: { value: '10' } })
    
    expect(screen.getByText('10px')).toBeInTheDocument()
  })

  it('updates color when color picker changes', () => {
    render(<DrawingCanvas />)
    
    const colorPicker = screen.getByLabelText('Choose drawing color')
    fireEvent.change(colorPicker, { target: { value: '#ff0000' } })
    
    expect(colorPicker.value).toBe('#ff0000')
  })

  it('shows drawing feedback when drawing is active', () => {
    render(<DrawingCanvas />)
    
    const canvas = screen.getByLabelText('Drawing canvas')
    
    // Simulate touch start
    fireEvent.touchStart(canvas, {
      touches: [{ clientX: 100, clientY: 100 }]
    })
    
    expect(screen.getByText('Great! Your drawing is ready for analysis')).toBeInTheDocument()
  })

  it('calls onDrawingComplete when submit button is clicked', async () => {
    const mockOnDrawingComplete = vi.fn()
    render(<DrawingCanvas onDrawingComplete={mockOnDrawingComplete} />)
    
    const canvas = screen.getByLabelText('Drawing canvas')
    
    // Simulate drawing
    fireEvent.touchStart(canvas, {
      touches: [{ clientX: 100, clientY: 100 }]
    })
    fireEvent.touchEnd(canvas)
    
    const submitButton = screen.getByLabelText('Submit drawing for analysis')
    expect(submitButton).not.toBeDisabled()
    
    fireEvent.click(submitButton)
    
    // Wait for async export
    await new Promise(resolve => setTimeout(resolve, 0))
    
    expect(mockOnDrawingComplete).toHaveBeenCalledWith(
      expect.objectContaining({
        dataUrl: expect.stringContaining('data:image'),
        width: expect.any(Number),
        height: expect.any(Number),
      })
    )
  })

  it('calls onClear when clear button is clicked', () => {
    const mockOnClear = vi.fn()
    render(<DrawingCanvas onClear={mockOnClear} />)
    
    const canvas = screen.getByLabelText('Drawing canvas')
    
    // Simulate drawing first
    fireEvent.touchStart(canvas, {
      touches: [{ clientX: 100, clientY: 100 }]
    })
    fireEvent.touchEnd(canvas)
    
    const clearButton = screen.getByLabelText('Clear canvas')
    fireEvent.click(clearButton)
    
    expect(mockOnClear).toHaveBeenCalled()
  })

  it('persists drawing state to localStorage', () => {
    render(<DrawingCanvas />)
    
    const canvas = screen.getByLabelText('Drawing canvas')
    
    // Simulate drawing
    fireEvent.touchStart(canvas, {
      touches: [{ clientX: 100, clientY: 100 }]
    })
    fireEvent.touchMove(canvas, {
      touches: [{ clientX: 110, clientY: 110 }]
    })
    fireEvent.touchEnd(canvas)
    
    expect(localStorageMock.setItem).toHaveBeenCalledWith(
      'drawingCanvas_state',
      expect.stringContaining('imageData')
    )
  })

  it('loads drawing state from localStorage on mount', () => {
    const mockState = JSON.stringify({
      imageData: 'data:image/png;base64,saved-image',
      color: '#ff0000',
      brushSize: 5,
      hasDrawn: true,
      timestamp: Date.now()
    })
    
    localStorageMock.getItem.mockReturnValue(mockState)
    
    render(<DrawingCanvas />)
    
    expect(localStorageMock.getItem).toHaveBeenCalledWith('drawingCanvas_state')
    expect(screen.getByLabelText('Choose drawing color')).toHaveValue('#ff0000')
    expect(screen.getByText('5px')).toBeInTheDocument()
  })
})