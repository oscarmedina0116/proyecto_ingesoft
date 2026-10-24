# Design Deliverable 1: Architectural and Detailed Design

**Project Name:** UNAL-SPACE  
**Team Members:** Oscar Andres Andrade Medina, Oscar David Ariza Rojas, David Fernando Ordoñez Pérez, Juan Sebastián Rodríguez León  
**Version:** v1.1 (2026-10-24). Incorpora las decisiones B1 a B4 del AI Decision Log de la Clase 15 y los cambios C1 a C9 que surgieron en `02_Interaction_and_Data_Design.md` (ver "Historial de cambios" al final).

## 1. Design Drivers
| ID | Descripción | Tipo | Fuente | Consecuencia para el diseño |
|---|---|---|---|---|
| **DDR-01** | Consulta del estado de disponibilidad al momento de la búsqueda. | Funcional | REQ-02 | Obliga a crear un `Motor de disponibilidad y horarios` que calcule el estado en tiempo real para todos los espacios de una búsqueda. |
| **DDR-02** | Consulta de detalle, imagen y ubicación de espacios. | Funcional | REQ-01 | `Gestión de espacios y elementos` es dueño de los atributos físicos del espacio y los entrega integrados. |
| **DDR-03** | Tiempo de respuesta del backend y renderizado < 10 segundos bajo carga. | Restricción de Calidad | HU-002 | Se introduce un `API_GW` que gestiona de forma centralizada los timeouts e interrupciones de red, y la disponibilidad se calcula con una sola consulta indexada por búsqueda. |
| **DDR-04** | Acceso exclusivo para usuarios de la universidad. | Restricción de Seguridad | Diagrama Base | Se usa el componente `Autenticación (@unal / JWT)`, integrado desde el Gateway. |

## 2. Architectural Design
La arquitectura sigue un patrón por capas centralizado en un API Gateway, que prioriza el enrutamiento seguro y la orquestación. Por directriz del equipo docente, el diagrama arquitectónico de componentes se adjunta como imagen y representa los módulos seleccionados.

![Diagrama Arquitectónico de Capas](./diagrams/01_component_diagram.jpg)

**Justificación:** 
El Gateway enruta las peticiones hacia componentes cohesivos de la Capa Lógica. La lógica de reservas la orquesta `Gestión Reservas`, que se apoya en componentes especializados: el cálculo temporal (`Motor de disponibilidad`), la información de los espacios (`Gestión de espacios y elementos`) y el envío asíncrono de avisos (`Servicio de notificación`). La persistencia se unifica en una base de datos relacional (`PostgresSQL`), donde cada tabla tiene un único componente dueño y se accede a ella solo mediante el repositorio de ese dueño.

## 3. Responsibilities and Traceability

### Tabla de Responsabilidades
| Componente | Responsabilidad Principal | Capacidades Proporcionadas | Dependencias Requeridas |
|---|---|---|---|
| **APP-WEB** | Renderizar la UI y los listados, e invocar la API. | Interfaz de búsqueda y de detalle de espacios. Textos por defecto y *placeholders* cuando faltan datos. | API_GW |
| **API_GW** | Enrutar peticiones y controlar fallos y timeouts. | Resolución de peticiones, timeout de 10 s (DDR-03), traducción de errores a respuestas de servicio. | Autenticación, Capa Lógica |
| **Autenticación** | Validar la identidad institucional. | Emisión y validación de tokens JWT (`validarToken`). Dueño de los usuarios y sus roles. | PostgresSQL |
| **Gestión de espacios y elementos** | Mantener el catálogo de espacios del campus. | `buscarEspacios(texto)`, `obtenerDetalle(espacioId)`. Alta, edición y retiro de espacios por el administrador. | PostgresSQL (mediante `EspacioRepository`) |
| **Gestión Reservas** | Orquestar la creación de reservas y la consulta de espacios con su estado. | `crearReserva(...)`, `consultarEspaciosConEstado(texto)`. Dueño de las reservas. | Motor de Disponibilidad, Gestión de espacios, Servicio de Notificación, PostgresSQL (mediante `ReservaRepository`) |
| **Motor de disponibilidad** | Calcular cruces horarios y estados de los espacios. | `validarFranja(...)`, `consultarEstados(espacios, instante)`, que devuelve un estado por espacio (Disponible, Ocupado o No registrado). | `ReservaRepository` (solo lectura) |
| **Servicio de Notificación** | Enviar las confirmaciones de reserva al correo institucional sin bloquear la transacción principal. | Envío de alertas SMTP cuando se crea una reserva. Si falla, se registra en el log y la reserva sigue confirmada. | Servidor SMTP externo |

### Matriz de Trazabilidad Requisito-Componente
| Requisito / Fuente | APP-WEB | API_GW | Autenticación | Gestión de espacios | Gestión Reservas | Motor de Disponibilidad |
|---|:---:|:---:|:---:|:---:|:---:|:---:|
| **REQ-01:** Detalles del espacio | X | X | | X | | |
| **REQ-02:** Estado dinámico | X | X | | X | X | X |
| **HU-002:** Timeout y conexión | X | X | | | | |
| **Diagrama Base:** Restricción | | X | X | | | |

