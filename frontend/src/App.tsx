import React, { useEffect, useState } from 'react';
import { CheckCircle2, Mail, UserCheck } from 'lucide-react';
import { ApiClient } from './shared/api/client';
import { ToastProvider, useToast } from './shared/components/Toast';
import { SpaceCatalogView } from './features/space-catalog/SpaceCatalogView';

interface InstitutionalStudent {
  usuarioId: string;
  nombres: string;
  apellidos: string;
  correo: string;
  codigoEstudiantil: string;
  facultad: string;
  rol: string;
}

export const AUTH_SESSION_ENDPOINT = '/auth/session';
export const INVALID_EMAIL_FALLBACK_MESSAGE =
  'Por favor ingresa un correo institucional válido con dominio @unal.edu.co';

/**
 * Renderiza la cabecera principal de UNALSpace con el logotipo horizontal oficial
 * y acceso mediante correo institucional @unal.edu.co.
 *
 * @returns {React.JSX.Element} Barra de navegación superior para estudiantes.
 */
function renderInstitutionalHeader(): React.JSX.Element {
  let { showToast } = useToast();
  let [activeStudent, setActiveStudent] =
    useState<InstitutionalStudent | null>(null);
  let [availableStudentsList, setAvailableStudentsList] = useState<
    InstitutionalStudent[]
  >([]);
  let [emailInputText, setEmailInputText] = useState<string>('');

  useEffect(() => {
    ApiClient.requestJson<{
      success: boolean;
      data: {
        activeUser: InstitutionalStudent;
        token: string;
        availableStudents: InstitutionalStudent[];
      };
    }>(AUTH_SESSION_ENDPOINT)
      .then((sessionResponse) => {
        setActiveStudent(sessionResponse.data.activeUser);
        setAvailableStudentsList(sessionResponse.data.availableStudents);
        ApiClient.setAuthToken(sessionResponse.data.token);
      })
      .catch(() => {
        // Silencioso en carga inicial; el catálogo principal reporta si no hay conexión
      });
  }, []);

  /**
   * Confirma el correo institucional @unal.edu.co del estudiante para personalizar su sesión.
   *
   * @param {string} targetEmailAddress Correo electrónico institucional a confirmar.
   * @returns {Promise<void>} Promesa resuelta al actualizar el usuario activo.
   */
  let authenticateStudentEmail = async (
    targetEmailAddress: string
  ): Promise<void> => {
    try {
      let authResponse = await ApiClient.requestJson<{
        success: boolean;
        data: {
          activeUser: InstitutionalStudent;
          token: string;
        };
      }>(AUTH_SESSION_ENDPOINT, {
        method: 'POST',
        body: JSON.stringify({ correo: targetEmailAddress }),
      });

      setActiveStudent(authResponse.data.activeUser);
      ApiClient.setAuthToken(authResponse.data.token);
      setEmailInputText('');
      showToast(
        `¡Hola, ${authResponse.data.activeUser.nombres}! Correo institucional confirmado (${authResponse.data.activeUser.correo}).`,
        'success'
      );
    } catch (caughtError) {
      let errorMessage =
        caughtError instanceof Error
          ? caughtError.message
          : INVALID_EMAIL_FALLBACK_MESSAGE;
      showToast(errorMessage, 'error');
    }
  };

  return (
    <header className="sticky top-0 z-30 border-b border-slate-200/90 bg-white/95 backdrop-blur-md shadow-sm">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-4 py-3.5 sm:px-6 lg:px-8">
        {/* Marca UNALSpace — Versión Horizontal del Logo */}
        <div className="flex items-center gap-4">
          <a
            href="#top"
            className="flex items-center gap-3 focus:outline-none"
            aria-label="Inicio UNALSpace"
          >
            <img
              src="/logos/logo-horizontal-cropped.jpg"
              alt="Logo UNALSpace"
              width={240}
              height={90}
              className="h-11 w-auto object-contain sm:h-12 mix-blend-multiply"
            />
          </a>

          <div className="hidden border-l border-slate-200 pl-4 md:block">
            <span className="inline-flex items-center rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-bold text-unal-green ring-1 ring-emerald-600/20">
              Sede Bogotá · Espacios Deportivos
            </span>
            <p className="mt-0.5 text-xs font-medium text-slate-500">
              Consulta de disponibilidad y ubicación en tiempo real
            </p>
          </div>
        </div>

        {/* Sección de identificación de correo institucional @unal.edu.co */}
        <div className="flex flex-wrap items-center gap-2.5">
          {activeStudent && (
            <div className="flex items-center gap-2.5 rounded-2xl border border-emerald-200/80 bg-emerald-50/60 px-3.5 py-1.5 text-xs">
              <UserCheck
                className="h-4 w-4 shrink-0 text-unal-green"
                aria-hidden="true"
              />
              <div>
                <p className="font-bold text-slate-900">
                  {activeStudent.nombres} {activeStudent.apellidos}
                </p>
                <p className="text-[11px] font-medium text-emerald-800">
                  {activeStudent.correo}
                </p>
              </div>
            </div>
          )}

          {availableStudentsList.length > 0 && (
            <select
              aria-label="Seleccionar perfil de estudiante"
              value={activeStudent?.correo || ''}
              onChange={(changeEvent) =>
                authenticateStudentEmail(changeEvent.target.value)
              }
              className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-700 transition hover:border-slate-300 focus:border-unal-green focus:bg-white focus:outline-none"
            >
              {availableStudentsList.map((studentItem) => (
                <option key={studentItem.usuarioId} value={studentItem.correo}>
                  {studentItem.nombres} ({studentItem.correo})
                </option>
              ))}
            </select>
          )}

          <form
            onSubmit={(formEvent) => {
              formEvent.preventDefault();
              let trimmedEmail = emailInputText.trim();
              if (trimmedEmail) {
                authenticateStudentEmail(trimmedEmail);
              }
            }}
            className="flex items-center gap-1.5"
          >
            <div className="relative">
              <Mail
                className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400"
                aria-hidden="true"
              />
              <input
                type="email"
                inputMode="email"
                autoComplete="email"
                value={emailInputText}
                onChange={(changeEvent) =>
                  setEmailInputText(changeEvent.target.value)
                }
                placeholder="usuario@unal.edu.co"
                aria-label="Ingresar correo institucional @unal.edu.co"
                className="w-48 rounded-xl border border-slate-300 bg-white py-2 pl-8 pr-3 text-xs text-slate-900 placeholder:text-slate-400 focus:border-unal-green focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
              />
            </div>
            <button
              type="submit"
              className="inline-flex items-center gap-1.5 rounded-xl bg-unal-green px-3.5 py-2 text-xs font-bold text-white shadow-sm transition hover:bg-unal-dark focus:outline-none focus:ring-2 focus:ring-emerald-600"
            >
              <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Confirmar correo</span>
            </button>
          </form>
        </div>
      </div>
    </header>
  );
}

