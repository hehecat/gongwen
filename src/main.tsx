import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { inject } from '@vercel/analytics'
import { DocumentConfigProvider } from './contexts/DocumentConfigContext'
import './index.css'
import App from './App.tsx'

inject()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <DocumentConfigProvider>
      <App />
    </DocumentConfigProvider>
  </StrictMode>,
)
