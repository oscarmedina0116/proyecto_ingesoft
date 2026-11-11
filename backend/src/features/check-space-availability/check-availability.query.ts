import { prisma } from '../../shared/database/prisma';
import {
  AVAILABLE_STATUS_TEXT,
  OCCUPIED_STATUS_TEXT,
} from '../../shared/constants/app-constants';
import {
  ActiveReservationSummaryDto,
  HourlySlotDto,
} from './check-availability.dto';

interface RawActiveReservationRow {
  reserva_id: string;
  espacio_id: string;
  estado: 'PENDIENTE' | 'CONFIRMADA';
  fecha_inicio: Date;
  fecha_fin: Date;
  hora_inicio_local: string;
  hora_fin_local: string;
  deporte_nombre: string;
  estudiante_nombre: string;
}

interface RawFnDisponibilidadRow {
  espacio_nombre: string;
  fecha: Date | string;
  franja_inicio: Date;
  franja_fin: Date;
  hora_inicio: string;
  hora_fin: string;
  disponible: boolean;
}

interface RawSpaceDisciplineCountRow {
  espacio_id: string;
  total_disciplinas: bigint | number;
}

/**
 * Clase de acceso a datos para el Slice `check-space-availability` (REQ-02).
 * Ejecuta consultas indexadas sobre PostgreSQL 16+, invocando `fn_disponibilidad_espacio`
 * y `v_disponibilidad_espacios` y aprovechando el índice GiST `idx_reservas_espacio_rango`.
 */
export class CheckAvailabilityQuery {
  /**
   * Obtiene en una sola consulta indexada todas las reservas activas (`PENDIENTE` o `CONFIRMADA`)
   * que se solapan con el instante consultado para un conjunto de espacios deportivos.
   *
   * @param {string[]} spaceIds Lista de UUIDs de los espacios deportivos a consultar.
   * @param {string} targetInstantIso Instante de consulta en formato ISO-8601 con zona horaria.
   * @returns {Promise<Map<string, ActiveReservationSummaryDto>>} Mapa de espacioId a su reserva activa.
   */
  public async findActiveReservationsAtInstant(
    spaceIds: string[],
    targetInstantIso: string
  ): Promise<Map<string, ActiveReservationSummaryDto>> {
    if (spaceIds.length === 0) {
      return new Map();
    }

    let reservationRows = await prisma.$queryRawUnsafe<
      RawActiveReservationRow[]
    >(
      `
      SELECT
        r.id::text AS reserva_id,
        r.espacio_id::text AS espacio_id,
        r.estado::text AS estado,
        r.fecha_inicio,
        r.fecha_fin,
        to_char(r.fecha_inicio AT TIME ZONE 'America/Bogota', 'HH24:MI') AS hora_inicio_local,
        to_char(r.fecha_fin AT TIME ZONE 'America/Bogota', 'HH24:MI') AS hora_fin_local,
        dd.nombre AS deporte_nombre,
        (u.nombres || ' ' || u.apellidos) AS estudiante_nombre
      FROM reservas r
      JOIN disciplinas_deportivas dd ON dd.id = r.disciplina_id
      JOIN usuarios u ON u.id = r.usuario_id
      WHERE r.espacio_id = ANY($1::uuid[])
        AND r.estado IN ('PENDIENTE', 'CONFIRMADA')
        AND r.rango_horario @> ($2::timestamptz)
      ORDER BY r.fecha_inicio ASC;
      `,
      spaceIds,
      targetInstantIso
    );

    let reservationBySpaceMap = new Map<string, ActiveReservationSummaryDto>();
    for (let reservationRow of reservationRows) {
      if (!reservationBySpaceMap.has(reservationRow.espacio_id)) {
        reservationBySpaceMap.set(reservationRow.espacio_id, {
          reservaId: reservationRow.reserva_id,
          estado: reservationRow.estado,
          fechaInicio: new Date(reservationRow.fecha_inicio).toISOString(),
          fechaFin: new Date(reservationRow.fecha_fin).toISOString(),
          horaInicioLocal: reservationRow.hora_inicio_local,
          horaFinLocal: reservationRow.hora_fin_local,
          deporteNombre: reservationRow.deporte_nombre,
          estudianteNombre: reservationRow.estudiante_nombre,
        });
      }
    }

    return reservationBySpaceMap;
  }

