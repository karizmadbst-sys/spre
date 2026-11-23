import React, { useEffect, useState } from 'react';
import { Check } from 'lucide-react';
import {
  getCachedCharacterPreviews,
  loadCharacterPreviews,
  type CharacterPreviewMap,
} from '../game/characterPreview';
import type { CharacterId } from '../game/types';

interface CharacterSelectorProps {
  selectedId: CharacterId;
  onSelect: (next: CharacterId) => void;
  size?: 'hero' | 'compact';
  className?: string;
}

export const CharacterSelector: React.FC<CharacterSelectorProps> = ({
  selectedId,
  onSelect,
  size = 'hero',
  className = '',
}) => {
  const [previews, setPreviews] = useState<CharacterPreviewMap | null>(() =>
    getCachedCharacterPreviews()
  );

  useEffect(() => {
    if (previews?.male && previews?.female) return;
    let cancelled = false;
    void loadCharacterPreviews().then((next) => {
      if (!cancelled && next.male && next.female) {
        setPreviews(next);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [previews]);

  return (
    <div
      className={`grid grid-cols-2 w-full ${size === 'hero' ? 'gap-2 sm:gap-2.5' : 'gap-2'} ${className}`}
      role="radiogroup"
      aria-label="Character selection"
    >
      {(['male', 'female'] as const).map((charId) => {
        const isSelected = selectedId === charId;
        const src = previews?.[charId];
        const ariaLabel = charId === 'male' ? 'Select male character' : 'Select female character';

        return (
          <button
            key={charId}
            type="button"
            role="radio"
            aria-checked={isSelected}
            aria-label={ariaLabel}
            onClick={() => onSelect(charId)}
            className={`group relative w-full aspect-[2/3] rounded-lg overflow-hidden transition-all duration-200 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[#52e0b6] ${
              isSelected
                ? 'border-2 border-[#52e0b6] bg-[#061013] shadow-[0_0_20px_rgba(82,224,182,0.35)] ring-1 ring-[#52e0b6]/35 scale-[1.015]'
                : 'border border-[#24393f] bg-[#061013] opacity-80 hover:opacity-100 hover:border-[#4b727c]'
            }`}
          >
            {/* Real rendered full-body (head-to-feet) 3D character portrait */}
            {src ? (
              <img
                src={src}
                alt={ariaLabel}
                loading="eager"
                decoding="sync"
                draggable={false}
                referrerPolicy="no-referrer"
                className="relative z-10 w-full h-full object-cover object-center select-none transition-transform duration-200 group-hover:scale-[1.025]"
                style={{ transform: 'translateZ(0)' }}
              />
            ) : (
              <div className="relative z-10 w-full h-full bg-gradient-to-b from-[#0b1b20] via-[#071216] to-[#050b0d]" />
            )}

            {/* Subtle edge vignette + active selection highlight frame */}
            <div
              className="absolute inset-0 z-20 pointer-events-none transition-opacity duration-200"
              style={{
                boxShadow: isSelected
                  ? 'inset 0 0 22px rgba(82, 224, 182, 0.22)'
                  : 'inset 0 0 20px rgba(4, 10, 12, 0.55)',
              }}
            />

            {/* Clear active selection indicator */}
            {isSelected && (
              <span className="absolute top-1.5 right-1.5 z-30 w-5 h-5 rounded-full bg-[#52e0b6] text-[#071113] flex items-center justify-center shadow-md">
                <Check className="w-3 h-3 stroke-[3]" />
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
};
