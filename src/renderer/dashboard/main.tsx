import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import App from './App'
import { AuthProvider } from './contexts/AuthContext'
import '../styles/dashboard.css'
import { SettingsProvider } from './contexts/SettingsContext'

const Component: React.FC = () => {
  return (
    <AuthProvider>
      <SettingsProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<App />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        </BrowserRouter>
      </SettingsProvider>
    </AuthProvider>
  )
}

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <Component />
  </React.StrictMode>
) 