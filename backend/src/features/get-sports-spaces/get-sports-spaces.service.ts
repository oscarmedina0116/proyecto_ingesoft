import {
  SPACE_IMAGE_MAP,
  SPACE_TYPE_LABELS,
  SURFACE_TYPE_LABELS,
  UNREGISTERED_AVAILABILITY_TEXT,
} from '../../shared/constants/app-constants';
import {
  CheckAvailabilityService,
  CHECK_AVAILABILITY_SERVICE_INSTANCE,
} from '../check-space-availability/check-availability.service';
import {
  GET_SPORTS_SPACES_QUERY_SCHEMA,
  SportsSpaceCatalogItemDto,
  SportsSpacesCatalogResponseDto,
} from './get-sports-spaces.dto';
import {
  GetSportsSpacesQuery,
  GET_SPORTS_SPACES_QUERY_INSTANCE,
} from './get-sports-spaces.query';

export const DEFAULT_CAMPUS_LOCATION_LABEL =
  'Zona Deportiva Campus Universitario';
export const DEFAULT_EXTERIOR_BUILDING_LABEL = 'Zona Deportiva Exterior';

/**
 * Servicio orquestador del Slice `get-sports-spaces` que integra el catálogo de espacios deportivos
 * con el cálculo dinámico de disponibilidad en tiempo real (Contratos 4 y 5 del diseño).
 */
export class GetSportsSpacesService {
  private readonly spacesQuery: GetSportsSpacesQuery;
  private readonly availabilityService: CheckAvailabilityService;

  /**
   * Construye una instancia de GetSportsSpacesService.
   *
   * @param {GetSportsSpacesQuery} spacesQuery Objeto de consulta de espacios deportivos.
   * @param {CheckAvailabilityService} availabilityService Motor de disponibilidad en tiempo real.
   */
  constructor(
    spacesQuery: GetSportsSpacesQuery = GET_SPORTS_SPACES_QUERY_INSTANCE,
    availabilityService: CheckAvailabilityService = CHECK_AVAILABILITY_SERVICE_INSTANCE
  ) {
    this.spacesQuery = spacesQuery;
    this.availabilityService = availabilityService;
  }

  /**
   * Consulta el catálogo de espacios deportivos activos y calcula el estado de disponibilidad
   * individualizado para cada espacio en el mismo instante de búsqueda (REQ-02 CA #1, #2, #3, #4).
   *
   * @param {unknown} rawQueryParameters Parámetros de consulta enviados por el cliente.
   * @returns {Promise<SportsSpacesCatalogResponseDto>} Catálogo con estados calculados y resumen estadístico.
   */
  public async getCatalogWithAvailability(
    rawQueryParameters: unknown
  ): Promise<SportsSpacesCatalogResponseDto> {
    let parsedQuery = GET_SPORTS_SPACES_QUERY_SCHEMA.parse(rawQueryParameters);

    let activeSpacesList = await this.spacesQuery.findActiveSportsSpaces({
      search: parsedQuery.search,
      sport: parsedQuery.sport,
      spaceType: parsedQuery.spaceType,
      roofed: parsedQuery.roofed,
    });

    let batchAvailabilityResult =
      await this.availabilityService.calculateBatchAvailability(
        activeSpacesList.map((spaceRecord) => ({
          id: spaceRecord.id,
          codigoInterno: spaceRecord.codigoInterno,
          nombre: spaceRecord.nombre,
        })),
        parsedQuery.date,
        parsedQuery.time
      );

    let catalogItemsList: SportsSpaceCatalogItemDto[] = activeSpacesList.map(
      (spaceRecord) => {
        let spaceAvailability = batchAvailabilityResult.estados.get(
          spaceRecord.id
        );
        let spaceImageUrl = SPACE_IMAGE_MAP[spaceRecord.codigoInterno] ?? null;

        return {
          id: spaceRecord.id,
          codigoInterno: spaceRecord.codigoInterno,
          nombre: spaceRecord.nombre,
          descripcion: spaceRecord.descripcion,
          tipoCodigo: spaceRecord.tipo,
          tipoNombre: SPACE_TYPE_LABELS[spaceRecord.tipo] || spaceRecord.tipo,
          superficieCodigo: spaceRecord.superficie,
          superficieNombre:
            SURFACE_TYPE_LABELS[spaceRecord.superficie] ||
            spaceRecord.superficie,
          ubicacionRelativa:
            spaceRecord.ubicacion || DEFAULT_CAMPUS_LOCATION_LABEL,
          edificio: spaceRecord.edificio || DEFAULT_EXTERIOR_BUILDING_LABEL,
          esTechado: spaceRecord.esTechado,
          capacidad: spaceRecord.capacidad,
          esMixta: spaceRecord.esMixta,
          imagenUrl: spaceImageUrl,
          tieneImagen: Boolean(spaceImageUrl),
          deportesPermitidos: spaceRecord.espacioDeportes.map(
            (spaceSportRelation: any) => ({
              id: spaceSportRelation.disciplina.id,
              codigo: spaceSportRelation.disciplina.codigo,
              nombre: spaceSportRelation.disciplina.nombre,
              descripcion: spaceSportRelation.disciplina.descripcion,
            })
          ),
          disponibilidad: spaceAvailability
            ? {
                estadoCodigo: spaceAvailability.estadoCodigo,
                estadoTexto: spaceAvailability.estadoTexto,
                gestionaDisponibilidad:
                  spaceAvailability.gestionaDisponibilidad,
                instanteConsulta: spaceAvailability.instanteConsulta,
                reservaActiva: spaceAvailability.reservaActiva,
              }
            : {
                estadoCodigo: 'NO_REGISTRADO',
                estadoTexto: UNREGISTERED_AVAILABILITY_TEXT,
                gestionaDisponibilidad: false,
                instanteConsulta: batchAvailabilityResult.instanteConsulta,
                reservaActiva: null,
              },
        };
      }
    );

    let filteredCatalogItems =
      parsedQuery.availability && parsedQuery.availability !== 'ALL'
        ? catalogItemsList.filter(
            (catalogItem) =>
              catalogItem.disponibilidad.estadoCodigo ===
              parsedQuery.availability
          )
        : catalogItemsList;

    let availabilityStatusSummary = {
      disponibles: filteredCatalogItems.filter(
        (catalogItem) =>
          catalogItem.disponibilidad.estadoCodigo === 'DISPONIBLE'
      ).length,
      ocupados: filteredCatalogItems.filter(
        (catalogItem) => catalogItem.disponibilidad.estadoCodigo === 'OCUPADO'
      ).length,
      noRegistrados: filteredCatalogItems.filter(
        (catalogItem) =>
          catalogItem.disponibilidad.estadoCodigo === 'NO_REGISTRADO'
      ).length,
    };

    return {
      instanteConsulta: batchAvailabilityResult.instanteConsulta,
      fechaConsulta: batchAvailabilityResult.fechaConsulta,
      horaConsulta: batchAvailabilityResult.horaConsulta,
      totalEspacios: filteredCatalogItems.length,
      resumenEstados: availabilityStatusSummary,
      espacios: filteredCatalogItems,
    };
  }
}

export const GET_SPORTS_SPACES_SERVICE_INSTANCE = new GetSportsSpacesService();
export let getSportsSpacesService = GET_SPORTS_SPACES_SERVICE_INSTANCE;
