import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import { AlertTriangle, CheckCircle2, Info, X } from 'lucide-react';

export type ToastVariant = 'error' | 'success' | 'info';

export interface ToastItem {
  id: string;
  message: string;
  variant: ToastVariant;
  createdAt: number;
}

interface ToastContextValue {
  toasts: ToastItem[];
  showToast: (message: string, variant?: ToastVariant) => void;
  dismissToast: (id: string) => void;
}

export const TOAST_CONTEXT = createContext<ToastContextValue | undefined>(
  undefined
);

export const TOAST_AUTO_DISMISS_MS = 8000;

export const TOAST_STYLES_BY_VARIANT: Record<
  ToastVariant,
  { border: string; bg: string; iconColor: string; badge: string }
> = {
  error: {
    border: 'border-red-600',
    bg: 'bg-red-950 text-white',
    iconColor: 'text-red-400',
    badge: 'Error de conexión / Excepción',
  },
  success: {
    border: 'border-emerald-500',
    bg: 'bg-emerald-950 text-white',
    iconColor: 'text-emerald-400',
    badge: 'Confirmación UNALSpace',
  },
  info: {
    border: 'border-amber-500',
    bg: 'bg-slate-900 text-white',
    iconColor: 'text-amber-400',
    badge: 'Aviso del sistema',
  },
};

/**
 * Hook personalizado para disparar o cerrar notificaciones emergentes (Toasts) en cualquier Slice.
 *
 * @returns {ToastContextValue} Métodos `showToast`, `dismissToast` y lista de `toasts` activos.
 */
export function useToast(): ToastContextValue {
  let toastContextValue = useContext(TOAST_CONTEXT);
  if (!toastContextValue) {
    throw new Error('useToast debe utilizarse dentro de un ToastProvider.');
  }
  return toastContextValue;
}

/**
 * Anuncia el texto visible del toast a lectores de pantalla usando `ariaNotify()` si está disponible,
 * o mediante la región ARIA live pre-poblada.
 *
 * @param {string} visibleText Texto visible del toast sin nombres de controles.
 * @param {React.RefObject<HTMLDivElement | null>} liveRegionReference Referencia al contenedor `aria-live="assertive"`.
 * @returns {void}
 */
function announceToastToAssistiveTech(
  visibleText: string,
  liveRegionReference: React.RefObject<HTMLDivElement | null>
): void {
  let documentWithAriaNotify = document as Document & {
    ariaNotify?: (message: string) => void;
  };

  if (typeof documentWithAriaNotify.ariaNotify === 'function') {
    documentWithAriaNotify.ariaNotify(visibleText);
    return;
  }

  if (liveRegionReference.current) {
    liveRegionReference.current.textContent = visibleText;
  }
}

/**
 * Renderiza el componente individual de notificación emergente que utiliza `popover="manual"` y pausa el
 * temporizador de cierre automático mientras el foco del teclado esté dentro del toast.
 *
 * @param {{ item: ToastItem; onDismiss: (id: string, wasFocused: boolean) => void }} componentProps Propiedades del ítem Toast.
 * @returns {React.JSX.Element} Elemento de notificación renderizado en el Top Layer.
 */
function renderToastNotificationCard({
  item,
  onDismiss,
}: {
  item: ToastItem;
  onDismiss: (id: string, wasFocused: boolean) => void;
}): React.JSX.Element {
  let popoverElementReference = useRef<HTMLDivElement | null>(null);
  let [isFocusInside, setIsFocusInside] = useState<boolean>(false);

  useEffect(() => {
    let popoverNode = popoverElementReference.current;
    if (popoverNode && typeof popoverNode.showPopover === 'function') {
      try {
        popoverNode.showPopover();
      } catch {
        // Fallback silencioso si el navegador ya lo tiene abierto o no soporta showPopover
      }
    }
  }, []);

  useEffect(() => {
    if (isFocusInside) {
      return;
    }

    let autoDismissTimerId = window.setTimeout(() => {
      onDismiss(item.id, false);
    }, TOAST_AUTO_DISMISS_MS);

    return () => window.clearTimeout(autoDismissTimerId);
  }, [isFocusInside, item.id, onDismiss]);

  /**
   * Detecta cuando el foco entra a un control dentro del toast para pausar el cierre automático.
   *
   * @returns {void}
   */
  let handleFocusIn = (): void => {
    setIsFocusInside(true);
  };

  /**
   * Detecta cuando el foco sale por completo del toast para reanudar la cuenta regresiva.
   *
   * @param {React.FocusEvent<HTMLDivElement>} focusEvent Evento de desenfoque.
   * @returns {void}
   */
  let handleFocusOut = (focusEvent: React.FocusEvent<HTMLDivElement>): void => {
    if (
      !focusEvent.currentTarget.contains(
        focusEvent.relatedTarget as Node | null
      )
    ) {
      setIsFocusInside(false);
    }
  };

  let variantStyle = TOAST_STYLES_BY_VARIANT[item.variant];

  return (
    <div
      ref={popoverElementReference}
      id={item.id}
      {...({ popover: 'manual' } as any)}
      onFocus={handleFocusIn}
      onBlur={handleFocusOut}
      data-testid="toast-notification"
      className={`toast-popover pointer-events-auto relative m-0 flex w-full max-w-md items-start gap-3 rounded-xl border-l-4 ${variantStyle.border} ${variantStyle.bg} p-4 shadow-2xl ring-1 ring-white/15`}
    >
      <div
        className={`mt-0.5 shrink-0 ${variantStyle.iconColor}`}
        aria-hidden="true"
      >
        {item.variant === 'error' && <AlertTriangle className="h-5 w-5" />}
        {item.variant === 'success' && <CheckCircle2 className="h-5 w-5" />}
        {item.variant === 'info' && <Info className="h-5 w-5" />}
      </div>

      <div className="min-w-0 flex-1">
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-300">
          {variantStyle.badge}
        </p>
        <p
          className="mt-1 text-sm font-medium leading-relaxed text-white"
          data-testid="toast-message-text"
        >
          {item.message}
        </p>
      </div>

      <button
        type="button"
        {...({ popovertarget: item.id, popovertargetaction: 'hide' } as any)}
        onClick={() => onDismiss(item.id, true)}
        aria-label="Cerrar notificación"
        className="shrink-0 rounded-lg p-1.5 text-slate-300 transition hover:bg-white/10 hover:text-white focus:outline-none focus:ring-2 focus:ring-white"
      >
        <X className="h-4 w-4" aria-hidden="true" />
      </button>
    </div>
  );
}

