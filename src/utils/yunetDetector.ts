import * as ort from 'onnxruntime-web';
import { BoundingBox, FacialLandmarks } from '../types';

/**
 * YuNet Face Detector (OpenCV Zoo)
 * Model: face_detection_yunet_2023mar.onnx
 * Operates 100% OFFLINE without any internet connection or cloud API.
 * Uses local WebAssembly assets and local ONNX model file.
 */

// Configure ONNX Runtime Web to strictly use local static WASM files (no CDN/internet)
if (typeof window !== 'undefined') {
  try {
    ort.env.wasm.wasmPaths = '/ort-wasm/';
    // Set to 1 thread for universal browser & iframe compatibility (avoids SharedArrayBuffer COOP restrictions)
    ort.env.wasm.numThreads = 1;
  } catch (err) {
    console.warn('[YuNet] Failed to configure WASM paths:', err);
  }
}

export interface YuNetFace {
  box: BoundingBox;
  confidence: number;
  landmarks: FacialLandmarks;
}

let yunetSession: ort.InferenceSession | null = null;
let isSessionLoading = false;
let sessionLoadPromise: Promise<ort.InferenceSession | null> | null = null;

// Offscreen canvas reused for 640x640 preprocessing
let offscreenCanvas: HTMLCanvasElement | null = null;
let offscreenCtx: CanvasRenderingContext2D | null = null;

/**
 * Initialize or get the cached YuNet ONNX inference session
 */
export async function getYuNetSession(): Promise<ort.InferenceSession | null> {
  if (yunetSession) return yunetSession;
  if (isSessionLoading && sessionLoadPromise) return sessionLoadPromise;

  isSessionLoading = true;
  sessionLoadPromise = (async () => {
    try {
      // Load the model locally from /models/face_detection_yunet_2023mar.onnx
      const response = await fetch('/models/face_detection_yunet_2023mar.onnx');
      if (!response.ok) {
        throw new Error(`Failed to fetch local YuNet model: HTTP ${response.status}`);
      }
      const modelBuffer = await response.arrayBuffer();

      const session = await ort.InferenceSession.create(modelBuffer, {
        executionProviders: ['wasm'],
        graphOptimizationLevel: 'all',
      });

      console.log('[YuNet] OpenCV YuNet ONNX session initialized successfully (Offline Mode)');
      yunetSession = session;
      return session;
    } catch (err) {
      console.warn('[YuNet] Error loading client-side ONNX session, will fallback to server-side YuNet:', err);
      return null;
    } finally {
      isSessionLoading = false;
    }
  })();

  return sessionLoadPromise;
}

/**
 * Preprocess image/video source into a 640x640 float32 BGR tensor with letterboxing
 */
function preprocessImage(
  source: HTMLVideoElement | HTMLImageElement | HTMLCanvasElement
): {
  tensor: ort.Tensor;
  scale: number;
  padX: number;
  padY: number;
  renderW: number;
  renderH: number;
  srcW: number;
  srcH: number;
} | null {
  const srcW = source instanceof HTMLVideoElement ? source.videoWidth : source.width;
  const srcH = source instanceof HTMLVideoElement ? source.videoHeight : source.height;
  if (!srcW || !srcH || srcW <= 0 || srcH <= 0) return null;

  if (!offscreenCanvas) {
    offscreenCanvas = document.createElement('canvas');
    offscreenCanvas.width = 640;
    offscreenCanvas.height = 640;
    offscreenCtx = offscreenCanvas.getContext('2d', { willReadFrequently: true });
  }

  const ctx = offscreenCtx;
  if (!ctx) return null;

  // Calculate letterbox scaling (maintain aspect ratio)
  const scale = Math.min(640 / srcW, 640 / srcH);
  const renderW = Math.round(srcW * scale);
  const renderH = Math.round(srcH * scale);
  const padX = Math.floor((640 - renderW) / 2);
  const padY = Math.floor((640 - renderH) / 2);

  // Fill canvas with black
  ctx.fillStyle = '#000000';
  ctx.fillRect(0, 0, 640, 640);

  // Draw scaled image into letterbox region
  ctx.drawImage(source, 0, 0, srcW, srcH, padX, padY, renderW, renderH);

  const imgData = ctx.getImageData(0, 0, 640, 640);
  const rgba = imgData.data;

  // Planar BGR format for OpenCV YuNet:
  // Channel 0: Blue  [0..255]
  // Channel 1: Green [0..255]
  // Channel 2: Red   [0..255]
  const floatData = new Float32Array(3 * 640 * 640);
  const totalPixels = 640 * 640;

  for (let i = 0; i < totalPixels; i++) {
    const r = rgba[i * 4];
    const g = rgba[i * 4 + 1];
    const b = rgba[i * 4 + 2];

    floatData[i] = b; // B
    floatData[totalPixels + i] = g; // G
    floatData[totalPixels * 2 + i] = r; // R
  }

  const tensor = new ort.Tensor('float32', floatData, [1, 3, 640, 640]);

  return {
    tensor,
    scale,
    padX,
    padY,
    renderW,
    renderH,
    srcW,
    srcH,
  };
}

