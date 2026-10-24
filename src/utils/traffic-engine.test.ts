import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateTotalPCU,
  calculateJainsFairnessIndex,
  calculateAxisScore,
  calculateGreenDuration,
  calculateEmissions,
  generateTelemetryCSV,
  calculateDetectedPCU,
  estimateGreenDurationFromPCU,
  DEFAULT_CONTROLLER_PARAMS,
  SimVehicle,
  ApproachQueueState,
} from './traffic-engine.ts';

test('calculateTotalPCU respects Indian IRC: 106-1990 standards', () => {
  const vehicles: SimVehicle[] = [
    { id: '1', type: 'twoWheeler', approach: 'North', spawnTime: 0, waitingTime: 5, hasCrossed: false, position: 10, speed: 0, lane: 0, isEmergency: false }, // 0.5
    { id: '2', type: 'autoRickshaw', approach: 'North', spawnTime: 0, waitingTime: 5, hasCrossed: false, position: 20, speed: 0, lane: 0, isEmergency: false }, // 0.8
    { id: '3', type: 'car', approach: 'North', spawnTime: 0, waitingTime: 5, hasCrossed: false, position: 30, speed: 0, lane: 0, isEmergency: false }, // 1.0
    { id: '4', type: 'bus', approach: 'North', spawnTime: 0, waitingTime: 5, hasCrossed: false, position: 40, speed: 0, lane: 0, isEmergency: false }, // 3.0
    { id: '5', type: 'car', approach: 'North', spawnTime: 0, waitingTime: 5, hasCrossed: true, position: 0, speed: 10, lane: 0, isEmergency: false }, // crossed, ignored
  ];

  const total = calculateTotalPCU(vehicles);
  assert.equal(Number(total.toFixed(2)), 5.30); // 0.5 + 0.8 + 1.0 + 3.0 = 5.3
});

test('calculateJainsFairnessIndex behaves accurately', () => {
  // Equal waiting times across 4 arms -> Fairness should be 1.0
  const equalWait = [30, 30, 30, 30];
  assert.equal(calculateJainsFairnessIndex(equalWait), 1.0);

  // All zeros -> Fairness should be 1.0 (balanced empty junction)
  assert.equal(calculateJainsFairnessIndex([0, 0, 0, 0]), 1.0);

  // Heavily starved arm: one arm waits 120s while others wait 5s
  const starvedWait = [5, 5, 120, 5];
  const fairIndex = calculateJainsFairnessIndex(starvedWait);
  assert.ok(fairIndex < 0.65, `Fairness should be low during starvation, got ${fairIndex}`);

  // Extreme starvation: 1 arm 1000s, others 0s -> approaches 1/4 = 0.25
  const extremeStarved = [0, 0, 1000, 0];
  const extremeIndex = calculateJainsFairnessIndex(extremeStarved);
  assert.equal(extremeIndex, 0.25);
});

test('calculateAxisScore triggers emergency preemption correctly', () => {
  const approachesWithAmbulance: ApproachQueueState[] = [
    {
      direction: 'North',
      vehicles: [],
      totalVehicles: 2,
      totalPCU: 2.2,
      maxWaitSeconds: 10,
      avgWaitSeconds: 10,
      hasEmergency: true,
    },
    {
      direction: 'South',
      vehicles: [],
      totalVehicles: 1,
      totalPCU: 1.0,
      maxWaitSeconds: 5,
      avgWaitSeconds: 5,
      hasEmergency: false,
    },
  ];

  const result = calculateAxisScore(approachesWithAmbulance, DEFAULT_CONTROLLER_PARAMS, 'fairnessAware');
  assert.ok(result.score > 9000, 'Emergency bonus should guarantee immediate priority');
  assert.equal(result.hasEmergency, true);
});

