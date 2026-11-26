-- ============================================================================
-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║                       UNAL SPACE — BASE DE DATOS                       ║
-- ║           Módulo de Espacios Deportivos · Sede Bogotá                  ║
-- ║                                                                        ║
-- ║  Script consolidado para ejecución directa en DataGrip                 ║
-- ║  Base de datos: unal_space                                             ║
-- ║  Motor: PostgreSQL 16+                                                 ║
-- ║  Zona horaria: America/Bogota (UTC-5)                                  ║
-- ╚══════════════════════════════════════════════════════════════════════════╝

-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║  PARTE 1: EXTENSIONES Y TIPOS ENUMERADOS                              ║
-- ╚══════════════════════════════════════════════════════════════════════════╝

SET timezone = 'America/Bogota';

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "btree_gist";

DO $$ BEGIN
    CREATE TYPE tipo_espacio AS ENUM (
        'ESTADIO', 'CONCHA_ACUSTICA', 'CANCHA_TECHADA',
        'CANCHA_DESTECHADA', 'CANCHA_TENIS'
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE tipo_superficie AS ENUM (
        'GRAMA_NATURAL', 'GRAMA_SINTETICA', 'CEMENTO',
        'CAUCHO_SINTETICO', 'POLVO_DE_LADRILLO', 'BALDOSA_DEPORTIVA'
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE deporte_permitido AS ENUM (
        'FUTBOL_11', 'FUTBOL_SALA', 'BALONCESTO', 'VOLEIBOL', 'TENIS'
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE estado_reserva AS ENUM (
        'PENDIENTE', 'CONFIRMADA', 'CANCELADA', 'FINALIZADA', 'NO_SHOW'
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;


-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║  PARTE 2: TABLAS, CONSTRAINTS, EXCLUSIÓN GIST E ÍNDICES               ║
-- ╚══════════════════════════════════════════════════════════════════════════╝

-- ── Usuarios ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS usuarios (
    id                UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
    nombres           VARCHAR(100)  NOT NULL,
    apellidos         VARCHAR(100)  NOT NULL,
    documento         VARCHAR(20)   NOT NULL,
    codigo_estudiantil VARCHAR(20)  NOT NULL,
    correo            VARCHAR(150)  NOT NULL,
    facultad          VARCHAR(120)  NOT NULL,
    activo            BOOLEAN       NOT NULL DEFAULT TRUE,
    creado_en         TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    actualizado_en    TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    CONSTRAINT ck_usuario_correo_unal
        CHECK (correo ~* '^[A-Za-z0-9._%+-]+@unal\.edu\.co$'),
    CONSTRAINT uq_usuario_documento  UNIQUE (documento),
    CONSTRAINT uq_usuario_codigo     UNIQUE (codigo_estudiantil),
    CONSTRAINT uq_usuario_correo     UNIQUE (correo)
);

-- ── Disciplinas deportivas ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS disciplinas_deportivas (
    id          UUID              PRIMARY KEY DEFAULT uuid_generate_v4(),
    nombre      VARCHAR(60)       NOT NULL,
    codigo      deporte_permitido NOT NULL,
    descripcion TEXT,
    activo      BOOLEAN           NOT NULL DEFAULT TRUE,
    creado_en   TIMESTAMPTZ       NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_disciplina_codigo UNIQUE (codigo)
);

-- ── Espacios deportivos ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS espacios_deportivos (
    id              UUID              PRIMARY KEY DEFAULT uuid_generate_v4(),
    nombre          VARCHAR(150)      NOT NULL,
    codigo_interno  VARCHAR(30)       NOT NULL,
    descripcion     TEXT,
    tipo            tipo_espacio      NOT NULL,
    superficie      tipo_superficie   NOT NULL,
    ubicacion       VARCHAR(200),
    edificio        VARCHAR(80),
    es_techado      BOOLEAN           NOT NULL DEFAULT FALSE,
    capacidad       INT               NOT NULL DEFAULT 0,
    es_mixta        BOOLEAN           NOT NULL DEFAULT FALSE,
    activo          BOOLEAN           NOT NULL DEFAULT TRUE,
    creado_en       TIMESTAMPTZ       NOT NULL DEFAULT NOW(),
    actualizado_en  TIMESTAMPTZ       NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_espacio_codigo UNIQUE (codigo_interno),
    CONSTRAINT ck_espacio_capacidad CHECK (capacidad >= 0)
);

-- ── Relación M:N espacio ↔ deportes ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS espacio_deportes (
    id              UUID  PRIMARY KEY DEFAULT uuid_generate_v4(),
    espacio_id      UUID  NOT NULL REFERENCES espacios_deportivos(id) ON DELETE CASCADE,
    disciplina_id   UUID  NOT NULL REFERENCES disciplinas_deportivas(id) ON DELETE CASCADE,
    creado_en       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_espacio_disciplina UNIQUE (espacio_id, disciplina_id)
);

-- ── Reservas ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS reservas (
    id              UUID            PRIMARY KEY DEFAULT uuid_generate_v4(),
    usuario_id      UUID            NOT NULL REFERENCES usuarios(id) ON DELETE RESTRICT,
    espacio_id      UUID            NOT NULL REFERENCES espacios_deportivos(id) ON DELETE RESTRICT,
    disciplina_id   UUID            NOT NULL REFERENCES disciplinas_deportivas(id) ON DELETE RESTRICT,
    fecha_inicio    TIMESTAMPTZ     NOT NULL,
    fecha_fin       TIMESTAMPTZ     NOT NULL,
    rango_horario   TSTZRANGE       NOT NULL
                    GENERATED ALWAYS AS (tstzrange(fecha_inicio, fecha_fin, '[)')) STORED,
    estado          estado_reserva  NOT NULL DEFAULT 'PENDIENTE',
    motivo_cancelacion TEXT,
    creado_en       TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    actualizado_en  TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    CONSTRAINT ck_reserva_orden_fechas   CHECK (fecha_fin > fecha_inicio),
    CONSTRAINT ck_reserva_duracion       CHECK (
        EXTRACT(EPOCH FROM (fecha_fin - fecha_inicio)) >= 3600
        AND EXTRACT(EPOCH FROM (fecha_fin - fecha_inicio)) <= 7200
    ),
    CONSTRAINT ck_reserva_horario_apertura CHECK (
        (fecha_inicio AT TIME ZONE 'America/Bogota')::time >= '06:00:00'::time
        AND (fecha_fin AT TIME ZONE 'America/Bogota')::time <= '21:00:00'::time
    ),
    CONSTRAINT ck_reserva_dia_habil CHECK (
        EXTRACT(ISODOW FROM fecha_inicio AT TIME ZONE 'America/Bogota') BETWEEN 1 AND 5
    )
);

ALTER TABLE reservas
    ADD CONSTRAINT excl_reserva_sin_solapamiento
        EXCLUDE USING gist (
            espacio_id  WITH =,
            rango_horario WITH &&
        )
        WHERE (estado IN ('PENDIENTE', 'CONFIRMADA'));

-- ── Auditoría ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS auditoria_reservas (
    id              UUID            PRIMARY KEY DEFAULT uuid_generate_v4(),
    reserva_id      UUID            NOT NULL REFERENCES reservas(id) ON DELETE CASCADE,
    estado_anterior estado_reserva,
    estado_nuevo    estado_reserva  NOT NULL,
    descripcion     TEXT,
    realizado_por   VARCHAR(150),
    creado_en       TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

-- ── Índices ─────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_reservas_fecha_inicio   ON reservas (fecha_inicio);
CREATE INDEX IF NOT EXISTS idx_reservas_estado         ON reservas (estado);
CREATE INDEX IF NOT EXISTS idx_reservas_fecha_estado   ON reservas (fecha_inicio, estado);
CREATE INDEX IF NOT EXISTS idx_reservas_usuario        ON reservas (usuario_id);
CREATE INDEX IF NOT EXISTS idx_reservas_espacio        ON reservas (espacio_id);
CREATE INDEX IF NOT EXISTS idx_reservas_espacio_rango  ON reservas USING gist (espacio_id, rango_horario);
CREATE INDEX IF NOT EXISTS idx_auditoria_reserva       ON auditoria_reservas (reserva_id);
CREATE INDEX IF NOT EXISTS idx_usuarios_codigo         ON usuarios (codigo_estudiantil);


-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║  PARTE 3: TRIGGERS Y VALIDACIONES                                     ║
-- ╚══════════════════════════════════════════════════════════════════════════╝

-- ── Validación integral de reservas ─────────────────────────────────────
CREATE OR REPLACE FUNCTION fn_validar_reserva()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
    v_hora_inicio   TIME;
    v_hora_fin      TIME;
    v_dia_semana    INT;
    v_duracion_min  DOUBLE PRECISION;
    v_fecha_local   DATE;
    v_reservas_dia  INT;
BEGIN
    v_hora_inicio := (NEW.fecha_inicio AT TIME ZONE 'America/Bogota')::time;
    v_hora_fin    := (NEW.fecha_fin    AT TIME ZONE 'America/Bogota')::time;
    v_dia_semana  := EXTRACT(ISODOW FROM NEW.fecha_inicio AT TIME ZONE 'America/Bogota');
    v_fecha_local := (NEW.fecha_inicio AT TIME ZONE 'America/Bogota')::date;
    v_duracion_min := EXTRACT(EPOCH FROM (NEW.fecha_fin - NEW.fecha_inicio)) / 60.0;

    IF v_dia_semana NOT BETWEEN 1 AND 5 THEN
        RAISE EXCEPTION '[UNAL SPACE] Reserva rechazada: solo Lunes a Viernes. Día: % (ISODOW=%)',
            to_char(NEW.fecha_inicio AT TIME ZONE 'America/Bogota', 'Day'), v_dia_semana;
    END IF;

    IF v_hora_inicio < '06:00:00'::time THEN
        RAISE EXCEPTION '[UNAL SPACE] Hora de inicio (%) anterior a las 06:00.', v_hora_inicio;
    END IF;
    IF v_hora_fin > '21:00:00'::time THEN
        RAISE EXCEPTION '[UNAL SPACE] Hora de fin (%) excede las 21:00.', v_hora_fin;
    END IF;

    IF v_duracion_min < 60 THEN
        RAISE EXCEPTION '[UNAL SPACE] Duración mínima 60 min. Solicitado: % min.', v_duracion_min;
    END IF;
    IF v_duracion_min > 120 THEN
        RAISE EXCEPTION '[UNAL SPACE] Duración máxima 120 min. Solicitado: % min.', v_duracion_min;
    END IF;

    SELECT COUNT(*) INTO v_reservas_dia
    FROM reservas r
    WHERE r.usuario_id = NEW.usuario_id
      AND r.estado IN ('PENDIENTE', 'CONFIRMADA')
      AND (r.fecha_inicio AT TIME ZONE 'America/Bogota')::date = v_fecha_local
      AND r.rango_horario && tstzrange(NEW.fecha_inicio, NEW.fecha_fin, '[)')
      AND (TG_OP = 'INSERT' OR r.id <> NEW.id);

    IF v_reservas_dia > 0 THEN
        RAISE EXCEPTION '[UNAL SPACE] Solapamiento personal: ya tiene reserva activa el %.', v_fecha_local;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM espacio_deportes ed
        WHERE ed.espacio_id = NEW.espacio_id AND ed.disciplina_id = NEW.disciplina_id
    ) THEN
        RAISE EXCEPTION '[UNAL SPACE] Disciplina no habilitada para este espacio.';
    END IF;

    -- Actualizar timestamp de modificación
    NEW.actualizado_en := NOW();

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validar_reserva ON reservas;
CREATE TRIGGER trg_validar_reserva
    BEFORE INSERT OR UPDATE ON reservas
    FOR EACH ROW EXECUTE FUNCTION fn_validar_reserva();

-- ── Auditoría automática (AFTER — la fila ya existe en reservas) ─────────
CREATE OR REPLACE FUNCTION fn_auditar_estado_reserva()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        INSERT INTO auditoria_reservas (reserva_id, estado_anterior, estado_nuevo, descripcion, realizado_por)
        VALUES (NEW.id, NULL, NEW.estado, 'Reserva creada.', 'SISTEMA');
    ELSIF TG_OP = 'UPDATE' AND OLD.estado IS DISTINCT FROM NEW.estado THEN
        INSERT INTO auditoria_reservas (reserva_id, estado_anterior, estado_nuevo, descripcion, realizado_por)
        VALUES (NEW.id, OLD.estado, NEW.estado,
            CASE NEW.estado
                WHEN 'CONFIRMADA' THEN 'Reserva confirmada.'
                WHEN 'CANCELADA'  THEN COALESCE('Cancelada: ' || NEW.motivo_cancelacion, 'Reserva cancelada.')
                WHEN 'FINALIZADA' THEN 'Bloque horario transcurrido.'
                WHEN 'NO_SHOW'    THEN 'No-show: estudiante no se presentó.'
                ELSE 'Cambio de estado.'
            END, 'SISTEMA');
    END IF;
    RETURN NULL;  -- AFTER trigger: el valor de retorno se ignora
END;
$$;

DROP TRIGGER IF EXISTS trg_auditar_estado_reserva ON reservas;
CREATE TRIGGER trg_auditar_estado_reserva
    AFTER INSERT OR UPDATE ON reservas
    FOR EACH ROW EXECUTE FUNCTION fn_auditar_estado_reserva();

-- ── Auto-timestamp ──────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION fn_actualizar_timestamp()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    NEW.actualizado_en := NOW();
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_usuarios_actualizado ON usuarios;
CREATE TRIGGER trg_usuarios_actualizado
    BEFORE UPDATE ON usuarios
    FOR EACH ROW EXECUTE FUNCTION fn_actualizar_timestamp();

DROP TRIGGER IF EXISTS trg_espacios_actualizado ON espacios_deportivos;
CREATE TRIGGER trg_espacios_actualizado
    BEFORE UPDATE ON espacios_deportivos
    FOR EACH ROW EXECUTE FUNCTION fn_actualizar_timestamp();


-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║  PARTE 4: DATOS SEMILLA                                               ║
-- ╚══════════════════════════════════════════════════════════════════════════╝

-- Disciplinas
INSERT INTO disciplinas_deportivas (id, nombre, codigo, descripcion) VALUES
    ('a1b2c3d4-1111-4aaa-aaaa-000000000001'::uuid, 'Fútbol 11',   'FUTBOL_11',   'Fútbol once tradicional.'),
    ('a1b2c3d4-1111-4aaa-aaaa-000000000002'::uuid, 'Fútbol Sala', 'FUTBOL_SALA', 'Microfútbol / Futsal.'),
    ('a1b2c3d4-1111-4aaa-aaaa-000000000003'::uuid, 'Baloncesto',  'BALONCESTO',  'Basketball.'),
    ('a1b2c3d4-1111-4aaa-aaaa-000000000004'::uuid, 'Voleibol',    'VOLEIBOL',    'Volleyball.'),
    ('a1b2c3d4-1111-4aaa-aaaa-000000000005'::uuid, 'Tenis',       'TENIS',       'Tenis de campo.')
ON CONFLICT (codigo) DO NOTHING;

-- 12 Espacios deportivos
INSERT INTO espacios_deportivos (id, nombre, codigo_interno, descripcion, tipo, superficie, ubicacion, edificio, es_techado, capacidad, es_mixta) VALUES
    ('b0000000-0000-4bbb-bbbb-000000000001'::uuid, 'Estadio Alfonso López Pumarejo – Cancha Principal', 'EST-001', 'Cancha de fútbol 11 con grama natural.', 'ESTADIO', 'GRAMA_NATURAL', 'Zona Deportiva Central, costado sur', 'Estadio Alfonso López', FALSE, 6000, FALSE),
    ('b0000000-0000-4bbb-bbbb-000000000002'::uuid, 'Concha Acústica – Cancha Mixta 1', 'CON-001', 'Cancha mixta 1 en Edificio 761.', 'CONCHA_ACUSTICA', 'CEMENTO', 'Edificio 761, Zona Deportiva', '761', TRUE, 40, TRUE),
    ('b0000000-0000-4bbb-bbbb-000000000003'::uuid, 'Concha Acústica – Cancha Mixta 2', 'CON-002', 'Cancha mixta 2 en Edificio 761.', 'CONCHA_ACUSTICA', 'CEMENTO', 'Edificio 761, Zona Deportiva', '761', TRUE, 40, TRUE),
    ('b0000000-0000-4bbb-bbbb-000000000004'::uuid, 'Cancha Techada Mixta 1', 'TCH-001', 'Cancha cubierta con superficie sintética.', 'CANCHA_TECHADA', 'CAUCHO_SINTETICO', 'Bloques blancos contiguos al anillo vial', NULL, TRUE, 30, TRUE),
    ('b0000000-0000-4bbb-bbbb-000000000005'::uuid, 'Cancha Techada Mixta 2', 'TCH-002', 'Cancha cubierta con superficie sintética.', 'CANCHA_TECHADA', 'CAUCHO_SINTETICO', 'Bloques blancos contiguos al anillo vial', NULL, TRUE, 30, TRUE),
    ('b0000000-0000-4bbb-bbbb-000000000006'::uuid, 'Cancha Destechada Mixta 1', 'DES-001', 'Polideportiva al aire libre #1.', 'CANCHA_DESTECHADA', 'CEMENTO', 'Zona Deportiva, sector descubierto', NULL, FALSE, 30, TRUE),
    ('b0000000-0000-4bbb-bbbb-000000000007'::uuid, 'Cancha Destechada Mixta 2', 'DES-002', 'Polideportiva al aire libre #2.', 'CANCHA_DESTECHADA', 'CEMENTO', 'Zona Deportiva, sector descubierto', NULL, FALSE, 30, TRUE),
    ('b0000000-0000-4bbb-bbbb-000000000008'::uuid, 'Cancha Destechada Mixta 3', 'DES-003', 'Polideportiva al aire libre #3.', 'CANCHA_DESTECHADA', 'CEMENTO', 'Zona Deportiva, sector descubierto', NULL, FALSE, 30, TRUE),
    ('b0000000-0000-4bbb-bbbb-000000000009'::uuid, 'Cancha de Baloncesto Azul', 'BAL-001', 'Cancha exclusiva de baloncesto, superficie azul.', 'CANCHA_DESTECHADA', 'CAUCHO_SINTETICO', 'Zona Deportiva, junto a polideportivas', NULL, FALSE, 20, FALSE),
    ('b0000000-0000-4bbb-bbbb-000000000010'::uuid, 'Cancha de Tenis 1', 'TEN-001', 'Tenis en polvo de ladrillo.', 'CANCHA_TENIS', 'POLVO_DE_LADRILLO', 'Zona Deportiva, sector tenis', NULL, FALSE, 4, FALSE),
    ('b0000000-0000-4bbb-bbbb-000000000011'::uuid, 'Cancha de Tenis 2', 'TEN-002', 'Tenis en polvo de ladrillo.', 'CANCHA_TENIS', 'POLVO_DE_LADRILLO', 'Zona Deportiva, sector tenis', NULL, FALSE, 4, FALSE),
    ('b0000000-0000-4bbb-bbbb-000000000012'::uuid, 'Cancha de Tenis 3', 'TEN-003', 'Tenis en polvo de ladrillo.', 'CANCHA_TENIS', 'POLVO_DE_LADRILLO', 'Zona Deportiva, sector tenis', NULL, FALSE, 4, FALSE)
ON CONFLICT (codigo_interno) DO NOTHING;

-- Relación espacio ↔ deportes
INSERT INTO espacio_deportes (espacio_id, disciplina_id) VALUES
    -- Estadio → Fútbol 11
    ('b0000000-0000-4bbb-bbbb-000000000001'::uuid, 'a1b2c3d4-1111-4aaa-aaaa-000000000001'::uuid),
    -- Concha Acústica → Fútbol Sala, Baloncesto, Voleibol
    ('b0000000-0000-4bbb-bbbb-000000000002'::uuid, 'a1b2c3d4-1111-4aaa-aaaa-000000000002'::uuid),
    ('b0000000-0000-4bbb-bbbb-000000000002'::uuid, 'a1b2c3d4-1111-4aaa-aaaa-000000000003'::uuid),
    ('b0000000-0000-4bbb-bbbb-000000000002'::uuid, 'a1b2c3d4-1111-4aaa-aaaa-000000000004'::uuid),
    ('b0000000-0000-4bbb-bbbb-000000000003'::uuid, 'a1b2c3d4-1111-4aaa-aaaa-000000000002'::uuid),
    ('b0000000-0000-4bbb-bbbb-000000000003'::uuid, 'a1b2c3d4-1111-4aaa-aaaa-000000000003'::uuid),
    ('b0000000-0000-4bbb-bbbb-000000000003'::uuid, 'a1b2c3d4-1111-4aaa-aaaa-000000000004'::uuid),
    -- Canchas Techadas → Fútbol Sala, Baloncesto, Voleibol
    ('b0000000-0000-4bbb-bbbb-000000000004'::uuid, 'a1b2c3d4-1111-4aaa-aaaa-000000000002'::uuid),
    ('b0000000-0000-4bbb-bbbb-000000000004'::uuid, 'a1b2c3d4-1111-4aaa-aaaa-000000000003'::uuid),
    ('b0000000-0000-4bbb-bbbb-000000000004'::uuid, 'a1b2c3d4-1111-4aaa-aaaa-000000000004'::uuid),
    ('b0000000-0000-4bbb-bbbb-000000000005'::uuid, 'a1b2c3d4-1111-4aaa-aaaa-000000000002'::uuid),
    ('b0000000-0000-4bbb-bbbb-000000000005'::uuid, 'a1b2c3d4-1111-4aaa-aaaa-000000000003'::uuid),
    ('b0000000-0000-4bbb-bbbb-000000000005'::uuid, 'a1b2c3d4-1111-4aaa-aaaa-000000000004'::uuid),
    -- Destechadas Mixtas → Fútbol Sala, Baloncesto, Voleibol
    ('b0000000-0000-4bbb-bbbb-000000000006'::uuid, 'a1b2c3d4-1111-4aaa-aaaa-000000000002'::uuid),
    ('b0000000-0000-4bbb-bbbb-000000000006'::uuid, 'a1b2c3d4-1111-4aaa-aaaa-000000000003'::uuid),
    ('b0000000-0000-4bbb-bbbb-000000000006'::uuid, 'a1b2c3d4-1111-4aaa-aaaa-000000000004'::uuid),
    ('b0000000-0000-4bbb-bbbb-000000000007'::uuid, 'a1b2c3d4-1111-4aaa-aaaa-000000000002'::uuid),
    ('b0000000-0000-4bbb-bbbb-000000000007'::uuid, 'a1b2c3d4-1111-4aaa-aaaa-000000000003'::uuid),
    ('b0000000-0000-4bbb-bbbb-000000000007'::uuid, 'a1b2c3d4-1111-4aaa-aaaa-000000000004'::uuid),
    ('b0000000-0000-4bbb-bbbb-000000000008'::uuid, 'a1b2c3d4-1111-4aaa-aaaa-000000000002'::uuid),
    ('b0000000-0000-4bbb-bbbb-000000000008'::uuid, 'a1b2c3d4-1111-4aaa-aaaa-000000000003'::uuid),
    ('b0000000-0000-4bbb-bbbb-000000000008'::uuid, 'a1b2c3d4-1111-4aaa-aaaa-000000000004'::uuid),
    -- Baloncesto Azul → Solo Baloncesto
    ('b0000000-0000-4bbb-bbbb-000000000009'::uuid, 'a1b2c3d4-1111-4aaa-aaaa-000000000003'::uuid),
    -- Tenis → Solo Tenis
    ('b0000000-0000-4bbb-bbbb-000000000010'::uuid, 'a1b2c3d4-1111-4aaa-aaaa-000000000005'::uuid),
    ('b0000000-0000-4bbb-bbbb-000000000011'::uuid, 'a1b2c3d4-1111-4aaa-aaaa-000000000005'::uuid),
    ('b0000000-0000-4bbb-bbbb-000000000012'::uuid, 'a1b2c3d4-1111-4aaa-aaaa-000000000005'::uuid)
ON CONFLICT (espacio_id, disciplina_id) DO NOTHING;

-- 3 Estudiantes de prueba
INSERT INTO usuarios (id, nombres, apellidos, documento, codigo_estudiantil, correo, facultad) VALUES
    ('c0000000-0000-4ccc-cccc-000000000001'::uuid, 'Camila Andrea', 'Rodríguez Muñoz', '1032500001', '2021234501', 'carodriguezm@unal.edu.co', 'Facultad de Ingeniería'),
    ('c0000000-0000-4ccc-cccc-000000000002'::uuid, 'Santiago', 'Gómez Patiño', '1032500002', '2020198702', 'sgomezp@unal.edu.co', 'Facultad de Ciencias'),
    ('c0000000-0000-4ccc-cccc-000000000003'::uuid, 'Valentina', 'López Herrera', '1032500003', '2022345603', 'vlopezh@unal.edu.co', 'Facultad de Derecho, Ciencias Políticas y Sociales')
ON CONFLICT (documento) DO NOTHING;

-- 3 Reservas de prueba (próxima semana hábil)
DO $$
DECLARE
    v_lunes DATE;
BEGIN
    v_lunes := CURRENT_DATE + ((8 - EXTRACT(ISODOW FROM CURRENT_DATE)::int) % 7);
    IF EXTRACT(ISODOW FROM CURRENT_DATE) = 1 THEN v_lunes := CURRENT_DATE + 7; END IF;

    INSERT INTO reservas (usuario_id, espacio_id, disciplina_id, fecha_inicio, fecha_fin, estado) VALUES
        ('c0000000-0000-4ccc-cccc-000000000001'::uuid, 'b0000000-0000-4bbb-bbbb-000000000004'::uuid, 'a1b2c3d4-1111-4aaa-aaaa-000000000002'::uuid,
         (v_lunes + '08:00'::time) AT TIME ZONE 'America/Bogota', (v_lunes + '09:30'::time) AT TIME ZONE 'America/Bogota', 'CONFIRMADA');

    INSERT INTO reservas (usuario_id, espacio_id, disciplina_id, fecha_inicio, fecha_fin, estado) VALUES
        ('c0000000-0000-4ccc-cccc-000000000002'::uuid, 'b0000000-0000-4bbb-bbbb-000000000011'::uuid, 'a1b2c3d4-1111-4aaa-aaaa-000000000005'::uuid,
         (v_lunes + 1 + '10:00'::time) AT TIME ZONE 'America/Bogota', (v_lunes + 1 + '11:00'::time) AT TIME ZONE 'America/Bogota', 'PENDIENTE');

    INSERT INTO reservas (usuario_id, espacio_id, disciplina_id, fecha_inicio, fecha_fin, estado) VALUES
        ('c0000000-0000-4ccc-cccc-000000000003'::uuid, 'b0000000-0000-4bbb-bbbb-000000000009'::uuid, 'a1b2c3d4-1111-4aaa-aaaa-000000000003'::uuid,
         (v_lunes + 2 + '14:00'::time) AT TIME ZONE 'America/Bogota', (v_lunes + 2 + '16:00'::time) AT TIME ZONE 'America/Bogota', 'CONFIRMADA');
END $$;


-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║  PARTE 5: VISTAS Y CONSULTAS ANALÍTICAS                               ║
-- ╚══════════════════════════════════════════════════════════════════════════╝

-- ── Función de disponibilidad ───────────────────────────────────────────
CREATE OR REPLACE FUNCTION fn_disponibilidad_espacio(p_espacio_id UUID, p_fecha DATE)
RETURNS TABLE (
    espacio_nombre VARCHAR, fecha DATE, franja_inicio TIMESTAMPTZ,
    franja_fin TIMESTAMPTZ, hora_inicio TIME, hora_fin TIME, disponible BOOLEAN
) LANGUAGE sql STABLE AS $$
    WITH franjas AS (
        SELECT gs.slot_start AT TIME ZONE 'America/Bogota' AS franja_ini,
               (gs.slot_start + INTERVAL '1 hour') AT TIME ZONE 'America/Bogota' AS franja_f
        FROM generate_series(
            (p_fecha + '06:00'::time) AT TIME ZONE 'America/Bogota',
            (p_fecha + '20:00'::time) AT TIME ZONE 'America/Bogota',
            INTERVAL '1 hour'
        ) AS gs(slot_start)
    ),
    ocupadas AS (
        SELECT rango_horario FROM reservas
        WHERE espacio_id = p_espacio_id AND estado IN ('PENDIENTE', 'CONFIRMADA')
          AND (fecha_inicio AT TIME ZONE 'America/Bogota')::date = p_fecha
    )
    SELECT e.nombre::VARCHAR, p_fecha, f.franja_ini, f.franja_f,
           (f.franja_ini AT TIME ZONE 'America/Bogota')::time,
           (f.franja_f   AT TIME ZONE 'America/Bogota')::time,
           NOT EXISTS (SELECT 1 FROM ocupadas o WHERE o.rango_horario && tstzrange(f.franja_ini, f.franja_f, '[)'))
    FROM franjas f CROSS JOIN espacios_deportivos e WHERE e.id = p_espacio_id ORDER BY f.franja_ini;
$$;

-- ── Vista de disponibilidad ─────────────────────────────────────────────
CREATE OR REPLACE VIEW v_disponibilidad_espacios AS
SELECT e.id AS espacio_id, e.codigo_interno AS codigo_espacio, e.nombre AS espacio_nombre,
       e.tipo AS tipo_espacio, e.es_techado, d.fecha, d.hora_inicio, d.hora_fin, d.disponible
FROM espacios_deportivos e
CROSS JOIN LATERAL fn_disponibilidad_espacio(e.id, CURRENT_DATE) d
WHERE e.activo = TRUE;

-- ── Vista resumen de reservas ───────────────────────────────────────────
CREATE OR REPLACE VIEW v_resumen_reservas AS
SELECT r.id AS reserva_id,
       u.nombres || ' ' || u.apellidos AS estudiante, u.codigo_estudiantil, u.facultad,
       e.nombre AS espacio, e.codigo_interno AS codigo_espacio, e.tipo AS tipo_espacio, e.es_techado,
       dd.nombre AS deporte, dd.codigo AS deporte_codigo,
       r.fecha_inicio AT TIME ZONE 'America/Bogota' AS inicio_local,
       r.fecha_fin    AT TIME ZONE 'America/Bogota' AS fin_local,
       (r.fecha_inicio AT TIME ZONE 'America/Bogota')::date AS fecha,
       (r.fecha_inicio AT TIME ZONE 'America/Bogota')::time AS hora_inicio,
       (r.fecha_fin    AT TIME ZONE 'America/Bogota')::time AS hora_fin,
       EXTRACT(EPOCH FROM (r.fecha_fin - r.fecha_inicio)) / 3600.0 AS duracion_horas,
       to_char(r.fecha_inicio AT TIME ZONE 'America/Bogota', 'Day') AS dia_semana,
       r.estado, r.motivo_cancelacion,
       r.creado_en AT TIME ZONE 'America/Bogota' AS creado_en_local
FROM reservas r
    JOIN usuarios u ON r.usuario_id = u.id
    JOIN espacios_deportivos e ON r.espacio_id = e.id
    JOIN disciplinas_deportivas dd ON r.disciplina_id = dd.id;

-- ── Vista analítica: ocupación por franja y deporte ─────────────────────
CREATE OR REPLACE VIEW v_ocupacion_franjas_por_deporte AS
WITH franjas_horarias AS (
    SELECT gs::time AS franja_inicio, (gs + INTERVAL '1 hour')::time AS franja_fin,
           to_char(gs, 'HH24:MI') || ' – ' || to_char(gs + INTERVAL '1 hour', 'HH24:MI') AS franja_label
    FROM generate_series('2000-01-01 06:00:00'::timestamp, '2000-01-01 20:00:00'::timestamp, INTERVAL '1 hour') gs
),
reservas_activas AS (
    SELECT r.espacio_id, dd.nombre AS deporte,
           (r.fecha_inicio AT TIME ZONE 'America/Bogota')::time AS hora_inicio,
           (r.fecha_fin    AT TIME ZONE 'America/Bogota')::time AS hora_fin,
           (r.fecha_inicio AT TIME ZONE 'America/Bogota')::date AS fecha_reserva
    FROM reservas r JOIN disciplinas_deportivas dd ON r.disciplina_id = dd.id
    WHERE r.estado IN ('CONFIRMADA', 'FINALIZADA')
),
cruce AS (
    SELECT fh.franja_label, fh.franja_inicio, ra.deporte,
           COUNT(DISTINCT ra.fecha_reserva || '-' || ra.espacio_id) AS total_reservas
    FROM franjas_horarias fh
        JOIN reservas_activas ra ON ra.hora_inicio < fh.franja_fin AND ra.hora_fin > fh.franja_inicio
    GROUP BY fh.franja_label, fh.franja_inicio, ra.deporte
)
SELECT c.deporte, c.franja_label AS franja_horaria, c.total_reservas,
       ROUND(c.total_reservas * 100.0 / NULLIF(SUM(c.total_reservas) OVER (PARTITION BY c.deporte), 0), 2) AS porcentaje_ocupacion,
       RANK() OVER (PARTITION BY c.deporte ORDER BY c.total_reservas DESC) AS ranking_demanda
FROM cruce c ORDER BY c.deporte, c.total_reservas DESC, c.franja_inicio;


-- ============================================================================
-- SCRIPT DE RESET (descomentar para borrar todo y re-crear)
-- ============================================================================
-- FIN DB-UnalSpace.sql
-- ============================================================================
