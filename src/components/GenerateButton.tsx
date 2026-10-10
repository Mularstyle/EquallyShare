import { motion } from 'framer-motion'
import { Sparkles, Loader2 } from 'lucide-react'

interface GenerateButtonProps {
  onClick: () => void
  disabled?: boolean
  loading?: boolean
}

export default function GenerateButton({ onClick, disabled, loading }: GenerateButtonProps) {
  return (
    <div className="flex justify-center pt-4">
      <motion.button
        whileHover={!disabled && !loading ? { scale: 1.05, y: -2 } : {}}
        whileTap={!disabled && !loading ? { scale: 0.95 } : {}}
        onClick={onClick}
        disabled={disabled || loading}
        className="relative px-12 py-5 text-2xl font-bold text-white overflow-hidden disabled:opacity-50 disabled:cursor-not-allowed transition-all"
        style={{
          background: '#0054E3',
          boxShadow: '0 4px 8px rgba(0,0,0,0.2)',
        }}
      >
        {/* Button Content */}
        <span className="relative z-10 flex items-center gap-3">
          {loading ? (
            <>
              <Loader2 size={28} className="animate-spin" />
              กำลังสร้าง...
            </>
          ) : (
            <>
              <Sparkles size={28} />
              สร้าง URL
            </>
          )}
        </span>
      </motion.button>
    </div>
  )
}
