import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { AuthProvider } from './contexts/AuthContext.jsx'
import { GuideProvider } from './components/GuideTooltip.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <AuthProvider>
      <GuideProvider>
        <App />
      </GuideProvider>
    </AuthProvider>
  </StrictMode>,
)