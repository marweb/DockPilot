import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import './i18n';

/**
 * Punto de entrada de la aplicación DockPilot
 *
 * Nota: El RouterProvider está dentro de App.tsx junto con todos los contexts.
 * BrowserRouter ya no es necesario aquí porque createBrowserRouter se usa
 * en src/router/index.tsx
 */
ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
