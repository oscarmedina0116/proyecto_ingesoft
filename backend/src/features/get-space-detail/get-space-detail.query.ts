import { prisma } from '../../shared/database/prisma';
import {
  MISSING_CHARACTERISTICS_TEXT,
  MISSING_IMAGE_TEXT,
  SPACE_IMAGE_MAP,
  SPACE_TYPE_LABELS,
  SURFACE_TYPE_LABELS,
} from '../../shared/constants/app-constants';
import { CHECK_AVAILABILITY_SERVICE_INSTANCE } from '../check-space-availability/check-availability.service';
import { SpaceDetailResponseDto } from './get-space-detail.dto';

export const UUID_FORMAT_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const DEFAULT_BUILDING_FALLBACK =
  'Complejo Deportivo Campus Universitario (Zona Exterior)';

export const DEFAULT_LOCATION_FALLBACK =
  'Costado Sur-Occidental, Unidad Camilo Torres / Estadio Alfonso López';

export const CUSTOM_MISSING_IMAGE_SPACES = new Set<string>();
export const CUSTOM_MISSING_CHARACTERISTICS_SPACES = new Set<string>();

/**
 * Clase de consulta para el Slice `get-space-detail` (REQ-01: Consultar Detalle y Ubicación de Espacios).
 */
export class GetSpaceDetailQuery {
  /**
   * Valida si una cadena tiene formato UUID estándar antes de consultar PostgreSQL.
   *
   * @param {string} candidateIdentifier Identificador a evaluar.
   * @returns {boolean} `true` si el formato corresponde a un UUID válido.
   */
  public isValidUuid(candidateIdentifier: string): boolean {
    return UUID_FORMAT_REGEX.test(candidateIdentifier);
  }

