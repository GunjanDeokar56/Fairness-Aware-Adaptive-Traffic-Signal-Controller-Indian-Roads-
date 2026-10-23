/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  TrafficEventLog,
  TrafficEventCategory,
  SignalPhase,
} from '../utils/traffic-engine';
import {
  Activity,
  AlertTriangle,
  Flame,
  Siren,
  Clock,
  Filter,
  Trash2,
  Download,
  CheckCircle2,
  TrendingUp,
  ArrowRight,
  ShieldAlert,
  Radio,
  Sliders,
} from 'lucide-react';

interface TrafficEventLogPanelProps {
  events: TrafficEventLog[];
  onClearLog: () => void;
  currentPhase: SignalPhase;
}

export const TrafficEventLogPanel: React.FC<TrafficEventLogPanelProps> = ({
  events,
  onClearLog,
  currentPhase,
}) => {
  const [filter, setFilter] = useState<'ALL' | 'PHASE' | 'BREACH' | 'EMERGENCY'>('ALL');
  const [autoScroll, setAutoScroll] = useState<boolean>(true);
  const logContainerRef = useRef<HTMLDivElement | null>(null);

  // Auto-scroll to top or bottom when new events arrive
  useEffect(() => {
    if (autoScroll && logContainerRef.current) {
      logContainerRef.current.scrollTop = 0; // Newest on top
    }
  }, [events, autoScroll]);

  const filteredEvents = events.filter((evt) => {
    if (filter === 'ALL') return true;
    if (filter === 'PHASE') return evt.category === 'PHASE_CHANGE';
    if (filter === 'BREACH') return evt.category === 'STARVATION_BREACH' || evt.category === 'PCU_SURGE' || evt.category === 'FAIRNESS_DROP';
    if (filter === 'EMERGENCY') return evt.category === 'EMERGENCY_OVERRIDE' || evt.category === 'EMERGENCY_CLEARED';
    return true;
  });

  const breachCount = events.filter((e) => e.category === 'STARVATION_BREACH' || e.category === 'PCU_SURGE' || e.category === 'FAIRNESS_DROP').length;
  const phaseCount = events.filter((e) => e.category === 'PHASE_CHANGE').length;
  const emergencyCount = events.filter((e) => e.category === 'EMERGENCY_OVERRIDE' || e.category === 'EMERGENCY_CLEARED').length;

  const exportEventsCSV = () => {
    if (events.length === 0) return;
    const lines = [
      'EVENT_ID,WALL_CLOCK_TIME,SIMULATION_SECONDS,CATEGORY,SEVERITY,APPROACH,TITLE,DETAILS,METRIC_VALUE',
    ];
    events.forEach((e) => {
      lines.push(
        `${e.id},${e.wallClockTime},${e.simTimeSeconds.toFixed(1)},${e.category},${e.severity},${e.approach || 'ALL'},"${e.title}","${e.details.replace(/"/g, '""')}",${e.metricValue || '-'}`
      );
    });
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `traffic_events_log_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl flex flex-col">
      {/* Panel Header */}
      <div className="p-4 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3 bg-slate-950/70">
        <div className="flex items-center gap-2.5">
          <div className="p-2 bg-emerald-950 border border-emerald-500/40 rounded-lg text-emerald-400">
            <Radio className="w-4 h-4 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                Real-Time Event Log & Threshold Alert Stream
              </h3>
              <span className="text-[10px] bg-slate-800 text-emerald-400 px-2 py-0.5 rounded-full font-mono font-semibold border border-emerald-800/60">
                LIVE • {events.length} Events
              </span>
            </div>
            <div className="text-[11px] text-slate-400">
              Continuous monitoring of signal phase transitions and critical approach waiting-time/PCU breaches
            </div>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2">
          {/* Auto-scroll toggle */}
          <button
            onClick={() => setAutoScroll(!autoScroll)}
            className={`px-2.5 py-1 text-[11px] rounded-lg border font-medium transition flex items-center gap-1 ${
              autoScroll
                ? 'bg-emerald-600/20 border-emerald-500/50 text-emerald-300'
                : 'bg-slate-800 border-slate-700 text-slate-400'
            }`}
            title="Automatically scroll to latest event"
            aria-label="Toggle auto scroll"
          >
            <Clock className="w-3 h-3" />
            <span>Auto-Scroll: {autoScroll ? 'ON' : 'OFF'}</span>
          </button>

          {/* Export Events CSV */}
          <button
            onClick={exportEventsCSV}
            disabled={events.length === 0}
            className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-200 text-[11px] font-semibold rounded-lg border border-slate-700 flex items-center gap-1 transition"
            title="Export event log as CSV"
            aria-label="Export event log CSV"
          >
            <Download className="w-3 h-3" />
            <span>Export Log</span>
          </button>

          {/* Clear Log */}
          <button
            onClick={onClearLog}
            disabled={events.length === 0}
            className="px-2 py-1 bg-slate-800 hover:bg-rose-950 hover:text-rose-300 hover:border-rose-800 disabled:opacity-40 text-slate-400 text-[11px] rounded-lg border border-slate-700 flex items-center gap-1 transition"
            title="Clear event logs"
            aria-label="Clear event logs"
          >
            <Trash2 className="w-3 h-3" />
            <span>Clear</span>
          </button>
        </div>
      </div>

      {/* Filter Category Tabs */}
      <div className="px-4 py-2 border-b border-slate-800/80 bg-slate-950/40 flex flex-wrap items-center gap-1.5 text-xs">
        <button
          onClick={() => setFilter('ALL')}
          className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition ${
            filter === 'ALL'
              ? 'bg-emerald-600 text-white shadow-sm'
              : 'text-slate-400 hover:text-white bg-slate-800/60'
          }`}
        >
          All Events ({events.length})
        </button>
        <button
          onClick={() => setFilter('PHASE')}
          className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition ${
            filter === 'PHASE'
              ? 'bg-cyan-600 text-white shadow-sm'
              : 'text-slate-400 hover:text-white bg-slate-800/60'
          }`}
        >
          Phase Changes ({phaseCount})
        </button>
        <button
          onClick={() => setFilter('BREACH')}
          className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition ${
            filter === 'BREACH'
              ? 'bg-rose-600 text-white shadow-sm'
              : 'text-slate-400 hover:text-white bg-slate-800/60'
          }`}
        >
          Threshold Breaches ({breachCount})
        </button>
        <button
          onClick={() => setFilter('EMERGENCY')}
          className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition ${
            filter === 'EMERGENCY'
              ? 'bg-amber-600 text-white shadow-sm'
              : 'text-slate-400 hover:text-white bg-slate-800/60'
          }`}
        >
          Emergency Corridors ({emergencyCount})
        </button>
      </div>

      {/* Event Stream List Container */}
      <div
        ref={logContainerRef}
        className="max-h-[300px] min-h-[160px] overflow-y-auto p-3 space-y-2 font-mono scrollbar-thin scrollbar-thumb-slate-700 select-text"
      >
        {filteredEvents.length === 0 ? (
          <div className="py-8 text-center flex flex-col items-center justify-center text-slate-500">
            <Radio className="w-6 h-6 mb-2 text-slate-600 animate-pulse" />
            <div className="text-xs">No events recorded yet for selected filter</div>
            <div className="text-[10px] text-slate-600 mt-0.5">
              Phase transitions and queue threshold alerts will appear in real time
            </div>
          </div>
        ) : (
          filteredEvents.map((e) => {
            let badgeBg = 'bg-slate-800 text-slate-300 border-slate-700';
            let icon = <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" />;

            if (e.category === 'PHASE_CHANGE') {
              if (e.title.includes('GREEN')) {
                badgeBg = 'bg-emerald-950/80 text-emerald-300 border-emerald-500/50';
                icon = <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />;
              } else if (e.title.includes('CLEARANCE')) {
                badgeBg = 'bg-amber-950/80 text-amber-300 border-amber-500/50';
                icon = <Clock className="w-3.5 h-3.5 text-amber-400 shrink-0" />;
              } else {
                badgeBg = 'bg-blue-950/80 text-blue-300 border-blue-500/50';
                icon = <Activity className="w-3.5 h-3.5 text-blue-400 shrink-0" />;
              }
            } else if (e.category === 'STARVATION_BREACH') {
              badgeBg = 'bg-rose-950/90 text-rose-200 border-rose-500/70 shadow-[0_0_10px_rgba(244,63,94,0.2)] animate-pulse';
              icon = <AlertTriangle className="w-3.5 h-3.5 text-rose-400 shrink-0" />;
            } else if (e.category === 'PCU_SURGE') {
              badgeBg = 'bg-amber-950/80 text-amber-200 border-amber-500/60';
              icon = <TrendingUp className="w-3.5 h-3.5 text-amber-400 shrink-0" />;
            } else if (e.category === 'FAIRNESS_DROP') {
              badgeBg = 'bg-purple-950/80 text-purple-200 border-purple-500/60';
              icon = <Flame className="w-3.5 h-3.5 text-purple-400 shrink-0" />;
            } else if (e.category === 'EMERGENCY_OVERRIDE' || e.category === 'EMERGENCY_CLEARED') {
              badgeBg = 'bg-rose-950 text-white border-rose-400 shadow-md animate-bounce-short';
              icon = <Siren className="w-3.5 h-3.5 text-rose-300 shrink-0 animate-bounce" />;
            }

            return (
              <div
                key={e.id}
                className={`p-2.5 rounded-xl border text-xs flex flex-col md:flex-row md:items-center justify-between gap-2 transition-all ${badgeBg}`}
              >
                <div className="flex items-start md:items-center gap-2.5">
                  <div className="pt-0.5 md:pt-0">{icon}</div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-white font-sans">{e.title}</span>
                      {e.approach && (
                        <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-950/80 text-cyan-300 border border-slate-700 font-mono">
                          {e.approach} Approach
                        </span>
                      )}
                      {e.metricValue && (
                        <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-950/80 text-amber-300 border border-slate-700 font-mono font-bold">
                          {e.metricValue}
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-slate-300 font-sans mt-0.5 leading-relaxed">
                      {e.details}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0 text-[10px] text-slate-400 font-mono self-end md:self-center">
                  <span>+{e.simTimeSeconds.toFixed(0)}s sim</span>
                  <span>•</span>
                  <span>{e.wallClockTime}</span>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
