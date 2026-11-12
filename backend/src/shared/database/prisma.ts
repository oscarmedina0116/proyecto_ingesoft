import { PrismaClient } from '@prisma/client';
import { DB_TIMEZONE } from '../constants/app-constants';

export const DEVELOPMENT_ENVIRONMENT_NAME = 'development';

/**
 * Clase singleton encargada de administrar la conexión de Prisma ORM con PostgreSQL 16+.
 */
export class DatabaseClient {
  private static prismaInstance: PrismaClient | null = null;

  /**
   * Obtiene o inicializa la instancia única de PrismaClient conectada a PostgreSQL.
   *
   * @returns {PrismaClient} Instancia singleton de PrismaClient configurada para UNALSpace.
   */
  public static getInstance(): PrismaClient {
    if (!DatabaseClient.prismaInstance) {
      DatabaseClient.prismaInstance = new PrismaClient({
        log:
          process.env.NODE_ENV === DEVELOPMENT_ENVIRONMENT_NAME
            ? ['warn', 'error']
            : ['error'],
      });
    }
    return DatabaseClient.prismaInstance;
  }

  /**
   * Configura la zona horaria de la sesión actual en PostgreSQL a America/Bogota.
   *
   * @param {PrismaClient} prismaClient Cliente de Prisma activo.
   * @returns {Promise<void>} Promesa que se resuelve al fijar la zona horaria en PostgreSQL.
   */
  public static async configureSessionTimezone(
    prismaClient: PrismaClient
  ): Promise<void> {
    await prismaClient.$executeRawUnsafe(`SET timezone = '${DB_TIMEZONE}';`);
  }
}

export const PRISMA_CLIENT = DatabaseClient.getInstance();
export let prisma = PRISMA_CLIENT;
