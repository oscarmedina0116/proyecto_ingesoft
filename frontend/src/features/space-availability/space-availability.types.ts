export type AvailabilityStateCode = 'DISPONIBLE' | 'OCUPADO' | 'NO_REGISTRADO';

export type AvailabilityStateLabel =
  | 'Disponible'
  | 'Ocupado'
  | 'Disponibilidad no registrada';

export interface ActiveReservationSummary {
  reservaId: string;
  estado: 'PENDIENTE' | 'CONFIRMADA';
  fechaInicio: string;
  fechaFin: string;
  horaInicioLocal: string;
  horaFinLocal: string;
  deporteNombre: string;
  estudianteNombre: string;
}

export interface HourlySlotItem {
  espacioNombre: string;
  fecha: string;
  horaInicio: string;
  horaFin: string;
  disponible: boolean;
  estadoTexto: 'Disponible' | 'Ocupado';
}

export interface SpaceDailyAvailabilityData {
  espacioId: string;
  codigoInterno: string;
  espacioNombre: string;
  fechaConsulta: string;
  instanteServidor: string;
  estadoActualCodigo: AvailabilityStateCode;
  estadoActualTexto: AvailabilityStateLabel;
  franjasHorarias: HourlySlotItem[];
  reservasActivasDia: ActiveReservationSummary[];
}