/**
 * Calculates IoU between two bounding boxes
 */
function calculateBoxIoU(b1: BoundingBox, b2: BoundingBox): number {
  const x1 = Math.max(b1.x, b2.x);
  const y1 = Math.max(b1.y, b2.y);
  const x2 = Math.min(b1.x + b1.width, b2.x + b2.width);
  const y2 = Math.min(b1.y + b1.height, b2.y + b2.height);

  const w = Math.max(0, x2 - x1);
  const h = Math.max(0, y2 - y1);
  const inter = w * h;
  const union = b1.width * b1.height + b2.width * b2.height - inter;
  return union > 0 ? inter / union : 0;
}

/**
 * Postprocesses the 12 output heads of YuNet
 */
function postprocessYuNetOutputs(
  outputs: ort.InferenceSession.OnnxValueMapType,
  meta: {
    padX: number;
    padY: number;
    renderW: number;
    renderH: number;
  },
  confThreshold: number = 0.55,
  nmsThreshold: number = 0.35
): YuNetFace[] {
  const strides = [8, 16, 32];
  const candidates: {
    box: BoundingBox;
    confidence: number;
    landmarks: FacialLandmarks;
  }[] = [];

  for (const s of strides) {
    const clsTensor = outputs[`cls_${s}`];
    const objTensor = outputs[`obj_${s}`];
    const bboxTensor = outputs[`bbox_${s}`];
    const kpsTensor = outputs[`kps_${s}`];

    if (!clsTensor || !objTensor || !bboxTensor || !kpsTensor) continue;

    const cls = clsTensor.data as Float32Array;
    const obj = objTensor.data as Float32Array;
    const bbox = bboxTensor.data as Float32Array;
    const kps = kpsTensor.data as Float32Array;

    const cols = 640 / s;
    const rows = 640 / s;

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const idx = r * cols + c;

        let cls_score = cls[idx];
        let obj_score = obj[idx];

        // Clamp scores to [0, 1]
        if (cls_score < 0) cls_score = 0;
        else if (cls_score > 1) cls_score = 1;

        if (obj_score < 0) obj_score = 0;
        else if (obj_score > 1) obj_score = 1;

        const score = Math.sqrt(cls_score * obj_score);
        if (score < confThreshold) continue;

        // Bounding box decoding (OpenCV FaceDetectorYN specification)
        const cx = (c + bbox[idx * 4 + 0]) * s;
        const cy = (r + bbox[idx * 4 + 1]) * s;
        const w = Math.exp(bbox[idx * 4 + 2]) * s;
        const h = Math.exp(bbox[idx * 4 + 3]) * s;
        const x1 = cx - w / 2;
        const y1 = cy - h / 2;

        // Un-letterbox bounding box to [0, 1] relative coordinates
        const normX = (x1 - meta.padX) / meta.renderW;
        const normY = (y1 - meta.padY) / meta.renderH;
        const normW = w / meta.renderW;
        const normH = h / meta.renderH;

        // Landmarks decoding: 5 points (re, le, nt, rcm, lcm)
        // re: Right eye, le: Left eye, nt: Nose tip, rcm: Right mouth corner, lcm: Left mouth corner
        const pts: { x: number; y: number }[] = [];
        for (let n = 0; n < 5; n++) {
          const lx = (kps[idx * 10 + 2 * n + 0] + c) * s;
          const ly = (kps[idx * 10 + 2 * n + 1] + r) * s;

          const nlx = (lx - meta.padX) / meta.renderW;
          const nly = (ly - meta.padY) / meta.renderH;

          pts.push({
            x: Math.max(0, Math.min(1, nlx)),
            y: Math.max(0, Math.min(1, nly)),
          });
        }

        const landmarks: FacialLandmarks = {
          rightEye: pts[0],
          leftEye: pts[1],
          noseTip: pts[2],
          mouthRight: pts[3],
          mouthLeft: pts[4],
          mouthCenter: {
            x: (pts[3].x + pts[4].x) / 2,
            y: (pts[3].y + pts[4].y) / 2,
          },
        };

        const clampedBox: BoundingBox = {
          x: Math.max(0, Math.min(0.98, normX)),
          y: Math.max(0, Math.min(0.98, normY)),
          width: Math.max(0.02, Math.min(1 - normX, normW)),
          height: Math.max(0.02, Math.min(1 - normY, normH)),
        };

        candidates.push({
          box: clampedBox,
          confidence: Number((score * 100).toFixed(1)),
          landmarks,
        });
      }
    }
  }

  if (candidates.length === 0) return [];

  // Sort by confidence descending
  candidates.sort((a, b) => b.confidence - a.confidence);

  // Non-Maximum Suppression (NMS)
  const accepted: YuNetFace[] = [];
  const visited = new Set<number>();

  for (let i = 0; i < candidates.length; i++) {
    if (visited.has(i)) continue;
    visited.add(i);

    const primary = candidates[i];
    accepted.push(primary);

    for (let j = i + 1; j < candidates.length; j++) {
      if (visited.has(j)) continue;
      const iou = calculateBoxIoU(primary.box, candidates[j].box);
      if (iou >= nmsThreshold) {
        visited.add(j);
      }
    }

    if (accepted.length >= 10) break;
  }

  return accepted;
}

