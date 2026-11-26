-- ============================================================================
-- UNAL SPACE — Módulo de Espacios Deportivos
-- Archivo: 04_seed_data.sql
-- Descripción: Carga inicial de datos maestros, catálogo de espacios,
--              estudiantes de prueba y reservas de validación.
-- Compatibilidad: PostgreSQL 16+ · DataGrip
-- Dependencias: 01, 02, 03
-- ============================================================================

SET timezone = 'America/Bogota';

-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║  1. DISCIPLINAS DEPORTIVAS                                             ║
-- ╚══════════════════════════════════════════════════════════════════════════╝

INSERT INTO disciplinas_deportivas (id, nombre, codigo, descripcion) VALUES
    ('a1b2c3d4-1111-4aaa-aaaa-000000000001'::uuid,
     'Fútbol 11',        'FUTBOL_11',
     'Fútbol once tradicional en cancha reglamentaria.'),

    ('a1b2c3d4-1111-4aaa-aaaa-000000000002'::uuid,
     'Fútbol Sala',      'FUTBOL_SALA',
     'Microfútbol / Futsal en cancha reducida.'),

    ('a1b2c3d4-1111-4aaa-aaaa-000000000003'::uuid,
     'Baloncesto',        'BALONCESTO',
     'Basketball en cancha cubierta o descubierta.'),

    ('a1b2c3d4-1111-4aaa-aaaa-000000000004'::uuid,
     'Voleibol',          'VOLEIBOL',
     'Volleyball en cancha mixta.'),

    ('a1b2c3d4-1111-4aaa-aaaa-000000000005'::uuid,
     'Tenis',             'TENIS',
     'Tenis de campo en superficie de polvo de ladrillo.')
ON CONFLICT (codigo) DO NOTHING;


-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║  2. ESPACIOS DEPORTIVOS — Inventario completo (12 espacios)            ║
-- ╚══════════════════════════════════════════════════════════════════════════╝

-- ── 2.1 Estadio Alfonso López Pumarejo (1 cancha de fútbol 11) ──────────
INSERT INTO espacios_deportivos
    (id, nombre, codigo_interno, descripcion, tipo, superficie, ubicacion, edificio, es_techado, capacidad, es_mixta)
VALUES
    ('b0000000-0000-4bbb-bbbb-000000000001'::uuid,
     'Estadio Alfonso López Pumarejo – Cancha Principal',
     'EST-001',
     'Cancha principal de fútbol 11 con grama natural. Escenario con aforo masivo para eventos deportivos y culturales.',
     'ESTADIO', 'GRAMA_NATURAL',
     'Zona Deportiva Central, costado sur del campus',
     'Estadio Alfonso López',
     FALSE, 6000, FALSE);

-- ── 2.2 Concha Acústica – Edificio 761 (2 canchas mixtas) ──────────────
INSERT INTO espacios_deportivos
    (id, nombre, codigo_interno, descripcion, tipo, superficie, ubicacion, edificio, es_techado, capacidad, es_mixta)
VALUES
    ('b0000000-0000-4bbb-bbbb-000000000002'::uuid,
     'Concha Acústica – Cancha Mixta 1',
     'CON-001',
     'Primera cancha mixta dentro de la Concha Acústica (Edificio 761). Apta para fútbol sala, baloncesto y voleibol.',
     'CONCHA_ACUSTICA', 'CEMENTO',
     'Edificio 761, Zona Deportiva',
     '761',
     TRUE, 40, TRUE),

    ('b0000000-0000-4bbb-bbbb-000000000003'::uuid,
     'Concha Acústica – Cancha Mixta 2',
     'CON-002',
     'Segunda cancha mixta dentro de la Concha Acústica (Edificio 761). Apta para fútbol sala, baloncesto y voleibol.',
     'CONCHA_ACUSTICA', 'CEMENTO',
     'Edificio 761, Zona Deportiva',
     '761',
     TRUE, 40, TRUE);

-- ── 2.3 Canchas Techadas (2 canchas mixtas cubiertas) ───────────────────
INSERT INTO espacios_deportivos
    (id, nombre, codigo_interno, descripcion, tipo, superficie, ubicacion, edificio, es_techado, capacidad, es_mixta)
VALUES
    ('b0000000-0000-4bbb-bbbb-000000000004'::uuid,
     'Cancha Techada Mixta 1',
     'TCH-001',
     'Primera cancha mixta cubierta contigua al anillo vial. Superficie sintética. Apta para fútbol sala, baloncesto y voleibol.',
     'CANCHA_TECHADA', 'CAUCHO_SINTETICO',
     'Bloques blancos contiguos al anillo vial, Zona Deportiva',
     NULL,
     TRUE, 30, TRUE),

    ('b0000000-0000-4bbb-bbbb-000000000005'::uuid,
     'Cancha Techada Mixta 2',
     'TCH-002',
     'Segunda cancha mixta cubierta contigua al anillo vial. Superficie sintética. Apta para fútbol sala, baloncesto y voleibol.',
     'CANCHA_TECHADA', 'CAUCHO_SINTETICO',
     'Bloques blancos contiguos al anillo vial, Zona Deportiva',
     NULL,
     TRUE, 30, TRUE);

