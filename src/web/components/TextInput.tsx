import { motion } from "framer-motion";
import { X } from "lucide-react";

interface TextInputProps {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean | undefined;
}

/** Server limit is counted in grapheme clusters, the same unit used to divide the text. */
export const maxTextUnits = 20_000;
const segmenter = new Intl.Segmenter(undefined, { granularity: "grapheme" });
export const countUnits = (text: string) => [...segmenter.segment(text)].length;

export default function TextInput({ value, onChange, disabled }: TextInputProps) {
  const units = countUnits(value);

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="h-full flex flex-col gap-3">
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        placeholder="พิมพ์หรือวางข้อความที่อยากแชร์... ยิ่งมีคนรับเยอะ แต่ละคนยิ่งได้น้อยลง"
        aria-label="ข้อความที่จะแชร์"
        className="flex-1 w-full min-h-[200px] p-4 border-2 border-gray-300 resize-none focus:outline-none focus:border-blue-500 transition-all font-mono text-sm disabled:opacity-50 disabled:cursor-not-allowed"
      />

      <div className="flex items-center justify-between">
        <span className={`text-sm ${units > maxTextUnits ? "text-red-600 font-semibold" : "text-gray-500"}`}>
          {units.toLocaleString()} / {maxTextUnits.toLocaleString()} ตัวอักษร
        </span>

        {value && (
          <motion.button
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => onChange("")}
            disabled={disabled}
            className="xp-button-silver flex items-center gap-2 px-3 py-1 text-sm"
          >
            <X size={14} />
            Clear
          </motion.button>
        )}
      </div>
    </motion.div>
  );
}
