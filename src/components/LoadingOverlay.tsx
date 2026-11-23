import React from 'react';
import serpentisIconUrl from '../assets/serpentis-icon.png';

export interface LoadingOverlayProps {
  visible: boolean;
  fadingOut: boolean;
  progress: number;
  label: string;
  sublabel?: string;
}

export const LoadingOverlay: React.FC<LoadingOverlayProps> = React.memo(
  ({ visible, fadingOut, progress, label, sublabel }) => {
    if (!visible) return null;

    const clampedPct = Math.max(4, Math.min(100, Math.round(progress)));

    return (
      <div
        role="status"
        aria-live="polite"
        aria-label={label}
        className={`fixed inset-0 z-[70] flex flex-col items-center justify-center bg-[#060a0c] select-none transition-opacity duration-200 ease-out ${
          fadingOut ? 'opacity-0 pointer-events-none' : 'opacity-100 pointer-events-auto'
        }`}
        style={{
          backgroundImage:
            'radial-gradient(ellipse 75% 65% at 50% 42%, rgba(28, 12, 16, 0.55) 0%, rgba(6, 10, 12, 0.96) 72%, rgba(4, 7, 9, 1) 100%)',
        }}
      >
        <div className="flex flex-col items-center gap-4 px-6 w-full max-w-xs sm:max-w-sm">
          {/* Official SERPENTIS emblem lockup */}
          <div className="flex items-center gap-3">
            <div
              className="w-11 h-11 sm:w-12 sm:h-12 rounded-md overflow-hidden border border-[#52e0b6]/55 bg-[#071519] shadow-[0_0_18px_rgba(82,224,182,0.18)] shrink-0"
              style={{ transform: 'translateZ(0)' }}
            >
              <img
                src={serpentisIconUrl}
                alt="SERPENTIS"
                width={48}
                height={48}
                loading="eager"
                decoding="sync"
                draggable={false}
                className="block w-full h-full object-cover"
              />
            </div>
            <div className="flex flex-col leading-none">
              <span
                className="text-2xl sm:text-3xl font-extrabold text-[#e9f2f4] tracking-[0.16em]"
                style={{ fontFamily: 'Inter, system-ui, sans-serif' }}
              >
                SERPENTIS
              </span>
              <span className="mt-1 text-[9px] sm:text-[10px] font-mono text-[#7fa1a8] tracking-[0.26em] uppercase">
                FACILITY 09 · POOLROOMS
              </span>
            </div>
          </div>

          {/* Progress track */}
          <div className="w-full flex flex-col gap-1.5 mt-1">
            <div className="h-1.5 w-full rounded-full bg-[#101c20] border border-[#24383e]/80 overflow-hidden">
              <div
                className="h-full rounded-full bg-[#52e0b6] transition-[width] duration-150 ease-out"
                style={{ width: `${clampedPct}%` }}
              />
            </div>
            <div className="flex items-center justify-between gap-2 text-[10px] font-mono tracking-[0.16em] uppercase text-[#95b1b7]">
              <span className="truncate">{label}</span>
              <span className="tabular-nums text-[#52e0b6] shrink-0">{clampedPct}%</span>
            </div>
            {sublabel && (
              <div className="text-[10px] font-mono tracking-[0.14em] uppercase text-[#668288] text-center truncate">
                {sublabel}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }
);
