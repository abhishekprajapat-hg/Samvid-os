import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App.jsx'
import './index.css'
import { resolveTenantSlugFromPath } from './utils/tenantRouting'

const shouldUseStrictMode =
  import.meta.env.VITE_REACT_STRICT_MODE === 'true'
const tenantSlug = resolveTenantSlugFromPath(window.location?.pathname || '')
const routerBasename = tenantSlug ? `/${tenantSlug}` : undefined
const app = (
  <BrowserRouter basename={routerBasename}>
    <App />
  </BrowserRouter>
)

ReactDOM.createRoot(document.getElementById('root')).render(
  shouldUseStrictMode ? <React.StrictMode>{app}</React.StrictMode> : app,
)
