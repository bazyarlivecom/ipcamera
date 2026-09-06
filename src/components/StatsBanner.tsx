import React from 'react';
import { Users, UserX, Activity, Camera, ArrowDownRight, ArrowUpLeft } from 'lucide-react';
import { toPersianDigits } from '../utils/dateTime';

interface StatsBannerProps {
  totalLogs: number;
  recognizedCount: number;
  unknownCount: number;
  activeCamerasCount: number;
  entriesCount: number;
  exitsCount: number;
}

export const StatsBanner: React.FC<StatsBannerProps> = ({
  totalLogs,
  recognizedCount,
  unknownCount,
  activeCamerasCount,
  entriesCount,
  exitsCount,
}) => {
  return (
    <div className="bg-slate-900 rounded-lg border border-slate-800 p-3 mb-4">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-[10px] text-slate-500 font-bold uppercase tracking-widest flex items-center gap-2">
          <span>وضعیت و معیارهای برخط سامانه</span>
          <span className="text-[9px] font-mono text-slate-600">SYSTEM METRICS</span>
        </h3>
        <span className="text-[10px] font-mono text-emerald-400 flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_#10b981]" />
          TELEMETRY: NOMINAL
        </span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
        {/* Total Traffic */}
        <div className="bg-slate-950 p-2.5 rounded border border-slate-800/80 flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500 text-[9px] font-bold uppercase tracking-wider mb-1">
            <span>کل ترددها (TOTAL)</span>
            <Activity className="w-3 h-3 text-cyan-400" />
          </div>
          <div className="flex items-baseline justify-between">
            <span className="text-lg font-mono font-bold text-slate-200">
              {toPersianDigits(totalLogs)}
            </span>
            <span className="text-[9px] font-mono text-slate-500">RECS</span>
          </div>
        </div>

        {/* Recognized Personnel */}
        <div className="bg-slate-950 p-2.5 rounded border border-slate-800/80 flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500 text-[9px] font-bold uppercase tracking-wider mb-1">
            <span>چهره‌های مجاز</span>
            <Users className="w-3 h-3 text-emerald-400" />
          </div>
          <div className="flex items-baseline justify-between">
            <span className="text-lg font-mono font-bold text-emerald-400">
              {toPersianDigits(recognizedCount)}
            </span>
            <span className="text-[9px] font-mono text-emerald-500/80">MATCHED</span>
          </div>
        </div>

        {/* Unknown Faces */}
        <div className="bg-slate-950 p-2.5 rounded border border-slate-800/80 flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500 text-[9px] font-bold uppercase tracking-wider mb-1">
            <span>افراد ناشناس</span>
            <UserX className="w-3 h-3 text-amber-400" />
          </div>
          <div className="flex items-baseline justify-between">
            <span className="text-lg font-mono font-bold text-amber-400">
              {toPersianDigits(unknownCount)}
            </span>
            <span className="text-[9px] font-mono text-amber-500/80">PENDING</span>
          </div>
        </div>

        {/* Entries */}
        <div className="bg-slate-950 p-2.5 rounded border border-slate-800/80 flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500 text-[9px] font-bold uppercase tracking-wider mb-1">
            <span>ورود (INFLOW)</span>
            <ArrowDownRight className="w-3 h-3 text-blue-400" />
          </div>
          <div className="flex items-baseline justify-between">
            <span className="text-lg font-mono font-bold text-blue-400">
              {toPersianDigits(entriesCount)}
            </span>
            <span className="text-[9px] font-mono text-blue-400/80">ENTRY</span>
          </div>
        </div>

        {/* Exits */}
        <div className="bg-slate-950 p-2.5 rounded border border-slate-800/80 flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500 text-[9px] font-bold uppercase tracking-wider mb-1">
            <span>خروج (OUTFLOW)</span>
            <ArrowUpLeft className="w-3 h-3 text-purple-400" />
          </div>
          <div className="flex items-baseline justify-between">
            <span className="text-lg font-mono font-bold text-purple-400">
              {toPersianDigits(exitsCount)}
            </span>
            <span className="text-[9px] font-mono text-purple-400/80">EXIT</span>
          </div>
        </div>

        {/* Active IP Cameras */}
        <div className="bg-slate-950 p-2.5 rounded border border-slate-800/80 flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500 text-[9px] font-bold uppercase tracking-wider mb-1">
            <span>دوربین‌های برخط</span>
            <Camera className="w-3 h-3 text-cyan-400" />
          </div>
          <div className="flex items-baseline justify-between">
            <span className="text-lg font-mono font-bold text-cyan-400">
              {toPersianDigits(activeCamerasCount)}
            </span>
            <span className="text-[9px] font-mono text-cyan-400/80">LIVE NODES</span>
          </div>
        </div>
      </div>
    </div>
  );
};
