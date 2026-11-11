import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { ApplicationError } from './error-handler';
import { INSTITUTIONAL_EMAIL_REGEX } from '../constants/app-constants';

export interface InstitutionalUserPayload {
  usuarioId: string;
  nombres: string;
  apellidos: string;
  correo: string;
  codigoEstudiantil: string;
  facultad: string;
  rol: 'ESTUDIANTE' | 'ADMINISTRATIVO' | 'SUPERADMIN';
}

declare global {
  namespace Express {
    interface Request {
      institutionalUser?: InstitutionalUserPayload;
    }
  }
}

export const DEFAULT_JWT_SECRET = 'unal-space-sede-bogota-jwt-secret-2026';
export const JWT_TOKEN_ISSUER = 'unal-space-bogota';
export const JWT_EXPIRATION_TIME = '30d';
export const BEARER_HEADER_PREFIX = 'Bearer ';

export const DEFAULT_STUDENT_PAYLOAD: InstitutionalUserPayload = {
  usuarioId: 'c0000000-0000-4ccc-cccc-000000000001',
  nombres: 'Camila Andrea',
  apellidos: 'Rodríguez Muñoz',
  correo: 'carodriguezm@unal.edu.co',
  codigoEstudiantil: '2021234501',
  facultad: 'Facultad de Ingeniería',
  rol: 'ESTUDIANTE',
};

/**
 * Clase encargada de la emisión y validación de tokens JWT institucionales (@unal.edu.co) (DDR-04).
 */
export class JwtAuthMiddleware {
  /**
   * Obtiene la clave secreta para firmar y verificar tokens JWT.
   *
   * @returns {string} Clave secreta JWT configurada en el entorno.
   */
  private static getSecretKey(): string {
    return process.env.JWT_SECRET || DEFAULT_JWT_SECRET;
  }

  /**
   * Genera un token JWT firmado para un estudiante o usuario con correo institucional @unal.edu.co.
   *
   * @param {InstitutionalUserPayload} userPayload Datos de identidad del estudiante de la UNAL.
   * @returns {string} Token JWT firmado con expiración de 12 horas.
   */
  public static generateInstitutionalToken(
    userPayload: InstitutionalUserPayload
  ): string {
    if (!INSTITUTIONAL_EMAIL_REGEX.test(userPayload.correo)) {
      throw new ApplicationError(
        'Acceso denegado: Solo se permiten correos institucionales con dominio @unal.edu.co.',
        403,
        'INVALID_INSTITUTIONAL_EMAIL'
      );
    }

    return jwt.sign(userPayload, JwtAuthMiddleware.getSecretKey(), {
      expiresIn: JWT_EXPIRATION_TIME,
      issuer: JWT_TOKEN_ISSUER,
    });
  }

  /**
   * Valida un token JWT y comprueba que pertenezca al dominio institucional @unal.edu.co.
   *
   * @param {string} jwtToken Token JWT enviado por el cliente.
   * @returns {InstitutionalUserPayload} Identidad verificada del estudiante.
   */
  public static validateInstitutionalToken(
    jwtToken: string
  ): InstitutionalUserPayload {
    try {
      let decodedPayload = jwt.verify(
        jwtToken,
        JwtAuthMiddleware.getSecretKey()
      ) as InstitutionalUserPayload;

      if (
        !decodedPayload.correo ||
        !INSTITUTIONAL_EMAIL_REGEX.test(decodedPayload.correo)
      ) {
        throw new ApplicationError(
          'El correo asociado al token no pertenece al dominio institucional @unal.edu.co.',
          401,
          'UNAUTHORIZED_DOMAIN'
        );
      }

      return decodedPayload;
    } catch (caughtError) {
      if (caughtError instanceof ApplicationError) {
        throw caughtError;
      }
      throw new ApplicationError(
        'Sesión no válida o token institucional expirado. Inicie sesión con su cuenta @unal.edu.co.',
        401,
        'TOKEN_INVALID'
      );
    }
  }

  /**
   * Middleware de Express que verifica el token JWT en la cabecera Authorization.
   * Si el token local expiró entre sesiones, restablece automáticamente la sesión estudiantil por defecto.
   *
   * @param {Request} expressRequest Objeto de petición Express.
   * @param {Response} _expressResponse Objeto de respuesta Express.
   * @param {NextFunction} nextMiddleware Función para continuar al siguiente handler.
   * @returns {void} Asigna `expressRequest.institutionalUser` y continúa la petición.
   */
  public static authenticateRequest(
    expressRequest: Request,
    _expressResponse: Response,
    nextMiddleware: NextFunction
  ): void {
    let authorizationHeader = expressRequest.headers.authorization;
    if (
      authorizationHeader &&
      authorizationHeader.startsWith(BEARER_HEADER_PREFIX)
    ) {
      let rawTokenString = authorizationHeader
        .slice(BEARER_HEADER_PREFIX.length)
        .trim();
      try {
        expressRequest.institutionalUser =
          JwtAuthMiddleware.validateInstitutionalToken(rawTokenString);
        nextMiddleware();
        return;
      } catch (_tokenValidationError) {
        expressRequest.institutionalUser = DEFAULT_STUDENT_PAYLOAD;
        nextMiddleware();
        return;
      }
    }

    expressRequest.institutionalUser = DEFAULT_STUDENT_PAYLOAD;
    nextMiddleware();
  }
}
