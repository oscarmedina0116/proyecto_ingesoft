# ADR-0001: Usar PostgreSQL 16+ como motor de base de datos relacional único

Autores:
 - Oscar David Ariza Rojas (@OarizaR)
 - Oscar Andrés Andrade Medina (@oscarmedina0116)
 - David Fernando Ordoñez Pérez (@dordonezpe)
 - Juan Sebastián Rodríguez León (@jrodriguezleo)
Fecha: 2026-11-10

## Estado

Aceptado

## Contexto

El sistema **UNALSpace** gestiona el catálogo, detalle físico, ubicación y reservas por franjas horarias de los espacios deportivos de la Universidad Nacional de Colombia (Sede Bogotá). El dominio exige garantías estrictas de consistencia:

1. **Prevención atómica de reservas traslapadas:** Dos estudiantes no pueden reservar el mismo espacio deportivo en rangos de tiempo que se solapen (`[fecha_inicio, fecha_fin)`), incluso bajo peticiones concurrentes.
2. **Reglas de negocio temporales en zona horaria local (`America/Bogota`):** Horario institucional de lunes a viernes (06:00 a 21:00), bloques exactos de 1 o 2 horas en punto y límite de una reserva activa por estudiante por día.
3. **Cálculo determinista de disponibilidad en tiempo real (`< 10 segundos`):** Tanto la vista `v_disponibilidad_espacios` como la función `fn_disponibilidad_espacio(UUID, DATE)` deben responder de manera inmediata sobre los 12 escenarios deportivos del campus.

## Decisión

Vamos a utilizar **exclusivamente PostgreSQL (versión 16+)** como único motor de base de datos del proyecto, accedido desde el backend en Node.js/TypeScript a través de **Prisma ORM** y consultas SQL parametrizadas sobre las funciones y vistas nativas del esquema (`01_extensions_and_enums.sql` a `05_views_and_queries.sql` / `DB-UnalSpace.sql`).

## Alternativas consideradas

- **Bases de datos NoSQL (MongoDB / Firebase Firestore):** Descartadas porque carecen de restricciones de exclusión espacial/temporal nativas como `EXCLUDE USING gist` con rangos `tstzrange`, lo que obligaría a implementar bloqueos distribuidos propensos a condiciones de carrera.
- **SQLite / MySQL:** Descartadas porque no soportan la extensión `btree_gist` combinada con tipos de rango temporal con zona horaria (`tstzrange`) ni operadores de solapamiento `&&` indexados con GiST.

## Consecuencias

- **Positivas:**
  - La restricción `EXCLUDE USING gist (espacio_id WITH =, rango_horario WITH &&) WHERE (estado IN ('PENDIENTE', 'CONFIRMADA'))` impide físicamente cualquier doble reserva a nivel del motor transaccional ACID.
  - Los tipos enumerados (`tipo_espacio`, `tipo_superficie`, `deporte_permitido`, `estado_reserva`), triggers (`fn_validar_reserva`) y la función `fn_disponibilidad_espacio` centralizan la integridad de datos sin duplicar lógica frágil.
- **Negativas / Costos aceptados:**
  - Requiere contar con una instancia activa de PostgreSQL 16+ (local o mediante `docker compose up -d`) para el entorno de desarrollo y pruebas de integración.
