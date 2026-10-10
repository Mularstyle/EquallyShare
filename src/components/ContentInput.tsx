import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { FileText, FolderOpen } from 'lucide-react'
import FileDropzone from './FileDropzone'
import TextInput from './TextInput'

interface ContentInputProps {
  content: { type: 'text' | 'files'; text?: string; files?: File[] }
  onChange: (content: { type: 'text' | 'files'; text?: string; files?: File[] }) => void
  disabled?: boolean
}

export default function ContentInput({ content, onChange, disabled }: ContentInputProps) {
  const [mode, setMode] = useState<'files' | 'text'>('text')

  const handleModeChange = (newMode: 'files' | 'text') => {
    setMode(newMode)
    onChange({ type: newMode })
  }

  const handleFilesChange = (files: File[]) => {
    onChange({ type: 'files', files })
  }

  const handleTextChange = (text: string) => {
    onChange({ type: 'text', text })
  }

  return (
    <div className="space-y-4">
      {/* Panel Header */}
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center shadow-lg">
          <span className="text-white font-bold text-sm">01</span>
        </div>
        <h2 className="text-xl font-bold text-gray-800 tracking-tight">
          CONTENT INPUT
        </h2>
      </div>

      {/* Tab Selector */}
      <div className="flex gap-2 p-1 border-2 border-gray-400" style={{ background: '#D4D0C8' }}>
        <motion.button
          whileTap={{ scale: 0.95 }}
          onClick={() => handleModeChange('text')}
          disabled={disabled}
          className={`flex-1 py-2 px-4 font-semibold transition-all border-2 ${
            mode === 'text'
              ? 'bg-white border-gray-400 shadow-inner'
              : 'border-white border-t-white border-l-white border-r-gray-600 border-b-gray-600'
          }`}
          style={mode !== 'text' ? { 
            background: '#ECE9D8',
            boxShadow: '1px 1px 0 rgba(0,0,0,0.1), inset -1px -1px 0 rgba(0,0,0,0.1)'
          } : {}}
        >
          <FileText size={16} className="inline mr-2" />
          TEXT
        </motion.button>
        
        <motion.button
          whileTap={{ scale: 0.95 }}
          onClick={() => handleModeChange('files')}
          disabled={disabled}
          className={`flex-1 py-2 px-4 font-semibold transition-all border-2 ${
            mode === 'files'
              ? 'bg-white border-gray-400 shadow-inner'
              : 'border-white border-t-white border-l-white border-r-gray-600 border-b-gray-600'
          }`}
          style={mode !== 'files' ? { 
            background: '#ECE9D8',
            boxShadow: '1px 1px 0 rgba(0,0,0,0.1), inset -1px -1px 0 rgba(0,0,0,0.1)'
          } : {}}
        >
          <FolderOpen size={16} className="inline mr-2" />
          FILES
        </motion.button>
      </div>

      {/* Content Area */}
      <div className="xp-panel p-4 min-h-[300px]">
        <AnimatePresence mode="wait">
          {mode === 'text' ? (
            <TextInput
              key="text"
              value={content.text || ''}
              onChange={handleTextChange}
              disabled={disabled}
            />
          ) : (
            <FileDropzone
              key="files"
              files={content.files || []}
              onChange={handleFilesChange}
              disabled={disabled}
            />
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
