/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { VehicleType, ApproachDirection, SimVehicle, ControllerMode } from './traffic-engine.ts';

export interface TrafficScenario {
  id: string;
  name: string;
  description: string;
  spawnRates: Record<ApproachDirection, number>; // vehicles per minute
  vehicleMix: Record<VehicleType, number>; // probability weights (sum to 1)
  descriptionIndianContext: string;
}

export const TRAFFIC_SCENARIOS: Record<string, TrafficScenario> = {
  extremeAsymmetry: {
    id: 'extremeAsymmetry',
    name: 'Extreme Asymmetry (Main Arterial vs Minor Side Street)',
    description: 'Heavy continuous traffic on North/South arterial road, minor feeder traffic on East/West. Perfect test for starvation!',
    spawnRates: {
      North: 32,
      South: 28,
      East: 4,
      West: 3,
    },
    vehicleMix: {
      twoWheeler: 0.40,
      autoRickshaw: 0.25,
      car: 0.25,
      bus: 0.08,
      truck: 0.02,
      ambulance: 0.0,
    },
    descriptionIndianContext: 'Typical Mumbai Western Express Highway or Delhi Ring Road junction with small neighborhood feeder road.',
  },
  morningPeak: {
    id: 'morningPeak',
    name: 'Morning Commuter Peak (CBD Directional Surge)',
    description: 'Heavy North & East commuter traffic heading toward business hubs, lighter counter-flow.',
    spawnRates: {
      North: 34,
      South: 12,
      East: 28,
      West: 10,
    },
    vehicleMix: {
      twoWheeler: 0.48, // Heavy two-wheelers in morning rush
      autoRickshaw: 0.22,
      car: 0.22,
      bus: 0.06,
      truck: 0.02,
      ambulance: 0.0,
    },
    descriptionIndianContext: 'Heavy office rush towards Outer Ring Road (Bengaluru) or BKC (Mumbai).',
  },
  eveningPeak: {
    id: 'eveningPeak',
    name: 'Evening Return Flow & Market Rush',
    description: 'Reversed high-volume movement with increased mixed freight and auto-rickshaws.',
    spawnRates: {
      North: 14,
      South: 30,
      East: 12,
      West: 32,
    },
    vehicleMix: {
      twoWheeler: 0.42,
      autoRickshaw: 0.26,
      car: 0.22,
      bus: 0.07,
      truck: 0.03,
      ambulance: 0.0,
    },
    descriptionIndianContext: 'Evening office exit and shopping market congestion in Pune/Delhi.',
  },
  monsoonSurge: {
    id: 'monsoonSurge',
    name: 'Monsoon Surges & Chaotic Gridlock',
    description: 'High slow-moving vehicular queues across all four approaches with erratic arrival bursts.',
    spawnRates: {
      North: 24,
      South: 22,
      East: 25,
      West: 23,
    },
    vehicleMix: {
      twoWheeler: 0.30,
      autoRickshaw: 0.30,
      car: 0.30,
      bus: 0.08,
      truck: 0.02,
      ambulance: 0.0,
    },
    descriptionIndianContext: 'Waterlogged junction conditions causing slow discharge and high idle fuel waste.',
  },
  balancedOffPeak: {
    id: 'balancedOffPeak',
    name: 'Off-Peak Balanced Traffic',
    description: 'Uniform light to moderate demand distributed evenly across all four approaches.',
    spawnRates: {
      North: 12,
      South: 12,
      East: 12,
      West: 12,
    },
    vehicleMix: {
      twoWheeler: 0.35,
      autoRickshaw: 0.25,
      car: 0.30,
      bus: 0.06,
      truck: 0.04,
      ambulance: 0.0,
    },
    descriptionIndianContext: 'Mid-day standard urban traffic flow.',
  },
};

let nextVehicleId = 1;

export function generateVehicle(
  approach: ApproachDirection,
  scenario: TrafficScenario,
  isEmergency = false
): SimVehicle {
  let selectedType: VehicleType = 'car';

  if (isEmergency) {
    selectedType = 'ambulance';
  } else {
    const rand = Math.random();
    let cumulative = 0;
    for (const [vType, weight] of Object.entries(scenario.vehicleMix)) {
      cumulative += weight;
      if (rand <= cumulative) {
        selectedType = vType as VehicleType;
        break;
      }
    }
  }

  const lane = (Math.random() > 0.45 ? 1 : 0) as 0 | 1;

  return {
    id: `veh-${nextVehicleId++}`,
    type: selectedType,
    approach,
    spawnTime: 0,
    waitingTime: 0,
    hasCrossed: false,
    position: 220 + Math.random() * 30, // Start 220m to 250m away from stop line
    speed: 9.0 + Math.random() * 3.0, // ~35 km/h
    lane,
    isEmergency: selectedType === 'ambulance',
  };
}

export interface BenchmarkResult {
  algorithm: ControllerMode;
  algorithmName: string;
  scenarioId: string;
  scenarioName: string;
  durationSeconds: number;
  totalSpawned: number;
  totalCrossed: number;
  averageDelaySeconds: number;
  maxWaitSeconds: number;
  jainsFairnessIndex: number;
  fuelWastedLitres: number;
  co2EmittedKg: number;
  throughputVehiclesPerHour: number;
  averageQueuePCU: number;
}
