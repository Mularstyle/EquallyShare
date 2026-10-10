import { useEffect, useRef } from 'react'
import { motion } from 'framer-motion'

interface ShatterTransitionProps {
  onComplete: () => void
}

export default function ShatterTransition({ onComplete }: ShatterTransitionProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Set canvas size
    canvas.width = window.innerWidth
    canvas.height = window.innerHeight

    // Create fragments
    const fragments: Array<{
      x: number
      y: number
      width: number
      height: number
      vx: number
      vy: number
      rotation: number
      rotationSpeed: number
      opacity: number
    }> = []

    const cols = 8
    const rows = 6
    const fragmentWidth = canvas.width / cols
    const fragmentHeight = canvas.height / rows

    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const centerX = canvas.width / 2
        const centerY = canvas.height / 2
        const x = col * fragmentWidth
        const y = row * fragmentHeight
        
        const dx = x + fragmentWidth / 2 - centerX
        const dy = y + fragmentHeight / 2 - centerY
        const distance = Math.sqrt(dx * dx + dy * dy)
        const angle = Math.atan2(dy, dx)

        fragments.push({
          x,
          y,
          width: fragmentWidth,
          height: fragmentHeight,
          vx: Math.cos(angle) * (distance / 50 + 2),
          vy: Math.sin(angle) * (distance / 50 + 2),
          rotation: 0,
          rotationSpeed: (Math.random() - 0.5) * 0.1,
          opacity: 1,
        })
      }
    }

    // Animation
    let frame = 0
    const maxFrames = 120

    const animate = () => {
      frame++
      
      ctx.fillStyle = 'rgba(30, 58, 138, 0.05)'
      ctx.fillRect(0, 0, canvas.width, canvas.height)

      fragments.forEach((frag) => {
        ctx.save()
        
        // Update position
        frag.x += frag.vx
        frag.y += frag.vy
        frag.rotation += frag.rotationSpeed
        frag.opacity = Math.max(0, 1 - frame / maxFrames)

        // Apply transformations
        ctx.translate(frag.x + frag.width / 2, frag.y + frag.height / 2)
        ctx.rotate(frag.rotation)
        ctx.globalAlpha = frag.opacity

        // Draw fragment (simulated window piece)
        const gradient = ctx.createLinearGradient(
          -frag.width / 2, 
          -frag.height / 2, 
          frag.width / 2, 
          frag.height / 2
        )
        gradient.addColorStop(0, '#3C91FF')
        gradient.addColorStop(0.5, '#0054E3')
        gradient.addColorStop(1, '#003399')
        
        ctx.fillStyle = gradient
        ctx.fillRect(-frag.width / 2, -frag.height / 2, frag.width, frag.height)

        // Draw border
        ctx.strokeStyle = `rgba(59, 130, 246, ${frag.opacity})`
        ctx.lineWidth = 2
        ctx.strokeRect(-frag.width / 2, -frag.height / 2, frag.width, frag.height)

        // Draw inner highlight
        ctx.strokeStyle = `rgba(255, 255, 255, ${frag.opacity * 0.5})`
        ctx.lineWidth = 1
        ctx.strokeRect(
          -frag.width / 2 + 2, 
          -frag.height / 2 + 2, 
          frag.width - 4, 
          frag.height - 4
        )

        ctx.restore()
      })

      if (frame < maxFrames) {
        requestAnimationFrame(animate)
      } else {
        onComplete()
      }
    }

    animate()

    return () => {
      frame = maxFrames
    }
  }, [onComplete])

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center"
    >
      {/* Flash Effect */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: [0, 1, 0] }}
        transition={{ duration: 0.5 }}
        className="absolute inset-0 bg-blue-400"
      />

      {/* Canvas for fragments */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0"
      />

      {/* Central Portal Effect */}
      <motion.div
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: 0.5, duration: 1 }}
        className="relative z-10"
      >
        <motion.div
          animate={{
            rotate: 360,
            scale: [1, 1.2, 1],
          }}
          transition={{
            rotate: { duration: 2, repeat: Infinity, ease: 'linear' },
            scale: { duration: 1, repeat: Infinity },
          }}
          className="w-32 h-32 rounded-full border-4 border-blue-400"
          style={{
            boxShadow: '0 0 40px rgba(59, 130, 246, 0.8), inset 0 0 40px rgba(59, 130, 246, 0.5)',
          }}
        />
      </motion.div>

      {/* Particle Burst */}
      {[...Array(12)].map((_, i) => (
        <motion.div
          key={i}
          initial={{ 
            x: 0, 
            y: 0, 
            opacity: 1,
            scale: 1,
          }}
          animate={{
            x: Math.cos((i * Math.PI * 2) / 12) * 200,
            y: Math.sin((i * Math.PI * 2) / 12) * 200,
            opacity: 0,
            scale: 0,
          }}
          transition={{
            duration: 1,
            delay: 0.8,
          }}
          className="absolute w-4 h-4 bg-blue-400 rounded-full"
          style={{
            boxShadow: '0 0 10px rgba(59, 130, 246, 0.8)',
          }}
        />
      ))}
    </motion.div>
  )
}