  /**
   * Verifica cuántos deportes habilitados tiene cada espacio en `espacio_deportes` para determinar
   * si el espacio cuenta con configuración de disponibilidad registrada en PostgreSQL.
   *
   * @param {string[]} spaceIds Lista de UUIDs de espacios deportivos.
   * @returns {Promise<Map<string, number>>} Mapa de espacioId al número de disciplinas asociadas.
   */
  public async countRegisteredDisciplinesBySpace(
    spaceIds: string[]
  ): Promise<Map<string, number>> {
    if (spaceIds.length === 0) {
      return new Map();
    }

    let disciplineCountRows = await prisma.$queryRawUnsafe<
      RawSpaceDisciplineCountRow[]
    >(
      `
      SELECT
        e.id::text AS espacio_id,
        COUNT(ed.id)::int AS total_disciplinas
      FROM espacios_deportivos e
      LEFT JOIN espacio_deportes ed ON ed.espacio_id = e.id
      WHERE e.id = ANY($1::uuid[])
      GROUP BY e.id;
      `,
      spaceIds
    );

    let disciplineCountBySpaceMap = new Map<string, number>();
    for (let disciplineCountRow of disciplineCountRows) {
      disciplineCountBySpaceMap.set(
        disciplineCountRow.espacio_id,
        Number(disciplineCountRow.total_disciplinas)
      );
    }
    return disciplineCountBySpaceMap;
  }

  /**
   * Invoca directamente la función nativa de PostgreSQL `fn_disponibilidad_espacio(p_espacio_id, p_fecha)`
   * definida en `05_views_and_queries.sql` para obtener las 15 franjas horarias (06:00 a 21:00).
   *
   * @param {string} spaceId UUID del espacio deportivo a consultar.
   * @param {string} targetDate Fecha en formato YYYY-MM-DD (zona horaria America/Bogota).
   * @returns {Promise<HourlySlotDto[]>} Arreglo con las 15 franjas horarias del día y su estado.
   */
  public async fetchHourlySlotsFromPostgresFunction(
    spaceId: string,
    targetDate: string
  ): Promise<HourlySlotDto[]> {
    let functionSlotRows = await prisma.$queryRawUnsafe<
      RawFnDisponibilidadRow[]
    >(
      `
      SELECT
        espacio_nombre,
        to_char(fecha, 'YYYY-MM-DD') AS fecha,
        franja_inicio,
        franja_fin,
        to_char(hora_inicio, 'HH24:MI') AS hora_inicio,
        to_char(hora_fin, 'HH24:MI') AS hora_fin,
        disponible
      FROM fn_disponibilidad_espacio($1::uuid, $2::date)
      ORDER BY hora_inicio ASC;
      `,
      spaceId,
      targetDate
    );

    return functionSlotRows.map((slotRow) => ({
      espacioNombre: slotRow.espacio_nombre,
      fecha: String(slotRow.fecha),
      horaInicio: slotRow.hora_inicio,
      horaFin: slotRow.hora_fin,
      disponible: Boolean(slotRow.disponible),
      estadoTexto: slotRow.disponible
        ? AVAILABLE_STATUS_TEXT
        : OCCUPIED_STATUS_TEXT,
    }));
  }

