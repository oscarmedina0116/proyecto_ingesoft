import {
  ActiveReservationSummary,
  AvailabilityStateCode,
  AvailabilityStateLabel,
} from '../space-availability/space-availability.types';
import { PermittedSportItem } from '../space-detail/space-detail.types';

export interface CatalogFilters {
  search: string;
  sport: string;
  spaceType: string;
  roofed: 'ALL' | 'TRUE' | 'FALSE';
  availability: 'ALL' | 'DISPONIBLE' | 'OCUPADO' | 'NO_REGISTRADO';
  date: string;
  time: string;
}

export interface SportsSpaceCatalogItem {
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
  deportesPermitidos: PermittedSportItem[];
  disponibilidad: {
    estadoCodigo: AvailabilityStateCode;
    estadoTexto: AvailabilityStateLabel;
    gestionaDisponibilidad: boolean;
    instanteConsulta: string;
    reservaActiva: ActiveReservationSummary | null;
  };
}

export interface SportsSpacesCatalogResponse {
  instanteConsulta: string;
  fechaConsulta: string;
  horaConsulta: string;
  totalEspacios: number;
  resumenEstados: {
    disponibles: number;
    ocupados: number;
    noRegistrados: number;
  };
  espacios: SportsSpaceCatalogItem[];
}

