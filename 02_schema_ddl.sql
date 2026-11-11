-- ============================================================================
-- UNAL SPACE — Módulo de Espacios Deportivos
-- Archivo: 02_schema_ddl.sql
-- Descripción: DDL de tablas, llaves, restricciones, índices y exclusión GIST.
-- Compatibilidad: PostgreSQL 16+ · DataGrip
-- Dependencias: 01_extensions_and_enums.sql
-- ============================================================================

SET timezone = 'America/Bogota';

-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║  1. TABLA: usuarios (estudiantes de la UNAL)                           ║
-- ╚══════════════════════════════════════════════════════════════════════════╝
CREATE TABLE IF NOT EXISTS usuarios (
    id                UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Datos personales
    nombres           VARCHAR(100)  NOT NULL,
    apellidos         VARCHAR(100)  NOT NULL,
    documento         VARCHAR(20)   NOT NULL,       -- Cédula / TI
    codigo_estudiantil VARCHAR(20)  NOT NULL,       -- Ej. 202012345

    -- Contacto institucional
    correo            VARCHAR(150)  NOT NULL,

    -- Vínculo académico
    facultad          VARCHAR(120)  NOT NULL,

    -- Metadatos
    activo            BOOLEAN       NOT NULL DEFAULT TRUE,
    creado_en         TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    actualizado_en    TIMESTAMPTZ   NOT NULL DEFAULT NOW(),

    -- ── Constraints ─────────────────────────────────────────────────────
    -- Correo institucional obligatorio @unal.edu.co
    CONSTRAINT ck_usuario_correo_unal
        CHECK (correo ~* '^[A-Za-z0-9._%+-]+@unal\.edu\.co$'),

    -- Unicidades de negocio
    CONSTRAINT uq_usuario_documento        UNIQUE (documento),
    CONSTRAINT uq_usuario_codigo           UNIQUE (codigo_estudiantil),
    CONSTRAINT uq_usuario_correo           UNIQUE (correo)
);

COMMENT ON TABLE  usuarios IS 'Estudiantes de la Universidad Nacional de Colombia autorizados para reservar espacios.';
COMMENT ON COLUMN usuarios.documento IS 'Número de cédula de ciudadanía o tarjeta de identidad.';
COMMENT ON COLUMN usuarios.codigo_estudiantil IS 'Código de matrícula único asignado por la universidad.';

-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║  2. TABLA: disciplinas_deportivas                                      ║
-- ╚══════════════════════════════════════════════════════════════════════════╝
CREATE TABLE IF NOT EXISTS disciplinas_deportivas (
    id          UUID              PRIMARY KEY DEFAULT uuid_generate_v4(),
    nombre      VARCHAR(60)       NOT NULL,
    codigo      deporte_permitido NOT NULL,    -- Mapeo al ENUM
    descripcion TEXT,
    activo      BOOLEAN           NOT NULL DEFAULT TRUE,
    creado_en   TIMESTAMPTZ       NOT NULL DEFAULT NOW(),

    CONSTRAINT uq_disciplina_codigo UNIQUE (codigo)
);

COMMENT ON TABLE disciplinas_deportivas IS 'Catálogo maestro de disciplinas deportivas disponibles en el campus.';

-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║  3. TABLA: espacios_deportivos                                         ║
-- ╚══════════════════════════════════════════════════════════════════════════╝
CREATE TABLE IF NOT EXISTS espacios_deportivos (
    id              UUID              PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Identificación
    nombre          VARCHAR(150)      NOT NULL,
    codigo_interno  VARCHAR(30)       NOT NULL,    -- Ej. EST-001, TCH-001
    descripcion     TEXT,

    -- Clasificación
    tipo            tipo_espacio      NOT NULL,
    superficie      tipo_superficie   NOT NULL,

    -- Ubicación referencial dentro del campus
    ubicacion       VARCHAR(200),
    edificio        VARCHAR(80),       -- Código/nombre de edificio si aplica

    -- Características
    es_techado      BOOLEAN           NOT NULL DEFAULT FALSE,
    capacidad       INT               NOT NULL DEFAULT 0,
    es_mixta        BOOLEAN           NOT NULL DEFAULT FALSE, -- ¿Multiuso?

    -- Estado operativo
    activo          BOOLEAN           NOT NULL DEFAULT TRUE,
    creado_en       TIMESTAMPTZ       NOT NULL DEFAULT NOW(),
    actualizado_en  TIMESTAMPTZ       NOT NULL DEFAULT NOW(),

    -- ── Constraints ─────────────────────────────────────────────────────
    CONSTRAINT uq_espacio_codigo UNIQUE (codigo_interno),
    CONSTRAINT ck_espacio_capacidad CHECK (capacidad >= 0)
);

