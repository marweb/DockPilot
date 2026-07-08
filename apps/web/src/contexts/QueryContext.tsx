import { createContext, useContext, ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
      staleTime: 30000,
      gcTime: 600000,
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

export function QueryProvider({ children }: QueryProviderProps) {
  return (
    <QueryContext.Provider value={{ client: queryClient }}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </QueryContext.Provider>
  );
}

export function useQueryClient() {
  const context = useContext(QueryContext);
  return context.client;
}
