import {
  Play,
  Pause,
  Volume2,
  VolumeX,
  Upload,
  ChevronDown,
  ChevronUp,
  LogOut,
  AlertCircle,
} from 'lucide-react';
import type { AudioTrackMeta } from '../audio/audioEngine';

export interface PlaybackDockProps {
  visible: boolean;
  collapsed: boolean;
  onToggleCollapsed: () => void;
  track: AudioTrackMeta;
  onTogglePlay: () => void;
  onToggleMute: () => void;
  onVolumeChange: (v: number) => void;
  onSeek: (sec: number) => void;
  onPickAudio: () => void;
  onLeave: () => void;
}

function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export function PlaybackDock({
  visible,
  collapsed,
  onToggleCollapsed,
  track,
  onTogglePlay,
  onToggleMute,
  onVolumeChange,
  onSeek,
  onPickAudio,
  onLeave,
}: PlaybackDockProps) {
  if (!visible) return null;

  const hasTrack = Boolean(track.name);

  return (
    <div
      className="fixed bottom-4 sm:bottom-5 left-1/2 -translate-x-1/2 z-20 flex flex-col items-center max-w-[94vw]"
      data-testid="playback-dock"
    >
      {/* Inline validation / decode error message above dock */}
      {track.error && !collapsed && (
        <div
          role="alert"
          className="mb-2 px-3.5 py-1.5 rounded-lg bg-[#1b0f26]/95 border border-rose-400/30 text-xs text-rose-200 inline-flex items-center gap-1.5 max-w-[90vw]"
        >
          <AlertCircle className="w-3.5 h-3.5 shrink-0 text-rose-300" aria-hidden="true" />
          <span className="truncate">{track.error}</span>
        </div>
      )}

      {/* Collapse / Expand toggle tab */}
      <button
        type="button"
        onClick={onToggleCollapsed}
        aria-expanded={!collapsed}
        aria-label={collapsed ? 'Show playback controls' : 'Hide playback controls'}
        className="mb-1.5 inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-medium text-slate-300/85 bg-[#090d22]/80 border border-white/10 hover:text-white hover:border-white/20 transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-violet-300 whitespace-nowrap"
      >
        {collapsed ? (
          <>
            <ChevronUp className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Controls</span>
          </>
        ) : (
          <>
            <ChevronDown className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Hide</span>
          </>
        )}
      </button>

      {/* Collapsible unified horizontal control bar (zero backdrop-filter over WebGL) */}
      <div
        className={`transition-all duration-300 ease-out origin-bottom ${
          collapsed
            ? 'opacity-0 translate-y-4 pointer-events-none h-0 overflow-hidden'
            : 'opacity-100 translate-y-0 pointer-events-auto'
        }`}
      >
        <div className="flex items-center gap-2 sm:gap-3 px-3 sm:px-4 py-2 rounded-2xl bg-[#090d22]/88 border border-white/12 text-slate-100">
          {hasTrack ? (
            <>
              <button
                type="button"
                onClick={onTogglePlay}
                aria-label={track.isPlaying ? 'Pause music' : 'Play music'}
                className="inline-flex items-center justify-center w-10 h-10 sm:w-9 sm:h-9 rounded-full bg-slate-100 text-slate-950 hover:bg-white transition-colors shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-violet-300"
              >
                {track.isPlaying ? (
                  <Pause className="w-4 h-4" aria-hidden="true" />
                ) : (
                  <Play className="w-4 h-4 translate-x-[1px]" aria-hidden="true" />
                )}
              </button>

              {/* Track title & subtle seek slider */}
              <div className="flex flex-col min-w-[138px] sm:min-w-[188px] max-w-[175px] sm:max-w-[235px]">
                <div className="flex items-center justify-between gap-2 text-xs">
                  <span
                    className="text-slate-100 font-medium truncate"
                    title={track.name}
                    data-testid="dock-track-name"
                  >
                    {track.name}
                  </span>
                  <span className="font-mono-tabular text-[11px] text-slate-400 shrink-0">
                    {formatTime(track.currentTime)}
                    <span className="hidden sm:inline">
                      {track.duration > 0 ? ` / ${formatTime(track.duration)}` : ''}
                    </span>
                  </span>
                </div>
                <input
                  type="range"
                  aria-label="Seek track position"
                  min={0}
                  max={track.duration > 0 ? track.duration : 100}
                  step={0.1}
                  value={track.duration > 0 ? track.currentTime : 0}
                  disabled={track.duration <= 0}
                  onChange={(e) => onSeek(Number(e.target.value))}
                  className="nocturne-slider w-full mt-1.5"
                />
              </div>

              {/* Volume & Mute */}
              <div className="flex items-center gap-1.5 pl-1 border-l border-white/10">
                <button
                  type="button"
                  onClick={onToggleMute}
                  aria-label={track.isMuted ? 'Unmute audio' : 'Mute audio'}
                  className="inline-flex items-center justify-center w-10 h-10 sm:w-8 sm:h-8 rounded-lg text-slate-300 hover:text-white hover:bg-white/8 transition-colors shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-violet-300"
                >
                  {track.isMuted || track.volume === 0 ? (
                    <VolumeX className="w-4 h-4" aria-hidden="true" />
                  ) : (
                    <Volume2 className="w-4 h-4" aria-hidden="true" />
                  )}
                </button>
                <input
                  type="range"
                  aria-label="Volume"
                  min={0}
                  max={1}
                  step={0.01}
                  value={track.isMuted ? 0 : track.volume}
                  onChange={(e) => onVolumeChange(Number(e.target.value))}
                  className="nocturne-slider hidden sm:block w-16"
                />
              </div>

              {/* Replace Track */}
              <button
                type="button"
                onClick={onPickAudio}
                aria-label="Replace local audio track"
                title="Replace track"
                className="inline-flex items-center justify-center w-10 h-10 sm:w-8 sm:h-8 rounded-lg text-slate-300 hover:text-white hover:bg-white/8 transition-colors shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-violet-300"
              >
                <Upload className="w-4 h-4" aria-hidden="true" />
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={onPickAudio}
              className="inline-flex items-center gap-2 min-h-[40px] px-3.5 py-1.5 rounded-xl text-xs sm:text-sm font-medium text-slate-100 hover:bg-white/8 transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-violet-300"
            >
              <Upload className="w-4 h-4 text-violet-300" aria-hidden="true" />
              <span>Add Local Audio</span>
            </button>
          )}

          {/* Subtle Return to Intro */}
          <button
            type="button"
            onClick={onLeave}
            aria-label="Return to introduction"
            title="Return to introduction"
            className="inline-flex items-center justify-center w-10 h-10 sm:w-8 sm:h-8 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-white/8 transition-colors shrink-0 border-l border-white/10 pl-1 cursor-pointer focus-visible:outline-2 focus-visible:outline-violet-300"
          >
            <LogOut className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>
      </div>
    </div>
  );
}
