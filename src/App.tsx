import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Film, Upload } from 'lucide-react';
import { Header } from './components/Header';
import { StatsBanner } from './components/StatsBanner';
import { CctvStreamPlayer } from './components/CctvStreamPlayer';
import { FaceZoomPanel } from './components/FaceZoomPanel';
import { TrafficLogsTable } from './components/TrafficLogsTable';
import { FaceDetailModal } from './components/FaceDetailModal';
import { CameraManagerModal } from './components/CameraManagerModal';
import { PersonnelModal } from './components/PersonnelModal';
import { CameraConfig, DetectedFace, RegisteredPerson, TrafficLog } from './types';
import { formatExactTimestamp } from './utils/dateTime';

export default function App() {
  // State
  const [cameras, setCameras] = useState<CameraConfig[]>([]);
  const [activeCamera, setActiveCamera] = useState<CameraConfig | null>(null);
  const [registeredPersons, setRegisteredPersons] = useState<RegisteredPerson[]>([]);
  const [logs, setLogs] = useState<TrafficLog[]>([]);
  const [detectedFaces, setDetectedFaces] = useState<DetectedFace[]>([]);
  const [faceThumbnails, setFaceThumbnails] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(true);

  // File input ref for quick video testing
  const globalVideoInputRef = useRef<HTMLInputElement | null>(null);

  // Audio alerts
  const [audioEnabled, setAudioEnabled] = useState(true);
  const [autoLogEnabled, setAutoLogEnabled] = useState(true);

  // Modals
  const [isCamerasOpen, setIsCamerasOpen] = useState(false);
  const [isPersonnelOpen, setIsPersonnelOpen] = useState(false);
  const [inspectingFace, setInspectingFace] = useState<{
    face: DetectedFace | null;
    log: TrafficLog | null;
    thumbnail: string;
  } | null>(null);

  // Play audio chime
  const playAlertSound = useCallback(() => {
    if (!audioEnabled) return;
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(659.25, ctx.currentTime); // E5
      osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.08); // A5
      gain.gain.setValueAtTime(0.05, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.16);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.16);
    } catch {
      // Audio context blocked
    }
  }, [audioEnabled]);

  // Initial Fetch Data
  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [camsRes, personsRes, logsRes] = await Promise.all([
        fetch('/api/cameras').then((r) => r.json()),
        fetch('/api/registered-faces').then((r) => r.json()),
        fetch('/api/logs').then((r) => r.json()),
      ]);

      if (camsRes.success) {
        setCameras(camsRes.cameras);
        if (camsRes.cameras.length > 0 && !activeCamera) {
          setActiveCamera(camsRes.cameras[0]);
        }
      }

      if (personsRes.success) {
        setRegisteredPersons(personsRes.persons);
      }

      if (logsRes.success) {
        setLogs(logsRes.logs);
      }
    } catch (err) {
      console.error('Failed to load initial data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Server-Sent Events (SSE) for Real-Time Online Database Synchronization
  useEffect(() => {
    const sse = new EventSource('/api/logs/stream');

    sse.addEventListener('new_log', (event) => {
      try {
        const newLog: TrafficLog = JSON.parse(event.data);
        setLogs((prev) => [newLog, ...prev.filter((l) => l.id !== newLog.id)]);
        playAlertSound();
      } catch (e) {
        console.error('SSE new_log parse error:', e);
      }
    });

    sse.addEventListener('log_deleted', (event) => {
      try {
        const { id } = JSON.parse(event.data);
        setLogs((prev) => prev.filter((l) => l.id !== id));
      } catch (e) {}
    });

    sse.addEventListener('logs_cleared', () => {
      setLogs([]);
    });

    sse.addEventListener('cameras_updated', (event) => {
      try {
        const { cameras: updated } = JSON.parse(event.data);
        setCameras(updated);
      } catch (e) {}
    });

    sse.addEventListener('registered_faces_updated', (event) => {
      try {
        const { persons: updated } = JSON.parse(event.data);
        setRegisteredPersons(updated);
      } catch (e) {}
    });

    return () => {
      sse.close();
    };
  }, [playAlertSound]);

  // Handle Face Detection updates from CCTV Player
  const handleFaceDetected = useCallback(
    (faces: DetectedFace[], thumbnails: Record<string, string>) => {
      setDetectedFaces(faces);
      setFaceThumbnails(thumbnails);
    },
    []
  );

  // Auto-Log or Manual Log Traffic to Online Database
  const handleSaveTrafficLog = useCallback(
    async (face: DetectedFace, thumbnail: string) => {
      if (!activeCamera) return;

      const exact = formatExactTimestamp();
      const isRecognized = !!face.recognizedPerson;
      const personName = isRecognized
        ? face.recognizedPerson!.fullName
        : `سوژه ناشناس #${face.trackingId}`;

      const payload = {
        cameraName: activeCamera.name,
        cameraIp: activeCamera.ipAddress,
        faceSnapshot: thumbnail,
        personName,
        personnelId: face.recognizedPerson?.personnelCode || '',
        isRecognized,
        movementType: 'entry',
        confidence: face.confidence,
        notes: isRecognized
          ? `تردد مجاز پرسنل: ${face.recognizedPerson?.role}`
          : 'تردد چهره جدید - ثبت خودکار با کادربندی',
        ageEstimate: face.attributes?.ageRange,
        genderEstimate: face.attributes?.gender,
        emotion: face.attributes?.emotion,
        trackingId: face.trackingId,
        jalaliDate: exact.jalaliDate,
        jalaliTime: exact.jalaliTime,
        exactTimestampMs: exact.exactMs,
      };

      try {
        const res = await fetch('/api/logs', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        const data = await res.json();
        if (data.success && data.log) {
          // Updated via SSE automatically
        }
      } catch (err) {
        console.error('Error saving traffic log:', err);
      }
    },
    [activeCamera]
  );

  // Delete log from online database
  const handleDeleteLog = async (id: string) => {
    try {
      await fetch(`/api/logs/${id}`, { method: 'DELETE' });
      setLogs((prev) => prev.filter((l) => l.id !== id));
    } catch (err) {
      console.error('Failed to delete log:', err);
    }
  };

  // Clear all logs from online database
  const handleClearAllLogs = async () => {
    if (!window.confirm('آیا از پاکسازی تمام رکوردهای ثبت شده اطمینان دارید؟')) return;
    try {
      await fetch('/api/logs', { method: 'DELETE' });
      setLogs([]);
    } catch (err) {
      console.error('Failed to clear logs:', err);
    }
  };

  // Add camera
  const handleAddCamera = async (cam: Partial<CameraConfig>) => {
    try {
      const res = await fetch('/api/cameras', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(cam),
      });
      const data = await res.json();
      if (data.success) {
        setCameras(data.cameras);
      }
    } catch (err) {
      console.error('Failed to add camera:', err);
    }
  };

  // Delete camera
  const handleDeleteCamera = async (id: string) => {
    try {
      const res = await fetch(`/api/cameras/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        setCameras(data.cameras);
        if (activeCamera?.id === id && data.cameras.length > 0) {
          setActiveCamera(data.cameras[0]);
        }
      }
    } catch (err) {
      console.error('Failed to delete camera:', err);
    }
  };

  // Add registered person
  const handleAddPerson = async (person: Partial<RegisteredPerson>) => {
    try {
      const res = await fetch('/api/registered-faces', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(person),
      });
      const data = await res.json();
      if (data.success) {
        setRegisteredPersons((prev) => [...prev, data.person]);
      }
    } catch (err) {
      console.error('Failed to add person:', err);
    }
  };

  // Delete registered person
  const handleDeletePerson = async (id: string) => {
    try {
      const res = await fetch(`/api/registered-faces/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        setRegisteredPersons(data.persons);
      }
    } catch (err) {
      console.error('Failed to delete person:', err);
    }
  };

  // Inspect face in modal
  const handleOpenFaceInspect = (face: DetectedFace, thumbnail: string) => {
    setInspectingFace({
      face,
      log: null,
      thumbnail,
    });
  };

  // Inspect log in modal
  const handleOpenLogInspect = (log: TrafficLog) => {
    setInspectingFace({
      face: null,
      log,
      thumbnail: log.faceSnapshot,
    });
  };

  // Video file testing handler
  const handleSelectLocalVideo = (file: File) => {
    if (!file) return;
    const url = URL.createObjectURL(file);
    const newVideoCam: CameraConfig = {
      id: `cam-video-${Date.now()}`,
      name: `ویدیو تستی: ${file.name.length > 20 ? file.name.slice(0, 17) + '...' : file.name}`,
      ipAddress: 'LOCAL_VIDEO_FILE',
      streamType: 'video_file',
      streamUrl: url,
      location: 'محیط تست و دیباگ چهره',
      isActive: true,
      resolution: 'فایل محلی',
      fps: 30,
      videoFileName: file.name,
      videoFileSize: (file.size / (1024 * 1024)).toFixed(1) + ' MB',
    };
    setCameras((prev) => [newVideoCam, ...prev.filter((c) => c.id !== newVideoCam.id)]);
    setActiveCamera(newVideoCam);
  };

  // Preset debug video handler
  const handleSelectPresetVideo = (title: string, url: string) => {
    const newVideoCam: CameraConfig = {
      id: `cam-preset-${Date.now()}`,
      name: title,
      ipAddress: 'PRESET_VIDEO',
      streamType: 'video_file',
      streamUrl: url,
      location: 'آزمایشگاه تست و دیباگ',
      isActive: true,
      resolution: '1920x1080',
      fps: 30,
      videoFileName: title,
    };
    setCameras((prev) => [newVideoCam, ...prev.filter((c) => c.id !== newVideoCam.id)]);
    setActiveCamera(newVideoCam);
  };

  // Computed statistics
  const recognizedCount = logs.filter((l) => l.isRecognized).length;
  const unknownCount = logs.filter((l) => !l.isRecognized).length;
  const entriesCount = logs.filter((l) => l.movementType === 'entry').length;
  const exitsCount = logs.filter((l) => l.movementType === 'exit').length;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col selection:bg-cyan-500 selection:text-white">
      {/* Top Operations Header */}
      <Header
        onOpenCameras={() => setIsCamerasOpen(true)}
        onOpenPersonnel={() => setIsPersonnelOpen(true)}
        onExportCsv={() => {
          const btn = document.querySelector('[title="دانلود گزارش ترددها (اکسل/CSV)"]') as any;
          if (btn) btn.click();
        }}
        audioEnabled={audioEnabled}
        onToggleAudio={() => setAudioEnabled(!audioEnabled)}
        activeCameraName={activeCamera?.name || 'در حال جستجو...'}
        totalLogsCount={logs.length}
      />

      {/* Main Operations Dashboard */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 space-y-5">
        {/* Real-time Metric Badges */}
        <StatsBanner
          totalLogs={logs.length}
          recognizedCount={recognizedCount}
          unknownCount={unknownCount}
          activeCamerasCount={cameras.length}
          entriesCount={entriesCount}
          exitsCount={exitsCount}
        />

        {/* Video Surveillance Feed & Face Magnification Strip */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* 2-Columns: CCTV Player with Bounding Boxes & Controls */}
          <div className="lg:col-span-2">
            {/* Hidden file picker for quick video testing */}
            <input
              type="file"
              ref={globalVideoInputRef}
              accept="video/mp4,video/webm,video/ogg,video/quicktime,video/x-msvideo,video/*"
              onChange={(e) => {
                if (e.target.files && e.target.files[0]) {
                  handleSelectLocalVideo(e.target.files[0]);
                }
              }}
              className="hidden"
            />

            {activeCamera ? (
              <CctvStreamPlayer
                activeCamera={activeCamera}
                registeredPersons={registeredPersons}
                onFaceDetected={handleFaceDetected}
                onSelectFaceToInspect={handleOpenFaceInspect}
                onAutoLogTraffic={handleSaveTrafficLog}
                autoLogEnabled={autoLogEnabled}
                onSelectLocalVideo={handleSelectLocalVideo}
                onSelectPresetVideo={handleSelectPresetVideo}
              />
            ) : (
              <div className="aspect-video bg-slate-900 rounded-2xl flex items-center justify-center border border-slate-800">
                <span className="text-slate-500 text-sm">در حال بارگذاری دوربین مداربسته...</span>
              </div>
            )}

            {/* Quick Stream Selector Tabs */}
            <div className="mt-2.5 flex items-center justify-between flex-wrap gap-2 text-xs">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-slate-500 font-mono text-[11px] uppercase tracking-wider">منبع ورودی (FEED):</span>
                <div className="flex items-center gap-1.5 flex-wrap">
                  {cameras.map((c) => (
                    <button
                      key={c.id}
                      onClick={() => setActiveCamera(c)}
                      className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md border font-mono text-xs transition-all ${
                        activeCamera?.id === c.id
                          ? 'bg-cyan-500/20 border-cyan-500/50 text-cyan-300 font-semibold shadow-sm shadow-cyan-500/10'
                          : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white hover:bg-slate-800'
                      }`}
                    >
                      {c.streamType === 'video_file' && <Film className="w-3 h-3 text-cyan-400" />}
                      <span>{c.name}</span>
                    </button>
                  ))}

                  {/* Dedicated Quick Button for Testing Video Files */}
                  <button
                    onClick={() => globalVideoInputRef.current?.click()}
                    title="انتخاب فایل ویدیو از سیستم جهت آزمایش و دیباگ الگوریتم تشخیص چهره"
                    className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-gradient-to-r from-cyan-600 to-emerald-600 hover:from-cyan-500 hover:to-emerald-500 text-white font-medium text-xs shadow-sm transition-all active:scale-95"
                  >
                    <Film className="w-3.5 h-3.5" />
                    <span>+ انتخاب فیلم تست و دیباگ</span>
                  </button>
                </div>
              </div>

              {/* Auto Record toggle */}
              <label className="flex items-center gap-2 cursor-pointer bg-slate-900 px-2.5 py-1 rounded-md border border-slate-800 hover:border-slate-700 transition-colors">
                <input
                  type="checkbox"
                  checked={autoLogEnabled}
                  onChange={(e) => setAutoLogEnabled(e.target.checked)}
                  className="rounded text-cyan-500 focus:ring-cyan-500 bg-slate-950 border-slate-700 w-3.5 h-3.5"
                />
                <span className="text-slate-300 text-xs font-medium">ثبت خودکار تردد هنگام تشخیص</span>
              </label>
            </div>
          </div>

          {/* 1-Column: Dedicated Face Magnification & Real-time Zoom Panel */}
          <div className="lg:col-span-1">
            <FaceZoomPanel
              detectedFaces={detectedFaces}
              thumbnails={faceThumbnails}
              onInspectFace={handleOpenFaceInspect}
              onQuickLog={handleSaveTrafficLog}
            />
          </div>
        </div>

        {/* Online Database Traffic Logs Section */}
        <TrafficLogsTable
          logs={logs}
          onDeleteLog={handleDeleteLog}
          onClearAll={handleClearAllLogs}
          onRefresh={fetchData}
          onViewLogDetail={handleOpenLogInspect}
          isLoading={isLoading}
        />
      </main>

      {/* Forensic Face Magnification & Analysis Modal */}
      {inspectingFace && (
        <FaceDetailModal
          face={inspectingFace.face}
          log={inspectingFace.log}
          thumbnail={inspectingFace.thumbnail}
          cameraName={activeCamera?.name || 'دوربین فعال'}
          cameraIp={activeCamera?.ipAddress || '192.168.1.100'}
          onClose={() => setInspectingFace(null)}
          onSaveAsLog={async (updated) => {
            const exact = formatExactTimestamp();
            await fetch('/api/logs', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                ...updated,
                jalaliDate: exact.jalaliDate,
                jalaliTime: exact.jalaliTime,
                exactTimestampMs: exact.exactMs,
              }),
            });
            fetchData();
          }}
          onRegisterPerson={handleAddPerson}
        />
      )}

      {/* Cameras Management Modal */}
      {isCamerasOpen && (
        <CameraManagerModal
          cameras={cameras}
          activeCameraId={activeCamera?.id || ''}
          onSelectCamera={(cam) => setActiveCamera(cam)}
          onAddCamera={handleAddCamera}
          onDeleteCamera={handleDeleteCamera}
          onClose={() => setIsCamerasOpen(false)}
        />
      )}

      {/* Registered Personnel Modal */}
      {isPersonnelOpen && (
        <PersonnelModal
          persons={registeredPersons}
          onAddPerson={handleAddPerson}
          onDeletePerson={handleDeletePerson}
          onClose={() => setIsPersonnelOpen(false)}
        />
      )}
    </div>
  );
}
