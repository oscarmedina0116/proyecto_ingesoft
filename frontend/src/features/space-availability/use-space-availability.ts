import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ApiClient,
  AVAILABILITY_CONNECTION_ERROR_MESSAGE,
} from '../../shared/api/client';
import { SpaceDailyAvailabilityData } from './space-availability.types';

export const SPACE_DAILY_AVAILABILITY_QUERY_KEY = 'space-daily-availability';
export const SPORTS_SPACES_CATALOG_QUERY_KEY = 'sports-spaces-catalog';
export const SPACE_DETAIL_QUERY_KEY = 'space-detail';
export const AVAILABILITY_API_BASE_PATH = '/availability';
export const RESERVATIONS_ENDPOINT_PATH = '/availability/reservations';

/**
 * Servicio del Slice `space-availability` para consultar franjas horarias y gestionar reservas.
 */
export class SpaceAvailabilityService {
  /**
   * Consulta las 15 franjas horarias del día y el estado en tiempo real de un espacio deportivo.
   *
   * @param {string} spaceId UUID del espacio deportivo a consultar.
   * @param {string} [queryDate] Fecha opcional en formato YYYY-MM-DD.
   * @param {string} [queryTime] Hora opcional en formato HH:MM.
   * @returns {Promise<SpaceDailyAvailabilityData>} Datos de disponibilidad diaria y franjas horarias.
   */
  public static async getSpaceDailyAvailability(
    spaceId: string,
    queryDate?: string,
    queryTime?: string
  ): Promise<SpaceDailyAvailabilityData> {
    let searchParameters = new URLSearchParams();
    if (queryDate) {
      searchParameters.set('date', queryDate);
    }
    if (queryTime) {
      searchParameters.set('time', queryTime);
    }

    let queryString = searchParameters.toString();
    let requestEndpoint = `${AVAILABILITY_API_BASE_PATH}/${spaceId}/slots${
      queryString ? `?${queryString}` : ''
    }`;

    let apiResponse = await ApiClient.requestJson<{
      success: boolean;
      data: SpaceDailyAvailabilityData;
    }>(requestEndpoint, {
      fallbackErrorMessage: AVAILABILITY_CONNECTION_ERROR_MESSAGE,
    });

    return apiResponse.data;
  }

  /**
   * Crea una reserva para un espacio deportivo y sincroniza su estado a "Ocupado".
   *
   * @param {{ espacioId: string; fecha?: string; horaInicio?: string; duracionMinutos?: number; disciplinaCodigo?: string }} reservationPayload Datos de la reserva.
   * @returns {Promise<{ reservaId: string; mensaje: string; fechaInicio: string; fechaFin: string }>} Confirmación de la reserva creada.
   */
  public static async createSpaceReservation(reservationPayload: {
    espacioId: string;
    fecha?: string;
    horaInicio?: string;
    duracionMinutos?: number;
    disciplinaCodigo?: string;
  }): Promise<{
    reservaId: string;
    mensaje: string;
    fechaInicio: string;
    fechaFin: string;
  }> {
    let apiResponse = await ApiClient.requestJson<{
      success: boolean;
      data: {
        reservaId: string;
        mensaje: string;
        fechaInicio: string;
        fechaFin: string;
      };
    }>(RESERVATIONS_ENDPOINT_PATH, {
      method: 'POST',
      body: JSON.stringify(reservationPayload),
      fallbackErrorMessage: AVAILABILITY_CONNECTION_ERROR_MESSAGE,
    });

    return apiResponse.data;
  }

  /**
   * Cancela una reserva activa para liberar el espacio deportivo a estado "Disponible".
   *
   * @param {string} reservationId UUID de la reserva a cancelar.
   * @returns {Promise<{ cancelada: boolean; mensaje: string }>} Confirmación de la cancelación.
   */
  public static async cancelSpaceReservation(
    reservationId: string
  ): Promise<{ cancelada: boolean; mensaje: string }> {
    let requestEndpoint = `${RESERVATIONS_ENDPOINT_PATH}/${reservationId}/cancel`;

    let apiResponse = await ApiClient.requestJson<{
      success: boolean;
      data: { cancelada: boolean; mensaje: string };
    }>(requestEndpoint, {
      method: 'PATCH',
      fallbackErrorMessage: AVAILABILITY_CONNECTION_ERROR_MESSAGE,
    });

    return apiResponse.data;
  }

