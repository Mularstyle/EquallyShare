import { motion } from 'framer-motion'
import { Plus, Minus } from 'lucide-react'

interface QuantityInputProps {
  value: number
  onChange: (value: number) => void
  disabled?: boolean
  min?: number
  max?: number
}

export default function QuantityInput({ 
  value, 
  onChange, 
  disabled,
  min = 1,
  max = 100
}: QuantityInputProps) {
  
  const handleIncrement = () => {
    if (value < max) onChange(value + 1)
  }

  const handleDecrement = () => {
    if (value > min) onChange(value - 1)
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const num = parseInt(e.target.value) || 0
    if (num >= min && num <= max) {
      onChange(num)
    }
  }

  return (
    <div className="space-y-4">
      {/* Panel Header */}
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 bg-gradient-to-br from-cyan-500 to-cyan-600 flex items-center justify-center shadow-lg">
          <span className="text-white font-bold text-sm">02</span>
        </div>
        <h2 className="text-xl font-bold text-gray-800 tracking-tight">
          QUANTITY
        </h2>
      </div>

      {/* Quantity Control */}
      <div className="xp-panel p-8 min-h-[300px] flex flex-col items-center justify-center gap-6">
        <div className="text-center">
          <label className="text-sm font-semibold text-gray-600 uppercase tracking-wide">
            Number of URLs
          </label>
          <p className="text-xs text-gray-500 mt-1">
            Min: {min} • Max: {max}
          </p>
        </div>

        <div className="flex items-center gap-4">
          {/* Decrement Button */}
          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            onClick={handleDecrement}
            disabled={disabled || value <= min}
            className="w-14 h-14 bg-gradient-to-b from-red-400 to-red-600 hover:from-red-300 hover:to-red-500 text-white shadow-xp border-2 border-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            <Minus size={24} className="mx-auto" />
          </motion.button>

          {/* Number Display */}
          <motion.div
            key={value}
            initial={{ scale: 1.2, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="relative"
          >
            <input
              type="number"
              value={value}
              onChange={handleInputChange}
              disabled={disabled}
              min={min}
              max={max}
              className="w-32 h-20 text-5xl font-bold text-center bg-white border-4 border-blue-500 shadow-inner focus:outline-none transition-all disabled:opacity-50"
              style={{
                textShadow: '2px 2px 4px rgba(0,0,0,0.1)',
              }}
            />
          </motion.div>

          {/* Increment Button */}
          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            onClick={handleIncrement}
            disabled={disabled || value >= max}
            className="w-14 h-14 bg-gradient-to-b from-green-400 to-green-600 hover:from-green-300 hover:to-green-500 text-white shadow-xp border-2 border-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            <Plus size={24} className="mx-auto" />
          </motion.button>
        </div>

        {/* Quick Presets */}
        <div className="flex gap-2">
          {[1, 5, 10, 25].map((preset) => (
            <motion.button
              key={preset}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => onChange(preset)}
              disabled={disabled}
              className={`px-4 py-2 font-semibold text-sm transition-all border-2 ${
                value === preset
                  ? 'bg-white border-blue-500 shadow-inner'
                  : 'border-white border-t-white border-l-white border-r-gray-600 border-b-gray-600'
              }`}
              style={value !== preset ? { 
                background: '#ECE9D8',
                boxShadow: '1px 1px 0 rgba(0,0,0,0.1), inset -1px -1px 0 rgba(0,0,0,0.1)'
              } : {}}
            >
              {preset}
            </motion.button>
          ))}
        </div>

        {/* Validation Message */}
        {(value < min || value > max) && (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-red-600 text-sm font-semibold"
          >
            Please enter a value between {min} and {max}
          </motion.p>
        )}
      </div>
    </div>
  )
}
