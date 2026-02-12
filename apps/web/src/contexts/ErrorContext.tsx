import { createContext, useContext, ReactNode, useState, useCallback } from 'react';

interface ErrorBoundaryContextType {
  hasError: boolean;
  error: Error | null;
  resetError: () => void;
}

const ErrorBoundaryContext = createContext<ErrorBoundaryContextType | undefined>(undefined);

interface ErrorProviderProps {
  children: ReactNode;
}

/**
 * ErrorContext Provider
 * Manejo global de errores
 * Proporciona funciones para manejar y resetear errores
 */
export function ErrorProvider({ children }: ErrorProviderProps) {
  const [error, setError] = useState<Error | null>(null);
  const hasError = error !== null;

  const resetError = useCallback(() => {
    setError(null);
  }, []);

  const value = {
    hasError,
    error,
    resetError,
  };

  return <ErrorBoundaryContext.Provider value={value}>{children}</ErrorBoundaryContext.Provider>;
}

/**
 * Hook para usar el contexto de errores
 */
export function useError() {
  const context = useContext(ErrorBoundaryContext);
  if (context === undefined) {
    throw new Error('useError must be used within an ErrorProvider');
  }
  return context;
}

/**
 * Error Boundary Component
 * Captura errores en el árbol de componentes
 */
import React from 'react';

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Error caught by boundary:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 px-4">
          <div className="text-center max-w-md">
            <h1 className="text-4xl font-bold text-red-600 mb-4">Oops!</h1>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              Something went wrong. Please try refreshing the page.
            </p>
            <button
              onClick={() => window.location.reload()}
              className="px-6 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
            >
              Refresh Page
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
