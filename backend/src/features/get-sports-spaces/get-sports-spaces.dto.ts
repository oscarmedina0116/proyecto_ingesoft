import { z } from 'zod';
import {
  ActiveReservationSummaryDto,
  AvailabilityStateCode,
  AvailabilityStateLabel,
} from '../check-space-availability/check-availability.dto';
import { PermittedSportDto } from '../get-space-detail/get-space-detail.dto';

export const GET_SPORTS_SPACES_QUERY_SCHEMA = z.object({
  search: z.string().optional().default(''),
  sport: z.string().optional().default('ALL'),
  spaceType: z.string().optional().default('ALL'),
  roofed: z.enum(['ALL', 'TRUE', 'FALSE']).optional().default('ALL'),
  availability: z
    .enum(['ALL', 'DISPONIBLE', 'OCUPADO', 'NO_REGISTRADO'])
    .optional()
    .default('ALL'),
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'El formato de fecha debe ser YYYY-MM-DD')
    .optional(),
  time: z
    .string()
    .regex(/^\d{2}:\d{2}(:\d{2})?$/, 'El formato de hora debe ser HH:MM')
    .optional(),
});

export interface SportsSpaceCatalogItemDto {
  id: string;
  codigoInterno: string;
  nombre: string;
  descripcion: string | null;
  tipoCodigo: string;
  tipoNombre: string;
  superficieCodigo: string;
  superficieNombre: string;
  ubicacionRelativa: string;
  edificio: string;
  esTechado: boolean;
  capacidad: number;
  esMixta: boolean;
  imagenUrl: string | null;
  tieneImagen: boolean;
  deportesPermitidos: PermittedSportDto[];
  disponibilidad: {
    estadoCodigo: AvailabilityStateCode;
    estadoTexto: AvailabilityStateLabel;
    gestionaDisponibilidad: boolean;
    instanteConsulta: string;
    reservaActiva: ActiveReservationSummaryDto | null;
  };
}

export interface SportsSpacesCatalogResponseDto {
  instanteConsulta: string;
  fechaConsulta: string;
  horaConsulta: string;
  totalEspacios: number;
  resumenEstados: {
    disponibles: number;
    ocupados: number;
    noRegistrados: number;
  };
  espacios: SportsSpaceCatalogItemDto[];
}
