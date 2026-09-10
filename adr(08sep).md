# ADR-001: Selección del stack tecnológico para UNALSpace
 
<!--
Nombra el archivo con el número consecutivo y un slug corto, por ejemplo:
docs/adr/0001-usar-postgresql-como-base-de-datos-principal.md
Los ADR se numeran en orden y NUNCA se editan después de aceptados para
cambiar la decisión en sí (sí puedes corregir errores de redacción). Si la
decisión cambia, escribes un ADR nuevo y marcas este como reemplazado
(ver "Estado"). Así el repositorio queda como una bitácora histórica de
por qué el sistema es como es.
-->
 
Autores:
 - @githubusername
Fecha: AAAA-MM-DD
 
## Estado
 
<!--
Uno de: Propuesto | Aceptado | Rechazado | Reemplazado por ADR-000Y | Obsoleto
Un ADR "Propuesto" está en discusión. Una vez el equipo decide, pasa a
"Aceptado" (o "Rechazado" si se descarta la propuesta) y ya no se
modifica su contenido de fondo.
-->
 
Pendiente por aprobación.
 
## Contexto
 
<!--
¿Qué problema técnico, restricción o fuerza nos obliga a tomar esta
decisión ahora? Describe la situación de forma neutral y objetiva —
todavía no es el lugar para argumentar a favor de una opción.
Ejemplos de fuerzas en juego: requisitos no funcionales (rendimiento,
seguridad, escalabilidad), restricciones de equipo o de tiempo,
deuda técnica existente, compatibilidad con sistemas ya construidos.
-->

UNALSpace requiere una aplicación web para gestionar espacios universitarios y realizar reservas. El sistema debe permitir manejar usuarios, espacios, disponibilidad, reservas y reglas de negocio como la prevención de conflictos de horario.

Se necesita un stack que permita desarrollar una aplicación web modular, mantener una separación clara entre frontend, backend y base de datos, y que sea apropiado para el tiempo y alcance del proyecto.
 
## Decisión
 
<!--
Qué vamos a hacer, en una o dos frases claras y en tiempo presente
("Vamos a usar X para Y"). Esta es la sección más corta del documento:
un ADR no es un RFC, no necesita convencer a nadie aquí — la
justificación ya quedó en "Contexto" y las alternativas descartadas
van abajo.
-->

#### Capa	Tecnología (STACK)
Backend:	NestJS
Frontend:	React
Base de datos:	PostgreSQL

NestJS será utilizado para desarrollar la API y manejar la lógica de negocio del sistema. Se selecciona por su estructura modular, uso de TypeScript y facilidad para organizar funcionalidades como usuarios, espacios y reservas.

React será utilizado para construir la interfaz web. Su arquitectura basada en componentes permite reutilizar elementos de la aplicación y construir interfaces dinámicas para consultar disponibilidad y realizar reservas.

PostgreSQL será utilizado como sistema gestor de base de datos. Su modelo relacional permite representar adecuadamente las relaciones entre usuarios, espacios y reservas, además de mantener la integridad y consistencia de la información.

## Alternativas consideradas
 
<!--
Qué otras opciones se evaluaron y por qué se descartaron. No hace
falta un análisis exhaustivo, basta con dejar constancia de que se
consideraron y el motivo del descarte (costo, madurez, curva de
aprendizaje, no cumple un requisito, etc.).
-->

#### Backend
Express.js: más sencillo y flexible, pero proporciona menos estructura para organizar un proyecto de mayor tamaño.
Django: ofrece una estructura completa, pero implicaría utilizar Python y otro ecosistema tecnológico diferente al seleccionado.
#### Frontend
Angular: ofrece una estructura completa, pero presenta una mayor curva de aprendizaje.
Vue.js: es sencillo y flexible, pero el equipo tiene como decisión trabajar con React.
#### Base de datos
MySQL: alternativa relacional adecuada, pero se seleccionó PostgreSQL por sus capacidades y robustez para el manejo de datos relacionales.
MongoDB: ofrece flexibilidad mediante documentos, pero el dominio de UNALSpace presenta relaciones claras entre usuarios, espacios y reservas, por lo que una base de datos relacional resulta más apropiada.

## Consecuencias
#### Positivas
- Separación clara entre frontend, backend y persistencia.
- Permite desarrollar el sistema de forma modular.
- TypeScript en el backend y frontend facilita mantener tipos consistentes.
- PostgreSQL permite establecer relaciones e integridad entre los datos.
- El stack cuenta con tecnologías ampliamente utilizadas y con abundante documentación.
#### Negativas
- El equipo debe aprender y configurar tres tecnologías principales.
- NestJS puede resultar más complejo que alternativas minimalistas como Express.
- React requiere herramientas adicionales para cubrir algunas funcionalidades de una aplicación completa.
- PostgreSQL requiere diseñar correctamente el modelo relacional y sus relaciones.
<!--
¿Qué se vuelve más fácil o más difícil después de esta decisión?
Incluye efectos positivos y negativos por igual — un ADR honesto
también documenta el costo que se está aceptando (deuda técnica
introducida, dependencia nueva, curva de aprendizaje del equipo).
-->
 
---
 
### Diferencia con un RFC (referencia rápida)
 
<!--
Elimina esta sección en el ADR final; queda aquí solo como recordatorio
para quien usa la plantilla.
- Un RFC se escribe ANTES de decidir, para abrir discusión y llegar a
  consenso; es un documento "vivo" mientras dura la deliberación.
- Un ADR registra una decisión YA tomada (o que se está formalizando);
  una vez aceptado, es casi inmutable — si cambia, se escribe un ADR
  nuevo que reemplaza al anterior, no se edita el viejo.
- El RFC suele ser más largo (motivación, métricas, riesgos, preguntas
  abiertas); el ADR es deliberadamente corto: Contexto, Decisión,
  Consecuencias.
- En equipos que usan ambos: el RFC es el proceso de deliberación,
  y al cerrarlo se destila un ADR corto como registro histórico de lo
  que finalmente se decidió.
-->
