import React, { useState } from 'react';
import { Header } from './components/Header';
import { YuNetStudio } from './components/YuNetStudio';
import { FaceInspectDialog } from './components/FaceInspectDialog';
import { DetectedFace } from './types';

export default function App() {
  // Audio chime feedback
  const [audioEnabled, setAudioEnabled] = useState(true);

  // Live Performance Stats
  const [detectedCount, setDetectedCount] = useState(0);
  const [fps, setFps] = useState(30);
  const [latencyMs, setLatencyMs] = useState(15);

  // Inspect Modal
  const [inspectingFace, setInspectingFace] = useState<{
    face: DetectedFace | null;
    thumbnail: string;
  } | null>(null);

  const handleStatsUpdate = (count: number, currentFps: number, latency: number) => {
    setDetectedCount(count);
    setFps(currentFps);
    setLatencyMs(latency);
  };

  const handleInspectFace = (face: DetectedFace, thumbnail: string) => {
    setInspectingFace({ face, thumbnail });
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col selection:bg-emerald-500 selection:text-white">
      {/* Top Bar */}
      <Header
        audioEnabled={audioEnabled}
        onToggleAudio={() => setAudioEnabled(!audioEnabled)}
        detectedCount={detectedCount}
        fps={fps}
        latencyMs={latencyMs}
      />

      {/* Main Studio Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6">
        <YuNetStudio
          audioEnabled={audioEnabled}
          onStatsUpdate={handleStatsUpdate}
          onInspectFace={handleInspectFace}
        />
      </main>

      {/* Face Inspection Dialog */}
      {inspectingFace && inspectingFace.face && (
        <FaceInspectDialog
          face={inspectingFace.face}
          thumbnail={inspectingFace.thumbnail}
          onClose={() => setInspectingFace(null)}
        />
      )}
    </div>
  );
}
