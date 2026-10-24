/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Traffic Engine Math & Algorithms for Urban Indian Road Junctions
 * Compliant with IRC: 106-1990 (Passenger Car Unit Equivalents)
 */

export type VehicleType = 'twoWheeler' | 'autoRickshaw' | 'car' | 'bus' | 'truck' | 'ambulance';

export interface VehicleDefinition {
  type: VehicleType;
  name: string;
  pcu: number; // IRC 106-1990 standards
  lengthMeters: number;
  idleFuelLitresPerHour: number; // Litres of fuel per hour of idling
  color: string;
}

export const INDIAN_VEHICLE_CONFIG: Record<VehicleType, VehicleDefinition> = {
  twoWheeler: {
    type: 'twoWheeler',
    name: 'Two-Wheeler (Motorbike/Scooter)',
    pcu: 0.5,
    lengthMeters: 1.8,
    idleFuelLitresPerHour: 0.15,
    color: '#06b6d4', // cyan-500
  },
  autoRickshaw: {
    type: 'autoRickshaw',
    name: 'Auto-Rickshaw (3-Wheeler)',
    pcu: 0.8,
    lengthMeters: 2.6,
    idleFuelLitresPerHour: 0.35,
    color: '#eab308', // yellow-500 (iconic Indian auto yellow/green)
  },
  car: {
    type: 'car',
    name: 'Passenger Car / Cab',
    pcu: 1.0,
    lengthMeters: 4.2,
    idleFuelLitresPerHour: 0.80,
    color: '#3b82f6', // blue-500
  },
  bus: {
    type: 'bus',
    name: 'City Bus (DTC/BEST/BMTC)',
    pcu: 3.0,
    lengthMeters: 10.5,
    idleFuelLitresPerHour: 2.50,
    color: '#ef4444', // red-500
  },
  truck: {
    type: 'truck',
    name: 'Commercial Mini-Truck / Tempo',
    pcu: 1.6,
    lengthMeters: 6.5,
    idleFuelLitresPerHour: 1.80,
    color: '#8b5cf6', // purple-500
  },
  ambulance: {
    type: 'ambulance',
    name: 'Emergency Ambulance',
    pcu: 1.2,
    lengthMeters: 5.2,
    idleFuelLitresPerHour: 0.90,
    color: '#ffffff', // white with emergency red/blue
  },
};

export type ApproachDirection = 'North' | 'South' | 'East' | 'West';

export type TrafficEventCategory =
  | 'PHASE_CHANGE'
  | 'STARVATION_BREACH'
  | 'PCU_SURGE'
  | 'FAIRNESS_DROP'
  | 'EMERGENCY_OVERRIDE'
  | 'EMERGENCY_CLEARED';

export interface TrafficEventLog {
  id: string;
  simTimeSeconds: number;
  wallClockTime: string;
  category: TrafficEventCategory;
  severity: 'info' | 'warning' | 'critical' | 'success';
  approach?: ApproachDirection;
  title: string;
  details: string;
  metricValue?: string;
}

export interface SimVehicle {
  id: string;
  type: VehicleType;
  approach: ApproachDirection;
  spawnTime: number; // simulation timestamp in seconds
  waitingTime: number; // accumulated idling/stopped seconds
  hasCrossed: boolean;
  crossedTime?: number;
  position: number; // distance to stop line in meters (0 = stop line, >0 = approaching)
  speed: number; // m/s
  lane: 0 | 1; // 0 = inner/straight, 1 = outer/mixed
  isEmergency: boolean;
}

export type SignalPhase = 'NS_GREEN' | 'NS_YELLOW' | 'ALL_RED' | 'EW_GREEN' | 'EW_YELLOW';

export type ControllerMode = 'fixed' | 'queueOnly' | 'fairnessAware';

export interface ApproachQueueState {
  direction: ApproachDirection;
  vehicles: SimVehicle[];
  totalVehicles: number;
  totalPCU: number;
  maxWaitSeconds: number;
  avgWaitSeconds: number;
  hasEmergency: boolean;
}

export interface ControllerDecision {
  nextPhase: 'NS' | 'EW';
  allocatedGreenTime: number; // in seconds
  demandScoreNS: number;
  demandScoreEW: number;
  fairnessIndex: number;
  reason: string;
}

