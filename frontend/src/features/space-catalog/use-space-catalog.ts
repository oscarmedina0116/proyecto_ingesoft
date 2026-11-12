import { useQuery } from '@tanstack/react-query';
import {
  ApiClient,
  AVAILABILITY_CONNECTION_ERROR_MESSAGE,
} from '../../shared/api/client';
import {
  CatalogFilters,
  SportsSpacesCatalogResponse,
} from './space-catalog.types';

export const SPORTS_SPACES_CATALOG_QUERY_KEY = 'sports-spaces-catalog';
export const SPACES_CATALOG_ENDPOINT = '/spaces';
export const DEFAULT_ALL_FILTER_VALUE = 'ALL';

/**
 * Servicio del Slice `space-catalog` para consultar el catálogo de espacios deportivos.
 */
export class SpaceCatalogService {
  /**
   * Obtiene el catálogo de espacios deportivos aplicando los filtros seleccionados por el estudiante.
   *
   * @param {CatalogFilters} catalogFilters Criterios de búsqueda y filtrado.
   * @returns {Promise<SportsSpacesCatalogResponse>} Respuesta con los espacios y resumen de disponibilidad.
   */
  public static async getSportsSpacesCatalog(
    catalogFilters: CatalogFilters
  ): Promise<SportsSpacesCatalogResponse> {
    let searchParameters = new URLSearchParams();
    let trimmedSearchQuery = catalogFilters.search.trim();

    if (trimmedSearchQuery) {
      searchParameters.set('search', trimmedSearchQuery);
    }
    if (catalogFilters.sport !== DEFAULT_ALL_FILTER_VALUE) {
      searchParameters.set('sport', catalogFilters.sport);
    }
    if (catalogFilters.spaceType !== DEFAULT_ALL_FILTER_VALUE) {
      searchParameters.set('spaceType', catalogFilters.spaceType);
    }
    if (catalogFilters.roofed !== DEFAULT_ALL_FILTER_VALUE) {
      searchParameters.set('roofed', catalogFilters.roofed);
    }
    if (catalogFilters.availability !== DEFAULT_ALL_FILTER_VALUE) {
      searchParameters.set('availability', catalogFilters.availability);
    }
    if (catalogFilters.date) {
      searchParameters.set('date', catalogFilters.date);
    }
    if (catalogFilters.time) {
      searchParameters.set('time', catalogFilters.time);
    }

    let queryString = searchParameters.toString();
    let requestEndpoint = `${SPACES_CATALOG_ENDPOINT}?${queryString}`;

    let apiResponse = await ApiClient.requestJson<{
      success: boolean;
      data: SportsSpacesCatalogResponse;
    }>(requestEndpoint, {
      fallbackErrorMessage: AVAILABILITY_CONNECTION_ERROR_MESSAGE,
    });

    return apiResponse.data;
  }
}

/**
 * Hook de TanStack Query para consultar el catálogo de espacios deportivos y su estado
 * de disponibilidad calculado en tiempo real (REQ-02).
 *
 * @param {CatalogFilters} catalogFilters Filtros de búsqueda por texto, deporte, tipo, cubierta y horario.
 * @returns {ReturnType<typeof useQuery<SportsSpacesCatalogResponse>>} Estado reactivo del catálogo.
 */
export function useSportsSpacesCatalog(catalogFilters: CatalogFilters) {
  return useQuery<SportsSpacesCatalogResponse>({
    queryKey: [SPORTS_SPACES_CATALOG_QUERY_KEY, catalogFilters],
    retry: false,
    queryFn: async () => {
      return SpaceCatalogService.getSportsSpacesCatalog(catalogFilters);
    },
  });
}
