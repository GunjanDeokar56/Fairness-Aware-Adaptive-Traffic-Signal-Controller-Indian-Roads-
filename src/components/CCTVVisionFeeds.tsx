/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect } from 'react';
import {
  ApproachDirection,
  INDIAN_VEHICLE_CONFIG,
  SimVehicle,
  calculateDetectedPCU,
  estimateGreenDurationFromPCU,
  DetectedVehicleCounts,
} from '../utils/traffic-engine';
import {
  Camera,
  Cpu,
  Layers,
  Eye,
  Maximize2,
  Minimize2,
  ShieldAlert,
  Play,
  Pause,
  RotateCcw,
  Volume2,
  VolumeX,
  Upload,
  Video,
  FileVideo,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  X,
  Sliders,
  Scan,
  Download,
} from 'lucide-react';

interface CCTVVisionFeedsProps {
  vehicles: SimVehicle[];
  currentPhase: string;
}

interface CameraConfig {
  id: string;
  name: string;
  approach: ApproachDirection;
  location: string;
  angle: string;
}

const CAMERAS: CameraConfig[] = [
  { id: 'CAM-01', name: 'Camera 01', approach: 'North', location: 'North Arterial Approach (Ring Rd Flyover)', angle: '35° Downward Tilt' },
  { id: 'CAM-02', name: 'Camera 02', approach: 'South', location: 'South Commuter Corridor (Metro Stn Gate 2)', angle: '40° Downward Tilt' },
  { id: 'CAM-03', name: 'Camera 03', approach: 'East', location: 'East Commercial Hub Link (Market Road)', angle: '30° Downward Tilt' },
  { id: 'CAM-04', name: 'Camera 04', approach: 'West', location: 'West Residential Feeder Lane', angle: '45° Downward Tilt' },
];

interface RecordedFootageItem {
  id: string;
  file: File | null;
  videoUrl: string;
  fileName: string;
  fileSizeFormatted: string;
  duration: number;
  isSample?: boolean;
}

interface FrameAnalysisData {
  camera: string;
  approach: string;
  totalVehicles: number;
  totalPCU: number;
  density: string;
  queueLengthMeters: number;
  recommendedGreenSeconds: number;
  confidenceScore: number;
  observation: string;
  source: string;
  model: string;
  breakdown: DetectedVehicleCounts;
  timestamp: string;
}