test('fairness-aware mode elevates starving minor street over greedy queue-only', () => {
  // Heavy main road: 20 PCU, waiting 20s
  const heavyMain: ApproachQueueState[] = [
    { direction: 'North', vehicles: [], totalVehicles: 15, totalPCU: 12.0, maxWaitSeconds: 20, avgWaitSeconds: 15, hasEmergency: false },
    { direction: 'South', vehicles: [], totalVehicles: 10, totalPCU: 8.0, maxWaitSeconds: 20, avgWaitSeconds: 15, hasEmergency: false },
  ]; // Total PCU = 20.0, maxWait = 20

  // Minor side road: 3 PCU, but waiting 95s (exceeds maxAcceptableWait = 80s)
  const minorSide: ApproachQueueState[] = [
    { direction: 'East', vehicles: [], totalVehicles: 2, totalPCU: 1.5, maxWaitSeconds: 95, avgWaitSeconds: 90, hasEmergency: false },
    { direction: 'West', vehicles: [], totalVehicles: 2, totalPCU: 1.5, maxWaitSeconds: 85, avgWaitSeconds: 80, hasEmergency: false },
  ]; // Total PCU = 3.0, maxWait = 95

  // In queue-only mode, heavyMain dominates (20 > 3)
  const queueHeavy = calculateAxisScore(heavyMain, DEFAULT_CONTROLLER_PARAMS, 'queueOnly');
  const queueMinor = calculateAxisScore(minorSide, DEFAULT_CONTROLLER_PARAMS, 'queueOnly');
  assert.ok(queueHeavy.score > queueMinor.score, 'Queue-only should prioritize heavy main road');

  // In fairness-aware mode, minor road starvation term escalates sharply!
  const fairHeavy = calculateAxisScore(heavyMain, DEFAULT_CONTROLLER_PARAMS, 'fairnessAware');
  const fairMinor = calculateAxisScore(minorSide, DEFAULT_CONTROLLER_PARAMS, 'fairnessAware');
  assert.ok(fairMinor.score > fairHeavy.score, `Fairness-aware must prioritize starving minor road to avoid infinite blockage! (Minor: ${fairMinor.score.toFixed(2)}, Heavy: ${fairHeavy.score.toFixed(2)})`);
});

test('calculateGreenDuration clamps within minGreen and maxGreen', () => {
  const zeroQueueDuration = calculateGreenDuration(0, DEFAULT_CONTROLLER_PARAMS);
  assert.equal(zeroQueueDuration, DEFAULT_CONTROLLER_PARAMS.minGreen);

  const massiveQueueDuration = calculateGreenDuration(100, DEFAULT_CONTROLLER_PARAMS);
  assert.equal(massiveQueueDuration, DEFAULT_CONTROLLER_PARAMS.maxGreen);

  const moderateQueueDuration = calculateGreenDuration(12, DEFAULT_CONTROLLER_PARAMS);
  assert.ok(moderateQueueDuration >= DEFAULT_CONTROLLER_PARAMS.minGreen && moderateQueueDuration <= DEFAULT_CONTROLLER_PARAMS.maxGreen);
});

test('calculateEmissions computes idling fuel and CO2 correctly', () => {
  const vehicles: SimVehicle[] = [
    { id: '1', type: 'car', approach: 'North', spawnTime: 0, waitingTime: 3600, hasCrossed: false, position: 0, speed: 0, lane: 0, isEmergency: false }, // 1 hour idle -> 0.8L
    { id: '2', type: 'bus', approach: 'South', spawnTime: 0, waitingTime: 1800, hasCrossed: false, position: 0, speed: 0, lane: 0, isEmergency: false }, // 0.5 hour idle -> 1.25L
  ];

  const emissions = calculateEmissions(vehicles);
  // Total fuel = 0.8 + 1.25 = 2.05 L
  assert.equal(emissions.fuelWastedLitres, 2.05);
  // Total CO2 = 2.05 * 2.40 = 4.92 kg
  assert.equal(emissions.co2EmittedKg, 4.92);
  assert.ok(emissions.fuelCostINR > 200);
});

