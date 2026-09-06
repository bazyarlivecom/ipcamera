import React, { useState, useMemo } from 'react';
import {
  Database,
  Search,
  Filter,
  Trash2,
  Download,
  Calendar,
  Clock,
  CheckCircle2,
  AlertTriangle,
  ArrowDownRight,
  ArrowUpLeft,
  Eye,
  Camera,
  Layers,
  Sparkles,
  RefreshCw,
} from 'lucide-react';
import { TrafficLog, MovementType } from '../types';
import { toPersianDigits } from '../utils/dateTime';

interface TrafficLogsTableProps {
  logs: TrafficLog[];
  onDeleteLog: (id: string) => void;
  onClearAll: () => void;
  onRefresh: () => void;
  onViewLogDetail: (log: TrafficLog) => void;
  isLoading: boolean;
}

export const TrafficLogsTable: React.FC<TrafficLogsTableProps> = ({
  logs,
  onDeleteLog,
  onClearAll,
  onRefresh,
  onViewLogDetail,
  isLoading,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterMovement, setFilterMovement] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');

  const filteredLogs = useMemo(() => {
    return logs.filter((log) => {
      // Search filter
      const matchesSearch =
        searchTerm === '' ||
        log.personName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (log.personnelId && log.personnelId.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (log.notes && log.notes.toLowerCase().includes(searchTerm.toLowerCase())) ||
        log.cameraName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        log.cameraIp.includes(searchTerm);

      // Movement filter
      const matchesMovement =
        filterMovement === 'all' || log.movementType === filterMovement;

      // Status filter
      const matchesStatus =
        filterStatus === 'all' ||
        (filterStatus === 'recognized' && log.isRecognized) ||
        (filterStatus === 'unknown' && !log.isRecognized);

      return matchesSearch && matchesMovement && matchesStatus;
    });
  }, [logs, searchTerm, filterMovement, filterStatus]);

  // Export to CSV
  const handleExportCsv = () => {
    if (filteredLogs.length === 0) return;

    const headers = [
      'شناسه',
      'تاریخ شمسی',
      'زمان دقیق',
      'نام شخص',
      'کد پرسنلی',
      'وضعیت احراز هویت',
      'نوع تردد',
      'نام دوربین',
      'آدرس IP دوربین',
      'درصد اطمینان',
      'یادداشت',
    ];

    const rows = filteredLogs.map((l) => [
      l.id,
      l.jalaliDate,
      l.jalaliTime,
      `"${l.personName}"`,
      l.personnelId || '-',
      l.isRecognized ? 'مجاز' : 'ناشناس',
      l.movementType === 'entry' ? 'ورود' : l.movementType === 'exit' ? 'خروج' : 'عبور',
      `"${l.cameraName}"`,
      l.cameraIp,
      `${l.confidence}%`,
      `"${l.notes || ''}"`,
    ]);

    const csvContent =
      '\uFEFF' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `traffic-logs-${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="bg-slate-900 rounded-lg border border-slate-800 p-4 shadow-xl">
      {/* Title & Controls */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3 pb-3 border-b border-slate-800">
        <div className="flex items-center gap-2.5">
          <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-[0_0_8px_#10b981]" />
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-white uppercase tracking-tight">
                پایگاه داده برخط ثبت ترددها و چهره‌ها (DATABASE LOGS)
              </h3>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                SYNC: REAL-TIME
              </span>
            </div>
            <p className="text-[11px] text-slate-400 font-mono mt-0.5">
              PERSISTENT STORAGE: ACTIVE | 100% AUDITED
            </p>
          </div>
        </div>

        {/* Global actions */}
        <div className="flex items-center gap-2 w-full md:w-auto justify-end">
          <button
            onClick={onRefresh}
            className="p-1.5 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-colors"
            title="بروزرسانی داده‌ها"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-cyan-400' : ''}`} />
          </button>

          <button
            onClick={handleExportCsv}
            disabled={filteredLogs.length === 0}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold uppercase tracking-wider transition-colors disabled:opacity-50 shadow-sm"
          >
            <Download className="w-3.5 h-3.5" />
            <span>خروجی CSV</span>
          </button>

          <button
            onClick={onClearAll}
            disabled={logs.length === 0}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md bg-slate-800 hover:bg-rose-900/40 text-slate-400 hover:text-rose-300 border border-slate-700 text-xs font-medium transition-colors disabled:opacity-50"
            title="حذف تمام رکوردهای جدول"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>پاکسازی</span>
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 my-3">
        {/* Search */}
        <div className="relative">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="جستجو در نام، کد پرسنلی، دوربین..."
            className="w-full pl-3 pr-8 py-1.5 rounded-md bg-slate-950 border border-slate-800 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-cyan-500 font-mono transition-colors"
          />
        </div>

        {/* Movement Filter */}
        <div className="flex items-center gap-1.5">
          <span className="text-[11px] text-slate-400 whitespace-nowrap font-mono">نوع تردد:</span>
          <select
            value={filterMovement}
            onChange={(e) => setFilterMovement(e.target.value)}
            className="w-full px-2.5 py-1.5 rounded-md bg-slate-950 border border-slate-800 text-xs text-white focus:outline-none focus:border-cyan-500 font-mono"
          >
            <option value="all">تمام ترددها (ALL)</option>
            <option value="entry">ورود به محوطه (ENTRY)</option>
            <option value="exit">خروج از محوطه (EXIT)</option>
            <option value="passage">عبور عادی (PASSAGE)</option>
          </select>
        </div>

        {/* Status Filter */}
        <div className="flex items-center gap-1.5">
          <span className="text-[11px] text-slate-400 whitespace-nowrap font-mono">وضعیت:</span>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="w-full px-2.5 py-1.5 rounded-md bg-slate-950 border border-slate-800 text-xs text-white focus:outline-none focus:border-cyan-500 font-mono"
          >
            <option value="all">تمام افراد (ALL)</option>
            <option value="recognized">پرسنل مجاز (MATCHED)</option>
            <option value="unknown">افراد ناشناس (UNKNOWN)</option>
          </select>
        </div>
      </div>

      {/* Table Component */}
      <div className="overflow-x-auto rounded-lg border border-slate-800">
        <table className="w-full text-right text-xs">
          <thead className="bg-slate-950 text-slate-500 text-[10px] font-bold uppercase tracking-wider border-b border-slate-800">
            <tr>
              <th className="py-2.5 px-3">بزرگنمایی</th>
              <th className="py-2.5 px-3">سوژه / هویت</th>
              <th className="py-2.5 px-3">جهت تردد</th>
              <th className="py-2.5 px-3">زمان دقیق ثبت</th>
              <th className="py-2.5 px-3">دوربین منبع</th>
              <th className="py-2.5 px-3">درصد تطابق</th>
              <th className="py-2.5 px-3">وضعیت مجوز</th>
              <th className="py-2.5 px-3 text-center">عملیات</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/50 font-sans">
            {filteredLogs.length === 0 ? (
              <tr>
                <td colSpan={8} className="py-8 text-center text-slate-500 font-mono">
                  {searchTerm
                    ? 'NO MATCHING RECORDS FOUND'
                    : 'NO TRAFFIC LOGS STORED IN DATABASE'}
                </td>
              </tr>
            ) : (
              filteredLogs.map((log) => {
                return (
                  <tr
                    key={log.id}
                    className="hover:bg-slate-800/40 transition-colors group"
                  >
                    {/* Face Thumbnail with Sleek Corner Reticle */}
                    <td className="py-2 px-3">
                      <div
                        onClick={() => onViewLogDetail(log)}
                        className="relative w-11 h-11 rounded border border-slate-700 group-hover:border-cyan-400 cursor-pointer bg-slate-950 flex-shrink-0 overflow-hidden"
                        title="مشاهده بزرگنمایی چهره"
                      >
                        {log.faceSnapshot ? (
                          <img
                            src={log.faceSnapshot}
                            alt={log.personName}
                            className="w-full h-full object-cover transition-transform group-hover:scale-110"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-slate-600">
                            -
                          </div>
                        )}
                        <span className="absolute bottom-0 inset-x-0 bg-black/80 text-[8px] text-cyan-300 text-center font-mono py-0.2">
                          MAG
                        </span>
                      </div>
                    </td>

                    {/* Person Details */}
                    <td className="py-2 px-3">
                      <div>
                        <div className="font-bold text-white text-xs">
                          {log.personName}
                        </div>
                        {log.personnelId ? (
                          <div className="text-[11px] font-mono text-cyan-400">
                            {log.personnelId}
                          </div>
                        ) : (
                          <div className="text-[10px] text-slate-500 font-mono">UNREGISTERED</div>
                        )}
                        {log.notes && (
                          <div className="text-[10px] text-slate-400 truncate max-w-[140px]">
                            {log.notes}
                          </div>
                        )}
                      </div>
                    </td>

                    {/* Movement Type */}
                    <td className="py-2 px-3">
                      {log.movementType === 'entry' ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                          <ArrowDownRight className="w-3 h-3" />
                          ENTRY
                        </span>
                      ) : log.movementType === 'exit' ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono font-medium bg-blue-500/10 text-blue-400 border border-blue-500/20">
                          <ArrowUpLeft className="w-3 h-3" />
                          EXIT
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono font-medium bg-slate-500/10 text-slate-400 border border-slate-500/20">
                          PASSAGE
                        </span>
                      )}
                    </td>

                    {/* Exact Timestamp */}
                    <td className="py-2 px-3 font-mono">
                      <div className="text-slate-200 font-medium text-xs">
                        {log.jalaliDate}
                      </div>
                      <div className="text-cyan-400 font-semibold text-[11px] tracking-wide">
                        {log.jalaliTime}
                      </div>
                    </td>

                    {/* Camera Name & IP */}
                    <td className="py-2 px-3">
                      <div className="flex items-center gap-1.5 text-slate-300 text-xs">
                        <Camera className="w-3 h-3 text-slate-500" />
                        <span className="truncate max-w-[130px] font-mono">{log.cameraName}</span>
                      </div>
                      <div className="text-[10px] font-mono text-slate-500">
                        {log.cameraIp}
                      </div>
                    </td>

                    {/* Confidence % */}
                    <td className="py-2 px-3 font-mono">
                      <span className="font-semibold text-emerald-400 text-xs">
                        {toPersianDigits(log.confidence)}%
                      </span>
                    </td>

                    {/* Recognition Status */}
                    <td className="py-2 px-3">
                      {log.isRecognized ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                          <CheckCircle2 className="w-3 h-3" />
                          MATCHED
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono font-medium bg-amber-500/10 text-amber-400 border border-amber-500/30">
                          <AlertTriangle className="w-3 h-3" />
                          UNKNOWN
                        </span>
                      )}
                    </td>

                    {/* Actions */}
                    <td className="py-2 px-3 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          onClick={() => onViewLogDetail(log)}
                          className="p-1 rounded-md bg-slate-800 hover:bg-cyan-500/20 text-slate-300 hover:text-cyan-300 border border-slate-700 transition-colors"
                          title="مشاهده بزرگنمایی چهره و جزئیات"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => onDeleteLog(log.id)}
                          className="p-1 rounded-md bg-slate-800 hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 border border-slate-700 transition-colors"
                          title="حذف رکورد"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Footer info */}
      <div className="flex items-center justify-between mt-3 text-xs text-slate-500 font-mono">
        <div>
          RECORDS:{' '}
          <span className="font-bold text-slate-300">
            {toPersianDigits(filteredLogs.length)}
          </span>{' '}
          / {toPersianDigits(logs.length)}
        </div>
        <div className="text-[10px] text-slate-600 uppercase tracking-widest">
          ONLINE DATABASE AUDIT ACTIVE
        </div>
      </div>
    </div>
  );
};
