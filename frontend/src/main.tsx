import React from 'react';
import ReactDOM from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import App from './App';
import './index.css';

export const DEFAULT_QUERY_STALE_TIME_MS = 0;
export const ROOT_DOM_ELEMENT_ID = 'root';

/**
 * Inicializa y monta la aplicación React de UNALSpace en el nodo raíz del DOM.
 *
 * @returns {void}
 */
function mountUnalSpaceApplication(): void {
  let queryClientInstance = new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: DEFAULT_QUERY_STALE_TIME_MS,
        refetchOnWindowFocus: true,
      },
    },
  });

  let rootDomElement = document.getElementById(ROOT_DOM_ELEMENT_ID)!;

  ReactDOM.createRoot(rootDomElement).render(
    <React.StrictMode>
      <QueryClientProvider client={queryClientInstance}>
        <App />
      </QueryClientProvider>
    </React.StrictMode>
  );
}

mountUnalSpaceApplication();
