import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'
import './App.css'

const root = createRoot(document.getElementById('root'))
root.render(
  <StrictMode>
    <App />
  </StrictMode>
)

// Masquer le loader dès que React a monté l'app
// (court-circuite le timeout de 2s dans index.html)
window.__hideLoader?.()
