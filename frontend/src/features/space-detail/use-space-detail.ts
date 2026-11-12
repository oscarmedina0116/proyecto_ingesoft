import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ApiClient,
  DETAIL_CONNECTION_ERROR_MESSAGE,
} from '../../shared/api/client';
import { SpaceDetailData } from './space-detail.types';

export const SPACE_DETAIL_QUERY_KEY = 'space-detail';
export const SPORTS_SPACES_CATALOG_QUERY_KEY = 'sports-spaces-catalog';
export const SPACES_API_BASE_PATH = '/spaces';
export const SIMULATE_ERROR_QUERY_VALUE = 'true';

/**
 * Servicio del Slice `space-detail` para consultar el detalle y ubicación de espacios deportivos.
 */
export class SpaceDetailService {
  /**
   * Obtiene el detalle completo y la ubicación de un espacio deportivo por su identificador.
   *
   * @param {string} spaceId Identificador UUID del espacio deportivo.
   * @param {string} [queryDate] Fecha de consulta en formato YYYY-MM-DD.
   * @param {string} [queryTime] Hora de consulta en formato HH:MM.
   * @param {boolean} [shouldSimulateError] Indica si se debe simular un fallo de conexión.
   * @returns {Promise<SpaceDetailData>} Datos detallados del espacio deportivo.
   */
  public static async getSpaceDetailById(
    spaceId: string,
    queryDate?: string,
    queryTime?: string,
    shouldSimulateError: boolean = false
  ): Promise<SpaceDetailData> {
    let searchParameters = new URLSearchParams();
    if (queryDate) {
      searchParameters.set('date', queryDate);
    }
    if (queryTime) {
      searchParameters.set('time', queryTime);
    }
    if (shouldSimulateError) {
      searchParameters.set('simulateError', SIMULATE_ERROR_QUERY_VALUE);
    }

    let queryString = searchParameters.toString();
    let encodedSpaceId = encodeURIComponent(spaceId);
    let requestEndpoint = `${SPACES_API_BASE_PATH}/${encodedSpaceId}${
      queryString ? `?${queryString}` : ''
    }`;

    let apiResponse = await ApiClient.requestJson<{
      success: boolean;
      data: SpaceDetailData;
    }>(requestEndpoint, {
      fallbackErrorMessage: DETAIL_CONNECTION_ERROR_MESSAGE,
    });

    return apiResponse.data;
  }

  /**
   * Actualiza las opciones de prueba de imagen o características físicas de un espacio deportivo.
   *
   * @param {{ spaceId: string; ocultarImagen?: boolean; ocultarCaracteristicas?: boolean }} overrideParameters Parámetros de actualización.
   * @returns {Promise<SpaceDetailData>} Detalle actualizado del espacio deportivo.
   */
  public static async updateSpaceQaOverrides(overrideParameters: {
    spaceId: string;
    ocultarImagen?: boolean;
    ocultarCaracteristicas?: boolean;
  }): Promise<SpaceDetailData> {
    let encodedSpaceId = encodeURIComponent(overrideParameters.spaceId);
    let requestEndpoint = `${SPACES_API_BASE_PATH}/${encodedSpaceId}/qa-overrides`;

    let apiResponse = await ApiClient.requestJson<{
      success: boolean;
      data: SpaceDetailData;
    }>(requestEndpoint, {
      method: 'PATCH',
      body: JSON.stringify({
        ocultarImagen: overrideParameters.ocultarImagen,
        ocultarCaracteristicas: overrideParameters.ocultarCaracteristicas,
      }),
      fallbackErrorMessage: DETAIL_CONNECTION_ERROR_MESSAGE,
    });

    return apiResponse.data;
  }
}

/**
 * Hook de TanStack Query para consultar el detalle completo y ubicación de un espacio deportivo (REQ-01).
 *
 * @param {string | null} spaceId Identificador del espacio deportivo a consultar.
 * @param {string} [queryDate] Fecha opcional en formato YYYY-MM-DD.
 * @param {string} [queryTime] Hora opcional en formato HH:MM.
 * @param {boolean} [shouldSimulateError] Bandera opcional para probar fallo de conexión/timeout (CA #5).
 * @returns {ReturnType<typeof useQuery<SpaceDetailData>>} Estado reactivo de la consulta de detalle.
 */
export function useSpaceDetail(
  spaceId: string | null,
  queryDate?: string,
  queryTime?: string,
  shouldSimulateError: boolean = false
) {
  return useQuery<SpaceDetailData>({
    queryKey: [
      SPACE_DETAIL_QUERY_KEY,
      spaceId,
      queryDate,
      queryTime,
      shouldSimulateError,
    ],
    enabled: Boolean(spaceId),
    retry: false,
    queryFn: async () => {
      return SpaceDetailService.getSpaceDetailById(
        spaceId || '',
        queryDate,
        queryTime,
        shouldSimulateError
      );
    },
  });
}

/**
 * Hook de mutación para alternar las pruebas de flujos alternativos en el detalle de un espacio.
 *
 * @returns {ReturnType<typeof useMutation>} Mutación reactiva de overrides QA.
 */
export function useUpdateSpaceQaOverridesMutation() {
  let queryClientInstance = useQueryClient();

  return useMutation({
    mutationFn: async (overrideParameters: {
      spaceId: string;
      ocultarImagen?: boolean;
      ocultarCaracteristicas?: boolean;
    }) => {
      return SpaceDetailService.updateSpaceQaOverrides(overrideParameters);
    },
    onSuccess: () => {
      queryClientInstance.invalidateQueries({
        queryKey: [SPACE_DETAIL_QUERY_KEY],
      });
      queryClientInstance.invalidateQueries({
        queryKey: [SPORTS_SPACES_CATALOG_QUERY_KEY],
      });
    },
  });
}