-- ── 2.4 Canchas Destechadas Mixtas (3 polideportivas al aire libre) ────
INSERT INTO espacios_deportivos
    (id, nombre, codigo_interno, descripcion, tipo, superficie, ubicacion, edificio, es_techado, capacidad, es_mixta)
VALUES
    ('b0000000-0000-4bbb-bbbb-000000000006'::uuid,
     'Cancha Destechada Mixta 1',
     'DES-001',
     'Cancha polideportiva descubierta #1. Al aire libre. Apta para fútbol sala, baloncesto y voleibol.',
     'CANCHA_DESTECHADA', 'CEMENTO',
     'Zona Deportiva, sector canchas al aire libre',
     NULL,
     FALSE, 30, TRUE),

    ('b0000000-0000-4bbb-bbbb-000000000007'::uuid,
     'Cancha Destechada Mixta 2',
     'DES-002',
     'Cancha polideportiva descubierta #2. Al aire libre. Apta para fútbol sala, baloncesto y voleibol.',
     'CANCHA_DESTECHADA', 'CEMENTO',
     'Zona Deportiva, sector canchas al aire libre',
     NULL,
     FALSE, 30, TRUE),

    ('b0000000-0000-4bbb-bbbb-000000000008'::uuid,
     'Cancha Destechada Mixta 3',
     'DES-003',
     'Cancha polideportiva descubierta #3. Al aire libre. Apta para fútbol sala, baloncesto y voleibol.',
     'CANCHA_DESTECHADA', 'CEMENTO',
     'Zona Deportiva, sector canchas al aire libre',
     NULL,
     FALSE, 30, TRUE);

-- ── 2.5 Cancha de Baloncesto Azul (1 destechada, exclusiva baloncesto) ──
INSERT INTO espacios_deportivos
    (id, nombre, codigo_interno, descripcion, tipo, superficie, ubicacion, edificio, es_techado, capacidad, es_mixta)
VALUES
    ('b0000000-0000-4bbb-bbbb-000000000009'::uuid,
     'Cancha de Baloncesto Azul',
     'BAL-001',
     'Cancha destechada exclusiva de baloncesto con superficie azul. Al aire libre.',
     'CANCHA_DESTECHADA', 'CAUCHO_SINTETICO',
     'Zona Deportiva, junto a canchas polideportivas',
     NULL,
     FALSE, 20, FALSE);

-- ── 2.6 Canchas de Tenis (3 en polvo de ladrillo) ──────────────────────
INSERT INTO espacios_deportivos
    (id, nombre, codigo_interno, descripcion, tipo, superficie, ubicacion, edificio, es_techado, capacidad, es_mixta)
VALUES
    ('b0000000-0000-4bbb-bbbb-000000000010'::uuid,
     'Cancha de Tenis 1',
     'TEN-001',
     'Cancha de tenis #1 en polvo de ladrillo (clay). Superficie naranja.',
     'CANCHA_TENIS', 'POLVO_DE_LADRILLO',
     'Zona Deportiva, sector tenis',
     NULL,
     FALSE, 4, FALSE),

    ('b0000000-0000-4bbb-bbbb-000000000011'::uuid,
     'Cancha de Tenis 2',
     'TEN-002',
     'Cancha de tenis #2 en polvo de ladrillo (clay). Superficie naranja.',
     'CANCHA_TENIS', 'POLVO_DE_LADRILLO',
     'Zona Deportiva, sector tenis',
     NULL,
     FALSE, 4, FALSE),

    ('b0000000-0000-4bbb-bbbb-000000000012'::uuid,
     'Cancha de Tenis 3',
     'TEN-003',
     'Cancha de tenis #3 en polvo de ladrillo (clay). Superficie naranja.',
     'CANCHA_TENIS', 'POLVO_DE_LADRILLO',
     'Zona Deportiva, sector tenis',
     NULL,
     FALSE, 4, FALSE);


-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║  3. RELACIÓN ESPACIO ↔ DEPORTES PERMITIDOS                             ║
-- ╚══════════════════════════════════════════════════════════════════════════╝

-- Estadio → Fútbol 11
INSERT INTO espacio_deportes (espacio_id, disciplina_id) VALUES
    ('b0000000-0000-4bbb-bbbb-000000000001'::uuid, 'a1b2c3d4-1111-4aaa-aaaa-000000000001'::uuid);

