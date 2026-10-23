/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState } from 'react';
import {
  ApproachDirection,
  INDIAN_VEHICLE_CONFIG,
  SignalPhase,
  SimVehicle,
  VehicleType,
  ControllerMode,
  ControllerParams,
  DEFAULT_CONTROLLER_PARAMS,
  calculateAxisScore,
  calculateGreenDuration,
  calculateJainsFairnessIndex,
  calculateTotalPCU,
  calculateEmissions,
  generateTelemetryCSV,
  SimulationSnapshotData,
  ApproachQueueState,
  TrafficEventLog,
  TrafficEventCategory,
} from '../utils/traffic-engine';
import { TRAFFIC_SCENARIOS, TrafficScenario, generateVehicle } from '../utils/mock-generator';
import { TrafficEventLogPanel } from './TrafficEventLogPanel';
import {
  Play,
  Pause,
  RotateCcw,
  AlertTriangle,
  Siren,
  Sliders,
  Gauge,
  Clock,
  Car,
  Fuel,
  Info,
  ChevronRight,
  ShieldCheck,
  Download,
  FileSpreadsheet,
} from 'lucide-react';

interface IntersectionSimulationProps {
  onTelemetryUpdate?: (telemetry: {
    queueN: number;
    queueS: number;
    queueE: number;
    queueW: number;
    fairnessIndex: number;
    maxWaitSeconds: number;
    avgWaitSeconds: number;
    vehiclesCrossed: number;
    currentPhase: SignalPhase;
    phaseTimeRemaining: number;
    hasEmergency: boolean;
    mode: ControllerMode;
    vehicles: SimVehicle[];
    params: ControllerParams;
    activeScenario: TrafficScenario;
  }) => void;
}

