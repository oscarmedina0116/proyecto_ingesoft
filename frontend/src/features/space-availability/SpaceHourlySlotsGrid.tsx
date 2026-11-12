import React from 'react';
import {
  Calendar,
  CheckCircle2,
  Clock,
  PlusCircle,
  RefreshCw,
  Trash2,
} from 'lucide-react';
import { UNREGISTERED_AVAILABILITY_TEXT } from '../../shared/api/client';
import { useToast } from '../../shared/components/Toast';
import { AvailabilityBadge } from './AvailabilityBadge';
import {
  useCancelReservationMutation,
  useCreateReservationMutation,
  useSpaceDailyAvailability,
  useToggleAvailabilityRegistrationMutation,
} from './use-space-availability';

interface SpaceHourlySlotsGridProps {
  spaceId: string;
  selectedDate?: string;
  selectedTime?: string;
}

export const DEFAULT_SLOT_DURATION_MINUTES = 60;
export const DEFAULT_BOOKING_ERROR_MESSAGE = 'No se pudo registrar la reserva.';
export const DEFAULT_CANCEL_ERROR_MESSAGE = 'No se pudo cancelar la reserva.';
export const DEFAULT_TOGGLE_ERROR_MESSAGE =
  'Error al alternar registro de disponibilidad.';

/**
 * Renderiza la grilla reactiva de las 15 franjas horarias (06:00 a 21:00)
 * permitiendo crear o cancelar reservas para verificar sincronización inmediata.
 *
 * @param {SpaceHourlySlotsGridProps} gridProps Identificador del espacio y fecha/hora de consulta.
 * @returns {React.JSX.Element} Grilla interactiva de disponibilidad por franjas y reservas activas.
 */
