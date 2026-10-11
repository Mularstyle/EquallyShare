import { LoaderCircle } from "lucide-react";

interface GenerateButtonProps {
  onClick: () => void;
  disabled?: boolean | undefined;
  loading?: boolean;
}

/** Four-pane Windows flag drawn with CSS so it stays crisp at any size. */
function WindowsFlag() {
  return (
    <span className="grid grid-cols-2 gap-[2px] w-7 h-7 -skew-y-6 shrink-0" aria-hidden="true">
      <span className="bg-[#f65314] rounded-tl-md" />
      <span className="bg-[#7cbb00] rounded-tr-md" />
      <span className="bg-[#00a1f1] rounded-bl-md" />
      <span className="bg-[#ffbb00] rounded-br-md" />
    </span>
  );
}

/** The create button, styled like the Windows XP "start" button. */
export default function GenerateButton({ onClick, disabled, loading }: GenerateButtonProps) {
  return (
    <div className="flex justify-center pt-4">
      <button type="button" onClick={onClick} disabled={disabled || loading} className="xp-start-button">
        {loading ? <LoaderCircle size={28} className="animate-spin" /> : <WindowsFlag />}
        <span>{loading ? "กำลังสร้าง..." : "สร้าง Share"}</span>
      </button>
    </div>
  );
}