## 4. Detailed Design

Se seleccionan los componentes `Gestión Reservas` y `Motor de disponibilidad y horarios` porque concentran el alcance funcional principal: búsquedas y estados. Para que la consulta sea completa se agrega la interfaz pública de `Gestión de espacios` y los repositorios que separan la lógica del acceso a datos. El módulo de *Políticas* y la administración de espacios quedan fuera de este nivel de detalle para centrarse en el MVP. Por directriz docente, el diagrama se adjunta como imagen; su fuente Mermaid está en `docs/design/diagrams/02_class_diagram.mmd`.

![Diagrama de Clases Detallado](./diagrams/02_class_diagram.jpg)

**Elementos representados en el diseño:**
*   **Entidades base:** `Usuario` (id, correoUnal, rol) y `Espacio` (id, nombre, tipo, caracteristicas, capacidad, edificio, ubicacionRelativa, imagenUrl, gestionaDisponibilidad, activo).
*   **Gestión Reservas:** clase orquestadora con las operaciones `crearReserva()` y `consultarEspaciosConEstado()`. Depende del Motor de Disponibilidad y de Gestión de Espacios, y está asociada a las reservas, que persiste mediante `ReservaRepository`.
*   **GestionEspacios:** expone `buscarEspacios()` y `obtenerDetalle()` sobre `EspacioRepository`.
*   **MotorDisponibilidad:** contiene `validarFranja()` y `consultarEstados()`. Lee las reservas solo a través de `ReservaRepository` y devuelve valores de la enumeración `EstadoDisponibilidad` (DISPONIBLE, OCUPADO, NO_REGISTRADO). `NO_REGISTRADO` identifica un espacio cuya disponibilidad no se gestiona con reservas; un espacio inexistente es otro caso (`EspacioNoEncontrado`).
*   **Reserva:** entidad que agrupa al Usuario, al Espacio y las fechas de inicio y fin. Oculta la lógica de cambio de estado (`EstadoReserva`: PENDIENTE, CONFIRMADA, CANCELADA) en el método `confirmar()`.

## 5. Key Operation Behavior

**Operación:** `MotorDisponibilidad.consultarEstados(espacios, instante)`  
**Requisito soportado:** REQ-02 (cálculo de la disponibilidad al momento de la búsqueda). El contrato completo está en `02_Interaction_and_Data_Design.md`, Sección 3.

```text
INICIO consultarEstados(espacios, instante)
    // 1. Validar precondiciones
    si espacios está vacía o tiene ids repetidos o instante es NULO:
        lanzar EntradaInvalida

    resultado = mapa vacío
    idsGestionados = []

    // 2. Espacios sin gestión de disponibilidad
    para cada espacio en espacios:
        si espacio.gestionaDisponibilidad es FALSO:
            resultado[espacio.id] = EstadoDisponibilidad.NO_REGISTRADO
        sino:
            agregar espacio.id a idsGestionados

    // 3. Una sola consulta para todos los espacios gestionados
    si idsGestionados no está vacía:
        intentar:
            reservasActivas = reservaRepository.obtenerConfirmadasEnInstante(idsGestionados, instante)
            // devuelve reservas CONFIRMADA con fechaInicio <= instante < fechaFin
        capturar ErrorDeRepositorio:
            registrarLog("Fallo al consultar reservas en MotorDisponibilidad")
            lanzar ErrorDisponibilidad   // sin resultados parciales. Lo traduce API_GW

        ocupados = conjunto de espacioId en reservasActivas
        para cada id en idsGestionados:
            si id pertenece a ocupados:
                resultado[id] = EstadoDisponibilidad.OCUPADO
            sino:
                resultado[id] = EstadoDisponibilidad.DISPONIBLE

    retornar EstadosDisponibilidad(instante, resultado)
FIN
```

## 6. Design Quality Evaluation
| Propiedad | Elemento | Evidencia del Diseño | Consecuencia / Justificación |
|---|---|---|---|
| **Cohesión (Alta)** | `MotorDisponibilidad` | Solo valida franjas y calcula estados. El acceso a datos está delegado en `ReservaRepository`, y no maneja usuarios ni datos de espacios. | Facilita el mantenimiento y las pruebas, porque el repositorio se puede sustituir por uno de prueba. Separa la lógica de horarios del gestor principal. |
| **Acoplamiento (Alto - Hallazgo)** | `Gestión Reservas` | Depende de forma sincrónica y directa del `Servicio de Notificación`. | Si el servidor de correos falla, la reserva podría quedar bloqueada o lanzar un timeout. **Mitigación aplicada:** el envío no bloquea; un fallo se registra en el log y la reserva sigue confirmada. **Mejora futura:** colas de eventos asíncronas. |
| **Ocultamiento de información** | `Reserva` (Clase) | Su estado es privado y el ciclo de vida se gestiona internamente con el método `confirmar()`. | Evita que componentes externos cambien arbitrariamente los estados en la base de datos saltándose las reglas de negocio. |

