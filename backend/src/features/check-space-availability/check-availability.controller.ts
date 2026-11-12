import { Router, Request, Response, NextFunction } from 'express';
import { prisma } from '../../shared/database/prisma';
import {
  CHECK_AVAILABILITY_QUERY_SCHEMA,
  SPACE_DAILY_SLOTS_PARAMS_SCHEMA,
} from './check-availability.dto';
import {
  CheckAvailabilityService,
  CHECK_AVAILABILITY_SERVICE_INSTANCE,
} from './check-availability.service';

export const DEFAULT_DEMO_STUDENT_ID =
  'c0000000-0000-4ccc-cccc-000000000001';

/**
 * Controlador HTTP del Slice `check-space-availability` (REQ-02: Consultar Disponibilidad de Espacios).
 */
export class CheckAvailabilityController {
  public readonly router: Router;
  private readonly availabilityService: CheckAvailabilityService;

  /**
   * Inicializa el controlador y registra las rutas del slice de disponibilidad.
   *
   * @param {CheckAvailabilityService} availabilityService Servicio de cálculo de disponibilidad.
   */
  constructor(
    availabilityService: CheckAvailabilityService = CHECK_AVAILABILITY_SERVICE_INSTANCE
  ) {
    this.availabilityService = availabilityService;
    this.router = Router();
    this.registerRoutes();
  }

  /**
   * Registra los endpoints REST pertenecientes al slice `check-space-availability`.
   *
   * @returns {void}
   */
  private registerRoutes(): void {
    this.router.get('/', this.checkAllSpacesAvailability.bind(this));
    this.router.get('/:spaceId/slots', this.getSpaceHourlySlots.bind(this));
    this.router.post(
      '/reservations',
      this.createQuickReservation.bind(this)
    );
    this.router.patch(
      '/reservations/:reservaId/cancel',
      this.cancelActiveReservation.bind(this)
    );
    this.router.patch(
      '/:spaceId/registration-status',
      this.toggleAvailabilityRegistration.bind(this)
    );
  }

  /**
   * Maneja la petición GET `/api/availability` para consultar en tiempo real el estado
   * ("Disponible", "Ocupado" o "Disponibilidad no registrada") de los espacios deportivos.
   *
   * @param {Request} expressRequest Objeto de petición Express con filtros opcionales (`search`, `date`, `time`).
   * @param {Response} expressResponse Objeto de respuesta Express.
   * @param {NextFunction} nextMiddleware Función para delegar errores al middleware global.
   * @returns {Promise<void>} Envía el resultado del cálculo de disponibilidad en formato JSON.
   */
  public async checkAllSpacesAvailability(
    expressRequest: Request,
    expressResponse: Response,
    nextMiddleware: NextFunction
  ): Promise<void> {
    try {
      let parsedQuery = CHECK_AVAILABILITY_QUERY_SCHEMA.parse(
        expressRequest.query
      );
      let searchFilterText = parsedQuery.search.trim();

      let activeSpacesList = await prisma.espacioDeportivo.findMany({
        where: {
          activo: true,
          ...(searchFilterText
            ? {
                OR: [
                  {
                    nombre: {
                      contains: searchFilterText,
                      mode: 'insensitive',
                    },
                  },
                  {
                    codigoInterno: {
                      contains: searchFilterText,
                      mode: 'insensitive',
                    },
                  },
                  {
                    ubicacion: {
                      contains: searchFilterText,
                      mode: 'insensitive',
                    },
                  },
                ],
              }
            : {}),
        },
        select: {
          id: true,
          codigoInterno: true,
          nombre: true,
        },
        orderBy: {
          codigoInterno: 'asc',
        },
      });

      let batchAvailabilityResult =
        await this.availabilityService.calculateBatchAvailability(
          activeSpacesList,
          parsedQuery.date,
          parsedQuery.time
        );

      expressResponse.status(200).json({
        success: true,
        instanteConsulta: batchAvailabilityResult.instanteConsulta,
        fechaConsulta: batchAvailabilityResult.fechaConsulta,
        horaConsulta: batchAvailabilityResult.horaConsulta,
        totalEspacios: activeSpacesList.length,
        resultados: Array.from(batchAvailabilityResult.estados.values()),
      });
    } catch (caughtError) {
      nextMiddleware(caughtError);
    }
  }

