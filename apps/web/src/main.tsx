import React from 'react';
import ReactDOM from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';
import { App } from './App.js';
import { AuthProvider } from './auth.js';
import { ErrorBoundary } from './ErrorBoundary.js';
import './styles.scss';

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, staleTime: 2000, refetchOnWindowFocus: true } },
});

const root = document.getElementById('root');
if (!root) throw new Error('Application root element is missing.');

ReactDOM.createRoot(root).render(
  <React.StrictMode>
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <BrowserRouter>
            <App />
          </BrowserRouter>
        </AuthProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  </React.StrictMode>,
);
