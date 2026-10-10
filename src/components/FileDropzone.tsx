import { useCallback, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Upload, File, FileText, Video, Music, Image, X } from 'lucide-react'

interface FileDropzoneProps {
  files: File[]
  onChange: (files: File[]) => void
  disabled?: boolean
}

export default function FileDropzone({ files, onChange, disabled }: FileDropzoneProps) {
  const [isDragging, setIsDragging] = useState(false)

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    
    if (disabled) return

    const droppedFiles = Array.from(e.dataTransfer.files)
    onChange([...files, ...droppedFiles])
  }, [files, onChange, disabled])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    if (!disabled) setIsDragging(true)
  }, [disabled])

  const handleDragLeave = useCallback(() => {
    setIsDragging(false)
  }, [])

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const selectedFiles = Array.from(e.target.files)
      onChange([...files, ...selectedFiles])
    }
  }

  const removeFile = (index: number) => {
    onChange(files.filter((_, i) => i !== index))
  }

  const getFileIcon = (file: File) => {
    if (file.type.startsWith('image/')) return <Image size={20} className="text-blue-500" />
    if (file.type.startsWith('video/')) return <Video size={20} className="text-purple-500" />
    if (file.type.startsWith('audio/')) return <Music size={20} className="text-pink-500" />
    if (file.type.includes('pdf')) return <FileText size={20} className="text-red-500" />
    return <File size={20} className="text-gray-500" />
  }

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B'
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="h-full flex flex-col"
    >
      {files.length === 0 ? (
        <div
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          className={`
            flex-1 border-4 border-dashed flex flex-col items-center justify-center gap-4 transition-all
            ${isDragging 
              ? 'border-blue-500 bg-blue-50' 
              : 'border-gray-400 bg-white hover:border-blue-400 hover:bg-blue-50/50'
            }
            ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
          `}
        >
          <motion.div
            animate={{
              y: isDragging ? -10 : [0, -10, 0],
              scale: isDragging ? 1.1 : 1,
            }}
            transition={{
              y: { duration: 2, repeat: Infinity },
            }}
          >
            <Upload size={48} className={isDragging ? 'text-blue-500' : 'text-gray-400'} />
          </motion.div>
          
          <div className="text-center">
            <p className="text-lg font-semibold text-gray-700">
              {isDragging ? 'Drop your files here' : 'Drop your files here or browse'}
            </p>
            <p className="text-sm text-gray-500 mt-1">
              PDF, Video (MP4, WebM), Audio (MP3), Images
            </p>
          </div>

          <label className="xp-button cursor-pointer">
            <Upload size={16} className="inline mr-2" />
            Browse Files
            <input
              type="file"
              multiple
              onChange={handleFileInput}
              disabled={disabled}
              className="hidden"
              accept=".pdf,.mp4,.webm,.mp3,.jpg,.jpeg,.png,.gif"
            />
          </label>
        </div>
      ) : (
        <div className="space-y-2">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-semibold text-gray-700">
              {files.length} file{files.length > 1 ? 's' : ''} selected
            </span>
            <label className="xp-button text-sm py-2 px-4 cursor-pointer">
              <Upload size={14} className="inline mr-1" />
              Add More
              <input
                type="file"
                multiple
                onChange={handleFileInput}
                disabled={disabled}
                className="hidden"
                accept=".pdf,.mp4,.webm,.mp3,.jpg,.jpeg,.png,.gif"
              />
            </label>
          </div>

          <div className="space-y-2 max-h-[200px] overflow-y-auto">
            <AnimatePresence>
              {files.map((file, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  className="flex items-center gap-3 p-3 bg-white border-2 border-gray-300 hover:border-blue-400 transition-colors"
                >
                  {getFileIcon(file)}
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm text-gray-800 truncate">
                      {file.name}
                    </p>
                    <p className="text-xs text-gray-500">
                      {formatFileSize(file.size)}
                    </p>
                  </div>
                  <motion.button
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                    onClick={() => removeFile(index)}
                    className="p-1 hover:bg-red-100"
                    disabled={disabled}
                  >
                    <X size={16} className="text-red-500" />
                  </motion.button>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </div>
      )}
    </motion.div>
  )
}