const InstitutionalHeader = renderInstitutionalHeader;

/**
 * Renderiza el componente raíz de la aplicación UNALSpace.
 *
 * @returns {React.JSX.Element} Estructura principal con cabecera, catálogo y pie de página institucional.
 */
export function renderApp(): React.JSX.Element {
  return (
    <ToastProvider>
      <div id="top" className="flex min-h-screen flex-col bg-slate-50">
        <InstitutionalHeader />

        <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-8 sm:px-6 lg:px-8">
          <SpaceCatalogView />
        </main>

        <footer className="mt-16 border-t border-slate-200 bg-white py-10 text-slate-600">
          <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-6 px-4 sm:flex-row sm:px-6 lg:px-8">
            <div className="flex items-center gap-4">
              <img
                src="/logos/logo-isotipo-cropped.jpg"
                alt="Isotipo UNALSpace"
                width={48}
                height={48}
                className="h-11 w-11 object-contain mix-blend-multiply"
              />
              <div>
                <img
                  src="/logos/logo-wordmark-cropped.jpg"
                  alt="UNALSpace"
                  width={160}
                  height={44}
                  className="h-6 w-auto object-contain mix-blend-multiply"
                />
                <p className="mt-1 text-xs text-slate-500">
                  Universidad Nacional de Colombia · Sede Bogotá · Bienestar y Deportes
                </p>
              </div>
            </div>

            <div className="text-center text-xs text-slate-500 sm:text-right">
              <p className="font-semibold text-slate-700">
                Plataforma estudiantil para consulta y reserva de escenarios deportivos
              </p>
              <p className="mt-0.5">
                Facultad de Ingeniería · Todos los derechos reservados © 2026
              </p>
            </div>
          </div>
        </footer>
      </div>
    </ToastProvider>
  );
}

export const App = renderApp;

export default App;
