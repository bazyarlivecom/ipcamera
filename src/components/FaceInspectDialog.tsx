import React, { useState } from 'react';
import {
  X,
  ZoomIn,
  ZoomOut,
  Download,
  Crosshair,
  ShieldCheck,
  Eye,
  Sliders,
} from 'lucide-react';
import { DetectedFace } from '../types';
import { toPersianDigits } from '../utils/dateTime';

interface FaceInspectDialogProps {
  face: DetectedFace | null;
  thumbnail: string;
  onClose: () => void;
}

export const FaceInspectDialog: React.FC<FaceInspectDialogProps> = ({
  face,
  thumbnail,
  onClose,
}) => {
  const [zoomLevel, setZoomLevel] = useState<number>(2);
  const [filterMode, setFilterMode] = useState<'normal' | 'contrast' | 'infrared'>('normal');

  if (!face) return null;

  const handleDownload = () => {
    const link = document.createElement('a');
    link.href = thumbnail;
    link.download = `yunet_face_${face.trackingId}_${Date.now()}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in">
      <div className="bg-slate-900 border border-emerald-500/30 rounded-2xl max-w-xl w-full p-5 shadow-2xl space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center">
              <Crosshair className="w-4 h-4 text-emerald-400" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">
                بررسی موشکافانه چهره #{toPersianDigits(face.trackingId)}
              </h3>
              <p className="text-[11px] text-slate-400 font-mono">
                تشخیص‌داده‌شده توسط الگوریتم YuNet (OpenCV Zoo)
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Zoom Viewer */}
          <div className="relative aspect-square rounded-xl bg-slate-950 border border-slate-800 overflow-hidden flex items-center justify-center">
            <img
              src={thumbnail}
              alt="Face"
              className={`w-full h-full object-cover transition-transform duration-200 ${
                zoomLevel === 1 ? 'scale-100' : zoomLevel === 2 ? 'scale-150' : 'scale-200'
              } ${
                filterMode === 'contrast'
                  ? 'contrast-150 brightness-110'
                  : filterMode === 'infrared'
                  ? 'invert hue-rotate-180 contrast-200'
                  : ''
              }`}
            />

            {/* Corner brackets */}
            <div className="absolute top-2 left-2 w-3 h-3 border-t-2 border-l-2 border-emerald-400 pointer-events-none" />
            <div className="absolute top-2 right-2 w-3 h-3 border-t-2 border-r-2 border-emerald-400 pointer-events-none" />
            <div className="absolute bottom-2 left-2 w-3 h-3 border-b-2 border-l-2 border-emerald-400 pointer-events-none" />
            <div className="absolute bottom-2 right-2 w-3 h-3 border-b-2 border-r-2 border-emerald-400 pointer-events-none" />

            {/* Magnifier controls */}
            <div className="absolute bottom-2 inset-x-2 flex items-center justify-between bg-slate-900/80 backdrop-blur-sm px-2 py-1 rounded border border-slate-800 text-[10px] font-mono">
              <span className="text-emerald-400">بزرگنمایی: {zoomLevel}x</span>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setZoomLevel((z) => Math.max(1, z - 1))}
                  className="p-0.5 rounded hover:bg-slate-800 text-slate-300"
                  disabled={zoomLevel <= 1}
                >
                  <ZoomOut className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => setZoomLevel((z) => Math.min(3, z + 1))}
                  className="p-0.5 rounded hover:bg-slate-800 text-slate-300"
                  disabled={zoomLevel >= 3}
                >
                  <ZoomIn className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>

          {/* Details & Metrics */}
          <div className="space-y-3 flex flex-col justify-between">
            <div className="space-y-2">
              <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-800 text-xs">
                <div className="text-slate-400 mb-1">اطمینان مدل (YuNet Confidence):</div>
                <div className="flex items-center justify-between">
                  <span className="text-lg font-bold font-mono text-emerald-400">
                    {toPersianDigits(face.confidence.toFixed(1))}٪
                  </span>
                  <span className="text-[10px] bg-emerald-500/10 text-emerald-300 px-2 py-0.5 rounded border border-emerald-500/30">
                    تشخیص معتبر
                  </span>
                </div>
                {/* Progress bar */}
                <div className="w-full h-1.5 bg-slate-800 rounded-full mt-2 overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-emerald-500 to-cyan-400"
                    style={{ width: `${Math.min(100, face.confidence)}%` }}
                  />
                </div>
              </div>

              {/* Coordinates */}
              <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-800 text-xs space-y-1 font-mono">
                <div className="text-slate-400 font-sans text-[11px]">مختصات کادر چهره (Bounding Box):</div>
                <div className="grid grid-cols-2 gap-1 text-[11px] text-slate-300">
                  <div>X: {(face.box.x * 100).toFixed(1)}%</div>
                  <div>Y: {(face.box.y * 100).toFixed(1)}%</div>
                  <div>عرض: {(face.box.width * 100).toFixed(1)}%</div>
                  <div>ارتفاع: {(face.box.height * 100).toFixed(1)}%</div>
                </div>
              </div>

              {/* Landmarks */}
              {face.landmarks && (
                <div className="bg-slate-950 p-2 rounded-lg border border-slate-800 text-[11px]">
                  <div className="text-slate-400 mb-1 flex items-center gap-1">
                    <Eye className="w-3 h-3 text-cyan-400" />
                    <span>نقاط کلیدی استخراج‌شده (۵ نقطه):</span>
                  </div>
                  <div className="text-emerald-400 font-mono text-[10px] space-y-0.5">
                    <div>• چشم چپ و راست (تراز مردمک)</div>
                    <div>• نوک برجستگی بینی</div>
                    <div>• گوشه‌های چپ و راست لب</div>
                  </div>
                </div>
              )}
            </div>

            {/* Filter buttons */}
            <div className="flex items-center gap-1.5 pt-2 border-t border-slate-800">
              <span className="text-[10px] text-slate-400">فیلتر دیداری:</span>
              <button
                onClick={() => setFilterMode('normal')}
                className={`px-2 py-0.5 rounded text-[10px] border transition-colors ${
                  filterMode === 'normal'
                    ? 'bg-emerald-600 text-white border-emerald-500'
                    : 'bg-slate-800 text-slate-400 border-slate-700'
                }`}
              >
                طبیعی
              </button>
              <button
                onClick={() => setFilterMode('contrast')}
                className={`px-2 py-0.5 rounded text-[10px] border transition-colors ${
                  filterMode === 'contrast'
                    ? 'bg-emerald-600 text-white border-emerald-500'
                    : 'bg-slate-800 text-slate-400 border-slate-700'
                }`}
              >
                کنتراست بالا
              </button>
              <button
                onClick={() => setFilterMode('infrared')}
                className={`px-2 py-0.5 rounded text-[10px] border transition-colors ${
                  filterMode === 'infrared'
                    ? 'bg-emerald-600 text-white border-emerald-500'
                    : 'bg-slate-800 text-slate-400 border-slate-700'
                }`}
              >
                مادون قرمز
              </button>
            </div>

            {/* Download button */}
            <button
              onClick={handleDownload}
              className="w-full flex items-center justify-center gap-1.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-all shadow-lg shadow-emerald-600/20 active:scale-98"
            >
              <Download className="w-4 h-4" />
              <span>ذخیره تصویر برش‌خورده چهره (PNG)</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
