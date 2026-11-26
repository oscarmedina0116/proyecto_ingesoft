-- ============================================================================
-- UNAL SPACE — Módulo de Espacios Deportivos
-- Archivo: 05_views_and_queries.sql
-- Descripción: Vistas materializadas y consultas analíticas para
--              disponibilidad y Data Engineering.
-- Compatibilidad: PostgreSQL 16+ · DataGrip
-- Dependencias: 01, 02, 03, 04
-- ============================================================================

SET timezone = 'America/Bogota';

-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║  1. FUNCIÓN: Disponibilidad de franjas horarias por espacio y fecha    ║
-- ╚══════════════════════════════════════════════════════════════════════════╝
-- Devuelve las franjas de 1 hora disponibles para un espacio en una fecha dada.
-- Se generan las 15 franjas posibles (06:00–07:00, 07:00–08:00, … , 20:00–21:00)
-- y se excluyen las que ya estén ocupadas por reservas PENDIENTES o CONFIRMADAS.

CREATE OR REPLACE FUNCTION fn_disponibilidad_espacio(
    p_espacio_id UUID,
    p_fecha      DATE
)
RETURNS TABLE (
    espacio_nombre  VARCHAR,
    fecha           DATE,
    franja_inicio   TIMESTAMPTZ,
    franja_fin      TIMESTAMPTZ,
    hora_inicio     TIME,
    hora_fin        TIME,
    disponible      BOOLEAN
)
LANGUAGE sql
STABLE
AS $$
    WITH franjas AS (
        -- Genera las 15 franjas horarias de 1 hora: 06:00 a 21:00
        SELECT
            gs.slot_start AT TIME ZONE 'America/Bogota' AS franja_ini,
            (gs.slot_start + INTERVAL '1 hour') AT TIME ZONE 'America/Bogota' AS franja_f
        FROM generate_series(
            (p_fecha + '06:00'::time) AT TIME ZONE 'America/Bogota',
            (p_fecha + '20:00'::time) AT TIME ZONE 'America/Bogota',
            INTERVAL '1 hour'
        ) AS gs(slot_start)
    ),
    ocupadas AS (
        -- Reservas activas (PENDIENTE o CONFIRMADA) para ese espacio y fecha
        SELECT rango_horario
        FROM reservas
        WHERE espacio_id = p_espacio_id
          AND estado IN ('PENDIENTE', 'CONFIRMADA')
          AND (fecha_inicio AT TIME ZONE 'America/Bogota')::date = p_fecha
    )
    SELECT
        e.nombre::VARCHAR                         AS espacio_nombre,
        p_fecha                                   AS fecha,
        f.franja_ini                              AS franja_inicio,
        f.franja_f                                AS franja_fin,
        (f.franja_ini AT TIME ZONE 'America/Bogota')::time AS hora_inicio,
        (f.franja_f   AT TIME ZONE 'America/Bogota')::time AS hora_fin,
        NOT EXISTS (
            SELECT 1
            FROM ocupadas o
            WHERE o.rango_horario && tstzrange(f.franja_ini, f.franja_f, '[)')
        )                                         AS disponible
    FROM franjas f
    CROSS JOIN espacios_deportivos e
    WHERE e.id = p_espacio_id
    ORDER BY f.franja_ini;
$$;

COMMENT ON FUNCTION fn_disponibilidad_espacio(UUID, DATE) IS
    'Devuelve las 15 franjas horarias de 1 hora (06:00–21:00) para un espacio, '
    'indicando cuáles están disponibles y cuáles ocupadas.';


-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║  2. VISTA: v_disponibilidad_espacios                                   ║
-- ║     Wrapper amigable sobre la función para uso en DataGrip / BI        ║
-- ╚══════════════════════════════════════════════════════════════════════════╝
-- Para usar esta vista se filtra por espacio y fecha en el WHERE.
-- Ejemplo: SELECT * FROM v_disponibilidad_espacios
--          WHERE codigo_espacio = 'TCH-001' AND fecha = CURRENT_DATE;