export const IntersectionSimulation: React.FC<IntersectionSimulationProps> = ({
  onTelemetryUpdate,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Controller State
  const [mode, setMode] = useState<ControllerMode>('fairnessAware');
  const [params, setParams] = useState<ControllerParams>(DEFAULT_CONTROLLER_PARAMS);
  const [scenarioKey, setScenarioKey] = useState<string>('extremeAsymmetry');
  const [isPlaying, setIsPlaying] = useState<boolean>(true);
  const [simSpeed, setSimSpeed] = useState<number>(1.5);
  const [showSettings, setShowSettings] = useState<boolean>(false);

  // Metrics Display
  const [phase, setPhase] = useState<SignalPhase>('NS_GREEN');
  const [phaseTimeLeft, setPhaseTimeLeft] = useState<number>(25);
  const [allocatedGreen, setAllocatedGreen] = useState<number>(25);
  const [jainsIndex, setJainsIndex] = useState<number>(0.92);
  const [totalCrossed, setTotalCrossed] = useState<number>(0);
  const [emergencyAlert, setEmergencyAlert] = useState<string | null>(null);

  // Queues & Decision telemetry
  const [armTelemetry, setArmTelemetry] = useState<{
    North: { pcu: number; count: number; maxWait: number };
    South: { pcu: number; count: number; maxWait: number };
    East: { pcu: number; count: number; maxWait: number };
    West: { pcu: number; count: number; maxWait: number };
  }>({
    North: { pcu: 0, count: 0, maxWait: 0 },
    South: { pcu: 0, count: 0, maxWait: 0 },
    East: { pcu: 0, count: 0, maxWait: 0 },
    West: { pcu: 0, count: 0, maxWait: 0 },
  });

  // Real-Time Event Log State
  const [events, setEvents] = useState<TrafficEventLog[]>([]);
  const eventsRef = useRef<TrafficEventLog[]>([]);
  const simElapsedSecondsRef = useRef<number>(0);
  const lastBreachAlertRef = useRef<Record<string, number>>({});
  const lastCongestionAlertRef = useRef<Record<string, number>>({});
  const lastFairnessAlertRef = useRef<number>(0);
  const lastGreenPhaseRef = useRef<'NS' | 'EW'>('EW');

  const addEvent = (
    category: TrafficEventCategory,
    title: string,
    details: string,
    severity: 'info' | 'warning' | 'critical' | 'success',
    approach?: ApproachDirection,
    metricValue?: string
  ) => {
    const now = new Date();
    const timeStr = now.toTimeString().split(' ')[0];
    const newEvt: TrafficEventLog = {
      id: `evt-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      simTimeSeconds: simElapsedSecondsRef.current,
      wallClockTime: timeStr,
      category,
      severity,
      approach,
      title,
      details,
      metricValue,
    };
    eventsRef.current = [newEvt, ...eventsRef.current.slice(0, 99)];
    setEvents([...eventsRef.current]);
  };

  // State refs for simulation loop without re-render lag
  const vehiclesRef = useRef<SimVehicle[]>([]);
  const phaseRef = useRef<SignalPhase>('NS_GREEN');
  const phaseTimerRef = useRef<number>(25);
  const currentScenarioRef = useRef<TrafficScenario>(TRAFFIC_SCENARIOS.extremeAsymmetry);
  const modeRef = useRef<ControllerMode>('fairnessAware');
  const paramsRef = useRef<ControllerParams>(DEFAULT_CONTROLLER_PARAMS);
  const totalCrossedRef = useRef<number>(0);
  const lastSpawnRef = useRef<Record<ApproachDirection, number>>({
    North: 0,
    South: 0,
    East: 0,
    West: 0,
  });

  useEffect(() => {
    modeRef.current = mode;
  }, [mode]);

  useEffect(() => {
    paramsRef.current = params;
  }, [params]);

  useEffect(() => {
    currentScenarioRef.current = TRAFFIC_SCENARIOS[scenarioKey];
  }, [scenarioKey]);

  // Initial seed of vehicles
  const resetSimulation = () => {
    vehiclesRef.current = [];
    totalCrossedRef.current = 0;
    setTotalCrossed(0);
    phaseRef.current = 'NS_GREEN';
    phaseTimerRef.current = 25;
    lastGreenPhaseRef.current = 'NS';
    setPhase('NS_GREEN');
    setPhaseTimeLeft(25);
    setEmergencyAlert(null);
    simElapsedSecondsRef.current = 0;
    lastBreachAlertRef.current = {};
    lastCongestionAlertRef.current = {};
    lastFairnessAlertRef.current = 0;

    eventsRef.current = [];
    setEvents([]);

    addEvent(
      'PHASE_CHANGE',
      'Simulation & Signal Controller Initialized',
      `Operating under ${currentScenarioRef.current.name} with ${modeRef.current} algorithm.`,
      'info',
      undefined,
      'INITIALIZED'
    );

    // Spawn initial cohort
    const scenario = currentScenarioRef.current;
    (['North', 'South', 'East', 'West'] as ApproachDirection[]).forEach((dir) => {
      const initialCount = dir === 'North' || dir === 'South' ? 4 : 2;
      for (let i = 0; i < initialCount; i++) {
        const v = generateVehicle(dir, scenario);
        v.position = 15 + i * 14 + Math.random() * 5;
        v.speed = 0;
        vehiclesRef.current.push(v);
      }
    });
  };

  useEffect(() => {
    resetSimulation();
  }, [scenarioKey]);

  // Trigger emergency ambulance
  const spawnAmbulance = (approach: ApproachDirection = 'South') => {
    const ambulance = generateVehicle(approach, currentScenarioRef.current, true);
    ambulance.position = 120;
    ambulance.speed = 12;
    ambulance.lane = 0;
    vehiclesRef.current.push(ambulance);
    setEmergencyAlert(`🚨 Emergency Ambulance detected on ${approach} approach! Signal preemption initiating.`);

    addEvent(
      'EMERGENCY_OVERRIDE',
      `Emergency Priority Triggered: ${approach} Approach`,
      `Inbound emergency ambulance detected 120m upstream. Preemption override triggered to clear green wave corridor.`,
      'critical',
      approach,
      'AMBULANCE PREEMPTION'
    );

    setTimeout(() => {
      setEmergencyAlert(null);
    }, 8000);
  };

  // Manual inject vehicle
  const injectVehicle = (type: VehicleType, approach: ApproachDirection) => {
    const v = generateVehicle(approach, currentScenarioRef.current);
    v.type = type;
    v.position = 180;
    v.speed = 8;
    vehiclesRef.current.push(v);
  };

  // Export current simulation telemetry to structured CSV
  const exportSimulationCSV = () => {
    const currentVehicles = vehiclesRef.current;
    const armNorth = getApproachState('North', currentVehicles);
    const armSouth = getApproachState('South', currentVehicles);
    const armEast = getApproachState('East', currentVehicles);
    const armWest = getApproachState('West', currentVehicles);
    const emissions = calculateEmissions(currentVehicles);

    const snapshotData: SimulationSnapshotData = {
      timestamp: new Date().toISOString(),
      scenarioName: currentScenarioRef.current.name,
      scenarioId: currentScenarioRef.current.id,
      controllerMode: modeRef.current,
      currentPhase: phaseRef.current,
      phaseTimeRemaining: Math.max(0, Math.ceil(phaseTimerRef.current)),
      allocatedGreenTime: allocatedGreen,
      jainsFairnessIndex: jainsIndex,
      throughputCrossed: totalCrossedRef.current,
      alphaDemandWeight: paramsRef.current.alpha,
      betaFairnessWeight: paramsRef.current.beta,
      starvationThresholdSec: paramsRef.current.maxAcceptableWait,
      armTelemetry: {
        North: { pcu: armNorth.totalPCU, count: armNorth.totalVehicles, maxWait: armNorth.maxWaitSeconds, avgWait: armNorth.avgWaitSeconds },
        South: { pcu: armSouth.totalPCU, count: armSouth.totalVehicles, maxWait: armSouth.maxWaitSeconds, avgWait: armSouth.avgWaitSeconds },
        East: { pcu: armEast.totalPCU, count: armEast.totalVehicles, maxWait: armEast.maxWaitSeconds, avgWait: armEast.avgWaitSeconds },
        West: { pcu: armWest.totalPCU, count: armWest.totalVehicles, maxWait: armWest.maxWaitSeconds, avgWait: armWest.avgWaitSeconds },
      },
      vehicles: currentVehicles,
      emissions,
    };

    const csvContent = generateTelemetryCSV(snapshotData);
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `traffic_telemetry_${currentScenarioRef.current.id}_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Main Canvas & Physics Loop
  useEffect(() => {
    let animationFrameId: number;
    let lastTime = performance.now();

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const render = (currentTime: number) => {
      const deltaSec = Math.min((currentTime - lastTime) / 1000, 0.1) * (isPlaying ? simSpeed : 0);
      lastTime = currentTime;

      const p = paramsRef.current;
      const currentMode = modeRef.current;
      const scenario = currentScenarioRef.current;

      // 1. Spawning Logic based on Scenario Arrival Rates
      if (isPlaying) {
        (['North', 'South', 'East', 'West'] as ApproachDirection[]).forEach((dir) => {
          const ratePerMinute = scenario.spawnRates[dir];
          const intervalSec = 60 / Math.max(1, ratePerMinute);
          lastSpawnRef.current[dir] += deltaSec;

          if (lastSpawnRef.current[dir] >= intervalSec) {
            lastSpawnRef.current[dir] = 0;
            // Only spawn if lane entrance isn't packed
            const vehiclesOnApproach = vehiclesRef.current.filter((v) => v.approach === dir && !v.hasCrossed);
            const tailVeh = vehiclesOnApproach.find((v) => v.position > 190);
            if (!tailVeh) {
              const newVeh = generateVehicle(dir, scenario);
              vehiclesRef.current.push(newVeh);
            }
          }
        });

        // 2. Traffic Signal Controller State Machine
        simElapsedSecondsRef.current += deltaSec;
        phaseTimerRef.current -= deltaSec;

        if (phaseTimerRef.current <= 0) {
          // Phase Transition logic
          const current = phaseRef.current;
          if (current === 'NS_GREEN') {
            phaseRef.current = 'NS_YELLOW';
            phaseTimerRef.current = p.yellowTime;
            addEvent(
              'PHASE_CHANGE',
              'North-South Clearance (Yellow)',
              'North-South green terminated. 3-second yellow clearance phase active.',
              'warning',
              undefined,
              `${p.yellowTime}s Yellow`
            );
          } else if (current === 'NS_YELLOW') {
            phaseRef.current = 'ALL_RED';
            phaseTimerRef.current = p.allRedTime;
            addEvent(
              'PHASE_CHANGE',
              'All-Red Safety Clearance',
              'All signal heads red to allow remaining vehicles to evacuate yellow box junction.',
              'info',
              undefined,
              `${p.allRedTime}s All-Red`
            );
          } else if (current === 'ALL_RED') {
            // Determine next phase based on Controller Mode!
            const armStates: Record<ApproachDirection, ApproachQueueState> = {
              North: getApproachState('North', vehiclesRef.current),
              South: getApproachState('South', vehiclesRef.current),
              East: getApproachState('East', vehiclesRef.current),
              West: getApproachState('West', vehiclesRef.current),
            };

            const nsScore = calculateAxisScore([armStates.North, armStates.South], p, currentMode);
            const ewScore = calculateAxisScore([armStates.East, armStates.West], p, currentMode);

            let nextPhaseType: 'NS' | 'EW' = 'EW';

            if (currentMode === 'fixed') {
              // Static alternation
              nextPhaseType = lastGreenPhaseRef.current === 'NS' ? 'EW' : 'NS';
              lastGreenPhaseRef.current = nextPhaseType;

              if (nextPhaseType === 'EW') {
                phaseRef.current = 'EW_GREEN';
                const duration = 28;
                phaseTimerRef.current = duration;
                setAllocatedGreen(duration);
                addEvent(
                  'PHASE_CHANGE',
                  'East-West Green Allocated',
                  'Fixed-time pre-timed static cycle transition to East-West.',
                  'info',
                  undefined,
                  '28s Green'
                );
              } else {
                phaseRef.current = 'NS_GREEN';
                const duration = 28;
                phaseTimerRef.current = duration;
                setAllocatedGreen(duration);
                addEvent(
                  'PHASE_CHANGE',
                  'North-South Green Allocated',
                  'Fixed-time pre-timed static cycle transition to North-South.',
                  'info',
                  undefined,
                  '28s Green'
                );
              }
            } else {
              // Adaptive mode
              if (nsScore.hasEmergency && !ewScore.hasEmergency) {
                nextPhaseType = 'NS';
              } else if (ewScore.hasEmergency && !nsScore.hasEmergency) {
                nextPhaseType = 'EW';
              } else {
                // Pick highest score
                nextPhaseType = ewScore.score >= nsScore.score ? 'EW' : 'NS';
              }
              lastGreenPhaseRef.current = nextPhaseType;

              if (nextPhaseType === 'EW') {
                phaseRef.current = 'EW_GREEN';
                const duration = calculateGreenDuration(ewScore.pcu, p);
                phaseTimerRef.current = duration;
                setAllocatedGreen(duration);
                const reason = ewScore.hasEmergency
                  ? 'EMERGENCY OVERRIDE: Priority ambulance corridor'
                  : currentMode === 'fairnessAware' && ewScore.maxWait > 60
                  ? `Fairness barrier non-linear escalation (Max Wait: ${Math.round(ewScore.maxWait)}s)`
                  : `PCU demand score: ${ewScore.pcu.toFixed(1)} PCU`;
                addEvent(
                  ewScore.hasEmergency ? 'EMERGENCY_OVERRIDE' : 'PHASE_CHANGE',
                  'East-West Green Allocated',
                  `Adaptive green duration: ${duration}s. Decision driver: ${reason}`,
                  ewScore.hasEmergency ? 'critical' : 'success',
                  undefined,
                  `${duration}s Green`
                );
              } else {
                phaseRef.current = 'NS_GREEN';
                const duration = calculateGreenDuration(nsScore.pcu, p);
                phaseTimerRef.current = duration;
                setAllocatedGreen(duration);
                const reason = nsScore.hasEmergency
                  ? 'EMERGENCY OVERRIDE: Priority ambulance corridor'
                  : currentMode === 'fairnessAware' && nsScore.maxWait > 60
                  ? `Fairness barrier non-linear escalation (Max Wait: ${Math.round(nsScore.maxWait)}s)`
                  : `Servicing heavy arterial flow (${nsScore.pcu.toFixed(1)} PCU queued)`;
                addEvent(
                  nsScore.hasEmergency ? 'EMERGENCY_OVERRIDE' : 'PHASE_CHANGE',
                  'North-South Green Allocated',
                  `Adaptive green duration: ${duration}s. Decision driver: ${reason}`,
                  nsScore.hasEmergency ? 'critical' : 'success',
                  undefined,
                  `${duration}s Green`
                );
              }
            }
          } else if (current === 'EW_GREEN') {
            phaseRef.current = 'EW_YELLOW';
            phaseTimerRef.current = p.yellowTime;
            addEvent(
              'PHASE_CHANGE',
              'East-West Clearance (Yellow)',
              'East-West green terminated. 3-second yellow clearance phase active.',
              'warning',
              undefined,
              `${p.yellowTime}s Yellow`
            );
          } else if (current === 'EW_YELLOW') {
            phaseRef.current = 'ALL_RED';
            phaseTimerRef.current = p.allRedTime;
            addEvent(
              'PHASE_CHANGE',
              'All-Red Safety Clearance',
              'All signal heads red to allow remaining vehicles to evacuate yellow box junction.',
              'info',
              undefined,
              `${p.allRedTime}s All-Red`
            );
          }
        }

        // 3. Vehicle Physics & Motion Simulation
        const activeGreenPhase = phaseRef.current;
        const vehicles = vehiclesRef.current;

        // Group vehicles by approach and lane to handle following distance
        const lanes: Record<string, SimVehicle[]> = {};
        for (const v of vehicles) {
          if (v.hasCrossed) continue;
          const key = `${v.approach}-${v.lane}`;
          if (!lanes[key]) lanes[key] = [];
          lanes[key].push(v);
        }

        // Sort each lane closest to stop line first (ascending position)
        Object.values(lanes).forEach((list) => {
          list.sort((a, b) => a.position - b.position);
        });

        // Update each vehicle
        for (let i = 0; i < vehicles.length; i++) {
          const v = vehicles[i];
          const isNS = v.approach === 'North' || v.approach === 'South';
          const isGreen = isNS ? activeGreenPhase === 'NS_GREEN' : activeGreenPhase === 'EW_GREEN';
          const isYellow = isNS ? activeGreenPhase === 'NS_YELLOW' : activeGreenPhase === 'EW_YELLOW';

          const def = INDIAN_VEHICLE_CONFIG[v.type];
          const vehLen = def.lengthMeters;

          if (v.hasCrossed) {
            // Moving away after crossing
            v.position -= v.speed * deltaSec;
            v.speed = Math.min(v.speed + 4 * deltaSec, 11); // accelerate up to ~40 km/h
          } else {
            // Approaching intersection
            const laneKey = `${v.approach}-${v.lane}`;
            const sameLane = lanes[laneKey] || [];
            const myIndex = sameLane.findIndex((item) => item.id === v.id);
            const vehAhead = myIndex > 0 ? sameLane[myIndex - 1] : null;

            // Target stop position: either the stop line (pos = 0) or behind the vehicle ahead
            let targetStopPos = 0;
            if (vehAhead) {
              const safeGap = vehAhead.isEmergency ? 4.0 : 2.5;
              targetStopPos = vehAhead.position + INDIAN_VEHICLE_CONFIG[vehAhead.type].lengthMeters + safeGap;
            }

            const canProceed = isGreen || (isYellow && v.position < 6);

            if (canProceed && (!vehAhead || vehAhead.position < v.position)) {
              // Accelerate through
              const maxSpeed = v.isEmergency ? 14 : 9.5;
              v.speed = Math.min(v.speed + 3.5 * deltaSec, maxSpeed);
              v.position -= v.speed * deltaSec;

              if (v.position <= 0) {
                // Crossed stop line!
                v.hasCrossed = true;
                v.position = -2;
                totalCrossedRef.current += 1;
                if (v.isEmergency) {
                  addEvent(
                    'EMERGENCY_CLEARED',
                    'Ambulance Cleared Intersection',
                    `Priority ambulance on ${v.approach} approach traversed junction safely. Normal adaptive cycle resuming.`,
                    'success',
                    v.approach,
                    'CLEARED'
                  );
                }
              }
            } else {
              // Must stop or decelerate before targetStopPos
              const distToStop = v.position - targetStopPos;

              if (distToStop > 0.5) {
                // Decelerate smoothly
                const desiredDecel = (v.speed * v.speed) / (2 * Math.max(0.5, distToStop));
                v.speed = Math.max(0, v.speed - Math.min(desiredDecel + 1.5, 6) * deltaSec);
                v.position -= v.speed * deltaSec;
                if (v.position < targetStopPos) v.position = targetStopPos;
              } else {
                v.speed = 0;
                v.position = targetStopPos;
                v.waitingTime += deltaSec;
              }
            }
          }
        }

        // Cleanup vehicles that have moved far away (> 250m past intersection)
        vehiclesRef.current = vehicles.filter((v) => !v.hasCrossed || v.position > -220);
      }

      // 4. Update UI Telemetry
      const currentVehicles = vehiclesRef.current;
      const armNorth = getApproachState('North', currentVehicles);
      const armSouth = getApproachState('South', currentVehicles);
      const armEast = getApproachState('East', currentVehicles);
      const armWest = getApproachState('West', currentVehicles);

      const waits = [armNorth.maxWaitSeconds, armSouth.maxWaitSeconds, armEast.maxWaitSeconds, armWest.maxWaitSeconds];
      const calculatedFairness = calculateJainsFairnessIndex(waits);

      setPhase(phaseRef.current);
      setPhaseTimeLeft(Math.max(0, Math.ceil(phaseTimerRef.current)));
      setJainsIndex(calculatedFairness);
      setTotalCrossed(totalCrossedRef.current);

      setArmTelemetry({
        North: { pcu: Number(armNorth.totalPCU.toFixed(1)), count: armNorth.totalVehicles, maxWait: Math.round(armNorth.maxWaitSeconds) },
        South: { pcu: Number(armSouth.totalPCU.toFixed(1)), count: armSouth.totalVehicles, maxWait: Math.round(armSouth.maxWaitSeconds) },
        East: { pcu: Number(armEast.totalPCU.toFixed(1)), count: armEast.totalVehicles, maxWait: Math.round(armEast.maxWaitSeconds) },
        West: { pcu: Number(armWest.totalPCU.toFixed(1)), count: armWest.totalVehicles, maxWait: Math.round(armWest.maxWaitSeconds) },
      });

      // Real-time Traffic Threshold Breach Detection
      const simTime = simElapsedSecondsRef.current;
      (['North', 'South', 'East', 'West'] as ApproachDirection[]).forEach((dir) => {
        const arm = dir === 'North' ? armNorth : dir === 'South' ? armSouth : dir === 'East' ? armEast : armWest;
        
        // 1. Starvation Limit Breach
        if (arm.maxWaitSeconds >= p.maxAcceptableWait && arm.totalVehicles > 0) {
          const lastAlert = lastBreachAlertRef.current[dir] || 0;
          if (simTime - lastAlert > 18) {
            lastBreachAlertRef.current[dir] = simTime;
            addEvent(
              'STARVATION_BREACH',
              `Starvation Threshold Exceeded: ${dir} Approach`,
              `Maximum waiting time reached ${Math.round(arm.maxWaitSeconds)}s (Limit: ${p.maxAcceptableWait}s). Urgency penalty escalated to force green clearance.`,
              'critical',
              dir,
              `${Math.round(arm.maxWaitSeconds)}s Wait`
            );
          }
        }

        // 2. High PCU Queue Surge
        if (arm.totalPCU >= 14.0) {
          const lastCong = lastCongestionAlertRef.current[dir] || 0;
          if (simTime - lastCong > 22) {
            lastCongestionAlertRef.current[dir] = simTime;
            addEvent(
              'PCU_SURGE',
              `Heavy PCU Queue Surge: ${dir} Approach`,
              `Queue density reached ${arm.totalPCU.toFixed(1)} PCU with ${arm.totalVehicles} vehicles queued in approach.`,
              'warning',
              dir,
              `${arm.totalPCU.toFixed(1)} PCU`
            );
          }
        }
      });

      // 3. Jain's Fairness Degradation Warning
      if (calculatedFairness < 0.65) {
        if (simTime - lastFairnessAlertRef.current > 28) {
          lastFairnessAlertRef.current = simTime;
          addEvent(
            'FAIRNESS_DROP',
            "Jain's Fairness Degradation Warning",
            `Fairness index dropped to ${(calculatedFairness * 100).toFixed(0)}%. Severe delay disparity detected between arterial and feeder approaches.`,
            'warning',
            undefined,
            `${(calculatedFairness * 100).toFixed(0)}% J-Index`
          );
        }
      }

      if (onTelemetryUpdate) {
        onTelemetryUpdate({
          queueN: Number(armNorth.totalPCU.toFixed(1)),
          queueS: Number(armSouth.totalPCU.toFixed(1)),
          queueE: Number(armEast.totalPCU.toFixed(1)),
          queueW: Number(armWest.totalPCU.toFixed(1)),
          fairnessIndex: calculatedFairness,
          maxWaitSeconds: Math.round(Math.max(...waits)),
          avgWaitSeconds: Math.round(waits.reduce((a, b) => a + b, 0) / 4),
          vehiclesCrossed: totalCrossedRef.current,
          currentPhase: phaseRef.current,
          phaseTimeRemaining: Math.ceil(phaseTimerRef.current),
          hasEmergency: currentVehicles.some((v) => v.isEmergency && !v.hasCrossed),
          mode: modeRef.current,
          vehicles: currentVehicles,
          params: paramsRef.current,
          activeScenario: currentScenarioRef.current,
        });
      }

      // 5. Canvas Drawing
      drawIntersection(ctx, canvas.width, canvas.height, phaseRef.current, vehiclesRef.current, {
        North: armNorth,
        South: armSouth,
        East: armEast,
        West: armWest,
      });

      animationFrameId = requestAnimationFrame(render);
    };

    animationFrameId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animationFrameId);
  }, [isPlaying, simSpeed]);

  return (
    <div className="flex flex-col gap-4">
      {/* Top Controller Ribbon */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-xl flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="relative">
            <div
              className={`w-3.5 h-3.5 rounded-full ${
                phase.includes('GREEN') ? 'bg-emerald-500 shadow-[0_0_12px_#10b981]' : phase.includes('YELLOW') ? 'bg-amber-400 shadow-[0_0_12px_#f59e0b]' : 'bg-rose-500 shadow-[0_0_12px_#f43f5e]'
              }`}
            />
          </div>
          <div>
            <div className="text-xs font-semibold tracking-wider text-slate-400 uppercase">Current Phase</div>
            <div className="text-base font-bold text-white flex items-center gap-2">
              <span className={phase.startsWith('NS') ? 'text-emerald-400' : 'text-cyan-400'}>
                {phase === 'NS_GREEN' ? 'NORTH-SOUTH GREEN' : phase === 'NS_YELLOW' ? 'NORTH-SOUTH CLEARANCE' : phase === 'EW_GREEN' ? 'EAST-WEST GREEN' : phase === 'EW_YELLOW' ? 'EAST-WEST CLEARANCE' : 'ALL-RED CLEARANCE'}
              </span>
              <span className="text-xs bg-slate-800 px-2 py-0.5 rounded text-amber-300 font-mono">
                {phaseTimeLeft}s
              </span>
            </div>
          </div>
        </div>

        {/* Algorithm Mode Selector */}
        <div className="flex items-center gap-2 bg-slate-950 p-1.5 rounded-lg border border-slate-800">
          <button
            onClick={() => setMode('fairnessAware')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
              mode === 'fairnessAware'
                ? 'bg-emerald-600 text-white shadow-md font-semibold'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            ⭐ Proposed Fairness-Aware
          </button>
          <button
            onClick={() => setMode('queueOnly')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
              mode === 'queueOnly'
                ? 'bg-amber-600 text-white shadow-md font-semibold'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Greedy Queue-Only
          </button>
          <button
            onClick={() => setMode('fixed')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
              mode === 'fixed'
                ? 'bg-blue-600 text-white shadow-md font-semibold'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Fixed-Time (Static)
          </button>
        </div>

        {/* Quick Metrics */}
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <Gauge className="w-4 h-4 text-emerald-400" />
            <div>
              <div className="text-[10px] uppercase text-slate-400 font-medium">Jain's Fairness</div>
              <div className="text-sm font-bold text-white font-mono">
                {(jainsIndex * 100).toFixed(0)}%
                <span className={`text-[10px] ml-1 ${jainsIndex > 0.8 ? 'text-emerald-400' : jainsIndex > 0.6 ? 'text-amber-400' : 'text-rose-400'}`}>
                  {jainsIndex > 0.8 ? 'Fair' : jainsIndex > 0.6 ? 'Imbalanced' : 'Starvation!'}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Car className="w-4 h-4 text-cyan-400" />
            <div>
              <div className="text-[10px] uppercase text-slate-400 font-medium">Throughput</div>
              <div className="text-sm font-bold text-white font-mono">{totalCrossed} veh</div>
            </div>
          </div>

          {/* Play/Pause & Speed */}
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setIsPlaying(!isPlaying)}
              className="p-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg transition"
              title={isPlaying ? 'Pause Simulation' : 'Resume Simulation'}
              aria-label={isPlaying ? 'Pause Simulation' : 'Resume Simulation'}
            >
              {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 text-emerald-400" />}
            </button>
            <button
              onClick={resetSimulation}
              className="p-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg transition"
              title="Reset Simulation"
              aria-label="Reset Simulation"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
            <select
              value={simSpeed}
              onChange={(e) => setSimSpeed(Number(e.target.value))}
              aria-label="Simulation speed multiplier"
              className="bg-slate-800 text-xs text-slate-200 border border-slate-700 rounded-lg px-2 py-1.5 focus:outline-none"
            >
              <option value="1">1x Speed</option>
              <option value="1.5">1.5x Speed</option>
              <option value="2.5">2.5x Fast</option>
              <option value="4">4x Ultra</option>
            </select>

            {/* Export CSV Download Button in Top Ribbon */}
            <button
              onClick={exportSimulationCSV}
              className="px-2.5 py-1.5 bg-emerald-600/20 hover:bg-emerald-600 border border-emerald-500/50 text-emerald-300 hover:text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow-sm transition"
              title="Download structured CSV of simulation metrics, queues and active vehicle inventory"
              aria-label="Export Simulation Telemetry CSV"
            >
              <Download className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Export CSV</span>
            </button>
          </div>
        </div>
      </div>

      {/* Emergency Corridor Banner */}
      {emergencyAlert && (
        <div className="bg-rose-950 border border-rose-500/50 rounded-lg p-3 text-rose-200 text-xs font-semibold flex items-center gap-3 animate-pulse shadow-lg">
          <Siren className="w-5 h-5 text-rose-400 animate-bounce" />
          <span>{emergencyAlert}</span>
        </div>
      )}

      {/* Main Simulation Viewport & Side Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        {/* 2D Canvas Simulator (Col 1-3) */}
        <div className="lg:col-span-3 bg-slate-950 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl relative flex flex-col items-center justify-center p-2">
          {/* Canvas */}
          <canvas
            ref={canvasRef}
            width={780}
            height={620}
            className="w-full h-auto max-w-[780px] rounded-xl bg-[#090d16] shadow-inner select-none"
          />

          {/* Quick Action Overlay Buttons */}
          <div className="absolute bottom-4 left-4 right-4 flex flex-wrap items-center justify-between gap-2 pointer-events-auto bg-slate-900/90 backdrop-blur-md p-2.5 rounded-xl border border-slate-700/60 shadow-lg">
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-semibold text-slate-300 flex items-center gap-1">
                <Siren className="w-3.5 h-3.5 text-rose-400" />
                Dispatch Ambulance:
              </span>
              <button
                onClick={() => spawnAmbulance('South')}
                className="text-[10px] bg-rose-600/30 hover:bg-rose-600 border border-rose-500 text-rose-200 hover:text-white px-2 py-1 rounded transition"
              >
                South Approach
              </button>
              <button
                onClick={() => spawnAmbulance('East')}
                className="text-[10px] bg-rose-600/30 hover:bg-rose-600 border border-rose-500 text-rose-200 hover:text-white px-2 py-1 rounded transition"
              >
                East Approach
              </button>
            </div>

            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] font-semibold text-slate-300">Quick Inject:</span>
                <button
                  onClick={() => injectVehicle('autoRickshaw', 'East')}
                  className="text-[10px] bg-amber-500/20 hover:bg-amber-500/40 text-amber-300 border border-amber-500/40 px-2 py-1 rounded transition"
                >
                  + Auto
                </button>
                <button
                  onClick={() => injectVehicle('bus', 'North')}
                  className="text-[10px] bg-rose-500/20 hover:bg-rose-500/40 text-rose-300 border border-rose-500/40 px-2 py-1 rounded transition"
                >
                  + Bus (3 PCU)
                </button>
                <button
                  onClick={() => injectVehicle('twoWheeler', 'South')}
                  className="text-[10px] bg-cyan-500/20 hover:bg-cyan-500/40 text-cyan-300 border border-cyan-500/40 px-2 py-1 rounded transition"
                >
                  + Bike
                </button>
              </div>

              {/* Quick CSV Export Button on Canvas Overlay */}
              <button
                onClick={exportSimulationCSV}
                className="text-[10px] bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-2.5 py-1 rounded shadow flex items-center gap-1 transition"
                title="Download Telemetry CSV"
                aria-label="Download Telemetry CSV"
              >
                <Download className="w-3 h-3" />
                <span>Export CSV</span>
              </button>
            </div>
          </div>
        </div>

        {/* Right Information & Parameter Panel (Col 4) */}
        <div className="flex flex-col gap-4">
          {/* Scenario Selector */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-md">
            <div className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-2 flex items-center justify-between">
              <span>Traffic Scenario Preset</span>
              <span className="text-[10px] bg-emerald-950 text-emerald-400 px-1.5 py-0.5 rounded border border-emerald-800">
                Indian Context
              </span>
            </div>
            <select
              value={scenarioKey}
              onChange={(e) => setScenarioKey(e.target.value)}
              aria-label="Traffic scenario preset selection"
              className="w-full bg-slate-950 text-xs text-white border border-slate-700 rounded-lg p-2 font-medium focus:ring-1 focus:ring-emerald-500"
            >
              {Object.entries(TRAFFIC_SCENARIOS).map(([key, sc]) => (
                <option key={key} value={key}>
                  {sc.name}
                </option>
              ))}
            </select>
            <div className="mt-2 text-[11px] text-slate-400 leading-relaxed">
              {TRAFFIC_SCENARIOS[scenarioKey].descriptionIndianContext}
            </div>
          </div>

          {/* 4 Approach Queue Cards */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-md flex flex-col gap-2.5">
            <div className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center justify-between">
              <span>Approach Queue Live Telemetry</span>
              <span className="text-[10px] text-slate-400 font-mono">IRC PCU</span>
            </div>

            {(['North', 'South', 'East', 'West'] as ApproachDirection[]).map((dir) => {
              const data = armTelemetry[dir];
              const isGreenArm = (phase.startsWith('NS') && (dir === 'North' || dir === 'South')) ||
                                 (phase.startsWith('EW') && (dir === 'East' || dir === 'West'));
              return (
                <div
                  key={dir}
                  className={`p-2.5 rounded-lg border text-xs flex items-center justify-between transition-all ${
                    isGreenArm
                      ? 'bg-emerald-950/40 border-emerald-500/40'
                      : data.maxWait > params.maxAcceptableWait
                      ? 'bg-rose-950/40 border-rose-500/50 animate-pulse'
                      : 'bg-slate-950 border-slate-800'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <div
                      className={`w-2.5 h-2.5 rounded-full ${
                        isGreenArm ? 'bg-emerald-400 shadow-[0_0_8px_#34d399]' : 'bg-rose-500'
                      }`}
                    />
                    <div>
                      <div className="font-semibold text-slate-200">{dir} Approach</div>
                      <div className="text-[10px] text-slate-400">{data.count} vehicles in queue</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-mono font-bold text-amber-300">{data.pcu} PCU</div>
                    <div className={`text-[10px] font-mono ${data.maxWait > 60 ? 'text-rose-400 font-bold' : 'text-slate-400'}`}>
                      Max Wait: {data.maxWait}s
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Dynamic Green Time Allocation Card */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-md flex flex-col gap-2">
            <div className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center justify-between">
              <span>Controller Decision Engine</span>
              <Sliders className="w-3.5 h-3.5 text-emerald-400 cursor-pointer" onClick={() => setShowSettings(!showSettings)} />
            </div>

            <div className="text-xs text-slate-300 space-y-1.5">
              <div className="flex justify-between items-center">
                <span className="text-slate-400">Allocated Green:</span>
                <span className="font-mono font-bold text-emerald-400">{allocatedGreen} seconds</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-400">Demand Weight (α):</span>
                <span className="font-mono text-white">{params.alpha}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-400">Fairness Weight (β):</span>
                <span className="font-mono text-white">{params.beta}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-400">Starvation Threshold:</span>
                <span className="font-mono text-white">{params.maxAcceptableWait}s</span>
              </div>
            </div>

            {showSettings && (
              <div className="mt-2 pt-2 border-t border-slate-800 space-y-3">
                <div>
                  <div className="flex justify-between text-[11px] text-slate-400 mb-1">
                    <span>Demand Weight α ({params.alpha})</span>
                    <span>Fairness β ({params.beta})</span>
                  </div>
                  <input
                    type="range"
                    min="0.1"
                    max="0.9"
                    step="0.05"
                    value={params.alpha}
                    onChange={(e) => {
                      const alphaVal = Number(e.target.value);
                      setParams({
                        ...params,
                        alpha: Number(alphaVal.toFixed(2)),
                        beta: Number((1 - alphaVal).toFixed(2)),
                      });
                    }}
                    aria-label="Demand Weight versus Fairness Weight"
                    className="w-full accent-emerald-500 h-1.5 bg-slate-800 rounded-lg"
                  />
                </div>

                <div>
                  <div className="flex justify-between text-[11px] text-slate-400 mb-1">
                    <span>Starvation Threshold (s)</span>
                    <span className="font-mono text-white">{params.maxAcceptableWait}s</span>
                  </div>
                  <input
                    type="range"
                    min="40"
                    max="120"
                    step="5"
                    value={params.maxAcceptableWait}
                    onChange={(e) =>
                      setParams({ ...params, maxAcceptableWait: Number(e.target.value) })
                    }
                    aria-label="Starvation Threshold in seconds"
                    className="w-full accent-amber-500 h-1.5 bg-slate-800 rounded-lg"
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Real-Time Event Log & Telemetry Alerts Panel */}
      <TrafficEventLogPanel
        events={events}
        onClearLog={() => {
          eventsRef.current = [];
          setEvents([]);
        }}
        currentPhase={phase}
      />
    </div>
  );
};

// Helper: compute approach queue state
function getApproachState(direction: ApproachDirection, vehicles: SimVehicle[]): ApproachQueueState {
  const armVehicles = vehicles.filter((v) => v.approach === direction && !v.hasCrossed);
  const totalPCU = calculateTotalPCU(armVehicles);
  const maxWait = armVehicles.length > 0 ? Math.max(...armVehicles.map((v) => v.waitingTime)) : 0;
  const avgWait = armVehicles.length > 0 ? armVehicles.reduce((s, v) => s + v.waitingTime, 0) / armVehicles.length : 0;
  const hasEmergency = armVehicles.some((v) => v.isEmergency);

  return {
    direction,
    vehicles: armVehicles,
    totalVehicles: armVehicles.length,
    totalPCU,
    maxWaitSeconds: maxWait,
    avgWaitSeconds: avgWait,
    hasEmergency,
  };
}

// 2D Canvas Drawing
function drawIntersection(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  currentPhase: SignalPhase,
  vehicles: SimVehicle[],
  armStates: Record<ApproachDirection, ApproachQueueState>
) {
  const cx = width / 2;
  const cy = height / 2;
  const roadWidth = 140; // 2 lanes each way (70px each)
  const laneWidth = 35;

  // Clear background (surrounding urban land)
  ctx.fillStyle = '#0f172a'; // slate-900
  ctx.fillRect(0, 0, width, height);

  // Road asphalt surfaces
  ctx.fillStyle = '#1e293b'; // slate-800 dark asphalt
  // North-South Road
  ctx.fillRect(cx - roadWidth / 2, 0, roadWidth, height);
  // East-West Road
  ctx.fillRect(0, cy - roadWidth / 2, width, roadWidth);

  // Road Borders / Curbs (yellowish concrete curb)
  ctx.strokeStyle = '#64748b';
  ctx.lineWidth = 2;
  // Corners of the 4 quadrants
  // Top-Left corner
  ctx.strokeRect(0, 0, cx - roadWidth / 2, cy - roadWidth / 2);
  // Top-Right corner
  ctx.strokeRect(cx + roadWidth / 2, 0, width - (cx + roadWidth / 2), cy - roadWidth / 2);
  // Bottom-Left corner
  ctx.strokeRect(0, cy + roadWidth / 2, cx - roadWidth / 2, height - (cy + roadWidth / 2));
  // Bottom-Right corner
  ctx.strokeRect(cx + roadWidth / 2, cy + roadWidth / 2, width - (cx + roadWidth / 2), height - (cy + roadWidth / 2));

  // Yellow Box Junction in Center (Indian Urban standard - "Do Not Block Intersection")
  ctx.save();
  ctx.beginPath();
  ctx.rect(cx - roadWidth / 2, cy - roadWidth / 2, roadWidth, roadWidth);
  ctx.clip();
  ctx.strokeStyle = 'rgba(234, 179, 8, 0.4)'; // yellow-500 transparent
  ctx.lineWidth = 1.5;
  for (let x = -roadWidth; x < roadWidth * 2; x += 16) {
    ctx.beginPath();
    ctx.moveTo(cx - roadWidth / 2 + x, cy - roadWidth / 2);
    ctx.lineTo(cx - roadWidth / 2 + x + roadWidth, cy + roadWidth / 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(cx - roadWidth / 2 + x, cy + roadWidth / 2);
    ctx.lineTo(cx - roadWidth / 2 + x + roadWidth, cy - roadWidth / 2);
    ctx.stroke();
  }
  ctx.restore();

  // Lane Dividers & Center Median Double Yellow Lines
  ctx.strokeStyle = '#eab308'; // Center Yellow
  ctx.lineWidth = 2.5;

  // NS center line
  ctx.beginPath();
  ctx.moveTo(cx, 0);
  ctx.lineTo(cx, cy - roadWidth / 2);
  ctx.moveTo(cx, cy + roadWidth / 2);
  ctx.lineTo(cx, height);
  ctx.stroke();

  // EW center line
  ctx.beginPath();
  ctx.moveTo(0, cy);
  ctx.lineTo(cx - roadWidth / 2, cy);
  ctx.moveTo(cx + roadWidth / 2, cy);
  ctx.lineTo(width, cy);
  ctx.stroke();

  // Dashed lane divider lines (White)
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
  ctx.lineWidth = 1.5;
  ctx.setLineDash([8, 8]);

  // NS lanes
  [cx - laneWidth, cx + laneWidth].forEach((lx) => {
    ctx.beginPath();
    ctx.moveTo(lx, 0);
    ctx.lineTo(lx, cy - roadWidth / 2);
    ctx.moveTo(lx, cy + roadWidth / 2);
    ctx.lineTo(lx, height);
    ctx.stroke();
  });

  // EW lanes
  [cy - laneWidth, cy + laneWidth].forEach((ly) => {
    ctx.beginPath();
    ctx.moveTo(0, ly);
    ctx.lineTo(cx - roadWidth / 2, ly);
    ctx.moveTo(cx + roadWidth / 2, ly);
    ctx.lineTo(width, ly);
    ctx.stroke();
  });
  ctx.setLineDash([]); // Reset dash

  // Zebra Pedestrian Crossings & Solid Stop Lines
  drawZebraCrossing(ctx, cx - roadWidth / 2, cy - roadWidth / 2 - 18, roadWidth, 14, 'horizontal');
  drawZebraCrossing(ctx, cx - roadWidth / 2, cy + roadWidth / 2 + 4, roadWidth, 14, 'horizontal');
  drawZebraCrossing(ctx, cx - roadWidth / 2 - 18, cy - roadWidth / 2, 14, roadWidth, 'vertical');
  drawZebraCrossing(ctx, cx + roadWidth / 2 + 4, cy - roadWidth / 2, 14, roadWidth, 'vertical');

  // Traffic Lights Rendering (At each corner)
  const isNSGreen = currentPhase === 'NS_GREEN';
  const isNSYellow = currentPhase === 'NS_YELLOW';
  const isEWGreen = currentPhase === 'EW_GREEN';
  const isEWYellow = currentPhase === 'EW_YELLOW';

  // Draw 4 Traffic Signal Heads
  // North light (governs Southbound traffic entering junction from North)
  drawTrafficSignalHead(ctx, cx + roadWidth / 2 + 10, cy - roadWidth / 2 - 10, isNSGreen ? 'green' : isNSYellow ? 'yellow' : 'red');
  // South light (governs Northbound traffic)
  drawTrafficSignalHead(ctx, cx - roadWidth / 2 - 34, cy + roadWidth / 2 + 10, isNSGreen ? 'green' : isNSYellow ? 'yellow' : 'red');
  // East light (governs Westbound traffic)
  drawTrafficSignalHead(ctx, cx + roadWidth / 2 + 10, cy + roadWidth / 2 + 10, isEWGreen ? 'green' : isEWYellow ? 'yellow' : 'red');
  // West light (governs Eastbound traffic)
  drawTrafficSignalHead(ctx, cx - roadWidth / 2 - 34, cy - roadWidth / 2 - 34, isEWGreen ? 'green' : isEWYellow ? 'yellow' : 'red');

  // Vehicles Rendering
  const pxPerMeter = 2.2; // Scaling factor

  vehicles.forEach((v) => {
    let vx = 0;
    let vy = 0;
    let angle = 0;

    // Convert meters to canvas coords
    // Stop line positions:
    // North stopline: cy - roadWidth/2
    // South stopline: cy + roadWidth/2
    // East stopline: cx + roadWidth/2
    // West stopline: cx - roadWidth/2

    const laneOffset = v.lane === 0 ? laneWidth * 0.5 : laneWidth * 1.5;

    if (v.approach === 'North') {
      // Southbound (moving downwards +y)
      vx = cx - roadWidth / 2 + laneOffset;
      vy = cy - roadWidth / 2 - v.position * pxPerMeter;
      angle = Math.PI / 2;
    } else if (v.approach === 'South') {
      // Northbound (moving upwards -y)
      vx = cx + roadWidth / 2 - laneOffset;
      vy = cy + roadWidth / 2 + v.position * pxPerMeter;
      angle = -Math.PI / 2;
    } else if (v.approach === 'East') {
      // Westbound (moving leftwards -x)
      vx = cx + roadWidth / 2 + v.position * pxPerMeter;
      vy = cy - roadWidth / 2 + laneOffset;
      angle = Math.PI;
    } else if (v.approach === 'West') {
      // Eastbound (moving rightwards +x)
      vx = cx - roadWidth / 2 - v.position * pxPerMeter;
      vy = cy + roadWidth / 2 - laneOffset;
      angle = 0;
    }

    drawIndianVehicle(ctx, vx, vy, angle, v);
  });

  // HUD Labels on Canvas
  drawHUDText(ctx, cx, 24, `NORTH: ${armStates.North.totalPCU.toFixed(1)} PCU | Wait: ${Math.round(armStates.North.maxWaitSeconds)}s`);
  drawHUDText(ctx, cx, height - 16, `SOUTH: ${armStates.South.totalPCU.toFixed(1)} PCU | Wait: ${Math.round(armStates.South.maxWaitSeconds)}s`);
  drawHUDText(ctx, 16, cy, `WEST: ${armStates.West.totalPCU.toFixed(1)} PCU`, 'left');
  drawHUDText(ctx, width - 16, cy, `EAST: ${armStates.East.totalPCU.toFixed(1)} PCU`, 'right');
}

function drawZebraCrossing(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  orientation: 'horizontal' | 'vertical'
) {
  ctx.fillStyle = 'rgba(255, 255, 255, 0.75)';
  if (orientation === 'horizontal') {
    const stripeWidth = 6;
    for (let sx = x + 4; sx < x + w - 4; sx += stripeWidth * 2) {
      ctx.fillRect(sx, y, stripeWidth, h);
    }
  } else {
    const stripeHeight = 6;
    for (let sy = y + 4; sy < y + h - 4; sy += stripeHeight * 2) {
      ctx.fillRect(x, sy, w, stripeHeight);
    }
  }
}

function drawTrafficSignalHead(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  activeColor: 'red' | 'yellow' | 'green'
) {
  // Signal housing box
  ctx.fillStyle = '#0f172a';
  ctx.strokeStyle = '#334155';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.roundRect(x, y, 22, 54, 4);
  ctx.fill();
  ctx.stroke();

  // Red light
  ctx.fillStyle = activeColor === 'red' ? '#ef4444' : '#450a0a';
  if (activeColor === 'red') {
    ctx.shadowColor = '#ef4444';
    ctx.shadowBlur = 8;
  }
  ctx.beginPath();
  ctx.arc(x + 11, y + 10, 6, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;

  // Yellow light
  ctx.fillStyle = activeColor === 'yellow' ? '#f59e0b' : '#451a03';
  if (activeColor === 'yellow') {
    ctx.shadowColor = '#f59e0b';
    ctx.shadowBlur = 8;
  }
  ctx.beginPath();
  ctx.arc(x + 11, y + 27, 6, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;

  // Green light
  ctx.fillStyle = activeColor === 'green' ? '#10b981' : '#064e3b';
  if (activeColor === 'green') {
    ctx.shadowColor = '#10b981';
    ctx.shadowBlur = 10;
  }
  ctx.beginPath();
  ctx.arc(x + 11, y + 44, 6, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;
}

function drawIndianVehicle(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  angle: number,
  v: SimVehicle
) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);

  const def = INDIAN_VEHICLE_CONFIG[v.type];

  if (v.type === 'twoWheeler') {
    // 2-Wheeler: slim body with rider helmet dot
    ctx.fillStyle = def.color;
    ctx.fillRect(-7, -2.5, 14, 5);
    // Wheels
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(-6, -1.5, 3, 3);
    ctx.fillRect(3, -1.5, 3, 3);
    // Helmet
    ctx.fillStyle = '#f8fafc';
    ctx.beginPath();
    ctx.arc(0, 0, 2.5, 0, Math.PI * 2);
    ctx.fill();
  } else if (v.type === 'autoRickshaw') {
    // Iconic Auto-Rickshaw (Yellow & Green / Black)
    // Tapered cabin
    ctx.fillStyle = '#16a34a'; // Green bottom
    ctx.beginPath();
    ctx.moveTo(10, 0);
    ctx.lineTo(-9, -6);
    ctx.lineTo(-9, 6);
    ctx.closePath();
    ctx.fill();

    // Yellow Canopy roof
    ctx.fillStyle = '#eab308';
    ctx.beginPath();
    ctx.roundRect(-7, -5.5, 12, 11, 2);
    ctx.fill();

    // Headlight
    ctx.fillStyle = '#fef08a';
    ctx.beginPath();
    ctx.arc(9, 0, 1.5, 0, Math.PI * 2);
    ctx.fill();
  } else if (v.type === 'ambulance') {
    // Emergency Ambulance: White body, red cross, emergency beacons
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#dc2626';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(-14, -7, 28, 14, 3);
    ctx.fill();
    ctx.stroke();

    // Red Cross
    ctx.fillStyle = '#dc2626';
    ctx.fillRect(-3, -5, 6, 10);
    ctx.fillRect(-6, -2, 12, 4);

    // Flashing Emergency Beacon Light (alternating blue & red)
    const isRedFlash = Math.floor(Date.now() / 150) % 2 === 0;
    ctx.fillStyle = isRedFlash ? '#ef4444' : '#3b82f6';
    ctx.shadowColor = isRedFlash ? '#ef4444' : '#3b82f6';
    ctx.shadowBlur = 12;
    ctx.beginPath();
    ctx.arc(0, 0, 3.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
  } else if (v.type === 'bus') {
    // City Bus: Long body, state transport livery (Red/Orange with white roof)
    ctx.fillStyle = '#dc2626'; // Indian DTC/BEST Red
    ctx.beginPath();
    ctx.roundRect(-24, -8, 48, 16, 2);
    ctx.fill();

    // Windows
    ctx.fillStyle = '#38bdf8';
    for (let wx = -20; wx < 18; wx += 6) {
      ctx.fillRect(wx, -7, 4, 2);
      ctx.fillRect(wx, 5, 4, 2);
    }
    // Windshield
    ctx.fillRect(19, -6, 3, 12);
  } else if (v.type === 'truck') {
    // Mini-truck / Tempo
    ctx.fillStyle = '#7c3aed';
    ctx.fillRect(-16, -7, 18, 14); // Cargo bed
    ctx.fillStyle = '#a78bfa';
    ctx.fillRect(3, -6, 9, 12); // Cabin
  } else {
    // Passenger Car / Cab
    ctx.fillStyle = def.color;
    ctx.beginPath();
    ctx.roundRect(-10, -6, 20, 12, 3);
    ctx.fill();

    // Windshields
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(-2, -5, 4, 10);
    // Headlights
    ctx.fillStyle = '#fef08a';
    ctx.fillRect(8, -5, 2, 2);
    ctx.fillRect(8, 3, 2, 2);
  }

  ctx.restore();
}

function drawHUDText(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  text: string,
  align: CanvasTextAlign = 'center'
) {
  ctx.save();
  ctx.font = '11px monospace';
  ctx.textAlign = align;
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#94a3b8';
  ctx.fillText(text, x, y);
  ctx.restore();
}
