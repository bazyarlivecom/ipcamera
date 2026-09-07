import React, { useRef, useEffect, useState, useCallback } from 'react';
import {
  Camera,
  Play,
  Pause,
  Upload,
  SkipBack,
  SkipForward,
  Repeat,
  Sliders,
  Eye,
  Crosshair,
  Download,
  Film,
  WifiOff,
  Maximize2,
  Trash2,
  ScanFace,
  Check,
  ChevronDown,
  Layers,
  Zap,
} from 'lucide-react';
import { DetectedFace, YuNetSettings, MediaSourceConfig } from '../types';
import { detectFacesOnMedia, cropFaceToDataUrl } from '../utils/faceDetector';
import { toPersianDigits, formatExactTimestamp } from '../utils/dateTime';

export const PRESET_TEST_VIDEOS = [
  {
    id: 'preset-pedestrians',
    name: 'تست ۱: تردد عابران پیاده (Outdoor Walking)',
    url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
    desc: 'مناسب ارزیابی حرکت چند چهره در ابعاد و زوایای مختلف',
  },
  {
    id: 'preset-entrance',
    name: 'تست ۲: ورودی و راهرو (Hallway Passage)',
    url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/WeAreGoingOnBullrun.mp4',
    desc: 'ارزیابی چهره‌های با سرعت عبور متفاوت و شرایط نوری متغیر',
  },
];

interface YuNetStudioProps {
  audioEnabled: boolean;
  onStatsUpdate: (detectedCount: number, fps: number, latencyMs: number) => void;
  onInspectFace: (face: DetectedFace, thumbnail: string) => void;
}

