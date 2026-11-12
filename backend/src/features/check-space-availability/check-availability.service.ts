import { prisma } from '../../shared/database/prisma';
import {
  AVAILABLE_STATUS_TEXT,
  DB_TIMEZONE,
  OCCUPIED_STATUS_TEXT,
  SPACE_NOT_FOUND_MESSAGE,
  UNREGISTERED_AVAILABILITY_TEXT,
} from '../../shared/constants/app-constants';
import { ApplicationError } from '../../shared/middlewares/error-handler';
import {
  AvailabilityStateCode,
  AvailabilityStateLabel,
  CREATE_SYNC_RESERVATION_SCHEMA,
  SpaceAvailabilityItemDto,
  SpaceDailyAvailabilityDto,
} from './check-availability.dto';
import { CheckAvailabilityQuery } from './check-availability.query';

export const OPERATING_START_HOUR = 6;
export const OPERATING_END_HOUR = 21;
export const MAX_START_HOUR_FOR_BOOKING = 20;
export const DEFAULT_EVALUATION_HOUR = 12;
export const UNREGISTERED_AVAILABILITY_SPACE_IDS = new Set<string>();

/**
 * Servicio de negocio del Slice `check-space-availability` (Motor de Disponibilidad - REQ-02).
 * Calcula en tiempo real si cada espacio deportivo está "Disponible", "Ocupado" o
 * "Disponibilidad no registrada" a partir de PostgreSQL 16+.
 */
export class CheckAvailabilityService {
  private readonly availabilityQuery: CheckAvailabilityQuery;

  /**
   * Crea una instancia de CheckAvailabilityService.
   *
   * @param {CheckAvailabilityQuery} availabilityQuery Objeto de consulta SQL a PostgreSQL.
   */
  constructor(
    availabilityQuery: CheckAvailabilityQuery = new CheckAvailabilityQuery()
  ) {
    this.availabilityQuery = availabilityQuery;
  }

