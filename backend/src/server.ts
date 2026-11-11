import express, { Express, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { prisma } from './shared/database/prisma';
import { DatabaseInitializer } from './shared/database/init-db';
import {
  ApplicationError,
  GlobalErrorHandler,
} from './shared/middlewares/error-handler';
import {
  InstitutionalUserPayload,
  JwtAuthMiddleware,
} from './shared/middlewares/auth-jwt';
import { INSTITUTIONAL_EMAIL_REGEX } from './shared/constants/app-constants';
import { GetSportsSpacesController } from './features/get-sports-spaces/get-sports-spaces.controller';
import { GetSpaceDetailController } from './features/get-space-detail/get-space-detail.controller';
import { CheckAvailabilityController } from './features/check-space-availability/check-availability.controller';

dotenv.config();

export const DEFAULT_SERVER_PORT = 3001;
export const DEFAULT_DATABASE_CONNECTION_URL =
  'postgresql://postgres:postgres@localhost:5432/unal_space?schema=public';

export const COURT_SVG_THEMES: Record<
  string,
  {
    bgPrimary: string;
    bgSecondary: string;
    courtFill: string;
    lineColor: string;
    title: string;
    subtitle: string;
    badge: string;
  }
> = {
  'EST-001': {
    bgPrimary: '#0b3d20',
    bgSecondary: '#145a32',
    courtFill: '#1e8449',
    lineColor: '#e8f8f5',
    title: 'Estadio Alfonso López Pumarejo',
    subtitle: 'Grama Natural Reglamentaria · Fútbol 11 · Aforo 6000',
    badge: 'ESTADIO · EDIFICIO ALFONSO LÓPEZ',
  },
  'CON-001': {
    bgPrimary: '#1b2631',
    bgSecondary: '#2c3e50',
    courtFill: '#34495e',
    lineColor: '#f4d03f',
    title: 'Concha Acústica – Cancha Mixta 1',
    subtitle: 'Superficie de Cemento Cubierta · Fútbol Sala / Baloncesto / Voleibol',
    badge: 'EDIFICIO 761 · CUBIERTA',
  },
  'CON-002': {
    bgPrimary: '#1b2631',
    bgSecondary: '#283747',
    courtFill: '#2e4053',
    lineColor: '#58d68d',
    title: 'Concha Acústica – Cancha Mixta 2',
    subtitle: 'Superficie de Cemento Cubierta · Fútbol Sala / Baloncesto / Voleibol',
    badge: 'EDIFICIO 761 · CUBIERTA',
  },
  'TCH-001': {
    bgPrimary: '#0e4b3e',
    bgSecondary: '#117864',
    courtFill: '#148f77',
    lineColor: '#ffffff',
    title: 'Cancha Techada Mixta 1',
    subtitle: 'Caucho Sintético Polideportivo · Contigua al Anillo Vial',
    badge: 'CANCHA TECHADA · CUBIERTA',
  },
  'TCH-002': {
    bgPrimary: '#0e4b3e',
    bgSecondary: '#0b5345',
    courtFill: '#117a65',
    lineColor: '#f7dc6f',
    title: 'Cancha Techada Mixta 2',
    subtitle: 'Caucho Sintético Polideportivo · Contigua al Anillo Vial',
    badge: 'CANCHA TECHADA · CUBIERTA',
  },
  'DES-001': {
    bgPrimary: '#212f3d',
    bgSecondary: '#34495e',
    courtFill: '#566573',
    lineColor: '#f8f9f9',
    title: 'Cancha Destechada Mixta 1',
    subtitle: 'Polideportiva al Aire Libre · Cemento · Zona Deportiva',
    badge: 'AIRE LIBRE · MULTIUSO',
  },
  'DES-002': {
    bgPrimary: '#212f3d',
    bgSecondary: '#2c3e50',
    courtFill: '#5d6d7e',
    lineColor: '#f9e79f',
    title: 'Cancha Destechada Mixta 2',
    subtitle: 'Polideportiva al Aire Libre · Cemento · Zona Deportiva',
    badge: 'AIRE LIBRE · MULTIUSO',
  },
  'DES-003': {
    bgPrimary: '#212f3d',
    bgSecondary: '#273746',
    courtFill: '#515a5a',
    lineColor: '#ffffff',
    title: 'Cancha Destechada Mixta 3',
    subtitle: 'Polideportiva al Aire Libre · Cemento · Zona Deportiva',
    badge: 'AIRE LIBRE · MULTIUSO',
  },
  'BAL-001': {
    bgPrimary: '#0a2540',
    bgSecondary: '#154360',
    courtFill: '#1f618d',
    lineColor: '#ffffff',
    title: 'Cancha de Baloncesto Azul',
    subtitle: 'Caucho Sintético Azul · Exclusiva Baloncesto · Aire Libre',
    badge: 'BALONCESTO · SUPERFICIE AZUL',
  },
  'TEN-001': {
    bgPrimary: '#6e2c00',
    bgSecondary: '#935116',
    courtFill: '#ba4a00',
    lineColor: '#ffffff',
    title: 'Cancha de Tenis 1',
    subtitle: 'Polvo de Ladrillo (Clay) · Sector Tenis UNAL Bogotá',
    badge: 'TENIS DE CAMPO · CLAY',
  },
  'TEN-002': {
    bgPrimary: '#6e2c00',
    bgSecondary: '#873600',
    courtFill: '#ca6f1e',
    lineColor: '#ffffff',
    title: 'Cancha de Tenis 2',
    subtitle: 'Polvo de Ladrillo (Clay) · Sector Tenis UNAL Bogotá',
    badge: 'TENIS DE CAMPO · CLAY',
  },
};

/**
 * Clase principal del servidor HTTP para el backend de UNALSpace bajo Vertical Slice Architecture.
 */
export class UnalSpaceServer {
  public readonly app: Express;
  private readonly port: number;

  /**
   * Construye e inicializa la aplicación Express con todos los Vertical Slices y middlewares.
   *
   * @param {number} [portNumber] Puerto de escucha del servidor HTTP.
   */
  constructor(
    portNumber: number = Number(process.env.PORT || DEFAULT_SERVER_PORT)
  ) {
    this.app = express();
    this.port = portNumber;
    this.configureMiddlewares();
    this.registerAssetRoutes();
    this.registerAuthRoutes();
    this.registerVerticalSlices();
    this.configureErrorHandling();
  }

  /**
   * Configura los middlewares transversales (CORS, JSON parser, Timeout de 10s DDR-03 y JWT DDR-04).
   *
   * @returns {void}
   */
  private configureMiddlewares(): void {
    this.app.use(cors());
    this.app.use(express.json());
    this.app.use(GlobalErrorHandler.enforceGatewayTimeout);
  }

  /**
   * Registra el generador de fotografías vectoriales representativas de alta resolución
   * para cada escenario deportivo del campus UNAL Sede Bogotá (REQ-01 CA #1).
   *
   * @returns {void}
   */
  private registerAssetRoutes(): void {
    this.app.get(
      '/api/assets/spaces/:fileName',
      (expressRequest: Request, expressResponse: Response) => {
        let rawFileName = String(expressRequest.params.fileName || '');
        let spaceCode = rawFileName.replace(/\.svg$/i, '').toUpperCase();
        let svgMarkup = this.buildRepresentativeCourtSvg(spaceCode);

        expressResponse.setHeader(
          'Content-Type',
          'image/svg+xml; charset=utf-8'
        );
        expressResponse.setHeader(
          'Cache-Control',
          'no-cache, no-store, must-revalidate'
        );
        expressResponse.status(200).send(svgMarkup);
      }
    );
  }

  /**
   * Construye una ilustración arquitectónica SVG de alta resolución sin pixelado ni distorsión
   * según el tipo de cancha y superficie del espacio deportivo.
   *
   * @param {string} spaceCode Código interno del espacio deportivo (ej. EST-001, BAL-001, TEN-001).
   * @returns {string} Documento SVG completo listo para renderizar.
   */
  public buildRepresentativeCourtSvg(spaceCode: string): string {
    let themeConfig = COURT_SVG_THEMES[spaceCode] || {
      bgPrimary: '#006633',
      bgSecondary: '#145a32',
      courtFill: '#1e8449',
      lineColor: '#ffffff',
      title: `Escenario Deportivo ${spaceCode}`,
      subtitle: 'Universidad Nacional de Colombia · Sede Bogotá',
      badge: 'UNAL SPACE · SEDE BOGOTÁ',
    };

    return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 675" width="1200" height="675" role="img" aria-label="${themeConfig.title}">
  <defs>
    <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="${themeConfig.bgPrimary}" />
      <stop offset="100%" stop-color="${themeConfig.bgSecondary}" />
    </linearGradient>
  </defs>
  <rect width="1200" height="675" fill="url(#bgGrad)" />

  <!-- Franja superior: Tipo de escenario (izquierda) y Código de referencia grande (derecha) -->
  <rect x="48" y="20" width="680" height="64" rx="14" fill="#006633" stroke="#ffffff" stroke-opacity="0.45" stroke-width="2" />
  <text x="76" y="61" fill="#ffffff" font-family="system-ui, -apple-system, sans-serif" font-size="27" font-weight="800" letter-spacing="0.8">${themeConfig.badge}</text>

  <rect x="920" y="20" width="232" height="64" rx="14" fill="#0f172a" fill-opacity="0.92" stroke="#34d399" stroke-opacity="0.6" stroke-width="2" />
  <text x="1036" y="63" text-anchor="middle" fill="#ffffff" font-family="ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace" font-size="34" font-weight="900" letter-spacing="1.5">${spaceCode}</text>

  <!-- Cancha / Escenario con máximo aprovechamiento horizontal -->
  <rect x="48" y="100" width="1104" height="408" rx="20" fill="${themeConfig.courtFill}" stroke="${themeConfig.lineColor}" stroke-width="6" />
  <line x1="600" y1="100" x2="600" y2="508" stroke="${themeConfig.lineColor}" stroke-width="5" stroke-opacity="0.88" />
  <circle cx="600" cy="304" r="76" fill="none" stroke="${themeConfig.lineColor}" stroke-width="5" stroke-opacity="0.88" />
  <circle cx="600" cy="304" r="8" fill="${themeConfig.lineColor}" />
  <rect x="48" y="198" width="155" height="212" fill="none" stroke="${themeConfig.lineColor}" stroke-width="5" stroke-opacity="0.85" />
  <rect x="997" y="198" width="155" height="212" fill="none" stroke="${themeConfig.lineColor}" stroke-width="5" stroke-opacity="0.85" />

  <!-- Pie informativo con tipografía de alto impacto legible a simple vista -->
  <rect x="48" y="524" width="1104" height="131" rx="16" fill="#0f172a" fill-opacity="0.92" stroke="#ffffff" stroke-opacity="0.15" stroke-width="1.5" />
  <text x="80" y="582" fill="#ffffff" font-family="system-ui, -apple-system, sans-serif" font-size="42" font-weight="900">${themeConfig.title}</text>
  <text x="80" y="628" fill="#e2e8f0" font-family="system-ui, -apple-system, sans-serif" font-size="25" font-weight="600">${themeConfig.subtitle}</text>
</svg>`;
  }

  /**
   * Registra los endpoints de autenticación institucional local JWT (@unal.edu.co) (DDR-04).
   *
   * @returns {void}
   */
  private registerAuthRoutes(): void {
    this.app.get(
      '/api/auth/session',
      JwtAuthMiddleware.authenticateRequest,
      async (
        expressRequest: Request,
        expressResponse: Response,
        nextMiddleware: NextFunction
      ) => {
        try {
          let activeStudentsList = await prisma.usuario.findMany({
            where: { activo: true },
            orderBy: { nombres: 'asc' },
          });

          let currentAuthenticatedUser = expressRequest.institutionalUser!;
          let generatedJwtToken =
            JwtAuthMiddleware.generateInstitutionalToken(
              currentAuthenticatedUser
            );

          expressResponse.status(200).json({
            success: true,
            data: {
              activeUser: currentAuthenticatedUser,
              token: generatedJwtToken,
              availableStudents: activeStudentsList.map((studentRecord) => ({
                usuarioId: studentRecord.id,
                nombres: studentRecord.nombres,
                apellidos: studentRecord.apellidos,
                correo: studentRecord.correo,
                codigoEstudiantil: studentRecord.codigoEstudiantil,
                facultad: studentRecord.facultad,
                rol: 'ESTUDIANTE' as const,
              })),
            },
          });
        } catch (caughtError) {
          nextMiddleware(caughtError);
        }
      }
    );

    this.app.post(
      '/api/auth/session',
      async (
        expressRequest: Request,
        expressResponse: Response,
        nextMiddleware: NextFunction
      ) => {
        try {
          let normalizedEmailInput = String(expressRequest.body?.correo || '')
            .trim()
            .toLowerCase();

          if (!INSTITUTIONAL_EMAIL_REGEX.test(normalizedEmailInput)) {
            throw new ApplicationError(
              'Correo inválido: Debe ingresar una cuenta institucional con dominio @unal.edu.co.',
              403,
              'INVALID_INSTITUTIONAL_EMAIL'
            );
          }

          let existingStudentRecord = await prisma.usuario.findFirst({
            where: {
              correo: { equals: normalizedEmailInput, mode: 'insensitive' },
              activo: true,
            },
          });

          let authenticatedUserPayload: InstitutionalUserPayload =
            existingStudentRecord
              ? {
                  usuarioId: existingStudentRecord.id,
                  nombres: existingStudentRecord.nombres,
                  apellidos: existingStudentRecord.apellidos,
                  correo: existingStudentRecord.correo,
                  codigoEstudiantil: existingStudentRecord.codigoEstudiantil,
                  facultad: existingStudentRecord.facultad,
                  rol: 'ESTUDIANTE',
                }
              : {
                  usuarioId: 'c0000000-0000-4ccc-cccc-000000000001',
                  nombres: normalizedEmailInput.split('@')[0],
                  apellidos: 'Estudiante UNAL',
                  correo: normalizedEmailInput,
                  codigoEstudiantil: '2026100001',
                  facultad: 'Sede Bogotá',
                  rol: 'ESTUDIANTE',
                };

          let generatedJwtToken = JwtAuthMiddleware.generateInstitutionalToken(
            authenticatedUserPayload
          );

          expressResponse.status(200).json({
            success: true,
            data: {
              activeUser: authenticatedUserPayload,
              token: generatedJwtToken,
            },
          });
        } catch (caughtError) {
          nextMiddleware(caughtError);
        }
      }
    );
  }

  /**
   * Registra los 3 Vertical Slices autónomos del backend:
   * - `get-sports-spaces` (Catálogo de espacios deportivos con estado de disponibilidad)
   * - `get-space-detail` (SLICE REQ-01: Detalle y ubicación de espacios)
   * - `check-space-availability` (SLICE REQ-02: Disponibilidad en tiempo real y sincronización)
   *
   * @returns {void}
   */
  private registerVerticalSlices(): void {
    let getSportsSpacesController = new GetSportsSpacesController();
    let getSpaceDetailController = new GetSpaceDetailController();
    let checkAvailabilityController = new CheckAvailabilityController();

    this.app.get(
      '/api/health',
      (_expressRequest: Request, expressResponse: Response) => {
        expressResponse.status(200).json({
          status: 'ok',
          service: 'UNALSpace Backend MVP - Incremento 1',
          architecture: 'Vertical Slice Architecture (VSA)',
          database: 'PostgreSQL 16+',
          timezone: 'America/Bogota',
        });
      }
    );

    this.app.use(
      '/api/spaces',
      JwtAuthMiddleware.authenticateRequest,
      getSportsSpacesController.router,
      getSpaceDetailController.router
    );

    this.app.use(
      '/api/availability',
      JwtAuthMiddleware.authenticateRequest,
      checkAvailabilityController.router
    );
  }

  /**
   * Registra el middleware global de manejo de errores.
   *
   * @returns {void}
   */
  private configureErrorHandling(): void {
    this.app.use(GlobalErrorHandler.handleError);
  }

  /**
   * Inicia el servidor HTTP después de asegurar que la base de datos PostgreSQL 16+ esté inicializada.
   *
   * @returns {Promise<void>} Promesa que se resuelve cuando el servidor está escuchando peticiones.
   */
  public async start(): Promise<void> {
    let databaseUrl =
      process.env.DATABASE_URL || DEFAULT_DATABASE_CONNECTION_URL;

    try {
      await DatabaseInitializer.ensureDatabaseInitialized(databaseUrl);
      console.log(
        '[UNALSpace] Base de datos PostgreSQL verificada (America/Bogota).'
      );
    } catch (databaseInitError) {
      console.warn(
        '[UNALSpace] Advertencia: No se pudo auto-inicializar PostgreSQL al arranque. Asegúrese de que PostgreSQL esté activo:',
        databaseInitError instanceof Error
          ? databaseInitError.message
          : databaseInitError
      );
    }

    this.app.listen(this.port, () => {
      console.log(
        `[UNALSpace Backend] Servidor VSA ejecutándose en http://localhost:${this.port}`
      );
    });
  }
}

export const SERVER_INSTANCE = new UnalSpaceServer();
export let serverInstance = SERVER_INSTANCE;

if (require.main === module) {
  SERVER_INSTANCE.start();
}