/**
 * Calculate total PCU for a list of vehicles.
 */
export function calculateTotalPCU(vehicles: SimVehicle[]): number {
  return vehicles.reduce((sum, v) => {
    if (v.hasCrossed) return sum;
    const def = INDIAN_VEHICLE_CONFIG[v.type];
    return sum + (def ? def.pcu : 1.0);
  }, 0);
}

/**
 * Jain's Fairness Index (0.0 to 1.0)
 * J(x) = (sum(x_i))^2 / (n * sum(x_i^2))
 * Evaluates fairness of waiting times across all approaches.
 */
export function calculateJainsFairnessIndex(values: number[]): number {
  if (!values || values.length === 0) return 1.0;
  
  // If all values are 0 or negligible, system is balanced (fair)
  const sum = values.reduce((acc, v) => acc + Math.max(0, v), 0);
  if (sum === 0) return 1.0;

  const n = values.length;
  const sumSquares = values.reduce((acc, v) => acc + Math.max(0, v) ** 2, 0);

  if (sumSquares === 0) return 1.0;

  const jain = (sum * sum) / (n * sumSquares);
  // Bound strictly between 1/n and 1.0
  return Math.min(1.0, Math.max(1 / n, Number(jain.toFixed(4))));
}

/**
 * Proposed Fairness-Aware Dynamic Scoring Formula
 * 
 * Score(Approach) = alpha * (PCU_arm / SaturationCapacity) + beta * (MaxWait / MaxAcceptableWait)^gamma + EmergencyBonus
 */
export interface ControllerParams {
  alpha: number; // Demand weight (default: 0.55)
  beta: number; // Fairness/Starvation weight (default: 0.45)
  gamma: number; // Starvation escalation exponent (default: 1.8)
  maxAcceptableWait: number; // seconds before severe starvation penalty (default: 80s)
  minGreen: number; // minimum green seconds (default: 15s)
  maxGreen: number; // maximum green seconds (default: 55s)
  yellowTime: number; // seconds (default: 4s)
  allRedTime: number; // seconds (default: 2s)
  saturationDischargeRatePCUPerSec: number; // typical Indian junction: ~0.55 PCU/sec/lane
}

export const DEFAULT_CONTROLLER_PARAMS: ControllerParams = {
  alpha: 0.55,
  beta: 0.45,
  gamma: 1.8,
  maxAcceptableWait: 80,
  minGreen: 15,
  maxGreen: 60,
  yellowTime: 4,
  allRedTime: 2,
  saturationDischargeRatePCUPerSec: 0.65,
};

/**
 * Calculates phase urgency score for an axis (NS = North + South, EW = East + West)
 */
export function calculateAxisScore(
  approaches: ApproachQueueState[],
  params: ControllerParams = DEFAULT_CONTROLLER_PARAMS,
  mode: ControllerMode = 'fairnessAware'
): { score: number; pcu: number; maxWait: number; hasEmergency: boolean; details: string } {
  const totalPCU = approaches.reduce((s, a) => s + a.totalPCU, 0);
  const maxWait = Math.max(...approaches.map(a => a.maxWaitSeconds), 0);
  const hasEmergency = approaches.some(a => a.hasEmergency);

  if (hasEmergency) {
    return {
      score: 10000 + totalPCU,
      pcu: totalPCU,
      maxWait,
      hasEmergency: true,
      details: 'EMERGENCY OVERRIDE: Ambulance priority green wave activated',
    };
  }

  if (mode === 'queueOnly') {
    // Pure greedy queue max-pressure: strictly proportional to PCU
    return {
      score: totalPCU,
      pcu: totalPCU,
      maxWait,
      hasEmergency: false,
      details: `Pure Queue: PCU = ${totalPCU.toFixed(1)}`,
    };
  }

  // mode === 'fairnessAware':
  // Normalize PCU to reasonable nominal capacity (e.g., 25 PCU)
  const normPCU = totalPCU / 25;
  // Non-linear starvation term: grows rapidly as wait approaches or exceeds maxAcceptableWait
  const waitRatio = Math.max(0, maxWait / params.maxAcceptableWait);
  const starvationTerm = Math.pow(waitRatio, params.gamma);

  const demandComponent = params.alpha * normPCU;
  const fairnessComponent = params.beta * starvationTerm;
  const totalScore = demandComponent + fairnessComponent;

  return {
    score: totalScore,
    pcu: totalPCU,
    maxWait,
    hasEmergency: false,
    details: `Demand: ${(demandComponent * 100).toFixed(0)}% (PCU ${totalPCU.toFixed(1)}) | Fairness: ${(fairnessComponent * 100).toFixed(0)}% (MaxWait ${maxWait.toFixed(0)}s)`,
  };
}

