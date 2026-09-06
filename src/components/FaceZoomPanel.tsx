import React from 'react';
import {
  ZoomIn,
  ShieldCheck,
  UserX,
  Clock,
  ScanFace,
  Sparkles,
  ArrowRightCircle,
  Maximize,
} from 'lucide-react';
import { DetectedFace } from '../types';
import { toPersianDigits, formatExactTimestamp } from '../utils/dateTime';

interface FaceZoomPanelProps {
  detectedFaces: DetectedFace[];
  thumbnails: Record<string, string>;
  onInspectFace: (face: DetectedFace, thumbnail: string) => void;
  onQuickLog: (face: DetectedFace, thumbnail: string) => void;
}

export const FaceZoomPanel: React.FC<FaceZoomPanelProps> = ({
  detectedFaces,
  thumbnails,
  onInspectFace,
  onQuickLog,
}) => {
  return (
    <div className="bg-slate-900 rounded-lg border border-slate-800 p-3 flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between pb-2.5 border-b border-slate-800 mb-3">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-cyan-400 shadow-[0_0_6px_#22d3ee]" />
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-200">
            اهداف فعال (ACTIVE TARGETS)
          </h2>
        </div>
        <span className="bg-cyan-500/10 text-cyan-400 text-[10px] font-mono px-2 py-0.5 rounded border border-cyan-500/20">
          TRACKING: {detectedFaces.length}
        </span>
      </div>

      {/* Faces List */}
      <div className="flex-1 overflow-y-auto space-y-2.5 min-h-[300px] max-h-[520px] pr-0.5">
        {detectedFaces.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-center text-slate-500 border border-dashed border-slate-800 rounded-lg p-4 bg-slate-950/40">
            <ScanFace className="w-8 h-8 text-slate-600 mb-2 animate-pulse" />
            <p className="text-xs font-medium text-slate-400">در حال پویش کادر دوربین...</p>
            <p className="text-[11px] text-slate-600 mt-1">
              به محض ورود فرد در کادر، تصویر بزرگنمایی شده در این بخش نمایش می‌یابد.
            </p>
          </div>
        ) : (
          detectedFaces.map((face) => {
            const thumb = thumbnails[face.id] || face.snapshotUrl;
            const isRecognized = !!face.recognizedPerson;
            const personName = face.recognizedPerson
              ? face.recognizedPerson.fullName
              : `سوژه ناشناس #${toPersianDigits(face.trackingId)}`;

            return (
              <div
                key={face.id}
                className="group relative bg-slate-950 p-2.5 rounded-lg border border-slate-800 hover:border-cyan-500/40 transition-all duration-200"
              >
                <div className="flex items-start gap-3">
                  {/* Magnified Cropped Face with Sleek Corner Brackets & Zoom Frame */}
                  <div
                    onClick={() => thumb && onInspectFace(face, thumb)}
                    className="relative w-20 h-20 rounded border border-slate-700 group-hover:border-cyan-400 cursor-pointer flex-shrink-0 bg-slate-900 overflow-hidden"
                    title="کلیک برای بزرگنمایی ۴ برابر و تحلیل دقیق"
                  >
                    {thumb ? (
                      <img
                        src={thumb}
                        alt="Zoomed Face"
                        className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-125"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-slate-800 text-slate-500">
                        <ScanFace className="w-6 h-6" />
                      </div>
                    )}

                    {/* Sleek Corner Brackets */}
                    <div className="absolute top-1 left-1 w-2 h-2 border-t-2 border-l-2 border-cyan-400 pointer-events-none" />
                    <div className="absolute top-1 right-1 w-2 h-2 border-t-2 border-r-2 border-cyan-400 pointer-events-none" />
                    <div className="absolute bottom-5 left-1 w-2 h-2 border-b-2 border-l-2 border-cyan-400 pointer-events-none" />
                    <div className="absolute bottom-5 right-1 w-2 h-2 border-b-2 border-r-2 border-cyan-400 pointer-events-none" />

                    {/* Magnifier icon overlay */}
                    <div className="absolute inset-0 bg-cyan-950/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                      <Maximize className="w-4 h-4 text-cyan-300" />
                    </div>

                    {/* Sleek Badge */}
                    <div className="absolute bottom-0 inset-x-0 bg-slate-900/90 text-[9px] font-mono text-center text-cyan-300 py-0.5 border-t border-slate-800 flex justify-between px-1">
                      <span>MAG: 4X</span>
                      <span className="text-cyan-400">ENH</span>
                    </div>
                  </div>

                  {/* Face Metadata & Status */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1 mb-1">
                      <h4 className="text-xs font-bold text-white truncate">{personName}</h4>
                      <span
                        className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono ${
                          isRecognized
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                            : 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                        }`}
                      >
                        {isRecognized ? (
                          <>
                            <ShieldCheck className="w-3 h-3" />
                            <span>مجاز</span>
                          </>
                        ) : (
                          <>
                            <UserX className="w-3 h-3" />
                            <span>ناشناس</span>
                          </>
                        )}
                      </span>
                    </div>

                    {/* Details */}
                    <div className="text-[11px] text-slate-400 space-y-0.5 mb-2 font-mono">
                      <div className="flex items-center justify-between">
                        <span className="text-slate-500">تطابق (MATCH):</span>
                        <span className="text-cyan-400 font-semibold">{toPersianDigits(face.confidence)}٪</span>
                      </div>
                      {face.attributes?.ageRange && (
                        <div className="flex items-center justify-between">
                          <span className="text-slate-500">تخمین سن:</span>
                          <span className="text-slate-300">{toPersianDigits(face.attributes.ageRange)}</span>
                        </div>
                      )}
                      {face.recognizedPerson?.role && (
                        <div className="flex items-center justify-between">
                          <span className="text-slate-500">سمت:</span>
                          <span className="text-emerald-400 font-sans truncate">{face.recognizedPerson.role}</span>
                        </div>
                      )}
                    </div>

                    {/* Quick Action Buttons */}
                    <div className="flex items-center gap-1.5 pt-1.5 border-t border-slate-800">
                      <button
                        onClick={() => thumb && onInspectFace(face, thumb)}
                        className="flex-1 flex items-center justify-center gap-1 py-1 px-2 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] font-medium border border-slate-700 transition-colors"
                      >
                        <ZoomIn className="w-3 h-3 text-cyan-400" />
                        <span>تحلیل دقیق</span>
                      </button>

                      <button
                        onClick={() => thumb && onQuickLog(face, thumb)}
                        className="flex items-center justify-center gap-1 py-1 px-2.5 rounded-md bg-cyan-600 hover:bg-cyan-500 text-white text-[11px] font-medium transition-colors shadow-sm"
                        title="ثبت لحظه‌ای در دیتابیس آنلاین"
                      >
                        <ArrowRightCircle className="w-3 h-3" />
                        <span>ثبت تردد</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
