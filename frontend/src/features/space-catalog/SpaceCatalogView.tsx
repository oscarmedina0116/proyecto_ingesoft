import React, { useEffect, useState } from 'react';
import {
  Building2,
  CalendarClock,
  CheckCircle2,
  Compass,
  Eye,
  Filter,
  MapPin,
  PlusCircle,
  RefreshCw,
  Search,
  Trash2,
  Trophy,
  Users,
} from 'lucide-react';
import { AVAILABILITY_CONNECTION_ERROR_MESSAGE } from '../../shared/api/client';
import { useToast } from '../../shared/components/Toast';
import { AvailabilityBadge } from '../space-availability/AvailabilityBadge';
import {
  useCancelReservationMutation,
  useCreateReservationMutation,
  useToggleAvailabilityRegistrationMutation,
} from '../space-availability/use-space-availability';
import { SpaceDetailModal } from '../space-detail/SpaceDetailModal';
import { SpaceFallbackImage } from '../space-detail/SpaceFallbackImage';
import { CatalogFilters, SportsSpaceCatalogItem } from './space-catalog.types';
import { useSportsSpacesCatalog } from './use-space-catalog';

export const BOGOTA_TIMEZONE = 'America/Bogota';
export const OPERATING_START_HOUR = 6;
export const OPERATING_END_HOUR = 20;
export const DEFAULT_OPERATING_HOUR = 12;
export const OPERATING_SLOTS_COUNT = 15;
export const DEFAULT_QUICK_RESERVATION_MINUTES = 60;
export const SKELETON_CARDS_COUNT = 6;

/**
 * Obtiene la fecha hábil por defecto en zona horaria America/Bogota (YYYY-MM-DD).
 *
 * @returns {string} Fecha en formato YYYY-MM-DD.
 */
