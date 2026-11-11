import { Router, Request, Response, NextFunction } from 'express';
import { SPACE_NOT_FOUND_MESSAGE } from '../../shared/constants/app-constants';
import { ApplicationError } from '../../shared/middlewares/error-handler';
import {
  GetSpaceDetailQuery,
  GET_SPACE_DETAIL_QUERY_INSTANCE,
} from './get-space-detail.query';

export const SPACE_NOT_FOUND_ERROR_CODE = 'SPACE_NOT_FOUND';
export const HTTP_NOT_FOUND_STATUS_CODE = 404;

/**
 * Controlador HTTP del Slice `get-space-detail` (SLICE REQ-01: Consultar Detalle y Ubicación de Espacios).
 */
export class GetSpaceDetailController {
  public readonly router: Router;
  private readonly detailQuery: GetSpaceDetailQuery;

  /**
   * Construye el controlador de detalle de espacio y registra sus rutas.
   *
   * @param {GetSpaceDetailQuery} detailQuery Instancia de consulta de detalle a PostgreSQL.
   */
  constructor(
    detailQuery: GetSpaceDetailQuery = GET_SPACE_DETAIL_QUERY_INSTANCE
  ) {
    this.detailQuery = detailQuery;
    this.router = Router();
    this.registerRoutes();
  }

  /**
   * Registra los endpoints del slice `get-space-detail`.
   *
   * @returns {void}
   */
  private registerRoutes(): void {
    this.router.get('/:spaceId', this.getSpaceById.bind(this));
    this.router.patch(
      '/:spaceId/qa-overrides',
      this.updateSpaceQaOverrides.bind(this)
    );
  }

  /**
   * Maneja la petición GET `/api/spaces/:spaceId` para entregar la fotografía representativa,
   * características físicas, deportes permitidos y ubicación de referencia de un espacio deportivo.
   *
   * @param {Request} expressRequest Objeto de petición Express con parámetro `spaceId`.
   * @param {Response} expressResponse Objeto de respuesta Express.
   * @param {NextFunction} nextMiddleware Función para delegar errores al middleware global.
   * @returns {Promise<void>} Envía el detalle del espacio o propaga error 404/503.
   */
  public async getSpaceById(
    expressRequest: Request,
    expressResponse: Response,
    nextMiddleware: NextFunction
  ): Promise<void> {
    try {
      let spaceId = String(expressRequest.params.spaceId || '').trim();
      let dateQueryParameter =
        typeof expressRequest.query.date === 'string'
          ? expressRequest.query.date
          : undefined;
      let timeQueryParameter =
        typeof expressRequest.query.time === 'string'
          ? expressRequest.query.time
          : undefined;

      let spaceDetailResult = await this.detailQuery.findActiveSpaceDetailById(
        spaceId,
        dateQueryParameter,
        timeQueryParameter
      );

      if (!spaceDetailResult) {
        throw new ApplicationError(
          SPACE_NOT_FOUND_MESSAGE,
          HTTP_NOT_FOUND_STATUS_CODE,
          SPACE_NOT_FOUND_ERROR_CODE
        );
      }

      expressResponse.status(200).json({
        success: true,
        data: spaceDetailResult,
      });
    } catch (caughtError) {
      nextMiddleware(caughtError);
    }
  }

  /**
   * Maneja la petición PATCH `/api/spaces/:spaceId/qa-overrides` para alternar la simulación de
   * ausencia de fotografía (CA #3) o ausencia de características físicas (CA #4) en tiempo real.
   *
   * @param {Request} expressRequest Objeto de petición Express.
   * @param {Response} expressResponse Objeto de respuesta Express.
   * @param {NextFunction} nextMiddleware Función de manejo de errores.
   * @returns {Promise<void>} Envía el detalle actualizado del espacio.
   */
  public async updateSpaceQaOverrides(
    expressRequest: Request,
    expressResponse: Response,
    nextMiddleware: NextFunction
  ): Promise<void> {
    try {
      let spaceId = String(expressRequest.params.spaceId || '').trim();
      this.detailQuery.configureSpaceQaOverrides(spaceId, {
        ocultarImagen: expressRequest.body?.ocultarImagen,
        ocultarCaracteristicas: expressRequest.body?.ocultarCaracteristicas,
      });

      let updatedSpaceDetail =
        await this.detailQuery.findActiveSpaceDetailById(spaceId);
      if (!updatedSpaceDetail) {
        throw new ApplicationError(
          SPACE_NOT_FOUND_MESSAGE,
          HTTP_NOT_FOUND_STATUS_CODE,
          SPACE_NOT_FOUND_ERROR_CODE
        );
      }

      expressResponse.status(200).json({
        success: true,
        data: updatedSpaceDetail,
      });
    } catch (caughtError) {
      nextMiddleware(caughtError);
    }
  }
}
