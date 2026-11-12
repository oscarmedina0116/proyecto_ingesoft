import { prisma } from '../../shared/database/prisma';

export const ALL_FILTER_OPTION = 'ALL';

/**
 * Clase de consulta a PostgreSQL para el Slice `get-sports-spaces` (Catálogo de espacios deportivos).
 */
export class GetSportsSpacesQuery {
  /**
   * Obtiene los espacios deportivos activos desde PostgreSQL filtrando por texto de búsqueda,
   * tipo de espacio, condición techada/destechada y disciplina deportiva.
   *
   * @param {{ search: string; sport: string; spaceType: string; roofed: 'ALL' | 'TRUE' | 'FALSE' }} filterCriteria Criterios de filtrado.
   * @returns {Promise<Array<any>>} Lista de espacios deportivos con sus disciplinas habilitadas.
   */
  public async findActiveSportsSpaces(filterCriteria: {
    search: string;
    sport: string;
    spaceType: string;
    roofed: 'ALL' | 'TRUE' | 'FALSE';
  }) {
    let trimmedSearchText = filterCriteria.search.trim();

    return prisma.espacioDeportivo.findMany({
      where: {
        activo: true,
        ...(trimmedSearchText
          ? {
              OR: [
                { nombre: { contains: trimmedSearchText, mode: 'insensitive' } },
                {
                  codigoInterno: {
                    contains: trimmedSearchText,
                    mode: 'insensitive',
                  },
                },
                {
                  ubicacion: {
                    contains: trimmedSearchText,
                    mode: 'insensitive',
                  },
                },
                {
                  edificio: {
                    contains: trimmedSearchText,
                    mode: 'insensitive',
                  },
                },
              ],
            }
          : {}),
        ...(filterCriteria.spaceType &&
        filterCriteria.spaceType !== ALL_FILTER_OPTION
          ? { tipo: filterCriteria.spaceType as any }
          : {}),
        ...(filterCriteria.roofed === 'TRUE'
          ? { esTechado: true }
          : filterCriteria.roofed === 'FALSE'
          ? { esTechado: false }
          : {}),
        ...(filterCriteria.sport && filterCriteria.sport !== ALL_FILTER_OPTION
          ? {
              espacioDeportes: {
                some: {
                  disciplina: {
                    codigo: filterCriteria.sport as any,
                  },
                },
              },
            }
          : {}),
      },
      include: {
        espacioDeportes: {
          include: {
            disciplina: true,
          },
          orderBy: {
            disciplina: {
              nombre: 'asc',
            },
          },
        },
      },
      orderBy: {
        codigoInterno: 'asc',
      },
    });
  }
}

export const GET_SPORTS_SPACES_QUERY_INSTANCE = new GetSportsSpacesQuery();
export let getSportsSpacesQuery = GET_SPORTS_SPACES_QUERY_INSTANCE;