function getDefaultBogotaWeekdayDate(): string {
  let currentDate = new Date();
  let formattedDateParts = new Intl.DateTimeFormat('en-CA', {
    timeZone: BOGOTA_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(currentDate);

  let datePartsMap: Record<string, string> = {};
  for (let datePart of formattedDateParts) {
    datePartsMap[datePart.type] = datePart.value;
  }

  let baseDateString = `${datePartsMap.year}-${datePartsMap.month}-${datePartsMap.day}`;
  let bogotaDateObject = new Date(`${baseDateString}T12:00:00-05:00`);
  let dayOfWeekNumber = bogotaDateObject.getUTCDay();
  if (dayOfWeekNumber === 6) {
    bogotaDateObject.setUTCDate(bogotaDateObject.getUTCDate() + 2);
    return bogotaDateObject.toISOString().slice(0, 10);
  }
  if (dayOfWeekNumber === 0) {
    bogotaDateObject.setUTCDate(bogotaDateObject.getUTCDate() + 1);
    return bogotaDateObject.toISOString().slice(0, 10);
  }
  return baseDateString;
}

/**
 * Obtiene la hora operativa por defecto en zona horaria America/Bogota (06:00 a 20:00).
 *
 * @returns {string} Hora en formato HH:00.
 */
function getDefaultBogotaOperatingTime(): string {
  let currentDate = new Date();
  let hourString = new Intl.DateTimeFormat('en-CA', {
    timeZone: BOGOTA_TIMEZONE,
    hour: '2-digit',
    hour12: false,
  }).format(currentDate);

  let parsedHour = Number(hourString);
  if (
    Number.isNaN(parsedHour) ||
    parsedHour < OPERATING_START_HOUR ||
    parsedHour >= OPERATING_END_HOUR
  ) {
    parsedHour = DEFAULT_OPERATING_HOUR;
  }
  return `${String(parsedHour).padStart(2, '0')}:00`;
}

/**
 * Renderiza la vista principal del Slice `space-catalog` que integra la búsqueda y filtrado de espacios
 * deportivos con los Slices `space-availability` (REQ-02) y `space-detail` (REQ-01).
 *
 * @returns {React.JSX.Element} Catálogo interactivo de espacios deportivos UNAL Sede Bogotá.
 */
export function renderSpaceCatalogView(): React.JSX.Element {
  let { showToast } = useToast();

  let [catalogFilters, setCatalogFilters] = useState<CatalogFilters>(() => ({
    search: '',
    sport: 'ALL',
    spaceType: 'ALL',
    roofed: 'ALL',
    availability: 'ALL',
    date: getDefaultBogotaWeekdayDate(),
    time: getDefaultBogotaOperatingTime(),
  }));

  let [selectedSpaceId, setSelectedSpaceId] = useState<string | null>(null);
  let [brokenImagesBySpaceId, setBrokenImagesBySpaceId] = useState<
    Record<string, boolean>
  >({});

  let {
    data: catalogData,
    isLoading,
    isError,
    error: catalogQueryError,
    refetch: refetchCatalog,
    isFetching,
  } = useSportsSpacesCatalog(catalogFilters);

  let createReservationMutation = useCreateReservationMutation();
  let cancelReservationMutation = useCancelReservationMutation();
  let toggleRegistrationMutation = useToggleAvailabilityRegistrationMutation();

  useEffect(() => {
    if (isError && catalogQueryError) {
      let errorMessage =
        catalogQueryError instanceof Error
          ? catalogQueryError.message
          : AVAILABILITY_CONNECTION_ERROR_MESSAGE;
      showToast(errorMessage, 'error');
    }
  }, [isError, catalogQueryError, showToast]);

  /**
   * Actualiza un campo específico de los filtros del catálogo.
   *
   * @template K Clave del filtro.
   * @param {K} filterKey Nombre del filtro a modificar.
   * @param {CatalogFilters[K]} filterValue Nuevo valor del filtro.
   * @returns {void}
   */
  let updateCatalogFilter = <K extends keyof CatalogFilters>(
    filterKey: K,
    filterValue: CatalogFilters[K]
  ): void => {
    setCatalogFilters((previousFilters) => ({
      ...previousFilters,
      [filterKey]: filterValue,
    }));
  };

  /**
   * Restablece todos los filtros de búsqueda a sus valores iniciales.
   *
   * @returns {void}
   */
  let resetCatalogFilters = (): void => {
    setCatalogFilters({
      search: '',
      sport: 'ALL',
      spaceType: 'ALL',
      roofed: 'ALL',
      availability: 'ALL',
      date: getDefaultBogotaWeekdayDate(),
      time: getDefaultBogotaOperatingTime(),
    });
  };

  /**
   * Crea una reserva inmediata para el espacio indicado en el bloque horario consultado,
   * demostrando el reflejo inmediato de "Disponible" a "Ocupado" (REQ-02 Sincronización).
   *
   * @param {SportsSpaceCatalogItem} spaceItem Espacio deportivo a reservar.
   * @returns {Promise<void>} Promesa resuelta tras crear la reserva.
   */
  let reserveSpaceQuickly = async (
    spaceItem: SportsSpaceCatalogItem
  ): Promise<void> => {
    try {
      let createdReservation = await createReservationMutation.mutateAsync({
        espacioId: spaceItem.id,
        fecha: catalogFilters.date,
        horaInicio: catalogFilters.time.slice(0, 5),
        duracionMinutos: DEFAULT_QUICK_RESERVATION_MINUTES,
      });
      showToast(createdReservation.mensaje, 'success');
    } catch (caughtError) {
      let errorMessage =
        caughtError instanceof Error
          ? caughtError.message
          : AVAILABILITY_CONNECTION_ERROR_MESSAGE;
      showToast(errorMessage, 'error');
    }
  };

  /**
   * Cancela la reserva activa del espacio seleccionado, reflejando inmediatamente
   * el cambio de estado de "Ocupado" a "Disponible".
   *
   * @param {string} reservationId UUID de la reserva activa.
   * @returns {Promise<void>} Promesa resuelta tras cancelar la reserva.
   */
  let cancelReservationQuickly = async (
    reservationId: string
  ): Promise<void> => {
    try {
      let cancelledReservation =
        await cancelReservationMutation.mutateAsync(reservationId);
      showToast(cancelledReservation.mensaje, 'success');
    } catch (caughtError) {
      let errorMessage =
        caughtError instanceof Error
          ? caughtError.message
          : AVAILABILITY_CONNECTION_ERROR_MESSAGE;
      showToast(errorMessage, 'error');
    }
  };

  /**
   * Alterna el registro de disponibilidad de un espacio para demostrar el estado
   * "Disponibilidad no registrada" (CA #4 de REQ-02).
   *
   * @param {SportsSpaceCatalogItem} spaceItem Espacio deportivo a alternar.
   * @returns {Promise<void>} Promesa resuelta tras actualizar el estado.
   */
  let toggleSpaceRegistrationStatus = async (
    spaceItem: SportsSpaceCatalogItem
  ): Promise<void> => {
    try {
      let nextRegistrationState =
        !spaceItem.disponibilidad.gestionaDisponibilidad;
      let updatedStatusResult = await toggleRegistrationMutation.mutateAsync({
        spaceId: spaceItem.id,
        gestionaDisponibilidad: nextRegistrationState,
      });
      showToast(
        `Espacio ${spaceItem.codigoInterno}: estado actualizado a "${updatedStatusResult.estadoTexto}".`,
        'info'
      );
    } catch (caughtError) {
      let errorMessage =
        caughtError instanceof Error
          ? caughtError.message
          : AVAILABILITY_CONNECTION_ERROR_MESSAGE;
      showToast(errorMessage, 'error');
    }
  };

  let sportsSpacesList = catalogData?.espacios || [];

  return (
    <div className="space-y-8">
      {/* Banner de Bienvenida Amigable para Estudiantes de la UNAL */}
      <section
        aria-label="Bienvenida a UNALSpace"
        className="relative overflow-hidden rounded-3xl border border-emerald-900/20 bg-gradient-to-br from-emerald-950 via-slate-900 to-emerald-900 p-6 text-white shadow-xl sm:p-8"
      >
        <div className="grid grid-cols-1 items-center gap-6 lg:grid-cols-12">
          <div className="space-y-4 lg:col-span-8">
            <h2 className="text-2xl font-extrabold tracking-tight text-white sm:text-3xl">
              Encuentra y reserva tu cancha en el campus sin caminatas innecesarias
            </h2>

            <p className="max-w-2xl text-sm leading-relaxed text-slate-200 sm:text-base">
              <strong className="font-bold text-white">UNALSpace</strong> es la plataforma estudiantil de la Sede Bogotá para consultar en tiempo real qué canchas y escenarios deportivos están{' '}
              <span className="font-semibold text-emerald-300">disponibles</span> u{' '}
              <span className="font-semibold text-red-300">ocupados</span> antes de salir de clase. Explora fotos reales de cada espacio, verifica si cuenta con techo, conoce sus deportes permitidos y ubícalo fácilmente dentro de la Ciudad Universitaria.
            </p>

            <div className="flex flex-wrap items-center gap-2.5 pt-1 text-xs font-semibold text-emerald-100">
              <span className="inline-flex items-center gap-1.5 rounded-xl bg-white/10 px-3 py-1.5 ring-1 ring-white/15">
                <CheckCircle2
                  className="h-4 w-4 text-emerald-400"
                  aria-hidden="true"
                />
                <span>Estado de canchas en tiempo real</span>
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-xl bg-white/10 px-3 py-1.5 ring-1 ring-white/15">
                <Compass
                  className="h-4 w-4 text-emerald-400"
                  aria-hidden="true"
                />
                <span>Ubicación de referencia en el campus</span>
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-xl bg-white/10 px-3 py-1.5 ring-1 ring-white/15">
                <Trophy
                  className="h-4 w-4 text-emerald-400"
                  aria-hidden="true"
                />
                <span>Fútbol, Baloncesto, Voleibol y Tenis</span>
              </span>
            </div>
          </div>

          {/* Tarjeta de identidad visual con el logo vertical oficial de UNALSpace */}
          <div className="flex justify-center lg:col-span-4 lg:justify-end">
            <div className="flex flex-col items-center rounded-3xl bg-white px-7 py-5 text-center text-slate-900 shadow-2xl ring-4 ring-white/15">
              <img
                src="/logos/logo-vertical-cropped.jpg"
                alt="UNALSpace — Tu espacio deportivo en la UNAL"
                className="h-28 w-auto object-contain sm:h-32"
              />
              <p className="mt-2.5 rounded-full bg-emerald-50 px-3 py-1 text-[11px] font-bold text-emerald-900 ring-1 ring-emerald-200">
                Horarios: Lun a Vie · 6:00 a. m. – 9:00 p. m.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Landmark semántico <search> para búsqueda y filtrado del catálogo */}
      <search className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <form
          onSubmit={(formEvent) => {
            formEvent.preventDefault();
            refetchCatalog();
          }}
          className="space-y-4"
        >
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
            {/* Buscador por nombre, código o edificio */}
            <div className="lg:col-span-5">
              <label
                htmlFor="space-search-input"
                className="block text-xs font-bold uppercase tracking-wider text-slate-600"
              >
                Buscar espacio deportivo (Nombre, código o edificio)
              </label>
              <div className="relative mt-1.5">
                <Search
                  className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
                  aria-hidden="true"
                />
                <input
                  id="space-search-input"
                  type="search"
                  value={catalogFilters.search}
                  onChange={(changeEvent) =>
                    updateCatalogFilter('search', changeEvent.target.value)
                  }
                  placeholder="Ej. Cancha Techada Mixta 1, TCH-001, Concha Acústica, 761..."
                  className="w-full rounded-xl border border-slate-300 bg-slate-50 py-2.5 pl-10 pr-4 text-sm text-slate-900 transition focus:border-unal-green focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                />
              </div>
            </div>

            {/* Selector de Fecha de consulta (America/Bogota) */}
            <div className="sm:col-span-6 lg:col-span-3">
              <label
                htmlFor="space-date-input"
                className="block text-xs font-bold uppercase tracking-wider text-slate-600"
              >
                Fecha de consulta (Lun–Vie)
              </label>
              <input
                id="space-date-input"
                type="date"
                value={catalogFilters.date}
                onChange={(changeEvent) =>
                  updateCatalogFilter('date', changeEvent.target.value)
                }
                className="mt-1.5 w-full rounded-xl border border-slate-300 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-900 focus:border-unal-green focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
              />
            </div>

            {/* Selector de Bloque Horario (06:00 a 20:00) */}
            <div className="sm:col-span-6 lg:col-span-2">
              <label
                htmlFor="space-time-select"
                className="block text-xs font-bold uppercase tracking-wider text-slate-600"
              >
                Hora (Bogotá)
              </label>
              <select
                id="space-time-select"
                value={catalogFilters.time}
                onChange={(changeEvent) =>
                  updateCatalogFilter('time', changeEvent.target.value)
                }
                className="mt-1.5 w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2.5 text-sm font-medium text-slate-900 focus:border-unal-green focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
              >
                {Array.from(
                  { length: OPERATING_SLOTS_COUNT },
                  (_, slotIndex) => {
                    let slotHour = slotIndex + OPERATING_START_HOUR;
                    let slotTimeLabel = `${String(slotHour).padStart(2, '0')}:00`;
                    return (
                      <option key={slotTimeLabel} value={slotTimeLabel}>
                        {slotTimeLabel} ({slotHour}:00 - {slotHour + 1}:00)
                      </option>
                    );
                  }
                )}
              </select>
            </div>

            {/* Botones de acción de consulta */}
            <div className="flex items-end gap-2 lg:col-span-2">
              <button
                type="submit"
                className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl bg-unal-green px-4 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-unal-dark focus:outline-none focus:ring-2 focus:ring-emerald-600"
              >
                <RefreshCw
                  className={`h-4 w-4 ${isFetching ? 'animate-spin' : ''}`}
                  aria-hidden="true"
                />
                <span>Consultar</span>
              </button>
            </div>
          </div>

          {/* Segunda fila de filtros: Deporte, Tipo de escenario, Cubierta y Estado */}
          <div className="grid grid-cols-1 gap-3 border-t border-slate-100 pt-4 sm:grid-cols-2 lg:grid-cols-5">
            <div>
              <label
                htmlFor="filter-sport"
                className="block text-[11px] font-bold uppercase tracking-wider text-slate-500"
              >
                Disciplina Deportiva
              </label>
              <select
                id="filter-sport"
                value={catalogFilters.sport}
                onChange={(changeEvent) =>
                  updateCatalogFilter('sport', changeEvent.target.value)
                }
                className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-800"
              >
                <option value="ALL">Todos los deportes (5)</option>
                <option value="FUTBOL_11">Fútbol 11</option>
                <option value="FUTBOL_SALA">Fútbol Sala / Microfútbol</option>
                <option value="BALONCESTO">Baloncesto</option>
                <option value="VOLEIBOL">Voleibol</option>
                <option value="TENIS">Tenis de Campo</option>
              </select>
            </div>

            <div>
              <label
                htmlFor="filter-space-type"
                className="block text-[11px] font-bold uppercase tracking-wider text-slate-500"
              >
                Tipo de Escenario
              </label>
              <select
                id="filter-space-type"
                value={catalogFilters.spaceType}
                onChange={(changeEvent) =>
                  updateCatalogFilter('spaceType', changeEvent.target.value)
                }
                className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-800"
              >
                <option value="ALL">Todos los escenarios (12)</option>
                <option value="ESTADIO">Estadio Alfonso López</option>
                <option value="CONCHA_ACUSTICA">Concha Acústica (Ed. 761)</option>
                <option value="CANCHA_TECHADA">Canchas Techadas</option>
                <option value="CANCHA_DESTECHADA">Canchas Destechadas</option>
                <option value="CANCHA_TENIS">Canchas de Tenis</option>
              </select>
            </div>

            <div>
              <label
                htmlFor="filter-roofed"
                className="block text-[11px] font-bold uppercase tracking-wider text-slate-500"
              >
                Condición de Techo
              </label>
              <select
                id="filter-roofed"
                value={catalogFilters.roofed}
                onChange={(changeEvent) =>
                  updateCatalogFilter(
                    'roofed',
                    changeEvent.target.value as CatalogFilters['roofed']
                  )
                }
                className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-800"
              >
                <option value="ALL">Techadas y Destechadas</option>
                <option value="TRUE">Solo Techadas (Cubiertas)</option>
                <option value="FALSE">Solo Destechadas (Aire libre)</option>
              </select>
            </div>

            <div>
              <label
                htmlFor="filter-availability"
                className="block text-[11px] font-bold uppercase tracking-wider text-slate-500"
              >
                Estado de Disponibilidad
              </label>
              <select
                id="filter-availability"
                value={catalogFilters.availability}
                onChange={(changeEvent) =>
                  updateCatalogFilter(
                    'availability',
                    changeEvent.target.value as CatalogFilters['availability']
                  )
                }
                className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-800"
              >
                <option value="ALL">Todos los estados</option>
                <option value="DISPONIBLE">Disponible</option>
                <option value="OCUPADO">Ocupado</option>
                <option value="NO_REGISTRADO">Disponibilidad no registrada</option>
              </select>
            </div>

            <div className="flex items-end">
              <button
                type="button"
                onClick={resetCatalogFilters}
                className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-100"
              >
                <Filter className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Limpiar filtros</span>
              </button>
            </div>
          </div>
        </form>
      </search>

      {/* Resumen de estados en tiempo real */}
      {catalogData && (
        <section
          aria-label="Resumen de disponibilidad de la búsqueda actual"
          className="grid grid-cols-1 gap-4 sm:grid-cols-4"
        >
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Espacios Deportivos
            </p>
            <p className="mt-1 text-2xl font-extrabold text-slate-900">
              {catalogData.totalEspacios}
            </p>
            <p className="mt-0.5 flex items-center gap-1 text-xs text-slate-500">
              <CalendarClock className="h-3.5 w-3.5" aria-hidden="true" />
              <span>
                Horario: {catalogData.fechaConsulta} · {catalogData.horaConsulta}
              </span>
            </p>
          </div>

          <div className="rounded-2xl border border-emerald-200 bg-emerald-50/70 p-4 shadow-sm">
            <p className="text-xs font-bold uppercase tracking-wider text-emerald-800">
              Canchas Disponibles
            </p>
            <p
              data-testid="summary-count-disponible"
              className="mt-1 text-2xl font-extrabold text-emerald-900"
            >
              {catalogData.resumenEstados.disponibles}
            </p>
            <p className="mt-0.5 text-xs text-emerald-700">
              Libres para practicar deporte en esta hora
            </p>
          </div>

          <div className="rounded-2xl border border-red-200 bg-red-50/70 p-4 shadow-sm">
            <p className="text-xs font-bold uppercase tracking-wider text-red-800">
              Canchas Ocupadas
            </p>
            <p
              data-testid="summary-count-ocupado"
              className="mt-1 text-2xl font-extrabold text-red-900"
            >
              {catalogData.resumenEstados.ocupados}
            </p>
            <p className="mt-0.5 text-xs text-red-700">
              Reservadas o en uso en la franja consultada
            </p>
          </div>

          <div className="rounded-2xl border border-amber-200 bg-amber-50/70 p-4 shadow-sm">
            <p className="text-xs font-bold uppercase tracking-wider text-amber-800">
              Sin Horario Registrado
            </p>
            <p
              data-testid="summary-count-no-registrado"
              className="mt-1 text-2xl font-extrabold text-amber-900"
            >
              {catalogData.resumenEstados.noRegistrados}
            </p>
            <p className="mt-0.5 text-xs text-amber-700">
              Espacios con programación especial
            </p>
          </div>
        </section>
      )}

      {/* Estado de carga */}
      {isLoading && (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: SKELETON_CARDS_COUNT }).map(
            (_, skeletonIndex) => (
              <div
                key={skeletonIndex}
                className="h-96 animate-pulse rounded-3xl border border-slate-200 bg-white p-5"
              />
            )
          )}
        </div>
      )}

      {/* Grilla de tarjetas semánticas <article class="card"> */}
      {!isLoading && sportsSpacesList.length === 0 && (
        <div className="rounded-3xl border border-slate-200 bg-white p-12 text-center shadow-sm">
          <p className="text-base font-bold text-slate-800">
            No se encontraron espacios deportivos que coincidan con los filtros seleccionados.
          </p>
          <button
            type="button"
            onClick={resetCatalogFilters}
            className="mt-4 inline-flex items-center gap-2 rounded-xl bg-unal-green px-4 py-2 text-xs font-bold text-white transition hover:bg-unal-dark"
          >
            Mostrar todos los espacios deportivos
          </button>
        </div>
      )}

      <div
        data-testid="spaces-catalog-grid"
        className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3"
      >
        {sportsSpacesList.map((spaceItem) => {
          let hasValidImage =
            Boolean(spaceItem.imagenUrl) && !brokenImagesBySpaceId[spaceItem.id];
          let activeReservation = spaceItem.disponibilidad.reservaActiva;

          return (
            <article
              key={spaceItem.id}
              data-testid={`space-card-${spaceItem.codigoInterno}`}
              onClick={() => {
                if (window.getSelection()?.toString()) {
                  return;
                }
                setSelectedSpaceId(spaceItem.id);
              }}
              className="card group relative flex cursor-pointer flex-col justify-between overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm transition duration-200 hover:-translate-y-1 hover:border-emerald-400 hover:shadow-xl"
            >
              {/* Región 1 (Media): <img> directo o contenedor .media de fallback */}
              {hasValidImage ? (
                <img
                  src={spaceItem.imagenUrl!}
                  alt={`Vista representativa de ${spaceItem.nombre}`}
                  width={1200}
                  height={675}
                  loading="lazy"
                  onError={() =>
                    setBrokenImagesBySpaceId((previousBrokenMap) => ({
                      ...previousBrokenMap,
                      [spaceItem.id]: true,
                    }))
                  }
                  className="w-full border-b border-slate-100 transition-transform duration-300 group-hover:scale-[1.02]"
                />
              ) : (
                <div className="media border-b border-slate-100">
                  <SpaceFallbackImage
                    spaceName={spaceItem.nombre}
                    spaceCode={spaceItem.codigoInterno}
                    compact
                  />
                </div>
              )}

              {/* Región 2 (Header): Código interno grande, Estado de Disponibilidad (REQ-02) y Nombre destacado */}
              <header className="space-y-3 px-5 pt-5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="inline-flex items-center rounded-xl border border-emerald-700/20 bg-slate-900 px-3.5 py-1.5 font-mono text-sm font-extrabold tracking-wider text-white shadow-sm">
                    {spaceItem.codigoInterno}
                  </span>
                  <AvailabilityBadge
                    statusCode={spaceItem.disponibilidad.estadoCodigo}
                    size="md"
                  />
                </div>

                <h3 className="text-lg font-extrabold leading-snug tracking-tight text-slate-900 transition-colors group-hover:text-unal-green sm:text-xl">
                  {spaceItem.nombre}
                </h3>
              </header>

              {/* Región 3 (Content): Ubicación, superficie, deportes y reserva activa */}
              <div className="flex-1 space-y-3.5 px-5 py-4 text-sm text-slate-600">
                <div className="space-y-1.5 rounded-2xl border border-slate-100 bg-slate-50 p-3.5">
                  <p className="flex items-center gap-2 text-sm font-bold text-slate-900">
                    <Building2
                      className="h-4 w-4 shrink-0 text-unal-green"
                      aria-hidden="true"
                    />
                    <span>Edificio / Escenario: {spaceItem.edificio}</span>
                  </p>
                  <p className="flex items-start gap-2 text-xs font-medium text-slate-700 sm:text-sm">
                    <MapPin
                      className="mt-0.5 h-4 w-4 shrink-0 text-unal-green"
                      aria-hidden="true"
                    />
                    <span>{spaceItem.ubicacionRelativa}</span>
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-slate-800">
                  <span className="rounded-lg bg-slate-100 px-2.5 py-1">
                    {spaceItem.esTechado ? 'Techada' : 'Destechada'}
                  </span>
                  <span className="rounded-lg bg-slate-100 px-2.5 py-1">
                    {spaceItem.superficieNombre}
                  </span>
                  <span className="inline-flex items-center gap-1 rounded-lg bg-slate-100 px-2.5 py-1">
                    <Users
                      className="h-3.5 w-3.5 text-unal-green"
                      aria-hidden="true"
                    />
                    Capacidad: {spaceItem.capacidad}
                  </span>
                </div>

                <div>
                  <p className="mb-1.5 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-500">
                    <Trophy
                      className="h-3.5 w-3.5 text-unal-green"
                      aria-hidden="true"
                    />
                    <span>Deportes permitidos:</span>
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {spaceItem.deportesPermitidos.map((sportItem) => (
                      <span
                        key={sportItem.id}
                        className="rounded-lg border border-emerald-200 bg-emerald-50/90 px-2.5 py-1 text-xs font-bold text-emerald-950"
                      >
                        {sportItem.nombre}
                      </span>
                    ))}
                  </div>
                </div>

                {activeReservation && (
                  <div className="rounded-xl border border-red-200 bg-red-50 p-2.5 text-[11px] text-red-900">
                    <p className="font-bold">
                      Reserva activa ({activeReservation.horaInicioLocal} –{' '}
                      {activeReservation.horaFinLocal}):
                    </p>
                    <p className="mt-0.5">
                      {activeReservation.deporteNombre} ·{' '}
                      {activeReservation.estudianteNombre} (
                      {activeReservation.estado})
                    </p>
                  </div>
                )}
              </div>

              {/* Región 4 (Footer): Acción principal con Stretched Link + Acciones secundarias en z-20 */}
              <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 bg-slate-50/70 px-5 py-3.5">
                <button
                  type="button"
                  onClick={(clickEvent) => {
                    clickEvent.stopPropagation();
                    setSelectedSpaceId(spaceItem.id);
                  }}
                  data-testid={`btn-detail-${spaceItem.codigoInterno}`}
                  className="card-primary-trigger inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-slate-900 px-3 py-2 text-xs font-bold text-white transition group-hover:bg-unal-green focus:outline-none focus:ring-2 focus:ring-emerald-600"
                >
                  <Eye className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Ver Detalle y Ubicación</span>
                </button>

                {spaceItem.disponibilidad.estadoCodigo === 'DISPONIBLE' && (
                  <button
                    type="button"
                    disabled={createReservationMutation.isPending}
                    onClick={(clickEvent) => {
                      clickEvent.stopPropagation();
                      reserveSpaceQuickly(spaceItem);
                    }}
                    data-testid={`btn-reserve-${spaceItem.codigoInterno}`}
                    title="Reservar este escenario deportivo en el horario seleccionado"
                    className="relative z-20 inline-flex items-center justify-center gap-1 rounded-xl border border-emerald-300 bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-900 transition hover:bg-emerald-100 disabled:opacity-50"
                  >
                    <PlusCircle
                      className="h-3.5 w-3.5 text-emerald-700"
                      aria-hidden="true"
                    />
                    <span>Reservar ahora</span>
                  </button>
                )}

                {spaceItem.disponibilidad.estadoCodigo === 'OCUPADO' &&
                  activeReservation && (
                    <button
                      type="button"
                      disabled={cancelReservationMutation.isPending}
                      onClick={(clickEvent) => {
                        clickEvent.stopPropagation();
                        cancelReservationQuickly(activeReservation.reservaId);
                      }}
                      data-testid={`btn-cancel-${spaceItem.codigoInterno}`}
                      title="Cancelar reserva y liberar este escenario deportivo"
                      className="relative z-20 inline-flex items-center justify-center gap-1 rounded-xl border border-red-300 bg-red-50 px-3 py-2 text-xs font-bold text-red-900 transition hover:bg-red-100 disabled:opacity-50"
                    >
                      <Trash2
                        className="h-3.5 w-3.5 text-red-700"
                        aria-hidden="true"
                      />
                      <span>Liberar</span>
                    </button>
                  )}

                {spaceItem.disponibilidad.estadoCodigo === 'NO_REGISTRADO' && (
                  <button
                    type="button"
                    onClick={(clickEvent) => {
                      clickEvent.stopPropagation();
                      toggleSpaceRegistrationStatus(spaceItem);
                    }}
                    className="relative z-20 inline-flex items-center justify-center gap-1 rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-xs font-bold text-amber-900 transition hover:bg-amber-100"
                  >
                    <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>Habilitar</span>
                  </button>
                )}
              </footer>
            </article>
          );
        })}
      </div>

      {/* Modal de Detalle y Ubicación del Espacio (SLICE 2: REQ-01) */}
      <SpaceDetailModal
        spaceId={selectedSpaceId}
        selectedDate={catalogFilters.date}
        selectedTime={catalogFilters.time}
        onClose={() => setSelectedSpaceId(null)}
        onSelectInvalidSpaceId={(invalidSpaceId) =>
          setSelectedSpaceId(invalidSpaceId)
        }
      />
    </div>
  );
}

export const SpaceCatalogView = renderSpaceCatalogView;
