import React, { useState, useEffect } from 'react';
import {
  Cpu,
  ShieldCheck,
  Volume2,
  VolumeX,
  Type,
  WifiOff,
  Zap,
} from 'lucide-react';
import { formatExactTimestamp, toPersianDigits } from '../utils/dateTime';

export type PersianFont = 'Vazirmatn' | 'Alexandria' | 'Readex Pro' | 'IBM Plex Sans Arabic';

const fontConfigs: Record<PersianFont, { name: string; family: string }> = {
  'Vazirmatn': {
    name: 'وزیرمتن (استاندارد)',
    family: "'Vazirmatn', system-ui, sans-serif",
  },
  'Alexandria': {
    name: 'اسکندریه (هندسی)',
    family: "'Alexandria', 'Vazirmatn', system-ui, sans-serif",
  },
  'Readex Pro': {
    name: 'ریدکس پرو (نرم)',
    family: "'Readex Pro', 'Vazirmatn', system-ui, sans-serif",
  },
  'IBM Plex Sans Arabic': {
    name: 'آی‌بی‌ام پلکس (فنی)',
    family: "'IBM Plex Sans Arabic', 'Vazirmatn', system-ui, sans-serif",
  },
};

interface HeaderProps {
  audioEnabled: boolean;
  onToggleAudio: () => void;
  detectedCount: number;
  fps: number;
  latencyMs: number;
}

export const Header: React.FC<HeaderProps> = ({
  audioEnabled,
  onToggleAudio,
  detectedCount,
  fps,
  latencyMs,
}) => {
  const [currentClock, setCurrentClock] = useState(() => formatExactTimestamp());
  const [selectedFont, setSelectedFont] = useState<PersianFont>(() => {
    const saved = localStorage.getItem('sentry_persian_font') as PersianFont;
    return saved && fontConfigs[saved] ? saved : 'Vazirmatn';
  });

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentClock(formatExactTimestamp());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const cfg = fontConfigs[selectedFont];
    if (cfg) {
      document.documentElement.style.setProperty('--font-persian', cfg.family);
      localStorage.setItem('sentry_persian_font', selectedFont);
    }
  }, [selectedFont]);

  return (
    <header className="border-b border-slate-800 bg-slate-900/80 backdrop-blur-md px-4 sm:px-6 py-2.5 sticky top-0 z-30">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-3">
        {/* Brand & System Title with Sleek Status Dot */}
        <div className="flex items-center gap-3 w-full md:w-auto justify-between md:justify-start">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500/20 to-cyan-500/20 border border-emerald-500/40 flex items-center justify-center shadow-lg shadow-emerald-500/10">
              <Cpu className="w-5 h-5 text-emerald-400 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-sm sm:text-base font-bold text-white tracking-tight">
                  پردازش و تشخیص چهره آفلاین
                </h1>
                <span className="text-[10px] font-mono font-bold bg-emerald-500/10 text-emerald-400 px-2 py-0.5 rounded-full border border-emerald-500/30 flex items-center gap-1">
                  <WifiOff className="w-2.5 h-2.5" />
                  ۱۰۰٪ آفلاین
                </span>
              </div>
              <p className="text-[11px] text-slate-400 font-mono">
                OpenCV YuNet Deep Neural Network • WebAssembly ONNX
              </p>
            </div>
          </div>

          {/* Mobile quick metrics */}
          <div className="flex md:hidden items-center gap-2 font-mono text-[11px]">
            <span className="px-2 py-0.5 rounded bg-slate-800 text-cyan-300 border border-slate-700">
              {toPersianDigits(detectedCount)} چهره
            </span>
          </div>
        </div>

        {/* Center / Right: Live Performance & Controls */}
        <div className="flex items-center gap-3 w-full md:w-auto justify-between md:justify-end flex-wrap">
          {/* Performance stats */}
          <div className="hidden sm:flex items-center gap-2 font-mono text-[11px] bg-slate-950 px-3 py-1 rounded-lg border border-slate-800">
            <div className="flex items-center gap-1.5 text-emerald-400">
              <Zap className="w-3.5 h-3.5" />
              <span>{toPersianDigits(fps)} FPS</span>
            </div>
            <span className="text-slate-700">|</span>
            <div className="text-slate-400">
              <span>تأخیر: </span>
              <span className="text-cyan-300 font-bold">{toPersianDigits(latencyMs)} ms</span>
            </div>
            <span className="text-slate-700">|</span>
            <div className="text-slate-400">
              <span>چهره‌ها: </span>
              <span className="text-amber-300 font-bold">{toPersianDigits(detectedCount)}</span>
            </div>
          </div>

          {/* Clock */}
          <div className="hidden lg:flex items-center gap-1.5 text-slate-400 text-xs font-mono bg-slate-800/40 px-2.5 py-1 rounded border border-slate-800">
            <span>{toPersianDigits(currentClock.jalaliDate)}</span>
            <span className="text-cyan-400 font-bold">{toPersianDigits(currentClock.jalaliTime)}</span>
          </div>

          {/* Audio Chime Toggle */}
          <button
            onClick={onToggleAudio}
            className={`p-1.5 rounded-lg border transition-colors ${
              audioEnabled
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20'
                : 'bg-slate-800 border-slate-700 text-slate-500 hover:bg-slate-700'
            }`}
            title={audioEnabled ? 'صدای هشدار هنگام تشخیص چهره فعال است' : 'صدای هشدار غیرفعال است'}
          >
            {audioEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
          </button>

          {/* Persian Font Picker */}
          <div className="flex items-center gap-1 bg-slate-800/60 p-0.5 rounded-lg border border-slate-700/60">
            <Type className="w-3.5 h-3.5 text-slate-400 mr-1 hidden sm:block" />
            {(Object.keys(fontConfigs) as PersianFont[]).map((fontKey) => (
              <button
                key={fontKey}
                onClick={() => setSelectedFont(fontKey)}
                className={`px-1.5 py-0.5 rounded text-[10px] transition-colors ${
                  selectedFont === fontKey
                    ? 'bg-emerald-600 text-white font-bold shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
                title={fontConfigs[fontKey].name}
              >
                {fontKey.split(' ')[0]}
              </button>
            ))}
          </div>
        </div>
      </div>
    </header>
  );
};
