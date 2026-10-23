/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
  IntersectionSimulation,
} from './components/IntersectionSimulation';
import { CCTVVisionFeeds } from './components/CCTVVisionFeeds';
import { ComparativeBenchmarks } from './components/ComparativeBenchmarks';
import { EmissionsCalculator } from './components/EmissionsCalculator';
import { AIEngineeringAdvisory } from './components/AIEngineeringAdvisory';
import { MathFormulationTab } from './components/MathFormulationTab';
import {
  Activity,
  Camera,
  BarChart3,
  Leaf,
  BrainCircuit,
  Sigma,
  Radio,
  Sliders,
  Sparkles,
} from 'lucide-react';

type TabKey = 'sim' | 'cctv' | 'benchmarks' | 'emissions' | 'ai' | 'math';

export default function App() {
  const [activeTab, setActiveTab] = useState<TabKey>('sim');
  const [telemetry, setTelemetry] = useState<any>(null);

  return (
    <div className="min-h-screen bg-[#070b14] text-slate-100 flex flex-col font-sans antialiased">
      {/* Top ITMS Header */}
      <header className="bg-slate-950/95 border-b border-slate-800/80 sticky top-0 z-50 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 py-2.5 flex flex-wrap items-center justify-between gap-4">
          {/* Logo & Project Title */}
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-emerald-500 to-cyan-500 p-0.5 shadow-lg shadow-emerald-500/20 flex items-center justify-center">
              <div className="w-full h-full bg-slate-950 rounded-[10px] flex items-center justify-center">
                <span className="text-sm font-black bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent">
                  UT
                </span>
              </div>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-sm font-black text-white tracking-wide uppercase">
                  Fairness-Aware Adaptive Traffic Signal Management
                </h1>
                <span className="hidden sm:inline-block text-[10px] font-mono bg-emerald-950 text-emerald-400 border border-emerald-800/60 px-1.5 py-0.5 rounded">
                  IRC: 106-1990
                </span>
              </div>
              <div className="text-[11px] text-slate-400">
                Urban Indian Roads Intelligent Transportation Systems (ITMS) Prototype
              </div>
            </div>
          </div>

          {/* Live Controller Status HUD */}
          <div className="flex items-center gap-3 text-xs">
            {/* Live Indicator */}
            <div className="flex items-center gap-1.5 bg-slate-900 border border-slate-800 px-2.5 py-1 rounded-full text-slate-300">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="font-mono text-[11px]">CONTROLLER: ACTIVE</span>
            </div>

            {/* Live Jain Fairness Indicator */}
            {telemetry && (
              <div className="hidden sm:flex items-center gap-1.5 bg-slate-900 border border-slate-800 px-2.5 py-1 rounded-full font-mono text-[11px]">
                <span className="text-slate-400">Jain Fairness:</span>
                <span className="text-emerald-400 font-bold">
                  {(telemetry.fairnessIndex * 100).toFixed(0)}%
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Tab Navigation Navigation Bar */}
        <div className="max-w-7xl mx-auto px-4 overflow-x-auto scrollbar-none">
          <nav className="flex space-x-1 py-1" aria-label="Tabs">
            <button
              onClick={() => setActiveTab('sim')}
              className={`px-3.5 py-2 rounded-lg text-xs font-semibold flex items-center gap-2 transition-all whitespace-nowrap ${
                activeTab === 'sim'
                  ? 'bg-emerald-600/20 text-emerald-400 border border-emerald-500/30'
                  : 'text-slate-400 hover:text-white hover:bg-slate-900'
              }`}
            >
              <Activity className="w-3.5 h-3.5" />
              Live Intersection & Simulation
            </button>

            <button
              onClick={() => setActiveTab('cctv')}
              className={`px-3.5 py-2 rounded-lg text-xs font-semibold flex items-center gap-2 transition-all whitespace-nowrap ${
                activeTab === 'cctv'
                  ? 'bg-emerald-600/20 text-emerald-400 border border-emerald-500/30'
                  : 'text-slate-400 hover:text-white hover:bg-slate-900'
              }`}
            >
              <Camera className="w-3.5 h-3.5" />
              CCTV AI Vision & PCU Detection
            </button>

            <button
              onClick={() => setActiveTab('benchmarks')}
              className={`px-3.5 py-2 rounded-lg text-xs font-semibold flex items-center gap-2 transition-all whitespace-nowrap ${
                activeTab === 'benchmarks'
                  ? 'bg-emerald-600/20 text-emerald-400 border border-emerald-500/30'
                  : 'text-slate-400 hover:text-white hover:bg-slate-900'
              }`}
            >
              <BarChart3 className="w-3.5 h-3.5" />
              Comparative Benchmark Suite
            </button>

            <button
              onClick={() => setActiveTab('emissions')}
              className={`px-3.5 py-2 rounded-lg text-xs font-semibold flex items-center gap-2 transition-all whitespace-nowrap ${
                activeTab === 'emissions'
                  ? 'bg-emerald-600/20 text-emerald-400 border border-emerald-500/30'
                  : 'text-slate-400 hover:text-white hover:bg-slate-900'
              }`}
            >
              <Leaf className="w-3.5 h-3.5" />
              Emissions & Idling Fuel Impact
            </button>

            <button
              onClick={() => setActiveTab('ai')}
              className={`px-3.5 py-2 rounded-lg text-xs font-semibold flex items-center gap-2 transition-all whitespace-nowrap ${
                activeTab === 'ai'
                  ? 'bg-emerald-600/20 text-emerald-400 border border-emerald-500/30'
                  : 'text-slate-400 hover:text-white hover:bg-slate-900'
              }`}
            >
              <BrainCircuit className="w-3.5 h-3.5" />
              AI Engineering Advisory
            </button>

            <button
              onClick={() => setActiveTab('math')}
              className={`px-3.5 py-2 rounded-lg text-xs font-semibold flex items-center gap-2 transition-all whitespace-nowrap ${
                activeTab === 'math'
                  ? 'bg-emerald-600/20 text-emerald-400 border border-emerald-500/30'
                  : 'text-slate-400 hover:text-white hover:bg-slate-900'
              }`}
            >
              <Sigma className="w-3.5 h-3.5" />
              Algorithm & Math Formulation
            </button>
          </nav>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl mx-auto w-full p-4 md:p-6">
        {/* Tab 1: Live Simulation */}
        <div className={activeTab === 'sim' ? 'block' : 'hidden'}>
          <IntersectionSimulation onTelemetryUpdate={(t) => setTelemetry(t)} />
        </div>

        {/* Tab 2: CCTV Vision Feeds */}
        {activeTab === 'cctv' && (
          <CCTVVisionFeeds
            vehicles={telemetry?.vehicles || []}
            currentPhase={telemetry?.currentPhase || 'NS_GREEN'}
          />
        )}

        {/* Tab 3: Comparative Benchmarks */}
        {activeTab === 'benchmarks' && <ComparativeBenchmarks />}

        {/* Tab 4: Emissions Calculator */}
        {activeTab === 'emissions' && <EmissionsCalculator />}

        {/* Tab 5: AI Engineering Advisory */}
        {activeTab === 'ai' && <AIEngineeringAdvisory telemetry={telemetry} />}

        {/* Tab 6: Mathematical Formulation & IRC standards */}
        {activeTab === 'math' && <MathFormulationTab />}
      </main>

      {/* System Footer */}
      <footer className="bg-slate-950 border-t border-slate-900 py-3 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 flex flex-wrap items-center justify-between gap-2">
          <div>
            Fairness-Aware Adaptive Traffic Signal Controller Prototype • MoRTH & IRC: 106-1990 Standards
          </div>
          <div className="flex items-center gap-4 text-[11px] font-mono">
            <span>Heterogeneous PCU Equivalence</span>
            <span>•</span>
            <span>Jain's Fairness Metric</span>
            <span>•</span>
            <span>Edge AI Queue Estimation</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
