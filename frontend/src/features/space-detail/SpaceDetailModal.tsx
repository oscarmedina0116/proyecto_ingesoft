import React, { useEffect, useId, useRef, useState } from 'react';
import {
  AlertOctagon,
  Building2,
  Compass,
  MapPin,
  ShieldCheck,
  Trophy,
  Users,
  X,
} from 'lucide-react';
import {
  ApiServiceError,
  DETAIL_CONNECTION_ERROR_MESSAGE,
  MISSING_CHARACTERISTICS_TEXT,
  SPACE_NOT_FOUND_MESSAGE,
} from '../../shared/api/client';
import { useToast } from '../../shared/components/Toast';
import { AvailabilityBadge } from '../space-availability/AvailabilityBadge';
import { SpaceHourlySlotsGrid } from '../space-availability/SpaceHourlySlotsGrid';
import { SpaceFallbackImage } from './SpaceFallbackImage';
import { useSpaceDetail } from './use-space-detail';

interface SpaceDetailModalProps {
  spaceId: string | null;
  selectedDate?: string;
  selectedTime?: string;
  onClose: () => void;
  onSelectInvalidSpaceId?: (invalidId: string) => void;
}

export const HTTP_NOT_FOUND_STATUS_CODE = 404;

/**
 * Renderiza el componente modal nativo (`<dialog>`) para el Slice `space-detail` (REQ-01: Consultar Detalle y Ubicación).
 * Cumple con los Criterios de Aceptación CA #1 a CA #6 de REQ-01 y las guías de accesibilidad de `<dialog>`.
 *
 * @param {SpaceDetailModalProps} modalProps Propiedades de control del modal de detalle.
 * @returns {React.JSX.Element | null} Elemento `<dialog>` modal o `null` cuando no hay espacio seleccionado.
 */
