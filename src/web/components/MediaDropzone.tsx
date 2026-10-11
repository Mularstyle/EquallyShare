import { useEffect, useState, type ChangeEvent, type DragEvent } from "react";
import { BookOpen, Film, Image as ImageIcon, Music, Upload, X } from "lucide-react";
import { acceptedAudioTypes, acceptedImageTypes, acceptedPdfTypes, acceptedVideoTypes, maxDirectUploadBytes, maxUploadBytes } from "../api";

export type MediaKind = "image" | "audio" | "video" | "pdf";

interface MediaDropzoneProps {
  kind: MediaKind;
  file: File | undefined;
  onChange: (file: File | undefined) => void;
  onReject: (message: string) => void;
  disabled?: boolean | undefined;
}

const copy = {
  image: { drop: "ลากภาพมาวาง หรือเลือกไฟล์", hint: "PNG, JPEG, WebP · ไม่เกิน 4 MB · 1 ภาพต่อ share", browse: "Browse Image", reject: "รองรับเฉพาะภาพ PNG, JPEG หรือ WebP", accept: acceptedImageTypes.join(",") },
  audio: { drop: "ลากไฟล์เสียงมาวาง หรือเลือกไฟล์", hint: "MP3 · ไม่เกิน 4 MB (ราว 4 นาที) · 1 ไฟล์ต่อ share", browse: "Browse MP3", reject: "รองรับเฉพาะไฟล์เสียง MP3", accept: ".mp3,audio/mpeg" },
  pdf: { drop: "ลาก PDF มาวาง หรือเลือกไฟล์", hint: "PDF · ไม่เกิน 50 MB · แบ่งตามหน้า", browse: "Browse PDF", reject: "รองรับเฉพาะไฟล์ PDF", accept: ".pdf,application/pdf" },
  video: { drop: "ลากวิดีโอมาวาง หรือเลือกไฟล์", hint: "MP4 · ไม่เกิน 50 MB · แบ่งตามช่วงเวลา (ตัดที่ keyframe)", browse: "Browse MP4", reject: "รองรับเฉพาะวิดีโอ MP4", accept: ".mp4,video/mp4" },
};

const formatFileSize = (bytes: number) => bytes < 1024 * 1024 ? `${(bytes / 1024).toFixed(1)} KB` : `${(bytes / (1024 * 1024)).toFixed(1)} MB`;

function accepts(kind: MediaKind, file: File): boolean {
  if (kind === "image") return acceptedImageTypes.includes(file.type);
  if (kind === "pdf") return acceptedPdfTypes.includes(file.type) || (!file.type && /\.pdf$/i.test(file.name));
  if (kind === "video") return acceptedVideoTypes.includes(file.type) || (!file.type && /\.mp4$/i.test(file.name));
  // Some systems leave MP3 types empty; fall back to the extension. The server checks the bytes.
  return acceptedAudioTypes.includes(file.type) || (!file.type.startsWith("image/") && /\.mp3$/i.test(file.name));
}

/** One original file per share (image, MP3, MP4 or PDF). Static on purpose: no animation. The server re-validates everything. */
export default function MediaDropzone({ kind, file, onChange, onReject, disabled }: MediaDropzoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [preview, setPreview] = useState<string>();
  const text = copy[kind];

  useEffect(() => {
    if (!file) { setPreview(undefined); return; }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const pick = (candidate: File | undefined) => {
    if (!candidate) return;
    if (!accepts(kind, candidate)) { onReject(text.reject); return; }
    const limit = kind === "video" || kind === "pdf" ? maxDirectUploadBytes : maxUploadBytes;
    if (candidate.size > limit) { onReject(`ไฟล์ใหญ่เกิน ${limit / 1024 / 1024} MB`); return; }
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

  const Icon = kind === "image" ? ImageIcon : kind === "video" ? Film : kind === "pdf" ? BookOpen : Music;

  return (
    <div className="h-full flex flex-col">
      {!file ? (
        <div
          onDrop={handleDrop}
          onDragOver={(e) => { e.preventDefault(); if (!disabled) setIsDragging(true); }}
          onDragLeave={() => setIsDragging(false)}
          className={`flex-1 min-h-[260px] border-4 border-dashed flex flex-col items-center justify-center gap-4 p-4 ${
            isDragging ? "border-blue-500 bg-blue-50" : "border-gray-400 bg-white hover:border-blue-400 hover:bg-blue-50/50"
          } ${disabled ? "opacity-50 cursor-not-allowed" : ""}`}
        >
          <Upload size={48} className={isDragging ? "text-blue-500" : "text-gray-400"} />
          <div className="text-center">
            <p className="text-lg font-semibold text-gray-700">{isDragging ? "วางไฟล์ที่นี่" : text.drop}</p>
            <p className="text-sm text-gray-500 mt-1">{text.hint}</p>
          </div>
          <label className="xp-button cursor-pointer">
            <Upload size={16} className="inline mr-2" />
            {text.browse}
            <input type="file" onChange={handleInput} disabled={disabled} className="hidden" accept={text.accept} />
          </label>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="bg-white border-2 border-gray-300 p-2 flex items-center justify-center">
            {kind === "pdf" ? <BookOpen size={56} className="text-red-500 my-6" aria-hidden="true" /> : preview && (kind === "image"
              ? <img src={preview} alt="ภาพที่เลือก" className="max-h-[220px] max-w-full object-contain" />
              : kind === "video" ? <video src={preview} controls playsInline muted className="max-h-[220px] max-w-full" aria-label="ดูวิดีโอที่เลือก" />
              : <audio src={preview} controls className="w-full" aria-label="ฟังไฟล์ที่เลือก" />)}
          </div>
          <div className="flex items-center gap-3 p-3 bg-white border-2 border-gray-300">
            <Icon size={20} className="text-blue-500 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="font-medium text-sm text-gray-800 truncate">{file.name}</p>
              <p className="text-xs text-gray-500">{formatFileSize(file.size)}</p>
            </div>
            <button type="button" onClick={() => onChange(undefined)} className="p-1 hover:bg-red-100" disabled={disabled} aria-label="Remove file">
              <X size={16} className="text-red-500" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
