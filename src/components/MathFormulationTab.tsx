/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
  calculateJainsFairnessIndex,
  INDIAN_VEHICLE_CONFIG,
} from '../utils/traffic-engine';
import {
  Binary,
  Scale,
  Calculator,
  Sliders,
  CheckCircle,
  BookOpen,
  Sigma,
} from 'lucide-react';

export const MathFormulationTab: React.FC = () => {
  // Sandbox parameters
  const [alpha, setAlpha] = useState<number>(0.55);
  const [beta, setBeta] = useState<number>(0.45);
  const [gamma, setGamma] = useState<number>(1.8);
  const [threshold, setThreshold] = useState<number>(80);

  // Approach waits test
  const [waitN, setWaitN] = useState<number>(25);
  const [waitS, setWaitS] = useState<number>(20);
  const [waitE, setWaitE] = useState<number>(85);
  const [waitW, setWaitW] = useState<number>(75);

  // Approach PCUs test
  const [pcuN, setPcuN] = useState<number>(24);
  const [pcuS, setPcuS] = useState<number>(18);
  const [pcuE, setPcuE] = useState<number>(4);
  const [pcuW, setPcuW] = useState<number>(3);

  const jainsIndex = calculateJainsFairnessIndex([waitN, waitS, waitE, waitW]);

  // Scores
  const computeScore = (pcu: number, wait: number) => {
    const demand = alpha * (pcu / 25);
    const fairness = beta * Math.pow(Math.max(0, wait / threshold), gamma);
    return {
      demand: Number(demand.toFixed(3)),
      fairness: Number(fairness.toFixed(3)),
      total: Number((demand + fairness).toFixed(3)),
    };
  };

  const scoreNS = computeScore((pcuN + pcuS) / 2, Math.max(waitN, waitS));
  const scoreEW = computeScore((pcuE + pcuW) / 2, Math.max(waitE, waitW));

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-xl flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="text-xs font-semibold text-emerald-400 uppercase tracking-wider flex items-center gap-2">
            <Sigma className="w-4 h-4" />
            <span>Mathematical & Algorithmic Formulation</span>
          </div>
          <h2 className="text-lg font-bold text-white mt-0.5">
            Fairness-Aware Adaptive Traffic Signal Controller Mechanics
          </h2>
        </div>
        <div className="bg-slate-950 border border-slate-800 px-3 py-1.5 rounded-lg text-xs text-slate-300 font-mono">
          IRC: 106-1990 & Jain's Fairness Criterion
        </div>
      </div>

      {/* Core Math Formulations Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Formula 1: Jain's Fairness Index */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-md flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 text-xs font-bold text-emerald-400 uppercase tracking-wider mb-2">
              <Scale className="w-4 h-4" />
              1. Jain's Fairness Index Formula
            </div>
            <p className="text-xs text-slate-300 leading-relaxed mb-3">
              Measures the degree of equity in waiting times across all $n$ intersection approaches.
            </p>

            <div className="bg-slate-950 p-4 rounded-lg border border-slate-800 flex flex-col items-center justify-center font-serif text-sm text-emerald-300 my-2 shadow-inner">
              <div className="flex items-center gap-2">
                <span className="italic font-bold text-base text-white">J(W)</span>
                <span>=</span>
                <div className="inline-flex flex-col items-center text-center">
                  <span className="border-b border-emerald-400/80 px-2 pb-0.5">
                    (&Sigma; <span className="italic">W</span><sub>i</sub>)<sup>2</sup>
                  </span>
                  <span className="pt-0.5 text-slate-300 font-mono text-xs">
                    <span className="italic">n</span> &middot; &Sigma; (<span className="italic">W</span><sub>i</sub><sup>2</sup>)
                  </span>
                </div>
              </div>
            </div>

            <ul className="text-xs text-slate-400 space-y-1.5 mt-3">
              <li>• When waiting times are identical across all arms: <strong className="text-white">J = 1.0 (Ideal Equity)</strong></li>
              <li>• Under greedy queue allocation where minor approaches starve: <strong className="text-rose-400">J &rarr; 1/n = 0.25 (Severe Starvation)</strong></li>
              <li>• System target: Maintain <strong className="text-emerald-400">J &gt; 0.85</strong> even under peak directional surges.</li>
            </ul>
          </div>
        </div>

        {/* Formula 2: Dynamic Fairness-Aware Scoring */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-md flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 text-xs font-bold text-cyan-400 uppercase tracking-wider mb-2">
              <Binary className="w-4 h-4" />
              2. Proposed Dynamic Approach Urgency Score
            </div>
            <p className="text-xs text-slate-300 leading-relaxed mb-3">
              Unifies demand pressure (PCU queue) with a non-linear starvation penalty barrier:
            </p>

            <div className="bg-slate-950 p-4 rounded-lg border border-slate-800 flex items-center justify-center font-serif text-xs md:text-sm text-cyan-300 my-2 shadow-inner overflow-x-auto">
              <div className="flex items-center gap-2 flex-wrap justify-center">
                <span className="italic font-bold text-white text-base">S</span><sub>i</sub>
                <span>=</span>
                <span>&alpha; &middot;</span>
                <span className="inline-flex flex-col items-center">
                  <span className="border-b border-cyan-400/80 px-1 font-mono text-xs">PCU<sub>i</sub></span>
                  <span className="font-mono text-[10px] text-slate-400">C<sub>sat</sub></span>
                </span>
                <span>+</span>
                <span>&beta; &middot;</span>
                <span className="inline-flex items-center">
                  <span className="text-lg">(</span>
                  <span className="inline-flex flex-col items-center mx-0.5">
                    <span className="border-b border-cyan-400/80 px-1 font-mono text-xs"><span className="italic">W</span><sub>i</sub></span>
                    <span className="font-mono text-[10px] text-slate-400"><span className="italic">W</span><sub>thresh</sub></span>
                  </span>
                  <span className="text-lg">)</span>
                  <sup className="font-mono text-amber-300 ml-0.5 font-bold">&gamma;</sup>
                </span>
                <span>+</span>
                <span className="font-mono text-rose-400 font-bold">&Omega;<sub>emer</sub></span>
              </div>
            </div>

            <ul className="text-xs text-slate-400 space-y-1.5 mt-3">
              <li>• <span className="text-white">α (0.55):</span> Weight given to immediate queue discharge throughput.</li>
              <li>• <span className="text-white">β (0.45):</span> Weight given to waiting time fairness guarantee.</li>
              <li>• <span className="text-white">γ (1.8):</span> Non-linear escalation exponent ensuring rapid priority flip before starvation.</li>
              <li>• <span className="text-rose-400">Ω (10,000):</span> Instant preemptive override for emergency ambulances.</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Interactive Math Sandbox */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-xl">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Calculator className="w-5 h-5 text-emerald-400" />
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">
              Interactive Mathematical Formulation Sandbox
            </h3>
          </div>
          <span className="text-xs text-slate-400">Tweak parameters to observe score shifts</span>
        </div>

        {/* Slider Controls */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 bg-slate-950 p-4 rounded-lg border border-slate-800 mb-5">
          <div>
            <div className="flex justify-between text-xs text-slate-300 mb-1">
              <span>α (Demand Weight):</span>
              <span className="font-mono text-emerald-400 font-bold">{alpha}</span>
            </div>
            <input
              type="range"
              min="0.1"
              max="0.9"
              step="0.05"
              value={alpha}
              onChange={(e) => {
                const val = Number(e.target.value);
                setAlpha(val);
                setBeta(Number((1 - val).toFixed(2)));
              }}
              aria-label="Demand weight alpha"
              className="w-full accent-emerald-500 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
            />
          </div>

          <div>
            <div className="flex justify-between text-xs text-slate-300 mb-1">
              <span>β (Fairness Weight):</span>
              <span className="font-mono text-cyan-400 font-bold">{beta}</span>
            </div>
            <input
              type="range"
              min="0.1"
              max="0.9"
              step="0.05"
              value={beta}
              onChange={(e) => {
                const val = Number(e.target.value);
                setBeta(val);
                setAlpha(Number((1 - val).toFixed(2)));
              }}
              aria-label="Fairness weight beta"
              className="w-full accent-cyan-500 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
            />
          </div>

          <div>
            <div className="flex justify-between text-xs text-slate-300 mb-1">
              <span>γ (Escalation Exponent):</span>
              <span className="font-mono text-amber-400 font-bold">{gamma}</span>
            </div>
            <input
              type="range"
              min="1.0"
              max="3.0"
              step="0.1"
              value={gamma}
              onChange={(e) => setGamma(Number(e.target.value))}
              aria-label="Escalation exponent gamma"
              className="w-full accent-amber-500 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
            />
          </div>

          <div>
            <div className="flex justify-between text-xs text-slate-300 mb-1">
              <span>Starvation Threshold:</span>
              <span className="font-mono text-rose-400 font-bold">{threshold}s</span>
            </div>
            <input
              type="range"
              min="50"
              max="120"
              step="5"
              value={threshold}
              onChange={(e) => setThreshold(Number(e.target.value))}
              aria-label="Starvation threshold in seconds"
              className="w-full accent-rose-500 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
            />
          </div>
        </div>

        {/* Live Scenario Math Demonstration: Heavy Arterial vs Starving Side */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* North-South Corridor (Heavy Arterial) */}
          <div className="p-4 bg-slate-950 rounded-lg border border-slate-800">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-white">North-South (Heavy Arterial)</span>
              <span className="text-[10px] bg-slate-800 px-2 py-0.5 rounded text-amber-300 font-mono">
                Queue: {pcuN + pcuS} PCU
              </span>
            </div>
            <div className="space-y-1 text-xs text-slate-300 font-mono">
              <div className="flex justify-between">
                <span className="text-slate-400">Demand Score:</span>
                <span className="text-emerald-400">{scoreNS.demand}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Fairness Term:</span>
                <span className="text-cyan-400">{scoreNS.fairness}</span>
              </div>
              <div className="flex justify-between border-t border-slate-800 pt-1 font-bold">
                <span>Total Score:</span>
                <span className="text-white text-sm">{scoreNS.total}</span>
              </div>
            </div>
          </div>

          {/* East-West Corridor (Minor Feeder with Escalating Wait) */}
          <div className="p-4 bg-slate-950 rounded-lg border border-slate-800">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-white">East-West (Minor Feeder Street)</span>
              <span className="text-[10px] bg-slate-800 px-2 py-0.5 rounded text-cyan-300 font-mono">
                Queue: {pcuE + pcuW} PCU | Wait: {Math.max(waitE, waitW)}s
              </span>
            </div>
            <div className="space-y-1 text-xs text-slate-300 font-mono">
              <div className="flex justify-between">
                <span className="text-slate-400">Demand Score:</span>
                <span className="text-emerald-400">{scoreEW.demand}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Fairness Term:</span>
                <span className="text-cyan-400 font-bold">{scoreEW.fairness}</span>
              </div>
              <div className="flex justify-between border-t border-slate-800 pt-1 font-bold">
                <span>Total Score:</span>
                <span className="text-white text-sm">{scoreEW.total}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Outcome Badge */}
        <div className="mt-4 p-3 bg-slate-950 rounded-lg border border-slate-800 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-emerald-400" />
            <span className="text-slate-300">
              Next Phase Scheduled by Proposed Algorithm:
            </span>
            <span className={`font-bold px-2 py-0.5 rounded ${scoreEW.total > scoreNS.total ? 'bg-cyan-950 text-cyan-300 border border-cyan-800' : 'bg-emerald-950 text-emerald-300 border border-emerald-800'}`}>
              {scoreEW.total > scoreNS.total ? 'East-West Phase (Starvation Averted!)' : 'North-South Phase (Demand Serviced)'}
            </span>
          </div>

          <div className="font-mono text-slate-400">
            Jain's Index: <span className="font-bold text-white">{(jainsIndex * 100).toFixed(1)}%</span>
          </div>
        </div>
      </div>
    </div>
  );
};