COMMENT ON TABLE  espacios_deportivos IS 'Inventario físico de canchas, estadios y escenarios deportivos del campus Bogotá.';
COMMENT ON COLUMN espacios_deportivos.es_mixta IS 'TRUE si el espacio admite múltiples disciplinas (fútbol sala, baloncesto, voleibol).';
COMMENT ON COLUMN espacios_deportivos.codigo_interno IS 'Código corto único para identificación interna (ej. EST-001).';

-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║  4. TABLA: espacio_deportes (relación M:N espacios ↔ disciplinas)      ║
-- ╚══════════════════════════════════════════════════════════════════════════╝
-- Define qué deportes se pueden practicar en cada espacio.
CREATE TABLE IF NOT EXISTS espacio_deportes (
    id              UUID  PRIMARY KEY DEFAULT uuid_generate_v4(),
    espacio_id      UUID  NOT NULL,
    disciplina_id   UUID  NOT NULL,

    creado_en       TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- ── FK ──────────────────────────────────────────────────────────────
    CONSTRAINT fk_ed_espacio
        FOREIGN KEY (espacio_id)   REFERENCES espacios_deportivos(id)
        ON DELETE CASCADE,

    CONSTRAINT fk_ed_disciplina
        FOREIGN KEY (disciplina_id) REFERENCES disciplinas_deportivas(id)
        ON DELETE CASCADE,

    -- Una disciplina solo se asocia una vez por espacio
    CONSTRAINT uq_espacio_disciplina UNIQUE (espacio_id, disciplina_id)
);

COMMENT ON TABLE espacio_deportes IS 'Relación muchos-a-muchos: deportes permitidos por espacio deportivo.';

-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║  5. TABLA: reservas                                                    ║
-- ╚══════════════════════════════════════════════════════════════════════════╝
CREATE TABLE IF NOT EXISTS reservas (
    id              UUID            PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Relaciones
    usuario_id      UUID            NOT NULL,
    espacio_id      UUID            NOT NULL,
    disciplina_id   UUID            NOT NULL,

    -- Bloque horario de la reserva (con zona horaria)
    fecha_inicio    TIMESTAMPTZ     NOT NULL,
    fecha_fin       TIMESTAMPTZ     NOT NULL,

    -- Rango temporal calculado para exclusión GIST
    -- Se almacena explícitamente para la restricción de anti-solapamiento.
    rango_horario   TSTZRANGE       NOT NULL
                    GENERATED ALWAYS AS (tstzrange(fecha_inicio, fecha_fin, '[)')) STORED,

    -- Estado y observaciones
    estado          estado_reserva  NOT NULL DEFAULT 'PENDIENTE',
    motivo_cancelacion TEXT,

    -- Auditoría
    creado_en       TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    actualizado_en  TIMESTAMPTZ     NOT NULL DEFAULT NOW(),

    -- ── FK ──────────────────────────────────────────────────────────────
    CONSTRAINT fk_reserva_usuario
        FOREIGN KEY (usuario_id)    REFERENCES usuarios(id)
        ON DELETE RESTRICT,

    CONSTRAINT fk_reserva_espacio
        FOREIGN KEY (espacio_id)    REFERENCES espacios_deportivos(id)
        ON DELETE RESTRICT,

    CONSTRAINT fk_reserva_disciplina
        FOREIGN KEY (disciplina_id) REFERENCES disciplinas_deportivas(id)
        ON DELETE RESTRICT,

    -- ── Validaciones de horario ─────────────────────────────────────────
    -- La hora de fin debe ser posterior a la de inicio.
    CONSTRAINT ck_reserva_orden_fechas
        CHECK (fecha_fin > fecha_inicio),

    -- Duración mínima: 60 min / máxima: 120 min.
    CONSTRAINT ck_reserva_duracion
        CHECK (
            EXTRACT(EPOCH FROM (fecha_fin - fecha_inicio)) >= 3600   -- ≥ 1 h
            AND EXTRACT(EPOCH FROM (fecha_fin - fecha_inicio)) <= 7200 -- ≤ 2 h
        ),

    -- Horario de servicio: entre 06:00 y 21:00 (hora local Bogotá).
    CONSTRAINT ck_reserva_horario_apertura
        CHECK (
            (fecha_inicio AT TIME ZONE 'America/Bogota')::time >= '06:00:00'::time
            AND (fecha_fin AT TIME ZONE 'America/Bogota')::time <= '21:00:00'::time
        ),

    -- Solo días hábiles (lunes=1 … viernes=5). Excluye sáb(6) y dom(0).
    CONSTRAINT ck_reserva_dia_habil
        CHECK (
            EXTRACT(ISODOW FROM fecha_inicio AT TIME ZONE 'America/Bogota') BETWEEN 1 AND 5
        )
);

