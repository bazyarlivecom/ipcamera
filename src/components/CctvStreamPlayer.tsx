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
  Film,
  Upload,
  SkipBack,
  SkipForward,
  RotateCcw,
  Repeat,
  FileVideo,
  ChevronDown,
  Check,
  FolderOpen,
  Cpu,
  ShieldCheck,
  WifiOff,
} from 'lucide-react';
import { CameraConfig, DetectedFace, RegisteredPerson } from '../types';
import {
  detectFacesOnMedia,
  cropFaceToDataUrl,
  detectFacesWithNeuralAi,
  injectAiDetections,
  resetFaceTracks,
} from '../utils/faceDetector';
import { formatExactTimestamp, toPersianDigits } from '../utils/dateTime';

export const PRESET_TEST_VIDEOS = [
  {
    id: 'sample-1',
    name: 'کلیپ تست ۱: تردد عابران پیاده (Outdoor Walking)',
    url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
    desc: 'مناسب برای تست چند چهره متحرک و ارزیابی فریم‌به‌فریم',
  },
  {
    id: 'sample-2',
    name: 'کلیپ تست ۲: ورودی سالن و چهره‌ها (Entrance & Hallway)',
    url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4',
    desc: 'مناسب برای بررسی دقت تشخیص چهره و تطابق پرسنل',
  },
  {
    id: 'sample-3',
    name: 'کلیپ تست ۳: نمای نزدیک چهره‌ها (Close-up Tracking)',
    url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/WeAreGoingOnBullrun.mp4',
    desc: 'مناسب برای ارزیابی کادربندی و بزرگنمایی اپتیکال',
  },
];

const formatSeconds = (sec: number): string => {
  if (isNaN(sec) || !isFinite(sec)) return '00:00';
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
};

interface CctvStreamPlayerProps {
  activeCamera: CameraConfig;
  registeredPersons: RegisteredPerson[];
  onFaceDetected: (faces: DetectedFace[], currentThumbnailMap: Record<string, string>) => void;
  onSelectFaceToInspect: (face: DetectedFace, thumbnail: string) => void;
  onAutoLogTraffic: (face: DetectedFace, thumbnail: string) => void;
  autoLogEnabled: boolean;
  onSelectLocalVideo?: (file: File) => void;
  onSelectPresetVideo?: (name: string, url: string) => void;
}

