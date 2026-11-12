import { AvailabilityStateCode, AvailabilityStateLabel } from '../check-space-availability/check-availability.dto';

export interface PermittedSportDto {
  id: string;
  codigo: string;
  nombre: string;
  descripcion: string | null;
}

export interface SpacePhysicalCharacteristicsDto {
  tieneCaracteristicasRegistradas: boolean;
  descripcionTexto: string;
  capacidad: number;
  esTechado: boolean;
  coberturaTexto: 'Techada (Cubierta)' | 'Destechada (Al aire libre)';
  esMixta: boolean;
  superficieCodigo: string;
  superficieNombre: string;
  deportesPermitidos: PermittedSportDto[];
}

export interface SpaceLocationReferenceDto {
  edificio: string;
  ubicacionRelativa: string;
  referenciaCompleta: string;
}

export interface SpaceDetailResponseDto {
  id: string;
  codigoInterno: string;
  nombre: string;
  tipoCodigo: string;
  tipoNombre: string;
  imagenUrl: string | null;
  tieneImagen: boolean;
  textoImagenFallback: string;
  caracteristicasFisicas: SpacePhysicalCharacteristicsDto;
  ubicacionReferencia: SpaceLocationReferenceDto;
  disponibilidadActual: {
    estadoCodigo: AvailabilityStateCode;
    estadoTexto: AvailabilityStateLabel;
    instanteConsulta: string;
  };
  activo: boolean;
  actualizadoEn: string;
}

