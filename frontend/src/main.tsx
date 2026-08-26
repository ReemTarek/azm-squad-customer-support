import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import './index.css'
import './i18n'
import "bootstrap/dist/js/bootstrap.bundle.min.js";
import App from './App.tsx'
import { AuthProvider } from './auth/AuthContext'
import { BrandingProvider } from './context/BrandingContext'

const queryClient = new QueryClient()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrandingProvider>
        <AuthProvider>
          <App />
        </AuthProvider>
      </BrandingProvider>
    </QueryClientProvider>
  </StrictMode>,
)