  /**
   * Obtiene todas las reservas activas (`PENDIENTE` o `CONFIRMADA`) de un espacio en una fecha dada.
   *
   * @param {string} spaceId UUID del espacio deportivo.
   * @param {string} targetDate Fecha local en formato YYYY-MM-DD.
   * @returns {Promise<ActiveReservationSummaryDto[]>} Lista de reservas activas para ese espacio y fecha.
   */
  public async findActiveReservationsBySpaceAndDate(
    spaceId: string,
    targetDate: string
  ): Promise<ActiveReservationSummaryDto[]> {
    let reservationRows = await prisma.$queryRawUnsafe<
      RawActiveReservationRow[]
    >(
      `
      SELECT
        r.id::text AS reserva_id,
        r.espacio_id::text AS espacio_id,
        r.estado::text AS estado,
        r.fecha_inicio,
        r.fecha_fin,
        to_char(r.fecha_inicio AT TIME ZONE 'America/Bogota', 'HH24:MI') AS hora_inicio_local,
        to_char(r.fecha_fin AT TIME ZONE 'America/Bogota', 'HH24:MI') AS hora_fin_local,
        dd.nombre AS deporte_nombre,
        (u.nombres || ' ' || u.apellidos) AS estudiante_nombre
      FROM reservas r
      JOIN disciplinas_deportivas dd ON dd.id = r.disciplina_id
      JOIN usuarios u ON u.id = r.usuario_id
      WHERE r.espacio_id = $1::uuid
        AND r.estado IN ('PENDIENTE', 'CONFIRMADA')
        AND (r.fecha_inicio AT TIME ZONE 'America/Bogota')::date = $2::date
      ORDER BY r.fecha_inicio ASC;
      `,
      spaceId,
      targetDate
    );

    return reservationRows.map((reservationRow) => ({
      reservaId: reservationRow.reserva_id,
      estado: reservationRow.estado,
      fechaInicio: new Date(reservationRow.fecha_inicio).toISOString(),
      fechaFin: new Date(reservationRow.fecha_fin).toISOString(),
      horaInicioLocal: reservationRow.hora_inicio_local,
      horaFinLocal: reservationRow.hora_fin_local,
      deporteNombre: reservationRow.deporte_nombre,
      estudianteNombre: reservationRow.estudiante_nombre,
    }));
  }

  /**
   * Inserta una nueva reserva en PostgreSQL validada por el trigger `fn_validar_reserva()`
   * y la restricción ACID `EXCLUDE USING gist (excl_reserva_sin_solapamiento)`.
   *
   * @param {string} usuarioId UUID del estudiante que realiza la reserva.
   * @param {string} espacioId UUID del espacio deportivo a reservar.
   * @param {string} disciplinaId UUID de la disciplina deportiva permitida.
   * @param {string} fechaInicioIso Timestamp de inicio con zona horaria America/Bogota.
   * @param {string} fechaFinIso Timestamp de fin con zona horaria America/Bogota.
   * @returns {Promise<string>} UUID de la reserva creada en PostgreSQL.
   */
  public async insertReservationInPostgres(
    usuarioId: string,
    espacioId: string,
    disciplinaId: string,
    fechaInicioIso: string,
    fechaFinIso: string
  ): Promise<string> {
    let insertedRows = await prisma.$queryRawUnsafe<Array<{ id: string }>>(
      `
      INSERT INTO reservas (usuario_id, espacio_id, disciplina_id, fecha_inicio, fecha_fin, estado)
      VALUES ($1::uuid, $2::uuid, $3::uuid, $4::timestamptz, $5::timestamptz, 'CONFIRMADA')
      RETURNING id::text AS id;
      `,
      usuarioId,
      espacioId,
      disciplinaId,
      fechaInicioIso,
      fechaFinIso
    );

    return insertedRows[0].id;
  }

  /**
   * Cancela una reserva activa en PostgreSQL, disparando automáticamente el trigger
   * de auditoría `trg_auditar_estado_reserva` y liberando de inmediato la franja horaria.
   *
   * @param {string} reservationId UUID de la reserva a cancelar.
   * @param {string} cancellationReason Motivo de cancelación para la tabla `auditoria_reservas`.
   * @returns {Promise<boolean>} `true` si la reserva fue actualizada a `CANCELADA`.
   */
  public async cancelReservationInPostgres(
    reservationId: string,
    cancellationReason: string
  ): Promise<boolean> {
    let updatedRowsCount = await prisma.$executeRawUnsafe(
      `
      UPDATE reservas
      SET estado = 'CANCELADA',
          motivo_cancelacion = $2
      WHERE id = $1::uuid
        AND estado IN ('PENDIENTE', 'CONFIRMADA');
      `,
      reservationId,
      cancellationReason
    );

    return updatedRowsCount > 0;
  }
}