  /**
   * Busca un espacio deportivo activo por su ID en PostgreSQL incluyendo sus disciplinas deportivas
   * asociadas (`espacio_deportes` -> `disciplinas_deportivas`) y su estado de disponibilidad actual.
   *
   * @param {string} spaceId UUID del espacio deportivo solicitado.
   * @param {string} [dateParameter] Fecha opcional para evaluar estado actual.
   * @param {string} [timeParameter] Hora opcional para evaluar estado actual.
   * @returns {Promise<SpaceDetailResponseDto | null>} DTO de detalle del espacio o `null` si no existe o está inactivo.
   */
  public async findActiveSpaceDetailById(
    spaceId: string,
    dateParameter?: string,
    timeParameter?: string
  ): Promise<SpaceDetailResponseDto | null> {
    if (!this.isValidUuid(spaceId)) {
      return null;
    }

    let spaceRecord = await prisma.espacioDeportivo.findFirst({
      where: {
        id: spaceId,
        activo: true,
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
    });

    if (!spaceRecord) {
      return null;
    }

    let batchAvailabilityResult =
      await CHECK_AVAILABILITY_SERVICE_INSTANCE.calculateBatchAvailability(
        [
          {
            id: spaceRecord.id,
            codigoInterno: spaceRecord.codigoInterno,
            nombre: spaceRecord.nombre,
          },
        ],
        dateParameter,
        timeParameter
      );

    let availabilityItem = batchAvailabilityResult.estados.get(spaceRecord.id)!;

    let rawImageUrl = SPACE_IMAGE_MAP[spaceRecord.codigoInterno] ?? null;
    let isImageSuppressed = CUSTOM_MISSING_IMAGE_SPACES.has(spaceRecord.id);
    let resolvedImageUrl = isImageSuppressed ? null : rawImageUrl;

    let isCharacteristicsSuppressed = CUSTOM_MISSING_CHARACTERISTICS_SPACES.has(
      spaceRecord.id
    );
    let hasDescriptionInDatabase = Boolean(
      spaceRecord.descripcion && spaceRecord.descripcion.trim().length > 0
    );
    let hasRegisteredCharacteristics =
      hasDescriptionInDatabase &&
      !isCharacteristicsSuppressed &&
      spaceRecord.capacidad > 0;

    let descriptionText = hasRegisteredCharacteristics
      ? spaceRecord.descripcion!.trim()
      : MISSING_CHARACTERISTICS_TEXT;

    let buildingName =
      spaceRecord.edificio && spaceRecord.edificio.trim().length > 0
        ? spaceRecord.edificio.trim()
        : DEFAULT_BUILDING_FALLBACK;

    let relativeLocation =
      spaceRecord.ubicacion && spaceRecord.ubicacion.trim().length > 0
        ? spaceRecord.ubicacion.trim()
        : DEFAULT_LOCATION_FALLBACK;

    let completeReference = spaceRecord.edificio
      ? `Edificio / Escenario: ${buildingName} — ${relativeLocation}`
      : `${buildingName} — ${relativeLocation}`;

    return {
      id: spaceRecord.id,
      codigoInterno: spaceRecord.codigoInterno,
      nombre: spaceRecord.nombre,
      tipoCodigo: spaceRecord.tipo,
      tipoNombre: SPACE_TYPE_LABELS[spaceRecord.tipo] || spaceRecord.tipo,
      imagenUrl: resolvedImageUrl,
      tieneImagen: Boolean(resolvedImageUrl),
      textoImagenFallback: MISSING_IMAGE_TEXT,
      caracteristicasFisicas: {
        tieneCaracteristicasRegistradas: hasRegisteredCharacteristics,
        descripcionTexto: descriptionText,
        capacidad: spaceRecord.capacidad,
        esTechado: spaceRecord.esTechado,
        coberturaTexto: spaceRecord.esTechado
          ? 'Techada (Cubierta)'
          : 'Destechada (Al aire libre)',
        esMixta: spaceRecord.esMixta,
        superficieCodigo: spaceRecord.superficie,
        superficieNombre:
          SURFACE_TYPE_LABELS[spaceRecord.superficie] || spaceRecord.superficie,
        deportesPermitidos: spaceRecord.espacioDeportes.map(
          (spaceSportRelation) => ({
            id: spaceSportRelation.disciplina.id,
            codigo: spaceSportRelation.disciplina.codigo,
            nombre: spaceSportRelation.disciplina.nombre,
            descripcion: spaceSportRelation.disciplina.descripcion,
          })
        ),
      },
      ubicacionReferencia: {
        edificio: buildingName,
        ubicacionRelativa: relativeLocation,
        referenciaCompleta: completeReference,
      },
      disponibilidadActual: {
        estadoCodigo: availabilityItem.estadoCodigo,
        estadoTexto: availabilityItem.estadoTexto,
        instanteConsulta: availabilityItem.instanteConsulta,
      },
      activo: spaceRecord.activo,
      actualizadoEn: spaceRecord.actualizadoEn.toISOString(),
    };
  }

  /**
   * Permite alternar en tiempo de ejecución la presencia de fotografía (CA #3) o
   * características físicas (CA #4) de un espacio para verificación de criterios de aceptación.
   *
   * @param {string} spaceId UUID del espacio deportivo.
   * @param {{ ocultarImagen?: boolean; ocultarCaracteristicas?: boolean }} overrideOptions Opciones de simulación QA.
   * @returns {void}
   */
  public configureSpaceQaOverrides(
    spaceId: string,
    overrideOptions: {
      ocultarImagen?: boolean;
      ocultarCaracteristicas?: boolean;
    }
  ): void {
    if (typeof overrideOptions.ocultarImagen === 'boolean') {
      if (overrideOptions.ocultarImagen) {
        CUSTOM_MISSING_IMAGE_SPACES.add(spaceId);
      } else {
        CUSTOM_MISSING_IMAGE_SPACES.delete(spaceId);
      }
    }

    if (typeof overrideOptions.ocultarCaracteristicas === 'boolean') {
      if (overrideOptions.ocultarCaracteristicas) {
        CUSTOM_MISSING_CHARACTERISTICS_SPACES.add(spaceId);
      } else {
        CUSTOM_MISSING_CHARACTERISTICS_SPACES.delete(spaceId);
      }
    }
  }
}

export const GET_SPACE_DETAIL_QUERY_INSTANCE = new GetSpaceDetailQuery();
export let getSpaceDetailQuery = GET_SPACE_DETAIL_QUERY_INSTANCE;
