import { useEffect, useState } from "react";
import { Check, Copy, ExternalLink } from "lucide-react";
import QRCode from "qrcode";

interface SharePanelProps {
  shareUrl: string;
}

/** URL and QR for passing the share on. Every scan adds a Recipient and shrinks everyone's portion. */
export default function SharePanel({ shareUrl }: SharePanelProps) {
  const [qr, setQr] = useState<string | null>();
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let cancelled = false;
    QRCode.toDataURL(shareUrl, { margin: 1, width: 320 })
      .then((url) => { if (!cancelled) setQr(url); })
      .catch(() => { if (!cancelled) setQr(null); });
    return () => { cancelled = true; };
  }, [shareUrl]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2_000);
    } catch { /* clipboard blocked: the URL is still selectable */ }
  };

  return (
    <div className="xp-panel p-4 space-y-3">
      <div className="bg-white border-2 border-blue-400 p-3 flex items-center justify-center min-h-[180px]">
        {qr ? <img src={qr} alt="QR code ของลิงก์ share" className="w-full max-w-[220px] aspect-square" style={{ imageRendering: "pixelated" }} />
          : qr === null ? <p className="text-sm text-gray-600 text-center">สร้าง QR ไม่ได้ ใช้ลิงก์ด้านล่างแทน</p>
          : null}
      </div>
      <div className="bg-white border-2 border-gray-300 p-2 flex items-center gap-2">
        <ExternalLink size={16} className="text-blue-500 shrink-0" />
        <code className="flex-1 text-xs font-mono text-gray-800 break-all select-all">{shareUrl}</code>
      </div>
      <button type="button" onClick={copy} className="w-full xp-button-silver flex items-center justify-center gap-2">
        {copied ? <><Check size={18} /> Copied!</> : <><Copy size={18} /> COPY URL</>}
      </button>
    </div>
  );
}
