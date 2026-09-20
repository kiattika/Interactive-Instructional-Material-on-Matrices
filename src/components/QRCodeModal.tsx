import React, { useEffect, useState } from 'react';
import { toDataURL } from 'qrcode';
import { X } from 'lucide-react';

interface QRCodeModalProps {
  classCode: string;
  onClose: () => void;
}

// Pure convenience/sharing: printing or projecting this QR so students scan instead of typing
// the code, reducing typos. The raw code is always shown underneath as a fallback for anyone
// who can't scan. Typed as React.FC — see StudentRosterRow.tsx for why (no @types/react here).
export const QRCodeModal: React.FC<QRCodeModalProps> = ({ classCode, onClose }) => {
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const joinUrl = `${window.location.origin}/?code=${encodeURIComponent(classCode)}`;

  useEffect(() => {
    let cancelled = false;
    setDataUrl(null);
    toDataURL(joinUrl, { width: 240, margin: 1 })
      .then((url) => {
        if (!cancelled) setDataUrl(url);
      })
      .catch(() => {
        if (!cancelled) setDataUrl(null);
      });
    return () => {
      cancelled = true;
    };
  }, [joinUrl]);

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl shadow-2xl max-w-xs w-full border border-slate-200 p-6 space-y-4 text-center">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-black text-slate-800">QR เข้าร่วมห้องเรียน</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex items-center justify-center p-4 bg-slate-50 rounded-2xl border border-slate-200">
          {dataUrl ? (
            <img src={dataUrl} alt={`QR code สำหรับห้องเรียน ${classCode}`} className="w-48 h-48" />
          ) : (
            <div className="w-48 h-48 flex items-center justify-center text-xs text-slate-400">
              กำลังสร้าง QR...
            </div>
          )}
        </div>

        <p className="text-[11px] text-slate-400 leading-relaxed">
          ให้นักเรียนสแกนเพื่อเข้าร่วมห้องเรียนทันที หรือพิมพ์รหัสด้วยตนเองที่นี่:
        </p>
        <p className="text-2xl font-black text-indigo-700 tracking-[0.2em]">{classCode}</p>
      </div>
    </div>
  );
};
