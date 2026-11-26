-- ============================================================================
-- UNAL SPACE — Módulo de Espacios Deportivos
-- Archivo: 03_triggers_and_validations.sql
-- Descripción: Triggers de validación de reglas de negocio y auditoría.
-- Compatibilidad: PostgreSQL 16+ · DataGrip
-- Dependencias: 02_schema_ddl.sql
-- ============================================================================

SET timezone = 'America/Bogota';

-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║  1. TRIGGER: Validación integral de reservas                           ║
-- ║     (BEFORE INSERT OR UPDATE en reservas)                              ║
-- ╚══════════════════════════════════════════════════════════════════════════╝

CREATE OR REPLACE FUNCTION fn_validar_reserva()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    v_hora_inicio   TIME;
    v_hora_fin      TIME;
    v_dia_semana    INT;          -- ISODOW: 1=Lunes … 7=Domingo
    v_duracion_min  DOUBLE PRECISION;
    v_fecha_local   DATE;
    v_reservas_dia  INT;
BEGIN
    -- ── Convertir a hora local de Bogotá ────────────────────────────────
    v_hora_inicio := (NEW.fecha_inicio AT TIME ZONE 'America/Bogota')::time;
    v_hora_fin    := (NEW.fecha_fin    AT TIME ZONE 'America/Bogota')::time;
    v_dia_semana  := EXTRACT(ISODOW FROM NEW.fecha_inicio AT TIME ZONE 'America/Bogota');
    v_fecha_local := (NEW.fecha_inicio AT TIME ZONE 'America/Bogota')::date;
    v_duracion_min := EXTRACT(EPOCH FROM (NEW.fecha_fin - NEW.fecha_inicio)) / 60.0;

    -- ── a) Validar día hábil (no fin de semana) ────────────────────────
    IF v_dia_semana NOT BETWEEN 1 AND 5 THEN
        RAISE EXCEPTION
            '[UNAL SPACE] Reserva rechazada: solo se permiten reservas de Lunes a Viernes. '
            'Día solicitado: % (ISODOW=%)',
            to_char(NEW.fecha_inicio AT TIME ZONE 'America/Bogota', 'Day'),
            v_dia_semana;
    END IF;

    -- ── b) Validar franja horaria 06:00 – 21:00 ────────────────────────
    IF v_hora_inicio < '06:00:00'::time THEN
        RAISE EXCEPTION
            '[UNAL SPACE] Reserva rechazada: la hora de inicio (%) es anterior a las 06:00 AM.',
            v_hora_inicio;
    END IF;

    IF v_hora_fin > '21:00:00'::time THEN
        RAISE EXCEPTION
            '[UNAL SPACE] Reserva rechazada: la hora de fin (%) excede las 09:00 PM.',
            v_hora_fin;
    END IF;

    -- ── c) Validar duración entre 60 y 120 minutos ─────────────────────
    IF v_duracion_min < 60 THEN
        RAISE EXCEPTION
            '[UNAL SPACE] Reserva rechazada: duración mínima es 1 hora (60 min). Duración solicitada: % min.',
            v_duracion_min;
    END IF;

    IF v_duracion_min > 120 THEN
        RAISE EXCEPTION
            '[UNAL SPACE] Reserva rechazada: duración máxima es 2 horas (120 min). Duración solicitada: % min.',
            v_duracion_min;
    END IF;

    -- ── d) Validar que el estudiante no tenga otra reserva activa ──────
    --       el mismo día que se solape con la franja solicitada.
    --       (Estados activos: PENDIENTE o CONFIRMADA)
    SELECT COUNT(*) INTO v_reservas_dia
    FROM reservas r
    WHERE r.usuario_id = NEW.usuario_id
      AND r.estado IN ('PENDIENTE', 'CONFIRMADA')
      AND (r.fecha_inicio AT TIME ZONE 'America/Bogota')::date = v_fecha_local
      AND r.rango_horario && tstzrange(NEW.fecha_inicio, NEW.fecha_fin, '[)')
      -- Excluir la propia fila en caso de UPDATE
      AND (TG_OP = 'INSERT' OR r.id <> NEW.id);

    IF v_reservas_dia > 0 THEN
        RAISE EXCEPTION
            '[UNAL SPACE] Reserva rechazada: el estudiante ya tiene una reserva activa '
            'en la misma franja horaria el día %. No se permiten solapamientos personales.',
            v_fecha_local;
    END IF;

    -- ── Validar que la disciplina esté permitida en el espacio ─────────
    IF NOT EXISTS (
        SELECT 1
        FROM espacio_deportes ed
        WHERE ed.espacio_id    = NEW.espacio_id
          AND ed.disciplina_id = NEW.disciplina_id
    ) THEN
        RAISE EXCEPTION
            '[UNAL SPACE] Reserva rechazada: la disciplina seleccionada no está '
            'habilitada para este espacio deportivo (espacio_id=%, disciplina_id=%).',
            NEW.espacio_id, NEW.disciplina_id;
    END IF;

    -- Actualizar timestamp de modificación en la reserva.
    NEW.actualizado_en := NOW();

    RETURN NEW;
