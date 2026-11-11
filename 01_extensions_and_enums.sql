-- ============================================================================
-- UNAL SPACE — Módulo de Espacios Deportivos
-- Archivo: 01_extensions_and_enums.sql
-- Descripción: Habilitación de extensiones y definición de tipos enumerados.
-- Compatibilidad: PostgreSQL 16+ · DataGrip
-- Zona horaria: America/Bogota (UTC-5)
-- ============================================================================

-- ── 0. Zona horaria de sesión ───────────────────────────────────────────────
SET timezone = 'America/Bogota';

-- ── 1. Extensiones ──────────────────────────────────────────────────────────
-- uuid-ossp  : Generación de UUIDs v4 para llaves primarias.
-- btree_gist : Soporte para EXCLUDE USING gist sobre rangos temporales
--              (tsrange/tstzrange) — imprescindible para anti-solapamiento.
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "btree_gist";

-- ── 2. Tipos enumerados (ENUM) ──────────────────────────────────────────────

-- 2.1 Clasificación física del espacio deportivo.
DO $$ BEGIN
    CREATE TYPE tipo_espacio AS ENUM (
        'ESTADIO',          -- Estadio de fútbol 11
        'CONCHA_ACUSTICA',  -- Escenario multiuso (Concha Acústica)
        'CANCHA_TECHADA',   -- Cancha cubierta (techo fijo)
        'CANCHA_DESTECHADA',-- Cancha al aire libre
        'CANCHA_TENIS'      -- Cancha exclusiva de tenis
    );
EXCEPTION WHEN duplicate_object THEN
    RAISE NOTICE 'El tipo "tipo_espacio" ya existe, se omite creación.';
END $$;

-- 2.2 Tipo de superficie de juego.
DO $$ BEGIN
    CREATE TYPE tipo_superficie AS ENUM (
        'GRAMA_NATURAL',       -- Césped natural (estadio)
        'GRAMA_SINTETICA',     -- Césped artificial
        'CEMENTO',             -- Concreto / Pavimento
        'CAUCHO_SINTETICO',    -- Superficie sintética (canchas polideportivas)
        'POLVO_DE_LADRILLO',   -- Clay / Polvo de ladrillo (tenis)
        'BALDOSA_DEPORTIVA'    -- Baldosa o piso deportivo modular
    );
EXCEPTION WHEN duplicate_object THEN
    RAISE NOTICE 'El tipo "tipo_superficie" ya existe, se omite creación.';
END $$;

-- 2.3 Deportes que se pueden practicar / reservar en un espacio.
DO $$ BEGIN
    CREATE TYPE deporte_permitido AS ENUM (
        'FUTBOL_11',       -- Fútbol once (exclusivo del Estadio)
        'FUTBOL_SALA',     -- Microfútbol / Futsal
        'BALONCESTO',      -- Basketball
        'VOLEIBOL',        -- Volleyball
        'TENIS'            -- Tenis de campo
    );
EXCEPTION WHEN duplicate_object THEN
    RAISE NOTICE 'El tipo "deporte_permitido" ya existe, se omite creación.';
END $$;

-- 2.4 Ciclo de vida de una reserva.
DO $$ BEGIN
    CREATE TYPE estado_reserva AS ENUM (
        'PENDIENTE',    -- Recién creada, a la espera de confirmación
        'CONFIRMADA',   -- Confirmada por el sistema o un administrador
        'CANCELADA',    -- Cancelada por el usuario o por política
        'FINALIZADA',   -- El bloque horario ya transcurrió satisfactoriamente
        'NO_SHOW'       -- El usuario no se presentó
    );
EXCEPTION WHEN duplicate_object THEN
    RAISE NOTICE 'El tipo "estado_reserva" ya existe, se omite creación.';
END $$;

-- ============================================================================
-- FIN 01_extensions_and_enums.sql
-- ============================================================================
