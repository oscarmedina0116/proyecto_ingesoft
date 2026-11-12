import { z } from 'zod';

/**
 * Estados posibles de disponibilidad según REQ-02 y el diseño detallado (Entregable 1 y 2).
 */
export type AvailabilityStateCode = 'DISPONIBLE' | 'OCUPADO' | 'NO_REGISTRADO';

/**
 * Etiquetas visibles obligatorias de acuerdo con los Criterios de Aceptación CA #1, CA #2 y CA #4 de REQ-02.
 */
export type AvailabilityStateLabel =
  | 'Disponible'
  | 'Ocupado'
  | 'Disponibilidad no registrada';

/**
 * Esquema de validación para la consulta de disponibilidad de múltiples espacios o por filtro.
 */
export const CHECK_AVAILABILITY_QUERY_SCHEMA = z.object({
  search: z.string().optional().default(''),
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'El formato de fecha debe ser YYYY-MM-DD')
    .optional(),
  time: z
    .string()
    .regex(/^\d{2}:\d{2}(:\d{2})?$/, 'El formato de hora debe ser HH:MM')
    .optional(),
  sport: z.string().optional(),
  spaceType: z.string().optional(),
});

/**
 * Esquema de validación para consultar las 15 franjas horarias de un espacio mediante `fn_disponibilidad_espacio`.
 */
export const SPACE_DAILY_SLOTS_PARAMS_SCHEMA = z.object({
  spaceId: z
    .string()
    .uuid('El identificador del espacio debe ser un UUID válido.'),
});

/**
 * Esquema de validación para crear una reserva de prueba/sincronización en PostgreSQL.
 */
export const CREATE_SYNC_RESERVATION_SCHEMA = z.object({
  espacioId: z
    .string()
    .uuid('El identificador del espacio debe ser un UUID válido.'),
  usuarioId: z.string().uuid().optional(),
  disciplinaCodigo: z
    .enum(['FUTBOL_11', 'FUTBOL_SALA', 'BALONCESTO', 'VOLEIBOL', 'TENIS'])
    .optional(),
  fecha: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'El formato de fecha debe ser YYYY-MM-DD')
    .optional(),
  horaInicio: z
    .string()
    .regex(/^\d{2}:\d{2}$/, 'El formato de horaInicio debe ser HH:MM')
    .optional(),
  duracionMinutos: z.number().int().min(60).max(120).optional().default(60),
});

export interface ActiveReservationSummaryDto {
  reservaId: string;
  estado: 'PENDIENTE' | 'CONFIRMADA';
  fechaInicio: string;
  fechaFin: string;
  horaInicioLocal: string;
  horaFinLocal: string;
  deporteNombre: string;
  estudianteNombre: string;
}

export interface SpaceAvailabilityItemDto {
  espacioId: string;
  codigoInterno: string;
  espacioNombre: string;
  estadoCodigo: AvailabilityStateCode;
  estadoTexto: AvailabilityStateLabel;
  gestionaDisponibilidad: boolean;
  instanteConsulta: string;
  reservaActiva: ActiveReservationSummaryDto | null;
}

export interface HourlySlotDto {
  espacioNombre: string;
  fecha: string;
  horaInicio: string;
  horaFin: string;
  disponible: boolean;
  estadoTexto: 'Disponible' | 'Ocupado';
}

export interface SpaceDailyAvailabilityDto {
  espacioId: string;
  codigoInterno: string;
  espacioNombre: string;
  fechaConsulta: string;
  instanteServidor: string;
  estadoActualCodigo: AvailabilityStateCode;
  estadoActualTexto: AvailabilityStateLabel;
  franjasHorarias: HourlySlotDto[];
  reservasActivasDia: ActiveReservationSummaryDto[];
}
