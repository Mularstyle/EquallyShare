import { useState } from 'react'
import { motion } from 'framer-motion'
import { Minus, Square, X } from 'lucide-react'

interface XPWindowProps {
  title: string
  children: React.ReactNode
  onMinimize?: () => void
}

export default function XPWindow({ title, children, onMinimize }: XPWindowProps) {
  const [isFullscreen, setIsFullscreen] = useState(false)

  const handleMinimize = () => {
    if (onMinimize) {
      onMinimize()
    }
  }

  const handleMaximize = () => {
    // Toggle fullscreen mode (F11 behavior)
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch((err) => {
        console.log(`Error attempting to enable fullscreen: ${err.message}`)
      })
      setIsFullscreen(true)
    } else {
      document.exitFullscreen()
      setIsFullscreen(false)
    }
  }

  const handleClose = () => {
    // Close the browser tab/window
    if (confirm('Are you sure you want to close this window?')) {
      window.close()
      // If window.close() doesn't work (modern browsers restrict it),
      // try alternative method
      if (!window.closed) {
        window.open('about:blank', '_self')
        window.close()
      }
    }
  }

  return (
    <motion.div
      className="overflow-hidden"
      style={{ 
        background: 'white',
        boxShadow: '0 8px 32px rgba(0,0,0,0.3)'
      }}
      initial={{ opacity: 0, y: -50 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: 'spring', damping: 20 }}
    >
      {/* Title Bar */}
      <div 
        className="px-3 py-2 flex items-center justify-between cursor-move select-none"
        style={{
          background: '#0054E3',
        }}
      >
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 bg-white flex items-center justify-center text-blue-600 font-bold text-xs">
            XP
          </div>
          <span className="text-white font-semibold text-sm drop-shadow-lg">
            {title}
          </span>
        </div>
        
        <div className="flex items-center gap-1">
          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            onClick={handleMinimize}
            title="Minimize"
            className="w-6 h-6 bg-gradient-to-b from-blue-400 to-blue-500 hover:from-blue-300 hover:to-blue-400 flex items-center justify-center border border-blue-700"
          >
            <Minus size={14} className="text-white" />
          </motion.button>
          
          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            onClick={handleMaximize}
            title={isFullscreen ? "Exit Fullscreen" : "Fullscreen (F11)"}
            className="w-6 h-6 bg-gradient-to-b from-blue-400 to-blue-500 hover:from-blue-300 hover:to-blue-400 flex items-center justify-center border border-blue-700"
          >
            <Square size={12} className="text-white" />
          </motion.button>
          
          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            onClick={handleClose}
            title="Close"
            className="w-6 h-6 bg-gradient-to-b from-red-400 to-red-600 hover:from-red-300 hover:to-red-500 flex items-center justify-center border border-red-700"
          >
            <X size={14} className="text-white" />
          </motion.button>
        </div>
      </div>

      {/* Window Content */}
      <div style={{ background: '#ECE9D8' }}>
        {children}
      </div>
    </motion.div>
  )
}
