import fs from 'fs';
import path from 'path';
import { Client } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

export const DEFAULT_DATABASE_NAME = 'unal_space';
export const ADMIN_DATABASE_PATH = '/postgres';
export const MASTER_SQL_RELATIVE_PATH = '../../../../DB-UnalSpace.sql';

/**
 * Clase utilitaria para verificar e inicializar el esquema nativo de PostgreSQL 16+
 * (extensiones, tipos ENUM, tablas, restricción GIST, triggers, vistas y datos semilla).
 */
export class DatabaseInitializer {
  /**
   * Asegura que la base de datos `unal_space` exista en el servidor PostgreSQL y ejecuta
   * el script maestro `DB-UnalSpace.sql` si las tablas aún no han sido inicializadas.
   * Además, garantiza que existan reservas activas en la semana/día hábil actual para
   * demostración inmediata de estados "Disponible" y "Ocupado".
   *
   * @param {string} connectionString Cadena de conexión PostgreSQL (DATABASE_URL).
   * @returns {Promise<void>} Promesa que indica la finalización de la inicialización.
   */
  public static async ensureDatabaseInitialized(
    connectionString: string
  ): Promise<void> {
    let parsedDatabaseUrl = new URL(connectionString);
    let targetDatabaseName =
      parsedDatabaseUrl.pathname.replace(/^\//, '') || DEFAULT_DATABASE_NAME;

    let adminDatabaseUrl = new URL(connectionString);
    adminDatabaseUrl.pathname = ADMIN_DATABASE_PATH;
    adminDatabaseUrl.search = '';

    let adminPostgresClient = new Client({
      connectionString: adminDatabaseUrl.toString(),
    });
    try {
      await adminPostgresClient.connect();
      let databaseExistsResult = await adminPostgresClient.query(
        'SELECT 1 FROM pg_database WHERE datname = $1',
        [targetDatabaseName]
      );
      if (databaseExistsResult.rowCount === 0) {
        await adminPostgresClient.query(
          `CREATE DATABASE "${targetDatabaseName}"`
        );
      }
    } finally {
      await adminPostgresClient.end().catch(() => undefined);
    }

    let applicationDatabaseUrl = new URL(connectionString);
    applicationDatabaseUrl.search = '';
    let applicationPostgresClient = new Client({
      connectionString: applicationDatabaseUrl.toString(),
    });
    try {
      await applicationPostgresClient.connect();
      await applicationPostgresClient.query("SET timezone = 'America/Bogota';");

      let checkTableResult = await applicationPostgresClient.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables
          WHERE table_schema = 'public'
            AND table_name = 'espacios_deportivos'
        ) AS table_exists;
      `);

      let isSchemaInitialized = Boolean(checkTableResult.rows[0]?.table_exists);

      if (!isSchemaInitialized) {
        let sqlScriptPath = path.resolve(__dirname, MASTER_SQL_RELATIVE_PATH);
        if (fs.existsSync(sqlScriptPath)) {
          let sqlScriptContent = fs.readFileSync(sqlScriptPath, 'utf-8');
          await applicationPostgresClient.query(sqlScriptContent);
        }
      }

      await DatabaseInitializer.seedCurrentWeekdayDemoReservations(
        applicationPostgresClient
      );
    } finally {
      await applicationPostgresClient.end().catch(() => undefined);
    }
  }

  /**
   * Inserta reservas activas de demostración en el día hábil actual (o próximo lunes si hoy es fin de semana)
   * para que el catálogo refleje simultáneamente espacios en estado "Ocupado" y "Disponible" en PostgreSQL.
   *
   * @param {Client} postgresClient Cliente conectado a la base de datos `unal_space`.
   * @returns {Promise<void>} Promesa resuelta tras asegurar las reservas de demostración.
   */
  public static async seedCurrentWeekdayDemoReservations(
    postgresClient: Client
  ): Promise<void> {
    await postgresClient.query(`
      DO $$
      DECLARE
        v_target_date DATE;
        v_isodow INT;
        v_current_hour INT;
        v_slot_start TIME;
        v_slot_end TIME;
      BEGIN
        SET timezone = 'America/Bogota';
        v_isodow := EXTRACT(ISODOW FROM (NOW() AT TIME ZONE 'America/Bogota'))::int;
        IF v_isodow BETWEEN 1 AND 5 THEN
          v_target_date := (NOW() AT TIME ZONE 'America/Bogota')::date;
        ELSE
          v_target_date := (NOW() AT TIME ZONE 'America/Bogota')::date + ((8 - v_isodow) % 7);
        END IF;

        v_current_hour := EXTRACT(HOUR FROM (NOW() AT TIME ZONE 'America/Bogota'))::int;
        IF v_current_hour < 6 OR v_current_hour >= 20 THEN
          v_current_hour := 12;
        END IF;

        v_slot_start := make_time(v_current_hour, 0, 0);
        v_slot_end   := make_time(LEAST(v_current_hour + 2, 21), 0, 0);

        -- Reserva activa 1 en el bloque horario actual: Cancha Techada Mixta 1 (TCH-001) -> CONFIRMADA
        IF NOT EXISTS (
          SELECT 1 FROM reservas
          WHERE espacio_id = 'b0000000-0000-4bbb-bbbb-000000000004'::uuid
            AND estado IN ('PENDIENTE', 'CONFIRMADA')
            AND rango_horario && tstzrange(
              (v_target_date + v_slot_start) AT TIME ZONE 'America/Bogota',
              (v_target_date + v_slot_end) AT TIME ZONE 'America/Bogota',
              '[)'
            )
        ) AND NOT EXISTS (
          SELECT 1 FROM reservas
          WHERE usuario_id = 'c0000000-0000-4ccc-cccc-000000000001'::uuid
            AND estado IN ('PENDIENTE', 'CONFIRMADA')
            AND (fecha_inicio AT TIME ZONE 'America/Bogota')::date = v_target_date
            AND rango_horario && tstzrange(
              (v_target_date + v_slot_start) AT TIME ZONE 'America/Bogota',
              (v_target_date + v_slot_end) AT TIME ZONE 'America/Bogota',
              '[)'
            )
        ) THEN
          INSERT INTO reservas (usuario_id, espacio_id, disciplina_id, fecha_inicio, fecha_fin, estado)
          VALUES (
            'c0000000-0000-4ccc-cccc-000000000001'::uuid,
            'b0000000-0000-4bbb-bbbb-000000000004'::uuid,
            'a1b2c3d4-1111-4aaa-aaaa-000000000002'::uuid,
            (v_target_date + v_slot_start) AT TIME ZONE 'America/Bogota',
            (v_target_date + v_slot_end) AT TIME ZONE 'America/Bogota',
            'CONFIRMADA'
          );
        END IF;

        -- Reserva activa 2 en el bloque horario actual: Concha Acústica Cancha Mixta 1 (CON-001) -> PENDIENTE
        IF NOT EXISTS (
          SELECT 1 FROM reservas
          WHERE espacio_id = 'b0000000-0000-4bbb-bbbb-000000000002'::uuid
            AND estado IN ('PENDIENTE', 'CONFIRMADA')
            AND rango_horario && tstzrange(
              (v_target_date + v_slot_start) AT TIME ZONE 'America/Bogota',
              (v_target_date + make_time(LEAST(v_current_hour + 1, 21), 0, 0)) AT TIME ZONE 'America/Bogota',
              '[)'
            )
        ) AND NOT EXISTS (
          SELECT 1 FROM reservas
          WHERE usuario_id = 'c0000000-0000-4ccc-cccc-000000000002'::uuid
            AND estado IN ('PENDIENTE', 'CONFIRMADA')
            AND (fecha_inicio AT TIME ZONE 'America/Bogota')::date = v_target_date
            AND rango_horario && tstzrange(
              (v_target_date + v_slot_start) AT TIME ZONE 'America/Bogota',
              (v_target_date + make_time(LEAST(v_current_hour + 1, 21), 0, 0)) AT TIME ZONE 'America/Bogota',
              '[)'
            )
        ) THEN
          INSERT INTO reservas (usuario_id, espacio_id, disciplina_id, fecha_inicio, fecha_fin, estado)
          VALUES (
            'c0000000-0000-4ccc-cccc-000000000002'::uuid,
            'b0000000-0000-4bbb-bbbb-000000000002'::uuid,
            'a1b2c3d4-1111-4aaa-aaaa-000000000003'::uuid,
            (v_target_date + v_slot_start) AT TIME ZONE 'America/Bogota',
            (v_target_date + make_time(LEAST(v_current_hour + 1, 21), 0, 0)) AT TIME ZONE 'America/Bogota',
            'PENDIENTE'
          );
        END IF;
      END $$;
    `);
  }
}
