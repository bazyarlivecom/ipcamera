import React, { useState } from 'react';
import {
  X,
  ZoomIn,
  ZoomOut,
  Sparkles,
  ShieldCheck,
  UserPlus,
  Clock,
  Camera,
  Layers,
  Save,
  Scan,
  UserCheck,
} from 'lucide-react';
import { TrafficLog, DetectedFace, RegisteredPerson, MovementType } from '../types';
import { toPersianDigits, formatExactTimestamp } from '../utils/dateTime';

interface FaceDetailModalProps {
  log?: TrafficLog | null;
  face?: DetectedFace | null;
  thumbnail: string;
  cameraName: string;
  cameraIp: string;
  onClose: () => void;
  onSaveAsLog?: (updatedLog: Partial<TrafficLog>) => void;
  onRegisterPerson?: (person: Partial<RegisteredPerson>) => void;
}

export const FaceDetailModal: React.FC<FaceDetailModalProps> = ({
  log,
  face,
  thumbnail,
  cameraName,
  cameraIp,
  onClose,
  onSaveAsLog,
  onRegisterPerson,
}) => {
  const [zoomFactor, setZoomFactor] = useState<number>(2);
  const [filterMode, setFilterMode] = useState<'normal' | 'contrast' | 'infrared'>('normal');
  const [personName, setPersonName] = useState(
    log?.personName || face?.recognizedPerson?.fullName || ''
  );
  const [personnelCode, setPersonnelCode] = useState(
    log?.personnelId || face?.recognizedPerson?.personnelCode || ''
  );
  const [movementType, setMovementType] = useState<MovementType>(
    log?.movementType || 'entry'
  );
  const [notes, setNotes] = useState(log?.notes || '');
  const [isAnalyzingAi, setIsAnalyzingAi] = useState(false);
  const [aiAnalysisResult, setAiAnalysisResult] = useState<any>(null);

  const exactTime =
    log?.jalaliTime || formatExactTimestamp(face?.timestamp).jalaliTime;
  const exactDate =
    log?.jalaliDate || formatExactTimestamp(face?.timestamp).jalaliDate;
  const confidence = log?.confidence || face?.confidence || 95.0;

  // Trigger Gemini AI deep analysis
  const handleAnalyzeWithAi = async () => {
    if (!thumbnail) return;
    setIsAnalyzingAi(true);

    try {
      const res = await fetch('/api/analyze-face', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageBase64: thumbnail }),
      });
      const data = await res.json();
      if (data.success && data.data) {
        setAiAnalysisResult(data.data);
        if (data.data.securityNotes && !notes) {
          setNotes(data.data.securityNotes);
        }
      }
    } catch (err) {
      console.error('AI Analysis failed:', err);
    } finally {
      setIsAnalyzingAi(false);
    }
  };

  // Register this face as an employee
  const handleRegisterAsPerson = () => {
    if (!personName.trim() || !onRegisterPerson) return;
    onRegisterPerson({
      fullName: personName,
      personnelCode: personnelCode || `EMP-${Math.floor(Math.random() * 9000 + 1000)}`,
      role: 'پرسنل مجاز',
      department: 'دفتر مرکزی',
      accessLevel: 'authorized',
      photoUrl: thumbnail,
    });
    alert(`شخص «${personName}» با موفقیت در دیتابیس پرسنل مجاز ثبت گردید.`);
  };

  // Save manual traffic log
  const handleSaveLog = () => {
    if (onSaveAsLog) {
      onSaveAsLog({
        personName: personName || 'سوژه ناشناس',
        personnelId: personnelCode,
        movementType,
        notes,
        confidence,
        faceSnapshot: thumbnail,
        cameraName,
        cameraIp,
      });
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm">
      <div className="bg-slate-900 border border-slate-800 rounded-lg w-full max-w-2xl overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-slate-800 bg-slate-950">
          <div className="flex items-center gap-2.5">
            <div className="w-2.5 h-2.5 rounded-full bg-cyan-400 shadow-[0_0_8px_#22d3ee]" />
            <div>
              <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                بزرگنمایی و تحلیل جزئیات چهره (FORENSIC ZOOM)
              </h3>
              <p className="text-[11px] font-mono text-slate-400">
                TARGET INSPECTION & CLOUD DATABASE REGISTRATION
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-md hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-5 max-h-[80vh] overflow-y-auto">
          {/* Left Column: Zoomed Image & Controls */}
          <div className="flex flex-col items-center">
            {/* Magnifier Screen with Sleek Corner Markers */}
            <div className="relative w-64 h-64 rounded-lg overflow-hidden border border-slate-700 bg-black flex items-center justify-center shadow-lg group">
              <div className="absolute inset-0 bg-dot-grid opacity-30 pointer-events-none" />

              {/* Corner Reticle Markers */}
              <div className="absolute top-2 left-2 w-3 h-3 border-t-2 border-l-2 border-cyan-400 pointer-events-none z-10" />
              <div className="absolute top-2 right-2 w-3 h-3 border-t-2 border-r-2 border-cyan-400 pointer-events-none z-10" />
              <div className="absolute bottom-2 left-2 w-3 h-3 border-b-2 border-l-2 border-cyan-400 pointer-events-none z-10" />
              <div className="absolute bottom-2 right-2 w-3 h-3 border-b-2 border-r-2 border-cyan-400 pointer-events-none z-10" />

              {thumbnail ? (
                <img
                  src={thumbnail}
                  alt="Forensic Zoom"
                  style={{
                    transform: `scale(${zoomFactor})`,
                    filter:
                      filterMode === 'contrast'
                        ? 'contrast(160%) brightness(110%)'
                        : filterMode === 'infrared'
                        ? 'grayscale(100%) invert(20%) sepia(80%)'
                        : 'none',
                  }}
                  className="w-full h-full object-cover transition-transform duration-300"
                />
              ) : (
                <Scan className="w-16 h-16 text-slate-700" />
              )}

              {/* Reticle Overlay */}
              <div className="absolute inset-0 pointer-events-none border border-cyan-500/20">
                <div className="absolute top-1/2 inset-x-0 h-px bg-cyan-500/20" />
                <div className="absolute left-1/2 inset-y-0 w-px bg-cyan-500/20" />
              </div>

              {/* Sleek bottom status pill */}
              <div className="absolute bottom-2 inset-x-2 bg-slate-900/85 backdrop-blur px-2.5 py-1 rounded text-[10px] flex justify-between font-mono border border-slate-800 z-10">
                <span>MAG: {toPersianDigits(zoomFactor)}.0X</span>
                <span className="text-cyan-400">ENHANCE: ON</span>
              </div>
            </div>

            {/* Zoom Controls */}
            <div className="flex items-center gap-2 mt-3 w-full justify-center">
              <button
                onClick={() => setZoomFactor(1)}
                className={`px-3 py-1 rounded-md text-xs font-mono border transition-colors ${
                  zoomFactor === 1
                    ? 'bg-cyan-500 text-black border-cyan-400 font-bold'
                    : 'bg-slate-800 text-slate-300 border-slate-700'
                }`}
              >
                1X
              </button>
              <button
                onClick={() => setZoomFactor(2)}
                className={`px-3 py-1 rounded-md text-xs font-mono border transition-colors ${
                  zoomFactor === 2
                    ? 'bg-cyan-500 text-black border-cyan-400 font-bold'
                    : 'bg-slate-800 text-slate-300 border-slate-700'
                }`}
              >
                2X
              </button>
              <button
                onClick={() => setZoomFactor(4)}
                className={`px-3 py-1 rounded-md text-xs font-mono border transition-colors ${
                  zoomFactor === 4
                    ? 'bg-cyan-500 text-black border-cyan-400 font-bold'
                    : 'bg-slate-800 text-slate-300 border-slate-700'
                }`}
              >
                4X (فوق‌بزرگ)
              </button>
            </div>

            {/* Visual Filters */}
            <div className="flex items-center gap-2 mt-2 text-xs">
              <span className="text-slate-400 text-[11px] font-mono">فیلتر (FILTER):</span>
              <button
                onClick={() => setFilterMode('normal')}
                className={`px-2.5 py-0.5 rounded text-[11px] ${
                  filterMode === 'normal'
                    ? 'bg-slate-700 text-white font-medium'
                    : 'bg-slate-800/60 text-slate-400'
                }`}
              >
                طبیعی
              </button>
              <button
                onClick={() => setFilterMode('contrast')}
                className={`px-2.5 py-0.5 rounded text-[11px] ${
                  filterMode === 'contrast'
                    ? 'bg-slate-700 text-white font-medium'
                    : 'bg-slate-800/60 text-slate-400'
                }`}
              >
                کنتراست بالا
              </button>
              <button
                onClick={() => setFilterMode('infrared')}
                className={`px-2.5 py-0.5 rounded text-[11px] ${
                  filterMode === 'infrared'
                    ? 'bg-slate-700 text-white font-medium'
                    : 'bg-slate-800/60 text-slate-400'
                }`}
              >
                مادون قرمز
              </button>
            </div>

            {/* AI Deep Analysis Action */}
            <div className="w-full mt-4">
              <button
                onClick={handleAnalyzeWithAi}
                disabled={isAnalyzingAi}
                className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white text-xs font-semibold shadow-md shadow-purple-500/20 transition-all disabled:opacity-60"
              >
                <Sparkles className={`w-4 h-4 ${isAnalyzingAi ? 'animate-spin' : ''}`} />
                <span>
                  {isAnalyzingAi ? 'در حال تحلیل با هوش مصنوعی...' : 'تحلیل هوشمند چهره (Gemini AI)'}
                </span>
              </button>

              {/* AI Analysis Cards */}
              {aiAnalysisResult && (
                <div className="mt-2.5 p-2.5 rounded-xl bg-purple-950/40 border border-purple-800/50 text-xs space-y-1.5 animate-in fade-in">
                  <div className="flex items-center justify-between text-purple-300">
                    <span>تخمین سن:</span>
                    <span className="font-bold text-white font-mono">
                      {aiAnalysisResult.ageEstimate || 'نامشخص'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-purple-300">
                    <span>جنسیت:</span>
                    <span className="text-white">{aiAnalysisResult.genderEstimate || 'نامشخص'}</span>
                  </div>
                  <div className="flex items-center justify-between text-purple-300">
                    <span>حالت چهره:</span>
                    <span className="text-white">{aiAnalysisResult.emotion || 'طبیعی'}</span>
                  </div>
                  {aiAnalysisResult.accessories && (
                    <div className="flex items-center justify-between text-purple-300">
                      <span>تجهیزات ظاهری:</span>
                      <span className="text-white">{aiAnalysisResult.accessories}</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Right Column: Exact Timestamp & Metadata Form */}
          <div className="space-y-4">
            {/* Timestamp & Camera Badges */}
            <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-slate-400 flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5 text-cyan-400" />
                  زمان دقیق تردد:
                </span>
                <span className="font-mono text-cyan-300 font-bold">
                  {exactDate} - {exactTime}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400 flex items-center gap-1">
                  <Camera className="w-3.5 h-3.5 text-slate-500" />
                  دوربین مداربسته:
                </span>
                <span className="text-white">{cameraName}</span>
              </div>
              <div className="flex items-center justify-between font-mono">
                <span className="text-slate-500">آدرس IP:</span>
                <span className="text-slate-300">{cameraIp}</span>
              </div>
              <div className="flex items-center justify-between font-mono">
                <span className="text-slate-500">میزان اطمینان تطابق:</span>
                <span className="text-emerald-400 font-bold">{toPersianDigits(confidence)}٪</span>
              </div>
            </div>

            {/* Inputs: Person name & Code */}
            <div className="space-y-2.5">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  نام و نام خانوادگی سوژه:
                </label>
                <input
                  type="text"
                  value={personName}
                  onChange={(e) => setPersonName(e.target.value)}
                  placeholder="مثلاً: علیرضا محمدی یا فرد ناشناس"
                  className="w-full px-3 py-1.5 rounded-md bg-slate-950 border border-slate-800 text-xs text-white focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1 font-mono">
                  کد پرسنلی / شناسه ملی (ID):
                </label>
                <input
                  type="text"
                  value={personnelCode}
                  onChange={(e) => setPersonnelCode(e.target.value)}
                  placeholder="مثلاً: EMP-1044"
                  className="w-full px-3 py-1.5 rounded-md bg-slate-950 border border-slate-800 text-xs text-white font-mono focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1 font-mono">
                  نوع تردد در این لحظه (MOVEMENT):
                </label>
                <select
                  value={movementType}
                  onChange={(e) => setMovementType(e.target.value as MovementType)}
                  className="w-full px-3 py-1.5 rounded-md bg-slate-950 border border-slate-800 text-xs text-white focus:outline-none focus:border-cyan-500 font-mono"
                >
                  <option value="entry">ورود به ساختمان / محوطه (ENTRY)</option>
                  <option value="exit">خروج از ساختمان / محوطه (EXIT)</option>
                  <option value="passage">عبور در راهرو / نظارت عمومی (PASSAGE)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1 font-mono">
                  یادداشت امنیتی / حراست (SECURITY NOTES):
                </label>
                <textarea
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="یادداشت در خصوص مجوز، همراهان یا شرح وضعیت..."
                  className="w-full px-3 py-1.5 rounded-md bg-slate-950 border border-slate-800 text-xs text-white focus:outline-none focus:border-cyan-500"
                />
              </div>
            </div>

            {/* Action Buttons */}
            <div className="pt-2 flex items-center gap-2">
              <button
                onClick={handleRegisterAsPerson}
                className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-md bg-slate-800 hover:bg-slate-700 text-emerald-400 border border-slate-700 text-xs font-medium transition-colors"
                title="افزودن این چهره به لیست پرسنل مجاز"
              >
                <UserPlus className="w-3.5 h-3.5" />
                <span>ثبت پرسنل مجاز</span>
              </button>

              <button
                onClick={handleSaveLog}
                className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-md bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold uppercase tracking-wider shadow-sm transition-all"
              >
                <Save className="w-3.5 h-3.5" />
                <span>ذخیره در دیتابیس</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