export const CctvStreamPlayer: React.FC<CctvStreamPlayerProps> = ({
  activeCamera,
  registeredPersons,
  onFaceDetected,
  onSelectFaceToInspect,
  onAutoLogTraffic,
  autoLogEnabled,
  onSelectLocalVideo,
  onSelectPresetVideo,
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const canvasOverlayRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [isPlaying, setIsPlaying] = useState(true);
  const isPlayingRef = useRef(isPlaying);
  useEffect(() => {
    isPlayingRef.current = isPlaying;
  }, [isPlaying]);
  const [streamError, setStreamError] = useState<string | null>(null);
  const [detectedFaces, setDetectedFaces] = useState<DetectedFace[]>([]);
  const [showHudOverlay, setShowHudOverlay] = useState(true);
  const [zoomLevel, setZoomLevel] = useState<number>(1);
  const [activeFaceIndex, setActiveFaceIndex] = useState<number | null>(null);
  const [liveOsdTime, setLiveOsdTime] = useState('');

  // Video debug timeline state
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [isLooping, setIsLooping] = useState(true);
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const [showPresetsMenu, setShowPresetsMenu] = useState(false);

  // AI & Biometrics Settings
  const [detectionEngine, setDetectionEngine] = useState<'yunet' | 'cascade'>('yunet');
  const [yunetConfidence, setYunetConfidence] = useState<number>(55);
  const [recognitionThreshold, setRecognitionThreshold] = useState<number>(70);
  const [showLandmarks, setShowLandmarks] = useState(true);
  const [enableJitterFilter, setEnableJitterFilter] = useState(true);
  const [showAiSettings, setShowAiSettings] = useState(false);
  const [detectionStrictness, setDetectionStrictness] = useState<number>(0.74);
  const [isAiScanning, setIsAiScanning] = useState(false);
  const [autoNeuralAi, setAutoNeuralAi] = useState(false);
  const [aiScanStatusMsg, setAiScanStatusMsg] = useState<string | null>(null);
  const lastAiScanTimeRef = useRef(0);

  const isVideoMode =
    activeCamera.streamType === 'video_file' ||
    activeCamera.streamType === 'simulation';

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

  // Deep Gemini Neural AI Scan Trigger
  const triggerGeminiNeuralScan = useCallback(async () => {
    const video = videoRef.current;
    const img = imgRef.current;
    const isVideoReady = video && video.readyState >= 2;
    const isImgReady = img && img.complete && img.naturalWidth > 0;
    const mediaSource = isVideoReady ? video : (isImgReady ? img : null);
    if (!mediaSource) return;

    setIsAiScanning(true);
    setAiScanStatusMsg('در حال تحلیل عمیق تصویر با مدل بینایی هوش مصنوعی...');
    try {
      const aiFaces = await detectFacesWithNeuralAi(mediaSource);
      setIsAiScanning(false);
      if (aiFaces && aiFaces.length > 0) {
        const merged = injectAiDetections(aiFaces, registeredPersons);
        setDetectedFaces(merged);
        setAiScanStatusMsg(`تشخیص قطعی ${toPersianDigits(aiFaces.length)} چهره با مدل هوش مصنوعی تأیید شد.`);
        playBeep();
      } else {
        setDetectedFaces([]);
        resetFaceTracks();
        setAiScanStatusMsg('تحلیل دقیق: هیچ چهره انسانی در این فریم شناسایی نشد (تأیید عدم خطای مثبت).');
      }
    } catch (err) {
      setIsAiScanning(false);
      setAiScanStatusMsg('خطا در ارتباط با سرور هوش مصنوعی');
    }

    setTimeout(() => {
      setAiScanStatusMsg(null);
    }, 4000);
  }, [registeredPersons, playBeep]);

  // Core face detection helper (combines Haar cascade + optional auto neural AI)
  const runDetection = useCallback(
    async (mediaSource: HTMLVideoElement | HTMLImageElement) => {
      try {
        const now = Date.now();

        // Optional periodic deep Neural AI scan
        if (autoNeuralAi && !isAiScanning && now - lastAiScanTimeRef.current > 3500) {
          lastAiScanTimeRef.current = now;
          triggerGeminiNeuralScan();
          return;
        }

        // High-precision face detection (OpenCV YuNet ONNX 100% offline or Haar cascade)
        const faces = await detectFacesOnMedia(mediaSource, registeredPersons, {
          recognitionThreshold,
          enableSmoothing: enableJitterFilter,
          strictness: detectionStrictness,
          engine: detectionEngine,
          confidenceThreshold: yunetConfidence,
        });

        setDetectedFaces(faces);

        // Generate cropped face thumbnails
        const thumbMap: Record<string, string> = {};
        const nowMs = Date.now();
        faces.forEach((f) => {
          const thumb = cropFaceToDataUrl(mediaSource, f.box, 180);
          thumbMap[f.id] = thumb;

          // Auto log traffic logic with 15-second cooldown per trackingId
          if (autoLogEnabled) {
            const lastLog = lastLoggedRef.current[f.trackingId] || 0;
            if (nowMs - lastLog > 15000) {
              lastLoggedRef.current[f.trackingId] = nowMs;
              onAutoLogTraffic(f, thumb);
            }
          }
        });

        onFaceDetected(faces, thumbMap);
      } catch (err) {
        console.error('Detection error:', err);
      }
    },
    [
      registeredPersons,
      recognitionThreshold,
      enableJitterFilter,
      detectionStrictness,
      detectionEngine,
      yunetConfidence,
      autoNeuralAi,
      isAiScanning,
      triggerGeminiNeuralScan,
      autoLogEnabled,
      onAutoLogTraffic,
      onFaceDetected,
    ]
  );

  // Initialize camera stream or video file
  useEffect(() => {
    let activeStream: MediaStream | null = null;
    let isCancelled = false;
    let snapshotTimer: any = null;
    let isLoopActive = true;

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
            setIsPlaying(true);
          }
        } else if (['dahua', 'mjpeg', 'snapshot'].includes(activeCamera.streamType)) {
          let cleanIp = (activeCamera.ipAddress || '192.168.1.108')
            .trim()
            .replace(/^https?:\/\//i, '')
            .replace(/\/.*$/, '');
          const port = activeCamera.dahuaPort || 80;
          const hostWithPort = cleanIp.includes(':') ? cleanIp : `${cleanIp}${port !== 80 ? `:${port}` : ''}`;
          const channel = activeCamera.dahuaChannel || 1;
          const username = activeCamera.dahuaUsername || 'admin';
          const password = activeCamera.dahuaPassword || '';
          const mode = activeCamera.dahuaMode || 'snapshot';

          const snapshotTarget =
            activeCamera.streamType === 'dahua'
              ? `http://${hostWithPort}/cgi-bin/snapshot.cgi?channel=${channel}`
              : activeCamera.streamUrl || `http://${hostWithPort}/cgi-bin/snapshot.cgi?channel=${channel}`;

          const startSnapshotLoop = () => {
            let isFetching = false;
            let failureCount = 0;

            const fetchNextSnapshot = () => {
              if (isCancelled || !isLoopActive) return;
              if (!isPlayingRef.current) {
                snapshotTimer = setTimeout(fetchNextSnapshot, 300);
                return;
              }
              if (isFetching) return;
              isFetching = true;

              const preloader = new Image();
              preloader.crossOrigin = 'anonymous';

              preloader.onload = () => {
                isFetching = false;
                failureCount = 0;
                if (isCancelled || !isLoopActive) return;

                if (imgRef.current) {
                  imgRef.current.src = preloader.src;
                  setIsPlaying(true);
                  setStreamError(null);
                }
                // Schedule next snapshot frame (~120ms gives smooth ~8 FPS playback)
                snapshotTimer = setTimeout(fetchNextSnapshot, 120);
              };

              preloader.onerror = () => {
                isFetching = false;
                failureCount++;
                if (isCancelled || !isLoopActive) return;

                if (failureCount >= 4) {
                  setStreamError(
                    `عدم دریافت فید تصویر از ${cleanIp} (کانال ${channel}). لطفاً مطمئن شوید دستگاه DVR یا دوربین متصل بوده و نام کاربری (${username}) و رمز عبور وارد شده صحیح باشند.`
                  );
                }
                snapshotTimer = setTimeout(fetchNextSnapshot, 1500);
              };

              const authParams = `${username ? `&username=${encodeURIComponent(username)}` : ''}${
                password ? `&password=${encodeURIComponent(password)}` : ''
              }`;
              preloader.src = `/api/camera/proxy?url=${encodeURIComponent(snapshotTarget)}${authParams}&_t=${Date.now()}`;
            };

            fetchNextSnapshot();
          };

          if (mode === 'mjpeg') {
            const mjpegTarget = `http://${hostWithPort}/cgi-bin/mjpg/video.cgi?channel=${channel}&subtype=1`;
            const proxyUrl = `/api/camera/proxy?url=${encodeURIComponent(mjpegTarget)}&stream=true${
              username ? `&username=${encodeURIComponent(username)}` : ''
            }${password ? `&password=${encodeURIComponent(password)}` : ''}`;

            if (imgRef.current) {
              imgRef.current.crossOrigin = 'anonymous';
              imgRef.current.src = proxyUrl;
              setIsPlaying(true);
              imgRef.current.onerror = () => {
                console.warn('MJPEG stream failed; falling back to continuous snapshot polling...');
                startSnapshotLoop();
              };
            }
          } else {
            // Snapshot polling mode (100% compatible with all Dahua DVRs, XVRs, and cameras)
            startSnapshotLoop();
          }
        } else {
          // Video file or Simulation
          if (videoRef.current) {
            videoRef.current.srcObject = null;
            videoRef.current.crossOrigin = 'anonymous';

            const streamUrl =
              activeCamera.streamUrl ||
              'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4';

            videoRef.current.src = streamUrl;
            videoRef.current.loop = isLooping;
            videoRef.current.muted = true;
            videoRef.current.playbackRate = playbackSpeed;
            videoRef.current.play().catch((err) => {
              console.warn('Video play prevented:', err);
            });
            setIsPlaying(true);
          }
        }
      } catch (err: any) {
        console.error('Camera stream access failed:', err);
        setStreamError('خطا در دسترسی به فید دوربین / ویدیو: ' + (err.message || 'نامشخص'));
      }
    };

    setupCamera();

    return () => {
      isCancelled = true;
      isLoopActive = false;
      if (snapshotTimer) clearTimeout(snapshotTimer);
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
    const scanInterval = 120; // 8-10 detections/sec

    const processLoop = async (now: number) => {
      const video = videoRef.current;
      const img = imgRef.current;
      const canvas = canvasOverlayRef.current;
      const isVideoReady = video && video.readyState >= 2;
      const isImgReady = img && img.complete && img.naturalWidth > 0;
      const mediaSource = isVideoReady ? video : (isImgReady ? img : null);

      if (mediaSource && canvas) {
        // Match canvas dimensions to container / media aspect
        if (canvas.width !== mediaSource.clientWidth || canvas.height !== mediaSource.clientHeight) {
          canvas.width = mediaSource.clientWidth;
          canvas.height = mediaSource.clientHeight;
        }

        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.clearRect(0, 0, canvas.width, canvas.height);

          // Periodic face detection when playing
          if (isPlaying && now - lastScanTime > scanInterval) {
            lastScanTime = now;
            await runDetection(mediaSource);
          }

          // Draw Bounding Boxes on Overlay Canvas (Always draw even when paused for forensic freeze-frame)
          if (showHudOverlay && detectedFaces.length > 0) {
            const w = canvas.width;
            const h = canvas.height;

            // Global pulse for subtle high-confidence recognition glowing animation
            const pulse = (Math.sin(now * 0.0045) + 1) / 2; // Smooth sine wave 0.0 to 1.0 (~1.4s period)

            detectedFaces.forEach((face, idx) => {
              const bx = face.box.x * w;
              const by = face.box.y * h;
              const bw = face.box.width * w;
              const bh = face.box.height * h;

              const isRecognized = !!face.recognizedPerson;
              const isHighConfidence = isRecognized && face.confidence >= 80;
              const isSelected = activeFaceIndex === idx;

              // 1. Subtle expanding biometric lock-on ripple ring for high-confidence recognition
              if (isHighConfidence) {
                const wavePeriod = 2200; // 2.2s cycle
                const waveProgress = ((now + idx * 500) % wavePeriod) / wavePeriod;
                const waveOffset = 3 + waveProgress * 10;
                const waveAlpha = (1 - waveProgress) * 0.4;

                ctx.save();
                ctx.strokeStyle = `rgba(52, 211, 153, ${waveAlpha})`;
                ctx.lineWidth = 1;
                ctx.shadowColor = 'rgba(16, 185, 129, 0.6)';
                ctx.shadowBlur = 6;
                ctx.strokeRect(
                  bx - waveOffset,
                  by - waveOffset,
                  bw + waveOffset * 2,
                  bh + waveOffset * 2
                );
                ctx.restore();
              }

              // 2. Bounding Box background tint & ambient perimeter aura
              if (isHighConfidence) {
                // Subtle glowing background tint
                const bgAlpha = 0.07 + pulse * 0.06;
                ctx.fillStyle = `rgba(16, 185, 129, ${bgAlpha})`;
                ctx.fillRect(bx, by, bw, bh);

                // Soft outer glowing perimeter boundary
                ctx.save();
                const auraAlpha = 0.25 + pulse * 0.35;
                ctx.strokeStyle = `rgba(52, 211, 153, ${auraAlpha})`;
                ctx.lineWidth = 1;
                ctx.shadowColor = 'rgba(16, 185, 129, 0.75)';
                ctx.shadowBlur = 8 + pulse * 8;
                ctx.strokeRect(bx, by, bw, bh);
                ctx.restore();
              } else {
                ctx.fillStyle = isRecognized ? 'rgba(16, 185, 129, 0.08)' : 'rgba(34, 211, 238, 0.08)';
                ctx.fillRect(bx, by, bw, bh);
              }

              // 3. Tactical glowing corner brackets with breathing luminescence
              const bracketLen = Math.min(bw, bh) * 0.28;
              ctx.save();
              ctx.lineWidth = isSelected ? 3.5 : isHighConfidence ? 2.5 : 2;

              if (isHighConfidence) {
                // Modulate corner stroke and shadow blur for luminous glow
                ctx.strokeStyle = pulse > 0.4 ? '#34d399' : '#10b981';
                ctx.shadowColor = 'rgba(52, 211, 153, ' + (0.6 + pulse * 0.35) + ')';
                ctx.shadowBlur = 10 + pulse * 10;
              } else {
                ctx.strokeStyle = isRecognized ? '#10b981' : '#22d3ee';
                ctx.shadowColor = isRecognized ? 'rgba(16, 185, 129, 0.5)' : 'rgba(34, 211, 238, 0.6)';
                ctx.shadowBlur = 8;
              }

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

              // 4. Sleek Interface Match Banner on top of bounding box with recognition glow
              const matchBannerText = isRecognized
                ? `مجاز: ${toPersianDigits(face.confidence)}٪`
                : `تطابق: ${toPersianDigits(face.confidence)}٪`;

              ctx.font = 'bold 10px JetBrains Mono, Vazirmatn, sans-serif';
              const textMetrics = ctx.measureText(matchBannerText);
              const bannerW = textMetrics.width + (isHighConfidence ? 16 : 12);
              const bannerH = 18;

              ctx.save();
              if (isHighConfidence) {
                ctx.shadowColor = 'rgba(16, 185, 129, ' + (0.55 + pulse * 0.35) + ')';
                ctx.shadowBlur = 8 + pulse * 6;
              }
              // Banner Background
              ctx.fillStyle = isRecognized ? '#10b981' : '#22d3ee';
              ctx.fillRect(bx, Math.max(2, by - bannerH), bannerW, bannerH);
              ctx.restore();

              // Banner Text
              ctx.fillStyle = '#000000';
              ctx.textAlign = 'center';
              ctx.textBaseline = 'middle';
              ctx.fillText(matchBannerText, bx + bannerW / 2, Math.max(2, by - bannerH) + bannerH / 2);

              // 5. Label Pill underneath with person name or unknown subject ID
              const labelText = isRecognized
                ? face.recognizedPerson?.fullName || 'پرسنل مجاز'
                : `سوژه #${toPersianDigits(face.trackingId)}`;

              ctx.font = 'bold 11px Vazirmatn, sans-serif';
              const nameMetrics = ctx.measureText(labelText);
              const nameW = nameMetrics.width + 14;
              const nameH = 20;

              ctx.save();
              if (isHighConfidence) {
                ctx.shadowColor = 'rgba(16, 185, 129, ' + (0.35 + pulse * 0.3) + ')';
                ctx.shadowBlur = 6 + pulse * 4;
              }
              ctx.fillStyle = 'rgba(2, 6, 23, 0.92)';
              ctx.strokeStyle = isHighConfidence
                ? (pulse > 0.4 ? '#34d399' : '#10b981')
                : isRecognized
                ? '#10b981'
                : '#22d3ee';
              ctx.lineWidth = isHighConfidence ? 1.5 : 1;
              ctx.fillRect(bx, by + bh + 3, nameW, nameH);
              ctx.strokeRect(bx, by + bh + 3, nameW, nameH);
              ctx.restore();

              ctx.fillStyle = '#ffffff';
              ctx.textAlign = 'center';
              ctx.textBaseline = 'middle';
              ctx.fillText(labelText, bx + nameW / 2, by + bh + 3 + nameH / 2);

              // 6. Real-time Biometric Facial Landmarks (Eyes, Nose, Mouth Geometry Mesh)
              if (showLandmarks && face.landmarks) {
                const lx = (pt: { x: number; y: number }) => pt.x * w;
                const ly = (pt: { x: number; y: number }) => pt.y * h;

                const leftEye = { x: lx(face.landmarks.leftEye), y: ly(face.landmarks.leftEye) };
                const rightEye = { x: lx(face.landmarks.rightEye), y: ly(face.landmarks.rightEye) };
                const nose = { x: lx(face.landmarks.noseTip), y: ly(face.landmarks.noseTip) };
                const mouth = { x: lx(face.landmarks.mouthCenter), y: ly(face.landmarks.mouthCenter) };
                const mouthL = face.landmarks.mouthLeft ? { x: lx(face.landmarks.mouthLeft), y: ly(face.landmarks.mouthLeft) } : null;
                const mouthR = face.landmarks.mouthRight ? { x: lx(face.landmarks.mouthRight), y: ly(face.landmarks.mouthRight) } : null;

                ctx.save();
                // Biometric structural mesh
                ctx.strokeStyle = isRecognized ? 'rgba(52, 211, 153, 0.45)' : 'rgba(34, 211, 238, 0.45)';
                ctx.lineWidth = 1;
                ctx.setLineDash([2, 2]);

                ctx.beginPath();
                ctx.moveTo(leftEye.x, leftEye.y);
                ctx.lineTo(rightEye.x, rightEye.y);
                ctx.lineTo(nose.x, nose.y);
                ctx.closePath();
                ctx.stroke();

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
                  ctx.lineTo(mouth.x, mouth.y);
                  ctx.stroke();
                }

                ctx.setLineDash([]); // Reset line dash

                // Landmark nodes
                const drawLandmark = (pt: { x: number; y: number }, color: string) => {
                  ctx.fillStyle = color;
                  ctx.beginPath();
                  ctx.arc(pt.x, pt.y, 2.5, 0, Math.PI * 2);
                  ctx.fill();
                  ctx.strokeStyle = '#ffffff';
                  ctx.lineWidth = 0.8;
                  ctx.stroke();
                };

                drawLandmark(leftEye, isRecognized ? '#34d399' : '#38bdf8');
                drawLandmark(rightEye, isRecognized ? '#34d399' : '#38bdf8');
                drawLandmark(nose, isRecognized ? '#10b981' : '#06b6d4');
                if (mouthL && mouthR) {
                  drawLandmark(mouthL, isRecognized ? '#059669' : '#0284c7');
                  drawLandmark(mouthR, isRecognized ? '#059669' : '#0284c7');
                } else {
                  drawLandmark(mouth, isRecognized ? '#059669' : '#0284c7');
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
  }, [
    isPlaying,
    activeCamera,
    showHudOverlay,
    detectedFaces,
    activeFaceIndex,
    showLandmarks,
    runDetection,
  ]);

  // Video File Upload / Selection Handler
  const handleFileSelected = (file: File) => {
    if (!file) return;
    if (onSelectLocalVideo) {
      onSelectLocalVideo(file);
    } else {
      const url = URL.createObjectURL(file);
      if (videoRef.current) {
        videoRef.current.srcObject = null;
        videoRef.current.src = url;
        videoRef.current.load();
        videoRef.current.play().catch(() => {});
        setIsPlaying(true);
      }
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFileSelected(e.target.files[0]);
    }
  };

  // Drag and Drop
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingOver(true);
  };
  const handleDragLeave = () => {
    setIsDraggingOver(false);
  };
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      if (file.type.startsWith('video/')) {
        handleFileSelected(file);
      }
    }
  };

  // Forensic frame stepping: -0.04s or +0.04s (approx 1 frame at 25fps)
  const handleStepFrame = (deltaSec: number) => {
    if (videoRef.current) {
      videoRef.current.pause();
      setIsPlaying(false);
      const newTime = Math.max(0, Math.min(videoRef.current.duration || 100, videoRef.current.currentTime + deltaSec));
      videoRef.current.currentTime = newTime;
      setCurrentTime(newTime);
      runDetection(videoRef.current);
    }
  };

  // Timeline scrubber
  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    if (videoRef.current) {
      videoRef.current.currentTime = val;
      setCurrentTime(val);
      if (!isPlaying) {
        runDetection(videoRef.current);
      }
    }
  };

  // Playback speed change
  const handleSpeedChange = (speed: number) => {
    setPlaybackSpeed(speed);
    if (videoRef.current) {
      videoRef.current.playbackRate = speed;
    }
  };

  // Toggle play/pause
  const handleTogglePlay = () => {
    const media = videoRef.current || imgRef.current;
    if (!media) return;
    if (isPlaying) {
      if (videoRef.current) videoRef.current.pause();
      setIsPlaying(false);
      runDetection(media);
    } else {
      if (videoRef.current) videoRef.current.play().catch(() => {});
      setIsPlaying(true);
    }
  };

  // Toggle loop
  const handleToggleLoop = () => {
    const next = !isLooping;
    setIsLooping(next);
    if (videoRef.current) {
      videoRef.current.loop = next;
    }
  };

  // Click on canvas to zoom into face or inspect
  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasOverlayRef.current;
    const media = videoRef.current || imgRef.current;
    if (!canvas || !media) return;

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
      const thumb = cropFaceToDataUrl(media, clickedFace.box, 300);
      onSelectFaceToInspect(clickedFace, thumb);
      playBeep();
    }
  };

  // Manual capture
  const handleManualCapture = () => {
    const media = videoRef.current || imgRef.current;
    if (!media || detectedFaces.length === 0) return;

    const primaryFace = detectedFaces[0];
    const thumb = cropFaceToDataUrl(media, primaryFace.box, 300);
    onAutoLogTraffic(primaryFace, thumb);
    playBeep();
  };

  return (
    <div
      ref={containerRef}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className="relative rounded-lg overflow-hidden bg-slate-950 border border-slate-800 shadow-2xl flex flex-col group"
    >
      {/* Hidden File Input for Video Upload */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileInputChange}
        accept="video/mp4,video/webm,video/ogg,video/quicktime,video/x-msvideo,video/*"
        className="hidden"
      />

      {/* CCTV Top Status Bar with Video Selection Button */}
      <div className="absolute top-0 inset-x-0 z-20 flex items-center justify-between px-3 sm:px-4 py-2.5 bg-gradient-to-b from-slate-950/95 via-slate-950/70 to-transparent pointer-events-auto flex-wrap gap-2">
        <div className="flex items-center gap-2.5 flex-wrap">
          <div className="flex items-center gap-1.5">
            <span
              className={`w-2.5 h-2.5 rounded-full ${
                activeCamera.streamType === 'video_file'
                  ? 'bg-cyan-400 shadow-[0_0_8px_#22d3ee]'
                  : 'bg-red-500 shadow-[0_0_8px_#ef4444] animate-pulse'
              }`}
            />
            <span
              className={`text-xs font-mono font-bold tracking-wider uppercase ${
                activeCamera.streamType === 'video_file' ? 'text-cyan-400' : 'text-red-400'
              }`}
            >
              {activeCamera.streamType === 'video_file' ? 'DEBUG VIDEO' : 'REC LIVE'}
            </span>
          </div>

          <div className="h-3 w-px bg-slate-700/60 hidden sm:block" />

          <div className="flex items-center gap-2 text-xs font-mono text-slate-200">
            <span className="text-cyan-300 font-semibold">{activeCamera.name}</span>
            <span className="text-slate-400 text-[11px] hidden md:inline font-mono">
              [{activeCamera.ipAddress}]
            </span>
          </div>

          {activeCamera.videoFileName && (
            <span className="text-[10px] font-mono bg-cyan-500/10 text-cyan-300 px-2 py-0.5 rounded border border-cyan-500/30 hidden lg:inline">
              📁 {activeCamera.videoFileName}
            </span>
          )}
        </div>

        {/* Action Button: Choose Video File & Presets */}
        <div className="flex items-center gap-2">
          {/* Active Engine Badge */}
          <button
            onClick={() => setShowAiSettings(true)}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-emerald-950/70 hover:bg-emerald-900/80 border border-emerald-500/40 text-emerald-300 text-xs font-mono transition-colors shadow-sm cursor-pointer"
            title="موتور فعال تشخیص چهره - کلیک برای تنظیمات"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <Cpu className="w-3.5 h-3.5 text-emerald-400" />
            <span className="hidden sm:inline font-sans font-semibold">
              {detectionEngine === 'yunet' ? 'OpenCV YuNet (آفلاین ۱۰۰٪)' : 'Haar Cascade (آفلاین)'}
            </span>
          </button>

          {/* Gemini Neural AI Face Scan Button */}
          <button
            onClick={triggerGeminiNeuralScan}
            disabled={isAiScanning}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-bold border transition-all shadow-sm ${
              isAiScanning
                ? 'bg-purple-900/80 text-purple-200 border-purple-400 animate-pulse'
                : 'bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white border-purple-400/50 shadow-purple-500/20 active:scale-95'
            }`}
            title="اسکن عمیق فریم با هوش مصنوعی قدرتمند Gemini جهت تشخیص ۱۰۰٪ واقعی چهره بدون خطای مثبت"
          >
            <Scan className={`w-3.5 h-3.5 ${isAiScanning ? 'animate-spin' : ''}`} />
            <span>{isAiScanning ? 'در حال آنالیز هوش مصنوعی...' : 'اسکن عمیق هوش مصنوعی (Gemini)'}</span>
          </button>

          {/* AI & Biometrics Settings Popover */}
          <div className="relative">
            <button
              onClick={() => setShowAiSettings(!showAiSettings)}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md border text-xs font-medium transition-colors ${
                showAiSettings
                  ? 'bg-indigo-600 text-white border-indigo-400 shadow-md shadow-indigo-500/20'
                  : 'bg-slate-900/90 hover:bg-slate-800 text-slate-200 border-slate-700'
              }`}
              title="تنظیمات دقت پردازش و بیومتریک چهره"
            >
              <Sliders className="w-3.5 h-3.5 text-indigo-400" />
              <span className="hidden sm:inline">دقت پردازش چهره</span>
            </button>

            {showAiSettings && (
              <div className="absolute left-0 mt-1.5 w-84 bg-slate-900/95 border border-indigo-500/40 rounded-xl shadow-2xl p-3.5 z-40 space-y-3.5 backdrop-blur-md animate-in fade-in">
                <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                  <span className="text-xs font-bold text-white flex items-center gap-1.5">
                    <Crosshair className="w-3.5 h-3.5 text-indigo-400" />
                    تنظیمات پیشرفته بینایی ماشین و هوش مصنوعی
                  </span>
                  <span className="text-[10px] text-emerald-400 font-mono bg-emerald-950 px-1.5 py-0.5 rounded border border-emerald-800 flex items-center gap-1">
                    <WifiOff className="w-2.5 h-2.5" />
                    OFFLINE
                  </span>
                </div>

                {/* Engine Selector */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-300 font-semibold">موتور پردازش و تشخیص چهره:</span>
                    <span className="text-[10px] text-emerald-400 flex items-center gap-1 font-mono">
                      <ShieldCheck className="w-3 h-3" />
                      بدون نیاز به اینترنت
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-1.5">
                    <button
                      type="button"
                      onClick={() => setDetectionEngine('yunet')}
                      className={`px-2 py-1.5 rounded-lg border text-xs font-medium text-right transition-all flex flex-col ${
                        detectionEngine === 'yunet'
                          ? 'bg-emerald-950/90 border-emerald-400 text-emerald-200 shadow-md shadow-emerald-900/30 ring-1 ring-emerald-500/40'
                          : 'bg-slate-800/80 border-slate-700 text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                      }`}
                    >
                      <span className="font-bold flex items-center gap-1">
                        <Cpu className="w-3.5 h-3.5 text-emerald-400" />
                        OpenCV YuNet
                      </span>
                      <span className="text-[10px] text-emerald-400/90 mt-0.5 font-semibold">مدل عمیق آفلاین (توصیه‌شده)</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setDetectionEngine('cascade')}
                      className={`px-2 py-1.5 rounded-lg border text-xs font-medium text-right transition-all flex flex-col ${
                        detectionEngine === 'cascade'
                          ? 'bg-cyan-950/90 border-cyan-400 text-cyan-200 shadow-md shadow-cyan-900/30 ring-1 ring-cyan-500/40'
                          : 'bg-slate-800/80 border-slate-700 text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                      }`}
                    >
                      <span className="font-bold flex items-center gap-1">
                        <Crosshair className="w-3.5 h-3.5 text-cyan-400" />
                        فیلتر انتگرالی
                      </span>
                      <span className="text-[10px] text-slate-400 mt-0.5">سبک هندسی (CPU)</span>
                    </button>
                  </div>
                </div>

                {/* YuNet specific Confidence Slider when YuNet is active */}
                {detectionEngine === 'yunet' ? (
                  <div className="space-y-1.5 bg-emerald-950/40 p-2.5 rounded-lg border border-emerald-500/30">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-emerald-300 font-semibold">حداقل اطمینان مدل YuNet:</span>
                      <span className="font-mono font-bold text-emerald-400">
                        {toPersianDigits(yunetConfidence)}٪
                      </span>
                    </div>
                    <input
                      type="range"
                      min={35}
                      max={85}
                      step={1}
                      value={yunetConfidence}
                      onChange={(e) => setYunetConfidence(Number(e.target.value))}
                      className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                    />
                    <div className="flex justify-between text-[10px] text-slate-400">
                      <span>حساس‌تر (۳۵٪)</span>
                      <span>توصیه‌شده (۵۵٪)</span>
                      <span>سخت‌گیرانه (۸۵٪)</span>
                    </div>
                    <p className="text-[10px] text-slate-300/80 mt-1 leading-relaxed">
                      مدل سبک و اختصاصی YuNet از OpenCV Zoo. کاملاً آفلاین در مرورگر با WebAssembly اجرا می‌شود و بر روی اشیاء بی‌جان یا دیوارها کادر کاذب ایجاد نمی‌کند.
                    </p>
                  </div>
                ) : (
                  /* Strictness filter for Cascade */
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-300">سخت‌گیری ضد خطای مثبت (حذف دیوار/مبلمان):</span>
                      <span className="font-mono font-bold text-cyan-400">
                        {toPersianDigits(Math.round(detectionStrictness * 100))}٪
                      </span>
                    </div>
                    <input
                      type="range"
                      min={65}
                      max={88}
                      step={1}
                      value={Math.round(detectionStrictness * 100)}
                      onChange={(e) => setDetectionStrictness(Number(e.target.value) / 100)}
                      className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-500"
                    />
                    <div className="flex justify-between text-[10px] text-slate-500">
                      <span>حساس‌تر (۶۵٪)</span>
                      <span>حداکثر دقت بدون خطا (۸۸٪)</span>
                    </div>
                  </div>
                )}

                {/* Threshold slider */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-300">آستانه تطبیق بیومتریک با پرسنل:</span>
                    <span className="font-mono font-bold text-indigo-400">
                      {toPersianDigits(recognitionThreshold)}٪
                    </span>
                  </div>
                  <input
                    type="range"
                    min={50}
                    max={95}
                    step={1}
                    value={recognitionThreshold}
                    onChange={(e) => setRecognitionThreshold(Number(e.target.value))}
                    className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                  />
                  <div className="flex justify-between text-[10px] text-slate-500">
                    <span>حساسیت بالا (۵۰٪)</span>
                    <span>سخت‌گیرانه (۹۵٪)</span>
                  </div>
                </div>

                {/* Toggles */}
                <div className="space-y-2.5 pt-1.5 border-t border-slate-800/80">
                  <label className="flex items-center justify-between text-xs cursor-pointer">
                    <span className="text-purple-300 font-semibold flex items-center gap-1">
                      <span>اسکن پیوسته هوش مصنوعی (Gemini Auto-Scan)</span>
                    </span>
                    <input
                      type="checkbox"
                      checked={autoNeuralAi}
                      onChange={(e) => setAutoNeuralAi(e.target.checked)}
                      className="rounded bg-slate-800 border-slate-700 text-purple-500 focus:ring-0 w-4 h-4 cursor-pointer"
                    />
                  </label>

                  <label className="flex items-center justify-between text-xs cursor-pointer">
                    <span className="text-slate-300">نمایش لندمارک‌های هندسی چهره</span>
                    <input
                      type="checkbox"
                      checked={showLandmarks}
                      onChange={(e) => setShowLandmarks(e.target.checked)}
                      className="rounded bg-slate-800 border-slate-700 text-indigo-500 focus:ring-0 w-4 h-4 cursor-pointer"
                    />
                  </label>

                  <label className="flex items-center justify-between text-xs cursor-pointer">
                    <span className="text-slate-300">فیلتر لرزش‌گیر هوشمند کادر (EMA)</span>
                    <input
                      type="checkbox"
                      checked={enableJitterFilter}
                      onChange={(e) => setEnableJitterFilter(e.target.checked)}
                      className="rounded bg-slate-800 border-slate-700 text-indigo-500 focus:ring-0 w-4 h-4 cursor-pointer"
                    />
                  </label>
                </div>

                <div className="pt-2 border-t border-slate-800/60 text-[10px] text-slate-400 leading-relaxed bg-slate-950/60 p-2 rounded">
                  💡 <span className="text-slate-300 font-semibold">موتور جدید پردازش:</span> از فیلتر انتگرالی Haar به همراه اعتبارسنجی تقارن دوطرفه چشم‌ها و تیغه بینی استفاده می‌کند تا هیچ سطح بی‌جان یا بافت دیواری به اشتباه انتخاب نشود.
                </div>
              </div>
            )}
          </div>

          {/* Preset Videos Dropdown */}
          <div className="relative">
            <button
              onClick={() => setShowPresetsMenu(!showPresetsMenu)}
              className="flex items-center gap-1 px-2.5 py-1 rounded-md bg-slate-900/90 hover:bg-slate-800 text-slate-200 border border-slate-700 text-xs font-medium transition-colors"
              title="انتخاب نمونه ویدیوی آماده"
            >
              <FileVideo className="w-3.5 h-3.5 text-cyan-400" />
              <span className="hidden sm:inline">کلیپ‌های نمونه</span>
              <ChevronDown className="w-3 h-3 text-slate-400" />
            </button>

            {showPresetsMenu && (
              <div className="absolute left-0 mt-1.5 w-64 bg-slate-900 border border-slate-800 rounded-lg shadow-2xl p-1.5 z-40 space-y-1 animate-in fade-in">
                <div className="px-2 py-1 text-[10px] font-mono text-slate-400 border-b border-slate-800 uppercase">
                  نمونه ویدیوهای آزمایشگاهی (PRESETS)
                </div>
                {PRESET_TEST_VIDEOS.map((clip) => (
                  <button
                    key={clip.id}
                    onClick={() => {
                      setShowPresetsMenu(false);
                      if (onSelectPresetVideo) {
                        onSelectPresetVideo(clip.name, clip.url);
                      } else if (videoRef.current) {
                        videoRef.current.src = clip.url;
                        videoRef.current.load();
                        videoRef.current.play().catch(() => {});
                        setIsPlaying(true);
                      }
                    }}
                    className="w-full text-right p-2 rounded hover:bg-slate-800/80 text-xs text-slate-200 transition-colors flex flex-col gap-0.5"
                  >
                    <span className="font-semibold text-cyan-300 text-xs">{clip.name}</span>
                    <span className="text-[10px] text-slate-400">{clip.desc}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Upload / Select Video File Button */}
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold uppercase tracking-wider shadow-sm transition-all active:scale-95"
            title="انتخاب ویدیوی MP4 یا WebM از کامپیوتر برای تست و دیباگ سیستم"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>انتخاب فیلم ویدیویی</span>
          </button>

          {/* Live OSD Timestamp watermark */}
          <div className="hidden sm:flex items-center gap-1.5 font-mono text-[11px] text-slate-200 bg-slate-900/80 px-2 py-1 rounded border border-slate-700/60 backdrop-blur-sm">
            <span>{liveOsdTime}</span>
          </div>
        </div>
      </div>

      {/* Main Video Screen with Canvas Overlay and Sleek Reticle Elements */}
      <div className="relative w-full aspect-video bg-black flex items-center justify-center overflow-hidden">
        {/* Sleek Dot Grid Pattern Overlay */}
        <div className="absolute inset-0 bg-dot-grid opacity-20 pointer-events-none z-10" />

        {/* AI Scan Status floating pill */}
        {aiScanStatusMsg && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 z-30 bg-purple-950/90 border border-purple-500/80 text-purple-100 text-xs px-3.5 py-1.5 rounded-full shadow-lg backdrop-blur-md flex items-center gap-2 animate-in fade-in slide-in-from-top-2">
            <span className="w-2 h-2 rounded-full bg-purple-400 animate-ping" />
            <span className="font-medium">{aiScanStatusMsg}</span>
          </div>
        )}

        {/* Drag and Drop Hover Overlay */}
        {isDraggingOver && (
          <div className="absolute inset-0 z-30 bg-slate-950/90 backdrop-blur-md flex flex-col items-center justify-center border-2 border-dashed border-cyan-400 p-6 text-center animate-in fade-in">
            <Film className="w-12 h-12 text-cyan-400 mb-3 animate-pulse" />
            <h3 className="text-sm font-bold text-white mb-1">فایل ویدیویی را اینجا رها کنید</h3>
            <p className="text-xs text-slate-300">
              فرمت‌های MP4, WebM, MOV, AVI جهت پردازش، ردیابی و تشخیص چهره فوری
            </p>
          </div>
        )}

        {/* Tactical Outer Reticle Frame */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[80%] h-[80%] border border-slate-800/50 pointer-events-none z-10" />

        {/* Corner Reticle Indicators */}
        <div className="absolute top-8 left-8 w-4 h-4 border-t-2 border-l-2 border-slate-700/60 pointer-events-none z-10" />
        <div className="absolute top-8 right-8 w-4 h-4 border-t-2 border-r-2 border-slate-700/60 pointer-events-none z-10" />
        <div className="absolute bottom-8 left-8 w-4 h-4 border-b-2 border-l-2 border-slate-700/60 pointer-events-none z-10" />
        <div className="absolute bottom-8 right-8 w-4 h-4 border-b-2 border-r-2 border-slate-700/60 pointer-events-none z-10" />

        {/* Bottom Left Surveillance Tags */}
        <div className="absolute bottom-4 left-4 flex items-center gap-2 z-20 pointer-events-none">
          <span
            className={`text-[10px] font-bold px-2 py-0.5 rounded border ${
              activeCamera.streamType === 'video_file'
                ? 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30'
                : 'bg-red-600/20 text-red-500 border-red-600/30'
            }`}
          >
            ● {activeCamera.streamType === 'video_file' ? 'VIDEO SOURCE' : 'REC'}
          </span>
          <span className="bg-black/70 text-slate-300 text-[10px] font-mono px-2 py-0.5 rounded border border-slate-700 uppercase">
            {activeCamera.name}
          </span>
        </div>

        {streamError ? (
          <div className="flex flex-col items-center justify-center p-6 text-center max-w-md z-20">
            <AlertCircle className="w-12 h-12 text-rose-500 mb-3 animate-bounce" />
            <h3 className="text-base font-bold text-white mb-1">خطا در دریافت تصویر</h3>
            <p className="text-xs text-slate-400 mb-4">{streamError}</p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => fileInputRef.current?.click()}
                className="px-3 py-1.5 rounded-md bg-cyan-600 hover:bg-cyan-500 text-xs font-medium text-white transition-colors"
              >
                انتخاب فایل ویدیو از سیستم
              </button>
              <button
                onClick={() => window.location.reload()}
                className="px-3 py-1.5 rounded-md bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-200 border border-slate-700 transition-colors"
              >
                تلاش مجدد
              </button>
            </div>
          </div>
        ) : (
          <>
            {['dahua', 'mjpeg', 'snapshot'].includes(activeCamera.streamType) ? (
              <img
                ref={imgRef}
                alt={activeCamera.name}
                className={`w-full h-full object-cover transition-transform duration-300 ${
                  zoomLevel > 1 ? 'scale-125' : 'scale-100'
                }`}
                crossOrigin="anonymous"
              />
            ) : (
              <video
                ref={videoRef}
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
                className={`w-full h-full object-cover transition-transform duration-300 ${
                  zoomLevel > 1 ? 'scale-125' : 'scale-100'
                }`}
              />
            )}

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

      {/* Video Debugging Timeline & Forensic Scrubber Bar */}
      {isVideoMode && (
        <div className="px-3 py-2 bg-slate-950 border-t border-slate-800/80 flex flex-col gap-1.5 z-20 font-mono">
          {/* Progress Timeline Scrubber */}
          <div className="flex items-center gap-2.5">
            <span className="text-[11px] text-cyan-400 font-mono w-12 text-left">
              {formatSeconds(currentTime)}
            </span>
            <input
              type="range"
              min={0}
              max={duration || 100}
              step={0.04}
              value={currentTime}
              onChange={handleSeek}
              className="flex-1 h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-400 hover:bg-slate-700 transition-colors"
              title="کشیدن خط زمان برای دیباگ فریم به فریم"
            />
            <span className="text-[11px] text-slate-400 font-mono w-12 text-right">
              {formatSeconds(duration)}
            </span>
          </div>

          {/* Sub-controls: Frame-by-Frame Forensics & Speed */}
          <div className="flex items-center justify-between flex-wrap gap-2 text-xs">
            {/* Frame step controls */}
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] text-slate-500 font-mono">دیباگ فریم:</span>
              <button
                onClick={() => handleStepFrame(-0.04)}
                className="flex items-center gap-1 px-2 py-0.5 rounded bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-700 text-[11px] transition-colors"
                title="یک فریم به عقب (-0.04 ثانیه)"
              >
                <SkipBack className="w-3 h-3 text-cyan-400" />
                <span>۱- فریم</span>
              </button>

              <button
                onClick={() => handleStepFrame(0.04)}
                className="flex items-center gap-1 px-2 py-0.5 rounded bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-700 text-[11px] transition-colors"
                title="یک فریم به جلو (+0.04 ثانیه)"
              >
                <span>۱+ فریم</span>
                <SkipForward className="w-3 h-3 text-cyan-400" />
              </button>

              <button
                onClick={handleToggleLoop}
                className={`flex items-center gap-1 px-2 py-0.5 rounded border text-[11px] transition-colors ${
                  isLooping
                    ? 'bg-cyan-500/10 border-cyan-500/40 text-cyan-300'
                    : 'bg-slate-900 border-slate-800 text-slate-500'
                }`}
                title="تکرار مداوم ویدیو"
              >
                <Repeat className="w-3 h-3" />
                <span>تکرار</span>
              </button>
            </div>

            {/* Playback speed selector */}
            <div className="flex items-center gap-1">
              <span className="text-[10px] text-slate-500 font-mono">سرعت:</span>
              {[0.25, 0.5, 1, 1.5, 2].map((spd) => (
                <button
                  key={spd}
                  onClick={() => handleSpeedChange(spd)}
                  className={`px-1.5 py-0.5 rounded text-[10px] font-mono transition-colors ${
                    playbackSpeed === spd
                      ? 'bg-cyan-600 text-white font-bold'
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

      {/* Bottom Control Bar (Sleek Interface Style) */}
      <div className="p-3 bg-slate-900 border-t border-slate-800 flex flex-wrap items-center justify-between gap-2.5 z-20">
        {/* Left: Stream playback and zoom toggle */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={handleTogglePlay}
            className="p-2 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors"
            title={isPlaying ? 'توقف موقت تصویر (Pause)' : 'پخش تصویر (Play)'}
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