-- ── 5.1 Restricción de anti-solapamiento (EXCLUDE GIST) ────────────────
-- Garantiza a nivel ACID que NO pueden existir dos reservas superpuestas
-- en el mismo espacio deportivo cuyo estado sea PENDIENTE o CONFIRMADA.
-- Solo se evalúa para estados activos: PENDIENTE y CONFIRMADA.
ALTER TABLE reservas
    ADD CONSTRAINT excl_reserva_sin_solapamiento
        EXCLUDE USING gist (
            espacio_id  WITH =,
            rango_horario WITH &&
        )
        WHERE (estado IN ('PENDIENTE', 'CONFIRMADA'));

COMMENT ON TABLE  reservas IS 'Reservas de espacios deportivos realizadas por estudiantes.';
COMMENT ON COLUMN reservas.rango_horario IS 'Rango tstzrange generado automáticamente para la exclusión GIST anti-solapamiento.';

-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║  6. TABLA: auditoria_reservas                                          ║
-- ╚══════════════════════════════════════════════════════════════════════════╝
-- Registro inmutable de todo cambio de estado en las reservas.
CREATE TABLE IF NOT EXISTS auditoria_reservas (
    id              UUID            PRIMARY KEY DEFAULT uuid_generate_v4(),
    reserva_id      UUID            NOT NULL,

    estado_anterior estado_reserva,
    estado_nuevo    estado_reserva  NOT NULL,

    -- Contexto del cambio
    descripcion     TEXT,
    realizado_por   VARCHAR(150),   -- correo o 'SISTEMA'

    -- Timestamp de auditoría
    creado_en       TIMESTAMPTZ     NOT NULL DEFAULT NOW(),

    CONSTRAINT fk_auditoria_reserva
        FOREIGN KEY (reserva_id) REFERENCES reservas(id)
        ON DELETE CASCADE
);

COMMENT ON TABLE auditoria_reservas IS 'Log de auditoría inmutable para trazabilidad de cambios de estado en reservas.';

-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║  7. ÍNDICES OPTIMIZADOS                                               ║
-- ╚══════════════════════════════════════════════════════════════════════════╝

-- Búsquedas frecuentes: reservas por fecha y estado.
CREATE INDEX IF NOT EXISTS idx_reservas_fecha_inicio
    ON reservas (fecha_inicio);

CREATE INDEX IF NOT EXISTS idx_reservas_estado
    ON reservas (estado);

CREATE INDEX IF NOT EXISTS idx_reservas_fecha_estado
    ON reservas (fecha_inicio, estado);

-- Búsquedas por usuario (historial de reservas).
CREATE INDEX IF NOT EXISTS idx_reservas_usuario
    ON reservas (usuario_id);

-- Búsquedas por espacio (disponibilidad).
CREATE INDEX IF NOT EXISTS idx_reservas_espacio
    ON reservas (espacio_id);

-- Búsquedas por espacio + rango temporal (consultas de disponibilidad).
CREATE INDEX IF NOT EXISTS idx_reservas_espacio_rango
    ON reservas USING gist (espacio_id, rango_horario);

-- Auditoría: búsqueda rápida por reserva.
CREATE INDEX IF NOT EXISTS idx_auditoria_reserva
    ON auditoria_reservas (reserva_id);

-- Usuarios: búsqueda por código estudiantil.
CREATE INDEX IF NOT EXISTS idx_usuarios_codigo
    ON usuarios (codigo_estudiantil);

-- ============================================================================
-- FIN 02_schema_ddl.sql
-- ============================================================================