END;
$$;

COMMENT ON FUNCTION fn_validar_reserva() IS
    'Valida reglas de negocio antes de insertar/actualizar una reserva: '
    'día hábil, horario 06-21h, duración 1-2h, sin solapamientos personales, '
    'y disciplina habilitada para el espacio.';

-- Asociar trigger a la tabla de reservas
DROP TRIGGER IF EXISTS trg_validar_reserva ON reservas;

CREATE TRIGGER trg_validar_reserva
    BEFORE INSERT OR UPDATE
    ON reservas
    FOR EACH ROW
    EXECUTE FUNCTION fn_validar_reserva();


-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║  2. TRIGGER: Auditoría automática de cambios de estado                 ║
-- ╚══════════════════════════════════════════════════════════════════════════╝

CREATE OR REPLACE FUNCTION fn_auditar_estado_reserva()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    -- Solo registrar si el estado realmente cambió, o si es un INSERT.
    IF TG_OP = 'INSERT' THEN
        INSERT INTO auditoria_reservas (reserva_id, estado_anterior, estado_nuevo, descripcion, realizado_por)
        VALUES (
            NEW.id,
            NULL,
            NEW.estado,
            'Reserva creada.',
            'SISTEMA'
        );
    ELSIF TG_OP = 'UPDATE' AND OLD.estado IS DISTINCT FROM NEW.estado THEN
        INSERT INTO auditoria_reservas (reserva_id, estado_anterior, estado_nuevo, descripcion, realizado_por)
        VALUES (
            NEW.id,
            OLD.estado,
            NEW.estado,
            CASE NEW.estado
                WHEN 'CONFIRMADA' THEN 'Reserva confirmada.'
                WHEN 'CANCELADA'  THEN COALESCE('Cancelada: ' || NEW.motivo_cancelacion, 'Reserva cancelada.')
                WHEN 'FINALIZADA' THEN 'Reserva finalizada (bloque horario transcurrido).'
                WHEN 'NO_SHOW'    THEN 'No-show: el estudiante no se presentó.'
                ELSE 'Cambio de estado registrado.'
            END,
            'SISTEMA'
        );
    END IF;

    RETURN NULL;  -- AFTER trigger: el valor de retorno se ignora
END;
$$;

COMMENT ON FUNCTION fn_auditar_estado_reserva() IS
    'Registra automáticamente en auditoria_reservas cada cambio de estado de una reserva.';

DROP TRIGGER IF EXISTS trg_auditar_estado_reserva ON reservas;

CREATE TRIGGER trg_auditar_estado_reserva
    AFTER INSERT OR UPDATE
    ON reservas
    FOR EACH ROW
    EXECUTE FUNCTION fn_auditar_estado_reserva();


-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║  3. TRIGGER: Auto-actualización de `actualizado_en` en usuarios        ║
-- ╚══════════════════════════════════════════════════════════════════════════╝

CREATE OR REPLACE FUNCTION fn_actualizar_timestamp()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.actualizado_en := NOW();
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_usuarios_actualizado ON usuarios;

CREATE TRIGGER trg_usuarios_actualizado
    BEFORE UPDATE
    ON usuarios
    FOR EACH ROW
    EXECUTE FUNCTION fn_actualizar_timestamp();

DROP TRIGGER IF EXISTS trg_espacios_actualizado ON espacios_deportivos;

CREATE TRIGGER trg_espacios_actualizado
    BEFORE UPDATE
    ON espacios_deportivos
    FOR EACH ROW
    EXECUTE FUNCTION fn_actualizar_timestamp();


-- ============================================================================
-- FIN 03_triggers_and_validations.sql
-- ============================================================================