const ToastNotificationCard = renderToastNotificationCard;

/**
 * Renderiza el proveedor global de notificaciones Toast accesibles (cumple CA #5 de REQ-01 y REQ-02).
 *
 * @param {{ children: React.ReactNode }} providerProps Hijos de la aplicación React.
 * @returns {React.JSX.Element} Contexto y contenedor región de notificaciones.
 */
export function renderToastProvider({
  children,
}: {
  children: React.ReactNode;
}): React.JSX.Element {
  let [toastItemsList, setToastItemsList] = useState<ToastItem[]>([]);
  let liveRegionReference = useRef<HTMLDivElement | null>(null);
  let containerReference = useRef<HTMLDivElement | null>(null);
  let previousActiveElementReference = useRef<HTMLElement | null>(null);

  let dismissToast = useCallback(
    (toastId: string, shouldManageFocus: boolean = false) => {
      setToastItemsList((previousToasts) => {
        let remainingToasts = previousToasts.filter(
          (toastItem) => toastItem.id !== toastId
        );
        if (shouldManageFocus) {
          window.requestAnimationFrame(() => {
            if (remainingToasts.length > 0 && containerReference.current) {
              let nextDismissButton =
                containerReference.current.querySelector<HTMLButtonElement>(
                  'button[aria-label="Cerrar notificación"]'
                );
              nextDismissButton?.focus();
            } else if (previousActiveElementReference.current) {
              previousActiveElementReference.current.focus();
            }
          });
        }
        return remainingToasts;
      });
    },
    []
  );

  let showToast = useCallback(
    (toastMessage: string, toastVariant: ToastVariant = 'error') => {
      if (document.activeElement instanceof HTMLElement) {
        previousActiveElementReference.current = document.activeElement;
      }

      let createdToastItem: ToastItem = {
        id: `toast-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        message: toastMessage,
        variant: toastVariant,
        createdAt: Date.now(),
      };

      setToastItemsList((previousToasts) => [
        createdToastItem,
        ...previousToasts.slice(0, 3),
      ]);
      announceToastToAssistiveTech(toastMessage, liveRegionReference);
    },
    []
  );

  return (
    <TOAST_CONTEXT.Provider
      value={{ toasts: toastItemsList, showToast, dismissToast }}
    >
      {children}

      {/* Región ARIA live pre-poblada para lectores de pantalla sin soporte nativo de ariaNotify() */}
      {toastItemsList.length > 0 && (
        <p className="inclusively-hidden">Anuncios del lector de pantalla</p>
      )}
      <div
        id="notification"
        ref={liveRegionReference}
        aria-live="assertive"
        className="inclusively-hidden"
      />

      {/* Contenedor semántico de región accesible para apilar múltiples Toasts */}
      <div
        ref={containerReference}
        role="region"
        aria-label="Notificaciones"
        className="pointer-events-none fixed bottom-5 right-5 z-50 flex w-full max-w-md flex-col gap-3 px-4 sm:px-0"
      >
        {toastItemsList.map((toastItem) => (
          <ToastNotificationCard
            key={toastItem.id}
            item={toastItem}
            onDismiss={dismissToast}
          />
        ))}
      </div>
    </TOAST_CONTEXT.Provider>
  );
}

export const ToastProvider = renderToastProvider;
