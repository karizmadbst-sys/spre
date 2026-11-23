import React, { useEffect, useRef, useState } from 'react';
import { ArrowUp, ChevronsRight, RotateCcw } from 'lucide-react';
import {
  DEFAULT_TOUCH_LAYOUT,
  TouchControlId,
  TouchControlPlacement,
  TouchLayoutConfig,
} from '../game/types';

interface TouchControlsProps {
  inWater: boolean;
  waterJumpCooldown: number;
  layout?: TouchLayoutConfig;
  onMove: (x: number, y: number, running: boolean) => void;
  onAutoRunChange: (enabled: boolean) => void;
  onJump: () => void;
  onCameraDelta: (dx: number, dy: number) => void;
}

function clampPlacement(p: TouchControlPlacement): TouchControlPlacement {
  return {
    xPct: Math.max(5, Math.min(95, p.xPct)),
    yPct: Math.max(14, Math.min(93, p.yPct)),
    scale: Math.max(0.65, Math.min(1.45, p.scale)),
    opacity: Math.max(0.3, Math.min(1, p.opacity)),
  };
}

export const TouchControls: React.FC<TouchControlsProps> = React.memo(
  ({
    inWater,
    waterJumpCooldown,
    layout = DEFAULT_TOUCH_LAYOUT,
    onMove,
    onAutoRunChange,
    onJump,
    onCameraDelta,
  }) => {
    const [joyActive, setJoyActive] = useState(false);
    const [autoRun, setAutoRun] = useState(false);

    const joyRef = useRef<HTMLDivElement | null>(null);
    const knobRef = useRef<HTMLDivElement | null>(null);
    const joyPointerId = useRef<number | null>(null);
    const joyCenter = useRef<{ x: number; y: number; maxRadius: number; scale: number }>({
      x: 0,
      y: 0,
      maxRadius: 32,
      scale: 1,
    });

    const camPointerId = useRef<number | null>(null);
    const camLast = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
    const autoRunRef = useRef(false);

    const onMoveRef = useRef(onMove);
    const onAutoRunChangeRef = useRef(onAutoRunChange);
    const onJumpRef = useRef(onJump);
    const onCameraDeltaRef = useRef(onCameraDelta);
    onMoveRef.current = onMove;
    onAutoRunChangeRef.current = onAutoRunChange;
    onJumpRef.current = onJump;
    onCameraDeltaRef.current = onCameraDelta;

    // Reset virtual inputs when TouchControls unmounts or when browser focus/visibility/pointer capture is lost
    useEffect(() => {
      const clearAllTouchPointers = () => {
        joyPointerId.current = null;
        camPointerId.current = null;
        setJoyActive(false);
        if (knobRef.current) {
          knobRef.current.style.transform = 'translate3d(0px, 0px, 0)';
        }
        onMoveRef.current(0, 0, false);
      };

      const onVisibilityChange = () => {
        if (document.hidden) {
          clearAllTouchPointers();
        }
      };

      const onWindowPointerCancel = (ev: PointerEvent) => {
        if (ev.pointerId === joyPointerId.current) {
          joyPointerId.current = null;
          setJoyActive(false);
          if (knobRef.current) {
            knobRef.current.style.transform = 'translate3d(0px, 0px, 0)';
          }
          onMoveRef.current(0, 0, false);
        }
        if (ev.pointerId === camPointerId.current) {
          camPointerId.current = null;
        }
      };

      window.addEventListener('blur', clearAllTouchPointers);
      window.addEventListener('pointercancel', onWindowPointerCancel);
      document.addEventListener('visibilitychange', onVisibilityChange);

      return () => {
        window.removeEventListener('blur', clearAllTouchPointers);
        window.removeEventListener('pointercancel', onWindowPointerCancel);
        document.removeEventListener('visibilitychange', onVisibilityChange);
        clearAllTouchPointers();
        onAutoRunChangeRef.current(false);
      };
    }, []);

    const joyPlace = clampPlacement(layout.joystick);
    const autoPlace = clampPlacement(layout.autoRun);
    const jumpPlace = clampPlacement(layout.jump);

    const updateJoystick = (clientX: number, clientY: number) => {
      const { x: cx, y: cy, maxRadius, scale } = joyCenter.current;
      const dx = clientX - cx;
      const dy = clientY - cy;
      const dist = Math.hypot(dx, dy);
      const clamped = Math.min(dist, maxRadius);
      const angle = Math.atan2(dy, dx);
      const invScale = scale > 0.05 ? 1 / scale : 1;
      const kx = dist > 0.001 ? Math.cos(angle) * clamped * invScale : 0;
      const ky = dist > 0.001 ? Math.sin(angle) * clamped * invScale : 0;

      if (knobRef.current) {
        knobRef.current.style.transform = `translate3d(${kx}px, ${ky}px, 0)`;
      }

      const rawMag = clamped / maxRadius;
      const deadzone = 0.08;
      if (rawMag <= deadzone) {
        onMoveRef.current(0, 0, false);
        return;
      }

      const scaledMag = (rawMag - deadzone) / (1 - deadzone);
      const dirX = Math.cos(angle);
      const dirY = -Math.sin(angle); // +y is forward (up on screen)
      onMoveRef.current(dirX * scaledMag, dirY * scaledMag, false);
    };

    const resetJoystick = () => {
      joyPointerId.current = null;
      setJoyActive(false);
      if (knobRef.current) {
        knobRef.current.style.transform = 'translate3d(0px, 0px, 0)';
      }
      onMoveRef.current(0, 0, false);
    };

    const handleJoyPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
      e.stopPropagation();
      e.preventDefault();
      if (joyPointerId.current !== null) return;

      joyPointerId.current = e.pointerId;
      setJoyActive(true);
      try {
        e.currentTarget.setPointerCapture(e.pointerId);
      } catch {
        // ignore if capture unsupported
      }

      const rect = e.currentTarget.getBoundingClientRect();
      joyCenter.current = {
        x: rect.left + rect.width * 0.5,
        y: rect.top + rect.height * 0.5,
        maxRadius: Math.max(24, rect.width * 0.36),
        scale: joyPlace.scale,
      };
      updateJoystick(e.clientX, e.clientY);
    };

    const handleJoyPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
      if (e.pointerId !== joyPointerId.current) return;
      e.stopPropagation();
      updateJoystick(e.clientX, e.clientY);
    };

    const handleJoyPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
      if (e.pointerId !== joyPointerId.current) return;
      e.stopPropagation();
      try {
        if (e.currentTarget.hasPointerCapture(e.pointerId)) {
          e.currentTarget.releasePointerCapture(e.pointerId);
        }
      } catch {
        // ignore
      }
      resetJoystick();
    };

    const handleCamPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
      e.stopPropagation();
      if (camPointerId.current !== null) return;
      camPointerId.current = e.pointerId;
      camLast.current = { x: e.clientX, y: e.clientY };
      try {
        e.currentTarget.setPointerCapture(e.pointerId);
      } catch {
        // ignore
      }
    };

    const handleCamPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
      if (e.pointerId !== camPointerId.current) return;
      e.stopPropagation();
      const dx = e.clientX - camLast.current.x;
      const dy = e.clientY - camLast.current.y;
      camLast.current = { x: e.clientX, y: e.clientY };
      onCameraDeltaRef.current(dx * 1.45, dy * 1.25);
    };

    const handleCamPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
      if (e.pointerId !== camPointerId.current) return;
      e.stopPropagation();
      camPointerId.current = null;
      try {
        if (e.currentTarget.hasPointerCapture(e.pointerId)) {
          e.currentTarget.releasePointerCapture(e.pointerId);
        }
      } catch {
        // ignore
      }
    };

    const handleToggleAutoRun = (e: React.PointerEvent<HTMLButtonElement>) => {
      e.stopPropagation();
      e.preventDefault();
      const next = !autoRunRef.current;
      autoRunRef.current = next;
      setAutoRun(next);
      onAutoRunChangeRef.current(next);
    };

    const handleJumpDown = (e: React.PointerEvent<HTMLButtonElement>) => {
      e.stopPropagation();
      e.preventDefault();
      onJumpRef.current();
    };

    const cooling = inWater && waterJumpCooldown > 0.05;
    const waterPct = cooling
      ? Math.max(0, Math.min(100, (1 - waterJumpCooldown / 2) * 100))
      : 100;

    return (
      <div className="fixed inset-0 pointer-events-none z-20 select-none">
        {/* Full-play-area invisible touch camera look zone (below top HUD bar) */}
        <div
          className="absolute top-14 inset-x-0 bottom-0 pointer-events-auto touch-none"
          onPointerDown={handleCamPointerDown}
          onPointerMove={handleCamPointerMove}
          onPointerUp={handleCamPointerUp}
          onPointerCancel={handleCamPointerUp}
          onLostPointerCapture={handleCamPointerUp}
        />

        {/* 1. Virtual Analog Joystick */}
        <div
          ref={joyRef}
          role="slider"
          aria-label="Movement joystick"
          aria-valuetext={joyActive ? 'Moving' : 'Idle'}
          onPointerDown={handleJoyPointerDown}
          onPointerMove={handleJoyPointerMove}
          onPointerUp={handleJoyPointerUp}
          onPointerCancel={handleJoyPointerUp}
          onLostPointerCapture={handleJoyPointerUp}
          style={{
            left: `${joyPlace.xPct}%`,
            top: `${joyPlace.yPct}%`,
            width: 'clamp(74px, 19vmin, 96px)',
            height: 'clamp(74px, 19vmin, 96px)',
            opacity: joyPlace.opacity,
            transform: `translate(-50%, -50%) scale(${joyPlace.scale})`,
          }}
          className={`absolute rounded-full border-2 pointer-events-auto touch-none flex items-center justify-center transition-colors ${
            joyActive
              ? 'border-[#7dd3c8]/80 bg-[#0c161a]/70 shadow-[0_0_18px_rgba(125,211,200,0.22)]'
              : 'border-[#9ec5c8]/40 bg-[#0b1316]/55'
          }`}
        >
          <span className="absolute top-2 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-[#9ec5c8]/45 pointer-events-none" />
          <span className="absolute bottom-2 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-[#9ec5c8]/45 pointer-events-none" />
          <span className="absolute left-2 top-1/2 -translate-y-1/2 w-1 h-1 rounded-full bg-[#9ec5c8]/45 pointer-events-none" />
          <span className="absolute right-2 top-1/2 -translate-y-1/2 w-1 h-1 rounded-full bg-[#9ec5c8]/45 pointer-events-none" />
          <div className="w-[54%] h-[54%] rounded-full border border-[#9ec5c8]/20 pointer-events-none" />

          {/* Thumb knob */}
          <div
            ref={knobRef}
            style={{
              width: '42%',
              height: '42%',
              transform: 'translate3d(0px, 0px, 0)',
              willChange: 'transform',
            }}
            className={`absolute rounded-full border shadow-md pointer-events-none ${
              joyActive
                ? 'bg-[#a8e6df]/90 border-[#f0fcfb] transition-none'
                : 'bg-[#9ec5c8]/75 border-[#e4f3f5]/80 transition-transform duration-100'
            }`}
          />
        </div>

        {/* 2. Auto-Run Toggle Button */}
        <button
          type="button"
          aria-label="Toggle Auto-Run"
          aria-pressed={autoRun}
          onPointerDown={handleToggleAutoRun}
          style={{
            left: `${autoPlace.xPct}%`,
            top: `${autoPlace.yPct}%`,
            width: 'clamp(44px, 11vmin, 56px)',
            height: 'clamp(44px, 11vmin, 56px)',
            opacity: autoPlace.opacity,
            transform: `translate(-50%, -50%) scale(${autoPlace.scale})`,
          }}
          className={`absolute rounded-full border-2 flex flex-col items-center justify-center gap-0.5 font-bold tracking-wider shadow-lg pointer-events-auto touch-none select-none transition-colors active:brightness-110 ${
            autoRun
              ? 'bg-[#e29b29]/90 border-[#ffe099] text-[#091012] shadow-[0_0_16px_rgba(226,155,41,0.45)]'
              : 'bg-[#0b1316]/70 border-[#9ec5c8]/45 text-[#dcecef]'
          }`}
        >
          <ChevronsRight className="w-4 h-4 stroke-[2.5]" />
          <span className="text-[8px] leading-none font-mono font-bold">
            {autoRun ? 'ON' : 'AUTO'}
          </span>
        </button>

        {/* 3. Jump Button (Ground + Water Jump) */}
        <button
          type="button"
          aria-label="Jump"
          onPointerDown={handleJumpDown}
          style={{
            left: `${jumpPlace.xPct}%`,
            top: `${jumpPlace.yPct}%`,
            width: 'clamp(56px, 14vmin, 68px)',
            height: 'clamp(56px, 14vmin, 68px)',
            opacity: jumpPlace.opacity,
            transform: `translate(-50%, -50%) scale(${jumpPlace.scale})`,
          }}
          className={`absolute overflow-hidden rounded-full border-2 flex flex-col items-center justify-center gap-0.5 font-bold tracking-wider shadow-xl pointer-events-auto touch-none select-none transition-colors active:brightness-125 ${
            cooling
              ? 'border-[#e8b354]/70 bg-[#181d1c]/85 text-[#f4d491]'
              : 'border-[#72f2c8]/80 bg-[#112426]/80 active:bg-[#4ef2b8]/65 text-[#ebfbf7]'
          }`}
        >
          {cooling && (
            <span
              className="absolute inset-x-0 bottom-0 bg-[#e8b354]/25 pointer-events-none"
              style={{ height: `${waterPct}%` }}
            />
          )}
          <ArrowUp className="relative z-10 w-5 h-5 stroke-[2.6]" />
          <span className="relative z-10 text-[9px] leading-none font-mono font-bold tabular-nums">
            {cooling ? `${waterJumpCooldown.toFixed(1)}S` : 'JUMP'}
          </span>
        </button>
      </div>
    );
  }
);