## 7. Justified Decisions & ADRs

**1. Decisión Arquitectónica: Uso de un API Gateway**
* **Because [context]:** el sistema debe atender múltiples peticiones con tiempos de respuesta menores a 10 segundos (HU-002), y necesitamos un punto central que gestione las caídas de red y los timeouts antes de que lleguen a la lógica principal.
* **We chose [decision]:** introducir un componente `API_GW` como intermediario entre la `APP-WEB` y la Capa Lógica.
* **Accepting [trade-off]:** el costo de mantener un componente de red adicional, que agrega un ligero salto de latencia, a cambio de centralizar el enrutamiento seguro y la emisión temprana de alertas de error de conexión.

**2. Decisión de Diseño Detallado: Cálculo dinámico de disponibilidad**
* **Because [context]:** REQ-02 exige mostrar el estado ("Disponible" u "Ocupado") en el momento exacto de la búsqueda. Si se manejara como un atributo estático en la tabla de espacios, habría un alto riesgo de que estuviera desactualizado.
* **We chose [decision]:** delegar el cálculo del estado al `Motor de disponibilidad y horarios`, que cruza en tiempo real el instante de la consulta con las fechas de las reservas confirmadas. Lo hace en una sola consulta para todos los espacios de la búsqueda, apoyada en un índice compuesto `(espacio_id, estado, fecha_inicio, fecha_fin)` sobre la tabla de reservas. No se usa caché.
* **Accepting [trade-off]:** el costo de consultas de rangos de fecha adicionales en cada búsqueda, y de mantener el índice en cada escritura de reservas, a cambio de garantizar que la disponibilidad sea exacta al segundo de la búsqueda.

**Reference:** `docs/decisions/ADR-001-calculo-disponibilidad-tiempo-real.md`

## 8. Open Questions & Assumptions
*   **Asunción (Datos Base):** asumimos que las entidades base (espacios con sus imágenes y ubicaciones, y usuarios) se cargan en la base de datos mediante el componente `Gestión de espacios y elementos` (cuya administración está fuera del alcance de este MVP) o mediante un proceso de migración. Esto permite centrar el diseño en el flujo de consulta y reserva del estudiante.
*   **Pregunta abierta (identidad):** ¿cómo se propaga el `usuarioId` desde el token JWT hasta `Gestión Reservas`? Este diseño supone que el `API_GW` lo extrae del token validado y que nunca lo envía el cliente. Falta confirmar si la identidad institucional la provee un sistema externo de la universidad (SSO).
*   **Pregunta abierta (políticas):** ¿cuáles son los límites de duración y anticipación de una reserva? RF-03 menciona un "tiempo mínimo de anticipación configurado", pero no su valor. El módulo de *Políticas* está fuera del MVP, así que estas reglas deben definirse con los stakeholders antes de implementar `crearReserva()`.
*   **Pregunta abierta (estado no registrado):** ¿existen espacios cuya disponibilidad no se gestione con reservas (`gestionaDisponibilidad = false`), o el estado "En mantenimiento" es un valor adicional? Ver `02_Interaction_and_Data_Design.md`, PA-2.

## Historial de cambios
| Versión | Fecha | Cambio | Origen |
|---|---|---|---|
| v1.0 | 2026-10-17 | Versión entregada en la Actividad 1. | — |
| v1.1 | 2026-10-24 | Pseudocódigo y clases sin SQL directo: el Motor usa `ReservaRepository`. | AI Log B1 / Actividad 2 C1 |
| v1.1 | 2026-10-24 | Fila del Servicio de Notificación con comportamiento no bloqueante. | AI Log B2 |
| v1.1 | 2026-10-24 | Índice compuesto documentado en la Decisión 2, sin caché. | AI Log B3 |
| v1.1 | 2026-10-24 | Preguntas abiertas sobre JWT y políticas en la Sección 8. | AI Log B4 |
| v1.1 | 2026-10-24 | `consultarEspaciosConEstado(texto)` reemplaza a `consultarEspacioConEstado(espacioId)`, y `consultarEstados(espacios, instante)` reemplaza a `consultarEstadoActual(espacioId)`. | Actividad 2 C2, C3 |
| v1.1 | 2026-10-24 | `NO_REGISTRADO` ahora significa "espacio sin gestión de disponibilidad"; la inexistencia es `EspacioNoEncontrado`. | Actividad 2 C4 |
| v1.1 | 2026-10-24 | REQ-01 traza a `Gestión de espacios y elementos`; se agrega su fila y la clase `GestionEspacios`. | Actividad 2 C5 |
| v1.1 | 2026-10-24 | Atributos de `Espacio` necesarios para REQ-01, y enumeraciones `EstadoReserva` y `Rol`. | Actividad 2 C6 |
| v1.1 | 2026-10-24 | La relación `GestionReservas`–`Reserva` pasa de composición a asociación. | Actividad 2 C7 |