/**
 * Execute YuNet Face Detection on an HTML Media element (Video, Canvas, Image)
 * Completely offline, zero network / zero cloud.
 */
export async function detectFacesWithYuNet(
  source: HTMLVideoElement | HTMLImageElement | HTMLCanvasElement,
  options: {
    confThreshold?: number;
    nmsThreshold?: number;
  } = {}
): Promise<YuNetFace[]> {
  const confThreshold = options.confThreshold ?? 0.55;
  const nmsThreshold = options.nmsThreshold ?? 0.35;

  const prep = preprocessImage(source);
  if (!prep) return [];

  try {
    const session = await getYuNetSession();
    if (session) {
      // Run offline client-side WASM inference
      const results = await session.run({ input: prep.tensor });
      const faces = postprocessYuNetOutputs(
        results,
        {
          padX: prep.padX,
          padY: prep.padY,
          renderW: prep.renderW,
          renderH: prep.renderH,
        },
        confThreshold,
        nmsThreshold
      );
      return faces;
    }
  } catch (err) {
    console.warn('[YuNet] Client inference error, attempting server fallback:', err);
  }

  // Fallback to local server-side offline YuNet endpoint if client wasm encounters environment constraints
  try {
    if (!offscreenCanvas) return [];
    const base64 = offscreenCanvas.toDataURL('image/jpeg', 0.85);

    const res = await fetch('/api/face/yunet-detect', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        imageBase64: base64,
        padX: prep.padX,
        padY: prep.padY,
        renderW: prep.renderW,
        renderH: prep.renderH,
        confThreshold,
        nmsThreshold,
      }),
    });

    if (res.ok) {
      const data = await res.json();
      if (data.success && Array.isArray(data.faces)) {
        return data.faces;
      }
    }
  } catch (err) {
    console.warn('[YuNet] Offline server fallback error:', err);
  }

  return [];
}