-- Concha Acústica (2 canchas) → Fútbol Sala, Baloncesto, Voleibol
INSERT INTO espacio_deportes (espacio_id, disciplina_id) VALUES
    -- CON-001
    ('b0000000-0000-4bbb-bbbb-000000000002'::uuid, 'a1b2c3d4-1111-4aaa-aaaa-000000000002'::uuid),
    ('b0000000-0000-4bbb-bbbb-000000000002'::uuid, 'a1b2c3d4-1111-4aaa-aaaa-000000000003'::uuid),
    ('b0000000-0000-4bbb-bbbb-000000000002'::uuid, 'a1b2c3d4-1111-4aaa-aaaa-000000000004'::uuid),
    -- CON-002
    ('b0000000-0000-4bbb-bbbb-000000000003'::uuid, 'a1b2c3d4-1111-4aaa-aaaa-000000000002'::uuid),
    ('b0000000-0000-4bbb-bbbb-000000000003'::uuid, 'a1b2c3d4-1111-4aaa-aaaa-000000000003'::uuid),
    ('b0000000-0000-4bbb-bbbb-000000000003'::uuid, 'a1b2c3d4-1111-4aaa-aaaa-000000000004'::uuid);

-- Canchas Techadas (2) → Fútbol Sala, Baloncesto, Voleibol
INSERT INTO espacio_deportes (espacio_id, disciplina_id) VALUES
    -- TCH-001
    ('b0000000-0000-4bbb-bbbb-000000000004'::uuid, 'a1b2c3d4-1111-4aaa-aaaa-000000000002'::uuid),
    ('b0000000-0000-4bbb-bbbb-000000000004'::uuid, 'a1b2c3d4-1111-4aaa-aaaa-000000000003'::uuid),
    ('b0000000-0000-4bbb-bbbb-000000000004'::uuid, 'a1b2c3d4-1111-4aaa-aaaa-000000000004'::uuid),
    -- TCH-002
    ('b0000000-0000-4bbb-bbbb-000000000005'::uuid, 'a1b2c3d4-1111-4aaa-aaaa-000000000002'::uuid),
    ('b0000000-0000-4bbb-bbbb-000000000005'::uuid, 'a1b2c3d4-1111-4aaa-aaaa-000000000003'::uuid),
    ('b0000000-0000-4bbb-bbbb-000000000005'::uuid, 'a1b2c3d4-1111-4aaa-aaaa-000000000004'::uuid);

-- Canchas Destechadas Mixtas (3) → Fútbol Sala, Baloncesto, Voleibol
INSERT INTO espacio_deportes (espacio_id, disciplina_id) VALUES
    -- DES-001
    ('b0000000-0000-4bbb-bbbb-000000000006'::uuid, 'a1b2c3d4-1111-4aaa-aaaa-000000000002'::uuid),
    ('b0000000-0000-4bbb-bbbb-000000000006'::uuid, 'a1b2c3d4-1111-4aaa-aaaa-000000000003'::uuid),
    ('b0000000-0000-4bbb-bbbb-000000000006'::uuid, 'a1b2c3d4-1111-4aaa-aaaa-000000000004'::uuid),
    -- DES-002
    ('b0000000-0000-4bbb-bbbb-000000000007'::uuid, 'a1b2c3d4-1111-4aaa-aaaa-000000000002'::uuid),
    ('b0000000-0000-4bbb-bbbb-000000000007'::uuid, 'a1b2c3d4-1111-4aaa-aaaa-000000000003'::uuid),
    ('b0000000-0000-4bbb-bbbb-000000000007'::uuid, 'a1b2c3d4-1111-4aaa-aaaa-000000000004'::uuid),
    -- DES-003
    ('b0000000-0000-4bbb-bbbb-000000000008'::uuid, 'a1b2c3d4-1111-4aaa-aaaa-000000000002'::uuid),
    ('b0000000-0000-4bbb-bbbb-000000000008'::uuid, 'a1b2c3d4-1111-4aaa-aaaa-000000000003'::uuid),
    ('b0000000-0000-4bbb-bbbb-000000000008'::uuid, 'a1b2c3d4-1111-4aaa-aaaa-000000000004'::uuid);

-- Cancha Baloncesto Azul → Solo Baloncesto
INSERT INTO espacio_deportes (espacio_id, disciplina_id) VALUES
    ('b0000000-0000-4bbb-bbbb-000000000009'::uuid, 'a1b2c3d4-1111-4aaa-aaaa-000000000003'::uuid);

-- Canchas de Tenis (3) → Solo Tenis
INSERT INTO espacio_deportes (espacio_id, disciplina_id) VALUES
    ('b0000000-0000-4bbb-bbbb-000000000010'::uuid, 'a1b2c3d4-1111-4aaa-aaaa-000000000005'::uuid),
    ('b0000000-0000-4bbb-bbbb-000000000011'::uuid, 'a1b2c3d4-1111-4aaa-aaaa-000000000005'::uuid),
    ('b0000000-0000-4bbb-bbbb-000000000012'::uuid, 'a1b2c3d4-1111-4aaa-aaaa-000000000005'::uuid);


