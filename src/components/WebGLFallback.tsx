export interface WebGLFallbackProps {
  reason: 'unsupported' | 'context-lost';
  onRetry?: () => void;
}

export function WebGLFallback({ reason, onRetry }: WebGLFallbackProps) {
  return (
    <main className="fixed inset-0 flex flex-col items-center justify-center px-6 text-center bg-gradient-to-b from-[#050816] via-[#0e0a24] to-[#050816] text-slate-100">
      <svg
        viewBox="0 0 180 130"
        className="w-36 h-28 mb-6 opacity-90"
        aria-hidden="true"
      >
        <defs>
          <linearGradient id="wingGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#6366f1" />
            <stop offset="45%" stopColor="#22d3ee" />
            <stop offset="80%" stopColor="#c084fc" />
            <stop offset="100%" stopColor="#f472b6" />
          </linearGradient>
        </defs>
        <path
          d="M90 62 C70 20, 18 12, 12 46 C8 74, 48 80, 84 68 C58 78, 36 108, 60 118 C76 124, 86 98, 90 76 Z"
          fill="url(#wingGrad)"
          fillOpacity="0.82"
        />
        <path
          d="M90 62 C110 20, 162 12, 168 46 C172 74, 132 80, 96 68 C122 78, 144 108, 120 118 C104 124, 94 98, 90 76 Z"
          fill="url(#wingGrad)"
          fillOpacity="0.82"
        />
        <rect x="87.5" y="42" width="5" height="44" rx="2.5" fill="#e2e8f0" />
      </svg>

      <h1 className="font-display text-4xl font-medium tracking-wide text-slate-50">
        Nocturne
      </h1>
      <p className="mt-3 text-sm text-slate-300 max-w-md leading-relaxed">
        {reason === 'context-lost'
          ? 'The 3D graphics context was interrupted by your device. Reloading restores the live butterfly sculpture.'
          : 'This interactive 3D installation requires WebGL hardware graphics support, which is currently unavailable in this browser.'}
      </p>

      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="mt-6 px-6 py-2.5 rounded-full text-sm font-medium bg-slate-100 text-slate-950 hover:bg-white transition-colors cursor-pointer"
        >
          Restore Experience
        </button>
      )}
    </main>
  );
}
