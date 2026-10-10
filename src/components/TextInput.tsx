import { motion } from 'framer-motion'
import { X } from 'lucide-react'

interface TextInputProps {
  value: string
  onChange: (value: string) => void
  disabled?: boolean
}

export default function TextInput({ value, onChange, disabled }: TextInputProps) {
  const maxLength = 5000
  const charCount = value.length

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="h-full flex flex-col gap-3"
    >
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        placeholder="Type something you want to share..."
        maxLength={maxLength}
        className="flex-1 w-full min-h-[200px] p-4 border-2 border-gray-300 resize-none focus:outline-none focus:border-blue-500 transition-all font-mono text-sm disabled:opacity-50 disabled:cursor-not-allowed"
      />

      <div className="flex items-center justify-between">
        <span className={`text-sm ${charCount > maxLength * 0.9 ? 'text-red-600 font-semibold' : 'text-gray-500'}`}>
          {charCount} / {maxLength}
        </span>

        {value && (
          <motion.button
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => onChange('')}
            disabled={disabled}
            className="flex items-center gap-2 px-3 py-1 border-2 border-white border-t-white border-l-white border-r-gray-600 border-b-gray-600 text-sm font-semibold text-gray-700 transition-colors"
            style={{ 
              background: '#ECE9D8',
              boxShadow: '1px 1px 0 rgba(0,0,0,0.1), inset -1px -1px 0 rgba(0,0,0,0.1)'
            }}
          >
            <X size={14} />
            Clear
          </motion.button>
        )}
      </div>
    </motion.div>
  )
}
