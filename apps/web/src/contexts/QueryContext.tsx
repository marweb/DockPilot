import { createContext, useContext, ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from 'react-query';
import { ReactQueryDevtools } from 'react-query/devtools';

// Cliente de React Query
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
      staleTime: 30000,
      cacheTime: 600000,
      suspense: false,
    },
    mutations: {
      retry: 0,
    },
  },
});

interface QueryContextType {
  client: QueryClient;
}

const QueryContext = createContext<QueryContextType>({ client: queryClient });

interface QueryProviderProps {
  children: ReactNode;
}

/**
 * QueryContext Provider
 * Proporciona React Query a toda la aplicación
 * Incluye configuración global y devtools en desarrollo
 */
export function QueryProvider({ children }: QueryProviderProps) {
  return (
    <QueryContext.Provider value={{ client: queryClient }}>
      <QueryClientProvider client={queryClient}>
        {children}
        {import.meta.env.DEV && <ReactQueryDevtools initialIsOpen={false} />}
      </QueryClientProvider>
    </QueryContext.Provider>
  );
}

/**
 * Hook para usar el contexto de queries
 */
export function useQueryClient() {
  const context = useContext(QueryContext);
  return context.client;
}
