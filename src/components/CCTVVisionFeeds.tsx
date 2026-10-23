/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
  ApproachDirection,
  INDIAN_VEHICLE_CONFIG,
  SimVehicle,
  VehicleType,
} from '../utils/traffic-engine';
import {
  Camera,
  Cpu,
  Layers,
  Eye,
  Maximize2,
  Minimize2,
  ShieldAlert,
  Zap,
  Activity,
  CheckCircle2,
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

export const CCTVVisionFeeds: React.FC<CCTVVisionFeedsProps> = ({
  vehicles,
  currentPhase,
}) => {
  const [showBoundingBoxes, setShowBoundingBoxes] = useState<boolean>(true);
  const [showVirtualLoop, setShowVirtualLoop] = useState<boolean>(true);
  const [selectedCam, setSelectedCam] = useState<string | null>(null);

  const getApproachVehicles = (dir: ApproachDirection) =>
    vehicles.filter((v) => v.approach === dir && !v.hasCrossed);

  return (
    <div className="flex flex-col gap-4">
      {/* CCTV Header & Controls */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-xl flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-emerald-950 border border-emerald-500/40 rounded-lg text-emerald-400">
            <Camera className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <div className="text-xs font-semibold text-emerald-400 uppercase tracking-wider flex items-center gap-2">
              <span>Edge AI Computer Vision</span>
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
            </div>
            <div className="text-base font-bold text-white flex items-center gap-2">
              Junction CCTV Quad Feeds & Heterogeneous Vehicle Detection
            </div>
          </div>
        </div>

        {/* AI Vision Toggles */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowBoundingBoxes(!showBoundingBoxes)}
            className={`px-3 py-1.5 text-xs rounded-lg border font-medium flex items-center gap-1.5 transition ${
              showBoundingBoxes
                ? 'bg-emerald-600/20 border-emerald-500 text-emerald-300'
                : 'bg-slate-800 border-slate-700 text-slate-400'
            }`}
          >
            <Eye className="w-3.5 h-3.5" />
            AI Bounding Boxes: {showBoundingBoxes ? 'ON' : 'OFF'}
          </button>

          <button
            onClick={() => setShowVirtualLoop(!showVirtualLoop)}
            className={`px-3 py-1.5 text-xs rounded-lg border font-medium flex items-center gap-1.5 transition ${
              showVirtualLoop
                ? 'bg-cyan-600/20 border-cyan-500 text-cyan-300'
                : 'bg-slate-800 border-slate-700 text-slate-400'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            Virtual Induction ROI: {showVirtualLoop ? 'VISIBLE' : 'HIDDEN'}
          </button>

          <div className="flex items-center gap-2 bg-slate-950 px-3 py-1.5 rounded-lg border border-slate-800 text-xs text-slate-300 font-mono">
            <Cpu className="w-3.5 h-3.5 text-emerald-400" />
            <span>YOLOv8-Nano (Edge TPU): 11.2ms</span>
          </div>
        </div>
      </div>

      {/* CCTV Grid (Quad View) or Single Expanded View */}
      <div className={`grid gap-4 ${selectedCam ? 'grid-cols-1' : 'grid-cols-1 md:grid-cols-2'}`}>
        {CAMERAS.filter((cam) => !selectedCam || cam.id === selectedCam).map((cam) => {
          const armVehicles = getApproachVehicles(cam.approach);
          const totalPCU = armVehicles.reduce((s, v) => s + INDIAN_VEHICLE_CONFIG[v.type].pcu, 0);
          const hasEmergency = armVehicles.some((v) => v.isEmergency);
          const maxWait = armVehicles.length > 0 ? Math.max(...armVehicles.map((v) => v.waitingTime)) : 0;
          const queueLengthMeters = armVehicles.length > 0 ? Math.max(...armVehicles.map((v) => v.position)) : 0;

          const isLightGreen =
            (currentPhase.startsWith('NS') && (cam.approach === 'North' || cam.approach === 'South')) ||
            (currentPhase.startsWith('EW') && (cam.approach === 'East' || cam.approach === 'West'));

          let densityClass = 'Light';
          let densityColor = 'text-emerald-400 bg-emerald-950/60 border-emerald-800';
          if (totalPCU > 20) {
            densityClass = 'Severe Congestion / Saturated';
            densityColor = 'text-rose-400 bg-rose-950/60 border-rose-800';
          } else if (totalPCU > 10) {
            densityClass = 'Medium / Approaching Capacity';
            densityColor = 'text-amber-400 bg-amber-950/60 border-amber-800';
          }

          return (
            <div
              key={cam.id}
              className="bg-slate-950 border border-slate-800 rounded-xl overflow-hidden shadow-2xl flex flex-col group relative"
            >
              {/* CCTV Video Monitor Container */}
              <div className="relative aspect-[16/10] bg-[#0c1220] overflow-hidden flex items-center justify-center border-b border-slate-800">
                {/* Simulated Perspective Road View */}
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
                  {armVehicles.slice(0, 10).map((v, idx) => {
                    // Map vehicle position (0 to 150m) to perspective Y (220 to 80)
                    const normalizedPos = Math.min(1, Math.max(0, v.position / 120));
                    const y = 220 - normalizedPos * 140; // 80 to 220
                    const perspectiveScale = 1.0 - normalizedPos * 0.55; // 0.45 to 1.0

                    // Lane X positioning
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

                {/* CCTV Telemetry Overlay HUD */}
                <div className="absolute top-2 left-2 text-[10px] font-mono text-emerald-400 bg-black/60 px-2 py-1 rounded backdrop-blur-sm border border-emerald-500/30">
                  <div className="flex items-center gap-1.5 font-bold">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    LIVE REC [HD 1080p]
                  </div>
                  <div className="text-[9px] text-slate-300">{cam.name} • {cam.location}</div>
                </div>

                <div className="absolute top-2 right-2 text-right text-[10px] font-mono text-slate-300 bg-black/60 px-2 py-1 rounded backdrop-blur-sm border border-slate-700/60">
                  <div className="text-emerald-400 font-bold">{cam.angle}</div>
                  <div className="text-[9px] text-slate-400">FPS: 30.1 | LAT: 11.2ms</div>
                </div>

                {/* Stop Line Signal Status Indicator */}
                <div className="absolute bottom-2 left-2 flex items-center gap-2 bg-slate-900/90 px-2.5 py-1 rounded-md border border-slate-700 text-xs">
                  <div
                    className={`w-2 h-2 rounded-full ${
                      isLightGreen ? 'bg-emerald-400 shadow-[0_0_8px_#34d399]' : 'bg-rose-500 shadow-[0_0_8px_#f43f5e]'
                    }`}
                  />
                  <span className="font-semibold text-white">
                    {isLightGreen ? 'SIGNAL: GREEN' : 'SIGNAL: RED'}
                  </span>
                </div>

                {/* Maximize Toggle */}
                <button
                  onClick={() => setSelectedCam(selectedCam === cam.id ? null : cam.id)}
                  className="absolute bottom-2 right-2 p-1.5 bg-slate-800/80 hover:bg-slate-700 text-slate-200 rounded transition"
                  title={selectedCam ? 'Quad View' : 'Maximize Feed'}
                  aria-label={selectedCam ? 'Quad View' : 'Maximize Feed'}
                >
                  {selectedCam ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
                </button>
              </div>

              {/* Feed Analytical Breakdown */}
              <div className="p-3 bg-slate-900 flex flex-col gap-2">
                <div className="flex items-center justify-between text-xs">
                  <span className={`px-2 py-0.5 rounded text-[10px] font-semibold border ${densityColor}`}>
                    {densityClass}
                  </span>
                  {hasEmergency && (
                    <span className="bg-rose-950 text-rose-300 border border-rose-800 px-2 py-0.5 rounded text-[10px] font-bold flex items-center gap-1 animate-pulse">
                      <ShieldAlert className="w-3 h-3 text-rose-400" />
                      Priority Corridor Triggered
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-4 gap-2 pt-1 text-center font-mono">
                  <div className="bg-slate-950 p-1.5 rounded border border-slate-800">
                    <div className="text-[9px] text-slate-400 uppercase">Vehicles</div>
                    <div className="text-xs font-bold text-white">{armVehicles.length}</div>
                  </div>
                  <div className="bg-slate-950 p-1.5 rounded border border-slate-800">
                    <div className="text-[9px] text-slate-400 uppercase">Total PCU</div>
                    <div className="text-xs font-bold text-amber-300">{totalPCU.toFixed(1)}</div>
                  </div>
                  <div className="bg-slate-950 p-1.5 rounded border border-slate-800">
                    <div className="text-[9px] text-slate-400 uppercase">Max Wait</div>
                    <div className={`text-xs font-bold ${maxWait > 60 ? 'text-rose-400' : 'text-slate-200'}`}>
                      {Math.round(maxWait)}s
                    </div>
                  </div>
                  <div className="bg-slate-950 p-1.5 rounded border border-slate-800">
                    <div className="text-[9px] text-slate-400 uppercase">Queue Depth</div>
                    <div className="text-xs font-bold text-cyan-300">{Math.round(queueLengthMeters)}m</div>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

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
