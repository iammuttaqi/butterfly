/**
 * Development-only performance verification overlay (toggled via `?perf=1` or pressing `P`).
 * Hidden by default in normal user sessions so the art installation remains pure.
 */

import { X } from 'lucide-react';
import type { PerformanceSnapshot, QualityTier } from '../engine/performanceMonitor';

export interface PerfMonitorOverlayProps {
  visible: boolean;
  snapshot: PerformanceSnapshot;
  isSoftwareGl: boolean;
  onSelectTier: (tier: QualityTier | 'auto') => void;
  onClose: () => void;
}

const TIERS: Array<{ id: QualityTier | 'auto'; label: string }> = [
  { id: 'auto', label: 'Auto' },
  { id: 'high', label: 'High' },
  { id: 'balanced', label: 'Balanced' },
  { id: 'performance', label: 'Perf' },
];

export function PerfMonitorOverlay({
  visible,
  snapshot,
  isSoftwareGl,
  onSelectTier,
  onClose,
}: PerfMonitorOverlayProps) {
  if (!visible) return null;

  const activeSelection: QualityTier | 'auto' = snapshot.adaptiveEnabled
    ? 'auto'
    : snapshot.qualityTier;

  return (
    <aside
      aria-label="Performance monitor"
      data-testid="perf-monitor"
      className="fixed top-4 left-4 z-30 w-64 p-3.5 rounded-xl bg-[#070a1b]/92 border border-white/12 text-xs text-slate-200"
    >
      <div className="flex items-center justify-between pb-2 mb-2 border-b border-white/10">
        <span className="font-medium text-slate-100">Performance Monitor</span>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close performance monitor"
          className="p-1 rounded text-slate-400 hover:text-white cursor-pointer"
        >
          <X className="w-3.5 h-3.5" aria-hidden="true" />
        </button>
      </div>

      <dl className="grid grid-cols-2 gap-y-1.5 gap-x-3 font-mono-tabular text-[11px]">
        <dt className="text-slate-400">Current FPS</dt>
        <dd className="text-right text-slate-100">{snapshot.fps} fps</dd>

        <dt className="text-slate-400">Frame Time</dt>
        <dd className="text-right text-slate-100">{snapshot.frameTimeMs.toFixed(1)} ms</dd>

        <dt className="text-slate-400">Avg Frame</dt>
        <dd className="text-right text-slate-100">{snapshot.avgFrameTimeMs.toFixed(1)} ms</dd>

        <dt className="text-slate-400">Stability</dt>
        <dd className="text-right text-slate-100">{snapshot.stabilityPercent}%</dd>

        <dt className="text-slate-400">Audio FFT</dt>
        <dd className="text-right text-slate-100">
          {snapshot.audioActive ? 'Active' : 'Idle'}
        </dd>

        <dt className="text-slate-400">Quality Tier</dt>
        <dd className="text-right text-violet-300 capitalize">{snapshot.qualityTier}</dd>

        {isSoftwareGl && (
          <>
            <dt className="text-slate-400">Renderer</dt>
            <dd className="text-right text-amber-300">Software GL</dd>
          </>
        )}
      </dl>

      <div className="mt-3 pt-2.5 border-t border-white/10 flex items-center gap-1">
        {TIERS.map((t) => {
          const isSelected = activeSelection === t.id;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => onSelectTier(t.id)}
              className={`flex-1 py-1 rounded text-[11px] font-medium transition-colors cursor-pointer ${
                isSelected
                  ? 'bg-violet-500/30 text-white border border-violet-400/40'
                  : 'text-slate-400 hover:text-slate-100 hover:bg-white/6 border border-transparent'
              }`}
            >
              {t.label}
            </button>
          );
        })}
      </div>
    </aside>
  );
}
