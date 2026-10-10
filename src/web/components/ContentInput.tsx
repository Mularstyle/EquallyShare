import { motion, AnimatePresence } from "framer-motion";
import { Film, FileText, Image as ImageIcon, Music } from "lucide-react";
import MediaDropzone from "./MediaDropzone";
import TextInput from "./TextInput";

export type ContentDraft = { type: "text"; text: string } | { type: "image" | "audio" | "video"; file: File | undefined };

interface ContentInputProps {
  content: ContentDraft;
  onChange: (content: ContentDraft) => void;
  onReject: (message: string) => void;
  disabled?: boolean | undefined;
}

function TabButton({ active, onClick, disabled, children }: { active: boolean; onClick: () => void; disabled?: boolean | undefined; children: React.ReactNode }) {
  return (
    <motion.button
      whileTap={{ scale: 0.95 }}
      onClick={onClick}
      disabled={disabled}
      aria-pressed={active}
      className={`flex-1 py-2 px-2 sm:px-4 font-semibold transition-all border-2 ${active ? "bg-white border-gray-400 shadow-inner" : "border-t-white border-l-white border-r-gray-600 border-b-gray-600"}`}
      style={active ? {} : { background: "#ECE9D8", boxShadow: "1px 1px 0 rgba(0,0,0,0.1), inset -1px -1px 0 rgba(0,0,0,0.1)" }}
    >
      {children}
    </motion.button>
  );
}

/** One original per share: text, a single image, a single MP3 or a single MP4. */
export default function ContentInput({ content, onChange, onReject, disabled }: ContentInputProps) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center shadow-lg">
          <span className="text-white font-bold text-sm">01</span>
        </div>
        <h2 className="text-xl font-bold text-gray-800 tracking-tight">CONTENT INPUT</h2>
      </div>

      <div className="flex gap-2 p-1 border-2 border-gray-400" style={{ background: "#D4D0C8" }}>
        <TabButton active={content.type === "text"} onClick={() => content.type !== "text" && onChange({ type: "text", text: "" })} disabled={disabled}>
          <FileText size={16} className="inline mr-2" />
          TEXT
        </TabButton>
        <TabButton active={content.type === "image"} onClick={() => content.type !== "image" && onChange({ type: "image", file: undefined })} disabled={disabled}>
          <ImageIcon size={16} className="inline mr-2" />
          IMAGE
        </TabButton>
        <TabButton active={content.type === "audio"} onClick={() => content.type !== "audio" && onChange({ type: "audio", file: undefined })} disabled={disabled}>
          <Music size={16} className="inline mr-2" />
          MP3
        </TabButton>
        <TabButton active={content.type === "video"} onClick={() => content.type !== "video" && onChange({ type: "video", file: undefined })} disabled={disabled}>
          <Film size={16} className="inline mr-2" />
          MP4
        </TabButton>
      </div>

      <div className="xp-panel p-4 min-h-[300px]">
        <AnimatePresence mode="wait">
          {content.type === "text" ? (
            <TextInput key="text" value={content.text} onChange={(text) => onChange({ type: "text", text })} disabled={disabled} />
          ) : (
            <MediaDropzone key={content.type} kind={content.type} file={content.file} onChange={(file) => onChange({ type: content.type, file })} onReject={onReject} disabled={disabled} />
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
