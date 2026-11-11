import {
  AvailabilityStateCode,
  AvailabilityStateLabel,
} from '../space-availability/space-availability.types';

export interface PermittedSportItem {
  id: string;
  codigo: string;
  nombre: string;
  descripcion: string | null;
}

export interface SpacePhysicalCharacteristics {
  tieneCaracteristicasRegistradas: boolean;
  descripcionTexto: string;
  capacidad: number;
  esTechado: boolean;
  coberturaTexto: 'Techada (Cubierta)' | 'Destechada (Al aire libre)';
  esMixta: boolean;
  superficieCodigo: string;
  superficieNombre: string;
  deportesPermitidos: PermittedSportItem[];
}

export interface SpaceLocationReference {
  edificio: string;
  ubicacionRelativa: string;
  referenciaCompleta: string;
}

export interface SpaceDetailData {
  id: string;
  codigoInterno: string;
  nombre: string;
  tipoCodigo: string;
  tipoNombre: string;
  imagenUrl: string | null;
  tieneImagen: boolean;
  textoImagenFallback: string;
  caracteristicasFisicas: SpacePhysicalCharacteristics;
  ubicacionReferencia: SpaceLocationReference;
  disponibilidadActual: {
    estadoCodigo: AvailabilityStateCode;
    estadoTexto: AvailabilityStateLabel;
    instanteConsulta: string;
  };
  activo: boolean;
  actualizadoEn: string;
}

