import { describe, expect, it } from 'vitest';
import {
  AVAILABLE_STATUS_TEXT,
  AVAILABILITY_CONNECTION_ERROR_MESSAGE,
  DETAIL_CONNECTION_ERROR_MESSAGE,
  MISSING_CHARACTERISTICS_TEXT,
  MISSING_IMAGE_TEXT,
  OCCUPIED_STATUS_TEXT,
  SPACE_NOT_FOUND_MESSAGE,
  UNREGISTERED_AVAILABILITY_TEXT,
} from '../shared/constants/app-constants';
import { JwtAuthMiddleware } from '../shared/middlewares/auth-jwt';
import { CheckAvailabilityService } from './check-space-availability/check-availability.service';
import { GetSpaceDetailQuery } from './get-space-detail/get-space-detail.query';

describe('UNALSpace MVP Incremento 1 — Vertical Slices Verification', () => {
  it('verifica las constantes exactas exigidas por los Criterios de Aceptación de REQ-01 y REQ-02', () => {
    expect(AVAILABLE_STATUS_TEXT).toBe('Disponible');
    expect(OCCUPIED_STATUS_TEXT).toBe('Ocupado');
    expect(UNREGISTERED_AVAILABILITY_TEXT).toBe('Disponibilidad no registrada');
    expect(AVAILABILITY_CONNECTION_ERROR_MESSAGE).toBe(
      'Error de conexión. No se pudo cargar el estado de disponibilidad. Revisa tu conexión a internet e inténtalo nuevamente.'
    );

    expect(MISSING_IMAGE_TEXT).toBe('Imagen no disponible');
    expect(MISSING_CHARACTERISTICS_TEXT).toBe('Características físicas aún no registradas');
    expect(DETAIL_CONNECTION_ERROR_MESSAGE).toBe(
      'Error de conexión. No se pudo cargar la información detallada del espacio. Revisa tu conexión a internet e inténtalo nuevamente.'
    );
    expect(SPACE_NOT_FOUND_MESSAGE).toBe(
      'El espacio solicitado no existe o fue retirado del sistema.'
    );
  });

  it('valida que JwtAuthMiddleware emita y verifique tokens exclusivamente para correos @unal.edu.co', () => {
    let institutionalToken = JwtAuthMiddleware.generateInstitutionalToken({
      usuarioId: 'c0000000-0000-4ccc-cccc-000000000001',
      nombres: 'Camila Andrea',
      apellidos: 'Rodríguez Muñoz',
      correo: 'carodriguezm@unal.edu.co',
      codigoEstudiantil: '2021234501',
      facultad: 'Facultad de Ingeniería',
      rol: 'ESTUDIANTE',
    });

    let verifiedPayload = JwtAuthMiddleware.validateInstitutionalToken(institutionalToken);
    expect(verifiedPayload.correo).toBe('carodriguezm@unal.edu.co');

    expect(() =>
      JwtAuthMiddleware.generateInstitutionalToken({
        usuarioId: 'c0000000-0000-4ccc-cccc-000000000001',
        nombres: 'Externo',
        apellidos: 'Prueba',
        correo: 'usuario@gmail.com',
        codigoEstudiantil: '0000',
        facultad: 'Ninguna',
        rol: 'ESTUDIANTE',
      })
    ).toThrow(/Solo se permiten correos institucionales/);
  });

  it('traduce correctamente los códigos del Motor de Disponibilidad (SLICE REQ-02)', () => {
    let availabilityService = new CheckAvailabilityService();
    expect(availabilityService.formatAvailabilityLabel('DISPONIBLE')).toBe('Disponible');
    expect(availabilityService.formatAvailabilityLabel('OCUPADO')).toBe('Ocupado');
    expect(availabilityService.formatAvailabilityLabel('NO_REGISTRADO')).toBe(
      'Disponibilidad no registrada'
    );
  });

  it('valida correctamente UUIDs antes de consultar PostgreSQL en SLICE REQ-01', () => {
    let spaceDetailQuery = new GetSpaceDetailQuery();
    expect(spaceDetailQuery.isValidUuid('b0000000-0000-4bbb-bbbb-000000000001')).toBe(true);
    expect(spaceDetailQuery.isValidUuid('id-invalido-123')).toBe(false);
  });
});

