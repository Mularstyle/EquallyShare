import { useState } from 'react'
import { motion } from 'framer-motion'
import { Copy, Check, RotateCcw, ExternalLink, Sparkles, Minus, Square, X } from 'lucide-react'

interface ResultWindowProps {
  urls: string[]
  onReset: () => void
  onMinimize?: () => void
}

export default function ResultWindow({ urls, onReset, onMinimize }: ResultWindowProps) {
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null)
  const [copiedAll, setCopiedAll] = useState(false)

  const copyToClipboard = async (text: string, index?: number) => {
    try {
      await navigator.clipboard.writeText(text)
      if (index !== undefined) {
        setCopiedIndex(index)
        setTimeout(() => setCopiedIndex(null), 2000)
      } else {
        setCopiedAll(true)
        setTimeout(() => setCopiedAll(false), 2000)
      }
    } catch (err) {
      console.error('Failed to copy:', err)
    }
  }

  const copyAllUrls = () => {
    const allUrls = urls.join('\n')
    copyToClipboard(allUrls)
  }

  // Custom close handler for result window - just reset instead of closing tab
  const handleClose = () => {
    onReset()
  }

  const handleMinimize = () => {
    if (onMinimize) {
      onMinimize()
    }
  }

  return (
    <motion.div
      key="result"
      initial={{ opacity: 0, scale: 0.8, y: 50 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.8, y: 50 }}
      transition={{ type: 'spring', damping: 20 }}
      className="w-full max-w-4xl"
    >
      {/* Custom XPWindow wrapper with override for close button */}
      <motion.div
        className="overflow-hidden"
        style={{ 
          background: 'white',
          boxShadow: '0 8px 32px rgba(0,0,0,0.3)'
        }}
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
              URL Generated Successfully!
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
              onClick={() => {
                if (!document.fullscreenElement) {
                  document.documentElement.requestFullscreen()
                } else {
                  document.exitFullscreen()
                }
              }}
              title="Fullscreen"
              className="w-6 h-6 bg-gradient-to-b from-blue-400 to-blue-500 hover:from-blue-300 hover:to-blue-400 flex items-center justify-center border border-blue-700"
            >
              <Square size={12} className="text-white" />
            </motion.button>
            
            <motion.button
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              onClick={handleClose}
              title="Close (Back to Main)"
              className="w-6 h-6 bg-gradient-to-b from-red-400 to-red-600 hover:from-red-300 hover:to-red-500 flex items-center justify-center border border-red-700"
            >
              <X size={14} className="text-white" />
            </motion.button>
          </div>
        </div>

        {/* Window Content */}
        <div style={{ background: '#ECE9D8' }}>
        <div className="p-8 space-y-6">
          {/* Success Header */}
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', delay: 0.2 }}
            className="flex flex-col items-center gap-4"
          >
            <div className="relative">
              <motion.div
                animate={{
                  rotate: 360,
                  scale: [1, 1.2, 1],
                }}
                transition={{
                  rotate: { duration: 2, repeat: Infinity, ease: 'linear' },
                  scale: { duration: 1, repeat: Infinity },
                }}
                className="w-20 h-20 bg-gradient-to-br from-green-400 to-green-600 flex items-center justify-center shadow-xl"
              >
                <Check size={40} className="text-white" />
              </motion.div>
              
              {/* Celebration Particles */}
              {[...Array(8)].map((_, i) => (
                <motion.div
                  key={i}
                  initial={{ scale: 0, x: 0, y: 0 }}
                  animate={{
                    scale: [0, 1, 0],
                    x: Math.cos((i * Math.PI * 2) / 8) * 60,
                    y: Math.sin((i * Math.PI * 2) / 8) * 60,
                  }}
                  transition={{
                    duration: 1,
                    delay: 0.3,
                  }}
                  className="absolute top-1/2 left-1/2"
                >
                  <Sparkles size={16} className="text-yellow-400" />
                </motion.div>
              ))}
            </div>

            <div className="text-center">
              <h2 className="text-3xl font-bold text-gray-800">
                Success!
              </h2>
              <p className="text-gray-600 mt-2">
                {urls.length === 1 
                  ? 'Your URL has been generated' 
                  : `${urls.length} URLs have been generated`}
              </p>
            </div>
          </motion.div>

          {/* URLs Display */}
          <div className="xp-panel p-6 space-y-4">
            {urls.length === 1 ? (
              // Single URL - Large Display
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
                className="space-y-3"
              >
                <div className="bg-white border-2 border-blue-400 p-4">
                  <div className="flex items-center gap-3">
                    <ExternalLink size={20} className="text-blue-500 flex-shrink-0" />
                    <code className="flex-1 text-lg font-mono text-gray-800 break-all">
                      {urls[0]}
                    </code>
                  </div>
                </div>

                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => copyToClipboard(urls[0], 0)}
                  className="w-full xp-button flex items-center justify-center gap-2 text-lg"
                >
                  {copiedIndex === 0 ? (
                    <>
                      <Check size={20} />
                      Copied!
                    </>
                  ) : (
                    <>
                      <Copy size={20} />
                      COPY URL
                    </>
                  )}
                </motion.button>
              </motion.div>
            ) : (
              // Multiple URLs - List Display
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-gray-700">
                    Generated URLs ({urls.length})
                  </span>
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={copyAllUrls}
                    className="xp-button text-sm py-2 px-4 flex items-center gap-2"
                  >
                    {copiedAll ? (
                      <>
                        <Check size={16} />
                        All Copied!
                      </>
                    ) : (
                      <>
                        <Copy size={16} />
                        Copy All
                      </>
                    )}
                  </motion.button>
                </div>

                <div className="space-y-2 max-h-[400px] overflow-y-auto">
                  {urls.map((url, index) => (
                    <motion.div
                      key={index}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.4 + index * 0.05 }}
                      className="bg-white border-2 border-gray-300 p-3 flex items-center gap-3 hover:border-blue-400 transition-colors"
                    >
                      <ExternalLink size={16} className="text-blue-500 flex-shrink-0" />
                      <code className="flex-1 text-sm font-mono text-gray-800 break-all">
                        {url}
                      </code>
                      <motion.button
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.9 }}
                        onClick={() => copyToClipboard(url, index)}
                        className="p-2 hover:bg-blue-100 flex-shrink-0"
                      >
                        {copiedIndex === index ? (
                          <Check size={16} className="text-green-500" />
                        ) : (
                          <Copy size={16} className="text-blue-500" />
                        )}
                      </motion.button>
                    </motion.div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex gap-4">
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={onReset}
              className="flex-1 bg-gradient-to-b from-blue-400 to-blue-600 hover:from-blue-300 hover:to-blue-500 text-white font-semibold py-3 px-6 shadow-xp border-2 border-blue-700 flex items-center justify-center gap-2"
            >
              <RotateCcw size={20} />
              Generate Another
            </motion.button>
          </div>

          {/* Info Note */}
          <div className="bg-blue-50 border-2 border-blue-300 p-4 text-sm text-blue-800">
            <p className="font-semibold mb-1">ℹ️ Demo Mode</p>
            <p className="text-xs">
              These are demonstration URLs. In production, this would integrate with a real URL shortening service or file hosting backend.
            </p>
          </div>
        </div>
        </div>
      </motion.div>
    </motion.div>
  )
}
