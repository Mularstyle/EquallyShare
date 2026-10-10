import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import XPWindow from './components/XPWindow'
import ContentInput from './components/ContentInput'
import QuantityInput from './components/QuantityInput'
import GenerateButton from './components/GenerateButton'
import ShatterTransition from './components/ShatterTransition'
import ResultWindow from './components/ResultWindow'
import AnimatedBackground from './components/AnimatedBackground'

type AppState = 'idle' | 'validating' | 'generating' | 'shattering' | 'success' | 'error'

interface ContentData {
  type: 'text' | 'files'
  text?: string
  files?: File[]
}

function App() {
  const [state, setState] = useState<AppState>('idle')
  const [content, setContent] = useState<ContentData>({ type: 'text' })
  const [quantity, setQuantity] = useState(1)
  const [generatedUrls, setGeneratedUrls] = useState<string[]>([])
  const [errorMessage, setErrorMessage] = useState('')
  const [showShatter, setShowShatter] = useState(false)
  const [isMinimized, setIsMinimized] = useState(false)

  // Custom cursor trail effect
  useEffect(() => {
    const trail = document.createElement('div')
    trail.className = 'cursor-trail'
    document.body.appendChild(trail)

    let mouseX = 0
    let mouseY = 0
    let trailX = 0
    let trailY = 0

    const handleMouseMove = (e: MouseEvent) => {
      mouseX = e.clientX
      mouseY = e.clientY
    }

    const updateTrail = () => {
      const dx = mouseX - trailX
      const dy = mouseY - trailY
      trailX += dx * 0.1
      trailY += dy * 0.1
      trail.style.left = `${trailX - 10}px`
      trail.style.top = `${trailY - 10}px`
      requestAnimationFrame(updateTrail)
    }

    window.addEventListener('mousemove', handleMouseMove)
    updateTrail()

    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      document.body.removeChild(trail)
    }
  }, [])

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      // Ctrl/Cmd + Enter to generate
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter' && state === 'idle') {
        e.preventDefault()
        handleGenerate()
      }
    }

    window.addEventListener('keydown', handleKeyPress)
    return () => window.removeEventListener('keydown', handleKeyPress)
  }, [state, content, quantity])

  const validateContent = (): boolean => {
    if (content.type === 'text') {
      if (!content.text || content.text.trim().length === 0) {
        setErrorMessage('Please enter some text to share')
        return false
      }
    } else {
      if (!content.files || content.files.length === 0) {
        setErrorMessage('Please select at least one file')
        return false
      }
    }

    if (quantity < 1 || quantity > 100) {
      setErrorMessage('Quantity must be between 1 and 100')
      return false
    }

    return true
  }

  const handleGenerate = async () => {
    setState('validating')
    setErrorMessage('')

    // Validate
    if (!validateContent()) {
      setState('error')
      setTimeout(() => setState('idle'), 3000)
      return
    }

    setState('generating')

    // Simulate generation process
    await new Promise(resolve => setTimeout(resolve, 1500))

    // Generate demo URLs (in production, this would call a real API)
    const urls: string[] = []
    for (let i = 0; i < quantity; i++) {
      const id = Math.random().toString(36).substring(2, 15)
      urls.push(`https://xpurl.lab/${id}`)
    }

    setGeneratedUrls(urls)

    // Trigger shatter animation
    setState('shattering')
    setShowShatter(true)

    // Wait for shatter animation to complete
    await new Promise(resolve => setTimeout(resolve, 2000))

    setShowShatter(false)
    setState('success')
  }

  const handleReset = () => {
    setState('idle')
    setContent({ type: 'text' })
    setGeneratedUrls([])
    setErrorMessage('')
    setIsMinimized(false)
  }

  const handleMinimize = () => {
    setIsMinimized(true)
  }

  const handleRestore = () => {
    setIsMinimized(false)
  }

  return (
    <div className="relative min-h-screen overflow-hidden scanlines">
      <AnimatedBackground />
      
      <div className="relative z-10 min-h-screen flex items-center justify-center p-4">
        <AnimatePresence mode="wait">
          {!isMinimized && state !== 'success' ? (
            <motion.div
              key="main"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="w-full max-w-4xl"
            >
              <XPWindow title="XP URL LAB — URL Generator" onMinimize={handleMinimize}>
                <div className="p-8 space-y-6">
                  {/* Error Message */}
                  <AnimatePresence>
                    {errorMessage && (
                      <motion.div
                        initial={{ opacity: 0, y: -20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -20 }}
                        className="bg-red-100 border-2 border-red-500 p-4 text-red-700 font-semibold"
                      >
                        ⚠️ {errorMessage}
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Two Main Panels */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <ContentInput
                      content={content}
                      onChange={setContent}
                      disabled={state !== 'idle'}
                    />
                    
                    <QuantityInput
                      value={quantity}
                      onChange={setQuantity}
                      disabled={state !== 'idle'}
                    />
                  </div>

                  {/* Generate Button */}
                  <GenerateButton
                    onClick={handleGenerate}
                    disabled={state !== 'idle'}
                    loading={state === 'validating' || state === 'generating'}
                  />

                  {/* Status Bar */}
                  <div className="border-t-2 border-gray-400 px-4 py-2 text-sm text-gray-700 flex items-center gap-2" style={{ background: '#ECE9D8' }}>
                    <div className="flex items-center gap-2">
                      <div className={`w-2 h-2 rounded-full ${
                        state === 'idle' ? 'bg-green-500' :
                        state === 'error' ? 'bg-red-500' :
                        'bg-yellow-500 animate-pulse'
                      }`} />
                      <span>
                        {state === 'idle' && 'System Ready'}
                        {state === 'validating' && 'Validating...'}
                        {state === 'generating' && 'Generating URL...'}
                        {state === 'shattering' && 'Processing...'}
                        {state === 'error' && 'Error Occurred'}
                      </span>
                    </div>
                    <div className="flex-1" />
                    <span className="text-xs opacity-60">XP URL LAB v1.0</span>
                  </div>
                </div>
              </XPWindow>
            </motion.div>
          ) : !isMinimized ? (
            <ResultWindow
              urls={generatedUrls}
              onReset={handleReset}
              onMinimize={handleMinimize}
            />
          ) : null}
        </AnimatePresence>
      </div>

      {/* XP Taskbar - แสดงเมื่อ minimize */}
      <AnimatePresence>
        {isMinimized && (
          <motion.div
            initial={{ y: 100 }}
            animate={{ y: 0 }}
            exit={{ y: 100 }}
            className="fixed bottom-0 left-0 right-0 z-50"
            style={{
              background: 'linear-gradient(180deg, #245EDC 0%, #1941A5 100%)',
              height: '48px',
              boxShadow: '0 -2px 8px rgba(0,0,0,0.3)',
            }}
          >
            <div className="h-full flex items-center px-2 gap-2">
              {/* Start Button */}
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="h-10 px-4 flex items-center gap-2 font-bold text-white"
                style={{
                  background: 'linear-gradient(180deg, #3C8F3E 0%, #2D6A2E 100%)',
                  border: '1px solid rgba(255,255,255,0.3)',
                  boxShadow: 'inset 1px 1px 2px rgba(255,255,255,0.3), 1px 1px 2px rgba(0,0,0,0.3)',
                }}
              >
                <div className="w-5 h-5 bg-white flex items-center justify-center text-xs font-black text-green-600">
                  ⊞
                </div>
                <span className="text-sm">start</span>
              </motion.button>

              {/* Taskbar Window */}
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={handleRestore}
                className="h-10 px-4 flex items-center gap-2 bg-gradient-to-b from-blue-400 to-blue-600 text-white font-semibold text-sm shadow-lg border-2 border-blue-700"
              >
                <div className="w-4 h-4 bg-white flex items-center justify-center text-blue-600 font-bold text-xs">
                  XP
                </div>
                <span>
                  {state === 'success' ? 'URL Generated Successfully!' : 'XP URL LAB — URL Generator'}
                </span>
              </motion.button>

              <div className="flex-1" />

              {/* System Tray */}
              <div className="flex items-center gap-2 px-3 h-8 border-l border-blue-700">
                <span className="text-xs text-white font-semibold">
                  {new Date().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Shatter Animation Overlay */}
      <AnimatePresence>
        {showShatter && (
          <ShatterTransition onComplete={() => {}} />
        )}
      </AnimatePresence>
    </div>
  )
}

export default App
