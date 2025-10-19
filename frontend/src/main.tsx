// import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import App from './App.tsx'
import { PortfolioProviders } from './contexts/PortfolioProviders'

console.log('🚀 [MAIN] Starting portfolio application with new data flow architecture');

createRoot(document.getElementById('root')!).render(
  // <StrictMode>
    <BrowserRouter>
      <PortfolioProviders>
        <App />
      </PortfolioProviders>
    </BrowserRouter>
  // </StrictMode>,
)