export const YuNetStudio: React.FC<YuNetStudioProps> = ({
  audioEnabled,
  onStatsUpdate,
  onInspectFace,
}) => {
  // DOM References
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const canvasOverlayRef = useRef<HTMLCanvasElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Media Source State
  const [currentSource, setCurrentSource] = useState<MediaSourceConfig>({
    type: 'preset',
    url: PRESET_TEST_VIDEOS[0].url,
    name: PRESET_TEST_VIDEOS[0].name,
  });
  const [isWebcamActive, setIsWebcamActive] = useState(false);
  const [webcamStream, setWebcamStream] = useState<MediaStream | null>(null);
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const [showPresetsMenu, setShowPresetsMenu] = useState(false);

  // Playback State
  const [isPlaying, setIsPlaying] = useState(true);
  const isPlayingRef = useRef(isPlaying);
  useEffect(() => {
    isPlayingRef.current = isPlaying;
  }, [isPlaying]);

  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [isLooping, setIsLooping] = useState(true);

  // Algorithm Settings (OpenCV YuNet)
  const [settings, setSettings] = useState<YuNetSettings>({
    confidenceThreshold: 55,
    nmsThreshold: 35,
    showLandmarks: true,
    enableSmoothing: true,
  });
  const [showSettingsPanel, setShowSettingsPanel] = useState(false);

  // Detection & Visual States
  const [detectedFaces, setDetectedFaces] = useState<DetectedFace[]>([]);
  const [faceThumbnails, setFaceThumbnails] = useState<Record<string, string>>({});
  const [historyFaces, setHistoryFaces] = useState<{ face: DetectedFace; thumbnail: string; time: string }[]>([]);
  const [activeFaceIndex, setActiveFaceIndex] = useState<number | null>(null);

  // Audio chirp feedback for detection
  const playBeep = useCallback(() => {
    if (!audioEnabled) return;
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
  }, [audioEnabled]);

  // Webcam Management
  const startWebcam = async () => {
    try {
      if (webcamStream) {
        webcamStream.getTracks().forEach((t) => t.stop());
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 } },
      });
      setWebcamStream(stream);
      setIsWebcamActive(true);
      setCurrentSource({
        type: 'webcam',
        name: 'وبکم مستقیم (دوربین زنده)',
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
    } catch (err) {
      console.error('Failed to access webcam:', err);
      alert('خطا در دسترسی به دوربین. لطفاً دسترسی دوربین را در مرورگر فعال نمایید.');
    }
  };

  const stopWebcam = () => {
    if (webcamStream) {
      webcamStream.getTracks().forEach((t) => t.stop());
      setWebcamStream(null);
    }
    setIsWebcamActive(false);
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  };

  // Local File Upload Handler (Video or Image)
  const handleFileUpload = (file: File) => {
    if (isWebcamActive) {
      stopWebcam();
    }
    const isImg = file.type.startsWith('image/');
    const fileUrl = URL.createObjectURL(file);

    setCurrentSource({
      type: 'file',
      url: fileUrl,
      name: file.name,
      fileName: file.name,
      isImage: isImg,
    });
    setDetectedFaces([]);
    setCurrentTime(0);
    setIsPlaying(true);
  };

  const handleSelectPreset = (preset: typeof PRESET_TEST_VIDEOS[0]) => {
    if (isWebcamActive) {
      stopWebcam();
    }
    setCurrentSource({
      type: 'preset',
      url: preset.url,
      name: preset.name,
      isImage: false,
    });
    setShowPresetsMenu(false);
    setDetectedFaces([]);
    setCurrentTime(0);
    setIsPlaying(true);
  };

  // Drag and drop handlers
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingOver(true);
  };
  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingOver(false);
  };
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileUpload(e.dataTransfer.files[0]);
    }
  };

  // Time formatting helper
  const formatSeconds = (sec: number) => {
    if (!sec || isNaN(sec)) return '۰۰:۰۰';
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${toPersianDigits(m.toString().padStart(2, '0'))}:${toPersianDigits(s.toString().padStart(2, '0'))}`;
  };

  // Core Face Detection Execution Loop
  const lastDetectionTimeRef = useRef(0);
  const runDetection = useCallback(
    async (mediaSource: HTMLVideoElement | HTMLImageElement) => {
      const startTime = performance.now();
      try {
        const faces = await detectFacesOnMedia(mediaSource, [], {
          engine: 'yunet',
          confidenceThreshold: settings.confidenceThreshold,
          enableSmoothing: settings.enableSmoothing,
        });

        const latency = Math.round(performance.now() - startTime);
        const fps = latency > 0 ? Math.min(60, Math.round(1000 / Math.max(16, latency))) : 30;

        setDetectedFaces(faces);
        onStatsUpdate(faces.length, fps, latency);

        if (faces.length > 0) {
          const now = Date.now();
          if (now - lastDetectionTimeRef.current > 3000) {
            lastDetectionTimeRef.current = now;
            playBeep();
          }

          // Generate cropped thumbnails
          const thumbMap: Record<string, string> = {};
          faces.forEach((f) => {
            const thumb = cropFaceToDataUrl(mediaSource, f.box, 180);
            thumbMap[f.id] = thumb;
          });
          setFaceThumbnails(thumbMap);

          // Add unique faces to history (cooldown per tracking ID)
          setHistoryFaces((prev) => {
            const newItems = [...prev];
            faces.forEach((f) => {
              const thumb = thumbMap[f.id];
              if (thumb && !newItems.some((item) => item.face.trackingId === f.trackingId)) {
                newItems.unshift({
                  face: f,
                  thumbnail: thumb,
                  time: formatExactTimestamp().jalaliTime,
                });
              }
            });
            return newItems.slice(0, 16); // Keep last 16 faces
          });
        }
      } catch (err) {
        console.error('Detection error in YuNet loop:', err);
      }
    },
    [settings, onStatsUpdate, playBeep]
  );

  // Animation frame loop for real-time video processing & canvas rendering
  useEffect(() => {
    let animationFrameId: number;
    let lastScanTime = 0;
    const scanInterval = 100; // 10 scans / sec for optimal balance

    const processLoop = async (now: number) => {
      const video = videoRef.current;
      const img = imgRef.current;
      const canvas = canvasOverlayRef.current;
      const isVideoReady = video && video.readyState >= 2;
      const isImgReady = img && img.complete && img.naturalWidth > 0;
      const mediaSource = isVideoReady ? video : isImgReady ? img : null;

      if (mediaSource && canvas) {
        if (canvas.width !== mediaSource.clientWidth || canvas.height !== mediaSource.clientHeight) {
          canvas.width = mediaSource.clientWidth;
          canvas.height = mediaSource.clientHeight;
        }

        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.clearRect(0, 0, canvas.width, canvas.height);

          // Run face detection
          if ((isPlayingRef.current || currentSource.isImage) && now - lastScanTime > scanInterval) {
            lastScanTime = now;
            await runDetection(mediaSource);
          }

          // Draw Bounding Boxes and Landmarks on Canvas Overlay
          if (detectedFaces.length > 0) {
            const w = canvas.width;
            const h = canvas.height;
            const pulse = (Math.sin(now * 0.005) + 1) / 2;

            detectedFaces.forEach((face, idx) => {
              const bx = face.box.x * w;
              const by = face.box.y * h;
              const bw = face.box.width * w;
              const bh = face.box.height * h;
              const isSelected = activeFaceIndex === idx;

              // 1. Glowing Box Tint
              ctx.fillStyle = 'rgba(16, 185, 129, 0.08)';
              ctx.fillRect(bx, by, bw, bh);

              // 2. Corner Brackets
              const bracketLen = Math.min(bw, bh) * 0.28;
              ctx.save();
              ctx.lineWidth = isSelected ? 3.5 : 2.5;
              ctx.strokeStyle = pulse > 0.3 ? '#34d399' : '#10b981';
              ctx.shadowColor = 'rgba(52, 211, 153, 0.7)';
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
              ctx.restore();

              // 3. Top Banner with Confidence
              const bannerText = `YuNet: ${toPersianDigits(face.confidence.toFixed(1))}٪`;
              ctx.font = 'bold 11px JetBrains Mono, Vazirmatn, sans-serif';
              const textMetrics = ctx.measureText(bannerText);
              const bannerW = textMetrics.width + 14;
              const bannerH = 19;

              ctx.save();
              ctx.fillStyle = 'rgba(6, 78, 59, 0.95)';
              ctx.strokeStyle = '#34d399';
              ctx.lineWidth = 1;
              ctx.beginPath();
              ctx.roundRect(bx, by - bannerH - 2, bannerW, bannerH, 4);
              ctx.fill();
              ctx.stroke();
              ctx.restore();

              ctx.fillStyle = '#ffffff';
              ctx.textAlign = 'center';
              ctx.textBaseline = 'middle';
              ctx.fillText(bannerText, bx + bannerW / 2, by - bannerH / 2 - 2);

              // 4. Five Facial Landmarks (Eyes, Nose, Mouth Corners)
              if (settings.showLandmarks && face.landmarks) {
                const lx = (pt: { x: number; y: number }) => pt.x * w;
                const ly = (pt: { x: number; y: number }) => pt.y * h;

                const leftEye = { x: lx(face.landmarks.leftEye), y: ly(face.landmarks.leftEye) };
                const rightEye = { x: lx(face.landmarks.rightEye), y: ly(face.landmarks.rightEye) };
                const nose = { x: lx(face.landmarks.noseTip), y: ly(face.landmarks.noseTip) };
                const mouthL = face.landmarks.mouthLeft ? { x: lx(face.landmarks.mouthLeft), y: ly(face.landmarks.mouthLeft) } : null;
                const mouthR = face.landmarks.mouthRight ? { x: lx(face.landmarks.mouthRight), y: ly(face.landmarks.mouthRight) } : null;
                const mouthCenter = { x: lx(face.landmarks.mouthCenter), y: ly(face.landmarks.mouthCenter) };

                ctx.save();
                ctx.strokeStyle = 'rgba(52, 211, 153, 0.5)';
                ctx.lineWidth = 1;
                ctx.setLineDash([2, 2]);

                // Eye to Eye & Nose Triangle
                ctx.beginPath();
                ctx.moveTo(leftEye.x, leftEye.y);
                ctx.lineTo(rightEye.x, rightEye.y);
                ctx.lineTo(nose.x, nose.y);
                ctx.closePath();
                ctx.stroke();

                // Nose to Mouth
                if (mouthL && mouthR) {
                  ctx.beginPath();
                  ctx.moveTo(nose.x, nose.y);
                  ctx.lineTo(mouthL.x, mouthL.y);
                  ctx.lineTo(mouthR.x, mouthR.y);
                  ctx.closePath();
                  ctx.stroke();
                } else {
                  ctx.beginPath();
                  ctx.moveTo(nose.x, nose.y);
                  ctx.lineTo(mouthCenter.x, mouthCenter.y);
                  ctx.stroke();
                }

                ctx.setLineDash([]);

                // Landmark Nodes
                const drawDot = (pt: { x: number; y: number }, color: string) => {
                  ctx.fillStyle = color;
                  ctx.beginPath();
                  ctx.arc(pt.x, pt.y, 2.5, 0, Math.PI * 2);
                  ctx.fill();
                  ctx.strokeStyle = '#ffffff';
                  ctx.lineWidth = 0.8;
                  ctx.stroke();
                };

                drawDot(leftEye, '#34d399');
                drawDot(rightEye, '#34d399');
                drawDot(nose, '#10b981');
                if (mouthL && mouthR) {
                  drawDot(mouthL, '#059669');
                  drawDot(mouthR, '#059669');
                } else {
                  drawDot(mouthCenter, '#059669');
                }

                ctx.restore();
              }
            });
          }
        }
      }

      animationFrameId = requestAnimationFrame(processLoop);
    };

    animationFrameId = requestAnimationFrame(processLoop);
    return () => cancelAnimationFrame(animationFrameId);
  }, [detectedFaces, settings, currentSource, activeFaceIndex, runDetection]);

  // Video playback controls
  const handleTogglePlay = () => {
    const video = videoRef.current;
    if (!video) return;
    if (isPlaying) {
      video.pause();
      setIsPlaying(false);
    } else {
      video.play();
      setIsPlaying(true);
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const video = videoRef.current;
    if (!video) return;
    const time = Number(e.target.value);
    video.currentTime = time;
    setCurrentTime(time);
  };

  const handleStepFrame = (deltaSeconds: number) => {
    const video = videoRef.current;
    if (!video) return;
    video.pause();
    setIsPlaying(false);
    video.currentTime = Math.max(0, Math.min(video.duration, video.currentTime + deltaSeconds));
  };

  const handleSpeedChange = (speed: number) => {
    const video = videoRef.current;
    if (!video) return;
    video.playbackRate = speed;
    setPlaybackSpeed(speed);
  };

  // Canvas click to inspect face
  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasOverlayRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const clickX = (e.clientX - rect.left) / rect.width;
    const clickY = (e.clientY - rect.top) / rect.height;

    for (let i = 0; i < detectedFaces.length; i++) {
      const f = detectedFaces[i];
      if (
        clickX >= f.box.x &&
        clickX <= f.box.x + f.box.width &&
        clickY >= f.box.y &&
        clickY <= f.box.y + f.box.height
      ) {
        setActiveFaceIndex(i);
        const thumb = faceThumbnails[f.id];
        if (thumb) {
          onInspectFace(f, thumb);
        }
        return;
      }
    }
  };

  const isVideoMode = currentSource.type !== 'file' || !currentSource.isImage;

  return (
    <div className="space-y-4">
      {/* Top Source Bar & Algorithm Settings Trigger */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 flex flex-wrap items-center justify-between gap-3 shadow-md">
        {/* Source Switchers */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Live Webcam Button */}
          <button
            onClick={isWebcamActive ? stopWebcam : startWebcam}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all shadow-md active:scale-95 ${
              isWebcamActive
                ? 'bg-rose-600 hover:bg-rose-500 text-white shadow-rose-600/20 animate-pulse'
                : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-600/20'
            }`}
          >
            <Camera className="w-4 h-4" />
            <span>{isWebcamActive ? 'توقف وبکم زنده' : 'شروع وبکم زنده'}</span>
          </button>

          {/* Local File Upload Button */}
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium border border-slate-700 transition-colors shadow-sm"
          >
            <Upload className="w-4 h-4 text-cyan-400" />
            <span>بارگذاری ویدیو یا عکس</span>
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="video/*,image/*"
            className="hidden"
            onChange={(e) => {
              if (e.target.files && e.target.files[0]) {
                handleFileUpload(e.target.files[0]);
              }
            }}
          />

          {/* Preset Sample Videos Dropdown */}
          <div className="relative">
            <button
              onClick={() => setShowPresetsMenu(!showPresetsMenu)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium border border-slate-700 transition-colors"
            >
              <Film className="w-4 h-4 text-indigo-400" />
              <span>ویدیوهای نمونه تستی</span>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
            </button>

            {showPresetsMenu && (
              <div className="absolute top-full right-0 mt-2 w-72 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl p-2 z-40 space-y-1 backdrop-blur-md">
                <div className="text-[11px] font-bold text-slate-400 px-2 py-1 border-b border-slate-800">
                  انتخاب کلیپ تستی جهت ارزیابی YuNet:
                </div>
                {PRESET_TEST_VIDEOS.map((preset) => (
                  <button
                    key={preset.id}
                    onClick={() => handleSelectPreset(preset)}
                    className="w-full text-right p-2 rounded-lg hover:bg-slate-800 text-xs text-slate-300 transition-colors space-y-0.5 block"
                  >
                    <div className="font-semibold text-cyan-300">{preset.name}</div>
                    <div className="text-[10px] text-slate-400 leading-tight">{preset.desc}</div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right: Active Source Info & Algorithm Settings Button */}
        <div className="flex items-center gap-2.5">
          <div className="text-left font-mono text-xs hidden md:block">
            <span className="text-slate-400">منبع فعال: </span>
            <span className="text-cyan-300 font-semibold">{currentSource.name}</span>
          </div>

          <button
            onClick={() => setShowSettingsPanel(!showSettingsPanel)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-bold transition-all ${
              showSettingsPanel
                ? 'bg-emerald-600 text-white border-emerald-400 shadow-md shadow-emerald-600/20'
                : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700'
            }`}
          >
            <Sliders className="w-4 h-4 text-emerald-400" />
            <span>تنظیمات الگوریتم YuNet</span>
          </button>
        </div>
      </div>

      {/* YuNet Algorithm Tuning Card (Collapsible) */}
      {showSettingsPanel && (
        <div className="bg-slate-900/95 border border-emerald-500/40 rounded-2xl p-4 shadow-xl backdrop-blur-md animate-in fade-in space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2">
            <div className="flex items-center gap-2">
              <Crosshair className="w-4 h-4 text-emerald-400" />
              <span className="text-xs font-bold text-white">
                پارامترهای پردازشی شبکه عصبی OpenCV YuNet (FaceDetectorYN)
              </span>
            </div>
            <span className="text-[10px] font-mono text-emerald-400 bg-emerald-950 px-2 py-0.5 rounded border border-emerald-800 flex items-center gap-1">
              <WifiOff className="w-2.5 h-2.5" />
              بدون وابستگی به اینترنت
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
            {/* Confidence Slider */}
            <div className="space-y-1.5 bg-slate-950/60 p-3 rounded-xl border border-slate-800">
              <div className="flex justify-between">
                <span className="text-slate-300 font-semibold">حداقل اطمینان مدل (Confidence):</span>
                <span className="font-mono font-bold text-emerald-400">
                  {toPersianDigits(settings.confidenceThreshold)}٪
                </span>
              </div>
              <input
                type="range"
                min={30}
                max={90}
                step={1}
                value={settings.confidenceThreshold}
                onChange={(e) =>
                  setSettings((prev) => ({ ...prev, confidenceThreshold: Number(e.target.value) }))
                }
                className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-emerald-500"
              />
              <div className="flex justify-between text-[10px] text-slate-500">
                <span>۳۰٪ (حساس)</span>
                <span>۵۵٪ (توصیه‌شده)</span>
                <span>۹۰٪ (سخت‌گیر)</span>
              </div>
            </div>

            {/* NMS Threshold Slider */}
            <div className="space-y-1.5 bg-slate-950/60 p-3 rounded-xl border border-slate-800">
              <div className="flex justify-between">
                <span className="text-slate-300 font-semibold">آستانه حذف همپوشانی (NMS):</span>
                <span className="font-mono font-bold text-cyan-400">
                  {toPersianDigits(settings.nmsThreshold)}٪
                </span>
              </div>
              <input
                type="range"
                min={20}
                max={60}
                step={1}
                value={settings.nmsThreshold}
                onChange={(e) =>
                  setSettings((prev) => ({ ...prev, nmsThreshold: Number(e.target.value) }))
                }
                className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-500"
              />
              <div className="flex justify-between text-[10px] text-slate-500">
                <span>۲۰٪</span>
                <span>۳۵٪ (استاندارد)</span>
                <span>۶۰٪</span>
              </div>
            </div>

            {/* Landmarks Toggle */}
            <div className="flex items-center justify-between bg-slate-950/60 p-3 rounded-xl border border-slate-800">
              <div>
                <div className="text-slate-200 font-semibold">نمایش ۵ نقطه کلیدی:</div>
                <div className="text-[10px] text-slate-400 mt-0.5">چشم‌ها، نوک بینی و گوشه‌های لب</div>
              </div>
              <input
                type="checkbox"
                checked={settings.showLandmarks}
                onChange={(e) =>
                  setSettings((prev) => ({ ...prev, showLandmarks: e.target.checked }))
                }
                className="rounded bg-slate-800 border-slate-700 text-emerald-500 focus:ring-0 w-4 h-4 cursor-pointer"
              />
            </div>

            {/* EMA Smoothing Toggle */}
            <div className="flex items-center justify-between bg-slate-950/60 p-3 rounded-xl border border-slate-800">
              <div>
                <div className="text-slate-200 font-semibold">تثبیت لرزش کادر (EMA):</div>
                <div className="text-[10px] text-slate-400 mt-0.5">حرکت نرم کادر بین فریم‌های ویدیویی</div>
              </div>
              <input
                type="checkbox"
                checked={settings.enableSmoothing}
                onChange={(e) =>
                  setSettings((prev) => ({ ...prev, enableSmoothing: e.target.checked }))
                }
                className="rounded bg-slate-800 border-slate-700 text-emerald-500 focus:ring-0 w-4 h-4 cursor-pointer"
              />
            </div>
          </div>
        </div>
      )}

      {/* Main Grid: Media Canvas (Left/Center) & Active Faces Sidebar (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Viewport & Controls (8 Cols) */}
        <div className="lg:col-span-8 flex flex-col bg-slate-900 rounded-2xl border border-slate-800 overflow-hidden shadow-2xl">
          {/* Video / Image Display Area */}
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className="relative w-full aspect-video bg-black flex items-center justify-center overflow-hidden select-none"
          >
            {/* Drag & Drop Feedback Overlay */}
            {isDraggingOver && (
              <div className="absolute inset-0 bg-emerald-950/90 border-2 border-dashed border-emerald-400 z-30 flex flex-col items-center justify-center text-emerald-300">
                <Upload className="w-12 h-12 mb-2 animate-bounce" />
                <p className="text-sm font-bold">فایل ویدیو یا تصویر را رها کنید</p>
                <p className="text-xs text-emerald-400/80 mt-1">پردازش ۱۰۰٪ در مرورگر شما انجام خواهد شد</p>
              </div>
            )}

            {/* Media Rendering */}
            {currentSource.isImage && currentSource.url ? (
              <img
                ref={imgRef}
                src={currentSource.url}
                alt="Source"
                className="w-full h-full object-contain"
              />
            ) : (
              <video
                ref={videoRef}
                src={!isWebcamActive ? currentSource.url : undefined}
                playsInline
                autoPlay
                muted
                onTimeUpdate={() => {
                  if (videoRef.current) setCurrentTime(videoRef.current.currentTime);
                }}
                onLoadedMetadata={() => {
                  if (videoRef.current) {
                    setDuration(videoRef.current.duration);
                    setCurrentTime(videoRef.current.currentTime);
                  }
                }}
                onEnded={() => {
                  if (!isLooping) setIsPlaying(false);
                }}
                className="w-full h-full object-contain"
              />
            )}

            {/* Bounding Box & Landmark Canvas Overlay */}
            <canvas
              ref={canvasOverlayRef}
              onClick={handleCanvasClick}
              className="absolute inset-0 w-full h-full cursor-crosshair z-10"
            />

            {/* Laser Scan Effect */}
            <div className="absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-transparent via-emerald-400 to-transparent opacity-60 animate-pulse pointer-events-none z-10" />

            {/* Watermark badge on bottom left of video */}
            <div className="absolute bottom-2 left-2 z-20 flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-black/70 backdrop-blur-sm border border-emerald-500/30 text-[10px] font-mono text-emerald-400">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
              <span>YUNET 2023MAR • 640x640 WASM</span>
            </div>
          </div>

          {/* Forensic Video Scrubber Bar (Only when playing video) */}
          {isVideoMode && !isWebcamActive && (
            <div className="px-3 py-2 bg-slate-950 border-t border-slate-800 flex flex-col gap-1.5 font-mono z-20">
              <div className="flex items-center gap-2.5">
                <span className="text-[11px] text-emerald-400 font-mono w-12 text-left">
                  {formatSeconds(currentTime)}
                </span>
                <input
                  type="range"
                  min={0}
                  max={duration || 100}
                  step={0.04}
                  value={currentTime}
                  onChange={handleSeek}
                  className="flex-1 h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-emerald-400 hover:bg-slate-700 transition-colors"
                />
                <span className="text-[11px] text-slate-400 font-mono w-12 text-right">
                  {formatSeconds(duration)}
                </span>
              </div>

              {/* Sub controls: Stepper & Speed */}
              <div className="flex items-center justify-between flex-wrap gap-2 text-xs">
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] text-slate-500">حرکت فریم:</span>
                  <button
                    onClick={() => handleStepFrame(-0.04)}
                    className="flex items-center gap-1 px-2 py-0.5 rounded bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-700 text-[11px]"
                    title="یک فریم به عقب (-0.04 ثانیه)"
                  >
                    <SkipBack className="w-3 h-3 text-emerald-400" />
                    <span>۱- فریم</span>
                  </button>

                  <button
                    onClick={() => handleStepFrame(0.04)}
                    className="flex items-center gap-1 px-2 py-0.5 rounded bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-700 text-[11px]"
                    title="یک فریم به جلو (+0.04 ثانیه)"
                  >
                    <span>۱+ فریم</span>
                    <SkipForward className="w-3 h-3 text-emerald-400" />
                  </button>

                  <button
                    onClick={() => setIsLooping(!isLooping)}
                    className={`flex items-center gap-1 px-2 py-0.5 rounded border text-[11px] ${
                      isLooping
                        ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-300'
                        : 'bg-slate-900 border-slate-800 text-slate-500'
                    }`}
                  >
                    <Repeat className="w-3 h-3" />
                    <span>تکرار</span>
                  </button>
                </div>

                <div className="flex items-center gap-1">
                  <span className="text-[10px] text-slate-500">سرعت:</span>
                  {[0.25, 0.5, 1, 1.5, 2].map((spd) => (
                    <button
                      key={spd}
                      onClick={() => handleSpeedChange(spd)}
                      className={`px-1.5 py-0.5 rounded text-[10px] font-mono ${
                        playbackSpeed === spd
                          ? 'bg-emerald-600 text-white font-bold'
                          : 'bg-slate-900 hover:bg-slate-800 text-slate-400 border border-slate-800'
                      }`}
                    >
                      {spd}x
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Bottom Bar: Play/Pause and Summary */}
          <div className="p-3 bg-slate-900 border-t border-slate-800 flex items-center justify-between gap-3 z-20">
            <div className="flex items-center gap-2">
              {isVideoMode && !isWebcamActive && (
                <button
                  onClick={handleTogglePlay}
                  className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors"
                  title={isPlaying ? 'توقف موقت (Pause)' : 'پخش (Play)'}
                >
                  {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 text-emerald-400" />}
                </button>
              )}

              <div className="text-xs text-slate-300 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span>
                  تعداد چهره‌های فعال در تصویر:{' '}
                  <strong className="text-emerald-400 font-mono text-sm">{toPersianDigits(detectedFaces.length)}</strong>
                </span>
              </div>
            </div>

            <div className="text-[11px] text-slate-400 font-mono hidden sm:block">
              الگوریتم: OpenCV YuNet • ورودی BGR • استخراج ۵ لندمارک
            </div>
          </div>
        </div>

        {/* Active Faces & Results Sidebar (4 Cols) */}
        <div className="lg:col-span-4 flex flex-col gap-4">
          {/* Active Faces Card List */}
          <div className="bg-slate-900 rounded-2xl border border-slate-800 p-3.5 flex flex-col h-[340px] shadow-xl">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800 mb-2">
              <div className="flex items-center gap-2">
                <ScanFace className="w-4 h-4 text-emerald-400" />
                <h3 className="text-xs font-bold text-white">چهره‌های شناسایی‌شده در فریم</h3>
              </div>
              <span className="text-[10px] font-mono bg-emerald-500/10 text-emerald-400 px-2 py-0.5 rounded border border-emerald-500/30">
                {toPersianDigits(detectedFaces.length)} چهره
              </span>
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto space-y-2 pr-0.5">
              {detectedFaces.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center text-slate-500 border border-dashed border-slate-800 rounded-xl p-4 bg-slate-950/40">
                  <ScanFace className="w-8 h-8 text-slate-600 mb-2 animate-pulse" />
                  <p className="text-xs font-medium text-slate-400">هیچ چهره‌ای در این فریم دیده نشد</p>
                  <p className="text-[11px] text-slate-600 mt-1">
                    مدل YuNet پس‌زمینه، دیوار و اشیاء بی‌جان را حذف نموده و فقط چهره واقعی انسان را شناسایی می‌کند.
                  </p>
                </div>
              ) : (
                detectedFaces.map((face, idx) => {
                  const thumb = faceThumbnails[face.id] || face.snapshotUrl;
                  return (
                    <div
                      key={face.id}
                      className="group bg-slate-950 p-2.5 rounded-xl border border-slate-800 hover:border-emerald-500/40 transition-all flex items-center justify-between gap-3"
                    >
                      <div className="flex items-center gap-3">
                        {/* Cropped Face Thumbnail */}
                        <div
                          onClick={() => thumb && onInspectFace(face, thumb)}
                          className="relative w-14 h-14 rounded-lg border border-slate-700 group-hover:border-emerald-400 cursor-pointer overflow-hidden flex-shrink-0 bg-slate-900"
                          title="کلیک برای بزرگنمایی و بررسی جزئیات"
                        >
                          {thumb ? (
                            <img
                              src={thumb}
                              alt="Face"
                              className="w-full h-full object-cover transition-transform duration-200 group-hover:scale-110"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-slate-600">
                              <ScanFace className="w-6 h-6" />
                            </div>
                          )}
                          <div className="absolute inset-0 bg-emerald-950/30 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                            <Maximize2 className="w-3.5 h-3.5 text-emerald-300" />
                          </div>
                        </div>

                        {/* Metadata */}
                        <div className="space-y-0.5">
                          <div className="text-xs font-bold text-white flex items-center gap-1.5">
                            <span>چهره #{toPersianDigits(face.trackingId)}</span>
                          </div>
                          <div className="text-[11px] text-emerald-400 font-mono font-bold">
                            اطمینان: {toPersianDigits(face.confidence.toFixed(1))}٪
                          </div>
                          <div className="text-[10px] text-slate-500 font-mono">
                            ابعاد: {Math.round(face.box.width * 100)}٪ × {Math.round(face.box.height * 100)}٪
                          </div>
                        </div>
                      </div>

                      {/* Inspect Button */}
                      <button
                        onClick={() => thumb && onInspectFace(face, thumb)}
                        className="p-2 rounded-lg bg-slate-800 hover:bg-emerald-600 text-slate-300 hover:text-white transition-colors"
                        title="بررسی موشکافانه"
                      >
                        <Maximize2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Session History Gallery */}
          <div className="bg-slate-900 rounded-2xl border border-slate-800 p-3.5 flex flex-col flex-1 min-h-[220px] shadow-xl">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800 mb-2">
              <div className="flex items-center gap-1.5">
                <Layers className="w-4 h-4 text-cyan-400" />
                <h3 className="text-xs font-bold text-white">گالری چهره‌های ردیابی‌شده اخیر</h3>
              </div>

              {historyFaces.length > 0 && (
                <button
                  onClick={() => setHistoryFaces([])}
                  className="text-[10px] text-slate-500 hover:text-rose-400 transition-colors flex items-center gap-1"
                  title="پاک کردن گالری"
                >
                  <Trash2 className="w-3 h-3" />
                  <span>پاکسازی</span>
                </button>
              )}
            </div>

            <div className="flex-1 overflow-y-auto">
              {historyFaces.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-32 text-center text-slate-600 text-[11px]">
                  <span>هنوز چهره‌ای در این نشست ثبت نشده است.</span>
                </div>
              ) : (
                <div className="grid grid-cols-4 gap-2">
                  {historyFaces.map((item, i) => (
                    <div
                      key={i}
                      onClick={() => onInspectFace(item.face, item.thumbnail)}
                      className="group relative aspect-square rounded-lg border border-slate-800 hover:border-cyan-400 overflow-hidden cursor-pointer bg-slate-950 transition-all"
                      title={`چهره #${item.face.trackingId} - زمان: ${item.time}`}
                    >
                      <img
                        src={item.thumbnail}
                        alt="Face history"
                        className="w-full h-full object-cover group-hover:scale-110 transition-transform"
                      />
                      <div className="absolute bottom-0 inset-x-0 bg-slate-900/90 text-[8px] font-mono text-center text-cyan-300 py-0.5">
                        {toPersianDigits(item.face.confidence.toFixed(0))}٪
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
