import { useEffect, useState, type ChangeEvent, type DragEvent } from "react";
import { motion } from "framer-motion";
import { Image as ImageIcon, Upload, X } from "lucide-react";
import { acceptedImageTypes, maxUploadBytes } from "../api";

interface ImageDropzoneProps {
  file: File | undefined;
  onChange: (file: File | undefined) => void;
  onReject: (message: string) => void;
  disabled?: boolean | undefined;
}

const formatFileSize = (bytes: number) => bytes < 1024 * 1024 ? `${(bytes / 1024).toFixed(1)} KB` : `${(bytes / (1024 * 1024)).toFixed(1)} MB`;

/** One image per share: PNG, JPEG or WebP up to 4 MB. The server re-validates everything. */
export default function ImageDropzone({ file, onChange, onReject, disabled }: ImageDropzoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [preview, setPreview] = useState<string>();

  useEffect(() => {
    if (!file) { setPreview(undefined); return; }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const pick = (candidate: File | undefined) => {
    if (!candidate) return;
    if (!acceptedImageTypes.includes(candidate.type)) { onReject("รองรับเฉพาะภาพ PNG, JPEG หรือ WebP"); return; }
    if (candidate.size > maxUploadBytes) { onReject("ภาพใหญ่เกิน 4 MB"); return; }
    onChange(candidate);
  };

  const handleDrop = (e: DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (!disabled) pick(e.dataTransfer.files[0]);
  };

  const handleInput = (e: ChangeEvent<HTMLInputElement>) => {
    pick(e.target.files?.[0]);
    e.target.value = "";
  };

  const input = <input type="file" onChange={handleInput} disabled={disabled} className="hidden" accept={acceptedImageTypes.join(",")} />;

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="h-full flex flex-col">
      {!file ? (
        <div
          onDrop={handleDrop}
          onDragOver={(e) => { e.preventDefault(); if (!disabled) setIsDragging(true); }}
          onDragLeave={() => setIsDragging(false)}
          className={`flex-1 min-h-[260px] border-4 border-dashed flex flex-col items-center justify-center gap-4 p-4 transition-all ${
            isDragging ? "border-blue-500 bg-blue-50" : "border-gray-400 bg-white hover:border-blue-400 hover:bg-blue-50/50"
          } ${disabled ? "opacity-50 cursor-not-allowed" : ""}`}
        >
          <motion.div animate={{ y: isDragging ? -10 : [0, -10, 0], scale: isDragging ? 1.1 : 1 }} transition={{ y: { duration: 2, repeat: Infinity } }}>
            <Upload size={48} className={isDragging ? "text-blue-500" : "text-gray-400"} />
          </motion.div>
          <div className="text-center">
            <p className="text-lg font-semibold text-gray-700">{isDragging ? "วางภาพที่นี่" : "ลากภาพมาวาง หรือเลือกไฟล์"}</p>
            <p className="text-sm text-gray-500 mt-1">PNG, JPEG, WebP · ไม่เกิน 4 MB · 1 ภาพต่อ share</p>
          </div>
          <label className="xp-button cursor-pointer">
            <Upload size={16} className="inline mr-2" />
            Browse Image
            {input}
          </label>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="bg-white border-2 border-gray-300 p-2 flex items-center justify-center">
            {preview && <img src={preview} alt="ภาพที่เลือก" className="max-h-[220px] max-w-full object-contain" />}
          </div>
          <div className="flex items-center gap-3 p-3 bg-white border-2 border-gray-300">
            <ImageIcon size={20} className="text-blue-500 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="font-medium text-sm text-gray-800 truncate">{file.name}</p>
              <p className="text-xs text-gray-500">{formatFileSize(file.size)}</p>
            </div>
            <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }} onClick={() => onChange(undefined)} className="p-1 hover:bg-red-100" disabled={disabled} aria-label="Remove image">
              <X size={16} className="text-red-500" />
            </motion.button>
          </div>
        </div>
      )}
    </motion.div>
  );
}
