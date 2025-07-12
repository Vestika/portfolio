import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { AuthProvider } from './contexts/AuthContext'
import { GrowthBookProvider } from './contexts/GrowthBookProvider'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthProvider>
      <GrowthBookProvider>
        <App />
      </GrowthBookProvider>
    </AuthProvider>
  </StrictMode>,
)