export function renderSpaceHourlySlotsGrid({
  spaceId,
  selectedDate,
  selectedTime,
}: SpaceHourlySlotsGridProps): React.JSX.Element {
  let { showToast } = useToast();
  let {
    data: dailyAvailabilityData,
    isLoading,
    isError,
    error: queryError,
    refetch: refetchDailyAvailability,
  } = useSpaceDailyAvailability(spaceId, selectedDate, selectedTime);

  let createReservationMutation = useCreateReservationMutation();
  let cancelReservationMutation = useCancelReservationMutation();
  let toggleRegistrationMutation = useToggleAvailabilityRegistrationMutation();

  /**
   * Registra una reserva de 1 hora en la franja horaria seleccionada.
   *
   * @param {string} slotStartTime Hora de inicio de la franja en formato HH:MM.
   * @returns {Promise<void>} Promesa resuelta al completar la reserva y actualizar la vista.
   */
  let bookHourlySlot = async (slotStartTime: string): Promise<void> => {
    try {
      let reservationResult = await createReservationMutation.mutateAsync({
        espacioId: spaceId,
        fecha: dailyAvailabilityData?.fechaConsulta || selectedDate,
        horaInicio: slotStartTime.slice(0, 5),
        duracionMinutos: DEFAULT_SLOT_DURATION_MINUTES,
      });
      showToast(reservationResult.mensaje, 'success');
    } catch (caughtError) {
      let errorMessage =
        caughtError instanceof Error
          ? caughtError.message
          : DEFAULT_BOOKING_ERROR_MESSAGE;
      showToast(errorMessage, 'error');
    }
  };

  /**
   * Cancela una reserva activa liberando de inmediato las franjas asociadas.
   *
   * @param {string} reservationId UUID de la reserva a cancelar.
   * @returns {Promise<void>} Promesa resuelta tras cancelar la reserva.
   */
  let cancelSelectedReservation = async (
    reservationId: string
  ): Promise<void> => {
    try {
      let cancellationResult =
        await cancelReservationMutation.mutateAsync(reservationId);
      showToast(cancellationResult.mensaje, 'success');
    } catch (caughtError) {
      let errorMessage =
        caughtError instanceof Error
          ? caughtError.message
          : DEFAULT_CANCEL_ERROR_MESSAGE;
      showToast(errorMessage, 'error');
    }
  };

  /**
   * Alterna el registro de disponibilidad del espacio para demostrar el estado "Disponibilidad no registrada".
   *
   * @param {boolean} shouldRegisterAvailability Nuevo valor de gestión de disponibilidad.
   * @returns {Promise<void>} Promesa resuelta al actualizar el estado.
   */
  let updateAvailabilityRegistration = async (
    shouldRegisterAvailability: boolean
  ): Promise<void> => {
    try {
      let updatedRegistration = await toggleRegistrationMutation.mutateAsync({
        spaceId,
        gestionaDisponibilidad: shouldRegisterAvailability,
      });
      showToast(
        `Estado de disponibilidad del espacio actualizado a: "${updatedRegistration.estadoTexto}"`,
        'info'
      );
    } catch (caughtError) {
      let errorMessage =
        caughtError instanceof Error
          ? caughtError.message
          : DEFAULT_TOGGLE_ERROR_MESSAGE;
      showToast(errorMessage, 'error');
    }
  };

  if (isLoading) {
    return (
      <div className="rounded-xl border border-slate-200 bg-slate-50 p-5 text-sm text-slate-600">
        Consultando las franjas horarias disponibles para este escenario...
      </div>
    );
  }

  if (isError || !dailyAvailabilityData) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
        <p className="font-semibold">
          {queryError instanceof Error
            ? queryError.message
            : 'No se pudieron cargar las franjas horarias.'}
        </p>
      </div>
    );
  }

  let isUnregisteredState =
    dailyAvailabilityData.estadoActualCodigo === 'NO_REGISTRADO';

  return (
    <section
      aria-label="Disponibilidad por franjas horarias"
      className="space-y-4 rounded-2xl border border-slate-200 bg-slate-50/80 p-4 sm:p-5"
    >
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-3">
        <div>
          <h3 className="flex items-center gap-2 text-base font-bold text-slate-900">
            <Calendar className="h-4 w-4 text-unal-green" aria-hidden="true" />
            <span>
              Horarios del Día ({dailyAvailabilityData.fechaConsulta})
            </span>
          </h3>
          <p className="mt-0.5 text-xs text-slate-600">
            Jornada deportiva de Lunes a Viernes · 06:00 a. m. – 09:00 p. m.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <AvailabilityBadge
            statusCode={dailyAvailabilityData.estadoActualCodigo}
            size="md"
          />
          {isUnregisteredState && (
            <button
              type="button"
              onClick={() => updateAvailabilityRegistration(true)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-amber-300 bg-amber-50 px-2.5 py-1.5 text-xs font-semibold text-amber-900 transition hover:bg-amber-100"
            >
              Habilitar horario del espacio
            </button>
          )}
          <button
            type="button"
            onClick={() => refetchDailyAvailability()}
            className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-100"
          >
            <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Actualizar</span>
          </button>
        </div>
      </div>

      {isUnregisteredState ? (
        <div
          data-testid="unregistered-availability-banner"
          className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950"
        >
          <p className="font-bold">{UNREGISTERED_AVAILABILITY_TEXT}</p>
          <p className="mt-1 text-xs text-amber-800">
            Este escenario deportivo no cuenta actualmente con programación de horarios activa para reservas en línea.
          </p>
        </div>
      ) : (
        <>
          {/* Reservas activas del día con opción de cancelación */}
          {dailyAvailabilityData.reservasActivasDia.length > 0 && (
            <div className="space-y-2 rounded-xl border border-red-200 bg-red-50/70 p-3.5">
              <p className="text-xs font-bold uppercase tracking-wider text-red-900">
                Reservas programadas para esta fecha (
                {dailyAvailabilityData.reservasActivasDia.length})
              </p>
              <ul className="space-y-2">
                {dailyAvailabilityData.reservasActivasDia.map(
                  (activeReservationItem) => (
                    <li
                      key={activeReservationItem.reservaId}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-white px-3 py-2 text-xs shadow-sm ring-1 ring-red-200"
                    >
                      <div>
                        <span className="font-bold text-red-800">
                          {activeReservationItem.horaInicioLocal} –{' '}
                          {activeReservationItem.horaFinLocal}
                        </span>{' '}
                        <span className="font-medium text-slate-800">
                          · {activeReservationItem.deporteNombre}
                        </span>{' '}
                        <span className="text-slate-600">
                          ({activeReservationItem.estudianteNombre} ·{' '}
                          {activeReservationItem.estado})
                        </span>
                      </div>
                      <button
                        type="button"
                        disabled={cancelReservationMutation.isPending}
                        onClick={() =>
                          cancelSelectedReservation(
                            activeReservationItem.reservaId
                          )
                        }
                        className="inline-flex items-center gap-1 rounded-md bg-red-600 px-2.5 py-1 text-xs font-semibold text-white transition hover:bg-red-700 disabled:opacity-50"
                      >
                        <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                        <span>Cancelar reserva</span>
                      </button>
                    </li>
                  )
                )}
              </ul>
            </div>
          )}

          {/* Grilla de las 15 franjas de 1 hora (06:00 a 21:00) */}
          <div>
            <p className="mb-2 text-xs font-medium text-slate-600">
              Selecciona una franja <strong>Disponible</strong> para apartar tu cancha durante 1 hora:
            </p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-5">
              {dailyAvailabilityData.franjasHorarias.map((hourlySlotItem) => (
                <div
                  key={`${hourlySlotItem.horaInicio}-${hourlySlotItem.horaFin}`}
                  className={`flex flex-col justify-between rounded-xl border p-2.5 text-xs transition ${
                    hourlySlotItem.disponible
                      ? 'border-emerald-200 bg-white hover:border-emerald-400'
                      : 'border-red-300 bg-red-50/90'
                  }`}
                >
                  <div className="flex items-center justify-between gap-1">
                    <span className="font-mono font-bold text-slate-900">
                      {hourlySlotItem.horaInicio}–{hourlySlotItem.horaFin}
                    </span>
                    {hourlySlotItem.disponible ? (
                      <CheckCircle2
                        className="h-3.5 w-3.5 text-emerald-600"
                        aria-hidden="true"
                      />
                    ) : (
                      <Clock
                        className="h-3.5 w-3.5 text-red-600"
                        aria-hidden="true"
                      />
                    )}
                  </div>

                  <div className="mt-2 flex items-center justify-between">
                    <span
                      className={`font-semibold ${
                        hourlySlotItem.disponible
                          ? 'text-emerald-800'
                          : 'text-red-800'
                      }`}
                    >
                      {hourlySlotItem.estadoTexto}
                    </span>

                    {hourlySlotItem.disponible && (
                      <button
                        type="button"
                        disabled={createReservationMutation.isPending}
                        onClick={() => bookHourlySlot(hourlySlotItem.horaInicio)}
                        aria-label={`Reservar franja ${hourlySlotItem.horaInicio} a ${hourlySlotItem.horaFin}`}
                        className="inline-flex items-center gap-0.5 rounded bg-emerald-700 px-1.5 py-0.5 text-[11px] font-semibold text-white transition hover:bg-emerald-800 disabled:opacity-50"
                      >
                        <PlusCircle className="h-3 w-3" aria-hidden="true" />
                        <span>Reservar</span>
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </section>
  );
}

export const SpaceHourlySlotsGrid = renderSpaceHourlySlotsGrid;