  /**
   * Alterna el estado de registro de disponibilidad de un espacio deportivo.
   *
   * @param {{ spaceId: string; gestionaDisponibilidad: boolean }} registrationParameters Parámetros de configuración.
   * @returns {Promise<{ espacioId: string; gestionaDisponibilidad: boolean; estadoTexto: string }>} Estado actualizado.
   */
  public static async updateAvailabilityRegistration(registrationParameters: {
    spaceId: string;
    gestionaDisponibilidad: boolean;
  }): Promise<{
    espacioId: string;
    gestionaDisponibilidad: boolean;
    estadoTexto: string;
  }> {
    let requestEndpoint = `${AVAILABILITY_API_BASE_PATH}/${registrationParameters.spaceId}/registration-status`;

    let apiResponse = await ApiClient.requestJson<{
      success: boolean;
      data: {
        espacioId: string;
        gestionaDisponibilidad: boolean;
        estadoTexto: string;
      };
    }>(requestEndpoint, {
      method: 'PATCH',
      body: JSON.stringify({
        gestionaDisponibilidad: registrationParameters.gestionaDisponibilidad,
      }),
      fallbackErrorMessage: AVAILABILITY_CONNECTION_ERROR_MESSAGE,
    });

    return apiResponse.data;
  }
}

/**
 * Hook de TanStack Query para consultar las 15 franjas horarias del día
 * y el estado en tiempo real de un espacio deportivo.
 *
 * @param {string | null} spaceId UUID del espacio deportivo a consultar.
 * @param {string} [queryDate] Fecha opcional en formato YYYY-MM-DD.
 * @param {string} [queryTime] Hora opcional en formato HH:MM.
 * @returns {ReturnType<typeof useQuery<SpaceDailyAvailabilityData>>} Estado reactivo de la consulta.
 */
export function useSpaceDailyAvailability(
  spaceId: string | null,
  queryDate?: string,
  queryTime?: string
) {
  return useQuery<SpaceDailyAvailabilityData>({
    queryKey: [
      SPACE_DAILY_AVAILABILITY_QUERY_KEY,
      spaceId,
      queryDate,
      queryTime,
    ],
    enabled: Boolean(spaceId),
    retry: false,
    queryFn: async () => {
      return SpaceAvailabilityService.getSpaceDailyAvailability(
        spaceId || '',
        queryDate,
        queryTime
      );
    },
  });
}

/**
 * Hook de mutación para crear una reserva y sincronizar inmediatamente
 * el estado del espacio deportivo a "Ocupado" en toda la interfaz.
 *
 * @returns {ReturnType<typeof useMutation>} Mutación reactiva para crear reserva.
 */
export function useCreateReservationMutation() {
  let queryClientInstance = useQueryClient();

  return useMutation({
    mutationFn: async (reservationPayload: {
      espacioId: string;
      fecha?: string;
      horaInicio?: string;
      duracionMinutos?: number;
      disciplinaCodigo?: string;
    }) => {
      return SpaceAvailabilityService.createSpaceReservation(reservationPayload);
    },
    onSuccess: () => {
      queryClientInstance.invalidateQueries({
        queryKey: [SPORTS_SPACES_CATALOG_QUERY_KEY],
      });
      queryClientInstance.invalidateQueries({
        queryKey: [SPACE_DAILY_AVAILABILITY_QUERY_KEY],
      });
      queryClientInstance.invalidateQueries({
        queryKey: [SPACE_DETAIL_QUERY_KEY],
      });
    },
  });
}

/**
 * Hook de mutación para cancelar una reserva activa y sincronizar inmediatamente
 * el estado del espacio deportivo a "Disponible".
 *
 * @returns {ReturnType<typeof useMutation>} Mutación reactiva para cancelar reserva.
 */
export function useCancelReservationMutation() {
  let queryClientInstance = useQueryClient();

  return useMutation({
    mutationFn: async (reservationId: string) => {
      return SpaceAvailabilityService.cancelSpaceReservation(reservationId);
    },
    onSuccess: () => {
      queryClientInstance.invalidateQueries({
        queryKey: [SPORTS_SPACES_CATALOG_QUERY_KEY],
      });
      queryClientInstance.invalidateQueries({
        queryKey: [SPACE_DAILY_AVAILABILITY_QUERY_KEY],
      });
      queryClientInstance.invalidateQueries({
        queryKey: [SPACE_DETAIL_QUERY_KEY],
      });
    },
  });
}

/**
 * Hook de mutación para alternar si un espacio tiene disponibilidad registrada en el sistema.
 *
 * @returns {ReturnType<typeof useMutation>} Mutación reactiva para alternar estado de registro.
 */
export function useToggleAvailabilityRegistrationMutation() {
  let queryClientInstance = useQueryClient();

  return useMutation({
    mutationFn: async (registrationParameters: {
      spaceId: string;
      gestionaDisponibilidad: boolean;
    }) => {
      return SpaceAvailabilityService.updateAvailabilityRegistration(
        registrationParameters
      );
    },
    onSuccess: () => {
      queryClientInstance.invalidateQueries({
        queryKey: [SPORTS_SPACES_CATALOG_QUERY_KEY],
      });
      queryClientInstance.invalidateQueries({
        queryKey: [SPACE_DAILY_AVAILABILITY_QUERY_KEY],
      });
      queryClientInstance.invalidateQueries({
        queryKey: [SPACE_DETAIL_QUERY_KEY],
      });
    },
  });
}
