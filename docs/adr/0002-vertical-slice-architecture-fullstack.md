# ADR-0002: Adoptar Vertical Slice Architecture (VSA) en Backend y Frontend

Autores:
 - Oscar David Ariza Rojas (@OarizaR)
 - Oscar Andrés Andrade Medina (@oscarmedina0116)
 - David Fernando Ordoñez Pérez (@dordonezpe)
 - Juan Sebastián Rodríguez León (@jrodriguezleo)
Fecha: 2026-11-10

## Estado

Aceptado

## Contexto

En el desarrollo incremental bajo Scrum de **UNALSpace**, cada Sprint entrega casos de uso funcionales de punta a punta (como `REQ-01: Consultar Detalle y Ubicación de Espacios` y `REQ-02: Consultar Disponibilidad de Espacios`). En una arquitectura tradicional por capas horizontales (`controllers/`, `services/`, `repositories/`, `models/` globales), modificar o agregar un requisito obliga a tocar múltiples carpetas dispersas, incrementando los conflictos de mezcla (`git merge`) entre integrantes del equipo y el acoplamiento entre casos de uso.

## Decisión

Vamos a estructurar tanto el **Backend (Node.js + Express + TypeScript)** como el **Frontend (React 19 + Vite + TanStack Query)** siguiendo estrictamente **Vertical Slice Architecture (VSA)**:

1. **Backend (`backend/src/features/<nombre-slice>/`):** Cada caso de uso encapsula en su propio directorio su controlador Express (`*.controller.ts`), servicio de aplicación (`*.service.ts`), objeto de consulta a PostgreSQL (`*.query.ts`) y contratos de datos (`*.dto.ts`).
2. **Frontend (`frontend/src/features/<nombre-slice>/`):** Cada funcionalidad encapsula sus vistas y componentes React (`*.tsx`), su servicio y hooks de React Query (`use-*.ts`) y sus tipos (`*.types.ts`).
3. **Capa Compartida (`shared/`):** Limitada exclusivamente a infraestructura transversal mínima (cliente singleton Prisma, inicializador de esquema PostgreSQL, middleware JWT `@unal.edu.co`, manejador global de errores/timeout de 10s, cliente HTTP `ApiClient` y componente `Toast`).

## Alternativas consideradas

- **Arquitectura en Capas Horizontales (N-Tier / MVC clásico):** Descartada porque dispersa la lógica de un mismo requisito de negocio en 4 o 5 directorios globales y dificulta el trabajo paralelo por caso de uso.
- **Arquitectura Hexagonal pesada con múltiples capas de abstracción por entidad:** Descartada por introducir código repetitivo innecesario para consultas directas sobre vistas y funciones nativas de PostgreSQL.

## Consecuencias

- **Positivas:**
  - Alta cohesión dentro de cada slice (`get-sports-spaces`, `get-space-detail`, `check-space-availability`) y bajo acoplamiento entre funcionalidades.
  - Trazabilidad directa entre las historias de usuario (`REQ-01`, `REQ-02`) y las carpetas del código fuente.
- **Negativas / Costos aceptados:**
  - Exige disciplina del equipo para no introducir carpetas horizontales globales y mantener `shared/` libre de lógica de negocio específica.