  /**
   * Maneja la petición GET `/api/availability/:spaceId/slots` para obtener las 15 franjas horarias
   * del día invocando `fn_disponibilidad_espacio` en PostgreSQL 16+.
   *
   * @param {Request} expressRequest Objeto de petición Express con `spaceId` y query `date`, `time`.
   * @param {Response} expressResponse Objeto de respuesta Express.
   * @param {NextFunction} nextMiddleware Función de manejo de errores.
   * @returns {Promise<void>} Envía las 15 franjas horarias y el estado actual del espacio.
   */
  public async getSpaceHourlySlots(
    expressRequest: Request,
    expressResponse: Response,
    nextMiddleware: NextFunction
  ): Promise<void> {
    try {
      let { spaceId } = SPACE_DAILY_SLOTS_PARAMS_SCHEMA.parse(
        expressRequest.params
      );
      let dateQueryParameter =
        typeof expressRequest.query.date === 'string'
          ? expressRequest.query.date
          : undefined;
      let timeQueryParameter =
        typeof expressRequest.query.time === 'string'
          ? expressRequest.query.time
          : undefined;

      let dailyAvailabilityResult =
        await this.availabilityService.getSpaceDailyAvailability(
          spaceId,
          dateQueryParameter,
          timeQueryParameter
        );

      expressResponse.status(200).json({
        success: true,
        data: dailyAvailabilityResult,
      });
    } catch (caughtError) {
      nextMiddleware(caughtError);
    }
  }

  /**
   * Maneja la petición POST `/api/availability/reservations` para registrar una reserva en PostgreSQL
   * y verificar la sincronización inmediata de estado a "Ocupado".
   *
   * @param {Request} expressRequest Objeto de petición Express con los datos de la reserva.
   * @param {Response} expressResponse Objeto de respuesta Express.
   * @param {NextFunction} nextMiddleware Función de manejo de errores.
   * @returns {Promise<void>} Envía la confirmación de la reserva creada.
   */
  public async createQuickReservation(
    expressRequest: Request,
    expressResponse: Response,
    nextMiddleware: NextFunction
  ): Promise<void> {
    try {
      let currentUsuarioId =
        expressRequest.institutionalUser?.usuarioId || DEFAULT_DEMO_STUDENT_ID;
      let createdReservationResult =
        await this.availabilityService.createSynchronizationReservation(
          expressRequest.body,
          currentUsuarioId
        );

      expressResponse.status(201).json({
        success: true,
        data: createdReservationResult,
      });
    } catch (caughtError) {
      nextMiddleware(caughtError);
    }
  }

  /**
   * Maneja la petición PATCH `/api/availability/reservations/:reservaId/cancel` para cancelar
   * una reserva activa en PostgreSQL y reflejar inmediatamente el estado "Disponible".
   *
   * @param {Request} expressRequest Objeto de petición Express con `reservaId`.
   * @param {Response} expressResponse Objeto de respuesta Express.
   * @param {NextFunction} nextMiddleware Función de manejo de errores.
   * @returns {Promise<void>} Envía confirmación de la cancelación.
   */
  public async cancelActiveReservation(
    expressRequest: Request,
    expressResponse: Response,
    nextMiddleware: NextFunction
  ): Promise<void> {
    try {
      let reservationId = String(expressRequest.params.reservaId);
      let cancelledReservationResult =
        await this.availabilityService.cancelSynchronizationReservation(
          reservationId
        );

      expressResponse.status(200).json({
        success: true,
        data: cancelledReservationResult,
      });
    } catch (caughtError) {
      nextMiddleware(caughtError);
    }
  }

  /**
   * Maneja la petición PATCH `/api/availability/:spaceId/registration-status` para alternar
   * el registro de disponibilidad de un espacio y verificar el CA #4 ("Disponibilidad no registrada").
   *
   * @param {Request} expressRequest Objeto de petición Express con `spaceId` y `{ gestionaDisponibilidad: boolean }`.
   * @param {Response} expressResponse Objeto de respuesta Express.
   * @param {NextFunction} nextMiddleware Función de manejo de errores.
   * @returns {Promise<void>} Envía el nuevo estado de gestión de disponibilidad del espacio.
   */
  public async toggleAvailabilityRegistration(
    expressRequest: Request,
    expressResponse: Response,
    nextMiddleware: NextFunction
  ): Promise<void> {
    try {
      let { spaceId } = SPACE_DAILY_SLOTS_PARAMS_SCHEMA.parse(
        expressRequest.params
      );
      let isRegisteredStatus = Boolean(
        expressRequest.body?.gestionaDisponibilidad
      );

      let updatedRegistrationStatus =
        this.availabilityService.toggleSpaceAvailabilityRegistration(
          spaceId,
          isRegisteredStatus
        );

      expressResponse.status(200).json({
        success: true,
        data: updatedRegistrationStatus,
      });
    } catch (caughtError) {
      nextMiddleware(caughtError);
    }
  }
}
