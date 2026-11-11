import { Router, Request, Response, NextFunction } from 'express';
import {
  GetSportsSpacesService,
  GET_SPORTS_SPACES_SERVICE_INSTANCE,
} from './get-sports-spaces.service';

/**
 * Controlador HTTP del Slice `get-sports-spaces` (Listado y catálogo de espacios deportivos).
 */
export class GetSportsSpacesController {
  public readonly router: Router;
  private readonly spacesService: GetSportsSpacesService;

  /**
   * Inicializa el controlador de catálogo de espacios deportivos.
   *
   * @param {GetSportsSpacesService} spacesService Servicio del slice `get-sports-spaces`.
   */
  constructor(
    spacesService: GetSportsSpacesService = GET_SPORTS_SPACES_SERVICE_INSTANCE
  ) {
    this.spacesService = spacesService;
    this.router = Router();
    this.registerRoutes();
  }

  /**
   * Registra la ruta principal de consulta del catálogo de espacios deportivos.
   *
   * @returns {void}
   */
  private registerRoutes(): void {
    this.router.get('/', this.getSportsSpaces.bind(this));
  }

  /**
   * Maneja la petición GET `/api/spaces` para retornar el catálogo de espacios deportivos
   * junto con su estado de disponibilidad en tiempo real.
   *
   * @param {Request} expressRequest Objeto de petición Express con filtros de búsqueda.
   * @param {Response} expressResponse Objeto de respuesta Express.
   * @param {NextFunction} nextMiddleware Función para delegar errores al middleware global.
   * @returns {Promise<void>} Envía la respuesta JSON con el catálogo y estados.
   */
  public async getSportsSpaces(
    expressRequest: Request,
    expressResponse: Response,
    nextMiddleware: NextFunction
  ): Promise<void> {
    try {
      let catalogResult = await this.spacesService.getCatalogWithAvailability(
        expressRequest.query
      );
      expressResponse.status(200).json({
        success: true,
        data: catalogResult,
      });
    } catch (caughtError) {
      nextMiddleware(caughtError);
    }
  }
}
