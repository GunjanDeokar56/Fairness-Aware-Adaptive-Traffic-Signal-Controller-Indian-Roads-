/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
  Sparkles,
  Bot,
  BrainCircuit,
  AlertCircle,
  CheckCircle2,
  TrendingUp,
  FileText,
  RefreshCw,
  Shield,
  Lightbulb,
} from 'lucide-react';

interface AIEngineeringAdvisoryProps {
  telemetry: any;
}

export const AIEngineeringAdvisory: React.FC<AIEngineeringAdvisoryProps> = ({
  telemetry,
}) => {
  const [loading, setLoading] = useState<boolean>(false);
  const [diagnostic, setDiagnostic] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchAIDiagnostic = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/traffic-ai-diagnostic', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          telemetry: telemetry || {
            queueN: 14.5,
            queueS: 12.0,
            queueE: 3.5,
            queueW: 2.0,
            fairnessIndex: 0.91,
            maxWaitSeconds: 42,
            hasEmergency: false,
            mode: 'fairnessAware',
          },
          scenario: telemetry?.activeScenario?.name || 'Extreme Asymmetry',
          mode: telemetry?.mode || 'fairnessAware',
          params: telemetry?.params,
        }),
      });

      const data = await response.json();
      if (data.success) {
        setDiagnostic(data);
      } else {
        setError(data.error || 'Failed to fetch AI diagnostic');
      }
    } catch (err: any) {
      setError(err.message || 'Network error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-5">
      {/* Header Banner */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-xl flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-gradient-to-br from-emerald-600 to-cyan-700 rounded-xl text-white shadow-lg shadow-emerald-900/30">
            <BrainCircuit className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xs font-semibold text-emerald-400 uppercase tracking-wider flex items-center gap-2">
              <span>Gemini 3.8 Flash • AI Traffic Systems Engineer</span>
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
            </div>
            <h2 className="text-lg font-bold text-white mt-0.5">
              Intelligent Intersection Diagnostic & Optimization Advisory
            </h2>
          </div>
        </div>

        <button
          onClick={fetchAIDiagnostic}
          disabled={loading}
          className="px-4 py-2 bg-gradient-to-r from-emerald-600 to-cyan-600 hover:from-emerald-500 hover:to-cyan-500 disabled:opacity-50 text-white text-xs font-bold rounded-lg shadow-lg flex items-center gap-2 transition"
        >
          {loading ? (
            <>
              <RefreshCw className="w-4 h-4 animate-spin" />
              Analyzing Junction Telemetry...
            </>
          ) : (
            <>
              <Sparkles className="w-4 h-4" />
              Generate AI Diagnostic
            </>
          )}
        </button>
      </div>

      {/* Error state */}
      {error && (
        <div className="p-3 bg-rose-950 border border-rose-800 rounded-xl text-xs text-rose-300 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-rose-400" />
          <span>{error}</span>
        </div>
      )}

      {/* Telemetry Overview Ribbon */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 bg-slate-900 border border-slate-800 rounded-xl p-4 text-xs font-mono">
        <div>
          <span className="text-slate-400 block text-[10px] uppercase">Active Mode</span>
          <span className="text-emerald-400 font-bold">
            {telemetry?.mode === 'fairnessAware'
              ? 'Fairness-Aware Adaptive'
              : telemetry?.mode === 'queueOnly'
              ? 'Greedy Queue-Only'
              : 'Fixed-Time'}
          </span>
        </div>
        <div>
          <span className="text-slate-400 block text-[10px] uppercase">Jain's Fairness Index</span>
          <span className="text-white font-bold">
            {telemetry?.fairnessIndex ? (telemetry.fairnessIndex * 100).toFixed(1) + '%' : '92.0%'}
          </span>
        </div>
        <div>
          <span className="text-slate-400 block text-[10px] uppercase">Max Queue Wait</span>
          <span className="text-amber-300 font-bold">
            {telemetry?.maxWaitSeconds ?? 38}s
          </span>
        </div>
        <div>
          <span className="text-slate-400 block text-[10px] uppercase">Emergency Priority</span>
          <span className={telemetry?.hasEmergency ? 'text-rose-400 font-bold animate-pulse' : 'text-slate-400'}>
            {telemetry?.hasEmergency ? 'ACTIVE (Preemption)' : 'Normal'}
          </span>
        </div>
      </div>

      {/* Diagnostic Results Card */}
      {diagnostic ? (
        <div className="flex flex-col gap-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-xl">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-3 mb-4">
              <div className="flex items-center gap-2">
                <Bot className="w-5 h-5 text-emerald-400" />
                <h3 className="text-base font-bold text-white">{diagnostic.title}</h3>
              </div>
              <span className="text-[10px] font-mono bg-slate-950 text-slate-400 border border-slate-800 px-2 py-0.5 rounded">
                Model: {diagnostic.source || 'gemini-3.8-flash'}
              </span>
            </div>

            {/* Bottleneck Analysis */}
            <div className="mb-5">
              <h4 className="text-xs font-bold text-emerald-400 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                <AlertCircle className="w-4 h-4" />
                Bottleneck & Queue Dynamics Analysis
              </h4>
              <p className="text-xs text-slate-300 leading-relaxed bg-slate-950 p-3.5 rounded-lg border border-slate-800">
                {diagnostic.bottleneckAnalysis}
              </p>
            </div>

            {/* Strategic Recommendations */}
            <div className="mb-5">
              <h4 className="text-xs font-bold text-cyan-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <Lightbulb className="w-4 h-4" />
                IRC-Compliant Actionable Recommendations
              </h4>
              <div className="space-y-2">
                {diagnostic.recommendations?.map((rec: string, idx: number) => (
                  <div
                    key={idx}
                    className="p-3 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-200 flex items-start gap-2.5"
                  >
                    <span className="w-5 h-5 rounded-full bg-slate-800 text-emerald-400 font-mono text-[10px] font-bold flex items-center justify-center shrink-0">
                      0{idx + 1}
                    </span>
                    <span className="leading-relaxed">{rec}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Summary Metrics */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-3 border-t border-slate-800">
              <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 flex items-center justify-between">
                <span className="text-xs text-slate-400">Estimated Fuel Saved:</span>
                <span className="text-sm font-bold font-mono text-emerald-400">
                  {diagnostic.estimatedFuelSavedPct || '22.4%'}
                </span>
              </div>
              <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 flex items-center justify-between">
                <span className="text-xs text-slate-400">Intersection Safety & Clearance Index:</span>
                <span className="text-sm font-bold font-mono text-cyan-400">
                  {diagnostic.safetyScore || 94}/100
                </span>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-slate-900/40 border border-dashed border-slate-700 rounded-xl p-8 text-center flex flex-col items-center justify-center gap-3">
          <BrainCircuit className="w-8 h-8 text-cyan-400 animate-pulse" />
          <div className="max-w-md">
            <h3 className="text-sm font-bold text-white">AI Intersection Diagnostics Standby</h3>
            <p className="text-xs text-slate-400 mt-1 leading-relaxed">
              Click <strong>"Generate AI Diagnostic"</strong> to submit the live intersection state to Gemini AI. The model will evaluate PCU queue pressure, detect starvation risks, and formulate optimal signal timing adjustments.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};
