export interface BoundingBox {
  x: number; // 0 to 1 relative or pixels
  y: number;
  width: number;
  height: number;
}

export interface DetectedFace {
  id: string;
  box: BoundingBox;
  confidence: number;
  label?: string;
  trackingId: number;
  snapshotUrl?: string;
  timestamp: string;
  recognizedPerson?: RegisteredPerson | null;
  attributes?: {
    ageRange?: string;
    gender?: string;
    emotion?: string;
    mask?: boolean;
  };
}

export interface RegisteredPerson {
  id: string;
  fullName: string;
  nationalId?: string;
  personnelCode: string;
  role: string;
  department: string;
  accessLevel: 'authorized' | 'visitor' | 'restricted' | 'vip';
  photoUrl?: string;
  createdAt: string;
}

export type MovementType = 'entry' | 'exit' | 'passage';

export interface TrafficLog {
  id: string;
  timestamp: string; // ISO string
  jalaliDate: string; // e.g. "۱۴۰۴/۱۲/۱۵"
  jalaliTime: string; // e.g. "۱۷:۰۵:۲۲"
  exactTimestampMs: number;
  cameraName: string;
  cameraIp: string;
  faceSnapshot: string; // Base64 data URL or image URL
  personnelId?: string;
  personName: string;
  isRecognized: boolean;
  movementType: MovementType;
  confidence: number;
  notes?: string;
  ageEstimate?: string;
  genderEstimate?: string;
  emotion?: string;
  trackingId: number;
}

export interface CameraConfig {
  id: string;
  name: string;
  ipAddress: string;
  streamType: 'mjpeg' | 'snapshot' | 'webcam' | 'simulation';
  streamUrl: string;
  location: string;
  isActive: boolean;
  resolution?: string;
  fps?: number;
}

export interface SystemStats {
  totalToday: number;
  entriesToday: number;
  exitsToday: number;
  recognizedToday: number;
  unknownToday: number;
  activeCameras: number;
}
