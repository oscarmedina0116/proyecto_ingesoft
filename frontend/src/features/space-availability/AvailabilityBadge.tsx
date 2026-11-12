import React from 'react';
import { CheckCircle2, Clock, HelpCircle } from 'lucide-react';
import {
  AVAILABLE_STATUS_TEXT,
  OCCUPIED_STATUS_TEXT,
  UNREGISTERED_AVAILABILITY_TEXT,
} from '../../shared/api/client';
import { AvailabilityStateCode } from './space-availability.types';

interface AvailabilityBadgeProps {
  statusCode?: AvailabilityStateCode | null;
  size?: 'sm' | 'md' | 'lg';
}

export const BADGE_SIZE_CLASSES: Record<'sm' | 'md' | 'lg', string> = {
  sm: 'px-2.5 py-0.5 text-xs gap-1.5',
  md: 'px-3 py-1 text-xs sm:text-sm gap-1.5',
  lg: 'px-4 py-1.5 text-sm font-bold gap-2',
};

/**
 * Renderiza el indicador visual (badge) del estado de disponibilidad de un espacio deportivo.
 * Cumple estrictamente los Criterios de Aceptación de REQ-02:
 * - CA #1: "Disponible" (badge verde + icono de verificación)
 * - CA #2: "Ocupado" (badge rojo + icono de reloj)
 * - CA #4: "Disponibilidad no registrada" (badge neutro/ámbar cuando no hay estado registrado, nunca en blanco)
 *
 * @param {AvailabilityBadgeProps} badgeProps Propiedades de código de estado y tamaño visual.
 * @returns {React.JSX.Element} Badge accesible con color e iconografía semántica.
 */
export function renderAvailabilityBadge({
  statusCode,
  size = 'md',
}: AvailabilityBadgeProps): React.JSX.Element {
  let selectedSizeClasses = BADGE_SIZE_CLASSES[size];

  if (statusCode === 'DISPONIBLE') {
    return (
      <span
        data-testid="availability-badge-disponible"
        className={`inline-flex items-center rounded-full border border-emerald-300 bg-emerald-100 font-semibold text-emerald-900 shadow-sm ${selectedSizeClasses}`}
      >
        <span
          className="h-2 w-2 rounded-full bg-emerald-600 animate-pulse"
          aria-hidden="true"
        />
        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-700" aria-hidden="true" />
        <span>{AVAILABLE_STATUS_TEXT}</span>
      </span>
    );
  }

  if (statusCode === 'OCUPADO') {
    return (
      <span
        data-testid="availability-badge-ocupado"
        className={`inline-flex items-center rounded-full border border-red-300 bg-red-100 font-semibold text-red-900 shadow-sm ${selectedSizeClasses}`}
      >
        <span className="h-2 w-2 rounded-full bg-red-600" aria-hidden="true" />
        <Clock className="h-3.5 w-3.5 text-red-700" aria-hidden="true" />
        <span>{OCCUPIED_STATUS_TEXT}</span>
      </span>
    );
  }

  return (
    <span
      data-testid="availability-badge-no-registrado"
      className={`inline-flex items-center rounded-full border border-amber-300 bg-amber-50 font-semibold text-amber-900 shadow-sm ${selectedSizeClasses}`}
    >
      <HelpCircle className="h-3.5 w-3.5 text-amber-700" aria-hidden="true" />
      <span>{UNREGISTERED_AVAILABILITY_TEXT}</span>
    </span>
  );
}

export const AvailabilityBadge = renderAvailabilityBadge;
