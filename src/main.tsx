import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { DocumentConfigProvider } from './contexts/DocumentConfigContext'
import './index.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <DocumentConfigProvider>
      <App />
    </DocumentConfigProvider>
  </StrictMode>,
)