CREATE OR REPLACE VIEW v_disponibilidad_espacios AS
SELECT
    e.id                AS espacio_id,
    e.codigo_interno    AS codigo_espacio,
    e.nombre            AS espacio_nombre,
    e.tipo              AS tipo_espacio,
    e.es_techado,
    d.fecha,
    d.hora_inicio,
    d.hora_fin,
    d.disponible
FROM espacios_deportivos e
CROSS JOIN LATERAL fn_disponibilidad_espacio(e.id, CURRENT_DATE) d
WHERE e.activo = TRUE;

COMMENT ON VIEW v_disponibilidad_espacios IS
    'Vista de disponibilidad en tiempo real. Filtrar por codigo_espacio y fecha.';


-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║  3. VISTA: v_resumen_reservas                                          ║
-- ║     Vista consolidada de reservas con joins de contexto                 ║
-- ╚══════════════════════════════════════════════════════════════════════════╝

CREATE OR REPLACE VIEW v_resumen_reservas AS
SELECT
    r.id                                          AS reserva_id,
    -- Estudiante
    u.nombres || ' ' || u.apellidos               AS estudiante,
    u.codigo_estudiantil,
    u.facultad,
    -- Espacio
    e.nombre                                      AS espacio,
    e.codigo_interno                               AS codigo_espacio,
    e.tipo                                        AS tipo_espacio,
    e.es_techado,
    -- Deporte
    dd.nombre                                     AS deporte,
    dd.codigo                                     AS deporte_codigo,
    -- Horario
    r.fecha_inicio AT TIME ZONE 'America/Bogota'  AS inicio_local,
    r.fecha_fin    AT TIME ZONE 'America/Bogota'  AS fin_local,
    (r.fecha_inicio AT TIME ZONE 'America/Bogota')::date AS fecha,
    (r.fecha_inicio AT TIME ZONE 'America/Bogota')::time AS hora_inicio,
    (r.fecha_fin    AT TIME ZONE 'America/Bogota')::time AS hora_fin,
    EXTRACT(EPOCH FROM (r.fecha_fin - r.fecha_inicio)) / 3600.0 AS duracion_horas,
    to_char(r.fecha_inicio AT TIME ZONE 'America/Bogota', 'Day')  AS dia_semana,
    -- Estado
    r.estado,
    r.motivo_cancelacion,
    r.creado_en AT TIME ZONE 'America/Bogota'     AS creado_en_local
FROM reservas r
    JOIN usuarios u              ON r.usuario_id    = u.id
    JOIN espacios_deportivos e   ON r.espacio_id    = e.id
    JOIN disciplinas_deportivas dd ON r.disciplina_id = dd.id;

COMMENT ON VIEW v_resumen_reservas IS
    'Vista consolidada de reservas con datos de estudiante, espacio y deporte para reportes.';


-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║  4. CONSULTA ANALÍTICA: Franjas con mayor tasa de ocupación por deporte║
-- ║     (Data Engineering / Business Intelligence)                         ║
-- ╚══════════════════════════════════════════════════════════════════════════╝

-- Esta consulta calcula la tasa de ocupación por franja horaria y deporte,
-- considerando todas las reservas CONFIRMADAS y FINALIZADAS.
-- Útil para identificar picos de demanda y optimizar la asignación de espacios.

-- Resultado: Ranking de franjas más demandadas por deporte.

-- NOTA: Se puede materializar como vista o ejecutar ad-hoc desde DataGrip.

