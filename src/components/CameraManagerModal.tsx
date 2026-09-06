import React, { useState, useRef } from 'react';
import {
  X,
  Camera,
  Plus,
  Trash2,
  Check,
  Globe,
  Radio,
  Wifi,
  Video,
  Monitor,
  Film,
  Upload,
} from 'lucide-react';
import { CameraConfig } from '../types';

interface CameraManagerModalProps {
  cameras: CameraConfig[];
  activeCameraId: string;
  onSelectCamera: (cam: CameraConfig) => void;
  onAddCamera: (cam: Partial<CameraConfig>) => void;
  onDeleteCamera: (id: string) => void;
  onClose: () => void;
}

export const CameraManagerModal: React.FC<CameraManagerModalProps> = ({
  cameras,
  activeCameraId,
  onSelectCamera,
  onAddCamera,
  onDeleteCamera,
  onClose,
}) => {
  const [showAddForm, setShowAddForm] = useState(false);
  const [name, setName] = useState('');
  const [ipAddress, setIpAddress] = useState('192.168.1.');
  const [streamType, setStreamType] = useState<CameraConfig['streamType']>('simulation');
  const [streamUrl, setStreamUrl] = useState('');
  const [location, setLocation] = useState('');
  const [videoFileName, setVideoFileName] = useState('');
  const [videoFileSize, setVideoFileSize] = useState('');
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleFilePicked = (file: File) => {
    if (!file) return;
    const url = URL.createObjectURL(file);
    setName(`ویدیو تستی: ${file.name.length > 25 ? file.name.slice(0, 22) + '...' : file.name}`);
    setIpAddress('LOCAL_VIDEO');
    setStreamUrl(url);
    setLocation('آزمایشگاه تست و دیباگ');
    setVideoFileName(file.name);
    setVideoFileSize((file.size / (1024 * 1024)).toFixed(1) + ' MB');
    setStreamType('video_file');
  };

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !ipAddress.trim()) return;

    onAddCamera({
      name,
      ipAddress,
      streamType,
      streamUrl:
        streamUrl ||
        (streamType === 'webcam'
          ? 'webcam'
          : 'https://images.unsplash.com/photo-1517245386807-bb43f82c33c4?auto=format&fit=crop&w=1080&q=80'),
      location: location || 'محوطه داخلی',
      isActive: true,
      resolution: '1920x1080',
      fps: 25,
      videoFileName: videoFileName || undefined,
      videoFileSize: videoFileSize || undefined,
    });

    setName('');
    setIpAddress('192.168.1.');
    setStreamUrl('');
    setLocation('');
    setVideoFileName('');
    setVideoFileSize('');
    setShowAddForm(false);
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
                مدیریت دوربین‌های مداربسته (CCTV IP CHANNELS)
              </h3>
              <p className="text-[11px] font-mono text-slate-400">
                IP CONFIGURATION, MJPEG STREAMING & RTSP GATEWAYS
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

        {/* Content */}
        <div className="p-5 max-h-[75vh] overflow-y-auto space-y-4">
          {/* Action Bar */}
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-400 font-mono">
              ACTIVE SOURCES: ({cameras.length})
            </span>
            <button
              onClick={() => setShowAddForm(!showAddForm)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold uppercase tracking-wider transition-colors shadow-sm"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>{showAddForm ? 'انصراف' : 'افزودن دوربین جدید'}</span>
            </button>
          </div>

          {/* Add Form */}
          {showAddForm && (
            <form
              onSubmit={handleAdd}
              className="p-4 rounded-lg bg-slate-950 border border-slate-800 space-y-3 animate-in fade-in"
            >
              <h4 className="text-xs font-bold text-cyan-400 flex items-center gap-1.5 font-mono uppercase tracking-wider">
                <Globe className="w-3.5 h-3.5" />
                مشخصات سنسور و دوربین IP جدید
              </h4>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-slate-300 mb-1 font-mono">نام دوربین (ALIAS):</label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="مثلاً: درب ورودی جنوبی"
                    className="w-full px-3 py-1.5 rounded-md bg-slate-900 border border-slate-700 text-xs text-white focus:outline-none focus:border-cyan-500"
                  />
                </div>

                <div>
                  <label className="block text-xs text-slate-300 mb-1 font-mono">آدرس IP دوربین (HOST/IP):</label>
                  <input
                    type="text"
                    required
                    value={ipAddress}
                    onChange={(e) => setIpAddress(e.target.value)}
                    placeholder="مثلاً: 192.168.1.120:8080"
                    className="w-full px-3 py-1.5 rounded-md bg-slate-900 border border-slate-700 text-xs text-white font-mono focus:outline-none focus:border-cyan-500"
                  />
                </div>

                <div>
                  <label className="block text-xs text-slate-300 mb-1 font-mono">نوع فید (STREAM PROTOCOL):</label>
                  <select
                    value={streamType}
                    onChange={(e) => setStreamType(e.target.value as any)}
                    className="w-full px-3 py-1.5 rounded-md bg-slate-900 border border-slate-700 text-xs text-white focus:outline-none focus:border-cyan-500 font-mono"
                  >
                    <option value="simulation">شبیه‌ساز تصویر مداربسته (CCTV Test Feed)</option>
                    <option value="video_file">فایل ویدیویی محلی (ویدیو برای تست و دیباگ سیستم)</option>
                    <option value="webcam">دوربین زنده سیستم/وبکم (Live Webcam Input)</option>
                    <option value="mjpeg">استریم زنده شبکه IP (MJPEG/HTTP Stream)</option>
                    <option value="snapshot">دریافت تصاویر پی‌درپی اسنپ‌شات (JPEG Polling)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs text-slate-300 mb-1 font-mono">موقعیت فیزیکی (ZONE):</label>
                  <input
                    type="text"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    placeholder="مثلاً: نگهبانی ورودی اصلی"
                    className="w-full px-3 py-1.5 rounded-md bg-slate-900 border border-slate-700 text-xs text-white focus:outline-none focus:border-cyan-500"
                  />
                </div>
              </div>

              {/* Local Video File Picker Section if video_file selected */}
              {streamType === 'video_file' ? (
                <div className="p-3 bg-cyan-950/20 border border-cyan-500/30 rounded-lg space-y-2">
                  <input
                    type="file"
                    ref={fileInputRef}
                    accept="video/mp4,video/webm,video/ogg,video/quicktime,video/x-msvideo,video/*"
                    onChange={(e) => {
                      if (e.target.files && e.target.files[0]) {
                        handleFilePicked(e.target.files[0]);
                      }
                    }}
                    className="hidden"
                  />
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-cyan-300 font-medium flex items-center gap-1.5">
                      <Film className="w-3.5 h-3.5" />
                      فایل ویدیویی محلی جهت بررسی و دیباگ چهره:
                    </span>
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="px-2.5 py-1 rounded bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold flex items-center gap-1.5 shadow-sm transition-colors"
                    >
                      <Upload className="w-3.5 h-3.5" />
                      <span>{videoFileName ? 'تغییر فایل ویدیو' : 'انتخاب فیلم از سیستم'}</span>
                    </button>
                  </div>
                  {videoFileName ? (
                    <div className="text-[11px] font-mono text-slate-300 bg-slate-900/90 p-2 rounded border border-slate-800 flex items-center justify-between">
                      <span className="text-cyan-400 font-semibold truncate max-w-xs">{videoFileName}</span>
                      <span className="text-slate-400">{videoFileSize}</span>
                    </div>
                  ) : (
                    <p className="text-[11px] text-slate-400">
                      یک فایل فیلم (مانند MP4 یا WebM) انتخاب نمایید تا سیستم روی فریم‌های آن پردازش و استخراج چهره را اجرا کند.
                    </p>
                  )}
                </div>
              ) : (
                <div>
                  <label className="block text-xs text-slate-300 mb-1 font-mono">
                    آدرس URL استریم / اسنپ‌شات (FEED URL):
                  </label>
                  <input
                    type="text"
                    value={streamUrl}
                    onChange={(e) => setStreamUrl(e.target.value)}
                    placeholder="http://192.168.1.120:8080/video یا آدرس تصویر دوربین"
                    className="w-full px-3 py-1.5 rounded-md bg-slate-900 border border-slate-700 text-xs text-white font-mono focus:outline-none focus:border-cyan-500"
                  />
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddForm(false)}
                  className="px-3 py-1.5 rounded-md bg-slate-800 text-xs text-slate-300 hover:bg-slate-700"
                >
                  انصراف
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-md bg-cyan-600 hover:bg-cyan-500 text-xs text-white font-bold uppercase tracking-wider shadow-sm"
                >
                  ثبت منبع جدید
                </button>
              </div>
            </form>
          )}

          {/* Cameras List */}
          <div className="space-y-2">
            {cameras.map((cam) => {
              const isActive = cam.id === activeCameraId;
              return (
                <div
                  key={cam.id}
                  className={`p-3 rounded-md border transition-all flex items-center justify-between gap-3 ${
                    isActive
                      ? 'bg-cyan-950/30 border-cyan-500/50 shadow-sm shadow-cyan-500/10'
                      : 'bg-slate-950 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-9 h-9 rounded-md flex items-center justify-center ${
                        isActive
                          ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30'
                          : 'bg-slate-800 text-slate-400'
                      }`}
                    >
                      {cam.streamType === 'video_file' ? (
                        <Film className="w-4 h-4 text-cyan-400" />
                      ) : cam.streamType === 'webcam' ? (
                        <Video className="w-4 h-4" />
                      ) : (
                        <Camera className="w-4 h-4" />
                      )}
                    </div>

                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="text-xs font-bold text-white font-mono">{cam.name}</h4>
                        {isActive && (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-medium bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                            {cam.streamType === 'video_file' ? 'DEBUG VIDEO' : 'LIVE FEED'}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-[11px] text-slate-400 font-mono mt-0.5">
                        <span className="text-cyan-400">{cam.ipAddress}</span>
                        <span>•</span>
                        <span className="font-sans">{cam.location}</span>
                        <span>•</span>
                        <span className="text-slate-500">
                          {cam.streamType === 'video_file'
                            ? 'VIDEO FILE'
                            : cam.streamType === 'webcam'
                            ? 'WEBCAM'
                            : cam.streamType === 'simulation'
                            ? 'SIMULATION'
                            : 'MJPEG'}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {!isActive && (
                      <button
                        onClick={() => {
                          onSelectCamera(cam);
                          onClose();
                        }}
                        className="px-3 py-1.5 rounded-md bg-slate-800 hover:bg-cyan-600 hover:text-white text-slate-300 text-xs font-medium transition-colors"
                      >
                        اتصال
                      </button>
                    )}
                    {cameras.length > 1 && (
                      <button
                        onClick={() => onDeleteCamera(cam.id)}
                        className="p-1.5 rounded-md bg-slate-800/80 hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 transition-colors"
                        title="حذف دوربین"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
