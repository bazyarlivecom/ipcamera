import React, { useRef, useEffect, useState, useCallback } from 'react';
import {
  Camera,
  Play,
  Pause,
  RefreshCw,
  Maximize2,
  Scan,
  Shield,
  Sliders,
  AlertCircle,
  Eye,
  Crosshair,
  UserCheck,
} from 'lucide-react';
import { CameraConfig, DetectedFace, RegisteredPerson } from '../types';
import { detectFacesOnMedia, cropFaceToDataUrl } from '../utils/faceDetector';
import { formatExactTimestamp, toPersianDigits } from '../utils/dateTime';

interface CctvStreamPlayerProps {
  activeCamera: CameraConfig;
  registeredPersons: RegisteredPerson[];
  onFaceDetected: (faces: DetectedFace[], currentThumbnailMap: Record<string, string>) => void;
  onSelectFaceToInspect: (face: DetectedFace, thumbnail: string) => void;
  onAutoLogTraffic: (face: DetectedFace, thumbnail: string) => void;
  autoLogEnabled: boolean;
}

export const CctvStreamPlayer: React.FC<CctvStreamPlayerProps> = ({
  activeCamera,
  registeredPersons,
  onFaceDetected,
  onSelectFaceToInspect,
  onAutoLogTraffic,
  autoLogEnabled,
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasOverlayRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const [isPlaying, setIsPlaying] = useState(true);
  const [streamError, setStreamError] = useState<string | null>(null);
  const [detectedFaces, setDetectedFaces] = useState<DetectedFace[]>([]);
  const [fps, setFps] = useState<number>(24);
  const [showHudOverlay, setShowHudOverlay] = useState(true);
  const [zoomLevel, setZoomLevel] = useState<number>(1);
  const [activeFaceIndex, setActiveFaceIndex] = useState<number | null>(null);
  const [liveOsdTime, setLiveOsdTime] = useState('');

  // Audio chirp feedback for detection
  const playBeep = useCallback(() => {
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, audioCtx.currentTime);
      gain.gain.setValueAtTime(0.04, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + 0.12);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.12);
    } catch {
      // Audio context blocked
    }
  }, []);

  // Cooldown tracker for auto-logging to prevent spamming database
  const lastLoggedRef = useRef<Record<number, number>>({});

  // Initialize camera stream
  useEffect(() => {
    let activeStream: MediaStream | null = null;
    let isCancelled = false;

    setStreamError(null);

    const setupCamera = async () => {
      try {
        if (activeCamera.streamType === 'webcam') {
          const stream = await navigator.mediaDevices.getUserMedia({
            video: { width: { ideal: 1280 }, height: { ideal: 720 } },
            audio: false,
          });
          if (isCancelled) {
            stream.getTracks().forEach((t) => t.stop());
            return;
          }
          activeStream = stream;
          if (videoRef.current) {
            videoRef.current.srcObject = stream;
            videoRef.current.play().catch(() => {});
          }
        } else {
          // Simulation or IP Camera stream URL
          if (videoRef.current) {
            videoRef.current.srcObject = null;
            videoRef.current.crossOrigin = 'anonymous';

            // High-res simulated surveillance stream or external MJPEG/MP4
            const streamUrl =
              activeCamera.streamUrl ||
              'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4';

            videoRef.current.src = streamUrl;
            videoRef.current.loop = true;
            videoRef.current.muted = true;
            videoRef.current.play().catch((err) => {
              console.warn('Video play prevented:', err);
            });
          }
        }
      } catch (err: any) {
        console.error('Camera stream access failed:', err);
        setStreamError('خطا در دسترسی به دوربین: ' + (err.message || 'نامشخص'));
      }
    };

    setupCamera();

    return () => {
      isCancelled = true;
      if (activeStream) {
        activeStream.getTracks().forEach((t) => t.stop());
      }
    };
  }, [activeCamera]);

  // Update OSD watermark time
  useEffect(() => {
    const timer = setInterval(() => {
      const info = formatExactTimestamp();
      setLiveOsdTime(`${info.jalaliDate} ${info.jalaliTime}`);
    }, 200);
    return () => clearInterval(timer);
  }, []);

  // Face Detection & Canvas Bounding Box Rendering Loop
  useEffect(() => {
    let animationFrameId: number;
    let lastScanTime = 0;
    const scanInterval = 120; // run face detection every 120ms for smooth 8-10 detections/sec

    const processLoop = async (now: number) => {
      if (!isPlaying) {
        animationFrameId = requestAnimationFrame(processLoop);
        return;
      }

      const video = videoRef.current;
      const canvas = canvasOverlayRef.current;

      if (video && canvas && video.readyState >= 2) {
        // Match canvas dimensions to container / video aspect
        if (canvas.width !== video.clientWidth || canvas.height !== video.clientHeight) {
          canvas.width = video.clientWidth;
          canvas.height = video.clientHeight;
        }

        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.clearRect(0, 0, canvas.width, canvas.height);

          // Periodic face detection
          if (now - lastScanTime > scanInterval) {
            lastScanTime = now;
            try {
              let faces = await detectFacesOnMedia(video, registeredPersons);

              // If no face found in video, simulate smart demo tracking targets for testing if in simulation mode
              if (faces.length === 0 && activeCamera.streamType === 'simulation') {
                const cycle = (now / 2400) % 1;
                const sinWave = Math.sin(now / 1500) * 0.05;
                const cosWave = Math.cos(now / 1800) * 0.04;

                const demoPerson = registeredPersons[0] || null;
                faces = [
                  {
                    id: 'face-demo-1',
                    trackingId: 102,
                    confidence: 96.8,
                    label: demoPerson ? demoPerson.fullName : 'دکتر علیرضا محمدی',
                    box: {
                      x: 0.32 + sinWave,
                      y: 0.22 + cosWave,
                      width: 0.19,
                      height: 0.26,
                    },
                    recognizedPerson: demoPerson,
                    timestamp: new Date().toISOString(),
                    attributes: {
                      ageRange: '۳۵-۴۰ سال',
                      gender: 'مرد',
                      emotion: 'طبیعی',
                    },
                  },
                  {
                    id: 'face-demo-2',
                    trackingId: 109,
                    confidence: 91.2,
                    label: 'فرد ناشناس #109',
                    box: {
                      x: 0.62 - sinWave * 0.8,
                      y: 0.26 - cosWave * 0.5,
                      width: 0.16,
                      height: 0.23,
                    },
                    recognizedPerson: null,
                    timestamp: new Date().toISOString(),
                    attributes: {
                      ageRange: '۲۶-۳۰ سال',
                      gender: 'مرد',
                      emotion: 'تمرکز',
                    },
                  },
                ];
              }

              setDetectedFaces(faces);

              // Generate cropped face thumbnails
              const thumbMap: Record<string, string> = {};
              faces.forEach((f) => {
                const thumb = cropFaceToDataUrl(video, f.box, 180);
                thumbMap[f.id] = thumb;

                // Auto log traffic logic with 15-second cooldown per trackingId
                if (autoLogEnabled) {
                  const lastLog = lastLoggedRef.current[f.trackingId] || 0;
                  if (now - lastLog > 15000) {
                    lastLoggedRef.current[f.trackingId] = now;
                    onAutoLogTraffic(f, thumb);
                  }
                }
              });

              onFaceDetected(faces, thumbMap);
            } catch (err) {
              console.error('Detection error:', err);
            }
          }

          // Draw Bounding Boxes on Overlay Canvas
          if (showHudOverlay && detectedFaces.length > 0) {
            const w = canvas.width;
            const h = canvas.height;

            detectedFaces.forEach((face, idx) => {
              const bx = face.box.x * w;
              const by = face.box.y * h;
              const bw = face.box.width * w;
              const bh = face.box.height * h;

              const isRecognized = !!face.recognizedPerson;
              const isSelected = activeFaceIndex === idx;

              // Color scheme
              const themeColor = isRecognized ? '#10b981' : isSelected ? '#38bdf8' : '#06b6d4';
              const bracketColor = isRecognized ? '#34d399' : '#22d3ee';

              // Bounding Box background tint
              ctx.fillStyle = isRecognized ? 'rgba(16, 185, 129, 0.08)' : 'rgba(34, 211, 238, 0.08)';
              ctx.fillRect(bx, by, bw, bh);

              // Tactical glowing corner brackets
              const bracketLen = Math.min(bw, bh) * 0.28;
              ctx.lineWidth = isSelected ? 3 : 2;
              ctx.strokeStyle = isRecognized ? '#10b981' : '#22d3ee';
              ctx.shadowColor = isRecognized ? 'rgba(16, 185, 129, 0.5)' : 'rgba(34, 211, 238, 0.6)';
              ctx.shadowBlur = 8;

              // Top-Left
              ctx.beginPath();
              ctx.moveTo(bx, by + bracketLen);
              ctx.lineTo(bx, by);
              ctx.lineTo(bx + bracketLen, by);
              ctx.stroke();

              // Top-Right
              ctx.beginPath();
              ctx.moveTo(bx + bw - bracketLen, by);
              ctx.lineTo(bx + bw, by);
              ctx.lineTo(bx + bw, by + bracketLen);
              ctx.stroke();

              // Bottom-Left
              ctx.beginPath();
              ctx.moveTo(bx, by + bh - bracketLen);
              ctx.lineTo(bx, by + bh);
              ctx.lineTo(bx + bracketLen, by + bh);
              ctx.stroke();

              // Bottom-Right
              ctx.beginPath();
              ctx.moveTo(bx + bw - bracketLen, by + bh);
              ctx.lineTo(bx + bw, by + bh);
              ctx.lineTo(bx + bw, by + bh - bracketLen);
              ctx.stroke();

              // Reset shadow for text
              ctx.shadowBlur = 0;

              // Sleek Interface Match Banner on top of bounding box
              const matchBannerText = isRecognized
                ? `مجاز: ${toPersianDigits(face.confidence)}٪`
                : `تطابق: ${toPersianDigits(face.confidence)}٪`;

              ctx.font = 'bold 10px JetBrains Mono, Vazirmatn, sans-serif';
              const textMetrics = ctx.measureText(matchBannerText);
              const bannerW = textMetrics.width + 12;
              const bannerH = 18;

              // Banner Background
              ctx.fillStyle = isRecognized ? '#10b981' : '#22d3ee';
              ctx.fillRect(bx, Math.max(2, by - bannerH), bannerW, bannerH);

              // Banner Text (High contrast black text on cyan/emerald background like Sleek theme)
              ctx.fillStyle = '#000000';
              ctx.textAlign = 'center';
              ctx.textBaseline = 'middle';
              ctx.fillText(matchBannerText, bx + bannerW / 2, Math.max(2, by - bannerH) + bannerH / 2);

              // Label Pill underneath with person name or unknown subject ID
              const labelText = isRecognized
                ? face.recognizedPerson?.fullName || 'پرسنل مجاز'
                : `سوژه #${toPersianDigits(face.trackingId)}`;

              ctx.font = 'bold 11px Vazirmatn, sans-serif';
              const nameMetrics = ctx.measureText(labelText);
              const nameW = nameMetrics.width + 14;
              const nameH = 20;

              ctx.fillStyle = 'rgba(2, 6, 23, 0.9)';
              ctx.strokeStyle = isRecognized ? '#10b981' : '#22d3ee';
              ctx.lineWidth = 1;
              ctx.fillRect(bx, by + bh + 3, nameW, nameH);
              ctx.strokeRect(bx, by + bh + 3, nameW, nameH);

              ctx.fillStyle = '#ffffff';
              ctx.textAlign = 'center';
              ctx.textBaseline = 'middle';
              ctx.fillText(labelText, bx + nameW / 2, by + bh + 3 + nameH / 2);
            });
          }
        }
      }

      animationFrameId = requestAnimationFrame(processLoop);
    };

    animationFrameId = requestAnimationFrame(processLoop);
    return () => cancelAnimationFrame(animationFrameId);
  }, [
    isPlaying,
    activeCamera,
    registeredPersons,
    showHudOverlay,
    detectedFaces,
    activeFaceIndex,
    autoLogEnabled,
    onFaceDetected,
    onAutoLogTraffic,
  ]);

  // Click on canvas to zoom into face or inspect
  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasOverlayRef.current;
    const video = videoRef.current;
    if (!canvas || !video) return;

    const rect = canvas.getBoundingClientRect();
    const clickX = (e.clientX - rect.left) / rect.width;
    const clickY = (e.clientY - rect.top) / rect.height;

    // Check if clicked inside any detected face bounding box
    const clickedFace = detectedFaces.find(
      (f) =>
        clickX >= f.box.x &&
        clickX <= f.box.x + f.box.width &&
        clickY >= f.box.y &&
        clickY <= f.box.y + f.box.height
    );

    if (clickedFace) {
      const thumb = cropFaceToDataUrl(video, clickedFace.box, 300);
      onSelectFaceToInspect(clickedFace, thumb);
      playBeep();
    }
  };

  // Manual capture
  const handleManualCapture = () => {
    const video = videoRef.current;
    if (!video || detectedFaces.length === 0) return;

    const primaryFace = detectedFaces[0];
    const thumb = cropFaceToDataUrl(video, primaryFace.box, 300);
    onAutoLogTraffic(primaryFace, thumb);
    playBeep();
  };

  return (
    <div
      ref={containerRef}
      className="relative rounded-lg overflow-hidden bg-slate-950 border border-slate-800 shadow-2xl flex flex-col group"
    >
      {/* CCTV Top Status Bar */}
      <div className="absolute top-0 inset-x-0 z-20 flex items-center justify-between px-4 py-2.5 bg-gradient-to-b from-slate-950/90 via-slate-950/60 to-transparent pointer-events-auto">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-red-500 shadow-[0_0_8px_#ef4444] animate-pulse"></span>
            <span className="text-xs font-mono font-bold tracking-wider text-red-400 uppercase">REC</span>
          </div>

          <div className="h-3 w-px bg-slate-700/60" />

          <div className="flex items-center gap-2 text-xs font-mono text-slate-200">
            <span className="text-cyan-400 font-semibold">{activeCamera.name}</span>
            <span className="text-slate-400 text-[11px] hidden sm:inline font-mono">[{activeCamera.ipAddress}]</span>
          </div>
        </div>

        {/* Live OSD Timestamp watermark */}
        <div className="flex items-center gap-2 font-mono text-[11px] sm:text-xs text-slate-200 bg-slate-900/80 px-2.5 py-1 rounded border border-slate-700/60 backdrop-blur-sm">
          <span>{liveOsdTime}</span>
        </div>
      </div>

      {/* Main Video Screen with Canvas Overlay and Sleek Reticle Elements */}
      <div className="relative w-full aspect-video bg-black flex items-center justify-center overflow-hidden">
        {/* Sleek Dot Grid Pattern Overlay */}
        <div className="absolute inset-0 bg-dot-grid opacity-20 pointer-events-none z-10" />

        {/* Tactical Outer Reticle Frame */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[80%] h-[80%] border border-slate-800/50 pointer-events-none z-10" />

        {/* Corner Reticle Indicators */}
        <div className="absolute top-8 left-8 w-4 h-4 border-t-2 border-l-2 border-slate-700/60 pointer-events-none z-10" />
        <div className="absolute top-8 right-8 w-4 h-4 border-t-2 border-r-2 border-slate-700/60 pointer-events-none z-10" />
        <div className="absolute bottom-8 left-8 w-4 h-4 border-b-2 border-l-2 border-slate-700/60 pointer-events-none z-10" />
        <div className="absolute bottom-8 right-8 w-4 h-4 border-b-2 border-r-2 border-slate-700/60 pointer-events-none z-10" />

        {/* Bottom Left Surveillance Tags */}
        <div className="absolute bottom-4 left-4 flex items-center gap-2 z-20 pointer-events-none">
          <span className="bg-red-600/20 text-red-500 text-[10px] font-bold px-2 py-1 rounded border border-red-600/30">
            ● REC
          </span>
          <span className="bg-black/70 text-slate-300 text-[10px] font-mono px-2 py-1 rounded border border-slate-700 uppercase">
            {activeCamera.name}
          </span>
        </div>

        {streamError ? (
          <div className="flex flex-col items-center justify-center p-6 text-center max-w-md z-20">
            <AlertCircle className="w-12 h-12 text-rose-500 mb-3 animate-bounce" />
            <h3 className="text-base font-bold text-white mb-1">خطا در دریافت فید دوربین مداربسته</h3>
            <p className="text-xs text-slate-400 mb-4">{streamError}</p>
            <button
              onClick={() => window.location.reload()}
              className="px-3.5 py-2 rounded-md bg-cyan-600 hover:bg-cyan-500 text-xs font-medium text-white transition-colors"
            >
              تلاش مجدد اتصال
            </button>
          </div>
        ) : (
          <>
            <video
              ref={videoRef}
              playsInline
              autoPlay
              muted
              className={`w-full h-full object-cover transition-transform duration-300 ${
                zoomLevel > 1 ? 'scale-125' : 'scale-100'
              }`}
            />

            {/* Face Bounding Box Canvas Overlay */}
            <canvas
              ref={canvasOverlayRef}
              onClick={handleCanvasClick}
              className="absolute inset-0 w-full h-full cursor-crosshair z-10"
            />

            {/* Scan Line Laser Animation Effect */}
            <div className="absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-transparent via-cyan-400 to-transparent opacity-60 animate-pulse pointer-events-none z-10" />
          </>
        )}
      </div>

      {/* Bottom Control Bar (Sleek Interface Style) */}
      <div className="p-3 bg-slate-900 border-t border-slate-800 flex flex-wrap items-center justify-between gap-2.5 z-20">
        {/* Left: Stream playback and zoom toggle */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsPlaying(!isPlaying)}
            className="p-2 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors"
            title={isPlaying ? 'توقف فید' : 'پخش فید'}
          >
            {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 text-emerald-400" />}
          </button>

          <button
            onClick={() => setZoomLevel((prev) => (prev === 1 ? 1.25 : 1))}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md border text-xs transition-colors ${
              zoomLevel > 1
                ? 'bg-cyan-500/20 border-cyan-500/40 text-cyan-300'
                : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700'
            }`}
            title="بزرگنمایی لنز دوربین"
          >
            <Maximize2 className="w-3.5 h-3.5" />
            <span>بزرگنمایی لنز {zoomLevel > 1 ? '۱.۲۵x' : '۱.۰x'}</span>
          </button>

          <button
            onClick={() => setShowHudOverlay(!showHudOverlay)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md border text-xs transition-colors ${
              showHudOverlay
                ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300'
                : 'bg-slate-800 border-slate-700 text-slate-400 hover:bg-slate-700'
            }`}
          >
            <Scan className="w-3.5 h-3.5" />
            <span>کادربندی چهره: {showHudOverlay ? 'روشن' : 'خاموش'}</span>
          </button>
        </div>

        {/* Center: Live faces counter badge */}
        <div className="flex items-center gap-2 bg-slate-950 px-3 py-1 rounded-md border border-slate-800 text-xs">
          <Crosshair className="w-3.5 h-3.5 text-cyan-400 animate-spin" style={{ animationDuration: '8s' }} />
          <span className="text-slate-400">چهره‌های در کادر:</span>
          <span className="text-cyan-400 font-bold font-mono text-sm">
            {toPersianDigits(detectedFaces.length)}
          </span>
        </div>

        {/* Right: Manual Capture & Log */}
        <div className="flex items-center gap-2">
          <button
            onClick={handleManualCapture}
            disabled={detectedFaces.length === 0}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-md text-xs font-bold uppercase tracking-wider transition-all ${
              detectedFaces.length > 0
                ? 'bg-cyan-600 hover:bg-cyan-500 text-white shadow-sm active:scale-95'
                : 'bg-slate-800 text-slate-500 border border-slate-700 cursor-not-allowed'
            }`}
          >
            <UserCheck className="w-3.5 h-3.5" />
            <span>ثبت دستی تردد سوژه</span>
          </button>
        </div>
      </div>
    </div>
  );
};