-- ── 4.1 Vista analítica ────────────────────────────────────────────────
CREATE OR REPLACE VIEW v_ocupacion_franjas_por_deporte AS
WITH franjas_horarias AS (
    -- Genera las 15 franjas canónicas de 1 hora
    SELECT
        gs::time AS franja_inicio,
        (gs + INTERVAL '1 hour')::time AS franja_fin,
        to_char(gs, 'HH24:MI') || ' – ' || to_char(gs + INTERVAL '1 hour', 'HH24:MI') AS franja_label
    FROM generate_series(
        '2000-01-01 06:00:00'::timestamp,
        '2000-01-01 20:00:00'::timestamp,
        INTERVAL '1 hour'
    ) gs
),
reservas_activas AS (
    SELECT
        r.espacio_id,
        r.disciplina_id,
        dd.nombre                                           AS deporte,
        (r.fecha_inicio AT TIME ZONE 'America/Bogota')::time AS hora_inicio,
        (r.fecha_fin    AT TIME ZONE 'America/Bogota')::time AS hora_fin,
        (r.fecha_inicio AT TIME ZONE 'America/Bogota')::date AS fecha_reserva
    FROM reservas r
        JOIN disciplinas_deportivas dd ON r.disciplina_id = dd.id
    WHERE r.estado IN ('CONFIRMADA', 'FINALIZADA')
),
cruce AS (
    SELECT
        fh.franja_label,
        fh.franja_inicio,
        ra.deporte,
        COUNT(DISTINCT ra.fecha_reserva || '-' || ra.espacio_id) AS total_reservas
    FROM franjas_horarias fh
        JOIN reservas_activas ra
            ON ra.hora_inicio < fh.franja_fin
           AND ra.hora_fin   > fh.franja_inicio
    GROUP BY fh.franja_label, fh.franja_inicio, ra.deporte
)
SELECT
    c.deporte,
    c.franja_label                                          AS franja_horaria,
    c.total_reservas,
    ROUND(
        c.total_reservas * 100.0 /
        NULLIF(SUM(c.total_reservas) OVER (PARTITION BY c.deporte), 0),
        2
    )                                                       AS porcentaje_ocupacion,
    RANK() OVER (
        PARTITION BY c.deporte
        ORDER BY c.total_reservas DESC
    )                                                       AS ranking_demanda
FROM cruce c
ORDER BY c.deporte, c.total_reservas DESC, c.franja_inicio;

COMMENT ON VIEW v_ocupacion_franjas_por_deporte IS
    'Analítica: ranking de franjas horarias con mayor tasa de ocupación, '
    'segmentado por deporte. Útil para BI y Data Engineering.';


-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║  5. CONSULTAS DE EJEMPLO PARA DATAGRIP                                ║
-- ╚══════════════════════════════════════════════════════════════════════════╝

-- ── 5.1 Disponibilidad de Cancha Techada 1 para hoy ────────────────────
-- SELECT *
-- FROM fn_disponibilidad_espacio(
--     'b0000000-0000-4bbb-bbbb-000000000004'::uuid,
--     CURRENT_DATE
-- );

-- ── 5.2 Disponibilidad de un espacio en una fecha específica ────────────
-- SELECT *
-- FROM fn_disponibilidad_espacio(
--     'b0000000-0000-4bbb-bbbb-000000000004'::uuid,
--     '2026-09-14'::date
-- )
-- WHERE disponible = TRUE;

-- ── 5.3 Todas las reservas activas de la próxima semana ─────────────────
-- SELECT *
-- FROM v_resumen_reservas
-- WHERE estado IN ('PENDIENTE', 'CONFIRMADA')
--   AND fecha >= CURRENT_DATE
--   AND fecha < CURRENT_DATE + 7
-- ORDER BY fecha, hora_inicio;

-- ── 5.4 Franjas más demandadas por deporte ──────────────────────────────
-- SELECT * FROM v_ocupacion_franjas_por_deporte;

-- ── 5.5 Historial de auditoría de una reserva ──────────────────────────
-- SELECT
--     ar.estado_anterior,
--     ar.estado_nuevo,
--     ar.descripcion,
--     ar.realizado_por,
--     ar.creado_en AT TIME ZONE 'America/Bogota' AS fecha_local
-- FROM auditoria_reservas ar
-- WHERE ar.reserva_id = '<UUID_RESERVA>'
-- ORDER BY ar.creado_en;


-- ============================================================================
-- FIN 05_views_and_queries.sql
-- ============================================================================