/**
 * Compute recommended green duration based on PCU queue demand
 */
export function calculateGreenDuration(
  axisPCU: number,
  params: ControllerParams = DEFAULT_CONTROLLER_PARAMS
): number {
  if (axisPCU <= 0) return params.minGreen;
  // Green time needed to clear queue: PCU / saturation rate
  // Plus startup lost time ~ 2 seconds
  const neededSeconds = Math.ceil(axisPCU / params.saturationDischargeRatePCUPerSec) + 2;
  return Math.min(params.maxGreen, Math.max(params.minGreen, neededSeconds));
}

/**
 * Fuel & Emissions calculation
 * Estimates idling fuel wasted, CO2 emitted, and financial cost.
 */
export interface EmissionMetrics {
  totalIdleTimeSeconds: number;
  fuelWastedLitres: number;
  co2EmittedKg: number;
  fuelCostINR: number; // At ₹100 / Litre
}

export function calculateEmissions(vehicles: SimVehicle[]): EmissionMetrics {
  let totalIdleSeconds = 0;
  let fuelWastedLitres = 0;

  for (const v of vehicles) {
    if (v.waitingTime > 0) {
      totalIdleSeconds += v.waitingTime;
      const def = INDIAN_VEHICLE_CONFIG[v.type];
      const ratePerHour = def ? def.idleFuelLitresPerHour : 0.8;
      // Convert waiting seconds to litres: (hours) * (litres/hour)
      fuelWastedLitres += (v.waitingTime / 3600) * ratePerHour;
    }
  }

  // 1 litre of average mixed Indian fleet fuel ~ 2.40 kg CO2
  const co2EmittedKg = fuelWastedLitres * 2.40;
  const fuelCostINR = fuelWastedLitres * 102; // Average fuel cost in metro cities

  return {
    totalIdleTimeSeconds: Math.round(totalIdleSeconds),
    fuelWastedLitres: Number(fuelWastedLitres.toFixed(3)),
    co2EmittedKg: Number(co2EmittedKg.toFixed(2)),
    fuelCostINR: Number(fuelCostINR.toFixed(1)),
  };
}

export interface SimulationSnapshotData {
  timestamp: string;
  scenarioName: string;
  scenarioId: string;
  controllerMode: ControllerMode;
  currentPhase: SignalPhase;
  phaseTimeRemaining: number;
  allocatedGreenTime: number;
  jainsFairnessIndex: number;
  throughputCrossed: number;
  alphaDemandWeight: number;
  betaFairnessWeight: number;
  starvationThresholdSec: number;
  armTelemetry: {
    North: { pcu: number; count: number; maxWait: number; avgWait: number };
    South: { pcu: number; count: number; maxWait: number; avgWait: number };
    East: { pcu: number; count: number; maxWait: number; avgWait: number };
    West: { pcu: number; count: number; maxWait: number; avgWait: number };
  };
  vehicles: SimVehicle[];
  emissions: EmissionMetrics;
  events?: TrafficEventLog[];
}

/**
 * Generate structured CSV file content from simulation telemetry and event log
 */
