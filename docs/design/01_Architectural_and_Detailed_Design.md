
# Design Deliverable 1: Architectural and Detailed Design

**Project Name:** UNAL-SPACE  
**Team Members:** Oscar Andres Andrade Medina, Oscar David Ariza Rojas, David Fernando Ordoñez Pérez, Juan Sebastián Rodríguez León

## 1. Design Drivers
| ID | Descripción | Tipo | Fuente | Consecuencia para el diseño |
|---|---|---|---|---|
| **DDR-01** | Consulta del estado de disponibilidad al momento de la búsqueda. | Funcional | REQ-02 | Obliga la creación de un `Motor de disponibilidad y horarios` para validar franjas. |
| **DDR-02** | Consulta de detalle, imagen y ubicación de espacios. | Funcional | REQ-01 | La base de datos central debe almacenar los atributos físicos y devolverlos integrados. |
| **DDR-03** | Tiempo de respuesta < 10 segundos bajo carga. | Atributo de Calidad | HU-002 | Introducción de un `API_GW` para gestionar timeouts e interrupciones de red. |

## 2. Architectural Design

```mermaid
componentDiagram
    actor "USER (Estudiante)" as user
    actor "ADMIN" as admin
    
    package "Presentation Layer" {
        [APP-WEB (Portal de reservas)] as app
    }
    
    [API_GW] as gw
    
    package "Logic Layer" {
        [Autenticación (@unal / JWT)] as auth
        [Gestión Reservas] as reservas
        [Motor de disponibilidad y horarios] as motor
        [Servicio de notificación] as notif
    }
    
    package "Data Layer" {
        database "PostgresSQL (Base relacional)" as db
    }
    
    user --> app
    admin --> gw
    app --> gw
    
    gw --> auth
    gw --> reservas
    gw --> motor
    
    reservas ..> motor : Usa para validar franja
    reservas ..> notif : Dispara confirmación
    
    auth --> db
    reservas --> db
    motor --> db
