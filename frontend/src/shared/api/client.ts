/**
 * @file client.ts
 * @description Cliente HTTP transversal con control de timeout de 10 segundos (DDR-03)
 * y manejo de token institucional JWT (@unal.edu.co) (DDR-04).
 */

export const API_BASE_URL = '/api';

export const API_TIMEOUT_MS = 10000;

export const DEFAULT_FALLBACK_IMAGE = '/images/unal-fallback-space.svg';

export const MISSING_IMAGE_TEXT = 'Imagen no disponible';

export const MISSING_CHARACTERISTICS_TEXT = 'Características físicas aún no registradas';

export const SPACE_NOT_FOUND_MESSAGE = 'El espacio solicitado no existe o fue retirado del sistema.';

export const AVAILABILITY_CONNECTION_ERROR_MESSAGE =
  'Error de conexión. No se pudo cargar el estado de disponibilidad. Revisa tu conexión a internet e inténtalo nuevamente.';

export const DETAIL_CONNECTION_ERROR_MESSAGE =
  'Error de conexión. No se pudo cargar la información detallada del espacio. Revisa tu conexión a internet e inténtalo nuevamente.';

export const AVAILABLE_STATUS_TEXT = 'Disponible';

export const OCCUPIED_STATUS_TEXT = 'Ocupado';

export const UNREGISTERED_AVAILABILITY_TEXT = 'Disponibilidad no registrada';

export const STORAGE_TOKEN_KEY = 'UNAL_SPACE_JWT_TOKEN';

export const DEFAULT_HTTP_ERROR_STATUS = 503;

export const DEFAULT_NETWORK_ERROR_CODE = 'NETWORK_ERROR';

export const CONNECTION_TIMEOUT_ERROR_CODE = 'CONNECTION_OR_TIMEOUT_ERROR';

/**
 * Error tipado para respuestas de la API o interrupciones de red/timeout.
 */
export class ApiServiceError extends Error {
  public readonly statusCode: number;
  public readonly errorCode: string;

  /**
   * Construye una nueva instancia de ApiServiceError.
   *
   * @param {string} errorMessage Mensaje descriptivo del error para el usuario.
   * @param {number} statusCode Código de estado HTTP.
   * @param {string} errorCode Código interno del error.
   */
  constructor(
    errorMessage: string,
    statusCode: number = DEFAULT_HTTP_ERROR_STATUS,
    errorCode: string = DEFAULT_NETWORK_ERROR_CODE
  ) {
    super(errorMessage);
    this.name = 'ApiServiceError';
    this.statusCode = statusCode;
    this.errorCode = errorCode;
  }
}

/**
 * Clase cliente HTTP para comunicarse con el API Gateway de UNALSpace.
 */
export class ApiClient {
  private static activeAuthToken: string | null =
    typeof window !== 'undefined'
      ? window.localStorage.getItem(STORAGE_TOKEN_KEY)
      : null;

  /**
   * Obtiene el token JWT institucional almacenado en la sesión actual.
   *
   * @returns {string | null} Token JWT activo o `null` si aún no se ha establecido.
   */
  public static getAuthToken(): string | null {
    return ApiClient.activeAuthToken;
  }

  /**
   * Almacena el token JWT institucional del estudiante de la UNAL.
   *
   * @param {string | null} institutionalToken Token JWT firmado por el servidor.
   * @returns {void}
   */
  public static setAuthToken(institutionalToken: string | null): void {
    ApiClient.activeAuthToken = institutionalToken;
    if (typeof window !== 'undefined') {
      if (institutionalToken) {
        window.localStorage.setItem(STORAGE_TOKEN_KEY, institutionalToken);
      } else {
        window.localStorage.removeItem(STORAGE_TOKEN_KEY);
      }
    }
  }

  /**
   * Ejecuta una petición HTTP hacia el backend aplicando el límite estricto de 10 segundos (DDR-03)
   * y adjuntando el token JWT institucional.
   *
   * @template T Tipo de respuesta esperada.
   * @param {string} endpointPath Ruta relativa del endpoint (ej. `/spaces`).
   * @param {RequestInit & { fallbackErrorMessage?: string }} [requestOptions] Opciones de configuración de fetch.
   * @returns {Promise<T>} Promesa con el cuerpo JSON tipado de la respuesta.
   */
  public static async requestJson<T>(
    endpointPath: string,
    requestOptions: RequestInit & { fallbackErrorMessage?: string } = {}
  ): Promise<T> {
    let abortController = new AbortController();
    let timeoutIdentifier = window.setTimeout(
      () => abortController.abort(),
      API_TIMEOUT_MS
    );

    let requestHeaders = new Headers(requestOptions.headers || {});
    if (!requestHeaders.has('Content-Type') && requestOptions.body) {
      requestHeaders.set('Content-Type', 'application/json');
    }

    if (ApiClient.activeAuthToken) {
      requestHeaders.set('Authorization', `Bearer ${ApiClient.activeAuthToken}`);
    }

    let fallbackMessage =
      requestOptions.fallbackErrorMessage || AVAILABILITY_CONNECTION_ERROR_MESSAGE;

    try {
      let httpResponse = await fetch(`${API_BASE_URL}${endpointPath}`, {
        ...requestOptions,
        headers: requestHeaders,
        signal: abortController.signal,
      });

      if (httpResponse.status === 401 && ApiClient.activeAuthToken) {
        ApiClient.setAuthToken(null);
        requestHeaders.delete('Authorization');
        httpResponse = await fetch(`${API_BASE_URL}${endpointPath}`, {
          ...requestOptions,
          headers: requestHeaders,
          signal: abortController.signal,
        });
      }

      let contentTypeHeader = httpResponse.headers.get('content-type') || '';
      let responsePayload = contentTypeHeader.includes('application/json')
        ? await httpResponse.json()
        : null;

      if (!httpResponse.ok) {
        let serverErrorMessage = responsePayload?.message || fallbackMessage;
        let serverErrorCode = responsePayload?.errorCode || 'HTTP_ERROR';
        throw new ApiServiceError(
          serverErrorMessage,
          httpResponse.status,
          serverErrorCode
        );
      }

      return responsePayload as T;
    } catch (caughtError) {
      if (caughtError instanceof ApiServiceError) {
        throw caughtError;
      }

      throw new ApiServiceError(
        fallbackMessage,
        DEFAULT_HTTP_ERROR_STATUS,
        CONNECTION_TIMEOUT_ERROR_CODE
      );
    } finally {
      window.clearTimeout(timeoutIdentifier);
    }
  }
}
