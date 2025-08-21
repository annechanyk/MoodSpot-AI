import React, { useEffect, useRef } from 'react'
import './UniverseBackground.css'

function UniverseBackground() {
  const canvasRef = useRef(null)
  const animationRef = useRef(null)
  const starsRef = useRef([])
  const shootingStarsRef = useRef([])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    
    // Set canvas size
    const resizeCanvas = () => {
      canvas.width = window.innerWidth
      canvas.height = window.innerHeight
    }
    
    resizeCanvas()
    window.addEventListener('resize', resizeCanvas)

    // Star class
    class Star {
      constructor() {
        this.x = Math.random() * canvas.width
        this.y = Math.random() * canvas.height
        this.size = Math.random() * 3 + 0.5
        this.opacity = Math.random() * 0.8 + 0.2
        this.twinkleSpeed = Math.random() * 0.02 + 0.01
        this.twinklePhase = Math.random() * Math.PI * 2
        this.color = this.getStarColor()
      }

      getStarColor() {
        const colors = [
          'rgba(255, 255, 255, ',
          'rgba(173, 216, 230, ', // Light blue
          'rgba(255, 182, 193, ', // Light pink
          'rgba(255, 255, 224, ', // Light yellow
          'rgba(221, 160, 221, ', // Plum
        ]
        return colors[Math.floor(Math.random() * colors.length)]
      }

      update() {
        this.twinklePhase += this.twinkleSpeed
        this.opacity = 0.3 + Math.sin(this.twinklePhase) * 0.5
      }

      draw() {
        ctx.save()
        ctx.globalAlpha = Math.max(0.1, this.opacity)
        
        // Create star glow effect
        const gradient = ctx.createRadialGradient(
          this.x, this.y, 0,
          this.x, this.y, this.size * 3
        )
        gradient.addColorStop(0, this.color + '1)')
        gradient.addColorStop(0.5, this.color + '0.5)')
        gradient.addColorStop(1, this.color + '0)')
        
        ctx.fillStyle = gradient
        ctx.beginPath()
        ctx.arc(this.x, this.y, this.size * 3, 0, Math.PI * 2)
        ctx.fill()
        
        // Draw star center
        ctx.fillStyle = this.color + '1)'
        ctx.beginPath()
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2)
        ctx.fill()
        
        ctx.restore()
      }
    }

    // Shooting star class
    class ShootingStar {
      constructor() {
        this.reset()
        this.opacity = 0
        this.life = 0
      }

      reset() {
        this.x = Math.random() * canvas.width
        this.y = Math.random() * canvas.height * 0.3
        this.length = Math.random() * 100 + 50
        this.speed = Math.random() * 8 + 4
        this.angle = Math.random() * Math.PI / 6 + Math.PI / 4 // 45-75 degrees
        this.vx = Math.cos(this.angle) * this.speed
        this.vy = Math.sin(this.angle) * this.speed
        this.life = 0
        this.maxLife = Math.random() * 60 + 40
      }

      update() {
        this.x += this.vx
        this.y += this.vy
        this.life++
        
        // Fade in and out
        if (this.life < this.maxLife * 0.2) {
          this.opacity = this.life / (this.maxLife * 0.2)
        } else if (this.life > this.maxLife * 0.8) {
          this.opacity = (this.maxLife - this.life) / (this.maxLife * 0.2)
        } else {
          this.opacity = 1
        }

        // Reset when off screen or life expired
        if (this.x > canvas.width + 100 || 
            this.y > canvas.height + 100 || 
            this.life > this.maxLife) {
          this.reset()
        }
      }

      draw() {
        ctx.save()
        ctx.globalAlpha = this.opacity
        
        // Create gradient for shooting star trail
        const gradient = ctx.createLinearGradient(
          this.x, this.y,
          this.x - this.vx * this.length / this.speed,
          this.y - this.vy * this.length / this.speed
        )
        gradient.addColorStop(0, 'rgba(255, 255, 255, 1)')
        gradient.addColorStop(0.5, 'rgba(173, 216, 230, 0.8)')
        gradient.addColorStop(1, 'rgba(173, 216, 230, 0)')
        
        ctx.strokeStyle = gradient
        ctx.lineWidth = 2
        ctx.beginPath()
        ctx.moveTo(this.x, this.y)
        ctx.lineTo(
          this.x - this.vx * this.length / this.speed,
          this.y - this.vy * this.length / this.speed
        )
        ctx.stroke()
        
        // Draw bright head
        ctx.fillStyle = 'rgba(255, 255, 255, 1)'
        ctx.beginPath()
        ctx.arc(this.x, this.y, 2, 0, Math.PI * 2)
        ctx.fill()
        
        ctx.restore()
      }
    }

    // Initialize stars
    const initializeStars = () => {
      starsRef.current = []
      const starCount = Math.floor((canvas.width * canvas.height) / 8000)
      
      for (let i = 0; i < starCount; i++) {
        starsRef.current.push(new Star())
      }
    }

    // Initialize shooting stars
    const initializeShootingStars = () => {
      shootingStarsRef.current = []
      for (let i = 0; i < 3; i++) {
        shootingStarsRef.current.push(new ShootingStar())
      }
    }

    // Animation loop
    const animate = () => {
      // Create deep space gradient background
      const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height)
      gradient.addColorStop(0, '#0a0a23') // Deep space blue
      gradient.addColorStop(0.3, '#1a1a3a') // Darker blue
      gradient.addColorStop(0.7, '#2d1b69') // Purple
      gradient.addColorStop(1, '#0f0f23') // Almost black
      
      ctx.fillStyle = gradient
      ctx.fillRect(0, 0, canvas.width, canvas.height)

      // Add subtle nebula effect
      ctx.save()
      ctx.globalAlpha = 0.1
      const nebulaGradient = ctx.createRadialGradient(
        canvas.width * 0.3, canvas.height * 0.3, 0,
        canvas.width * 0.3, canvas.height * 0.3, canvas.width * 0.5
      )
      nebulaGradient.addColorStop(0, 'rgba(147, 0, 211, 0.3)') // Purple nebula
      nebulaGradient.addColorStop(0.5, 'rgba(75, 0, 130, 0.2)') // Indigo
      nebulaGradient.addColorStop(1, 'rgba(25, 25, 112, 0)')
      
      ctx.fillStyle = nebulaGradient
      ctx.fillRect(0, 0, canvas.width, canvas.height)
      ctx.restore()

      // Update and draw stars
      starsRef.current.forEach(star => {
        star.update()
        star.draw()
      })

      // Update and draw shooting stars
      shootingStarsRef.current.forEach(shootingStar => {
        shootingStar.update()
        shootingStar.draw()
      })

      animationRef.current = requestAnimationFrame(animate)
    }

    initializeStars()
    initializeShootingStars()
    animate()

    return () => {
      window.removeEventListener('resize', resizeCanvas)
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
      }
    }
  }, [])

  return (
    <div className="universe-background">
      <canvas
        ref={canvasRef}
        className="universe-canvas"
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          zIndex: -1,
          pointerEvents: 'none'
        }}
      />
      
      {/* Additional CSS-based floating particles */}
      <div className="floating-particles">
        {Array.from({ length: 20 }, (_, i) => (
          <div
            key={i}
            className="particle"
            style={{
              left: `${Math.random() * 100}%`,
              animationDelay: `${Math.random() * 20}s`,
              animationDuration: `${15 + Math.random() * 10}s`
            }}
          />
        ))}
      </div>

      {/* Constellation lines (subtle) */}
      <div className="constellation-lines">
        {Array.from({ length: 5 }, (_, i) => (
          <div
            key={i}
            className="constellation-line"
            style={{
              left: `${Math.random() * 80 + 10}%`,
              top: `${Math.random() * 80 + 10}%`,
              transform: `rotate(${Math.random() * 360}deg)`,
              animationDelay: `${Math.random() * 10}s`
            }}
          />
        ))}
      </div>
    </div>
  )
}

export default UniverseBackground
