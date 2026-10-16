<!--
HOW TO USE THIS TEMPLATE
------------------------
1. Copy this file and rename it to the requirement's ID, e.g. REQ-01.md.
2. Fill in every section. If a section genuinely does not apply to this
   requirement (not every requirement has a Business Rule or a Constraint),
   write "N/A — none identified" and say why in one line. Never invent
   content to fill a blank cell — that breaks the rule we've followed since
   Class 8: specification is not invention.
3. If something is unknown rather than inapplicable, use the Open
   Questions section instead of guessing.
4. See REQ-07_Example.md (Food Delivery System) for a fully filled-in
   reference before you start.
-->

# [REQ-01] — Consulta de detalle y ubicación de espacios universitarios

| | |
|---|---|
| **Status** | Ready |
| **Team / Author(s)** | Oscar Andres Andrade Medina, Oscar David Ariza Rojas, David Fernando Ordoñez Pérez, Juan Sebastián Rodríguez León |
| **Date** | 09 de Octubre de 2026 |
| **Linked User Story / AC** | HU-001 "User Story UNAL-SPACE" — Criterios de Aceptación #1 y #2 |

---

## 1. Overview

**Requirement Statement**
> El sistema deberá mostrar la información detallada de los espacios del campus (tales como canchas y laboratorios), incluyendo su imagen representativa, su descripción de características físicas y su ubicación de referencia.

**Type:** Functional (Filtro de la Tecnología Perfecta: con una computadora perfecta —velocidad infinita, memoria ilimitada, cero fallos— el estudiante seguiría necesitando ver la foto, las características y la ubicación del espacio. La necesidad no desaparece → funcional).

**Source / Evidence**
> Entrevista mediada en clase para conocer los requerimientos y opiniones sobre la centralización y prioridad del servicio como objeto de situación cotidiana.

**Need**
> Saber cómo es un espacio del campus y dónde está, para reconocerlo y llegar a él sin perderse.

**Value / Rationale**
> Identificar fácilmente los espacios y orientarse correctamente dentro de la universidad.

---

## 2. Context — A Requirement Rarely Stands Alone

**Business Rule(s)**
> N/A — none identified.

**Constraint(s)**
> N/A — none identified.

**Assumption(s)**
> - Cada espacio tiene un identificador único, ya que el sistema maneja validaciones de "ID inválido" y enlaces directos a un espacio.
> - Existe un panel administrativo desde el cual se gestiona la información de los espacios. (No verificado formalmente en este requerimiento).
> - Las imágenes y datos descriptivos de los espacios se almacenan en una base de datos centralizada. (No verificado).

**Dependenc(ies)**
> - Base de datos con la información de los espacios (imagen, características, ubicación).
> - Panel administrativo que permita cargar y actualizar esa información.
> - Conexión a internet estable por parte del estudiante.

**Risk(s)**
> Derivados principalmente de los escenarios de manejo de errores en la carga de datos.

| Risk | Likelihood | Impact | Mitigation (optional) |
|---|---|---|---|
| Espacio sin fotografía cargada | Medio | Alto | Mostrar imagen por defecto "Imagen no disponible" sin romper el diseño de la interfaz. |
| Datos de características físicas incompletos | Medio | Alto | Mostrar texto por defecto "Características físicas aún no registradas". |
| Fallo de conexión o timeout | Medio | Bajo | Desplegar Toast: "Error de conexión. No se pudo cargar la información detallada del espacio. Revisa tu conexión a internet e inténtalo nuevamente." |
| Enlace a un espacio borrado (ID inválido) | Bajo | Bajo | Mostrar mensaje: "El espacio solicitado no existe o fue retirado del sistema." |

**Open Questions**
> 1. **Enlace a evidencia primaria:** Queda pendiente anexar el link o referencia exacta al acta/minuta de la entrevista en clase de donde salió este requerimiento.
> 2. **Arquitectura y Almacenamiento de Imágenes:** A nivel técnico aún no se ha definido dónde se alojarán las imágenes representativas (¿AWS S3, Firebase, servidor propio?) ni cuál será el peso máximo permitido para no afectar el tiempo de carga.
> 3. **Atributo de "Estado" del Espacio:** Queda por definir en la arquitectura si el modelo de datos requerirá mostrar en esta vista un estado dinámico (ej. "Disponible", "Ocupado") o solo información estática.
> 4. **Escalabilidad de la Ubicación:** Para el MVP usaremos ubicación textual/relativa. ¿Se integrará un mapa interactivo (API de Google Maps/coordenadas) en una fase 2 de desarrollo?

---

## 3. Priority & Estimation

**Priority model used:** MoSCoW
**Priority assigned:** (M) Must Have

> Debido a que el objetivo fundamental de UNAL-SPACE es resolver el problema de desorientación de los estudiantes mostrando qué es y dónde está un espacio, le asignamos **Must Have**, aceptando el costo de dedicar el mayor esfuerzo inicial a estructurar la base de datos de imágenes y ubicaciones, postergando características secundarias (como reservas o perfiles). Consideramos asignarle **Should Have**, pero lo descartamos porque si el estudiante puede entrar a la app pero no ver la foto ni la ubicación del espacio, el producto no entrega ningún valor y la necesidad principal queda sin resolver.

**Estimate (confidence):** Medium
> **How sure are we about the size and shape of this work?** Tenemos una confianza Media (Medium). Aunque a nivel de interfaz de usuario es un flujo estándar (seleccionar un ítem y ver su detalle), la arquitectura detrás de este trabajo aún tiene incertidumbre técnica documentada en nuestras *Open Questions*. Específicamente, falta la definición sobre el almacenamiento de imágenes y la posibilidad de estructurar la ubicación previendo una futura integración de mapas.

---

## 4. Representations — Requirement ≠ Representation

