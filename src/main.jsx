import React from 'react'
import ReactDOM from 'react-dom/client'
import App from '@/App.jsx'
import { initTheme } from '@/lib/theme'
import '@/index.css'

// Initialize system-level theme (auto dark mode sync) before React mounts.
initTheme();

ReactDOM.createRoot(document.getElementById('root')).render(
  <App />
)