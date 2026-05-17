import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './app/App.jsx'
import './index.css'
import './i18n/config'

// Handle chunk load failures after new deployments — auto-reload once
// When a new version deploys, old chunk hashes become invalid (404).
// This catches the error and reloads the page to get fresh chunks.
window.addEventListener('error', (event) => {
    if (
        event.message?.includes('Failed to fetch dynamically imported module') ||
        event.message?.includes('Loading chunk') ||
        event.message?.includes('Loading CSS chunk')
    ) {
        const reloaded = sessionStorage.getItem('chunk-reload')
        if (!reloaded) {
            sessionStorage.setItem('chunk-reload', '1')
            window.location.reload()
        }
    }
})
// Clear the reload flag on successful load
sessionStorage.removeItem('chunk-reload')

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
