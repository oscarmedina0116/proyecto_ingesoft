import { Request, Response, NextFunction } from 'express';
import {
  API_TIMEOUT_MS,
  AVAILABILITY_CONNECTION_ERROR_MESSAGE,
  DETAIL_CONNECTION_ERROR_MESSAGE,
} from '../constants/app-constants';

export const DETAIL_ROUTE_PATTERN = /^\/api\/spaces\/[^/]+$/;
export const DEFAULT_INTERNAL_ERROR_MESSAGE = 'Error interno del servidor';
export const GIST_OVERLAP_CONSTRAINT_NAME = 'excl_reserva_sin_solapamiento';

/**
 * Clase de error de aplicación tipada para transportar código HTTP y código de negocio.
 */
export class ApplicationError extends Error {
  public readonly statusCode: number;
  public readonly errorCode: string;

  /**
   * Construye una nueva instancia de ApplicationError.
   *
   * @param {string} errorMessage Mensaje descriptivo del error.
   * @param {number} statusCode Código de estado HTTP asociado.
   * @param {string} errorCode Código interno semántico del error.
   */
  constructor(
    errorMessage: string,
    statusCode: number = 500,
    errorCode: string = 'INTERNAL_ERROR'
  ) {
    super(errorMessage);
    this.name = 'ApplicationError';
    this.statusCode = statusCode;
    this.errorCode = errorCode;
  }
}

/**
 * Clase que encapsula los middlewares transversales de manejo de errores y control de timeout (DDR-03).
 */
export class GlobalErrorHandler {
  /**
   * Middleware que aplica el límite de tiempo de respuesta de 10 segundos (DDR-03 / HU-002)
   * y permite simular fallos de red/timeout mediante cabeceras o query params para pruebas de CA #5.
   *
   * @param {Request} expressRequest Objeto de petición Express.
   * @param {Response} expressResponse Objeto de respuesta Express.
   * @param {NextFunction} nextMiddleware Función para continuar la cadena de middlewares.
   * @returns {void} No retorna valor directo; delega al siguiente middleware o responde con error 503.
   */
  public static enforceGatewayTimeout(
    expressRequest: Request,
    expressResponse: Response,
    nextMiddleware: NextFunction
  ): void {
    let shouldSimulateFailure =
      expressRequest.query.simulateError === 'true' ||
      expressRequest.headers['x-simulate-network-error'] === 'true';

    if (shouldSimulateFailure) {
      let isDetailRoute = DETAIL_ROUTE_PATTERN.test(expressRequest.path);
      let toastErrorMessage = isDetailRoute
        ? DETAIL_CONNECTION_ERROR_MESSAGE
        : AVAILABILITY_CONNECTION_ERROR_MESSAGE;

      expressResponse.status(503).json({
        success: false,
        errorCode: 'SERVICE_CONNECTION_ERROR',
        message: toastErrorMessage,
      });
      return;
    }

    expressResponse.setTimeout(API_TIMEOUT_MS, () => {
      if (!expressResponse.headersSent) {
        let isDetailRoute = DETAIL_ROUTE_PATTERN.test(expressRequest.path);
        let toastErrorMessage = isDetailRoute
          ? DETAIL_CONNECTION_ERROR_MESSAGE
          : AVAILABILITY_CONNECTION_ERROR_MESSAGE;

        expressResponse.status(504).json({
          success: false,
          errorCode: 'GATEWAY_TIMEOUT',
          message: toastErrorMessage,
        });
      }
    });

    nextMiddleware();
  }

  /**
   * Middleware centralizado para capturar excepciones de base de datos, validaciones y errores de aplicación.
   *
   * @param {unknown} caughtError Error capturado durante el procesamiento de la petición.
   * @param {Request} expressRequest Objeto de petición Express.
   * @param {Response} expressResponse Objeto de respuesta Express.
   * @param {NextFunction} _nextMiddleware Función siguiente de Express.
   * @returns {void} Envía la respuesta JSON estructurada al cliente.
   */
  public static handleError(
    caughtError: unknown,
    expressRequest: Request,
    expressResponse: Response,
    _nextMiddleware: NextFunction
  ): void {
    if (expressResponse.headersSent) {
      return;
    }

    if (caughtError instanceof ApplicationError) {
      expressResponse.status(caughtError.statusCode).json({
        success: false,
        errorCode: caughtError.errorCode,
        message: caughtError.message,
      });
      return;
    }

    let errorMessage =
      caughtError instanceof Error
        ? caughtError.message
        : DEFAULT_INTERNAL_ERROR_MESSAGE;
    let isDetailRoute =
      DETAIL_ROUTE_PATTERN.test(expressRequest.path) &&
      expressRequest.method === 'GET';

    if (
      errorMessage.includes('[UNAL SPACE]') ||
      errorMessage.includes(GIST_OVERLAP_CONSTRAINT_NAME)
    ) {
      let cleanDatabaseMessage = errorMessage.includes(
        GIST_OVERLAP_CONSTRAINT_NAME
      )
        ? '[UNAL SPACE] Reserva rechazada por PostgreSQL (EXCLUDE USING gist): El espacio ya tiene una reserva activa en ese rango horario.'
        : errorMessage;

      expressResponse.status(409).json({
        success: false,
        errorCode: 'BUSINESS_RULE_VIOLATION',
        message: cleanDatabaseMessage,
      });
      return;
    }

    expressResponse.status(503).json({
      success: false,
      errorCode: 'DATABASE_OR_NETWORK_ERROR',
      message: isDetailRoute
        ? DETAIL_CONNECTION_ERROR_MESSAGE
        : AVAILABILITY_CONNECTION_ERROR_MESSAGE,
      technicalDetail:
        process.env.NODE_ENV === 'development' ? errorMessage : undefined,
    });
  }
}