test('generateTelemetryCSV produces valid structured CSV format', () => {
  const sampleData = {
    timestamp: '2026-10-23T21:00:00Z',
    scenarioName: 'Morning Commuter Peak',
    scenarioId: 'morningPeak',
    controllerMode: 'fairnessAware' as const,
    currentPhase: 'NS_GREEN' as const,
    phaseTimeRemaining: 22,
    allocatedGreenTime: 30,
    jainsFairnessIndex: 0.912,
    throughputCrossed: 14,
    alphaDemandWeight: 0.55,
    betaFairnessWeight: 0.45,
    starvationThresholdSec: 80,
    armTelemetry: {
      North: { pcu: 8.5, count: 6, maxWait: 15, avgWait: 10 },
      South: { pcu: 6.0, count: 4, maxWait: 12, avgWait: 8 },
      East: { pcu: 2.2, count: 2, maxWait: 45, avgWait: 30 },
      West: { pcu: 1.5, count: 2, maxWait: 40, avgWait: 25 },
    },
    vehicles: [
      { id: 'v-101', type: 'twoWheeler' as const, approach: 'North' as const, spawnTime: 0, waitingTime: 15, hasCrossed: false, position: 20, speed: 0, lane: 0 as const, isEmergency: false },
      { id: 'v-102', type: 'autoRickshaw' as const, approach: 'East' as const, spawnTime: 0, waitingTime: 45, hasCrossed: false, position: 10, speed: 0, lane: 1 as const, isEmergency: false },
    ],
    emissions: {
      totalIdleTimeSeconds: 60,
      fuelWastedLitres: 0.05,
      co2EmittedKg: 0.12,
      fuelCostINR: 5.1,
    },
    events: [
      {
        id: 'evt-1',
        simTimeSeconds: 12.5,
        wallClockTime: '10:30:15',
        category: 'STARVATION_BREACH' as const,
        severity: 'warning' as const,
        approach: 'East' as const,
        title: 'Starvation Alert: East Approach',
        details: 'Queue wait exceeded acceptable threshold',
        metricValue: '45s Wait',
      },
      {
        id: 'evt-2',
        simTimeSeconds: 25.0,
        wallClockTime: '10:30:28',
        category: 'PHASE_CHANGE' as const,
        severity: 'info' as const,
        title: 'Phase Transition to EW Green',
        details: 'Adaptive controller switched phase',
        metricValue: '28s Green',
      },
    ],
  };

  const result = generateTelemetryCSV(sampleData);
  assert.ok(result.includes('METRIC,VALUE,UNIT'));
  assert.ok(result.includes('APPROACH_DIRECTION,QUEUED_VEHICLES,TOTAL_PCU'));
  assert.ok(result.includes('VEHICLE_ID,APPROACH,VEHICLE_TYPE'));
  assert.ok(result.includes('v-101,North'));
  assert.ok(result.includes('v-102,East'));
  assert.ok(result.includes('Two-Wheeler'));
  assert.ok(result.includes('Auto-Rickshaw'));

  // Verify Event Log Section
  assert.ok(result.includes('# 4. SIMULATION EVENT LOG & THRESHOLD BREACHES'));
  assert.ok(result.includes('EVENT_ID,WALL_CLOCK_TIME,SIMULATION_SECONDS,CATEGORY,SEVERITY,APPROACH,TITLE,DETAILS,METRIC_VALUE'));
  assert.ok(result.includes('evt-1,10:30:15,12.5,STARVATION_BREACH,warning,East'));
  assert.ok(result.includes('"Starvation Alert: East Approach"'));
  assert.ok(result.includes('evt-2,10:30:28,25.0,PHASE_CHANGE,info,ALL'));
});

test('calculateDetectedPCU accurately computes IRC: 106-1990 weights for CCTV vision', () => {
  // 6 bikes (0.5), 4 autos (0.8), 3 cars (1.0), 2 buses (3.0), 1 ambulance (1.2)
  const counts = {
    twoWheeler: 6,
    autoRickshaw: 4,
    car: 3,
    bus: 2,
    truck: 1,
    ambulance: 1,
  };
  // 6*0.5 (3) + 4*0.8 (3.2) + 3*1.0 (3) + 2*3.0 (6) + 1*1.6 (1.6) + 1*1.2 (1.2) = 18.0
  const pcu = calculateDetectedPCU(counts);
  assert.equal(pcu, 18.0);

  const greenTime = estimateGreenDurationFromPCU(pcu);
  assert.ok(greenTime >= 15 && greenTime <= 60);
  assert.equal(greenTime, Math.round(3 + 18.0 / 0.65)); // 31s
});
