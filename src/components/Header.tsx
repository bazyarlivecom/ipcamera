import React, { useState, useEffect } from 'react';
import {
  Video,
  Database,
  Users,
  Clock,
  Volume2,
  VolumeX,
  FileSpreadsheet,
  Settings,
  ShieldCheck,
  Type,
} from 'lucide-react';
import { formatExactTimestamp } from '../utils/dateTime';

export type PersianFont = 'Vazirmatn' | 'Alexandria' | 'Readex Pro' | 'IBM Plex Sans Arabic';

const fontConfigs: Record<PersianFont, { name: string; family: string }> = {
  'Vazirmatn': {
    name: 'وزیرمتن (خوانا و استاندارد)',
    family: "'Vazirmatn', system-ui, sans-serif",
  },
  'Alexandria': {
    name: 'اسکندریه (هندسی و مدرن)',
    family: "'Alexandria', 'Vazirmatn', system-ui, sans-serif",
  },
  'Readex Pro': {
    name: 'ریدکس پرو (نرم و ارگونومیک)',
    family: "'Readex Pro', 'Vazirmatn', system-ui, sans-serif",
  },
  'IBM Plex Sans Arabic': {
    name: 'آی‌بی‌ام پلکس (فنی و سازمانی)',
    family: "'IBM Plex Sans Arabic', 'Vazirmatn', system-ui, sans-serif",
  },
};

interface HeaderProps {
  onOpenCameras: () => void;
  onOpenPersonnel: () => void;
  onExportCsv: () => void;
  audioEnabled: boolean;
  onToggleAudio: () => void;
  activeCameraName: string;
  totalLogsCount: number;
}

export const Header: React.FC<HeaderProps> = ({
  onOpenCameras,
  onOpenPersonnel,
  onExportCsv,
  audioEnabled,
  onToggleAudio,
  activeCameraName,
  totalLogsCount,
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
    <header className="border-b border-slate-800 bg-slate-900/50 backdrop-blur-md px-4 sm:px-6 py-2.5 sticky top-0 z-30">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-3">
        {/* Brand & System Title with Sleek Status Dot */}
        <div className="flex items-center gap-3 w-full md:w-auto justify-between md:justify-start">
          <div className="flex items-center gap-3">
            <div className="w-3 h-3 rounded-full bg-emerald-500 shadow-[0_0_8px_#10b981] flex-shrink-0" />
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base sm:text-lg font-bold tracking-tight text-white flex items-center gap-1.5">
                  <span>سامانه هوشمند پایش IP-SENTRY</span>
                  <span className="text-slate-500 font-mono text-xs font-normal">v4.2.0</span>
                </h1>
                <div className="hidden sm:block h-3.5 w-[1px] bg-slate-700 mx-1"></div>
                <div className="hidden sm:block text-xs font-mono text-slate-400 uppercase tracking-wider">
                  منبع: <span className="text-cyan-400">{activeCameraName}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Cloud Database Status Pill */}
          <div className="hidden lg:flex items-center gap-2 border-r border-slate-800 pr-3 mr-1 text-right">
            <div>
              <div className="text-[10px] text-slate-500 uppercase font-bold tracking-tighter">پایگاه داده ابری</div>
              <div className="text-xs text-emerald-400 font-mono flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                همگام: برخط (ACTIVE)
              </div>
            </div>
          </div>
        </div>

        {/* Live Timestamp Display (Sleek Interface Styled) */}
        <div className="flex items-center gap-3">
          <div className="bg-slate-800/80 px-3.5 py-1.5 rounded-md flex items-center gap-2.5 border border-slate-700/60 font-mono text-xs text-slate-200">
            <Clock className="w-3.5 h-3.5 text-cyan-400" />
            <span className="text-slate-300">{currentClock.jalaliDate}</span>
            <span className="text-slate-600">|</span>
            <span className="text-white font-semibold tracking-wider">
              {currentClock.jalaliTime.split('.')[0]}
            </span>
          </div>
        </div>

        {/* Action Controls & Font Selector */}
        <div className="flex items-center gap-2 w-full md:w-auto justify-end flex-wrap">
          {/* Persian Font Picker */}
          <div className="flex items-center gap-1 bg-slate-800 px-2 py-1 rounded-md border border-slate-700 text-xs text-slate-300">
            <Type className="w-3.5 h-3.5 text-cyan-400 flex-shrink-0" />
            <select
              value={selectedFont}
              onChange={(e) => setSelectedFont(e.target.value as PersianFont)}
              className="bg-transparent text-xs text-slate-200 focus:outline-none cursor-pointer py-0.5"
              title="انتخاب فونت فارسی سامانه"
            >
              <option value="Vazirmatn" className="bg-slate-900 text-white">فونت: وزیرمتن</option>
              <option value="Alexandria" className="bg-slate-900 text-white">فونت: اسکندریه</option>
              <option value="Readex Pro" className="bg-slate-900 text-white">فونت: ریدکس پرو</option>
              <option value="IBM Plex Sans Arabic" className="bg-slate-900 text-white">فونت: آی‌بی‌ام پلکس</option>
            </select>
          </div>

          <button
            onClick={onToggleAudio}
            title={audioEnabled ? 'قطع صدای بیپ تردد' : 'فعال‌سازی صدای بیپ تردد'}
            className={`p-1.5 rounded-md border text-xs transition-colors ${
              audioEnabled
                ? 'bg-cyan-500/10 border-cyan-500/30 text-cyan-300 hover:bg-cyan-500/20'
                : 'bg-slate-800 border-slate-700 text-slate-400 hover:bg-slate-700'
            }`}
          >
            {audioEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
          </button>

          <button
            onClick={onOpenCameras}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs text-slate-200 transition-colors font-medium"
          >
            <Settings className="w-3.5 h-3.5 text-cyan-400" />
            <span>تنظیمات دوربین</span>
          </button>

          <button
            onClick={onOpenPersonnel}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs text-slate-200 transition-colors font-medium"
          >
            <Users className="w-3.5 h-3.5 text-emerald-400" />
            <span>بانک چهره‌ها</span>
          </button>

          <button
            onClick={onExportCsv}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold uppercase tracking-wider transition-colors shadow-sm"
            title="دانلود گزارش ترددها (اکسل/CSV)"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            <span>خروجی CSV ({totalLogsCount})</span>
          </button>
        </div>
      </div>
    </header>
  );
};