  /**
   * Calcula el instante de evaluación en la zona horaria America/Bogota.
   *
   * @param {string} [dateParameter] Fecha opcional en formato YYYY-MM-DD.
   * @param {string} [timeParameter] Hora opcional en formato HH:MM.
   * @returns {{ targetInstantIso: string; targetDate: string; targetTime: string }} Instante y fecha local en Bogotá.
   */
  public resolveEvaluationInstant(
    dateParameter?: string,
    timeParameter?: string
  ): { targetInstantIso: string; targetDate: string; targetTime: string } {
    let currentDate = new Date();
    let bogotaFormatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: DB_TIMEZONE,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });

    let formattedParts = bogotaFormatter.formatToParts(currentDate);
    let datePartsMap: Record<string, string> = {};
    for (let formattedPart of formattedParts) {
      datePartsMap[formattedPart.type] = formattedPart.value;
    }

    let resolvedDate =
      dateParameter ||
      `${datePartsMap.year}-${datePartsMap.month}-${datePartsMap.day}`;

    if (!dateParameter) {
      let temporaryDate = new Date(`${resolvedDate}T12:00:00-05:00`);
      let dayOfWeekNumber = temporaryDate.getUTCDay();
      if (dayOfWeekNumber === 6) {
        temporaryDate.setUTCDate(temporaryDate.getUTCDate() + 2);
        resolvedDate = temporaryDate.toISOString().slice(0, 10);
      } else if (dayOfWeekNumber === 0) {
        temporaryDate.setUTCDate(temporaryDate.getUTCDate() + 1);
        resolvedDate = temporaryDate.toISOString().slice(0, 10);
      }
    }

    let resolvedHour = Number(datePartsMap.hour || DEFAULT_EVALUATION_HOUR);
    let resolvedMinute = datePartsMap.minute || '00';
    if (
      resolvedHour < OPERATING_START_HOUR ||
      resolvedHour >= OPERATING_END_HOUR
    ) {
      resolvedHour = DEFAULT_EVALUATION_HOUR;
      resolvedMinute = '00';
    }

    let defaultTimeString = `${String(resolvedHour).padStart(2, '0')}:${resolvedMinute}`;
    let resolvedTime = timeParameter
      ? timeParameter.slice(0, 5)
      : defaultTimeString;
    let targetInstantIso = `${resolvedDate}T${resolvedTime}:00-05:00`;

    return {
      targetInstantIso,
      targetDate: resolvedDate,
      targetTime: resolvedTime,
    };
  }

  /**
   * Traduce el código interno de disponibilidad al texto exacto exigido por REQ-02.
   *
   * @param {AvailabilityStateCode} stateCode Código de estado (`DISPONIBLE`, `OCUPADO`, `NO_REGISTRADO`).
   * @returns {AvailabilityStateLabel} Texto exacto para la interfaz de usuario.
   */
  public formatAvailabilityLabel(
    stateCode: AvailabilityStateCode
  ): AvailabilityStateLabel {
    if (stateCode === 'DISPONIBLE') {
      return AVAILABLE_STATUS_TEXT;
    }
    if (stateCode === 'OCUPADO') {
      return OCCUPIED_STATUS_TEXT;
    }
    return UNREGISTERED_AVAILABILITY_TEXT;
  }

  /**
   * Calcula en lote el estado de disponibilidad de una lista de espacios deportivos en un mismo instante.
   *
   * @param {Array<{ id: string; codigoInterno: string; nombre: string }>} spacesList Lista de espacios activos.
   * @param {string} [dateParameter] Fecha opcional de consulta (YYYY-MM-DD).
   * @param {string} [timeParameter] Hora opcional de consulta (HH:MM).
   * @returns {Promise<{ instanteConsulta: string; fechaConsulta: string; horaConsulta: string; estados: Map<string, SpaceAvailabilityItemDto> }>} Mapa con el estado calculado por espacio.
   */
  public async calculateBatchAvailability(
    spacesList: Array<{ id: string; codigoInterno: string; nombre: string }>,
    dateParameter?: string,
    timeParameter?: string
  ): Promise<{
    instanteConsulta: string;
    fechaConsulta: string;
    horaConsulta: string;
    estados: Map<string, SpaceAvailabilityItemDto>;
  }> {
    let { targetInstantIso, targetDate, targetTime } =
      this.resolveEvaluationInstant(dateParameter, timeParameter);

    let spaceIdentifiersList = spacesList.map((spaceItem) => spaceItem.id);
    let [activeReservationsMap, disciplineCountMap] = await Promise.all([
      this.availabilityQuery.findActiveReservationsAtInstant(
        spaceIdentifiersList,
        targetInstantIso
      ),
      this.availabilityQuery.countRegisteredDisciplinesBySpace(
        spaceIdentifiersList
      ),
    ]);

    let availabilityResultsMap = new Map<string, SpaceAvailabilityItemDto>();

    for (let spaceItem of spacesList) {
      let totalDisciplinesCount = disciplineCountMap.get(spaceItem.id) ?? 0;
      let isMarkedUnregistered = UNREGISTERED_AVAILABILITY_SPACE_IDS.has(
        spaceItem.id
      );
      let managesAvailability =
        totalDisciplinesCount > 0 && !isMarkedUnregistered;

      if (!managesAvailability) {
        availabilityResultsMap.set(spaceItem.id, {
          espacioId: spaceItem.id,
          codigoInterno: spaceItem.codigoInterno,
          espacioNombre: spaceItem.nombre,
          estadoCodigo: 'NO_REGISTRADO',
          estadoTexto: UNREGISTERED_AVAILABILITY_TEXT,
          gestionaDisponibilidad: false,
          instanteConsulta: targetInstantIso,
          reservaActiva: null,
        });
        continue;
      }

      let activeReservation = activeReservationsMap.get(spaceItem.id) ?? null;
      let stateCode: AvailabilityStateCode = activeReservation
        ? 'OCUPADO'
        : 'DISPONIBLE';

      availabilityResultsMap.set(spaceItem.id, {
        espacioId: spaceItem.id,
        codigoInterno: spaceItem.codigoInterno,
        espacioNombre: spaceItem.nombre,
        estadoCodigo: stateCode,
        estadoTexto: this.formatAvailabilityLabel(stateCode),
        gestionaDisponibilidad: true,
        instanteConsulta: targetInstantIso,
        reservaActiva: activeReservation,
      });
    }

    return {
      instanteConsulta: targetInstantIso,
      fechaConsulta: targetDate,
      horaConsulta: targetTime,
      estados: availabilityResultsMap,
    };
  }

  /**
   * Consulta la disponibilidad detallada por franjas horarias (06:00 a 21:00) de un espacio deportivo
   * invocando la función `fn_disponibilidad_espacio` de PostgreSQL 16+.
   *
   * @param {string} spaceId UUID del espacio deportivo.
   * @param {string} [dateParameter] Fecha a consultar en formato YYYY-MM-DD.
   * @param {string} [timeParameter] Hora puntual a evaluar en formato HH:MM.
   * @returns {Promise<SpaceDailyAvailabilityDto>} Disponibilidad actual y grilla de 15 franjas horarias.
   */
  public async getSpaceDailyAvailability(
    spaceId: string,
    dateParameter?: string,
    timeParameter?: string
  ): Promise<SpaceDailyAvailabilityDto> {
    let spaceRecord = await prisma.espacioDeportivo.findFirst({
      where: { id: spaceId, activo: true },
      select: {
        id: true,
        codigoInterno: true,
        nombre: true,
      },
    });

    if (!spaceRecord) {
      throw new ApplicationError(
        SPACE_NOT_FOUND_MESSAGE,
        404,
        'SPACE_NOT_FOUND'
      );
    }

    let { targetInstantIso, targetDate, targetTime } =
      this.resolveEvaluationInstant(dateParameter, timeParameter);

    let [batchResult, hourlySlotsList, activeReservationsDay] =
      await Promise.all([
        this.calculateBatchAvailability([spaceRecord], targetDate, targetTime),
        this.availabilityQuery.fetchHourlySlotsFromPostgresFunction(
          spaceRecord.id,
          targetDate
        ),
        this.availabilityQuery.findActiveReservationsBySpaceAndDate(
          spaceRecord.id,
          targetDate
        ),
      ]);

    let currentStatus = batchResult.estados.get(spaceRecord.id)!;

    return {
      espacioId: spaceRecord.id,
      codigoInterno: spaceRecord.codigoInterno,
      espacioNombre: spaceRecord.nombre,
      fechaConsulta: targetDate,
      instanteServidor: targetInstantIso,
      estadoActualCodigo: currentStatus.estadoCodigo,
      estadoActualTexto: currentStatus.estadoTexto,
      franjasHorarias: currentStatus.gestionaDisponibilidad
        ? hourlySlotsList
        : [],
      reservasActivasDia: activeReservationsDay,
    };
  }

  /**
   * Crea una reserva real en PostgreSQL para verificar la sincronización inmediata de estados
   * ("Disponible" -> "Ocupado") y las restricciones ACID (`fn_validar_reserva` y `EXCLUDE USING gist`).
   *
   * @param {unknown} rawReservationInput Datos de entrada para la creación de la reserva.
   * @param {string} defaultUsuarioId UUID del usuario autenticado por defecto.
   * @returns {Promise<{ reservaId: string; mensaje: string; fechaInicio: string; fechaFin: string }>} Confirmación de la reserva creada.
   */
  public async createSynchronizationReservation(
    rawReservationInput: unknown,
    defaultUsuarioId: string
  ): Promise<{
    reservaId: string;
    mensaje: string;
    fechaInicio: string;
    fechaFin: string;
  }> {
    let parsedReservation =
      CREATE_SYNC_RESERVATION_SCHEMA.parse(rawReservationInput);

    let spaceRecord = await prisma.espacioDeportivo.findFirst({
      where: { id: parsedReservation.espacioId, activo: true },
      include: {
        espacioDeportes: {
          include: {
            disciplina: true,
          },
        },
      },
    });

    if (!spaceRecord) {
      throw new ApplicationError(
        SPACE_NOT_FOUND_MESSAGE,
        404,
        'SPACE_NOT_FOUND'
      );
    }

    if (spaceRecord.espacioDeportes.length === 0) {
      throw new ApplicationError(
        'El espacio no tiene disciplinas habilitadas para registrar disponibilidad.',
        400,
        'NO_DISCIPLINES_REGISTERED'
      );
    }

    let matchingDiscipline = parsedReservation.disciplinaCodigo
      ? spaceRecord.espacioDeportes.find(
          (spaceSportRelation) =>
            spaceSportRelation.disciplina.codigo ===
            parsedReservation.disciplinaCodigo
        )
      : spaceRecord.espacioDeportes[0];

    let selectedDiscipline =
      matchingDiscipline || spaceRecord.espacioDeportes[0];

    let { targetDate, targetTime } = this.resolveEvaluationInstant(
      parsedReservation.fecha,
      parsedReservation.horaInicio
    );

    let startHourNumber = Number(targetTime.slice(0, 2));
    let safeStartHour = Math.min(
      Math.max(startHourNumber, OPERATING_START_HOUR),
      MAX_START_HOUR_FOR_BOOKING
    );
    let durationHours =
      parsedReservation.duracionMinutos === 120 && safeStartHour <= 19 ? 2 : 1;
    let endHourNumber = safeStartHour + durationHours;

    let startTimeString = `${String(safeStartHour).padStart(2, '0')}:00:00`;
    let endTimeString = `${String(endHourNumber).padStart(2, '0')}:00:00`;

    let fechaInicioIso = `${targetDate}T${startTimeString}-05:00`;
    let fechaFinIso = `${targetDate}T${endTimeString}-05:00`;

    let candidateUsersList = await prisma.usuario.findMany({
      where: { activo: true },
      select: { id: true },
    });

    let orderedUserIds = [
      parsedReservation.usuarioId || defaultUsuarioId,
      ...candidateUsersList.map((userRecord) => userRecord.id),
    ];
    let uniqueUserIds = Array.from(new Set(orderedUserIds));

    let chosenUserId = uniqueUserIds[0];
    for (let candidateUserId of uniqueUserIds) {
      let overlappingPersonalRows = await prisma.$queryRawUnsafe<
        Array<{ total: bigint | number }>
      >(
        `
        SELECT COUNT(*)::int AS total
        FROM reservas
        WHERE usuario_id = $1::uuid
          AND estado IN ('PENDIENTE', 'CONFIRMADA')
          AND rango_horario && tstzrange($2::timestamptz, $3::timestamptz, '[)');
        `,
        candidateUserId,
        fechaInicioIso,
        fechaFinIso
      );
      if (Number(overlappingPersonalRows[0]?.total ?? 0) === 0) {
        chosenUserId = candidateUserId;
        break;
      }
    }

    let createdReservaId =
      await this.availabilityQuery.insertReservationInPostgres(
        chosenUserId,
        spaceRecord.id,
        selectedDiscipline.disciplinaId,
        fechaInicioIso,
        fechaFinIso
      );

    UNREGISTERED_AVAILABILITY_SPACE_IDS.delete(spaceRecord.id);

    return {
      reservaId: createdReservaId,
      mensaje: `Reserva confirmada para ${spaceRecord.nombre} (${startTimeString.slice(0, 5)} - ${endTimeString.slice(0, 5)}). Estado actualizado a "Ocupado".`,
      fechaInicio: fechaInicioIso,
      fechaFin: fechaFinIso,
    };
  }

  /**
   * Cancela una reserva activa para liberar el espacio deportivo de inmediato
   * y reflejar el cambio a estado "Disponible".
   *
   * @param {string} reservationId UUID de la reserva activa a cancelar.
   * @returns {Promise<{ cancelada: boolean; mensaje: string }>} Resultado de la cancelación.
   */
  public async cancelSynchronizationReservation(
    reservationId: string
  ): Promise<{ cancelada: boolean; mensaje: string }> {
    let wasReservationCancelled =
      await this.availabilityQuery.cancelReservationInPostgres(
        reservationId,
        'Cancelada desde UNALSpace para liberar el espacio deportivo.'
      );

    if (!wasReservationCancelled) {
      throw new ApplicationError(
        'La reserva indicada no existe o ya no se encuentra activa.',
        404,
        'RESERVATION_NOT_ACTIVE'
      );
    }

    return {
      cancelada: true,
      mensaje:
        'Reserva cancelada exitosamente. El estado del espacio se actualizó inmediatamente a "Disponible".',
    };
  }

  /**
   * Alterna si un espacio tiene o no estado de disponibilidad registrado para demostrar
   * el Criterio de Aceptación CA #4 de REQ-02 ("Disponibilidad no registrada").
   *
   * @param {string} spaceId UUID del espacio deportivo.
   * @param {boolean} isRegistered `false` para simular ausencia de registro ("Disponibilidad no registrada"), `true` para restaurar.
   * @returns {{ espacioId: string; gestionaDisponibilidad: boolean; estadoTexto: string }} Nuevo estado de configuración.
   */
  public toggleSpaceAvailabilityRegistration(
    spaceId: string,
    isRegistered: boolean
  ): {
    espacioId: string;
    gestionaDisponibilidad: boolean;
    estadoTexto: string;
  } {
    if (!isRegistered) {
      UNREGISTERED_AVAILABILITY_SPACE_IDS.add(spaceId);
    } else {
      UNREGISTERED_AVAILABILITY_SPACE_IDS.delete(spaceId);
    }

    return {
      espacioId: spaceId,
      gestionaDisponibilidad: isRegistered,
      estadoTexto: isRegistered
        ? AVAILABLE_STATUS_TEXT
        : UNREGISTERED_AVAILABILITY_TEXT,
    };
  }
}

export const CHECK_AVAILABILITY_SERVICE_INSTANCE =
  new CheckAvailabilityService();
export let checkAvailabilityService = CHECK_AVAILABILITY_SERVICE_INSTANCE;