export function renderSpaceDetailModal({
  spaceId,
  selectedDate,
  selectedTime,
  onClose,
}: SpaceDetailModalProps): React.JSX.Element | null {
  let dialogElementReference = useRef<HTMLDialogElement | null>(null);
  let dialogTitleIdentifier = useId();
  let { showToast } = useToast();

  let [hasImageLoadFailed, setHasImageLoadFailed] = useState<boolean>(false);

  let {
    data: spaceDetailData,
    isLoading,
    isError,
    error: detailError,
  } = useSpaceDetail(spaceId, selectedDate, selectedTime, false);

  useEffect(() => {
    setHasImageLoadFailed(false);
  }, [spaceId]);

  // Si ocurre un error de conexión/timeout (distinto de 404 Espacio No Encontrado),
  // cerramos el modal para que el Toast de error de conexión (CA #5) no quede detrás de una capa inerte.
  useEffect(() => {
    if (isError && detailError) {
      let isNotFoundResponse =
        detailError instanceof ApiServiceError &&
        detailError.statusCode === HTTP_NOT_FOUND_STATUS_CODE;
      if (!isNotFoundResponse) {
        let errorMessage =
          detailError instanceof Error
            ? detailError.message
            : DETAIL_CONNECTION_ERROR_MESSAGE;
        onClose();
        showToast(errorMessage, 'error');
      }
    }
  }, [isError, detailError, onClose, showToast]);

  // Apertura programática con showModal() y soporte de light-dismiss en navegadores sin closedby="any"
  useEffect(() => {
    let dialogNode = dialogElementReference.current;
    if (!dialogNode) {
      return;
    }

    if (spaceId && !dialogNode.open) {
      dialogNode.showModal();
    } else if (!spaceId && dialogNode.open) {
      dialogNode.close();
    }

    if (
      typeof HTMLDialogElement !== 'undefined' &&
      !('closedBy' in HTMLDialogElement.prototype)
    ) {
      let wasPressedOutside = false;
      let checkIsPointerOutsideDialog = (
        pointerEvent: PointerEvent,
        targetDialogElement: HTMLDialogElement
      ): boolean => {
        let dialogBounds = targetDialogElement.getBoundingClientRect();
        return (
          pointerEvent.clientX < dialogBounds.left ||
          pointerEvent.clientX > dialogBounds.right ||
          pointerEvent.clientY < dialogBounds.top ||
          pointerEvent.clientY > dialogBounds.bottom
        );
      };

      let handlePointerDown = (pointerEvent: PointerEvent): void => {
        wasPressedOutside = checkIsPointerOutsideDialog(
          pointerEvent,
          dialogNode
        );
      };

      let handlePointerUp = (pointerEvent: PointerEvent): void => {
        if (
          wasPressedOutside &&
          checkIsPointerOutsideDialog(pointerEvent, dialogNode)
        ) {
          dialogNode.close();
        }
      };

      dialogNode.addEventListener('pointerdown', handlePointerDown);
      dialogNode.addEventListener('pointerup', handlePointerUp);
      return () => {
        dialogNode.removeEventListener('pointerdown', handlePointerDown);
        dialogNode.removeEventListener('pointerup', handlePointerUp);
      };
    }
  }, [spaceId]);

  /**
   * Sincroniza el evento nativo `close` del elemento `<dialog>` (tecla Esc o botón de cierre)
   * y limpia `dialog.returnValue`.
   *
   * @returns {void}
   */
  let closeDetailDialog = (): void => {
    if (dialogElementReference.current) {
      dialogElementReference.current.returnValue = '';
    }
    onClose();
  };

  if (!spaceId) {
    return null;
  }

  let isNotFoundError =
    isError &&
    detailError instanceof ApiServiceError &&
    detailError.statusCode === HTTP_NOT_FOUND_STATUS_CODE;

  let shouldDisplaySpaceImage =
    Boolean(spaceDetailData?.imagenUrl) && !hasImageLoadFailed;

  let hasRegisteredCharacteristics = Boolean(
    spaceDetailData?.caracteristicasFisicas.tieneCaracteristicasRegistradas
  );

  return (
    <dialog
      ref={dialogElementReference}
      aria-labelledby={dialogTitleIdentifier}
      {...({ closedby: 'any' } as any)}
      onClose={closeDetailDialog}
      data-testid="space-detail-dialog"
      className="m-auto max-h-[92vh] w-[95vw] max-w-4xl overflow-hidden rounded-3xl border border-slate-200 bg-white p-0 text-slate-900 shadow-2xl"
    >
      {/* Cabecera del Modal con Isotipo Oficial UNALSpace */}
      <header className="flex items-center justify-between gap-4 border-b border-slate-200 bg-slate-900 px-6 py-4 text-white">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white p-1 shadow-sm">
            <img
              src="/logos/logo-isotipo-cropped.jpg"
              alt="UNALSpace"
              className="h-full w-full object-contain"
            />
          </div>
          <span className="rounded-lg bg-unal-green px-2.5 py-1 font-mono text-xs font-bold uppercase tracking-wider text-white">
            {spaceDetailData?.codigoInterno || 'UNAL'}
          </span>
          <h2 id={dialogTitleIdentifier} className="text-lg font-bold sm:text-xl">
            {isNotFoundError
              ? 'Espacio No Encontrado'
              : spaceDetailData?.nombre ||
                'Cargando detalle del espacio deportivo...'}
          </h2>
        </div>

        <form method="dialog">
          <button
            type="submit"
            value="close"
            autoFocus
            aria-label="Cerrar detalle del espacio"
            className="inline-flex items-center gap-1.5 rounded-xl bg-white/10 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-white/20 focus:outline-none focus:ring-2 focus:ring-emerald-400"
          >
            <X className="h-4 w-4" aria-hidden="true" />
            <span>Cerrar (Esc)</span>
          </button>
        </form>
      </header>

      {/* Cuerpo desplazable con overscroll-behavior: contain */}
      <div className="flex-1 space-y-6 overflow-y-auto p-6">
        {isLoading && (
          <div className="space-y-4 py-12 text-center">
            <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-emerald-600 border-t-transparent" />
            <p className="text-sm font-medium text-slate-600">
              Cargando fotografía representativa, características físicas y ubicación en el campus...
            </p>
          </div>
        )}

        {/* CA #6 (Excepción): Espacio no encontrado o ID inválido */}
        {isNotFoundError && (
          <div
            data-testid="space-not-found-alert"
            className="flex flex-col items-center justify-center rounded-2xl border-2 border-red-200 bg-red-50/80 p-8 text-center"
          >
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-red-100 text-red-700">
              <AlertOctagon className="h-9 w-9" aria-hidden="true" />
            </div>
            <h3 className="mt-4 text-lg font-extrabold text-red-950">
              Espacio No Disponible en el Catálogo
            </h3>
            <p
              data-testid="space-not-found-message"
              className="mt-2 max-w-lg rounded-xl bg-white px-4 py-3 text-base font-bold text-red-900 shadow-sm ring-1 ring-red-200"
            >
              {detailError instanceof Error
                ? detailError.message
                : SPACE_NOT_FOUND_MESSAGE}
            </p>
          </div>
        )}

        {spaceDetailData && !isNotFoundError && (
          <>
            {/* CA #1 y CA #3: Fotografía representativa o Placeholder institucional "Imagen no disponible" */}
            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-900 shadow-md">
              {shouldDisplaySpaceImage ? (
                <img
                  src={spaceDetailData.imagenUrl!}
                  alt={`Fotografía representativa de ${spaceDetailData.nombre}`}
                  width={1200}
                  height={675}
                  onError={() => setHasImageLoadFailed(true)}
                  className="aspect-video w-full object-cover"
                />
              ) : (
                <SpaceFallbackImage
                  spaceName={spaceDetailData.nombre}
                  spaceCode={spaceDetailData.codigoInterno}
                />
              )}
            </div>

            {/* Grid de Características Físicas (CA #1 y CA #4) + Ubicación de Referencia (CA #2) */}
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              {/* Apartado 1: Características Físicas (CA #1 y CA #4) */}
              <section
                aria-label="Características físicas del espacio"
                className="flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
              >
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="flex items-center gap-2 text-base font-bold text-slate-900">
                      <ShieldCheck
                        className="h-5 w-5 text-unal-green"
                        aria-hidden="true"
                      />
                      <span>Características Físicas</span>
                    </h3>
                    <AvailabilityBadge
                      statusCode={
                        spaceDetailData.disponibilidadActual.estadoCodigo
                      }
                      size="sm"
                    />
                  </div>

                  {hasRegisteredCharacteristics ? (
                    <div className="mt-3 space-y-4">
                      <p
                        data-testid="space-characteristics-description"
                        className="text-sm leading-relaxed text-slate-700"
                      >
                        {spaceDetailData.caracteristicasFisicas.descripcionTexto}
                      </p>

                      <dl className="grid grid-cols-2 gap-3 rounded-xl bg-slate-50 p-3.5 text-xs">
                        <div>
                          <dt className="font-medium text-slate-500">
                            Capacidad estimada
                          </dt>
                          <dd className="mt-0.5 flex items-center gap-1.5 font-bold text-slate-900">
                            <Users
                              className="h-4 w-4 text-unal-green"
                              aria-hidden="true"
                            />
                            <span>
                              {spaceDetailData.caracteristicasFisicas.capacidad}{' '}
                              personas
                            </span>
                          </dd>
                        </div>

                        <div>
                          <dt className="font-medium text-slate-500">
                            Condición de cubierta
                          </dt>
                          <dd className="mt-0.5 font-bold text-slate-900">
                            {
                              spaceDetailData.caracteristicasFisicas
                                .coberturaTexto
                            }
                          </dd>
                        </div>

                        <div>
                          <dt className="font-medium text-slate-500">
                            Superficie de juego
                          </dt>
                          <dd className="mt-0.5 font-bold text-slate-900">
                            {
                              spaceDetailData.caracteristicasFisicas
                                .superficieNombre
                            }
                          </dd>
                        </div>

                        <div>
                          <dt className="font-medium text-slate-500">
                            Clasificación
                          </dt>
                          <dd className="mt-0.5 font-bold text-slate-900">
                            {spaceDetailData.tipoNombre}
                          </dd>
                        </div>
                      </dl>
                    </div>
                  ) : (
                    /* CA #4 (Alternativa): Datos incompletos */
                    <div
                      data-testid="missing-characteristics-box"
                      className="mt-4 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm font-bold text-amber-950"
                    >
                      {MISSING_CHARACTERISTICS_TEXT}
                    </div>
                  )}
                </div>

                {/* Deportes permitidos */}
                <div className="mt-5 border-t border-slate-100 pt-4">
                  <h4 className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-500">
                    <Trophy
                      className="h-3.5 w-3.5 text-unal-green"
                      aria-hidden="true"
                    />
                    <span>Deportes Permitidos en este Escenario</span>
                  </h4>
                  <ul className="mt-2 flex flex-wrap gap-2">
                    {spaceDetailData.caracteristicasFisicas.deportesPermitidos.map(
                      (permittedSportItem) => (
                        <li
                          key={permittedSportItem.id}
                          className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-900"
                        >
                          {permittedSportItem.nombre}
                        </li>
                      )
                    )}
                  </ul>
                </div>
              </section>

              {/* Apartado 2: Ubicación de Referencia en el Campus (CA #2) */}
              <section
                aria-label="Ubicación física y relativa dentro del campus"
                className="flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
              >
                <div className="space-y-4">
                  <h3 className="flex items-center gap-2 text-base font-bold text-slate-900">
                    <MapPin
                      className="h-5 w-5 text-unal-green"
                      aria-hidden="true"
                    />
                    <span>Ubicación de Referencia en el Campus</span>
                  </h3>

                  <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-4">
                    <div className="flex items-start gap-3">
                      <Building2
                        className="mt-0.5 h-5 w-5 shrink-0 text-unal-green"
                        aria-hidden="true"
                      />
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wider text-emerald-800">
                          Edificio / Escenario Deportivo
                        </p>
                        <p
                          data-testid="space-building-name"
                          className="mt-0.5 text-base font-extrabold text-slate-900"
                        >
                          {spaceDetailData.ubicacionReferencia.edificio}
                        </p>
                      </div>
                    </div>

                    <div className="mt-4 flex items-start gap-3 border-t border-emerald-200/70 pt-3">
                      <Compass
                        className="mt-0.5 h-5 w-5 shrink-0 text-unal-green"
                        aria-hidden="true"
                      />
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wider text-emerald-800">
                          Ubicación Relativa (Sede Bogotá)
                        </p>
                        <p
                          data-testid="space-relative-location"
                          className="mt-0.5 text-sm font-medium text-slate-800"
                        >
                          {
                            spaceDetailData.ubicacionReferencia
                              .ubicacionRelativa
                          }
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mt-4 rounded-xl bg-slate-100 p-3.5 text-xs text-slate-600">
                  <p className="font-semibold text-slate-800">
                    Referencia de orientación estudiantil:
                  </p>
                  <p className="mt-1">
                    {spaceDetailData.ubicacionReferencia.referenciaCompleta}
                  </p>
                </div>
              </section>
            </div>

            {/* Integración reactiva con SLICE 1 (REQ-02): Grilla de 15 franjas horarias */}
            <SpaceHourlySlotsGrid
              spaceId={spaceDetailData.id}
              selectedDate={selectedDate}
              selectedTime={selectedTime}
            />
          </>
        )}
      </div>
    </dialog>
  );
}

export const SpaceDetailModal = renderSpaceDetailModal;
