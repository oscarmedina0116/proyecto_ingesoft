/**
 * @file app-constants.ts
 * @description Constantes transversales del sistema UNALSpace en formato UPPER_SNAKE_CASE.
 */

export const DB_TIMEZONE = 'America/Bogota';

export const API_TIMEOUT_MS = 10000;

export const INSTITUTIONAL_EMAIL_REGEX = /^[A-Za-z0-9._%+-]+@unal\.edu\.co$/i;

export const DEFAULT_FALLBACK_IMAGE = '/images/unal-fallback-space.svg';

export const MISSING_IMAGE_TEXT = 'Imagen no disponible';

export const MISSING_CHARACTERISTICS_TEXT = 'Características físicas aún no registradas';

export const SPACE_NOT_FOUND_MESSAGE = 'El espacio solicitado no existe o fue retirado del sistema.';

export const AVAILABILITY_CONNECTION_ERROR_MESSAGE =
  'Error de conexión. No se pudo cargar el estado de disponibilidad. Revisa tu conexión a internet e inténtalo nuevamente.';

export const DETAIL_CONNECTION_ERROR_MESSAGE =
  'Error de conexión. No se pudo cargar la información detallada del espacio. Revisa tu conexión a internet e inténtalo nuevamente.';

export const AVAILABLE_STATUS_TEXT = 'Disponible';

export const OCCUPIED_STATUS_TEXT = 'Ocupado';

export const UNREGISTERED_AVAILABILITY_TEXT = 'Disponibilidad no registrada';

export const SPACE_TYPE_LABELS: Record<string, string> = {
  ESTADIO: 'Estadio de Fútbol 11',
  CONCHA_ACUSTICA: 'Escenario Multiuso (Concha Acústica)',
  CANCHA_TECHADA: 'Cancha Cubierta (Techada)',
  CANCHA_DESTECHADA: 'Cancha al Aire Libre (Destechada)',
  CANCHA_TENIS: 'Cancha Exclusiva de Tenis',
};

export const SURFACE_TYPE_LABELS: Record<string, string> = {
  GRAMA_NATURAL: 'Grama Natural',
  GRAMA_SINTETICA: 'Grama Sintética',
  CEMENTO: 'Cemento / Concreto',
  CAUCHO_SINTETICO: 'Caucho Sintético Polideportivo',
  POLVO_DE_LADRILLO: 'Polvo de Ladrillo (Clay)',
  BALDOSA_DEPORTIVA: 'Baldosa Deportiva Modular',
};

export const SPORT_CODE_LABELS: Record<string, string> = {
  FUTBOL_11: 'Fútbol 11',
  FUTBOL_SALA: 'Fútbol Sala',
  BALONCESTO: 'Baloncesto',
  VOLEIBOL: 'Voleibol',
  TENIS: 'Tenis de Campo',
};

/**
 * Catálogo de fotografías representativas SVG de alta resolución por código interno.
 * Nota: TEN-003 se deja intencionalmente en null por defecto para demostrar de forma nativa
 * el Criterio de Aceptación CA #3 de REQ-01 ("Imagen no disponible").
 */
export const SPACE_IMAGE_MAP: Record<string, string | null> = {
  'EST-001': '/api/assets/spaces/EST-001.svg?v=2',
  'CON-001': '/api/assets/spaces/CON-001.svg?v=2',
  'CON-002': '/api/assets/spaces/CON-002.svg?v=2',
  'TCH-001': '/api/assets/spaces/TCH-001.svg?v=2',
  'TCH-002': '/api/assets/spaces/TCH-002.svg?v=2',
  'DES-001': '/api/assets/spaces/DES-001.svg?v=2',
  'DES-002': '/api/assets/spaces/DES-002.svg?v=2',
  'DES-003': '/api/assets/spaces/DES-003.svg?v=2',
  'BAL-001': '/api/assets/spaces/BAL-001.svg?v=2',
  'TEN-001': '/api/assets/spaces/TEN-001.svg?v=2',
  'TEN-002': '/api/assets/spaces/TEN-002.svg?v=2',
  'TEN-003': null,
};

