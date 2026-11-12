import React from 'react';
import { MISSING_IMAGE_TEXT } from '../../shared/api/client';

interface SpaceFallbackImageProps {
  spaceName?: string;
  spaceCode?: string;
  compact?: boolean;
}

/**
 * Renderiza el componente institucional por defecto cuando el espacio deportivo no tiene fotografía
 * cargada en la base de datos. Cumple estrictamente el Criterio de Aceptación CA #3 de REQ-01:
 * mostrar el texto exacto "Imagen no disponible" sin romper el diseño visual de la pantalla.
 *
 * @param {SpaceFallbackImageProps} fallbackProps Nombre y código opcionales del espacio y modo compacto.
 * @returns {React.JSX.Element} Contenedor visual 16:9 con estilo institucional UNAL.
 */
export function renderSpaceFallbackImage({
  spaceName,
  spaceCode,
  compact = false,
}: SpaceFallbackImageProps): React.JSX.Element {
  return (
    <div
      data-testid="space-fallback-image"
      role="img"
      aria-label={`${MISSING_IMAGE_TEXT}${spaceName ? ` para ${spaceName}` : ''}`}
      className="relative flex aspect-video w-full flex-col items-center justify-center overflow-hidden bg-gradient-to-br from-slate-800 via-slate-900 to-emerald-950 p-4 text-center text-white"
    >
      {spaceCode && (
        <span className="absolute right-3.5 top-3.5 rounded-xl bg-slate-950/90 px-3.5 py-1.5 font-mono text-sm font-black tracking-wider text-white ring-2 ring-emerald-400/60">
          {spaceCode}
        </span>
      )}

      <div className="flex items-center justify-center rounded-2xl bg-white px-4 py-2.5 shadow-md ring-1 ring-white/30">
        <img
          src="/logos/logo-vertical-classic-cropped.jpg"
          alt="UNALSpace"
          className={`${compact ? 'h-12' : 'h-16 sm:h-20'} w-auto object-contain`}
        />
      </div>

      <p
        data-testid="fallback-image-label"
        className={`mt-3 font-bold tracking-wide text-white ${
          compact ? 'text-sm' : 'text-base sm:text-lg'
        }`}
      >
        {MISSING_IMAGE_TEXT}
      </p>

      <p className="mt-0.5 max-w-xs text-xs text-slate-300">
        Universidad Nacional de Colombia · Sede Bogotá
      </p>
    </div>
  );
}

export const SpaceFallbackImage = renderSpaceFallbackImage;