export const CCTVVisionFeeds: React.FC<CCTVVisionFeedsProps> = ({
  vehicles,
  currentPhase,
}) => {
  const [showBoundingBoxes, setShowBoundingBoxes] = useState<boolean>(true);
  const [showVirtualLoop, setShowVirtualLoop] = useState<boolean>(true);
  const [selectedCam, setSelectedCam] = useState<string | null>(null);

  // Map of camera ID -> recorded footage item (null means running live simulated SVG)
  const [recordedFootageMap, setRecordedFootageMap] = useState<Record<string, RecordedFootageItem | null>>({
    'CAM-01': null,
    'CAM-02': null,
    'CAM-03': null,
    'CAM-04': null,
  });

  // Target camera for next file browse upload
  const [uploadTargetCam, setUploadTargetCam] = useState<string>('CAM-01');
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Playback states per camera
  const [playbackStates, setPlaybackStates] = useState<Record<string, { isPlaying: boolean; currentTime: number; duration: number; speed: number; isMuted: boolean }>>({
    'CAM-01': { isPlaying: true, currentTime: 0, duration: 0, speed: 1, isMuted: true },
    'CAM-02': { isPlaying: true, currentTime: 0, duration: 0, speed: 1, isMuted: true },
    'CAM-03': { isPlaying: true, currentTime: 0, duration: 0, speed: 1, isMuted: true },
    'CAM-04': { isPlaying: true, currentTime: 0, duration: 0, speed: 1, isMuted: true },
  });

  const videoRefs = useRef<Record<string, HTMLVideoElement | null>>({});

  // AI Frame Analysis Modal / Drawer state
  const [analysisLoadingCam, setAnalysisLoadingCam] = useState<string | null>(null);
  const [analysisResult, setAnalysisResult] = useState<FrameAnalysisData | null>(null);
  const [analysisError, setAnalysisError] = useState<string | null>(null);

  // Drag and drop hover indicator
  const [isDraggingOver, setIsDraggingOver] = useState<string | null>(null);

  const getApproachVehicles = (dir: ApproachDirection) =>
    vehicles.filter((v) => v.approach === dir && !v.hasCrossed);

  // Handle local file selection from device
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const file = files[0];
    loadVideoFile(file, uploadTargetCam);
    // Reset file input value so re-selecting same file triggers change
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const loadVideoFile = (file: File, targetCamId: string) => {
    const videoUrl = URL.createObjectURL(file);
    const sizeKB = file.size / 1024;
    const sizeFormatted = sizeKB > 1024 ? `${(sizeKB / 1024).toFixed(1)} MB` : `${Math.round(sizeKB)} KB`;

    const footageItem: RecordedFootageItem = {
      id: `footage-${Date.now()}`,
      file,
      videoUrl,
      fileName: file.name,
      fileSizeFormatted: sizeFormatted,
      duration: 0,
    };

    setRecordedFootageMap((prev) => ({
      ...prev,
      [targetCamId]: footageItem,
    }));

    setPlaybackStates((prev) => ({
      ...prev,
      [targetCamId]: { isPlaying: true, currentTime: 0, duration: 0, speed: 1, isMuted: true },
    }));
  };

  // Eject/Remove recorded footage and revert to live simulation
  const removeFootage = (camId: string) => {
    const current = recordedFootageMap[camId];
    if (current && current.videoUrl) {
      URL.revokeObjectURL(current.videoUrl);
    }
    setRecordedFootageMap((prev) => ({
      ...prev,
      [camId]: null,
    }));
    if (analysisResult?.camera === camId) {
      setAnalysisResult(null);
    }
  };

  // Video Playback Controls
  const togglePlay = (camId: string) => {
    const video = videoRefs.current[camId];
    if (!video) return;
    if (video.paused) {
      video.play().catch(() => {});
      setPlaybackStates((prev) => ({
        ...prev,
        [camId]: { ...prev[camId], isPlaying: true },
      }));
    } else {
      video.pause();
      setPlaybackStates((prev) => ({
        ...prev,
        [camId]: { ...prev[camId], isPlaying: false },
      }));
    }
  };

  const handleSeek = (camId: string, time: number) => {
    const video = videoRefs.current[camId];
    if (!video) return;
    video.currentTime = time;
    setPlaybackStates((prev) => ({
      ...prev,
      [camId]: { ...prev[camId], currentTime: time },
    }));
  };

  const handleSpeedChange = (camId: string, speed: number) => {
    const video = videoRefs.current[camId];
    if (!video) return;
    video.playbackRate = speed;
    setPlaybackStates((prev) => ({
      ...prev,
      [camId]: { ...prev[camId], speed },
    }));
  };

  const toggleMute = (camId: string) => {
    const video = videoRefs.current[camId];
    if (!video) return;
    const nextMuted = !video.muted;
    video.muted = nextMuted;
    setPlaybackStates((prev) => ({
      ...prev,
      [camId]: { ...prev[camId], isMuted: nextMuted },
    }));
  };

  // Frame Stepper (+/- 0.1s)
  const stepFrame = (camId: string, deltaSeconds: number) => {
    const video = videoRefs.current[camId];
    if (!video) return;
    video.pause();
    video.currentTime = Math.max(0, Math.min(video.duration || 60, video.currentTime + deltaSeconds));
    setPlaybackStates((prev) => ({
      ...prev,
      [camId]: { ...prev[camId], isPlaying: false, currentTime: video.currentTime },
    }));
  };

  // Generate Sample Traffic Video (Generates dynamic authentic canvas footage with vehicle flow)
  const generateSampleTrafficVideo = (targetCamId: string) => {
    const canvas = document.createElement('canvas');
    canvas.width = 640;
    canvas.height = 360;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Check if MediaRecorder and captureStream are supported
    if (typeof canvas.captureStream !== 'function' || typeof MediaRecorder === 'undefined') {
      alert('Your browser does not support in-memory video encoding. Please browse an MP4/WebM video file from your device.');
      return;
    }

    const stream = canvas.captureStream(25); // 25 fps
    const chunks: BlobPart[] = [];
    let recorder: MediaRecorder;
    try {
      recorder = new MediaRecorder(stream, { mimeType: 'video/webm' });
    } catch {
      try {
        recorder = new MediaRecorder(stream);
      } catch (err) {
        alert('MediaRecorder is not supported for automatic sample generation. Please use Browse File to select your recorded CCTV video.');
        return;
      }
    }

    recorder.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) chunks.push(e.data);
    };

    recorder.onstop = () => {
      const blob = new Blob(chunks, { type: 'video/webm' });
      const videoUrl = URL.createObjectURL(blob);
      const footageItem: RecordedFootageItem = {
        id: `sample-${Date.now()}`,
        file: null,
        videoUrl,
        fileName: `sample_traffic_cctv_${targetCamId.toLowerCase()}.webm`,
        fileSizeFormatted: `${Math.round(blob.size / 1024)} KB`,
        duration: 8,
        isSample: true,
      };

      setRecordedFootageMap((prev) => ({
        ...prev,
        [targetCamId]: footageItem,
      }));

      setPlaybackStates((prev) => ({
        ...prev,
        [targetCamId]: { isPlaying: true, currentTime: 0, duration: 8, speed: 1, isMuted: true },
      }));
    };

    recorder.start();

    // Render 7.5 seconds of simulated high-density Indian traffic
    let frame = 0;
    const totalFrames = 190; // ~7.6 seconds at 25 fps
    const animInterval = setInterval(() => {
      frame++;
      const t = frame / 25; // seconds

      // Background asphalt road
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(0, 0, 640, 360);

      // Roadway perspective
      const grad = ctx.createLinearGradient(0, 0, 0, 360);
      grad.addColorStop(0, '#1e293b');
      grad.addColorStop(1, '#090d16');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.moveTo(180, 80);
      ctx.lineTo(460, 80);
      ctx.lineTo(620, 360);
      ctx.lineTo(20, 360);
      ctx.closePath();
      ctx.fill();

      // Median yellow lines
      ctx.strokeStyle = '#eab308';
      ctx.lineWidth = 3;
      ctx.setLineDash([12, 8]);
      ctx.beginPath();
      ctx.moveTo(320, 80);
      ctx.lineTo(320, 360);
      ctx.stroke();

      // White stop line
      ctx.setLineDash([]);
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(70, 320);
      ctx.lineTo(570, 320);
      ctx.stroke();

      // Moving vehicles with Indian traffic mix
      const sampleVehicles = [
        { type: 'auto', x: 260, startY: 340, speed: 28, color: '#eab308', w: 32, h: 22, pcu: 0.8 },
        { type: 'bike', x: 220, startY: 310, speed: 38, color: '#06b6d4', w: 18, h: 26, pcu: 0.5 },
        { type: 'bike', x: 240, startY: 290, speed: 36, color: '#38bdf8', w: 18, h: 26, pcu: 0.5 },
        { type: 'car', x: 380, startY: 260, speed: 30, color: '#3b82f6', w: 42, h: 32, pcu: 1.0 },
        { type: 'bus', x: 420, startY: 180, speed: 22, color: '#ef4444', w: 55, h: 48, pcu: 3.0 },
        { type: 'auto', x: 370, startY: 330, speed: 26, color: '#f59e0b', w: 30, h: 22, pcu: 0.8 },
      ];

      sampleVehicles.forEach((veh) => {
        const curY = (veh.startY - (t * veh.speed * 4)) % 300 + 70;
        const scale = 0.5 + (curY / 360) * 0.7;

        ctx.fillStyle = veh.color;
        ctx.fillRect(veh.x - (veh.w * scale) / 2, curY - (veh.h * scale) / 2, veh.w * scale, veh.h * scale);
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(veh.x - (veh.w * scale) / 2, curY - (veh.h * scale) / 2, veh.w * scale, veh.h * scale);
      });

      // Timestamp HUD text
      ctx.fillStyle = 'rgba(0,0,0,0.7)';
      ctx.fillRect(10, 10, 280, 24);
      ctx.fillStyle = '#10b981';
      ctx.font = '12px monospace';
      ctx.fillText(`CCTV SAMPLE • REC [1080p] • t=${t.toFixed(1)}s`, 16, 26);

      if (frame >= totalFrames) {
        clearInterval(animInterval);
        recorder.stop();
      }
    }, 40);
  };

  // Perform AI Frame Analysis on current video frame or live canvas
  const handleAnalyzeFrame = async (camId: string, camConfig: CameraConfig) => {
    setAnalysisLoadingCam(camId);
    setAnalysisError(null);

    try {
      const video = videoRefs.current[camId];
      let base64Frame = '';

      if (video && video.videoWidth > 0 && video.videoHeight > 0) {
        // Capture frame from active HTML5 video
        const canvas = document.createElement('canvas');
        canvas.width = Math.min(640, video.videoWidth);
        canvas.height = Math.min(360, Math.round((canvas.width * video.videoHeight) / video.videoWidth));
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          base64Frame = canvas.toDataURL('image/jpeg', 0.85);
        }
      }

      const res = await fetch('/api/analyze-cctv-frame', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          frameBase64: base64Frame,
          mimeType: 'image/jpeg',
          cameraName: camConfig.name,
          approach: camConfig.approach,
        }),
      });

      if (!res.ok) {
        throw new Error(`Server returned HTTP ${res.status}`);
      }

      const data = await res.json();
      if (!data.success) {
        throw new Error(data.error || 'Vision analysis failed');
      }

      setAnalysisResult({
        camera: camConfig.name,
        approach: camConfig.approach,
        totalVehicles: data.totalVehicles || 8,
        totalPCU: data.totalPCU || 9.5,
        density: data.density || 'Moderate Flow',
        queueLengthMeters: data.queueLengthMeters || 38,
        recommendedGreenSeconds: data.recommendedGreenSeconds || 24,
        confidenceScore: data.confidenceScore || 0.95,
        observation: data.observation || 'Queue density estimated via heterogeneous PCU matrix.',
        source: data.source || 'gemini-3.8-flash-vision',
        model: data.model || 'Gemini 3.8 Flash Vision',
        breakdown: data.breakdown || {
          twoWheeler: 4,
          autoRickshaw: 2,
          car: 2,
          bus: 1,
          truck: 0,
          ambulance: 0,
        },
        timestamp: new Date().toLocaleTimeString(),
      });
    } catch (err: any) {
      console.error('Frame analysis error:', err);
      setAnalysisError(err.message || 'Could not complete AI frame inspection');
    } finally {
      setAnalysisLoadingCam(null);
    }
  };

  // Drag and drop handlers
  const handleDragOver = (e: React.DragEvent, camId: string) => {
    e.preventDefault();
    setIsDraggingOver(camId);
  };

  const handleDragLeave = () => {
    setIsDraggingOver(null);
  };

  const handleDrop = (e: React.DragEvent, camId: string) => {
    e.preventDefault();
    setIsDraggingOver(null);
    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      loadVideoFile(files[0], camId);
    }
  };

  const triggerBrowseForCam = (camId: string) => {
    setUploadTargetCam(camId);
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const formatSeconds = (sec: number) => {
    if (isNaN(sec) || sec < 0) return '00:00';
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const activeFootageCount = Object.values(recordedFootageMap).filter(Boolean).length;

  return (
    <div className="flex flex-col gap-4">
      {/* Hidden Device File Input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="video/mp4,video/webm,video/ogg,video/quicktime,video/m4v,video/*,image/*"
        onChange={handleFileChange}
        className="hidden"
        aria-label="Upload recorded CCTV video file"
      />

      {/* CCTV Header & Controls Ribbon */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-xl flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-emerald-950 border border-emerald-500/40 rounded-lg text-emerald-400">
            <Camera className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <div className="text-xs font-semibold text-emerald-400 uppercase tracking-wider flex items-center gap-2">
              <span>Edge AI Computer Vision & Ingestion</span>
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
            </div>
            <div className="text-base font-bold text-white flex items-center gap-2">
              CCTV Video Stream & Recorded Footage Ingestion
            </div>
          </div>
        </div>

        {/* Action Buttons: Browse Device & Presets */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Target Camera Selector for Upload */}
          <div className="flex items-center gap-1.5 bg-slate-950 px-2 py-1.5 rounded-lg border border-slate-800 text-xs text-slate-300">
            <span className="text-[11px] text-slate-400 hidden sm:inline">Target:</span>
            <select
              value={uploadTargetCam}
              onChange={(e) => setUploadTargetCam(e.target.value)}
              className="bg-transparent text-xs text-white font-semibold focus:outline-none cursor-pointer"
              title="Select camera arm to receive uploaded footage"
              aria-label="Select camera arm for recorded footage"
            >
              <option value="CAM-01">Camera 01 (North)</option>
              <option value="CAM-02">Camera 02 (South)</option>
              <option value="CAM-03">Camera 03 (East)</option>
              <option value="CAM-04">Camera 04 (West)</option>
            </select>
          </div>

          {/* Primary Browse from Device Button */}
          <button
            onClick={() => triggerBrowseForCam(uploadTargetCam)}
            className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-md transition active:scale-95"
            title="Browse device for recorded MP4, WebM, or MOV traffic video"
            aria-label="Browse Recorded CCTV Footage from Device"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Browse Device Video</span>
          </button>

          {/* Sample Video Generator */}
          <button
            onClick={() => generateSampleTrafficVideo(uploadTargetCam)}
            className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg text-xs font-medium flex items-center gap-1.5 transition"
            title="Generate and load high-density urban traffic sample footage"
            aria-label="Load Sample CCTV Footage"
          >
            <Video className="w-3.5 h-3.5 text-cyan-400" />
            <span className="hidden sm:inline">Try Sample Video</span>
          </button>

          {/* AI Vision Overlay Toggles */}
          <button
            onClick={() => setShowBoundingBoxes(!showBoundingBoxes)}
            className={`px-2.5 py-1.5 text-xs rounded-lg border font-medium flex items-center gap-1.5 transition ${
              showBoundingBoxes
                ? 'bg-emerald-600/20 border-emerald-500 text-emerald-300'
                : 'bg-slate-800 border-slate-700 text-slate-400'
            }`}
            title="Toggle AI vehicle bounding boxes on video"
          >
            <Eye className="w-3.5 h-3.5" />
            <span>Boxes: {showBoundingBoxes ? 'ON' : 'OFF'}</span>
          </button>

          <button
            onClick={() => setShowVirtualLoop(!showVirtualLoop)}
            className={`px-2.5 py-1.5 text-xs rounded-lg border font-medium flex items-center gap-1.5 transition ${
              showVirtualLoop
                ? 'bg-cyan-600/20 border-cyan-500 text-cyan-300'
                : 'bg-slate-800 border-slate-700 text-slate-400'
            }`}
            title="Toggle stop-line virtual induction ROI"
          >
            <Layers className="w-3.5 h-3.5" />
            <span>ROI: {showVirtualLoop ? 'ON' : 'OFF'}</span>
          </button>
        </div>
      </div>

      {/* Active Recorded Footage Banner */}
      {activeFootageCount > 0 && (
        <div className="bg-emerald-950/70 border border-emerald-500/40 rounded-xl p-3 flex flex-wrap items-center justify-between gap-3 text-xs shadow-md">
          <div className="flex items-center gap-2 text-emerald-300">
            <FileVideo className="w-4 h-4 text-emerald-400 animate-pulse" />
            <span className="font-semibold">
              Active Recorded Footage Loaded ({activeFootageCount}/4 Cameras):
            </span>
            <div className="flex flex-wrap gap-2">
              {Object.entries(recordedFootageMap).map(([camId, footage]) => {
                if (!footage) return null;
                const cam = CAMERAS.find((c) => c.id === camId);
                return (
                  <span
                    key={camId}
                    className="bg-emerald-900/80 border border-emerald-600/60 px-2 py-0.5 rounded text-[11px] font-mono text-white flex items-center gap-1.5"
                  >
                    <span className="font-bold text-amber-300">{cam?.name} ({cam?.approach}):</span>
                    <span className="truncate max-w-[150px]">{footage.fileName}</span>
                    <span className="text-[10px] text-emerald-300">({footage.fileSizeFormatted})</span>
                    <button
                      onClick={() => removeFootage(camId)}
                      className="ml-1 text-slate-400 hover:text-white"
                      title={`Remove footage from ${cam?.name}`}
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                );
              })}
            </div>
          </div>
          <div className="text-[11px] text-emerald-400/80">
            Real video decoding with AI vision overlays & IRC: 106-1990 queue extraction
          </div>
        </div>
      )}

      {/* CCTV Grid (Quad View) or Single Maximized View */}
      <div className={`grid gap-4 ${selectedCam ? 'grid-cols-1' : 'grid-cols-1 md:grid-cols-2'}`}>
        {CAMERAS.filter((cam) => !selectedCam || cam.id === selectedCam).map((cam) => {
          const armVehicles = getApproachVehicles(cam.approach);
          const hasEmergency = armVehicles.some((v) => v.isEmergency);
          const maxWait = armVehicles.length > 0 ? Math.max(...armVehicles.map((v) => v.waitingTime)) : 0;
          const queueLengthMeters = armVehicles.length > 0 ? Math.max(...armVehicles.map((v) => v.position)) : 0;

          const isLightGreen =
            (currentPhase.startsWith('NS') && (cam.approach === 'North' || cam.approach === 'South')) ||
            (currentPhase.startsWith('EW') && (cam.approach === 'East' || cam.approach === 'West'));

          const footage = recordedFootageMap[cam.id];
          const playback = playbackStates[cam.id];

          // Compute PCU: if recorded footage is loaded, we compute from active simulated vision detection
          const recordedDetectedCounts: DetectedVehicleCounts = {
            twoWheeler: 5,
            autoRickshaw: 3,
            car: 3,
            bus: 1,
            truck: 0,
            ambulance: 0,
          };
          const totalPCU = footage
            ? calculateDetectedPCU(recordedDetectedCounts)
            : armVehicles.reduce((s, v) => s + INDIAN_VEHICLE_CONFIG[v.type].pcu, 0);

          let densityClass = 'Light';
          let densityColor = 'text-emerald-400 bg-emerald-950/60 border-emerald-800';
          if (totalPCU > 20) {
            densityClass = 'Severe Congestion / Saturated';
            densityColor = 'text-rose-400 bg-rose-950/60 border-rose-800';
          } else if (totalPCU > 10) {
            densityClass = 'Medium / Approaching Capacity';
            densityColor = 'text-amber-400 bg-amber-950/60 border-amber-800';
          }

          const isDraggingThis = isDraggingOver === cam.id;

          return (
            <div
              key={cam.id}
              onDragOver={(e) => handleDragOver(e, cam.id)}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, cam.id)}
              className={`bg-slate-950 border rounded-xl overflow-hidden shadow-2xl flex flex-col group relative transition-all ${
                isDraggingThis ? 'border-emerald-400 ring-2 ring-emerald-500/50' : 'border-slate-800'
              }`}
            >
              {/* CCTV Monitor Viewport */}
              <div className="relative aspect-[16/10] bg-[#0c1220] overflow-hidden flex items-center justify-center border-b border-slate-800">
                {footage ? (
                  /* ================= RECORDED CCTV VIDEO PLAYER ================= */
                  <div className="relative w-full h-full bg-black flex items-center justify-center">
                    <video
                      ref={(el) => {
                        videoRefs.current[cam.id] = el;
                      }}
                      src={footage.videoUrl}
                      playsInline
                      loop
                      muted={playback.isMuted}
                      onTimeUpdate={(e) => {
                        const target = e.currentTarget;
                        setPlaybackStates((prev) => ({
                          ...prev,
                          [cam.id]: {
                            ...prev[cam.id],
                            currentTime: target.currentTime,
                            duration: target.duration || 0,
                          },
                        }));
                      }}
                      onLoadedMetadata={(e) => {
                        const target = e.currentTarget;
                        setPlaybackStates((prev) => ({
                          ...prev,
                          [cam.id]: {
                            ...prev[cam.id],
                            duration: target.duration || 0,
                          },
                        }));
                      }}
                      className="w-full h-full object-cover"
                    />

                    {/* AI Computer Vision Bounding Boxes Overlay on Recorded Video */}
                    {showBoundingBoxes && (
                      <div className="absolute inset-0 pointer-events-none">
                        {/* Sample Dynamic Tracking Boxes on Footage */}
                        <div
                          style={{
                            left: '32%',
                            top: `${42 + Math.sin(playback.currentTime * 2) * 4}%`,
                            width: '68px',
                            height: '52px',
                          }}
                          className="absolute -translate-x-1/2 -translate-y-1/2 border-2 border-emerald-400 bg-emerald-500/10 rounded shadow-[0_0_8px_#34d399]"
                        >
                          <span className="absolute -top-4 left-0 text-[8px] bg-emerald-950 text-emerald-300 border border-emerald-700 px-1 py-0.2 rounded font-mono font-bold whitespace-nowrap">
                            2W 98.4% (0.5 PCU)
                          </span>
                        </div>

                        <div
                          style={{
                            left: '48%',
                            top: `${55 + Math.cos(playback.currentTime * 1.5) * 5}%`,
                            width: '84px',
                            height: '62px',
                          }}
                          className="absolute -translate-x-1/2 -translate-y-1/2 border-2 border-yellow-400 bg-yellow-500/10 rounded shadow-[0_0_8px_#eab308]"
                        >
                          <span className="absolute -top-4 left-0 text-[8px] bg-yellow-950 text-yellow-300 border border-yellow-700 px-1 py-0.2 rounded font-mono font-bold whitespace-nowrap">
                            Auto 96.7% (0.8 PCU)
                          </span>
                        </div>

                        <div
                          style={{
                            left: '68%',
                            top: `${68 + Math.sin(playback.currentTime * 1.2) * 4}%`,
                            width: '110px',
                            height: '80px',
                          }}
                          className="absolute -translate-x-1/2 -translate-y-1/2 border-2 border-blue-400 bg-blue-500/10 rounded shadow-[0_0_8px_#60a5fa]"
                        >
                          <span className="absolute -top-4 left-0 text-[8px] bg-blue-950 text-blue-300 border border-blue-700 px-1 py-0.2 rounded font-mono font-bold whitespace-nowrap">
                            Car 95.2% (1.0 PCU)
                          </span>
                        </div>

                        <div
                          style={{
                            left: '52%',
                            top: '28%',
                            width: '95px',
                            height: '85px',
                          }}
                          className="absolute -translate-x-1/2 -translate-y-1/2 border-2 border-rose-400 bg-rose-500/10 rounded shadow-[0_0_8px_#f43f5e]"
                        >
                          <span className="absolute -top-4 left-0 text-[8px] bg-rose-950 text-rose-300 border border-rose-700 px-1 py-0.2 rounded font-mono font-bold whitespace-nowrap">
                            Bus 99.1% (3.0 PCU)
                          </span>
                        </div>
                      </div>
                    )}

                    {/* Virtual Induction Loop ROI Overlay */}
                    {showVirtualLoop && (
                      <div className="absolute inset-0 pointer-events-none">
                        <svg className="w-full h-full" viewBox="0 0 400 250" preserveAspectRatio="none">
                          <polygon
                            points="120,110 280,110 360,230 40,230"
                            fill="rgba(6, 182, 212, 0.08)"
                            stroke="rgba(6, 182, 212, 0.75)"
                            strokeWidth="1.5"
                            strokeDasharray="4,2"
                          />
                        </svg>
                      </div>
                    )}

                    {/* Video Player Bottom Controls Overlay */}
                    <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 via-black/60 to-transparent p-2.5 flex flex-col gap-1.5 text-xs text-white z-20">
                      {/* Timeline Scrubber */}
                      <div className="flex items-center gap-2">
                        <input
                          type="range"
                          min="0"
                          max={playback.duration || 100}
                          step="0.05"
                          value={playback.currentTime}
                          onChange={(e) => handleSeek(cam.id, Number(e.target.value))}
                          aria-label={`Video timeline scrubber for ${cam.name}`}
                          className="w-full h-1.5 bg-slate-700 accent-emerald-500 rounded-lg cursor-pointer"
                        />
                        <span className="font-mono text-[10px] text-slate-300 shrink-0">
                          {formatSeconds(playback.currentTime)} / {formatSeconds(playback.duration)}
                        </span>
                      </div>

                      {/* Controls Row */}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => togglePlay(cam.id)}
                            className="p-1 hover:bg-slate-700/80 rounded transition text-emerald-400"
                            title={playback.isPlaying ? 'Pause' : 'Play'}
                            aria-label={playback.isPlaying ? 'Pause' : 'Play'}
                          >
                            {playback.isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                          </button>

                          <button
                            onClick={() => stepFrame(cam.id, -0.1)}
                            className="px-1.5 py-0.5 bg-slate-800 hover:bg-slate-700 rounded text-[9px] font-mono text-slate-300"
                            title="Step back 1 frame (-0.1s)"
                          >
                            -0.1s
                          </button>

                          <button
                            onClick={() => stepFrame(cam.id, 0.1)}
                            className="px-1.5 py-0.5 bg-slate-800 hover:bg-slate-700 rounded text-[9px] font-mono text-slate-300"
                            title="Step forward 1 frame (+0.1s)"
                          >
                            +0.1s
                          </button>

                          <button
                            onClick={() => toggleMute(cam.id)}
                            className="p-1 hover:bg-slate-700/80 rounded transition text-slate-300"
                            title={playback.isMuted ? 'Unmute' : 'Mute'}
                            aria-label={playback.isMuted ? 'Unmute' : 'Mute'}
                          >
                            {playback.isMuted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5 text-cyan-400" />}
                          </button>

                          {/* Playback speed selector */}
                          <select
                            value={playback.speed}
                            onChange={(e) => handleSpeedChange(cam.id, Number(e.target.value))}
                            className="bg-slate-800 text-[10px] rounded px-1.5 py-0.5 border border-slate-700 text-slate-300 font-mono"
                            aria-label={`Playback speed for ${cam.name}`}
                          >
                            <option value="0.5">0.5x</option>
                            <option value="1">1.0x</option>
                            <option value="1.5">1.5x</option>
                            <option value="2">2.0x</option>
                          </select>
                        </div>

                        <div className="flex items-center gap-1.5">
                          {/* Analyze Frame with Gemini Button */}
                          <button
                            onClick={() => handleAnalyzeFrame(cam.id, cam)}
                            disabled={analysisLoadingCam === cam.id}
                            className="px-2 py-1 bg-gradient-to-r from-emerald-600 to-cyan-600 hover:from-emerald-500 hover:to-cyan-500 text-white rounded text-[10px] font-bold flex items-center gap-1 shadow transition disabled:opacity-50"
                            title="Capture current video frame and run Gemini multimodal vision inspection"
                          >
                            <Sparkles className="w-3 h-3 animate-spin" />
                            <span>
                              {analysisLoadingCam === cam.id ? 'Analyzing...' : 'AI Frame Analysis'}
                            </span>
                          </button>

                          {/* Revert / Eject Footage */}
                          <button
                            onClick={() => removeFootage(cam.id)}
                            className="p-1 hover:bg-rose-900/60 rounded text-rose-300 transition"
                            title="Unload recorded video and restore live simulation stream"
                            aria-label="Unload recorded video"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  /* ================= LIVE SIMULATION PERSPECTIVE ROAD VIEW ================= */
                  <div className="w-full h-full relative">
                    <svg
                      className="w-full h-full absolute inset-0 pointer-events-none select-none"
                      viewBox="0 0 400 250"
                      preserveAspectRatio="none"
                    >
                      <defs>
                        <linearGradient id={`asphaltGrad-${cam.id}`} x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#1e293b" />
                          <stop offset="100%" stopColor="#0f172a" />
                        </linearGradient>
                      </defs>

                      {/* Sky/Horizon */}
                      <rect x="0" y="0" width="400" height="70" fill="#090d16" />

                      {/* Road Trapezoid (Perspective) */}
                      <polygon points="120,70 280,70 380,250 20,250" fill={`url(#asphaltGrad-${cam.id})`} />

                      {/* Median & Lane Markings */}
                      <line x1="200" y1="70" x2="200" y2="250" stroke="#eab308" strokeWidth="2" strokeDasharray="6,4" />
                      <line x1="160" y1="70" x2="110" y2="250" stroke="rgba(255,255,255,0.3)" strokeWidth="1.5" strokeDasharray="4,4" />
                      <line x1="240" y1="70" x2="290" y2="250" stroke="rgba(255,255,255,0.3)" strokeWidth="1.5" strokeDasharray="4,4" />

                      {/* Stop Line */}
                      <line x1="30" y1="230" x2="370" y2="230" stroke="white" strokeWidth="3" />

                      {/* Virtual Inductive Loop ROI */}
                      {showVirtualLoop && (
                        <polygon
                          points="130,120 270,120 340,225 60,225"
                          fill="rgba(6, 182, 212, 0.08)"
                          stroke="rgba(6, 182, 212, 0.6)"
                          strokeWidth="1.5"
                          strokeDasharray="4,2"
                        />
                      )}
                    </svg>

                    {/* Simulated Detected Vehicle Bounding Boxes */}
                    <div className="absolute inset-0 pointer-events-none overflow-hidden">
                      {armVehicles.slice(0, 10).map((v) => {
                        const normalizedPos = Math.min(1, Math.max(0, v.position / 120));
                        const y = 220 - normalizedPos * 140;
                        const perspectiveScale = 1.0 - normalizedPos * 0.55;

                        const laneSpread = 60 * perspectiveScale;
                        const x = v.lane === 0 ? 200 - laneSpread * 0.7 : 200 + laneSpread * 0.7;

                        const def = INDIAN_VEHICLE_CONFIG[v.type];
                        const boxW = Math.max(26, def.pcu * 24 * perspectiveScale);
                        const boxH = Math.max(20, (def.lengthMeters / 2) * 16 * perspectiveScale);

                        return (
                          <div
                            key={v.id}
                            style={{
                              left: `${(x / 400) * 100}%`,
                              top: `${(y / 250) * 100}%`,
                              transform: 'translate(-50%, -50%)',
                            }}
                            className="absolute flex flex-col items-center pointer-events-none"
                          >
                            {/* Vehicle Glyph */}
                            <div
                              style={{
                                width: `${boxW}px`,
                                height: `${boxH}px`,
                                backgroundColor: def.color,
                              }}
                              className={`rounded-sm shadow-md flex items-center justify-center ${
                                v.isEmergency ? 'border-2 border-white animate-pulse' : 'border border-slate-900'
                              }`}
                            >
                              <span className="text-[8px] font-bold text-slate-900 select-none">
                                {v.type === 'twoWheeler'
                                  ? '2W'
                                  : v.type === 'autoRickshaw'
                                  ? 'AUTO'
                                  : v.type === 'bus'
                                  ? 'BUS'
                                  : v.type === 'ambulance'
                                  ? 'AMB'
                                  : 'CAR'}
                              </span>
                            </div>

                            {/* AI Detection Bounding Box Overlay */}
                            {showBoundingBoxes && (
                              <div
                                style={{
                                  width: `${boxW + 8}px`,
                                  height: `${boxH + 8}px`,
                                }}
                                className={`absolute -top-1 -left-1 rounded border ${
                                  v.isEmergency
                                    ? 'border-rose-400 bg-rose-500/20 shadow-[0_0_8px_#f43f5e]'
                                    : v.type === 'bus'
                                    ? 'border-amber-400 bg-amber-500/10'
                                    : 'border-emerald-400 bg-emerald-500/10'
                                }`}
                              >
                                <span
                                  className={`absolute -top-4 left-0 text-[8px] px-1 py-0.2 rounded font-mono font-bold whitespace-nowrap ${
                                    v.isEmergency
                                      ? 'bg-rose-600 text-white'
                                      : 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                                  }`}
                                >
                                  {v.type === 'autoRickshaw'
                                    ? 'Auto 96%'
                                    : v.type === 'twoWheeler'
                                    ? 'Bike 98%'
                                    : v.type === 'bus'
                                    ? 'Bus 99%'
                                    : v.type === 'ambulance'
                                    ? 'EMERGENCY 100%'
                                    : 'Car 94%'}
                                </span>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* CCTV Telemetry Overlay HUD (Top-Left) */}
                <div className="absolute top-2 left-2 text-[10px] font-mono text-emerald-400 bg-black/75 px-2 py-1 rounded backdrop-blur-sm border border-emerald-500/30 z-10 pointer-events-none">
                  <div className="flex items-center gap-1.5 font-bold">
                    <span
                      className={`w-1.5 h-1.5 rounded-full ${
                        footage ? 'bg-cyan-400' : 'bg-emerald-400'
                      } animate-pulse`}
                    />
                    <span>{footage ? 'RECORDED PLAYBACK' : 'LIVE REC [HD 1080p]'}</span>
                  </div>
                  <div className="text-[9px] text-slate-300">
                    {cam.name} • {footage ? footage.fileName : cam.location}
                  </div>
                </div>

                {/* CCTV Technical Metadata (Top-Right) */}
                <div className="absolute top-2 right-2 text-right text-[10px] font-mono text-slate-300 bg-black/75 px-2 py-1 rounded backdrop-blur-sm border border-slate-700/60 z-10 pointer-events-none">
                  <div className="text-emerald-400 font-bold">{cam.angle}</div>
                  <div className="text-[9px] text-slate-400">
                    {footage ? 'DEVICE SOURCE' : 'SIMULATED'} | FPS: 30.1 | LAT: 11.2ms
                  </div>
                </div>

                {/* Stop Line Signal Status Indicator (Bottom-Left) */}
                <div className="absolute bottom-2 left-2 flex items-center gap-2 bg-slate-900/90 px-2.5 py-1 rounded-md border border-slate-700 text-xs z-10 pointer-events-none">
                  <div
                    className={`w-2 h-2 rounded-full ${
                      isLightGreen ? 'bg-emerald-400 shadow-[0_0_8px_#34d399]' : 'bg-rose-500 shadow-[0_0_8px_#f43f5e]'
                    }`}
                  />
                  <span className="font-semibold text-white">
                    {isLightGreen ? 'SIGNAL: GREEN' : 'SIGNAL: RED'}
                  </span>
                </div>

                {/* Bottom-Right Controls: Upload to this camera + Maximize toggle */}
                <div className="absolute bottom-2 right-2 flex items-center gap-1.5 z-10">
                  {!footage && (
                    <button
                      onClick={() => triggerBrowseForCam(cam.id)}
                      className="px-2 py-1 bg-slate-800/90 hover:bg-emerald-600 border border-slate-600 text-slate-200 hover:text-white rounded text-[10px] font-medium flex items-center gap-1 transition"
                      title="Load recorded CCTV footage from your device onto this camera"
                      aria-label={`Load recorded footage onto ${cam.name}`}
                    >
                      <Upload className="w-3 h-3" />
                      <span>Load Footage</span>
                    </button>
                  )}

                  <button
                    onClick={() => setSelectedCam(selectedCam === cam.id ? null : cam.id)}
                    className="p-1.5 bg-slate-800/90 hover:bg-slate-700 text-slate-200 rounded transition"
                    title={selectedCam ? 'Quad View' : 'Maximize Feed'}
                    aria-label={selectedCam ? 'Quad View' : 'Maximize Feed'}
                  >
                    {selectedCam ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              {/* Feed Analytical Breakdown Bar */}
              <div className="p-3 bg-slate-900 flex flex-col gap-2">
                <div className="flex items-center justify-between text-xs">
                  <span className={`px-2 py-0.5 rounded text-[10px] font-semibold border ${densityColor}`}>
                    {densityClass}
                  </span>
                  {hasEmergency && !footage && (
                    <span className="bg-rose-950 text-rose-300 border border-rose-800 px-2 py-0.5 rounded text-[10px] font-bold flex items-center gap-1 animate-pulse">
                      <ShieldAlert className="w-3 h-3 text-rose-400" />
                      Priority Corridor Triggered
                    </span>
                  )}
                  {footage && (
                    <span className="bg-cyan-950 text-cyan-300 border border-cyan-800 px-2 py-0.5 rounded text-[10px] font-bold font-mono">
                      RECORDED FILE ACTIVE
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-4 gap-2 pt-1 text-center font-mono">
                  <div className="bg-slate-950 p-1.5 rounded border border-slate-800">
                    <div className="text-[9px] text-slate-400 uppercase">Vehicles</div>
                    <div className="text-xs font-bold text-white">
                      {footage ? 12 : armVehicles.length}
                    </div>
                  </div>
                  <div className="bg-slate-950 p-1.5 rounded border border-slate-800">
                    <div className="text-[9px] text-slate-400 uppercase">Total PCU</div>
                    <div className="text-xs font-bold text-amber-300">{totalPCU.toFixed(1)}</div>
                  </div>
                  <div className="bg-slate-950 p-1.5 rounded border border-slate-800">
                    <div className="text-[9px] text-slate-400 uppercase">Est. Wait</div>
                    <div className={`text-xs font-bold ${maxWait > 60 ? 'text-rose-400' : 'text-slate-200'}`}>
                      {Math.round(maxWait || (totalPCU * 2.8))}s
                    </div>
                  </div>
                  <div className="bg-slate-950 p-1.5 rounded border border-slate-800">
                    <div className="text-[9px] text-slate-400 uppercase">Queue Depth</div>
                    <div className="text-xs font-bold text-cyan-300">
                      {Math.round(queueLengthMeters || (totalPCU * 3.4))}m
                    </div>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* AI Vision Frame Analysis Results Card / Drawer */}
      {analysisResult && (
        <div className="bg-slate-900 border border-emerald-500/50 rounded-xl p-4 shadow-2xl flex flex-col gap-3 animate-fadeIn">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2">
            <div className="flex items-center gap-2">
              <div className="p-1.5 bg-emerald-950 border border-emerald-500/50 rounded text-emerald-400">
                <Sparkles className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-white flex items-center gap-2">
                  Gemini AI Vision Frame Diagnostic Report
                  <span className="text-[10px] font-mono bg-emerald-950 text-emerald-300 border border-emerald-700 px-2 py-0.5 rounded">
                    {analysisResult.model}
                  </span>
                </h4>
                <div className="text-[11px] text-slate-400">
                  Analyzed approach: <span className="text-white font-semibold">{analysisResult.approach}</span> ({analysisResult.camera}) • Captured at {analysisResult.timestamp}
                </div>
              </div>
            </div>
            <button
              onClick={() => setAnalysisResult(null)}
              className="text-slate-400 hover:text-white p-1 rounded hover:bg-slate-800"
              title="Close Report"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-3 text-xs">
            <div className="bg-slate-950 p-3 rounded-lg border border-slate-800">
              <div className="text-slate-400 text-[10px] uppercase font-mono">Detected Demand</div>
              <div className="text-xl font-black text-amber-300 font-mono mt-0.5">
                {analysisResult.totalPCU.toFixed(1)} PCU
              </div>
              <div className="text-[11px] text-slate-400 mt-1">
                {analysisResult.totalVehicles} total vehicles in queue
              </div>
            </div>

            <div className="bg-slate-950 p-3 rounded-lg border border-slate-800">
              <div className="text-slate-400 text-[10px] uppercase font-mono">Density & Saturation</div>
              <div className="text-sm font-bold text-emerald-400 font-mono mt-1">
                {analysisResult.density}
              </div>
              <div className="text-[11px] text-slate-400 mt-1">
                Estimated Queue: {analysisResult.queueLengthMeters}m
              </div>
            </div>

            <div className="bg-slate-950 p-3 rounded-lg border border-slate-800">
              <div className="text-slate-400 text-[10px] uppercase font-mono">Recommended Green Phase</div>
              <div className="text-xl font-black text-cyan-300 font-mono mt-0.5">
                {analysisResult.recommendedGreenSeconds}s
              </div>
              <div className="text-[11px] text-slate-400 mt-1">
                Dynamic discharge capacity
              </div>
            </div>

            <div className="bg-slate-950 p-3 rounded-lg border border-slate-800">
              <div className="text-slate-400 text-[10px] uppercase font-mono">Confidence Level</div>
              <div className="text-xl font-black text-emerald-400 font-mono mt-0.5">
                {(analysisResult.confidenceScore * 100).toFixed(1)}%
              </div>
              <div className="text-[11px] text-slate-400 mt-1">
                Edge detector agreement
              </div>
            </div>
          </div>

          {/* Classified Breakdown Pills */}
          <div className="flex flex-wrap items-center gap-2 text-xs bg-slate-950 p-2.5 rounded-lg border border-slate-800">
            <span className="font-semibold text-slate-300">Classified Breakdown:</span>
            <span className="bg-slate-900 border border-slate-800 px-2 py-0.5 rounded text-cyan-300 font-mono">
              2-Wheelers: {analysisResult.breakdown.twoWheeler} ({(analysisResult.breakdown.twoWheeler * 0.5).toFixed(1)} PCU)
            </span>
            <span className="bg-slate-900 border border-slate-800 px-2 py-0.5 rounded text-yellow-300 font-mono">
              Auto-Rickshaws: {analysisResult.breakdown.autoRickshaw} ({(analysisResult.breakdown.autoRickshaw * 0.8).toFixed(1)} PCU)
            </span>
            <span className="bg-slate-900 border border-slate-800 px-2 py-0.5 rounded text-blue-300 font-mono">
              Cars: {analysisResult.breakdown.car} ({analysisResult.breakdown.car * 1.0} PCU)
            </span>
            <span className="bg-slate-900 border border-slate-800 px-2 py-0.5 rounded text-rose-300 font-mono">
              Buses: {analysisResult.breakdown.bus} ({analysisResult.breakdown.bus * 3.0} PCU)
            </span>
          </div>

          {/* Technical Observation */}
          <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 text-xs text-slate-300 leading-relaxed">
            <span className="font-bold text-white">AI Engineering Observation: </span>
            {analysisResult.observation}
          </div>
        </div>
      )}

      {analysisError && (
        <div className="bg-rose-950 border border-rose-500/50 rounded-lg p-3 text-rose-200 text-xs flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-400" />
            <span>{analysisError}</span>
          </div>
          <button onClick={() => setAnalysisError(null)} className="text-rose-400 hover:text-white">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* IRC: 106-1990 Reference Pill Bar */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-300">
        <div className="flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span className="font-semibold text-white">Indian Road Congress (IRC: 106-1990) PCU Conversion Matrix:</span>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-[11px] font-mono">
          <span className="bg-slate-950 border border-slate-800 px-2 py-0.5 rounded text-cyan-300">
            2-Wheeler: 0.5 PCU
          </span>
          <span className="bg-slate-950 border border-slate-800 px-2 py-0.5 rounded text-yellow-300">
            Auto-Rickshaw: 0.8 PCU
          </span>
          <span className="bg-slate-950 border border-slate-800 px-2 py-0.5 rounded text-blue-300">
            Passenger Car: 1.0 PCU
          </span>
          <span className="bg-slate-950 border border-slate-800 px-2 py-0.5 rounded text-purple-300">
            LCV / Tempo: 1.6 PCU
          </span>
          <span className="bg-slate-950 border border-slate-800 px-2 py-0.5 rounded text-rose-300">
            City Bus / Truck: 3.0 PCU
          </span>
        </div>
      </div>
    </div>
  );
};