-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║  4. ESTUDIANTES DE PRUEBA (3 ficticios)                                ║
-- ╚══════════════════════════════════════════════════════════════════════════╝

INSERT INTO usuarios (id, nombres, apellidos, documento, codigo_estudiantil, correo, facultad) VALUES
    ('c0000000-0000-4ccc-cccc-000000000001'::uuid,
     'Camila Andrea', 'Rodríguez Muñoz',
     '1032500001', '2021234501',
     'carodriguezm@unal.edu.co',
     'Facultad de Ingeniería'),

    ('c0000000-0000-4ccc-cccc-000000000002'::uuid,
     'Santiago', 'Gómez Patiño',
     '1032500002', '2020198702',
     'sgomezp@unal.edu.co',
     'Facultad de Ciencias'),

    ('c0000000-0000-4ccc-cccc-000000000003'::uuid,
     'Valentina', 'López Herrera',
     '1032500003', '2022345603',
     'vlopezh@unal.edu.co',
     'Facultad de Derecho, Ciencias Políticas y Sociales')
ON CONFLICT (documento) DO NOTHING;


-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║  5. RESERVAS DE PRUEBA (3 válidas — próxima semana hábil)              ║
-- ╚══════════════════════════════════════════════════════════════════════════╝
-- Se calculan fechas dinámicamente para la próxima semana hábil (lun-vie).
-- Usamos un bloque DO para calcular el próximo lunes.

DO $$
DECLARE
    v_proximo_lunes DATE;
BEGIN
    -- Calcular el próximo lunes a partir de hoy.
    v_proximo_lunes := CURRENT_DATE + ((8 - EXTRACT(ISODOW FROM CURRENT_DATE)::int) % 7);
    -- Si hoy es lunes, saltamos a la siguiente semana.
    IF EXTRACT(ISODOW FROM CURRENT_DATE) = 1 THEN
        v_proximo_lunes := CURRENT_DATE + 7;
    END IF;

    -- Reserva 1: Camila → Fútbol Sala en Cancha Techada 1, lunes 08:00-09:30
    INSERT INTO reservas (usuario_id, espacio_id, disciplina_id, fecha_inicio, fecha_fin, estado)
    VALUES (
        'c0000000-0000-4ccc-cccc-000000000001'::uuid,   -- Camila
        'b0000000-0000-4bbb-bbbb-000000000004'::uuid,   -- Cancha Techada 1
        'a1b2c3d4-1111-4aaa-aaaa-000000000002'::uuid,   -- Fútbol Sala
        (v_proximo_lunes + '08:00'::time) AT TIME ZONE 'America/Bogota',
        (v_proximo_lunes + '09:30'::time) AT TIME ZONE 'America/Bogota',
        'CONFIRMADA'
    );

    -- Reserva 2: Santiago → Tenis en Cancha de Tenis 2, martes 10:00-11:00
    INSERT INTO reservas (usuario_id, espacio_id, disciplina_id, fecha_inicio, fecha_fin, estado)
    VALUES (
        'c0000000-0000-4ccc-cccc-000000000002'::uuid,   -- Santiago
        'b0000000-0000-4bbb-bbbb-000000000011'::uuid,   -- Cancha de Tenis 2
        'a1b2c3d4-1111-4aaa-aaaa-000000000005'::uuid,   -- Tenis
        (v_proximo_lunes + 1 + '10:00'::time) AT TIME ZONE 'America/Bogota',  -- Martes
        (v_proximo_lunes + 1 + '11:00'::time) AT TIME ZONE 'America/Bogota',
        'PENDIENTE'
    );

    -- Reserva 3: Valentina → Baloncesto en Cancha Baloncesto Azul, miércoles 14:00-16:00
    INSERT INTO reservas (usuario_id, espacio_id, disciplina_id, fecha_inicio, fecha_fin, estado)
    VALUES (
        'c0000000-0000-4ccc-cccc-000000000003'::uuid,   -- Valentina
        'b0000000-0000-4bbb-bbbb-000000000009'::uuid,   -- Cancha Baloncesto Azul
        'a1b2c3d4-1111-4aaa-aaaa-000000000003'::uuid,   -- Baloncesto
        (v_proximo_lunes + 2 + '14:00'::time) AT TIME ZONE 'America/Bogota',  -- Miércoles
        (v_proximo_lunes + 2 + '16:00'::time) AT TIME ZONE 'America/Bogota',
        'CONFIRMADA'
    );
END $$;


-- ============================================================================
-- FIN 04_seed_data.sql
-- ============================================================================