### 4.1 User Story

> Como **[estudiante]**,
> quiero **[consultar la información de los diferentes espacios del campus (fotografía representativa, características físicas y ubicación de referencia)]**,
> tal que **[pueda identificarlos fácilmente y orientarme correctamente dentro de la universidad]**.

### 4.2 Acceptance Criteria

*(At least two scenarios: one normal path, one alternative or exception.)*

**Scenario 1 — [Información visual y descriptiva del espacio]**
> **Given** [que soy un estudiante que navega en la sección de espacios universitarios]
> **When** [selecciono un espacio específico]
> **Then** [el sistema despliega una imagen representativa clara (sin distorsión ni pixelado según la pantalla) del espacio y la descripción de sus características físicas (ej. capacidad, equipamiento o tipo de espacio).]

**Scenario 2 — [Ubicación física y relativa dentro del campus]**
> **Given** [que estoy consultando el detalle de un espacio universitario]
> **When** [reviso el apartado de ubicación]
> **Then** [el sistema muestra el nombre o número del edificio en el que se encuentra y su ubicación relativa en el campus (ej. "Edificio A, 2° piso, al lado de la biblioteca principal").]

**Scenario 3 — [Ausencia de fotografía (alternativa)]**
> **Given** [que el espacio seleccionado no tiene una imagen cargada en la base de datos]
> **When** [consulto su detalle]
> **Then** [el sistema muestra una imagen por defecto que dice "Imagen no disponible", sin romper el diseño visual de la pantalla.]

**Scenario 4 — [Datos incompletos (alternativa)]**
> **Given** [que faltan datos de características físicas del espacio]
> **When** [consulto su detalle]
> **Then** [el sistema muestra el texto "Características físicas aún no registradas" en lugar de un espacio en blanco o errores de código.]

**Scenario 5 — [Fallo de conexión o timeout (excepción)]**
> **Given** [que estoy consultando el detalle de un espacio]
> **When** [ocurre un fallo de conexión o timeout en el dispositivo]
> **Then** [el sistema muestra una alerta tipo toast: "Error de conexión. No se pudo cargar la información detallada del espacio. Revisa tu conexión a internet e inténtalo nuevamente."]

**Scenario 6 — [Espacio no encontrado (excepción)]**
> **Given** [que ingreso a través de un enlace a un espacio que fue borrado (ID inválido)]
> **When** [el sistema intenta cargar la vista de detalle]
> **Then** [el sistema muestra el mensaje: "El espacio solicitado no existe o fue retirado del sistema."]

### 4.3 Use Case

| Field | |
|---|---|
| **Use Case name** | Consultar detalle de un espacio del campus |
| **Actor** | Estudiante |
| **Goal** | Conocer la imagen, características físicas y ubicación de un espacio para identificarlo y llegar a él |
| **Trigger** | El estudiante selecciona un espacio en la lista de espacios universitarios |
| **Precondition** | El estudiante se encuentra en la aplicación y tiene conexión a la red |

**Main Flow**
> 1. El estudiante navega en la sección de espacios universitarios.
> 2. El estudiante selecciona un espacio específico de la lista.
> 3. El sistema busca la información asociada al identificador del espacio.
> 4. El sistema despliega la imagen representativa y la descripción de las características físicas del espacio.
> 5. El estudiante revisa el apartado de ubicación y el sistema muestra el edificio y la ubicación relativa en el campus.

**Alternative Flow**
> - [El espacio no tiene imagen] → [el sistema muestra la imagen por defecto "Imagen no disponible" en el paso 4 y continúa el flujo normal.]
> - [Faltan características físicas] → [el sistema muestra "Características físicas aún no registradas" en el paso 4 y continúa el flujo normal.]

**Exception**
> - [Fallo de conexión o timeout] → [En el paso 3, el sistema muestra un toast de error de conexión y detiene el caso de uso.]
> - [ID de espacio inválido (borrado)] → [En el paso 3, el sistema muestra el mensaje "El espacio solicitado no existe o fue retirado" y detiene el caso de uso.]

**Postcondition**
> El estudiante ha visualizado la información disponible del espacio (o ha sido informado claramente de por qué no se pudo cargar) y puede utilizar estos datos para ubicar el lugar en el campus.

**Flow Diagram**

```mermaid
graph TD
    %% Inicio del flujo
    A([Estudiante selecciona un espacio]) --> B{¿Error de conexión o Timeout?}
    
    %% Excepciones
    B -- Sí --> C[Mostrar Toast: 'Error de conexión']
    C --> Z([Fin del Caso de Uso])
    B -- No --> D{¿ID del espacio es válido?}
    
    D -- No --> E[Mostrar: 'El espacio no existe']
    E --> Z
    
    %% Flujo Principal y Alternativas
    D -- Sí --> F{¿Tiene fotografía cargada?}
    
    F -- No --> G[Mostrar imagen por defecto 'Imagen no disponible']
    F -- Sí --> H[Desplegar imagen representativa]
    
    G --> I{¿Tiene características físicas?}
    H --> I
    
    I -- No --> J[Mostrar: 'Características físicas aún no registradas']
    I -- Sí --> K[Desplegar descripción de características]
    
    J --> L[Mostrar edificio y ubicación relativa en el campus]
    K --> L
    
    L --> Z
    
    %% Estilos para diferenciar flujos
    classDef mainFlow fill:#d4edda,stroke:#28a745,stroke-width:2px,color:#000;
    classDef altFlow fill:#fff3cd,stroke:#ffc107,stroke-width:2px,color:#000;
    classDef excFlow fill:#f8d7da,stroke:#dc3545,stroke-width:2px,color:#000;
    
    class H,K,L mainFlow;
    class G,J altFlow;
    class C,E excFlow;
