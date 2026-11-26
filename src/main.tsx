import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { Analytics } from '@vercel/analytics/react'
import { DocumentConfigProvider } from './contexts/DocumentConfigContext'
import './index.css'
import App from './App.tsx'

const shouldMountAnalytics =
  !__IS_SINGLE_FILE__
  && import.meta.env.PROD
  && typeof window !== 'undefined'
  && window.location.protocol.startsWith('http')

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <DocumentConfigProvider>
      <App />
      {shouldMountAnalytics && <Analytics />}
    </DocumentConfigProvider>
  </StrictMode>,
)