export function generateTelemetryCSV(data: SimulationSnapshotData): string {
  const lines: string[] = [];

  // Header / Meta Section
  lines.push('# URBAN INDIAN ROAD TRAFFIC MANAGEMENT SYSTEM - TELEMETRY & EVENT LOG EXPORT');
  lines.push('# Standard: IRC: 106-1990 (Passenger Car Unit Equivalence)');
  lines.push(`# Export Timestamp: ${data.timestamp}`);
  lines.push('');

  // 1. Controller & Simulation Global State
  lines.push('# 1. CONTROLLER & SYSTEM STATE');
  lines.push('METRIC,VALUE,UNIT');
  lines.push(`Scenario,"${data.scenarioName}",-`);
  lines.push(`Controller Mode,${data.controllerMode},-`);
  lines.push(`Current Signal Phase,${data.currentPhase},-`);
  lines.push(`Phase Time Remaining,${data.phaseTimeRemaining},seconds`);
  lines.push(`Allocated Green Time,${data.allocatedGreenTime},seconds`);
  lines.push(`Jain\'s Fairness Index,${(data.jainsFairnessIndex * 100).toFixed(2)},%`);
  lines.push(`Throughput (Crossed Vehicles),${data.throughputCrossed},vehicles`);
  lines.push(`Alpha (Demand Weight),${data.alphaDemandWeight},-`);
  lines.push(`Beta (Fairness Weight),${data.betaFairnessWeight},-`);
  lines.push(`Starvation Threshold,${data.starvationThresholdSec},seconds`);
  lines.push(`Total Idling Fuel Wasted,${data.emissions.fuelWastedLitres},Litres`);
  lines.push(`Total Carbon Emitted,${data.emissions.co2EmittedKg},kg CO2`);
  lines.push(`Fuel Cost Lost,${data.emissions.fuelCostINR},INR`);
  lines.push('');

  // 2. Approach Level Breakdown
  lines.push('# 2. APPROACH-LEVEL TELEMETRY BREAKDOWN');
  lines.push('APPROACH_DIRECTION,QUEUED_VEHICLES,TOTAL_PCU,MAX_WAIT_SECONDS,AVG_WAIT_SECONDS,EMERGENCY_ACTIVE');
  (['North', 'South', 'East', 'West'] as ApproachDirection[]).forEach((dir) => {
    const arm = data.armTelemetry[dir];
    const hasEmer = data.vehicles.some((v) => v.approach === dir && v.isEmergency && !v.hasCrossed);
    lines.push(`${dir},${arm.count},${arm.pcu.toFixed(2)},${arm.maxWait.toFixed(1)},${arm.avgWait.toFixed(1)},${hasEmer ? 'YES' : 'NO'}`);
  });
  lines.push('');

  // 3. Granular Vehicle Roster
  lines.push('# 3. ACTIVE VEHICLE INVENTORY');
  lines.push('VEHICLE_ID,APPROACH,VEHICLE_TYPE,IRC_PCU,WAITING_TIME_SEC,CURRENT_SPEED_MPS,DISTANCE_TO_STOPLINE_METERS,LANE,IS_EMERGENCY,HAS_CROSSED');
  data.vehicles.forEach((v) => {
    const def = INDIAN_VEHICLE_CONFIG[v.type];
    const pcu = def ? def.pcu : 1.0;
    lines.push(
      `${v.id},${v.approach},"${def ? def.name : v.type}",${pcu},${v.waitingTime.toFixed(1)},${v.speed.toFixed(2)},${v.position.toFixed(2)},Lane ${v.lane + 1},${v.isEmergency ? 'YES' : 'NO'},${v.hasCrossed ? 'YES' : 'NO'}`
    );
  });
  lines.push('');

  // 4. Chronological Event Log & Threshold Alerts
  lines.push('# 4. SIMULATION EVENT LOG & THRESHOLD BREACHES');
  lines.push('EVENT_ID,WALL_CLOCK_TIME,SIMULATION_SECONDS,CATEGORY,SEVERITY,APPROACH,TITLE,DETAILS,METRIC_VALUE');
  if (data.events && data.events.length > 0) {
    data.events.forEach((e) => {
      const cleanTitle = (e.title || '').replace(/"/g, '""');
      const cleanDetails = (e.details || '').replace(/"/g, '""');
      lines.push(
        `${e.id},${e.wallClockTime},${e.simTimeSeconds.toFixed(1)},${e.category},${e.severity},${e.approach || 'ALL'},"${cleanTitle}","${cleanDetails}",${e.metricValue || '-'}`
      );
    });
  } else {
    lines.push('NO_EVENTS,-,0.0,NONE,info,ALL,"No Events Recorded","Simulation snapshot generated before events occurred",-');
  }

  return lines.join('\n');
}

