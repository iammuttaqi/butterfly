import { Music, ArrowRight, AlertCircle } from 'lucide-react';

export interface EntryOverlayProps {
  visible: boolean;
  trackName: string;
  audioError: string | null;
  onEnter: () => void;
  onPickAudio: () => void;
}

export function EntryOverlay({
  visible,
  trackName,
  audioError,
  onEnter,
  onPickAudio,
}: EntryOverlayProps) {
  return (
    <div
      className={`fixed inset-0 z-20 flex flex-col items-center justify-end pb-14 sm:pb-20 px-6 transition-opacity duration-700 ease-out ${
        visible ? 'opacity-100 pointer-events-auto visible' : 'opacity-0 pointer-events-none invisible'
      }`}
      aria-hidden={!visible}
      data-testid="entry-overlay"
    >
      {/* Subtle lower vignette scrim ensuring >= 4.5:1 text legibility over the 3D canvas */}
      <div
        className="pointer-events-none fixed inset-x-0 bottom-0 h-[54vh]"
        style={{
          background:
            'linear-gradient(to top, rgba(5, 8, 22, 0.90) 0%, rgba(5, 8, 22, 0.56) 52%, rgba(5, 8, 22, 0) 100%)',
        }}
      />

      <div className="relative z-10 flex flex-col items-center text-center max-w-xl w-full">
        <h1
          className="font-display text-5xl sm:text-6xl font-medium tracking-[0.04em] text-slate-50 leading-none"
          style={{ textWrap: 'balance' }}
        >
          Nocturne
        </h1>

        <p className="mt-4 text-sm sm:text-base text-slate-300/90 max-w-md leading-relaxed tracking-[0.01em]">
          A living 3D butterfly floating in twilight, subtly shaped by the cadence and color of your music.
        </p>

        <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3.5 w-full sm:w-auto">
          <button
            type="button"
            onClick={onEnter}
            disabled={!visible}
            className="inline-flex items-center justify-center gap-2.5 min-h-[46px] px-7 py-2.5 rounded-full text-sm font-medium tracking-[0.02em] text-slate-950 bg-slate-100 hover:bg-white active:scale-[0.98] transition-all duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-300 whitespace-nowrap shrink-0 cursor-pointer"
          >
            <span>Enter Experience</span>
            <ArrowRight className="w-4 h-4" aria-hidden="true" />
          </button>

          <button
            type="button"
            onClick={onPickAudio}
            disabled={!visible}
            className="inline-flex items-center justify-center gap-2 min-h-[46px] px-5 py-2.5 rounded-full text-sm font-medium text-slate-200 border border-white/18 bg-[#0b0f26]/85 hover:bg-[#13193a]/95 hover:border-white/30 active:scale-[0.98] transition-all duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-300 whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Music className="w-4 h-4 text-violet-300" aria-hidden="true" />
            <span>{trackName ? 'Change Audio' : 'Add Local Audio'}</span>
          </button>
        </div>

        {/* Selected local file preview (quiet unboxed metadata) */}
        {trackName && (
          <p
            className="mt-4 text-xs text-slate-300/85 max-w-sm truncate"
            data-testid="entry-selected-track"
          >
            Selected: <span className="text-slate-100">{trackName}</span>
            <span aria-hidden="true" className="mx-1.5 text-slate-500">
              ·
            </span>
            <span className="text-slate-400">Plays locally on entry</span>
          </p>
        )}

        {audioError && (
          <p
            role="alert"
            className="mt-4 inline-flex items-center gap-1.5 text-xs text-rose-300 max-w-md"
          >
            <AlertCircle className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
            <span>{audioError}</span>
          </p>
        )}
      </div>
    </div>
  );
}
