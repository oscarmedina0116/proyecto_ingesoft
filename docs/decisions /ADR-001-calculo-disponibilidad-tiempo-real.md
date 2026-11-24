# ADR-001: Cálculo dinámico de disponibilidad en tiempo real mediante cruce de horarios

## Contexto
El requerimiento [REQ-02] establece que los estudiantes deben poder consultar el estado de disponibilidad de un espacio ("Disponible" u "Ocupado") exactamente al momento de realizar la búsqueda para evitar desplazamientos en vano. Identificamos un riesgo alto si el dato de disponibilidad se desactualiza. El sistema central es un Portal de reservas, lo que implica que la disponibilidad real está dictada por las reservas existentes y no por un interruptor manual.

## Decisión
Hemos decidido implementar un `Motor de disponibilidad y horarios` que calcule el estado dinámico en tiempo real durante la consulta. No almacenaremos un campo estático `estado` en la entidad del espacio dentro de `PostgresSQL`. En su lugar, el Motor consultará las reservas confirmadas cuya franja horaria coincida con el *timestamp* exacto de la petición.

## Estado
Aceptado

## Consecuencias
**Positivas:**
* Mitiga el riesgo de mostrar información desactualizada, resolviendo la incertidumbre del REQ-02.
* Elimina la necesidad de procesos en segundo plano (*cron jobs*) para actualizar estados masivamente.
* Fuerte cohesión arquitectónica al delegar la responsabilidad de validación de franjas a un motor especializado.

**Negativas / Riesgos asumidos:**
* Penalización menor de rendimiento: La consulta requiere operaciones relacionales de rangos de fecha/hora bajo demanda.
* Dependencia fuerte: Si el módulo de Gestión de Reservas falla al registrar una reserva, el cálculo del motor será un falso positivo (indicará "Disponible" erróneamente).
