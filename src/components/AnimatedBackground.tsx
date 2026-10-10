import { motion } from 'framer-motion'
import { useState, useEffect } from 'react'

export default function AnimatedBackground() {
  // Create 4 DVD logos with different starting positions and velocities
  const [dvds, setDvds] = useState([
    { id: 1, x: 0, y: 0, vx: 2, vy: 2, color: '#FF0000' },
    { id: 2, x: 200, y: 100, vx: -2.5, vy: 2.5, color: '#00FF00' },
    { id: 3, x: 400, y: 200, vx: 2.5, vy: -2, color: '#0000FF' },
    { id: 4, x: 100, y: 300, vx: -2, vy: -2.5, color: '#FFFF00' },
  ])

  const colors = ['#FF0000', '#00FF00', '#0000FF', '#FFFF00', '#FF00FF', '#00FFFF']

  useEffect(() => {
    const dvdWidth = 300
    const dvdHeight = 150
    const ellipseRx = 138  // Radius X of ellipse
    const ellipseRy = 63   // Radius Y of ellipse
    
    // Function to check collision between two ellipses
    const checkEllipseCollision = (dvd1: any, dvd2: any) => {
      // Centers of ellipses
      const cx1 = dvd1.x + dvdWidth / 2
      const cy1 = dvd1.y + dvdHeight / 2
      const cx2 = dvd2.x + dvdWidth / 2
      const cy2 = dvd2.y + dvdHeight / 2
      
      // Distance between centers
      const dx = cx1 - cx2
      const dy = cy1 - cy2
      
      // Ellipse collision detection using formula
      // Normalize distance by ellipse radii
      const normalizedDist = (dx * dx) / ((ellipseRx * 2) * (ellipseRx * 2)) + 
                            (dy * dy) / ((ellipseRy * 2) * (ellipseRy * 2))
      
      // Increased threshold to detect collision earlier (before overlap)
      return normalizedDist < 1.1 // Detect when edges are close
    }
    
    const animate = () => {
      setDvds(prevDvds => {
        const maxX = window.innerWidth - dvdWidth
        const maxY = window.innerHeight - dvdHeight
        
        return prevDvds.map((dvd, index) => {
          let newX = dvd.x + dvd.vx
          let newY = dvd.y + dvd.vy
          let newVx = dvd.vx
          let newVy = dvd.vy
          let newColor = dvd.color
          let shouldChangeColor = false

          // Check horizontal boundaries
          if (newX <= 0) {
            newX = 0
            newVx = Math.abs(newVx)
            shouldChangeColor = true
          } else if (newX >= maxX) {
            newX = maxX
            newVx = -Math.abs(newVx)
            shouldChangeColor = true
          }

          // Check vertical boundaries
          if (newY <= 0) {
            newY = 0
            newVy = Math.abs(newVy)
            shouldChangeColor = true
          } else if (newY >= maxY) {
            newY = maxY
            newVy = -Math.abs(newVy)
            shouldChangeColor = true
          }

          // Create temporary object for collision checking
          const tempDvd = { ...dvd, x: newX, y: newY }

          // Check collision with other DVDs
          for (let i = 0; i < prevDvds.length; i++) {
            if (i !== index) {
              const otherDvd = prevDvds[i]
              if (checkEllipseCollision(tempDvd, otherDvd)) {
                // Calculate collision normal
                const cx1 = tempDvd.x + dvdWidth / 2
                const cy1 = tempDvd.y + dvdHeight / 2
                const cx2 = otherDvd.x + dvdWidth / 2
                const cy2 = otherDvd.y + dvdHeight / 2
                
                const dx = cx1 - cx2
                const dy = cy1 - cy2
                const distance = Math.sqrt(dx * dx + dy * dy)
                
                if (distance > 0) {
                  // Normalize
                  const nx = dx / distance
                  const ny = dy / distance
                  
                  // Reflect velocity - stronger bounce
                  const dotProduct = newVx * nx + newVy * ny
                  
                  // Only bounce if moving towards each other
                  if (dotProduct < 0) {
                    newVx = newVx - 2 * dotProduct * nx
                    newVy = newVy - 2 * dotProduct * ny
                    
                    // Push apart to prevent overlap
                    const pushDistance = 5
                    newX = dvd.x + nx * pushDistance
                    newY = dvd.y + ny * pushDistance
                    
                    shouldChangeColor = true
                  }
                }
                break
              }
            }
          }

          if (shouldChangeColor) {
            newColor = colors[Math.floor(Math.random() * colors.length)]
          }

          return {
            ...dvd,
            x: newX,
            y: newY,
            vx: newVx,
            vy: newVy,
            color: newColor
          }
        })
      })
    }

    const interval = setInterval(animate, 16) // ~60fps
    return () => clearInterval(interval)
  }, [])

  return (
    <div className="fixed inset-0 -z-10 overflow-hidden">
      {/* Windows XP Bliss Background */}
      <div 
        className="absolute inset-0 bg-cover bg-center bg-no-repeat"
        style={{
          backgroundImage: 'url(/windowxpbackground.jpg)',
        }}
      />

      {/* DVD Logos Bouncing - 5 logos */}
      {dvds.map((dvd) => (
        <div
          key={dvd.id}
          className="absolute transition-none"
          style={{
            left: `${dvd.x}px`,
            top: `${dvd.y}px`,
            width: '300px',
            height: '150px',
          }}
        >
          <svg
            width="300"
            height="150"
            viewBox="0 0 300 150"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            {/* DVD Logo */}
            <ellipse
              cx="150"
              cy="75"
              rx="138"
              ry="63"
              fill={dvd.color}
              opacity="0.8"
            />
            <text
              x="150"
              y="87"
              textAnchor="middle"
              fontSize="42"
              fontWeight="bold"
              fill="white"
              fontFamily="Arial, sans-serif"
            >
              DVD
            </text>
          </svg>
        </div>
      ))}

      {/* Keep some subtle particles for extra effect */}
      {[...Array(10)].map((_, i) => (
        <motion.div
          key={i}
          className="absolute rounded-full bg-white"
          style={{
            width: Math.random() * 3 + 1,
            height: Math.random() * 3 + 1,
            left: `${Math.random() * 100}%`,
            top: `${Math.random() * 100}%`,
            opacity: Math.random() * 0.2 + 0.1,
          }}
          animate={{
            y: [0, -20, 0],
            opacity: [0.1, 0.2, 0.1],
          }}
          transition={{
            duration: Math.random() * 10 + 10,
            repeat: Infinity,
            delay: Math.random() * 5,
          }}
        />
      ))}
    </div>
  )
}
