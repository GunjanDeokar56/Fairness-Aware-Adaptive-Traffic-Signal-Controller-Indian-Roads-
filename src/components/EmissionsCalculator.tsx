/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
  Fuel,
  Leaf,
  IndianRupee,
  Factory,
  Trees,
  TrendingDown,
  Layers,
  HelpCircle,
  ShieldCheck,
} from 'lucide-react';
import { INDIAN_VEHICLE_CONFIG } from '../utils/traffic-engine';

export const EmissionsCalculator: React.FC = () => {
  const [dailyTrafficVolume, setDailyTrafficVolume] = useState<number>(55000); // 55,000 vehicles/day at a typical metro junction
  const [currentAvgDelaySec, setCurrentAvgDelaySec] = useState<number>(54); // Fixed time average delay in seconds
  const [adaptiveAvgDelaySec, setAdaptiveAvgDelaySec] = useState<number>(36); // Fairness-aware adaptive delay in seconds
  const [fuelPriceINR, setFuelPriceINR] = useState<number>(102); // ₹102 per litre

  // Fleet Mix assumptions for Indian Urban Road (IRC standards)
  const fleetDistribution = {
    twoWheeler: 0.42,
    autoRickshaw: 0.24,
    car: 0.24,
    bus: 0.07,
    truck: 0.03,
  };

  // Weighted average idling fuel consumption (Litres per hour)
  const weightedIdleFuelPerHour =
    fleetDistribution.twoWheeler * INDIAN_VEHICLE_CONFIG.twoWheeler.idleFuelLitresPerHour +
    fleetDistribution.autoRickshaw * INDIAN_VEHICLE_CONFIG.autoRickshaw.idleFuelLitresPerHour +
    fleetDistribution.car * INDIAN_VEHICLE_CONFIG.car.idleFuelLitresPerHour +
    fleetDistribution.bus * INDIAN_VEHICLE_CONFIG.bus.idleFuelLitresPerHour +
    fleetDistribution.truck * INDIAN_VEHICLE_CONFIG.truck.idleFuelLitresPerHour; // ~0.66 Litres/hour/vehicle

  // Calculation per vehicle
  const delaySavedPerVehicleSec = Math.max(0, currentAvgDelaySec - adaptiveAvgDelaySec);
  const fuelSavedPerVehicleLitres = (delaySavedPerVehicleSec / 3600) * weightedIdleFuelPerHour;

  // Daily Totals
  const dailyFuelSavedLitres = dailyTrafficVolume * fuelSavedPerVehicleLitres;
  const dailyINRsaved = dailyFuelSavedLitres * fuelPriceINR;
  const dailyCO2savedKg = dailyFuelSavedLitres * 2.40; // 2.40 kg CO2 / L mixed fuel

  // Annual Totals (365 days)
  const annualFuelSavedLitres = dailyFuelSavedLitres * 365;
  const annualINRsaved = dailyINRsaved * 365;
  const annualCO2savedTons = (dailyCO2savedKg * 365) / 1000;
  const equivalentTrees = Math.round(annualCO2savedTons * 45); // ~45 urban trees absorb 1 ton CO2/year

  return (
    <div className="flex flex-col gap-5">
      {/* Header Banner */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-xl flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="text-xs font-semibold text-emerald-400 uppercase tracking-wider flex items-center gap-2">
            <Leaf className="w-4 h-4" />
            <span>Environmental Sustainability & Fuel Conservation (Objective 5)</span>
          </div>
          <h2 className="text-lg font-bold text-white mt-0.5">
            Urban Indian Road Junction Emissions & Idling Fuel Calculator
          </h2>
        </div>

        <div className="bg-slate-950 border border-slate-800 px-3 py-1.5 rounded-lg text-xs text-slate-300 font-mono">
          <span>Fleet Idle Factor: {weightedIdleFuelPerHour.toFixed(2)} L/hr</span>
        </div>
      </div>

      {/* Interactive Parameters Card */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-md">
        <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-4">
          Intersection Operational Parameters
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          {/* Daily Traffic Volume */}
          <div>
            <div className="flex justify-between text-xs text-slate-300 mb-1">
              <span>Daily Vehicle Flow</span>
              <span className="font-mono font-bold text-emerald-400">
                {dailyTrafficVolume.toLocaleString()} veh/day
              </span>
            </div>
            <input
              type="range"
              min="10000"
              max="120000"
              step="5000"
              value={dailyTrafficVolume}
              onChange={(e) => setDailyTrafficVolume(Number(e.target.value))}
              aria-label="Daily vehicle flow"
              className="w-full accent-emerald-500 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
            />
            <div className="text-[10px] text-slate-500 mt-1">Typical metro arterial junction</div>
          </div>

          {/* Fixed-Time Baseline Delay */}
          <div>
            <div className="flex justify-between text-xs text-slate-300 mb-1">
              <span>Fixed-Time Delay (Baseline)</span>
              <span className="font-mono font-bold text-rose-400">{currentAvgDelaySec}s / veh</span>
            </div>
            <input
              type="range"
              min="30"
              max="90"
              step="2"
              value={currentAvgDelaySec}
              onChange={(e) => setCurrentAvgDelaySec(Number(e.target.value))}
              aria-label="Fixed-time baseline delay in seconds"
              className="w-full accent-rose-500 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
            />
            <div className="text-[10px] text-slate-500 mt-1">Static pre-timed signal delay</div>
          </div>

          {/* Adaptive Delay */}
          <div>
            <div className="flex justify-between text-xs text-slate-300 mb-1">
              <span>Adaptive Delay (Proposed)</span>
              <span className="font-mono font-bold text-cyan-400">{adaptiveAvgDelaySec}s / veh</span>
            </div>
            <input
              type="range"
              min="18"
              max="60"
              step="2"
              value={adaptiveAvgDelaySec}
              onChange={(e) => setAdaptiveAvgDelaySec(Number(e.target.value))}
              aria-label="Adaptive delay in seconds"
              className="w-full accent-cyan-500 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
            />
            <div className="text-[10px] text-slate-500 mt-1">
              Save {delaySavedPerVehicleSec}s ({Math.round((delaySavedPerVehicleSec / currentAvgDelaySec) * 100)}% reduction)
            </div>
          </div>

          {/* Fuel Price */}
          <div>
            <div className="flex justify-between text-xs text-slate-300 mb-1">
              <span>Fuel Price (INR)</span>
              <span className="font-mono font-bold text-amber-400">Rs. {fuelPriceINR} / Litre</span>
            </div>
            <input
              type="range"
              min="90"
              max="120"
              step="1"
              value={fuelPriceINR}
              onChange={(e) => setFuelPriceINR(Number(e.target.value))}
              aria-label="Fuel price in INR"
              className="w-full accent-amber-500 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
            />
            <div className="text-[10px] text-slate-500 mt-1">Current metro petrol/diesel benchmark</div>
          </div>
        </div>
      </div>

      {/* Primary Impact Metric Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* Annual Fuel Savings */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-lg flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
              Annual Fuel Saved
            </span>
            <Fuel className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="mt-2">
            <div className="text-2xl font-bold text-white font-mono">
              {(annualFuelSavedLitres / 1000).toFixed(1)}k
              <span className="text-xs font-normal text-slate-400 ml-1">Litres</span>
            </div>
            <div className="text-xs text-emerald-400 mt-1">
              ~{Math.round(dailyFuelSavedLitres)} Litres conserved daily
            </div>
          </div>
          <div className="text-[10px] text-slate-500 mt-3 pt-2 border-t border-slate-800">
            Eliminates pointless idling during empty red phases
          </div>
        </div>

        {/* Financial Savings in INR */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-lg flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
              Annual Financial Value
            </span>
            <IndianRupee className="w-4 h-4 text-amber-400" />
          </div>
          <div className="mt-2">
            <div className="text-2xl font-bold text-white font-mono">
              Rs. {(annualINRsaved / 100000).toFixed(1)}
              <span className="text-xs font-normal text-slate-400 ml-1">Lakhs</span>
            </div>
            <div className="text-xs text-amber-400 mt-1">
              Rs. {Math.round(dailyINRsaved).toLocaleString()} saved / day
            </div>
          </div>
          <div className="text-[10px] text-slate-500 mt-3 pt-2 border-t border-slate-800">
            Direct economic relief to commuters and cab drivers
          </div>
        </div>

        {/* CO2 Emissions Cut */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-lg flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
              Carbon Offset (CO2)
            </span>
            <Factory className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="mt-2">
            <div className="text-2xl font-bold text-white font-mono">
              {annualCO2savedTons.toFixed(1)}
              <span className="text-xs font-normal text-slate-400 ml-1">Metric Tons</span>
            </div>
            <div className="text-xs text-cyan-400 mt-1">
              ~{(dailyCO2savedKg / 1000).toFixed(2)} Tons CO2 reduced / day
            </div>
          </div>
          <div className="text-[10px] text-slate-500 mt-3 pt-2 border-t border-slate-800">
            Based on 2.40 kg CO2 per litre idling rate
          </div>
        </div>

        {/* Tree Offset Equivalent */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-lg flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
              Ecological Equivalent
            </span>
            <Trees className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="mt-2">
            <div className="text-2xl font-bold text-white font-mono">
              {equivalentTrees.toLocaleString()}
              <span className="text-xs font-normal text-slate-400 ml-1">Trees</span>
            </div>
            <div className="text-xs text-emerald-400 mt-1">
              Urban forest carbon sequester equivalence
            </div>
          </div>
          <div className="text-[10px] text-slate-500 mt-3 pt-2 border-t border-slate-800">
            MoRTH green corridor sustainability metric
          </div>
        </div>
      </div>

      {/* Fleet Mix Idling Consumption Breakdown */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-md">
        <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-3 flex items-center justify-between">
          <span>Heterogeneous Indian Fleet Idling Fuel Consumption Standards</span>
          <span className="text-[10px] text-slate-400">MoRTH & ARAI Benchmark</span>
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
          {Object.entries(INDIAN_VEHICLE_CONFIG).filter(([k]) => k !== 'ambulance').map(([type, def]) => {
            const share = fleetDistribution[type as keyof typeof fleetDistribution] || 0.1;
            return (
              <div key={type} className="bg-slate-950 p-3 rounded-lg border border-slate-800">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-bold text-slate-200">{def.name.split('(')[0]}</span>
                  <span className="text-[10px] font-mono text-emerald-400 font-bold">{Math.round(share * 100)}% mix</span>
                </div>
                <div className="text-sm font-bold font-mono text-amber-300">
                  {def.idleFuelLitresPerHour.toFixed(2)} <span className="text-[10px] font-normal text-slate-400">L/hour idle</span>
                </div>
                <div className="text-[10px] text-slate-500 mt-1">
                  PCU: {def.pcu} | {def.lengthMeters}m
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