/* ============================================================================
 * MOBILE BUTTON CUSTOMIZATION OVERLAY
 * ==========================================================================*/
interface TouchControlsCustomizerProps {
  savedLayout: TouchLayoutConfig;
  onSave: (layout: TouchLayoutConfig) => void;
  onCancel: () => void;
}

const CONTROL_LABELS: Record<TouchControlId, string> = {
  joystick: 'Joystick',
  autoRun: 'Auto-Run',
  jump: 'Jump',
};

export const TouchControlsCustomizer: React.FC<TouchControlsCustomizerProps> = ({
  savedLayout,
  onSave,
  onCancel,
}) => {
  const [draft, setDraft] = useState<TouchLayoutConfig>(() => ({
    joystick: { ...savedLayout.joystick },
    autoRun: { ...savedLayout.autoRun },
    jump: { ...savedLayout.jump },
  }));
  const [selected, setSelected] = useState<TouchControlId>('joystick');

  const dragRef = useRef<{
    id: TouchControlId;
    pointerId: number;
    startClientX: number;
    startClientY: number;
    origXPct: number;
    origYPct: number;
  } | null>(null);

  const handleControlPointerDown = (
    id: TouchControlId,
    e: React.PointerEvent<HTMLElement>
  ) => {
    e.stopPropagation();
    e.preventDefault();
    setSelected(id);
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // ignore
    }
    dragRef.current = {
      id,
      pointerId: e.pointerId,
      startClientX: e.clientX,
      startClientY: e.clientY,
      origXPct: draft[id].xPct,
      origYPct: draft[id].yPct,
    };
  };

  const handleControlPointerMove = (
    id: TouchControlId,
    e: React.PointerEvent<HTMLElement>
  ) => {
    const drag = dragRef.current;
    if (!drag || drag.id !== id || drag.pointerId !== e.pointerId) return;
    e.stopPropagation();
    const vw = window.innerWidth || 1;
    const vh = window.innerHeight || 1;
    const nextX = Math.max(5, Math.min(95, drag.origXPct + ((e.clientX - drag.startClientX) / vw) * 100));
    const nextY = Math.max(14, Math.min(93, drag.origYPct + ((e.clientY - drag.startClientY) / vh) * 100));
    setDraft((prev) => ({
      ...prev,
      [id]: {
        ...prev[id],
        xPct: Math.round(nextX * 10) / 10,
        yPct: Math.round(nextY * 10) / 10,
      },
    }));
  };

  const handleControlPointerUp = (
    id: TouchControlId,
    e: React.PointerEvent<HTMLElement>
  ) => {
    const drag = dragRef.current;
    if (!drag || drag.id !== id || drag.pointerId !== e.pointerId) return;
    e.stopPropagation();
    dragRef.current = null;
    try {
      if (e.currentTarget.hasPointerCapture(e.pointerId)) {
        e.currentTarget.releasePointerCapture(e.pointerId);
      }
    } catch {
      // ignore
    }
  };

  const active = draft[selected];

  const updateSelected = (patch: Partial<TouchControlPlacement>) => {
    setDraft((prev) => ({
      ...prev,
      [selected]: clampPlacement({ ...prev[selected], ...patch }),
    }));
  };

  const handleReset = () => {
    setDraft({
      joystick: { ...DEFAULT_TOUCH_LAYOUT.joystick },
      autoRun: { ...DEFAULT_TOUCH_LAYOUT.autoRun },
      jump: { ...DEFAULT_TOUCH_LAYOUT.jump },
    });
  };

  return (
    <div className="fixed inset-0 z-50 select-none overflow-hidden bg-[#060b0d]/65">
      {/* Subtle placement alignment grid */}
      <div
        className="absolute inset-0 pointer-events-none opacity-20"
        style={{
          backgroundImage:
            'linear-gradient(to right, rgba(125,211,200,0.22) 1px, transparent 1px), linear-gradient(to bottom, rgba(125,211,200,0.22) 1px, transparent 1px)',
          backgroundSize: '48px 48px',
        }}
      />

      {/* Compact Top Control Inspector Card */}
      <div className="absolute top-2.5 left-1/2 -translate-x-1/2 w-[min(94vw,380px)] rounded-xl bg-[#0c1417]/95 border border-[#32464c] p-3 shadow-2xl flex flex-col gap-2.5 z-20">
        <div className="flex items-center justify-between gap-2">
          <div>
            <h3 className="text-xs font-bold tracking-wider uppercase text-[#e6f1f3]">
              Customize Touch Controls
            </h3>
            <p className="text-[10px] font-mono text-[#7fa0a8]">
              Drag buttons below to move · Tap to select
            </p>
          </div>
          <button
            type="button"
            onClick={handleReset}
            title="Reset to default layout"
            className="px-2 py-1 rounded border border-[#394f55] bg-[#131e22] hover:bg-[#1a292e] text-[10px] font-mono text-[#c5dce0] flex items-center gap-1 cursor-pointer shrink-0"
          >
            <RotateCcw className="w-3 h-3" />
            Reset
          </button>
        </div>

        {/* Control Selector Pills */}
        <div className="grid grid-cols-3 gap-1.5">
          {(['joystick', 'autoRun', 'jump'] as TouchControlId[]).map((id) => (
            <button
              key={id}
              type="button"
              onClick={() => setSelected(id)}
              className={`py-1.5 rounded-lg border text-[10px] sm:text-[11px] font-mono font-bold uppercase cursor-pointer transition-colors ${
                selected === id
                  ? 'bg-[#52e0b6]/20 border-[#52e0b6] text-[#9cf8db]'
                  : 'bg-[#121c20] border-[#2d3e43] text-[#8fa7ad]'
              }`}
            >
              {CONTROL_LABELS[id]}
            </button>
          ))}
        </div>

        {/* Size & Opacity Sliders */}
        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1 text-[10px] font-mono text-[#b5c8cd]">
            <div className="flex justify-between">
              <span>SIZE</span>
              <span className="tabular-nums text-[#7dd3c8]">
                {Math.round(active.scale * 100)}%
              </span>
            </div>
            <input
              type="range"
              min={0.65}
              max={1.45}
              step={0.05}
              value={active.scale}
              onChange={(e) => updateSelected({ scale: parseFloat(e.target.value) })}
              className="horror-slider w-full"
            />
          </label>

          <label className="flex flex-col gap-1 text-[10px] font-mono text-[#b5c8cd]">
            <div className="flex justify-between">
              <span>OPACITY</span>
              <span className="tabular-nums text-[#7dd3c8]">
                {Math.round(active.opacity * 100)}%
              </span>
            </div>
            <input
              type="range"
              min={0.3}
              max={1}
              step={0.05}
              value={active.opacity}
              onChange={(e) => updateSelected({ opacity: parseFloat(e.target.value) })}
              className="horror-slider w-full"
            />
          </label>
        </div>

        {/* Cancel / Save */}
        <div className="grid grid-cols-2 gap-2 pt-0.5">
          <button
            type="button"
            onClick={onCancel}
            className="py-2 rounded-lg bg-[#162024] hover:bg-[#1e2c31] border border-[#34464c] text-[#c7d8dc] font-bold text-xs tracking-wider uppercase cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => onSave(draft)}
            className="py-2 rounded-lg bg-[#52e0b6] hover:bg-[#6ef0c8] text-[#071113] font-bold text-xs tracking-wider uppercase cursor-pointer"
          >
            Save
          </button>
        </div>
      </div>

      {/* Live Draggable Previews */}
      {/* 1. Joystick */}
      <div
        role="button"
        aria-label="Drag Joystick"
        onPointerDown={(e) => handleControlPointerDown('joystick', e)}
        onPointerMove={(e) => handleControlPointerMove('joystick', e)}
        onPointerUp={(e) => handleControlPointerUp('joystick', e)}
        onPointerCancel={(e) => handleControlPointerUp('joystick', e)}
        style={{
          left: `${draft.joystick.xPct}%`,
          top: `${draft.joystick.yPct}%`,
          width: 'clamp(74px, 19vmin, 96px)',
          height: 'clamp(74px, 19vmin, 96px)',
          opacity: draft.joystick.opacity,
          transform: `translate(-50%, -50%) scale(${draft.joystick.scale})`,
        }}
        className={`absolute rounded-full border-2 touch-none flex items-center justify-center cursor-grab active:cursor-grabbing ${
          selected === 'joystick'
            ? 'border-[#52e0b6] bg-[#0e1f23]/80 ring-4 ring-[#52e0b6]/30'
            : 'border-[#9ec5c8]/55 bg-[#0b1316]/65'
        }`}
      >
        <div className="w-[54%] h-[54%] rounded-full border border-[#9ec5c8]/25 pointer-events-none" />
        <div className="w-[42%] h-[42%] rounded-full border bg-[#9ec5c8]/80 border-[#e4f3f5]/80 pointer-events-none" />
      </div>

      {/* 2. Auto-Run */}
      <div
        role="button"
        aria-label="Drag Auto-Run Button"
        onPointerDown={(e) => handleControlPointerDown('autoRun', e)}
        onPointerMove={(e) => handleControlPointerMove('autoRun', e)}
        onPointerUp={(e) => handleControlPointerUp('autoRun', e)}
        onPointerCancel={(e) => handleControlPointerUp('autoRun', e)}
        style={{
          left: `${draft.autoRun.xPct}%`,
          top: `${draft.autoRun.yPct}%`,
          width: 'clamp(44px, 11vmin, 56px)',
          height: 'clamp(44px, 11vmin, 56px)',
          opacity: draft.autoRun.opacity,
          transform: `translate(-50%, -50%) scale(${draft.autoRun.scale})`,
        }}
        className={`absolute rounded-full border-2 touch-none flex flex-col items-center justify-center gap-0.5 font-bold tracking-wider cursor-grab active:cursor-grabbing ${
          selected === 'autoRun'
            ? 'border-[#52e0b6] bg-[#12262b]/85 text-[#e8faf5] ring-4 ring-[#52e0b6]/30'
            : 'border-[#9ec5c8]/55 bg-[#0b1316]/75 text-[#dcecef]'
        }`}
      >
        <ChevronsRight className="w-4 h-4 stroke-[2.5] pointer-events-none" />
        <span className="text-[8px] leading-none font-mono font-bold pointer-events-none">
          AUTO
        </span>
      </div>

      {/* 3. Jump */}
      <div
        role="button"
        aria-label="Drag Jump Button"
        onPointerDown={(e) => handleControlPointerDown('jump', e)}
        onPointerMove={(e) => handleControlPointerMove('jump', e)}
        onPointerUp={(e) => handleControlPointerUp('jump', e)}
        onPointerCancel={(e) => handleControlPointerUp('jump', e)}
        style={{
          left: `${draft.jump.xPct}%`,
          top: `${draft.jump.yPct}%`,
          width: 'clamp(56px, 14vmin, 68px)',
          height: 'clamp(56px, 14vmin, 68px)',
          opacity: draft.jump.opacity,
          transform: `translate(-50%, -50%) scale(${draft.jump.scale})`,
        }}
        className={`absolute rounded-full border-2 touch-none flex flex-col items-center justify-center gap-0.5 font-bold tracking-wider cursor-grab active:cursor-grabbing ${
          selected === 'jump'
            ? 'border-[#52e0b6] bg-[#143032]/85 text-[#ebfbf7] ring-4 ring-[#52e0b6]/30'
            : 'border-[#72f2c8]/80 bg-[#112426]/80 text-[#ebfbf7]'
        }`}
      >
        <ArrowUp className="w-5 h-5 stroke-[2.6] pointer-events-none" />
        <span className="text-[9px] leading-none font-mono font-bold pointer-events-none">
          JUMP
        </span>
      </div>
    </div>
  );
};
